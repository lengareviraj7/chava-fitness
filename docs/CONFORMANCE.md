# CHAVA FITNESS CLUB ERP - SPECIFICATION CONFORMANCE MATRIX (FINAL REVISION)

This document provides a line-by-line verification matrix of every rule, architectural constraint, and Definition of Done from `docs/PROJECT_SPEC.md` across all development phases and enhancements (Phases 1–6, Audit Round 1, Product Photos, Hindi/Marathi i18n, Purchase Orders, and Offline Counter Billing).

---

## 1. Feature Flags & Operational Defaults

| Feature Flag | Location | Default Value | Verification Evidence | Status |
|---|---|---|---|---|
| `offlineBilling.enabled` | `Settings.offlineBilling.enabled` | `false` | `server/tests/offlineFlag.test.js` | **Verified Met** |
| `devices.offlineEnabled` | `Device.offlineEnabled` | `false` | `server/tests/offlineFlag.test.js` | **Verified Met** |
| `languages[].beta (hi)` | `client/src/i18n/languages.js` | `true` | UI Language Picker inspection | **Verified Met** |
| `languages[].beta (mr)` | `client/src/i18n/languages.js` | `true` | UI Language Picker inspection | **Verified Met** |

> **Feature Flag Isolation Proof**: With `offlineBilling.enabled === false`, all offline endpoints (`/offline/sync`, `/offline/catalog`) reject attempts with `403 OFFLINE_DISABLED`. Online checkout, server calculator, and inventory movements continue to run through the standard online pipeline (`POST /billing/quote` and server transaction) with zero divergence in timing, data structures, or stock allocation.

---

## 2. Non-Negotiable Business Rules Matrix

| Rule # | Requirement | Implementation Target | Verification Evidence | Status |
|---|---|---|---|---|
| **R1** | Product variants maintain independent stock with batch-wise tracking & expiry | `server/src/models/Product.js`, `Batch.js` | `server/tests/stock/batch.test.js` | **Met** |
| **R2** | Stock changes ONLY through `stock_movements` (audit trail maintained) | `server/src/models/StockMovement.js`, `ledger.service.js` | `server/tests/stock/movement.test.js` | **Met** |
| **R3** | FEFO Allocation: Earliest-expiry valid batches sold first; expired forbidden | `server/src/services/stock/batchAllocation.service.js` | `server/tests/stock/fefo.test.js` | **Met** |
| **R4** | Atomic Checkout Transaction: 1 Mongo transaction for bill + payment + stock + dues | `server/src/services/billing/checkout.service.js` | `server/tests/concurrency.test.js`, failpoint tests | **Met** |
| **R5** | Bill Immutability: Completed bills are never edited or deleted; returns create credit notes | `server/src/models/Bill.js`, `server/src/services/billing/return.service.js` | `server/tests/billing/return.test.js` | **Met** |
| **R6** | Server Authoritative: Server does all calculations; client only renders (1 narrow exception for offline module) | `server/src/services/billing/calculator.js`, `dueAllocation.js` | `server/tests/money.test.js`, byte-equality test | **Met** |
| **R7** | Bill Item Snapshot: Name, HSN, price, GST rate, cost snapshotted at time of sale | `server/src/models/Bill.js` embedded items | `server/tests/billing/snapshot.test.js` | **Met** |
| **R8** | Bill Number Sequence: `PS/2627/000123` consecutive per FY, atomic via `counters` | `server/src/models/Counter.js`, `nextSeq()` | `server/tests/billing/billSeq.test.js` | **Met** |
| **R9** | GST Rules: MRP tax-inclusive; taxable = round(net * 100 / (100 + rate)); intra vs inter | `server/src/services/billing/calculator.js` | `server/tests/money.test.js`, property tests | **Met** |
| **R10** | Credit & Supplier Ledgers: Due payments update customer & supplier balances | `server/src/services/billing/dueAllocation.service.js` | `server/tests/customer/ledger.test.js` | **Met** |
| **R11** | Owner PIN & Audit: Required for high discount, sales below cost, returns, backdating | `server/src/middleware/auth.js`, `AuditLog.js` | `server/tests/authz/pin.test.js` | **Met** |
| **R12** | Real Data: No fake statistics or mock data in production dashboard/reports | `server/src/services/reporting/definitions.js` | `server/tests/reports/metrics.test.js` | **Met** |

---

## 3. Deliberate Architectural Exceptions (Formally Approved)

1. **Service Worker Allowance**: A service worker (`vite-plugin-pwa` / Workbox) is formally approved, strictly restricted to precaching the built application shell (static hashed assets) and serving an offline navigation fallback. It enforces a strict `NetworkOnly` rule for all `/api/*`, `/healthz`, and `/readyz` endpoints, ensuring it **NEVER** caches, intercepts, or mocks API requests.
2. **Narrow Client-Side Calculation Exception**: The foundational rule *"the client never calculates money"* has exactly **ONE narrow exception**: the client-side offline billing module, which executes a byte-identical copy of `server/src/services/billing/calculator.js` to calculate cart totals when disconnected. Online billing remains 100% server-authoritative (`POST /billing/quote` and server checkout), completely unaltered.

---

## 4. Phase-by-Phase Conformance

### Phase 1: Foundation, Auth & Products
- [x] Multi-user RBAC (Owner vs Staff).
- [x] Strict data redaction: `purchasePrice` stripped server-side for staff (`server/tests/product.test.js`).
- [x] Category & Brand management with unique constraints.
- [x] Product variants with SKU & barcode indexes.

### Phase 1.5: UI Design System & Dark Theme
- [x] Fixed dark fitness palette: `--bg #050805`, `--bg-elevated #0B110C`, neon lime `--primary #B6F23B`.
- [x] Plus Jakarta Sans typography, card radii 20px, button 14px, chip 9999px.
- [x] Glass cards with backdrop-blur, glow borders, responsive top-bar and 7-item navigation.

### Phase 2: Stock, Purchases & Suppliers
- [x] Supplier management and invoice inwarding with batch & expiry dates.
- [x] Immutable `stock_movements` ledger with audit log.
- [x] Purchase voiding with reverse stock movements and supplier balance adjustments.

### Phase 3: POS Billing & Multi-Document Checkout
- [x] Pure calculation engine: taxable, CGST, SGST, IGST, round-off, discounts.
- [x] Atomic checkout transaction with idempotency key deduplication.
- [x] Thermal 80mm print preview and A4 tax invoice formatting.

### Phase 4: Customers, Dues, Returns & Day Close
- [x] Customer credit ledger and FIFO due payment allocation.
- [x] Return calculations, credit note issuance, sealed vs damaged stock handling.
- [x] Staff blind cash count and owner cash reconciliation.

### Phase 5: Real Dashboard & Financial Reports
- [x] All 6 reports (Sales, GST GSTR-1, Stock Valuation, Profit & Loss, Customer Dues, Day Close).
- [x] Metrics single source of truth in `server/src/services/reporting/definitions.js` and `docs/METRICS.md`.
- [x] Fast aggregations with proper indexes (`COLLSCAN` forbidden on production collections).

### Phase 6: Production Readiness & Deployment
- [x] Single-node replica set support for MongoDB multi-document transactions.
- [x] Encrypted off-site backups with SHA-256 manifest verification and restore drill.
- [x] Data import tools for products, opening stock, and customers with pre-flight dry run.

---

## 5. Major Enhancements Conformance

### Enhancement 1: Product Photos & Hero Image (Phase 7)
- [x] One photo per product (graceful fallback to category tile with brand monogram).
- [x] Images stored in MongoDB as WebP binary buffers (`thumb` 160x160 $\le 20\text{ KB}$, `medium` 600x600 $\le 120\text{ KB}$).
- [x] Mandatory Sharp re-encoding, magic byte verification, EXIF/GPS stripping, 24MP decompression bomb guard.
- [x] Transparent 900px wide WebP hero image stored under `kind: "hero"`.
- [x] Private caching headers (`max-age=31536000, immutable`, ETag with 304 Not Modified).
- [x] Bulk image matching algorithm (Barcode $\rightarrow$ SKU $\rightarrow$ normalized brand + name).
- [x] Zero photos exposed in printed receipts, credit notes, or CSV exports.
- [x] Included in backup manifest counts and restore drill verification.

### Enhancement 2: Multi-Language Support (Phase 8: en, hi, mr)
- [x] English (default), Hindi (हिन्दी), and Marathi (मराठी) user toggle.
- [x] Strict invariant: Numbers, currency (₹), and dates use Latin digits (`0-9`) and Indian grouping across all languages.
- [x] Technical terms remain English (`GST`, `HSN`, `UPI`, `MRP`, etc.).
- [x] Receipts, credit notes, and report CSV exports stay in English.
- [x] Server returns zero human-readable UI strings; returns structured `error.code` + `params`.
- [x] Server-side Unicode NFC normalization and grapheme-cluster length limits (`Intl.Segmenter`).
- [x] Shared `toAsciiDigits` transliterating Devanagari numerals (`०-९`) to ASCII on all inputs.
- [x] Noto Sans Devanagari font fallback scoped via `unicode-range`.
- [x] Translation review export/import tooling (`i18n-review.csv`) and `npm run i18n:check`.

### Enhancement 3: Supplier Purchase Orders (Phase 9)
- [x] Owner-only access; staff strictly excluded from PO views and `onOrderQty` fields.
- [x] 4th Tab inside Stock/Purchase (`Stock | Purchases | Orders | Suppliers`).
- [x] Zero direct accounting/stock impact: stock increases only when inwarded via Purchases.
- [x] `onOrderQty` metric defined in `definitions.js` and `docs/METRICS.md`.
- [x] `suggestedReorderQty` formula with cover days, stock, and on-order subtraction.
- [x] Reorder list grouping by last known supplier with atomic draft PO generation.
- [x] Purchase inwarding against PO updates `qtyReceived` in the SAME transaction.
- [x] Purchase void atomically reverses PO `qtyReceived` and status.
- [x] Revisions with mandatory audit reasons; Short-closing stops on-order counting.
- [x] WhatsApp click-to-chat sharing (plain English, chunked $\le 3,500$ chars) and A4 print template.

### Enhancement 4: Offline Counter Billing (Phase 10)
- [x] Service worker precaches app shell; never intercepts `/api/*` (Workbox `NetworkOnly`).
- [x] Client offline calculator is byte-identical copy of server calculator (`hash verified`).
- [x] Feature flag `offlineBilling.enabled` defaults to `false`.
- [x] Max 5 registered counter devices (Series A to E).
- [x] Dedicated offline bill numbering series: `${prefix}/${fy}/${letter}${seq5}` $\le 16$ characters.
- [x] Atomic IndexedDB transaction: outbox document, device sequence increment, and local FEFO decrement.
- [x] Hard limits: 24h offline, 100 unsynced bills, 72h catalog age block.
- [x] 9-step server ingestion pipeline with shortfall batch allocation (`kind: "shortfall"`).
- [x] Ambiguous online checkout recovery with `supersedesIdempotencyKey`.
- [x] GST report "Documents issued" section detailing online, credit notes, and offline series.
