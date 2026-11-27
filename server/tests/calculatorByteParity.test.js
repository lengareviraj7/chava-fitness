import { describe, it, expect } from 'vitest';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { calculateQuote } from '../src/services/billing/calculator.js';
import { calculateReturn } from '../src/services/billing/returnCalculator.js';
import { allocateDuePayment } from '../src/services/billing/dueAllocation.js';

describe('Area 3: Money & Ledger Re-Verification', () => {
  describe('Calculator Byte-Parity Assertion', () => {
    it('client copy of calculator.js is BYTE-IDENTICAL to server file', () => {
      const serverPath = path.resolve(__dirname, '../src/services/billing/calculator.js');
      const clientPath = path.resolve(__dirname, '../../client/src/shared/offline/calculator.js');

      expect(fs.existsSync(serverPath)).toBe(true);
      expect(fs.existsSync(clientPath)).toBe(true);

      const serverBuf = fs.readFileSync(serverPath);
      const clientBuf = fs.readFileSync(clientPath);

      const serverHash = crypto.createHash('sha256').update(serverBuf).digest('hex');
      const clientHash = crypto.createHash('sha256').update(clientBuf).digest('hex');

      expect(clientHash).toBe(serverHash);
      expect(clientBuf.equals(serverBuf)).toBe(true);
    });
  });

  describe('Calculator Invariants (Randomized Property Tests)', () => {
    it('satisfies taxable + gst = net and cgst + sgst = gst across 100 randomized carts', () => {
      const gstRates = [0, 5, 12, 18, 28];

      for (let i = 0; i < 100; i++) {
        const lineCount = 1 + Math.floor(Math.random() * 15);
        const items = [];

        for (let j = 0; j < lineCount; j++) {
          const qty = 1 + Math.floor(Math.random() * 10);
          const unitPricePaise = Math.floor(Math.random() * 500000); // up to ₹5,000
          const gstRate = gstRates[Math.floor(Math.random() * gstRates.length)];
          const hasDiscount = Math.random() > 0.5;

          items.push({
            variantId: `var-${j}`,
            qty,
            unitPricePaise,
            mrpPaise: unitPricePaise + 5000,
            gstRate,
            lineDiscount: hasDiscount ? { type: 'pct', value: Math.floor(Math.random() * 20) } : null,
          });
        }

        const isInterState = Math.random() > 0.5;
        const billDiscount = Math.random() > 0.5 ? { type: 'amount', value: Math.floor(Math.random() * 10000) } : null;

        const result = calculateQuote({ items, billDiscount, isInterState });

        // Invariant: grand total is multiple of 100 paise (exact ₹ rounding)
        expect(result.grandTotalPaise % 100).toBe(0);

        // Invariant: bill discount shares sum strictly to billDiscountPaise
        const sumShares = result.lines.reduce((sum, l) => sum + l.billDiscountSharePaise, 0);
        expect(sumShares).toBe(result.billDiscountPaise);

        // Invariant: per line taxable + gst = net
        for (const line of result.lines) {
          expect(line.taxablePaise + line.gstPaise).toBe(line.netPaise);
          if (isInterState) {
            expect(line.igstPaise).toBe(line.gstPaise);
            expect(line.cgstPaise).toBe(0);
            expect(line.sgstPaise).toBe(0);
          } else {
            expect(line.cgstPaise + line.sgstPaise).toBe(line.gstPaise);
            expect(line.igstPaise).toBe(0);
          }
          // Integers only
          expect(Number.isInteger(line.taxablePaise)).toBe(true);
          expect(Number.isInteger(line.gstPaise)).toBe(true);
          expect(Number.isInteger(line.netPaise)).toBe(true);
        }

        // Invariant: totals match line sums
        const sumTaxable = result.lines.reduce((s, l) => s + l.taxablePaise, 0);
        const sumGst = result.lines.reduce((s, l) => s + l.gstPaise, 0);
        expect(result.taxablePaise).toBe(sumTaxable);
        expect(result.totalGstPaise).toBe(sumGst);
      }
    });
  });

  describe('Return Calculator Invariants', () => {
    it('ensures credit note sum of partial returns equals full return total', () => {
      const items = [
        { lineId: 'line-1', nameSnapshot: 'Whey', qty: 4, unitPricePaise: 200000, netPaise: 800000, taxablePaise: 677966, cgstPaise: 61017, sgstPaise: 61017, unitCostPaise: 120000 },
        { lineId: 'line-2', nameSnapshot: 'Creatine', qty: 2, unitPricePaise: 100000, netPaise: 200000, taxablePaise: 178571, cgstPaise: 10714, sgstPaise: 10715, unitCostPaise: 60000 },
      ];
      const bill = {
        _id: 'bill-1',
        items,
        grandTotalPaise: 1000000,
        returnsTotalPaise: 0,
      };

      // Return 2 units of line 1
      const ret1 = calculateReturn({ bill, returnLines: [{ lineId: 'line-1', qty: 2 }] });
      expect(ret1.grandTotalPaise % 100).toBe(0);
      expect(ret1.isFullBillReturn).toBe(false);

      // Return remaining 2 units of line 1 and 2 units of line 2
      items[0].returnedQty = 2;
      bill.returnsTotalPaise = ret1.grandTotalPaise;

      const ret2 = calculateReturn({
        bill,
        returnLines: [
          { lineId: 'line-1', qty: 2 },
          { lineId: 'line-2', qty: 2 },
        ],
      });
      expect(ret2.isFullBillReturn).toBe(true);

      // Invariant: sum of credit notes on full return strictly equals original bill grand total
      expect(ret1.grandTotalPaise + ret2.grandTotalPaise).toBe(bill.grandTotalPaise);
    });
  });

  describe('Due Allocation Invariants', () => {
    it('allocates strictly FIFO and never leaves negative remaining due', () => {
      const bills = [
        { id: 'b1', billNo: 'PS/2627/000001', duePaise: 150000 },
        { id: 'b2', billNo: 'PS/2627/000002', duePaise: 300000 },
      ];

      const res = allocateDuePayment({
        openingDueRemainingPaise: 50000,
        billsWithDues: bills,
        paymentAmountPaise: 250000,
      });

      // 50,000 to opening, 150,000 to b1, 50,000 to b2
      expect(res.allocatedTotalPaise).toBe(250000);
      expect(res.unallocatedPaise).toBe(0);
      expect(res.allocations).toHaveLength(3);
      expect(res.allocations[0].target).toBe('opening');
      expect(res.allocations[0].amountPaise).toBe(50000);
      expect(res.allocations[1].target).toBe('b1');
      expect(res.allocations[1].amountPaise).toBe(150000);
      expect(res.allocations[2].target).toBe('b2');
      expect(res.allocations[2].amountPaise).toBe(50000);
      expect(res.remainingDuePaise).toBe(250000); // 300,000 - 50,000
      expect(res.remainingDuePaise).toBeGreaterThanOrEqual(0);
    });
  });
});
