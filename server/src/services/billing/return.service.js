import mongoose from 'mongoose';
import { calculateReturn } from './returnCalculator.js';
import { Bill } from '../../models/Bill.js';
import { CreditNote } from '../../models/CreditNote.js';
import { Payment } from '../../models/Payment.js';
import { Product } from '../../models/Product.js';
import { StockBatch } from '../../models/StockBatch.js';
import { StockMovement } from '../../models/StockMovement.js';
import { Customer } from '../../models/Customer.js';
import { CustomerLedger } from '../../models/CustomerLedger.js';
import { User } from '../../models/User.js';
import { AuditLog } from '../../models/AuditLog.js';
import { nextSeq, getFinancialYear } from '../../models/Counter.js';
import bcrypt from 'bcrypt';

export const returnService = {
  /**
   * Preview a return calculation before committing
   */
  async previewReturn({ billId, returnLines }) {
    const bill = await Bill.findById(billId);
    if (!bill) {
      const err = new Error('Bill not found');
      err.statusCode = 404;
      throw err;
    }
    const calculation = calculateReturn({ bill, returnLines });
    return { calculation, bill };
  },

  /**
   * Process a return and issue a Credit Note
   */
  async createReturn({
    billId,
    returnLines,
    settlement = { adjustedAgainstDuePaise: 0, payouts: [] },
    reason = 'other',
    note = '',
    userId,
    ownerPin = null,
  }) {
    const bill = await Bill.findById(billId);
    if (!bill) {
      const err = new Error('Bill not found');
      err.statusCode = 404;
      throw err;
    }

    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 401;
      throw err;
    }

    // Check return window (7 days default)
    const billDate = new Date(bill.createdAt).getTime();
    const now = Date.now();
    const daysSince = (now - billDate) / (1000 * 60 * 60 * 24);
    const withinWindow = daysSince <= 7;

    let approvedBy = null;
    if (user.role === 'staff' || !withinWindow) {
      if (!ownerPin) {
        const err = new Error('Owner PIN required to process return');
        err.statusCode = 403;
        throw err;
      }
      const owner = await User.findOne({ role: 'owner', isActive: true });
      if (!owner || !(await bcrypt.compare(ownerPin, owner.pinHash || ''))) {
        const err = new Error('Invalid owner PIN');
        err.statusCode = 403;
        throw err;
      }
      approvedBy = owner._id;
    } else {
      approvedBy = user._id;
    }

    // Run pure calculator
    const calculation = calculateReturn({ bill, returnLines });
    const fy = getFinancialYear();
    const seq = await nextSeq(`creditnote_${fy}`);
    const creditNoteNo = `CN/${fy}/${String(seq).padStart(6, '0')}`;

    // 1. Prepare CreditNote items and restore stock for sealed units
    const creditNoteItems = [];
    for (const retLine of calculation.lines) {
      const originalLine = bill.items.find(
        (i) => i.lineId === retLine.lineId || i._id?.toString() === retLine.lineId
      );
      const isDamaged = Boolean(
        returnLines.find((r) => r.lineId === retLine.lineId)?.isDamaged
      );
      const restoredTo = [];

      const allocs = originalLine.allocations || originalLine.batchAllocations || [];
      if (!isDamaged && allocs.length > 0) {
        let qtyToRestore = retLine.qty;
        for (const alloc of allocs) {
          if (qtyToRestore <= 0) break;
          const restoreQty = Math.min(qtyToRestore, alloc.qty);
          qtyToRestore -= restoreQty;

          const updatedBatch = await StockBatch.findByIdAndUpdate(
            alloc.batchId,
            { $inc: { qtyLeft: restoreQty } },
            { new: true }
          );

          await Product.updateOne(
            { 'variants._id': originalLine.variantId },
            { $inc: { 'variants.$.stock': restoreQty } }
          );

          await StockMovement.create({
            productId: originalLine.productId,
            variantId: originalLine.variantId,
            batchId: alloc.batchId,
            qty: restoreQty,
            type: 'sale_return',
            reason: 'return',
            refType: 'return',
            refId: bill._id,
            balanceAfter: updatedBatch?.qtyLeft || restoreQty,
            createdBy: userId,
          });

          restoredTo.push({ batchId: alloc.batchId, qty: restoreQty });
        }
      }

      creditNoteItems.push({
        lineId: originalLine.lineId,
        variantId: originalLine.variantId,
        nameSnapshot: originalLine.nameSnapshot,
        flavour: originalLine.flavour || '',
        size: originalLine.size || '',
        hsn: originalLine.hsn || '21069099',
        gstRate: originalLine.gstRate,
        qty: retLine.qty,
        stockOutcome: isDamaged ? 'damaged' : 'sealed',
        mrpPaise: originalLine.mrpPaise,
        unitPricePaise: originalLine.unitPricePaise,
        netPaise: retLine.netPaise,
        taxablePaise: retLine.taxablePaise,
        cgstPaise: retLine.cgstPaise,
        sgstPaise: retLine.sgstPaise,
        igstPaise: retLine.igstPaise,
        costReturnedPaise: retLine.costReturnedPaise || 0,
        restoredTo,
      });

      // Update bill item returnedQty
      await Bill.updateOne(
        {
          _id: bill._id,
          items: {
            $elemMatch: {
              lineId: originalLine.lineId,
              returnedQty: originalLine.returnedQty || 0,
            },
          },
        },
        {
          $inc: { 'items.$.returnedQty': retLine.qty },
        }
      );
    }

    // 2. Adjust Bill dues & customer dues
    let adjustedDue = 0;
    if (bill.duePaise > 0) {
      adjustedDue = Math.min(bill.duePaise, calculation.grandTotalPaise);
      await Bill.findByIdAndUpdate(bill._id, {
        $inc: {
          duePaise: -adjustedDue,
          returnsTotalPaise: calculation.grandTotalPaise,
        },
        $set: {
          status: calculation.isFullBillReturn ? 'returned' : 'partial_returned',
        },
      });
    } else {
      await Bill.findByIdAndUpdate(bill._id, {
        $inc: { returnsTotalPaise: calculation.grandTotalPaise },
        $set: {
          status: calculation.isFullBillReturn ? 'returned' : 'partial_returned',
        },
      });
    }

    // If customer had dues, reduce customer balance and record ledger entry
    if (bill.customerId && adjustedDue > 0) {
      const customer = await Customer.findById(bill.customerId);

      if (customer) {
        const newBal = Math.max(0, (customer.dueBalancePaise || 0) - adjustedDue);
        await Customer.findByIdAndUpdate(customer._id, { dueBalancePaise: newBal });

        await CustomerLedger.create({
          customerId: customer._id,
          type: 'return_adjust',
          amountPaise: -adjustedDue,
          balanceAfterPaise: newBal,
          refType: 'return',
          refId: bill._id,
          note: `Credit note ${creditNoteNo} adjusted against bill due`,
          createdBy: userId,
        });
      }
    }

    // 3. Record Payout Payments if cash / upi refund given
    const payouts = settlement.payouts || [];
    for (const p of payouts) {
      if (p.amountPaise > 0) {
        await Payment.create({
          billId: bill._id,
          customerId: bill.customerId || null,
          type: 'refund',
          mode: p.mode,
          amountPaise: -Math.abs(p.amountPaise),
          refNo: p.refNo || '',
          receivedBy: userId,
        });
      }
    }

    // 4. Create CreditNote document
    const creditNote = await CreditNote.create({
      creditNoteNo,
      fy,
      billId: bill._id,
      billNoSnapshot: bill.billNo,
      customerSnapshot: bill.customerSnapshot,
      items: creditNoteItems,
      totals: {
        taxablePaise: calculation.taxablePaise,
        cgstPaise: calculation.cgstPaise,
        sgstPaise: calculation.sgstPaise,
        igstPaise: calculation.igstPaise,
      },
      roundOffPaise: calculation.roundOffPaise,
      grandTotalPaise: calculation.grandTotalPaise,
      settlement: {
        adjustedAgainstDuePaise: adjustedDue,
        payouts,
      },
      reason,
      note,
      profitAdjustmentPaise: calculation.profitAdjustmentPaise,
      withinWindow,
      approvedBy,
      staffId: userId,
    });

    // Record Audit Log if owner PIN was used
    if (ownerPin) {
      await AuditLog.create({
        action: 'return_approved',
        entity: 'CreditNote',
        entityId: creditNote._id,
        userId,
        details: {
          creditNoteNo,
          billNo: bill.billNo,
          grandTotalPaise: calculation.grandTotalPaise,
          withinWindow,
        },
      });
    }

    return creditNote;
  },

  async listCreditNotes({ page = 1, limit = 50 } = {}) {
    const skip = (Number(page) - 1) * Number(limit);
    const [creditNotes, total] = await Promise.all([
      CreditNote.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      CreditNote.countDocuments(),
    ]);
    return { creditNotes, total };
  },

  async getCreditNoteById(id) {
    const cn = await CreditNote.findById(id).populate('billId');
    if (!cn) {
      const err = new Error('Credit Note not found');
      err.statusCode = 404;
      throw err;
    }
    return cn;
  },
};
