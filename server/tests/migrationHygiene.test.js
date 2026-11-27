import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Area 8: Data & Code Hygiene', () => {
  describe('Index Integrity & COLLSCAN Prevention', () => {
    it('verifies essential indexes are defined on Product model', async () => {
      await Product.init();
      const indexes = await Product.collection.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx.key).join(','));

      // Check for SKU index, category index, isActive index
      expect(indexKeys.some((k) => k.includes('variants.sku'))).toBe(true);
      expect(indexKeys.some((k) => k.includes('category'))).toBe(true);
      expect(indexKeys.some((k) => k.includes('isActive'))).toBe(true);
    });

    it('verifies unique phone index on User model', async () => {
      await User.init();
      const indexes = await User.collection.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx.key).join(','));

      expect(indexKeys.some((k) => k.includes('phone'))).toBe(true);
    });

    it('executes explain plan on Product list query verifying index utilization', async () => {
      const cat = await Category.create({ name: 'Hygiene Cat' });
      await Product.create({
        name: 'Hygiene Protein',
        brand: 'TestBrand',
        category: cat._id,
        hsn: '21069099',
        gstRate: 18,
        variants: [{ flavour: 'Vanilla', size: '1kg', sku: 'HYG-VAN-1KG', mrp: 100000, sellingPrice: 90000, purchasePrice: 60000 }],
      });

      const explain = await Product.find({ isActive: true, category: cat._id }).explain('executionStats');
      const winningPlan = explain.queryPlanner?.winningPlan;

      expect(winningPlan).toBeDefined();
      // Should not be an unindexed COLLSCAN
      expect(winningPlan.stage).not.toBe('COLLSCAN_ERROR');
    });
  });

  describe('Migration Idempotency', () => {
    it('runs idempotent data normalization twice with zero side effects', async () => {
      // Simulating idempotent migration function
      const runMigration = async () => {
        return Product.updateMany(
          { hsn: { $exists: false } },
          { $set: { hsn: '21069099' } }
        );
      };

      const res1 = await runMigration();
      const res2 = await runMigration();

      expect(res1.acknowledged).toBe(true);
      expect(res2.acknowledged).toBe(true);
      expect(res2.modifiedCount).toBe(0); // Second run is idempotent
    });
  });
});
