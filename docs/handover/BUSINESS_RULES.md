# Business Rules & Logic Manual

This document provides a plain-language explanation of all core business, tax, and inventory rules enforced by the Chava Fitness Club ERP, cross-referenced with verifying test suites.

---

## 1. Taxation & GST Rules (Rule R9)
- **MRP is Inclusive**: All shelf prices and selling prices in supplement retail in India include GST.
- **Taxable Separation**:
  $$\text{taxablePaise} = \text{round}\left(\frac{\text{netPaise} \times 100}{100 + \text{gstRate}}\right)$$
  $$\text{gstPaise} = \text{netPaise} - \text{taxablePaise}$$
- **Intra-State vs Inter-State**:
  - Walk-in customers and same-state B2B: $\text{cgstPaise} = \lfloor\text{gstPaise} / 2\rfloor$, $\text{sgstPaise} = \text{gstPaise} - \text{cgstPaise}$.
  - Inter-state B2B: $\text{igstPaise} = \text{gstPaise}$.
- *Verification Evidence*: `server/tests/money.test.js`, `server/tests/calculatorByteParity.test.js`.

---

## 2. Discounting & Owner PIN Governance (Rule R11)
- Staff can grant line or bill discounts up to `settings.staffMaxDiscountPct` (default 10%).
- Any transaction exceeding this discount limit, applying price overrides, or selling below cost requires owner approval via a 4-digit PIN.
- Owner PIN attempts are rate-limited; 5 consecutive failures lock the session for 5 minutes.
- *Verification Evidence*: `server/tests/authz/pin.test.js`.

---

## 3. Bill Numbering Sequence (Rule R8)
- Formats:
  - Online Bills: `PS/2627/000123` (Prefix / FY / 6-digit consecutive counter).
  - Offline Counter Bills: `PS/2627/A00123` (Prefix / FY / Device Letter + 5-digit sequence).
  - Credit Notes: `CN/2627/000012`.
  - Due Receipts: `RC/2627/000045`.
- Numbers are assigned atomically upon completion using the `Counter` collection and are strictly gapless.
- *Verification Evidence*: `server/tests/concurrency.test.js`.

---

## 4. FEFO Inventory Consumption (Rule R3)
- When products are billed, batches are selected in ascending order of expiry date (`expiryDate ASC`).
- Batches with expiration dates prior to today cannot be sold.
- If physical inventory is depleted during an offline sale, the shortfall is logged in a dedicated shortfall batch and raises an `OVERSOLD` issue.
- *Verification Evidence*: `server/tests/stock/fefo.test.js`, `server/tests/interactions.test.js`.
