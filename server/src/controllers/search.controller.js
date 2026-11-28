import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Bill } from '../models/Bill.js';
import { Supplier } from '../models/Supplier.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const searchController = {
  async search(req, res, next) {
    try {
      const q = (req.query.q || '').trim();
      const defaultNavItems = [
        { title: 'New Bill (Counter POS)', path: '/billing', category: 'Pages', shortcut: 'F2' },
        { title: 'Udhari Credit Register', path: '/billing?tab=udhari', category: 'Pages' },
        { title: 'Stock & Purchase Inward', path: '/stock', category: 'Pages' },
        { title: 'Suppliers & Vendor Ledgers', path: '/stock?tab=suppliers', category: 'Pages' },
        { title: 'Customer Records & Balances', path: '/customers', category: 'Pages' },
        { title: 'Products & Variant Pricing', path: '/products', category: 'Pages' },
        { title: 'Daily Reports & Day Close', path: '/reports', category: 'Pages' },
        { title: 'Store Settings & Tax', path: '/settings', category: 'Pages' },
      ];

      if (!q) {
        return sendSuccess(res, {
          products: [],
          customers: [],
          bills: [],
          suppliers: [],
          navItems: defaultNavItems,
        });
      }

      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const [products, customers, bills, suppliers] = await Promise.all([
        Product.find({
          isActive: true,
          $or: [
            { name: regex },
            { brand: regex },
            { 'variants.sku': regex },
            { 'variants.flavour': regex },
            { 'variants.barcode': regex },
          ],
        }).limit(6),
        Customer.find({
          isActive: true,
          $or: [{ name: regex }, { phone: regex }, { address: regex }],
        }).limit(6),
        Bill.find({
          status: { $ne: 'voided' },
          $or: [{ billNo: regex }, { 'customerSnapshot.name': regex }, { 'customerSnapshot.phone': regex }],
        })
          .sort({ createdAt: -1 })
          .limit(6),
        Supplier.find({
          isActive: true,
          $or: [{ name: regex }, { phone: regex }],
        }).limit(6),
      ]);

      const navItems = defaultNavItems.filter((item) => regex.test(item.title));

      return sendSuccess(res, {
        products,
        customers,
        bills,
        suppliers,
        navItems,
      });
    } catch (err) {
      next(err);
    }
  },
};
