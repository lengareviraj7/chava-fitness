# User Acceptance Testing (UAT) Master Script

This script provides 30 structured, reproducible end-to-end acceptance scenarios to be verified by the shop owner and senior cashier before production sign-off.

---

## Part 1: Core POS Billing & Financial Calculations

### UAT-01: Standard Cash Sale with Mixed GST Rates
- **Action**: Add 1x Whey Protein (18% GST, ₹3,500) and 1x Multivitamin (12% GST, ₹800). Select Tender: Cash (₹4,300). Click Checkout.
- **Expected Result**: Bill generated with sequential number `PS/2627/000001`. Total tax correctly split into CGST (9% & 6%) and SGST (9% & 6%). Total roundoff is ₹0. Cash drawer opens.

### UAT-02: Split Payment (UPI + Cash)
- **Action**: Cart total ₹2,500. Enter ₹1,500 via UPI (enter reference `UPI123456`) and ₹1,000 Cash. Click Checkout.
- **Expected Result**: Payment records show two splits. Bill total paid equals ₹2,500. Due balance is ₹0.

### UAT-03: FEFO Batch Depletion Verification
- **Action**: Product with Batch A (Expiry: next month, 2 units) and Batch B (Expiry: 6 months, 5 units). Sell 3 units.
- **Expected Result**: System automatically depletes 2 units from Batch A and 1 unit from Batch B. Stock movements record FEFO consumption.

### UAT-04: Full Bill Return with Credit Note Issuance
- **Action**: Open completed Bill `PS/2627/000001`. Click "Process Return". Select all items. Refund method: Credit Note.
- **Expected Result**: Credit Note `CN/2627/000001` generated. Stock batches restored. Customer credit ledger updated if registered.

### UAT-05: Partial Return with Proportional GST Adjustment
- **Action**: Return 1 unit from a 3-unit sale.
- **Expected Result**: Tax credited proportionally. Bill marked as "Partially Returned".

---

## Part 2: Customer Credit & Ledgers

### UAT-06: Customer Credit Sale within Credit Limit
- **Action**: Select customer "Rahul Sharma" (Credit Limit: ₹10,000, Current Due: ₹0). Total bill ₹4,500. Tender: On Account / Credit.
- **Expected Result**: Bill saved with status `credit`. Customer `dueBalancePaise` becomes ₹4,500.

### UAT-07: Credit Sale Exceeding Credit Limit (Owner PIN Required)
- **Action**: Customer with ₹9,000 due attempts ₹3,000 purchase (limit ₹10,000).
- **Expected Result**: System blocks sale with "Credit Limit Exceeded". Requires owner 4-digit PIN override.

### UAT-08: Customer Due Collection (FIFO Invoice Allocation)
- **Action**: Customer owes ₹4,500 from Bill 1 and ₹2,000 from Bill 2. Collect ₹5,000 cash in Customer Ledger.
- **Expected Result**: Due receipt generated. Bill 1 fully settled (₹4,500); Bill 2 partially settled with ₹500 allocated. Remaining due: ₹1,500.

---

## Part 3: Cash Management & Day Close

### UAT-09: Blind Cash Drawer Reconciliation
- **Action**: At end of day, cashier enters physical cash count ₹14,200 without seeing expected cash.
- **Expected Result**: System reveals expected cash (e.g., ₹14,250). Shortage of ₹50 logged in `cash_drawer_sessions`. Session permanently locked.

### UAT-10: Mid-Day Cash Drawer Payout
- **Action**: Cashier records ₹200 expense for store supplies.
- **Expected Result**: Cash drawer balance decreases by ₹200. Expected cash reflects the expense at day close.

---

## Part 4: Inventory & Purchase Orders (POs)

### UAT-11: Create Purchase Order from Reorder Recommendations
- **Action**: Navigate to **Stock > Low Stock**. Click "Create PO from Low Stock".
- **Expected Result**: PO draft prefilled with suggested quantities to reach target stock.

### UAT-12: Supplier Purchase Order Approval & WhatsApp/Email Share
- **Action**: Approve PO `PO/2627/000001`. Click "Share via WhatsApp".
- **Expected Result**: Correct WhatsApp web link generated with formatted message containing item quantities and total expected cost.

### UAT-13: Inward Purchase against Purchase Order (Partial Receipt)
- **Action**: Inward 5 units against a 10-unit PO line. Enter batch number, mfg date, expiry date, purchase rate.
- **Expected Result**: PO status updates to `partially_received`. Inwarded stock batches created and immediately available for sale.

### UAT-14: Inward Remaining Units & Auto-Close PO
- **Action**: Inward remaining 5 units on the existing PO.
- **Expected Result**: PO status automatically transitions to `received`.

---

## Part 5: Product Photos & Visual Merchandising

### UAT-15: Upload Product Photo & Thumbnail Processing
- **Action**: Upload a 4MB JPEG product photo in Product Form.
- **Expected Result**: Server compresses image via `sharp` into WebP `thumb` (150x150) and `medium` (600x600). File size reduced to $< 50\text{ KB}$.

### UAT-16: Visual Tile Catalog Fallback
- **Action**: View product without an uploaded photo on POS counter tiles.
- **Expected Result**: Clean monogram badge displayed with brand name and category color. Zero broken image requests.

### UAT-17: Dashboard Hero Banner Customization
- **Action**: Upload custom store hero banner in **Settings > Store Profile**.
- **Expected Result**: Dashboard displays updated banner across mobile and desktop viewports.

---

## Part 6: Multi-Language (Indic i18n)

### UAT-18: Seamless Interface Switch to Hindi (`hi`)
- **Action**: Click language selector in top navigation; select "हिंदी".
- **Expected Result**: All navigation items, buttons, and system notices render in Hindi. Numbers and currency remain strictly in Latin digits (`₹1,500.00`).

### UAT-19: Seamless Interface Switch to Marathi (`mr`)
- **Action**: Switch language to "मराठी".
- **Expected Result**: All labels render in Marathi. Layout remains responsive without overflowing cards or buttons.

### UAT-20: English Printing & Export Invariance
- **Action**: With interface set to Marathi, print thermal receipt and export GSTR-1 CSV.
- **Expected Result**: Thermal receipt and CSV headers remain strictly in English as mandated by GST law.

---

## Part 7: Offline Counter Billing & Resiliency

### UAT-21: Offline Mode Activation & Status Indicator
- **Action**: Disconnect network connection on registered Counter Device A.
- **Expected Result**: Offline banner appears ("Offline - Mode Active"). POS continues to permit cash/card billing.

### UAT-22: Offline Bill Generation & Receipt Printing
- **Action**: Complete a cash sale while offline.
- **Expected Result**: Bill issued with Series A prefix `PS/2627/A000001`. Thermal receipt prints immediately. Transaction queued in IndexedDB outbox.

### UAT-23: Automatic Sync upon Network Reconnection
- **Action**: Re-enable network connection.
- **Expected Result**: Outbox automatically synchronizes transactions to server. Sync badge clears to 0.

### UAT-24: Oversold Stock Handling & Shortfall Batch
- **Action**: Bill 2 units offline when only 1 unit exists in online database. Sync to server.
- **Expected Result**: Server accepts bill to protect customer checkout. Creates negative shortfall batch (`batchNo: SHORTFALL`). Red banner appears on owner dashboard.

### UAT-25: Series Exception Declaration
- **Action**: Device encounters a local browser crash and skips sequence number `A000005`.
- **Expected Result**: Owner enters **Settings > Sync Issues** and logs a Series Exception documenting the voided bill number.

---

## Part 8: Reports, Backups & Disaster Recovery

### UAT-26: Monthly GSTR-1 Tax Export
- **Action**: Open **Reports > GST Register**. Export CSV for current month.
- **Expected Result**: CSV downloads with UTF-8 BOM, valid HSN summaries, correct taxable values, CGST, SGST, and IGST totals.

### UAT-27: Stock Valuation Report (FIFO / Cost vs MRP)
- **Action**: Open **Reports > Stock Valuation**.
- **Expected Result**: Total inventory cost value and potential retail value calculated accurately using active non-zero batches.

### UAT-28: Daily Automated Backup Creation
- **Action**: Run `npm run backup` from server terminal.
- **Expected Result**: Gzipped tarball generated under `backups/` containing Mongo dump and image assets with SHA-256 checksum.

### UAT-29: Clean Database Restoration Drill
- **Action**: Run `npm run backup:restore` against drill database.
- **Expected Result**: Database restored in $< 10\text{ seconds}$ with identical document counts and checksum matches.

### UAT-30: Mobile Viewport Stress (360px Width)
- **Action**: Open Chrome DevTools, set viewport to 360x640 (Galaxy S8/S9). Navigate through POS, Cart, and Checkout.
- **Expected Result**: Zero horizontal scrolling. All touch targets $\ge 44\text{px}$. Bottom sheets open smoothly.
