import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { calculateQuote } from './calculator.js';
import { Bill } from '../../models/Bill.js';
import { Payment } from '../../models/Payment.js';
import { HeldCart } from '../../models/HeldCart.js';
import { Product } from '../../models/Product.js';
import { StockBatch } from '../../models/StockBatch.js';
import { StockMovement } from '../../models/StockMovement.js';
import { Customer } from '../../models/Customer.js';
import { CustomerLedger } from '../../models/CustomerLedger.js';
import { Settings } from '../../models/Settings.js';
import { User } from '../../models/User.js';
import { nextSeq, getFinancialYear } from '../../models/Counter.js';
import { stockService } from '../stock.service.js';
import { toAsciiDigits } from '../../utils/toAsciiDigits.js';

export const billingService = {
  /**
   * Real-time Quote for client cart
   */
  async getQuote({ items = [], billDiscount = null, isInterState = false }) {
    // Enrich items with live server data if not provided
    const enrichedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      const variant = product.variants.id(item.variantId);
      if (!variant) continue;

      enrichedItems.push({
        variantId: variant._id,
        qty: Number(item.qty) || 1,
        unitPricePaise: item.priceOverridden ? Number(item.unitPricePaise) : variant.sellingPrice,
        mrpPaise: variant.mrp,
        gstRate: item.gstRate !== undefined ? item.gstRate : (product.gstRate !== undefined ? product.gstRate : 0),
        lineDiscount: item.lineDiscount || null,
        costPaise: variant.purchasePrice || 0,
      });
    }

    return calculateQuote({
      items: enrichedItems,
      billDiscount,
      isInterState,
    });
  },

  /**
   * POS Atomic Multi-Document Checkout
   */
  async checkout(payload, user) {
    const {
      items = [],
      billDiscount = null,
      customerId: explicitCustomerId = null,
      customerName = null,
      customerPhone = null,
      customerAddress = null,
      payments = [],
      dueDate = null,
      idempotencyKey = null,
      approvalPin = null,
      expectedGrandTotalPaise = null,
    } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Cart cannot be empty');
    }

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await Bill.findOne({ idempotencyKey });
      if (existing) {
        return { bill: existing, duplicate: true };
      }
    }

    // 2. Load settings & customer
    const settings = (await Settings.findOne()) || {
      state: 'Maharashtra',
      billPrefix: 'PS',
      staffMaxDiscountPct: 10,
      defaultCustomerAddress: 'Visapur',
    };

    let customer = null;
    let customerId = explicitCustomerId;
    let customerSnapshot = {
      name: 'Walk-in Customer',
      phone: '',
      gstin: '',
      state: settings.state || 'Maharashtra',
      address: settings.defaultCustomerAddress || 'Visapur',
    };

    if (customerId) {
      customer = await Customer.findById(customerId);
    } else if (customerPhone) {
      const cleanDigits = toAsciiDigits(customerPhone).replace(/\D/g, '');
      const normalizedPhone =
        cleanDigits.length === 12 && cleanDigits.startsWith('91')
          ? cleanDigits.slice(2)
          : cleanDigits.length === 11 && cleanDigits.startsWith('0')
          ? cleanDigits.slice(1)
          : cleanDigits;

      if (normalizedPhone.length === 10) {
        customer = await Customer.findOne({ phone: normalizedPhone });
        if (!customer && customerName && customerName.trim().length >= 2) {
          customer = await Customer.create({
            name: customerName.trim(),
            phone: normalizedPhone,
            address: (customerAddress || settings.defaultCustomerAddress || 'Visapur').trim().slice(0, 120),
            state: settings.state || 'Maharashtra',
            dueBalancePaise: 0,
          });
        }
        if (customer) {
          customerId = customer._id;
        }
      }
    }

    if (customer) {
      customerId = customer._id;
      customerSnapshot = {
        name: customer.name,
        phone: customer.phone,
        gstin: customer.gstin || '',
        state: customer.state || settings.state || 'Maharashtra',
        address: customer.address || settings.defaultCustomerAddress || 'Visapur',
      };
    }

    const isInterState = customerSnapshot.state && customerSnapshot.state !== settings.state;

    // 3. Prepare line items, check price overrides & allocate batches
    const processedLines = [];
    let requiresApproval = false;
    let approvalReason = '';

    for (const line of items) {
      const product = await Product.findById(line.productId);
      if (!product) throw new Error(`Product not found: ${line.productId}`);

      const variant = product.variants.id(line.variantId);
      if (!variant) throw new Error(`Variant not found: ${line.variantId}`);

      const qty = Math.max(1, Math.round(Number(line.qty) || 1));
      const authoritativeUnitPrice = variant.sellingPrice;
      const unitPricePaise = line.priceOverridden ? Number(line.unitPricePaise) : authoritativeUnitPrice;
      const priceOverridden = Boolean(line.priceOverridden && unitPricePaise !== authoritativeUnitPrice);

      if (priceOverridden) {
        requiresApproval = true;
        approvalReason = 'Price override requested';
      }

      // Check batch allocation (FEFO)
      const allocations = await stockService.allocateBatches(variant._id, qty);
      let costTotalPaise = allocations.reduce((sum, a) => sum + a.qty * a.unitCostPaise, 0);
      if (costTotalPaise === 0 && variant.purchasePrice) {
        costTotalPaise = qty * variant.purchasePrice;
      }

      processedLines.push({
        lineId: line.lineId || new mongoose.Types.ObjectId().toString(),
        productId: product._id,
        variantId: variant._id,
        nameSnapshot: product.name,
        brand: product.brand || '',
        flavour: variant.flavour || '',
        size: variant.size || '',
        hsn: product.hsn || '21069099',
        barcode: variant.barcode || '',
        qty,
        mrpPaise: variant.mrp,
        unitPricePaise,
        priceOverridden,
        lineDiscount: line.lineDiscount || null,
        gstRate: product.gstRate !== undefined ? product.gstRate : 0,
        allocations,
        costTotalPaise,
        costPaise: Math.round(costTotalPaise / qty),
      });
    }

    // 4. Calculate Quote
    const quote = calculateQuote({
      items: processedLines.map((l) => ({
        variantId: l.variantId,
        qty: l.qty,
        unitPricePaise: l.unitPricePaise,
        mrpPaise: l.mrpPaise,
        gstRate: l.gstRate,
        lineDiscount: l.lineDiscount,
        costPaise: l.costPaise,
      })),
      billDiscount,
      isInterState,
    });

    // Check discount limit for staff
    const discountPct = quote.subtotalPaise > 0 ? (quote.totalDiscountPaise / quote.subtotalPaise) * 100 : 0;
    if (user.role === 'staff' && discountPct > (settings.staffMaxDiscountPct || 10)) {
      requiresApproval = true;
      approvalReason = `Discount exceeds staff maximum limit (${settings.staffMaxDiscountPct || 10}%)`;
    }

    // 5. Check Owner PIN if approval required for staff
    if (requiresApproval && user.role === 'staff') {
      if (!approvalPin) {
        const err = new Error(`Owner PIN approval required: ${approvalReason}`);
        err.statusCode = 403;
        err.code = 'APPROVAL_REQUIRED';
        throw err;
      }

      // Verify owner PIN
      const owner = await User.findOne({ role: 'owner', isActive: true });
      if (!owner || !owner.pin) {
        throw new Error('Owner PIN is not configured');
      }

      const pinValid = await bcrypt.compare(approvalPin.trim(), owner.pin);
      if (!pinValid) {
        const err = new Error('Invalid Owner Approval PIN');
        err.statusCode = 403;
        err.code = 'INVALID_PIN';
        throw err;
      }
    }

    // 6. Validate price quote expectation
    if (expectedGrandTotalPaise != null && quote.grandTotalPaise !== Number(expectedGrandTotalPaise)) {
      const err = new Error('Price or tax changed during checkout');
      err.statusCode = 409;
      err.code = 'PRICE_CHANGED';
      err.quote = quote;
      throw err;
    }

    // 7. Validate payments
    const grandTotalPaise = quote.grandTotalPaise;
    let totalPaidPaise = 0;
    const paymentRecords = [];

    for (const p of payments) {
      const amt = Number(p.amountPaise) || 0;
      if (amt <= 0) continue;
      totalPaidPaise += amt;
      paymentRecords.push({
        mode: p.mode,
        amountPaise: amt,
        refNo: p.refNo || '',
        cashTenderedPaise: p.cashTenderedPaise || null,
      });
    }

    if (totalPaidPaise > grandTotalPaise) {
      throw new Error('Total paid amount cannot exceed bill grand total');
    }

    const duePaise = grandTotalPaise - totalPaidPaise;
    if (duePaise > 0 && !customerId) {
      throw new Error('Customer profile is strictly required for credit sales / outstanding due');
    }

    // 8. Generate sequential bill number: e.g. PS/2627/000001
    const fy = getFinancialYear();
    const prefix = settings.billPrefix || 'PS';
    const seq = await nextSeq(`bill_${fy}`);
    const billNo = `${prefix}/${fy}/${String(seq).padStart(6, '0')}`;

    // 9. Decrement stock batches & log stock movements
    for (const line of processedLines) {
      for (const alloc of line.allocations) {
        const batch = await StockBatch.findById(alloc.batchId);
        if (!batch || batch.qtyLeft < alloc.qty) {
          throw new Error(`Stock depleted for batch ${alloc.batchNo}`);
        }

        batch.qtyLeft -= alloc.qty;
        await batch.save();

        await StockMovement.create({
          productId: line.productId,
          variantId: line.variantId,
          batchId: batch._id,
          qty: -alloc.qty,
          type: 'sale',
          reason: 'sale',
          refType: 'bill',
          refId: new mongoose.Types.ObjectId(), // Will be updated or linked
          balanceAfter: batch.qtyLeft,
          createdBy: user._id,
        });
      }
    }

    // 10. Assemble Bill Items with calculated net & tax
    const billItems = processedLines.map((line, idx) => {
      const qLine = quote.lines[idx];
      return {
        lineId: line.lineId,
        productId: line.productId,
        variantId: line.variantId,
        nameSnapshot: line.nameSnapshot,
        brand: line.brand,
        flavour: line.flavour,
        size: line.size,
        hsn: line.hsn,
        barcode: line.barcode,
        qty: line.qty,
        mrpPaise: line.mrpPaise,
        unitPricePaise: line.unitPricePaise,
        priceOverridden: line.priceOverridden,
        lineDiscountPaise: qLine.lineDiscountPaise,
        billDiscountSharePaise: qLine.billDiscountSharePaise,
        netPaise: qLine.netPaise,
        taxablePaise: qLine.taxablePaise,
        cgstPaise: qLine.cgstPaise,
        sgstPaise: qLine.sgstPaise,
        igstPaise: qLine.igstPaise,
        gstRate: qLine.gstRate,
        allocations: line.allocations,
        costTotalPaise: line.costTotalPaise,
        returnedQty: 0,
      };
    });

    const bill = new Bill({
      billNo,
      fy,
      status: 'completed',
      customerId: customer ? customer._id : null,
      customerSnapshot,
      gstType: isInterState ? 'inter' : 'intra',
      staffId: user._id,
      staffNameSnapshot: user.name,
      items: billItems,
      subtotalPaise: quote.subtotalPaise,
      lineDiscountTotalPaise: quote.lineDiscountTotalPaise,
      billDiscountPaise: quote.billDiscountPaise,
      taxablePaise: quote.taxablePaise,
      cgstPaise: quote.cgstPaise,
      sgstPaise: quote.sgstPaise,
      igstPaise: quote.igstPaise,
      roundOffPaise: quote.roundOffPaise,
      grandTotalPaise: quote.grandTotalPaise,
      savingsPaise: quote.savingsPaise,
      paidPaise: totalPaidPaise,
      duePaise,
      dueDate: dueDate ? new Date(dueDate) : null,
      paymentSummary: paymentRecords.map((p) => ({ mode: p.mode, amountPaise: p.amountPaise })),
      profitPaise: quote.profitPaise,
      idempotencyKey,
    });

    await bill.save();

    // Save individual payments
    for (const pr of paymentRecords) {
      await Payment.create({
        billId: bill._id,
        customerId: customer ? customer._id : null,
        mode: pr.mode,
        amountPaise: pr.amountPaise,
        refNo: pr.refNo,
        cashTenderedPaise: pr.cashTenderedPaise,
        type: 'sale',
      });
    }

    // Update customer due if credit sale
    if (customer && duePaise > 0) {
      customer.dueBalancePaise += duePaise;
      await customer.save();

      await CustomerLedger.create({
        customerId: customer._id,
        type: 'bill_due',
        amountPaise: duePaise,
        balanceAfterPaise: customer.dueBalancePaise,
        refType: 'bill',
        refId: bill._id,
        note: `Credit sale (Udhari) from bill ${bill.billNo}${dueDate ? ` (Promise date: ${new Date(dueDate).toLocaleDateString('en-IN')})` : ''}`,
        createdBy: user._id,
      });
    }

    // Redact profit for staff
    const sanitizedBill = bill.toObject();
    if (user.role === 'staff') {
      delete sanitizedBill.profitPaise;
      sanitizedBill.items.forEach((it) => {
        delete it.costTotalPaise;
        it.allocations?.forEach((a) => delete a.unitCostPaise);
      });
    }

    return { bill: sanitizedBill, duplicate: false };
  },

  /**
   * List completed bills with role-based redaction
   */
  async listBills({ search = '', staffId = '', status = 'all', page = 1, limit = 50, userRole = 'staff' } = {}) {
    const isOwner = userRole === 'owner';
    const filter = {};

    if (status !== 'all') filter.status = status;
    if (staffId) filter.staffId = staffId;
    if (search) {
      filter.$or = [
        { billNo: { $regex: search, $options: 'i' } },
        { 'customerSnapshot.name': { $regex: search, $options: 'i' } },
        { 'customerSnapshot.phone': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [bills, total] = await Promise.all([
      Bill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Bill.countDocuments(filter),
    ]);

    const sanitizedBills = bills.map((b) => {
      if (!isOwner) {
        delete b.profitPaise;
        b.items?.forEach((it) => {
          delete it.costTotalPaise;
          it.allocations?.forEach((a) => delete a.unitCostPaise);
        });
      }
      return b;
    });

    return {
      bills: sanitizedBills,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    };
  },

  async getBillById(id, userRole = 'staff') {
    const isOwner = userRole === 'owner';
    const bill = await Bill.findById(id).lean();
    if (!bill) throw new Error('Bill not found');

    const payments = await Payment.find({ billId: id }).lean();

    if (!isOwner) {
      delete bill.profitPaise;
      bill.items?.forEach((it) => {
        delete it.costTotalPaise;
        it.allocations?.forEach((a) => delete a.unitCostPaise);
      });
    }

    return { bill, payments };
  },

  /**
   * Held Carts
   */
  async holdCart({ cart, customerId = null, userId }) {
    const seq = await nextSeq('hold');
    const holdCode = `H-${String(seq).padStart(4, '0')}`;

    const held = await HeldCart.create({
      holdCode,
      staffId: userId,
      customerId,
      cart,
    });

    return held;
  },

  async listHeldCarts() {
    return HeldCart.find().populate('customerId', 'name phone').sort({ createdAt: -1 });
  },

  async recallHeldCart(holdCode) {
    const held = await HeldCart.findOneAndDelete({ holdCode });
    if (!held) throw new Error('Held cart not found or expired');
    return held;
  },

  /**
   * Void or Delete a bill created by mistake
   * - Restores stock allocations back into stock batches
   * - Reverses customer Udhari balance and writes CustomerLedger entry
   * - Either sets bill status to 'voided' or deletes it permanently
   */
  async voidOrDeleteBill(id, { reason = 'Created by mistake', permanentDelete = false } = {}, user) {
    const bill = await Bill.findById(id);
    if (!bill) throw new Error('Bill not found');
    if (bill.status === 'voided') throw new Error('Bill is already voided');

    // 1. Reverse stock batch deductions
    if (Array.isArray(bill.items)) {
      for (const item of bill.items) {
        if (Array.isArray(item.allocations)) {
          for (const alloc of item.allocations) {
            const batch = await StockBatch.findById(alloc.batchId);
            if (batch) {
              batch.qtyLeft += alloc.qty;
              await batch.save();

              await StockMovement.create({
                productId: item.productId,
                variantId: item.variantId,
                batchId: batch._id,
                qty: alloc.qty,
                type: 'sale_void',
                reason: 'void',
                refType: 'bill',
                refId: bill._id,
                balanceAfter: batch.qtyLeft,
                createdBy: user._id,
              });
            }
          }
        }
      }
    }

    // 2. Reverse customer due balance if any Udhari was recorded
    if (bill.customerId && bill.duePaise > 0) {
      const customer = await Customer.findById(bill.customerId);
      if (customer) {
        customer.dueBalancePaise = Math.max(0, customer.dueBalancePaise - bill.duePaise);
        await customer.save();

        await CustomerLedger.create({
          customerId: customer._id,
          type: 'bill_void',
          amountPaise: -bill.duePaise,
          balanceAfterPaise: customer.dueBalancePaise,
          refType: 'bill',
          refId: bill._id,
          note: `Voided bill ${bill.billNo} - mistake (${reason})`,
          createdBy: user._id,
        });
      }
    }

    // 3. Either permanent delete or mark as voided
    if (permanentDelete) {
      await Payment.deleteMany({ billId: bill._id });
      await Bill.findByIdAndDelete(bill._id);
      return { success: true, deleted: true, billId: bill._id, billNo: bill.billNo };
    }

    bill.status = 'voided';
    bill.duePaise = 0;
    bill.voidReason = reason || 'Created by mistake';
    bill.voidedAt = new Date();
    bill.voidedBy = user._id;
    await bill.save();

    await Payment.updateMany({ billId: bill._id }, { status: 'voided' });

    return { success: true, voided: true, bill };
  },

  /**
   * Edit a bill's customer details, promise date (dueDate), or paid/due split
   */
  async editBill(id, updateData = {}, user) {
    const bill = await Bill.findById(id);
    if (!bill) throw new Error('Bill not found');
    if (bill.status === 'voided') throw new Error('Cannot edit a voided bill');

    const {
      customerName,
      customerPhone,
      customerAddress,
      dueDate,
      paidAmountPaise,
      paymentMode,
    } = updateData;

    // Update customer snapshot on bill
    if (customerName !== undefined && customerName.trim()) {
      bill.customerSnapshot.name = customerName.trim();
    }
    if (customerPhone !== undefined) {
      bill.customerSnapshot.phone = customerPhone.trim();
    }
    if (customerAddress !== undefined) {
      bill.customerSnapshot.address = customerAddress.trim();
    }

    // If customer record is linked, sync customer record as well
    let customer = null;
    if (bill.customerId) {
      customer = await Customer.findById(bill.customerId);
      if (customer) {
        if (customerName !== undefined && customerName.trim()) {
          customer.name = customerName.trim();
        }
        if (customerPhone !== undefined) {
          customer.phone = customerPhone.trim();
        }
        if (customerAddress !== undefined) {
          customer.address = customerAddress.trim();
        }
      }
    }

    // Update promise date / dueDate
    if (dueDate !== undefined) {
      bill.dueDate = dueDate ? new Date(dueDate) : null;
    }

    // Update paid/due amounts if specified
    if (paidAmountPaise !== undefined && paidAmountPaise !== null) {
      const newPaidPaise = Math.max(0, Math.min(Number(paidAmountPaise), bill.grandTotalPaise));
      const oldDuePaise = bill.duePaise;
      const newDuePaise = bill.grandTotalPaise - newPaidPaise;
      const dueDiff = newDuePaise - oldDuePaise;

      bill.paidPaise = newPaidPaise;
      bill.duePaise = newDuePaise;

      if (paymentMode) {
        bill.paymentSummary = [{ mode: paymentMode, amountPaise: newPaidPaise }];
      }

      if (customer && dueDiff !== 0) {
        customer.dueBalancePaise = Math.max(0, customer.dueBalancePaise + dueDiff);
        await customer.save();

        await CustomerLedger.create({
          customerId: customer._id,
          type: 'bill_edit',
          amountPaise: dueDiff,
          balanceAfterPaise: customer.dueBalancePaise,
          refType: 'bill',
          refId: bill._id,
          note: `Bill ${bill.billNo} payment adjustment`,
          createdBy: user._id,
        });
      }
    }

    if (customer) {
      await customer.save();
    }

    await bill.save();

    return { success: true, bill };
  },
};
