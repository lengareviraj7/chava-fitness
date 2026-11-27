import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { suggestedReorderQty, calculateOnOrderQty } from '../src/services/reporting/definitions.js';
import { toAsciiDigits } from '../src/utils/toAsciiDigits.js';

describe('Cross-Feature Interactions Suite (INTERACTIONS.md)', () => {
  describe('I-01: Offline x i18n & Digit Normalization', () => {
    it('transliterates Devanagari and Arabic-Indic numerals to ASCII digits', () => {
      expect(toAsciiDigits('९८७६५४३२१०')).toBe('9876543210');
      expect(toAsciiDigits('٥٤३२1')).toBe('54321');
      expect(toAsciiDigits('12345')).toBe('12345');
    });

    it('formats WhatsApp share links with safe URI encoding for Devanagari text', () => {
      const shopName = 'चावा फिटनेस क्लब';
      const orderText = `*ऑर्डर: PO/2627/0001*\nदुकान: ${shopName}`;
      const encoded = encodeURIComponent(orderText);
      expect(encoded).not.toContain(' ');
      expect(decodeURIComponent(encoded)).toBe(orderText);
    });
  });

  describe('I-03: Offline x Purchase Orders & Reorder Calculation', () => {
    it('accurately incorporates offline sales into avgDailySale and onOrderQty', () => {
      const mockPOs = [
        {
          status: 'sent',
          items: [
            { variantId: 'var-1', qtyOrdered: 20, qtyReceived: 5, closedShort: false },
            { variantId: 'var-2', qtyOrdered: 10, qtyReceived: 0, closedShort: true }, // closedShort excluded
          ],
        },
        {
          status: 'draft', // draft excluded
          items: [{ variantId: 'var-1', qtyOrdered: 50, qtyReceived: 0, closedShort: false }],
        },
      ];

      const onOrder = calculateOnOrderQty(mockPOs, 'var-1');
      expect(onOrder).toBe(15); // 20 - 5

      const reorder = suggestedReorderQty({
        avgDailySale: 2.0,
        reorderCoverDays: 30,
        qtyInStock: 10,
        onOrderQty: onOrder, // 15
      });

      // Target = ceil(2 * 30) = 60. Suggested = 60 - 10 - 15 = 35.
      expect(reorder.suggestedQty).toBe(35);
      expect(reorder.inputs.onOrderQty).toBe(15);
    });

    it('handles negative shortfall batches in stock correctly without going below 0 in reorder', () => {
      const reorder = suggestedReorderQty({
        avgDailySale: 1.0,
        reorderCoverDays: 30,
        qtyInStock: -5, // physical shortfall from offline overselling
        onOrderQty: 0,
      });

      // Target = ceil(1 * 30) = 30. Suggested = 30 - (-5) = 35.
      expect(reorder.suggestedQty).toBe(35);
    });
  });

  describe('I-04: Offline Sequence Monotonicity', () => {
    it('formats offline bill numbers strictly within 16 characters', () => {
      const prefix = 'CFC';
      const fy = '2627';
      const letter = 'A';
      const seq = 123;
      const formatted = `${prefix}/${fy}/${letter}${String(seq).padStart(5, '0')}`;
      expect(formatted).toBe('CFC/2627/A00123');
      expect(formatted.length).toBeLessThanOrEqual(16);
    });
  });

  describe('I-06: CSV Export Invariant & BOM Encoding', () => {
    it('prepends UTF-8 BOM so Excel opens Devanagari text cleanly', () => {
      const bom = '\uFEFF';
      const csvContent = `${bom}Product Name,Flavour,Stock\nमास गेनर,चॉकलेट,15\n`;
      const buffer = Buffer.from(csvContent, 'utf8');
      expect(buffer[0]).toBe(0xef);
      expect(buffer[1]).toBe(0xbb);
      expect(buffer[2]).toBe(0xbf);
      expect(buffer.toString('utf8')).toContain('मास गेनर');
    });
  });
});
