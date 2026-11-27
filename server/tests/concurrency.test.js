import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Counter, nextSeq } from '../src/models/Counter.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Area 3 & 4: Concurrency Stress Testing', () => {
  describe('Gapless Counter Invariant under Concurrent Load', () => {
    it('generates strictly unique, gapless sequence numbers across 50 concurrent requests', async () => {
      const counterKey = 'bill_test_2627';
      const promises = Array.from({ length: 50 }, () => nextSeq(counterKey));

      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);

      // Verify all sequence numbers are unique
      const unique = new Set(results);
      expect(unique.size).toBe(50);

      // Verify strictly consecutive sequence from 1 to 50
      const sorted = [...results].sort((a, b) => a - b);
      for (let i = 0; i < 50; i++) {
        expect(sorted[i]).toBe(i + 1);
      }
    });
  });

  describe('Stock Depletion Concurrency (Simulated Batch Decrement)', () => {
    it('prevents negative stock when 50 concurrent checkouts compete for 5 units', async () => {
      // Simulate batch collection with conditional decrement
      const batchSchema = new mongoose.Schema({
        name: String,
        qtyLeft: { type: Number, required: true },
      });
      const TestBatch = mongoose.models.TestBatch || mongoose.model('TestBatch', batchSchema);

      const batch = await TestBatch.create({ name: 'Limited Whey', qtyLeft: 5 });

      // 50 simultaneous workers try to decrement 1 unit with { qtyLeft: { $gte: 1 } }
      const attempts = Array.from({ length: 50 }, async () => {
        const updated = await TestBatch.findOneAndUpdate(
          { _id: batch._id, qtyLeft: { $gte: 1 } },
          { $inc: { qtyLeft: -1 } },
          { new: true }
        );
        return updated ? 'SUCCESS' : 'INSUFFICIENT_STOCK';
      });

      const outcomes = await Promise.all(attempts);

      const successCount = outcomes.filter((o) => o === 'SUCCESS').length;
      const failureCount = outcomes.filter((o) => o === 'INSUFFICIENT_STOCK').length;

      expect(successCount).toBe(5);
      expect(failureCount).toBe(45);

      const finalBatch = await TestBatch.findById(batch._id);
      expect(finalBatch.qtyLeft).toBe(0);
      expect(finalBatch.qtyLeft).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Idempotency Under Concurrent Submissions', () => {
    it('ensures 20 simultaneous submissions with the same idempotency key create exactly 1 record', async () => {
      const recordSchema = new mongoose.Schema({
        idempotencyKey: { type: String, unique: true, required: true },
        billNo: String,
      });
      const TestBill = mongoose.models.TestBill || mongoose.model('TestBill', recordSchema);
      await TestBill.init(); // Wait for unique index creation in MongoDB

      const idempotencyKey = 'idem-uuid-test-999';

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, async () => {
          return TestBill.create({ idempotencyKey, billNo: 'PS/2627/000999' });
        })
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(19);

      // Verify the 19 errors were E11000 duplicate key errors
      for (const rej of rejected) {
        expect(rej.reason.code).toBe(11000);
      }

      const count = await TestBill.countDocuments({ idempotencyKey });
      expect(count).toBe(1);
    });
  });
});
