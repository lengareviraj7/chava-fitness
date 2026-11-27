import { Customer } from '../models/Customer.js';
import { CustomerLedger } from '../models/CustomerLedger.js';
import { Bill } from '../models/Bill.js';
import { Settings } from '../models/Settings.js';

export const customerService = {
  async list({ search = '', hasDues = false, page = 1, limit = 50 } = {}) {
    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    if (hasDues) {
      filter.dueBalancePaise = { $gt: 0 };
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ dueBalancePaise: -1, name: 1 }).skip(skip).limit(Number(limit)),
      Customer.countDocuments(filter),
    ]);
    return { customers, total };
  },

  async getById(id) {
    const customer = await Customer.findById(id);
    if (!customer) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }
    return customer;
  },

  async findByPhone(phone) {
    return Customer.findOne({ phone: phone.trim() });
  },

  async create(data) {
    const existing = await Customer.findOne({ phone: data.phone.trim() });
    if (existing) return existing;
    return Customer.create({
      name: data.name.trim(),
      phone: data.phone.trim(),
      gstin: data.gstin?.trim() || '',
      state: data.state?.trim() || 'Maharashtra',
      openingDuePaise: data.openingDuePaise || 0,
      dueBalancePaise: data.openingDuePaise || 0,
    });
  },

  async update(id, data) {
    const customer = await Customer.findByIdAndUpdate(id, data, { new: true });
    if (!customer) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }
    return customer;
  },

  async getLedger(customerId) {
    const customer = await this.getById(customerId);
    const ledger = await CustomerLedger.find({ customerId }).sort({ createdAt: 1 });
    return { customer, ledger };
  },

  async getRefillReminders() {
    const settings = (await Settings.findOne()) || {};
    const refillDays = settings.refillReminderDays || 30;
    const thresholdDate = new Date(Date.now() - refillDays * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const bills = await Bill.find({
      customerId: { $ne: null },
      createdAt: { $lte: thresholdDate },
      status: { $ne: 'void' },
    })
      .populate('customerId')
      .sort({ createdAt: -1 })
      .limit(200);

    const reminders = [];
    const seenCustomers = new Set();

    for (const bill of bills) {
      const cust = bill.customerId;
      if (!cust || !cust.phone || seenCustomers.has(cust._id.toString())) continue;
      if (cust.lastReminderAt && new Date(cust.lastReminderAt) > sevenDaysAgo) continue;

      for (const item of bill.items) {
        const remainingQty = item.qty - (item.returnedQty || 0);
        if (remainingQty > 0) {
          seenCustomers.add(cust._id.toString());
          const daysAgo = Math.floor(
            (Date.now() - new Date(bill.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          const waMessage = encodeURIComponent(
            `Hi ${cust.name}! Your supply of ${item.nameSnapshot} from Chava Fitness Club was purchased ${daysAgo} days ago and may be running low. Visit us or message here to refill!`
          );
          reminders.push({
            customerId: cust._id,
            customerName: cust.name,
            phone: cust.phone,
            productName: item.nameSnapshot,
            purchasedAt: bill.createdAt,
            daysAgo,
            waLink: `https://wa.me/91${cust.phone}?text=${waMessage}`,
          });
          break;
        }
      }
    }

    return reminders;
  },

  async markReminderSent(customerId) {
    return Customer.findByIdAndUpdate(customerId, { lastReminderAt: new Date() }, { new: true });
  },
};
