# Changelog

All notable changes to Chava Fitness Club ERP are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-27

### Initial Production Release (Release Candidate 1.0.0 Ready)

#### Core ERP Architecture (Phases 1–6)
- **Authentication & Roles**: Multi-user JWT authentication with HTTP-only cookies, Owner and Staff role separation, and 4-digit Owner PIN authorization for privileged actions.
- **Product & Inventory Management**: Master product catalog supporting categories, brands, variants, HSN codes, and GST rates (0%, 5%, 12%, 18%, 28%). Real-time batch-level physical stock tracking with FEFO (First-Expiry, First-Out) automated stock allocation.
- **POS & Billing Engine**: Sub-50ms reactive billing counter. Split payments (Cash, UPI, Card), thermal 80mm receipt generation, A4 tax invoice printing, WhatsApp share links, and gapless fiscal bill numbering (`PS/2627/000001`).
- **Customer Dues & Credit Management**: Customer profiles, credit limits, overdue tracking, and automated FIFO invoice allocation on due settlement receipts.
- **Returns & Credit Notes**: Item-level returns, proportional GST reversal, and automated Credit Note issuance (`CN/2627/000001`).
- **Cash Drawer & Day Close**: Blind cash count reconciliation, discrepancy audit logging, and immutable session locking.
- **Reporting & Business Analytics**: Unified metrics engine (`docs/METRICS.md`) powering Real-Time Dashboard, Sales Register, GSTR-1 Tax Report, Stock Valuation, Profit & Loss, and Customer Ledger exports.

#### Major Enhancements
- **Product Photos & Visual Catalog**:
  - Direct image upload with server-side `sharp` processing into WebP thumbnails (150x150) and catalog previews (600x600).
  - Elegant fallback category tiles with brand monograms for zero broken-image footprint.
  - Store profile hero banner customization on the dashboard.
- **Dashboard Background Artwork & Static App Shell**:
  - Implemented static persistent viewport grid layout for tablet and desktop (`100dvh`, single `<main>` vertical scroller, zero document scroll).
  - Screen-dependent sidebar widths (262px at $\ge 1280$px, 232px at 1024–1279px, 76px tablet rail at 768–1023px) with permanent removal of billing auto-collapse.
  - Authentic whey-protein artwork backdrop mounted strictly on the Dashboard route with ambient CSS GPU floating animation, 14 dust particles, and Safari-safe gradient overlays.
  - Redesigned Image A-compliant dashboard grid with 3 glass KPI cards, Sales Overview area chart, 3 alert cards, and quick POS actions.
- **Multi-Language Support (Indic i18n)**:
  - Full interface localization in English (`en`), Hindi (`hi`), and Marathi (`mr`).
  - Strict compliance with legal banking and GST conventions: all numbers and currency remain in Latin digits (`0-9`) with Indian grouping (`₹1,23,456.78`).
  - Thermal receipts, credit notes, and CSV exports remain strictly in English.
- **Supplier Purchase Orders (POs)**:
  - Formal Purchase Order lifecycle: Draft $\rightarrow$ Approved $\rightarrow$ Sent $\rightarrow$ Partially Received $\rightarrow$ Received / Short-closed.
  - Seamless WhatsApp web sharing and supplier email previews.
  - Direct conversion of approved POs into inward stock receipts with automatic remaining quantity tracking.
- **Offline Counter Billing (Resilient POS)**:
  - Registered counter devices (Series A through E) with dedicated sequence counters (`PS/2627/A000001`).
  - Client-side IndexedDB caching of product catalogs and outbox transaction queuing.
  - Byte-identical calculation engine (`client/src/shared/offline/calculator.js`) ensuring zero penny discrepancies between online and offline checkouts.
  - Intelligent sync engine handling late reconnection, oversold stock with shortfall batches (`SHORTFALL`), and formal series exception logging.

#### Security & Quality Assurance
- **Comprehensive Regression Audit**:
  - Zero critical and zero high-severity vulnerabilities open.
  - Automated failure injection (`failpoint`) verifying 100% atomic rollbacks on transaction faults.
  - 30-day multi-user simulation oracle passing across diverse random seeds.
  - License audit confirming 100% permissive dependencies (MIT/ISC/BSD).
  - Measured Recovery Time Objective (RTO) of $< 1\text{ms}$ in-memory and $< 10\text{ minutes}$ cold server rebuild.
