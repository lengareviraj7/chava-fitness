# Cross-Feature Interaction Matrix & Invariants

This document specifies the non-trivial intersections between the four major enhancements (Product Photos, Hindi/Marathi i18n, Supplier Purchase Orders, and Offline Counter Billing) and foundational project systems (Money, Stock, Reporting, Backup/Restore, Security).

---

## 1. Feature Interaction Matrix

| Interaction | Domain Intersection | Invariants & Risk Mitigation | Test Target | Status |
|---|---|---|---|---|
| **I-01** | Offline $\times$ i18n | Offline UI, error codes, blocked features, and receipts render in `hi` and `mr`. Thermal/A4 print views handle Devanagari item and customer names directly from IndexedDB outbox. | `tests/interactions.test.js` | **Verified** |
| **I-02** | Offline $\times$ Photos | When offline, `<ProductImage />` suppresses network requests; renders fallback category icon tiles with brand monogram without 404 console errors. | `tests/interactions.test.js` | **Verified** |
| **I-03** | Offline $\times$ POs & Reports | Ingested offline bills contribute to `avgDailySale`, physical stock, and `onOrderQty` identical to online bills. Shortfall batches (`kind: "shortfall"`) accurately subtract in reorder math and are excluded from saleable stock. | `tests/interactions.test.js` | **Verified** |
| **I-04** | Offline $\times$ Backup/Restore | Restoring a mid-sync backup restores consistent device series counters and sync issues. Bill sequence counters never regress: next issued number continues above highest restored sequence. | `tests/interactions.test.js` | **Verified** |
| **I-05** | POs $\times$ Purchase Void $\times$ Stock $\times$ Returns | Voiding a purchase linked to a PO atomically restores PO `qtyReceived`, rolls status back (`received` $\rightarrow$ `partially_received`), and updates supplier balances without desync. | `tests/interactions.test.js` | **Verified** |
| **I-06** | i18n $\times$ CSV Exports $\times$ WhatsApp Share $\times$ Print | Financial CSVs remain UTF-8 with BOM and English headers, cleanly preserving Devanagari customer/product names. WhatsApp URLs encode Indic text via `encodeURIComponent`. | `tests/interactions.test.js` | **Verified** |
| **I-07** | Photos $\times$ Backup $\times$ Reset Demo $\times$ Delete | Backups include binary image buffers in manifest counts. `reset:demo` purges transactional images while safely preserving hero images and `--keep-products` versions. | `tests/interactions.test.js` | **Verified** |
| **I-08** | Service Worker $\times$ Deploy | App shell precached with Workbox; `/api/*`, `/healthz`, `/readyz` strictly enforced as `NetworkOnly`. Caddy serves `sw.js` with `no-cache` and hashed assets with `immutable`. Update banner never prompts mid-bill. | `tests/interactions.test.js` | **Verified** |
| **I-09** | GST Report $\times$ Documents Issued $\times$ Series Exceptions | GST report "Documents issued" section details online (`PS`), credit notes (`CN`), due receipts (`RC`), and offline series A–E. Declared `series_exceptions` count as cancelled without distorting sales or tax figures. | `tests/interactions.test.js` | **Verified** |
| **I-10** | Day Close $\times$ Late Offline Sync $\times$ Online Returns | Online return against an offline-created bill restores stock to appropriate batches, calculates credit note accurately, and handles late-synced cash in Day Close reconciliation. | `tests/interactions.test.js` | **Verified** |

---

## 2. Invariant Rules for Cross-Feature Workflows

1. **Shortfall Batches Exclusion**:
   - Shortfall batches (`batchNo: "SHORTFALL"`, `kind: "shortfall"`) track negative physical quantities resulting from offline overselling.
   - Rule: Shortfall batches **CANNOT** be allocated for new online sales. They are excluded from saleable stock queries but included in total inventory valuation and replenishment math.
2. **Bill Series Monotonicity across Disasters**:
   - Following database restore, `Counter` values for online bills and `DeviceSeries` records for offline devices must equal or exceed the maximum sequence found in `bills` and `offline_bills_log`.
3. **Immutability of Export Schemas**:
   - While the UI supports English, Hindi, and Marathi, all exported CSV files (Sales, GSTR-1, Stock) retain fixed English column headers for compatibility with tax accounting tools and Excel.
