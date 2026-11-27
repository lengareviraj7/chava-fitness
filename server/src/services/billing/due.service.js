import mongoose from 'mongoose';
import { allocateDuePayment } from './dueAllocation.js';
import { Customer } from '../../models/Customer.js';
import { CustomerLedger } from '../../models/CustomerLedger.js';
import { Bill } from '../../models/Bill.js';
import { Payment } from '../../models/Payment.js';
import { nextSeq, getFinancialYear } from '../../models/Counter.js';

export const dueService = {
  async collectDue({ customerId, amountPaise, mode = 'cash', refNo = '' }, user) {
    if (!amountPaise || amountPaise <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    if (amountPaise > customer.dueBalancePaise) {
      throw new Error(`Amount exceeds customer outstanding balance of ${customer.dueBalancePaise} paise`);
    }

    // Find unpaid/partial bills for this customer sorted FIFO
    const billsWithDues = await Bill.find({
      customerId,
      status: { $in: ['completed', 'partially_returned'] },
      duePaise: { $gt: 0 },
    }).sort({ createdAt: 1 });

    const { allocations } = allocateDuePayment({
      openingDueRemainingPaise: customer.openingDuePaise || 0,
      billsWithDues,
      paymentAmountPaise: amountPaise,
    });

    const fy = getFinancialYear();
    const seq = await nextSeq(`rc_${fy}`);
    const receiptNo = `RC/${fy}/${String(seq).padStart(6, '0')}`;

    // Update bills
    for (const alloc of allocations) {
      if (alloc.target === 'opening') continue;
      const bill = await Bill.findById(alloc.target);
      if (!bill) continue;

      bill.duePaise = Math.max(0, bill.duePaise - alloc.amountPaise);
      bill.paidPaise += alloc.amountPaise;
      bill.paymentSummary.push({ mode, amountPaise: alloc.amountPaise });
      await bill.save();
    }

    // Update customer due balance
    customer.dueBalancePaise = Math.max(0, customer.dueBalancePaise - amountPaise);
    await customer.save();

    // Create Payment record
    const payment = await Payment.create({
      billId: billsWithDues[0]?._id || new mongoose.Types.ObjectId(),
      customerId: customer._id,
      mode,
      amountPaise,
      refNo: refNo || receiptNo,
      type: 'due',
    });

    // Write Customer Ledger entry
    const ledgerEntry = await CustomerLedger.create({
      customerId: customer._id,
      type: 'due_payment',
      amountPaise: -amountPaise, // Negative decreases due
      balanceAfterPaise: customer.dueBalancePaise,
      refType: 'payment',
      refId: payment._id,
      note: `Due payment collected via ${mode.toUpperCase()} (${receiptNo})`,
      createdBy: user._id,
    });

    return {
      receiptNo,
      payment,
      ledgerEntry,
      allocations,
      customer,
    };
  },
};
