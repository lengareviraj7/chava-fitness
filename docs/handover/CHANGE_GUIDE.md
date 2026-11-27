# Software Maintainer & Developer Change Guide

This guide governs all future code modifications, feature additions, and maintenance tasks for the Chava Fitness Club ERP. Any developer or autonomous agent modifying this codebase must adhere strictly to these engineering constraints.

---

## 1. Non-Negotiable Invariants

### A. Calculator SHA-256 Invariance
- The core financial engines:
  - `server/src/services/billing/calculator.js`
  - `server/src/services/billing/returnCalculator.js`
  - `client/src/shared/offline/calculator.js`
  MUST REMAIN BYTE-IDENTICAL.
- Any change to calculation logic requires re-running `npm run test:audit` to verify byte parity and invariance tests.
- Never introduce floating-point arithmetic for currency. All monetary calculations must use integer `paise` via `money.js`.

### B. Mobile-First Layout Rules (360px - 1440px)
- **Every screen must be designed and verified at phone widths (360px - 430px) before desktop.**
- Interactive elements must have a minimum tap target of **44x44 CSS pixels**.
- Bottom sheets must be used for mobile dialogs and filters; centered modals are reserved for desktop ($\ge 1024\text{px}$).
- Zero horizontal page scrolling on mobile. Use sticky table headers or swipeable cards.

### C. Indic Language & Number Formatting Rules
- Interface translations exist in English (`en`), Hindi (`hi`), and Marathi (`mr`).
- **All numbers, currency symbols (₹), and dates MUST strictly use Latin digits (`0-9`)** with Indian grouping (`1,23,456.78`). Never render numerals in Devanagari numerals (`०-९`) in monetary contexts.
- Printed thermal receipts, credit notes, and CSV export headers MUST remain strictly in English for legal GST and banking compliance.

---

## 2. Database & Data Model Evolution

### A. Safe Migration Hygiene
1. Never drop collections or rename columns in production without a two-phase migration.
2. New fields in Mongoose schemas must define safe defaults and backward compatibility.
3. Every new query path must have an accompanying index. Verify index usage using `.explain("executionStats")` to prevent full collection scans (`COLLSCAN`).

### B. Immutable Audit Ledgers
- The following collections are strictly append-only:
  - `bills`
  - `stock_movements`
  - `customer_ledger`
  - `payments`
  - `audit_logs`
- Never execute `.findByIdAndUpdate()` or `.deleteOne()` against finalized financial or stock records. Any correction must be recorded as an offsetting entry (e.g. Credit Note or Return).

---

## 3. Testing & Verification Requirements

### A. Failing Test First
For every reported defect or edge case:
1. Write a reproduction test in `server/tests/` that demonstrates the failure.
2. Implement the fix in application code.
3. Verify that the reproduction test passes.
4. Run the full verification suite:
   ```bash
   npm run verify:all
   ```
5. NEVER soften, skip (`test.skip`), or delete existing tests to force a pass.

### B. Performance & Bundle Budgets
- Production client JS bundle must remain strictly under **300 KB gzipped**.
- In-memory cart calculation for 100 line items must execute in under **50 milliseconds**.
- POS catalog search across 3,000+ items must return results in under **50 milliseconds**.
