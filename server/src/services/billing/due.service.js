import mongoose from 'mongoose';
import { allocateDuePayment } from './dueAllocation.js';
import { Customer } from '../../models/Customer.js';
import { CustomerLedger } from '../../models/CustomerLedger.js';
import { Bill } from '../../models/Bill.js';
import { Payment } from '../../models/Payment.js';
import { nextSeq, getFinancialYear } from '../../models/Counter.js';
import { formatINR } from '../../utils/money.js';

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

  /**
   * Retrieves all bills with outstanding due balance (Udhari)
   * with days remaining, reminder stages and pre-formatted reminder texts.
   */
  async getUdhariList({ filter = 'all', search = '' }) {
    const query = {
      status: { $in: ['completed', 'partially_returned'] },
      duePaise: { $gt: 0 },
    };

    const bills = await Bill.find(query)
      .populate('customerId')
      .sort({ dueDate: 1, createdAt: 1 })
      .lean();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalOutstandingPaise = 0;
    let dueSoonCount = 0;
    let overdueCount = 0;
    const customerIds = new Set();

    const processedBills = bills.map((bill) => {
      totalOutstandingPaise += bill.duePaise;
      if (bill.customerId?._id) customerIds.add(bill.customerId._id.toString());

      let daysRemaining = null;
      let stage = 'upcoming';

      if (bill.dueDate) {
        const due = new Date(bill.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffMs = due.getTime() - today.getTime();
        daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          stage = 'overdue';
          overdueCount++;
        } else if (daysRemaining === 0) {
          stage = 'due_today';
          dueSoonCount++;
        } else if (daysRemaining <= 3) {
          stage = 'due_in_3_days';
          dueSoonCount++;
        } else {
          stage = 'upcoming';
        }
      } else {
        stage = 'no_date';
      }

      const customerName = bill.customerSnapshot?.name || bill.customerId?.name || 'Customer';
      const phone = bill.customerSnapshot?.phone || bill.customerId?.phone || '';
      const address = bill.customerSnapshot?.address || bill.customerId?.address || 'Visapur';
      const remainingFormatted = formatINR(bill.duePaise);
      const totalFormatted = formatINR(bill.grandTotalPaise);
      const paidFormatted = formatINR(bill.paidPaise);
      const dueDateFormatted = bill.dueDate
        ? new Date(bill.dueDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : 'Not specified';

      let reminderMessage = '';
      if (stage === 'due_in_3_days') {
        reminderMessage = `Friendly reminder from Chava Fitness Club, Visapur! 🙏\nDear ${customerName},\nYour remaining udhari balance of ${remainingFormatted} for Bill #${bill.billNo} is due in 3 days on ${dueDateFormatted}.\nKindly arrange the payment.\nThank you!`;
      } else if (stage === 'due_today') {
        reminderMessage = `Greetings from Chava Fitness Club, Visapur! 🙏\nDear ${customerName},\nToday (${dueDateFormatted}) is the promised due date for your remaining balance of ${remainingFormatted} (Bill #${bill.billNo}).\nKindly pay today via Cash/UPI.\nThank you!`;
      } else if (stage === 'overdue') {
        reminderMessage = `Important reminder from Chava Fitness Club, Visapur! ⚠️\nDear ${customerName},\nYour udhari balance of ${remainingFormatted} for Bill #${bill.billNo} was due on ${dueDateFormatted} and is now overdue by ${Math.abs(daysRemaining)} days.\nKindly clear your balance today.\nThank you!`;
      } else {
        reminderMessage = `Greetings from Chava Fitness Club, Visapur! 🙏\nDear ${customerName},\nThis is a reminder regarding your remaining balance of ${remainingFormatted} for Bill #${bill.billNo} (Promised Date: ${dueDateFormatted}).\nThank you!`;
      }

      return {
        ...bill,
        customerName,
        phone,
        address,
        remainingFormatted,
        totalFormatted,
        paidFormatted,
        dueDateFormatted,
        daysRemaining,
        stage,
        reminderMessage,
      };
    });

    // Apply filtering
    let filteredBills = processedBills;
    if (filter === 'due_soon') {
      filteredBills = processedBills.filter((b) => b.stage === 'due_in_3_days' || b.stage === 'due_today');
    } else if (filter === 'overdue') {
      filteredBills = processedBills.filter((b) => b.stage === 'overdue');
    }

    // Apply text search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredBills = filteredBills.filter(
        (b) =>
          b.customerName.toLowerCase().includes(q) ||
          b.phone.includes(q) ||
          b.billNo.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q)
      );
    }

    return {
      bills: filteredBills,
      summary: {
        totalOutstandingPaise,
        totalBillsCount: bills.length,
        dueSoonCount,
        overdueCount,
        totalCustomersCount: customerIds.size,
      },
    };
  },

  /**
   * Settles a specific bill's due balance, updates customer balance and ledger
   */
  async settleBillDue({ billId, amountPaise, mode = 'cash', refNo = '' }, user) {
    const bill = await Bill.findById(billId);
    if (!bill) throw new Error('Bill not found');
    if (bill.duePaise <= 0) throw new Error('Bill is already fully paid');

    const paymentAmount = amountPaise != null ? Math.min(Number(amountPaise), bill.duePaise) : bill.duePaise;
    if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');

    const customer = bill.customerId ? await Customer.findById(bill.customerId) : null;

    bill.duePaise = Math.max(0, bill.duePaise - paymentAmount);
    bill.paidPaise += paymentAmount;
    bill.paymentSummary.push({ mode, amountPaise: paymentAmount });
    await bill.save();

    if (customer) {
      customer.dueBalancePaise = Math.max(0, customer.dueBalancePaise - paymentAmount);
      await customer.save();
    }

    const fy = getFinancialYear();
    const seq = await nextSeq(`rc_${fy}`);
    const receiptNo = `RC/${fy}/${String(seq).padStart(6, '0')}`;

    const payment = await Payment.create({
      billId: bill._id,
      customerId: customer ? customer._id : null,
      mode,
      amountPaise: paymentAmount,
      refNo: refNo || receiptNo,
      type: 'due',
    });

    let ledgerEntry = null;
    if (customer) {
      ledgerEntry = await CustomerLedger.create({
        customerId: customer._id,
        type: 'due_payment',
        amountPaise: -paymentAmount,
        balanceAfterPaise: customer.dueBalancePaise,
        refType: 'payment',
        refId: payment._id,
        note: `Bill ${bill.billNo} udhari settled via ${mode.toUpperCase()} (${receiptNo})`,
        createdBy: user._id,
      });
    }

    return {
      receiptNo,
      bill,
      customer,
      payment,
      ledgerEntry,
    };
  },

  /**
   * Records that a reminder was dispatched
   */
  async markReminderSent({ billId, stage }) {
    const bill = await Bill.findById(billId);
    if (!bill) throw new Error('Bill not found');
    bill.lastReminderSentAt = new Date();
    bill.lastReminderStage = stage || 'none';
    await bill.save();
    return bill;
  },
};
