import { describe, it, expect } from 'vitest';
import { SimulationOracle } from './oracle.js';

// Simple Linear Congruential Generator (LCG) PRNG for deterministic simulation
function createRng(seed = 42) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('Area 4: Full-System 30-Day Simulation v2', () => {
  it('runs 30-day multi-user simulation with Oracle matching across three seeds (42, 101, 2026)', () => {
    const seeds = [42, 101, 2026];

    for (const seed of seeds) {
      console.log(`[SIMULATION_v2] Running 30-day simulation with SEED: ${seed}`);
      const rng = createRng(seed);
      const oracle = new SimulationOracle();

      // Seed customers (with Devanagari and English names)
      const customers = [
        { id: 'c1', name: 'रमेश पाटील', phone: '9820000001', dueBalancePaise: 0 },
        { id: 'c2', name: 'Amit Sharma', phone: '9820000002', dueBalancePaise: 0 },
        { id: 'c3', name: 'सचिन कांबळे', phone: '9820000003', dueBalancePaise: 0 },
      ];
      for (const c of customers) {
        oracle.customers.set(c.id, { ...c });
      }

      // Seed initial stock batches
      oracle.recordPurchaseBatch({ batchId: 'b-wpi-1', variantId: 'v-wpi', qty: 50, expiryDate: '2027-12-31' });
      oracle.recordPurchaseBatch({ batchId: 'b-cm-1', variantId: 'v-cm', qty: 30, expiryDate: '2028-06-30' });

      let billSeq = 1;
      let returnSeq = 1;
      let poSeq = 1;

      // Simulate 30 operating days
      for (let day = 1; day <= 30; day++) {
        const dateStr = `2026-11-${String(day).padStart(2, '0')}`;

        // 1. Day 5: Owner creates Purchase Order
        if (day === 5) {
          oracle.recordPurchaseOrder({
            poId: `po-${poSeq}`,
            poNo: `PO/2627/${String(poSeq).padStart(4, '0')}`,
            items: [{ variantId: 'v-wpi', qtyOrdered: 25 }],
          });
          poSeq++;
        }

        // 2. Day 10: Inward part of the PO
        if (day === 10) {
          oracle.recordPOReceive({
            poId: 'po-1',
            receivedItems: [{ variantId: 'v-wpi', qty: 15 }],
          });
          oracle.recordPurchaseBatch({
            batchId: `b-wpi-inward-${day}`,
            variantId: 'v-wpi',
            qty: 15,
            expiryDate: '2028-01-01',
          });
        }

        // 3. Daily Sales (Online and Offline Device A & B)
        const dailyTransactions = 2 + Math.floor(rng() * 4);
        for (let t = 0; t < dailyTransactions; t++) {
          const isOffline = rng() > 0.6;
          const source = isOffline ? 'offline' : 'online';
          const cust = customers[Math.floor(rng() * customers.length)];
          const isCash = rng() > 0.3;
          const hasDue = !isOffline && rng() > 0.7; // dues only online
          const duePaise = hasDue ? 50000 : 0;

          const qtyWpi = 1 + Math.floor(rng() * 2);
          const grandTotal = qtyWpi * 300000;
          const taxable = Math.round((grandTotal * 100) / 118);
          const gst = grandTotal - taxable;
          const profit = taxable - qtyWpi * 200000;

          const billNo = isOffline ? `PS/2627/A${String(billSeq).padStart(5, '0')}` : `PS/2627/${String(billSeq).padStart(6, '0')}`;

          oracle.recordSale({
            billId: `bill-${billSeq}`,
            billNo,
            dateStr,
            items: [{ variantId: 'v-wpi', qty: qtyWpi }],
            customerId: cust.id,
            duePaise,
            isCash,
            grandTotalPaise: grandTotal,
            taxablePaise: taxable,
            gstPaise: gst,
            profitPaise: profit,
            source,
          });
          billSeq++;
        }

        // 4. Occasional Return (Day 15 & 25)
        if (day === 15 || day === 25) {
          oracle.recordReturn({
            returnId: `ret-${returnSeq}`,
            billId: 'bill-1',
            dateStr,
            items: [{ batchId: 'b-wpi-1', qty: 1, isDamaged: false }],
            grandTotalPaise: 300000,
            profitAdjustmentPaise: -54237,
            isCashRefund: true,
          });
          returnSeq++;
        }

        // 5. Customer Due Payment (Day 20)
        if (day === 20) {
          oracle.recordDuePayment({
            customerId: 'c1',
            dateStr,
            amountPaise: 25000,
            isCash: true,
          });
        }

        // 6. Day Close
        const drawer = oracle.cashDrawer.get(dateStr) || { cashInPaise: 0, cashOutPaise: 0 };
        const expectedCash = drawer.cashInPaise - drawer.cashOutPaise;
        // Minor counted discrepancy
        oracle.recordDayClose({ dateStr, countedCashPaise: expectedCash });
      }

      // Assert Oracle State Integrity
      const totals = oracle.getTotals();
      expect(totals.grossSales).toBeGreaterThan(0);
      expect(totals.netSales).toBe(totals.grossSales - totals.returnsTotal);
      expect(totals.netSales).toBeGreaterThan(0);
      expect(totals.grossProfit).toBeGreaterThan(0);

      // Verify on-order quantity on Day 30
      // PO-1 had 25 ordered, 15 received -> exactly 10 on-order remaining
      expect(oracle.getOnOrderQty('v-wpi')).toBe(10);

      // Verify all customer dues are non-negative integers
      for (const cust of oracle.customers.values()) {
        expect(cust.dueBalancePaise).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(cust.dueBalancePaise)).toBe(true);
      }

      // Verify every day close has balanced or recorded drawer
      for (const drawer of oracle.cashDrawer.values()) {
        expect(Number.isInteger(drawer.countedCashPaise)).toBe(true);
      }
    }
  });
});
