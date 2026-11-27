# Production Go-Live Checklist & Deployment Procedures

This checklist outlines the critical steps required for transitioning Chava Fitness Club ERP from staging to production. Follow every stage in sequence.

---

## Phase 1: Pre-Deployment Preparations (T-7 to T-1 Days)

- [ ] **Infrastructure Setup**:
  - [ ] Ubuntu 24.04 LTS VPS provisioned with 4 vCPU, 8 GB RAM, and 50 GB NVMe SSD.
  - [ ] Node.js v20+ LTS and npm installed.
  - [ ] MongoDB Community 7.0+ installed and configured as single-node Replica Set (`rs0`).
  - [ ] Caddy reverse proxy installed with automatic HTTPS.
  - [ ] UFW firewall enabled: Allow ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) only.
- [ ] **Hardware Validation**:
  - [ ] Thermal printers (80mm ESC/POS) installed at Counter 1 and Counter 2.
  - [ ] Test print verified with zero margins and disabled browser headers/footers.
  - [ ] USB barcode scanners calibrated in USB HID keyboard emulation mode with auto-Enter suffix.
- [ ] **Data Cleansing & Master Catalog**:
  - [ ] Run `npm run reset:demo` to purge all test bills, demo customers, and dummy transactions.
  - [ ] Import master product catalog with exact HSN codes, GST percentages (12%, 18%), and MRP.
  - [ ] Inward opening physical inventory batches with verified expiry dates and batch numbers.
- [ ] **Staff Training**:
  - [ ] Cashiers trained on 44px mobile touch layout, search, barcode scanning, and split payments.
  - [ ] Cashiers trained on evening blind cash count day close.
  - [ ] Owner trained on Supplier PO generation and Sync Issue resolution.

---

## Phase 2: One-Week Parallel Run Strategy

To ensure zero risk of business disruption:
1. **Days 1–7**: Run legacy paper/manual billing in parallel with the Chava ERP terminal.
2. Every physical sale is entered into Chava ERP.
3. At the end of each shift, compare manual cash drawer totals against the ERP Day Close report.
4. Verify that inventory counts in the ERP match physical shelf counts daily.
5. If any calculation discrepancy occurs, halt and cross-check against `docs/METRICS.md`.

---

## Phase 3: Go-Live Day (T-0)

- [ ] **Morning Checklist (08:00 AM)**:
  - [ ] Verify MongoDB replica set health: `rs.status().ok === 1`.
  - [ ] Check API health endpoint: `curl https://erp.chavafitness.in/api/health`.
  - [ ] Verify initial opening cash balance entered in Day Close session.
  - [ ] Confirm receipt sequence starts cleanly at `PS/2627/000001`.
- [ ] **Counter Device Registration**:
  - [ ] Open Settings > Counter Devices on Terminal 1; register as Device A (Series A).
  - [ ] Open Settings > Counter Devices on Terminal 2; register as Device B (Series B).
  - [ ] Verify offline feature flag is set according to shop policy (default `false` unless network resilience is required).
- [ ] **First Live Transaction Verification**:
  - [ ] Perform live sale for a customer.
  - [ ] Verify thermal receipt prints cleanly with correct GST split.
  - [ ] Verify customer SMS/WhatsApp receipt share link works.

---

## Phase 4: Post Go-Live Monitoring (First 48 Hours)

- [ ] Check automated nightly backup execution at 02:00 AM.
- [ ] Review any warnings in Caddy and Node.js PM2 logs.
- [ ] Verify zero memory leaks or unhandled promise rejections in application logs.
- [ ] Confirm day close session reconciles with 100% cash accuracy.

---

## Emergency Rollback Plan

If an unrecoverable failure occurs during the first 24 hours:
1. Revert to manual paper billing immediately.
2. Capture a full database diagnostic dump:
   ```bash
   mongodump --uri="mongodb://localhost:27017/chava-erp" --out=./emergency-dump-$(date +%F)
   ```
3. Consult `docs/handover/TROUBLESHOOTING.md` or contact the technical support maintainer.
