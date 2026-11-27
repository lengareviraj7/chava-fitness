# Shop Owner Operations & Routines Guide

This guide details the daily, weekly, and monthly operational procedures required to maintain data integrity, security, and financial reconciliation for Chava Fitness Club.

---

## 1. Daily Operations Checklist

### Morning Routine:
1. Power on counter tablets/terminals and verify connectivity (green connection indicator in top bar).
2. Confirm catalog freshness (`Prices as of ...` indicator).
3. Verify opening cash drawer count matches yesterday's closing balance.

### Evening Routine (Day Close):
1. **Blind Count**: Cashier performs physical cash count without seeing system expected cash.
2. **Reconciliation**: Owner reviews counted cash against expected cash (cash sales + cash due collections - cash refunds).
3. **Lock Session**: System records discrepancy / shortage in `cash_drawer_sessions`.
4. **Sync Verification**: Ensure pending offline bills count is 0 before shutting down terminals.

---

## 2. Weekly & Monthly Routines
- **Weekly Sync Issues Triage**:
  - Navigate to **Settings > Data & Safety > Sync Issues**.
  - Review and resolve any `OVERSOLD` or `SERIES_GAP` issues.
- **Monthly Backup Restoration Drill**:
  - Execute automated test restore into a staging/drill database:
    ```bash
    npm run backup:drill
    ```
  - Verify that total bill counts, stock batches, and customer dues match original production data.
- **Monthly GST GSTR-1 Review**:
  - Export monthly tax register from **Reports > GST Register**.
  - Hand over CSV export to shop Chartered Accountant (CA) for GST portal filing.

---

## 3. Dashboard Banners Guide

| Banner Color | Message | Meaning & Required Action |
|---|---|---|
| 🔴 **Red** | `N sync issues need review` | Critical issue detected from offline sync (e.g. oversold item or sequence gap). Open Settings > Sync Issues to resolve. |
| 🟠 **Amber** | `Device A has N bills waiting over 4 hours` | Counter device has unsynced transactions. Reconnect terminal to Wi-Fi to synchronize. |
| 🟡 **Yellow** | `N products below minimum stock` | Inventory is below reorder threshold. Generate purchase orders from Reorder list. |
| 🔵 **Blue** | `Unclosed cash drawer session` | Previous business day cash drawer was not closed. Perform day close reconciliation. |

---

## 4. Dashboard Artwork Management (Hero Background)

To replace or update the shop whey-protein artwork displayed on the dashboard:
1. Place your high-resolution original image at:
   ```
   client/public/assets/hero/src/dashboard-bg-original.png
   ```
2. Run the automated optimization build script:
   ```bash
   npm run hero:build
   ```
3. The build script automatically processes the artwork using `sharp`, ensuring strict aspect ratio retention and file size constraints:
   - `client/public/assets/hero/dashboard-bg-2000.webp` (optimized for $\ge 768$px viewports, budget $\le 220$ KB).
   - `client/public/assets/hero/dashboard-bg-800.webp` (optimized for mobile viewports, budget $\le 90$ KB).
4. If `dashboard-bg-original.png` is absent, the system gracefully falls back to the clean ambient green radial glow backdrop without any broken image icons or mock tubs.

