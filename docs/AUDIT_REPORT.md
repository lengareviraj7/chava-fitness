# CHAVA FITNESS CLUB ERP - QUALITY ASSURANCE & AUDIT REPORT

This report catalogs all findings, architectural verifications, and security audits performed by the independent QA & Security reviewer across **Round 1 (Initial Quality Gate)** and **Round 2 (Final Regression & Enhancement Audit)**.

---

## 1. Executive Summary
- **Overall Quality Gate Status**: **PASSED (RELEASE CANDIDATE 1.0.0 READY)**
- **Critical Issues**: 0 Open (All identified defects remediated)
- **High Severity Issues**: 0 Open (All identified defects remediated)
- **Medium Severity Issues**: 0 Open (All identified defects remediated)
- **Low Severity & Known Limitations**: Documented with owner recommendations

---

## 2. Round 1 Audit Findings (Initial System Audit)

| ID | Area | Severity | Description | How Found | Remediated Fix | Status |
|---|---|---|---|---|---|---|
| **R1-01** | Architecture | HIGH | `User` and other Mongoose models threw `OverwriteModelError` when running vitest test suites across multiple test forks. | Vitest test execution | Guarded model compilation with `mongoose.models.X \|\| mongoose.model('X', schema)`. | **Resolved** |
| **R1-02** | API Routes | HIGH | `product.routes.js` declared routes under `/products`, causing route nesting `/api/products/products` $\rightarrow$ 404. | Automated endpoint test | Cleaned route declarations to `/` and `/:id` mounted at `/api/products`. | **Resolved** |
| **R1-03** | API Utils | MEDIUM | `apiResponse.js` `sendSuccess` threw `RangeError: Invalid status code` when callers passed a status message string as 3rd parameter. | Unit tests | Updated `sendSuccess` to dynamically discern between string messages and numeric HTTP status codes. | **Resolved** |
| **R1-04** | Security | HIGH | Staff sessions required automated assertion that `purchasePrice` is never transmitted in API responses. | Staff leak scan | Verified server-side projection stripping in `product.service.js` with regression suite. | **Resolved** |

---

## 3. Round 2 Audit Findings (Enhancements Regression Audit)

| ID | Area | Severity | Description | How Found | Remediated Fix | Status |
|---|---|---|---|---|---|---|
| **R2-01** | Client Build | HIGH | `Toast.jsx`, `Modal.jsx`, `Button.jsx`, and 7 other UI components imported `../utils/cn` (1 level up) instead of `../../utils/cn.js` (2 levels up), breaking production Vite build. | `npm run build:client` | Updated relative import paths across all 9 UI components. | **Resolved** |
| **R2-02** | Client Pages | HIGH | `DashboardPage.jsx` and `DesignSystemShowcase.jsx` imported `formatINR` from `../utils/cn` instead of `../utils/money.js`. | `npm run build:client` | Corrected import paths to `../utils/money.js`. | **Resolved** |
| **R2-03** | Offline Invariant | CRITICAL | Feature flag `offlineBilling.enabled` must default strictly to `false` so offline code is inert unless explicitly turned on. | Automated feature flag test | Added explicit default `false` in `Settings` schema and enforced in `server/tests/offlineFlag.test.js`. | **Resolved** |
| **R2-04** | Ingestion Invariant | HIGH | MongoDB unique index on `idempotencyKey` built asynchronously in in-memory test databases caused race condition in test suite. | Concurrency stress test | Added `await Model.init()` ensuring unique indexes are fully synchronized before concurrent load. | **Resolved** |
| **R2-05** | Image Pipeline | MEDIUM | Non-image polyglot uploads could bypass client-side extensions. | Security test | Server verifies magic bytes (`FF D8 FF`, `89 50 4E 47`, WebP RIFF) and re-encodes through `sharp`. | **Resolved** |
| **R2-06** | Dependencies | LOW | `npm audit` flagged moderate vulnerability in `react-router` and high in `zod` for oversized collections. | `npm audit --omit=dev` | Evaluated risk: App enforces a 2MB body limit via Express and validates collections $\le 100$ items, mitigating denial-of-service vectors. Upgrading is a breaking change scheduled for v1.1.0. | **Documented** |

---

## 4. Questions for the Shop Owner
1. **Shortfall Batch Shelf Adjustment**: When an offline bill oversells stock and creates an `OVERSOLD` sync issue with a negative shortfall batch, should the app automatically propose an inventory stock adjustment upon owner resolution, or do you prefer counting the physical shelf first? *(Current implementation keeps shelf adjustment explicit and manual).*
2. **Offline Limit Tightening**: The default offline threshold allows up to 24 hours or 100 pending bills before blocking new offline checkouts. Would you prefer a tighter policy (e.g. 8 hours / 50 bills) for single-shift operations?
3. **Receipt Customer Names in Devanagari**: Thermal receipts currently print English headers and numeric totals with support for Devanagari item and customer names. Do you want customer names printed in Devanagari when entered in Marathi/Hindi, or transliterated to English? *(Current implementation prints Devanagari names using the Noto Sans Devanagari font).*

---

## 5. Known Limitations
1. **Single Shop ERP**: The system is architected for a single supplement retail shop with up to 5 registered counter devices. Multi-branch inventory transfer is not supported in v1.0.0.
2. **No Offline Credit or Returns**: Offline billing strictly permits fully paid cash, UPI, and card sales. Credit sales (customer dues), returns, and owner PIN overrides are disabled offline to protect cash and inventory integrity.
3. **Latin Digits Only**: In accordance with Indian retail banking and GST conventions, all numbers, prices, and percentages use Latin digits (`0-9`) with Indian grouping across all three interface languages (English, Hindi, Marathi).
4. **No Direct External Cloud Calls**: The application does not call external third-party image hosts or cloud translation APIs, ensuring zero SSRF risk and zero runtime translation latency.
