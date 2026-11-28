import { Product } from '../models/Product.js';
import { StockBatch } from '../models/StockBatch.js';
import { Customer } from '../models/Customer.js';
import { Purchase } from '../models/Purchase.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const notificationController = {
  async getNotifications(req, res, next) {
    try {
      const now = new Date();
      const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const [products, expiringBatches, customersWithDues, unpaidPurchases] =
        await Promise.all([
          Product.find({ isActive: true }).select('name brand variants updatedAt'),
          StockBatch.find({
            qtyLeft: { $gt: 0 },
            expiryDate: { $ne: null, $lte: sixtyDaysFromNow },
          })
            .populate('productId', 'name brand')
            .sort({ expiryDate: 1 })
            .limit(10),
          Customer.find({ isActive: true, dueBalancePaise: { $gt: 0 } })
            .sort({ dueBalancePaise: -1 })
            .limit(10),
          Purchase.find({ status: { $ne: 'voided' }, duePaise: { $gt: 0 } })
            .populate('supplierId', 'name phone')
            .sort({ duePaise: -1 })
            .limit(10),
        ]);

      const notifications = [];

      // 1. Low stock alerts
      for (const prod of products) {
        for (const variant of prod.variants || []) {
          if (!variant.isActive) continue;
          const minStock = variant.minStockLevel != null ? variant.minStockLevel : 3;
          if (variant.stock <= minStock) {
            const isOut = variant.stock === 0;
            notifications.push({
              id: `low-stock-${prod._id}-${variant._id}`,
              type: 'low_stock',
              severity: isOut ? 'danger' : 'warning',
              title: isOut ? 'Out of Stock' : 'Low Stock Alert',
              message: `${prod.name} (${variant.flavour || variant.size || 'Standard'}) has only ${variant.stock} units left!`,
              link: '/stock',
              actionLabel: 'View in Stock',
              createdAt: prod.updatedAt || now,
            });
          }
        }
      }

      // 2. Expiring batch alerts
      for (const batch of expiringBatches) {
        const prodName = batch.productId?.name || 'Product';
        const daysLeft = Math.ceil((new Date(batch.expiryDate) - now) / (1000 * 60 * 60 * 24));
        const isExpired = daysLeft <= 0;
        notifications.push({
          id: `expiry-${batch._id}`,
          type: 'expiring',
          severity: isExpired ? 'danger' : daysLeft <= 30 ? 'warning' : 'info',
          title: isExpired ? 'Batch Expired' : 'Batch Expiring Soon',
          message: `${prodName} • Batch ${batch.batchNo} (${batch.qtyLeft} units) ${
            isExpired ? 'has expired!' : `expires in ${daysLeft} days.`
          }`,
          link: '/stock',
          actionLabel: 'Inspect Batches',
          createdAt: batch.createdAt || now,
        });
      }

      // 3. Customer Udhari credit dues
      for (const cust of customersWithDues) {
        notifications.push({
          id: `customer-due-${cust._id}`,
          type: 'customer_due',
          severity: 'info',
          title: 'Customer Udhari Due',
          message: `${cust.name} has pending balance of ₹${(cust.dueBalancePaise / 100).toFixed(2)}.`,
          link: '/billing?tab=udhari',
          actionLabel: 'Collect Due',
          createdAt: cust.updatedAt || now,
        });
      }

      // 4. Supplier payable dues
      for (const inv of unpaidPurchases) {
        const supplierName = inv.supplierSnapshot?.name || inv.supplierId?.name || 'Supplier';
        notifications.push({
          id: `supplier-due-${inv._id}`,
          type: 'supplier_due',
          severity: 'warning',
          title: 'Supplier Payment Due',
          message: `${supplierName} • Invoice ${inv.invoiceNo} has ₹${(inv.duePaise / 100).toFixed(2)} pending payment.`,
          link: '/stock?tab=suppliers',
          actionLabel: 'Pay Supplier',
          createdAt: inv.createdAt || now,
        });
      }

      // Sort notifications by severity (danger > warning > info)
      const severityOrder = { danger: 0, warning: 1, info: 2 };
      notifications.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

      return sendSuccess(res, {
        totalCount: notifications.length,
        unreadCount: notifications.length,
        notifications,
      });
    } catch (err) {
      next(err);
    }
  },
};
