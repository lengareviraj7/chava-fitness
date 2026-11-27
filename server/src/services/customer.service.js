import { Customer } from '../models/Customer.js';
import { CustomerLedger } from '../models/CustomerLedger.js';
import { Bill } from '../models/Bill.js';
import { Settings } from '../models/Settings.js';
import { toAsciiDigits } from '../utils/toAsciiDigits.js';

export function normalizeCustomerPhone(rawPhone) {
  if (!rawPhone) return '';
  let p = toAsciiDigits(String(rawPhone).trim());
  p = p.replace(/\D/g, '');
  if (p.length === 12 && p.startsWith('91')) {
    p = p.slice(2);
  } else if (p.length === 11 && p.startsWith('0')) {
    p = p.slice(1);
  }
  return p;
}

export function normalizeCustomerName(rawName) {
  if (!rawName) return '';
  return String(rawName).trim().replace(/\s+/g, ' ').normalize('NFC');
}

export const customerService = {
  async lookup(q) {
    if (!q || typeof q !== 'string') return [];
    const query = q.trim();
    if (!query) return [];

    const asciiDigits = toAsciiDigits(query).replace(/\D/g, '');
    let filter = { isActive: true };

    if (asciiDigits.length >= 3) {
      filter.phone = { $regex: asciiDigits };
    } else if (query.length >= 2) {
      const escaped = query.normalize('NFC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    } else {
      return [];
    }

    const customers = await Customer.find(filter)
      .select('_id name phone address dueBalancePaise')
      .sort({ dueBalancePaise: -1, name: 1 })
      .limit(8)
      .lean();

    return customers;
  },

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
    const normalized = normalizeCustomerPhone(phone);
    return Customer.findOne({ phone: normalized || phone.trim() });
  },

  async create(data) {
    const name = normalizeCustomerName(data.name);
    if (!name || name.length < 2 || name.length > 60) {
      const err = new Error('Customer name must be between 2 and 60 characters');
      err.statusCode = 400;
      err.code = 'CUSTOMER_NAME_INVALID';
      throw err;
    }

    const phone = normalizeCustomerPhone(data.phone);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      const err = new Error('Invalid mobile number. Must be a 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      err.statusCode = 400;
      err.code = 'CUSTOMER_PHONE_INVALID';
      throw err;
    }

    const existing = await Customer.findOne({ phone });
    if (existing) {
      const err = new Error(`A customer with this mobile number already exists: ${existing.name}`);
      err.statusCode = 409;
      err.code = 'CUSTOMER_PHONE_EXISTS';
      err.existingCustomer = {
        _id: existing._id,
        name: existing.name,
        phone: existing.phone,
        address: existing.address || '',
        dueBalancePaise: existing.dueBalancePaise || 0,
      };
      throw err;
    }

    const address = data.address ? String(data.address).trim().normalize('NFC').slice(0, 120) : '';

    return Customer.create({
      name,
      phone,
      address,
      gstin: data.gstin?.trim() || '',
      state: data.state?.trim() || 'Maharashtra',
      openingDuePaise: data.openingDuePaise || 0,
      dueBalancePaise: data.openingDuePaise || 0,
    });
  },

  async update(id, data) {
    const updateData = { ...data };
    if (updateData.name) {
      updateData.name = normalizeCustomerName(updateData.name);
    }
    if (updateData.phone) {
      updateData.phone = normalizeCustomerPhone(updateData.phone);
    }
    if (updateData.address !== undefined) {
      updateData.address = updateData.address ? String(updateData.address).trim().normalize('NFC').slice(0, 120) : '';
    }

    const customer = await Customer.findByIdAndUpdate(id, updateData, { new: true });
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
