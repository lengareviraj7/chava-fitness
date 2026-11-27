# Hardware, Network & Operational Troubleshooting Guide

This guide details common hardware, operational, and network issues encountered in daily supplement retail operations at Chava Fitness Club, along with immediate triage steps and root-cause solutions.

---

## 1. POS Hardware & Peripherals

### A. Thermal Receipt Printer Not Printing or Cutting
- **Symptoms**: Cashier clicks "Print Receipt", but the thermal printer is silent, feeds blank paper, or stops midway.
- **Immediate Triage**:
  1. Check power cable and blue/green ready LED on the printer.
  2. Verify paper roll direction: Thermal paper is heat-sensitive on one side only. If paper feeds blank, the roll is upside down—open the hatch and invert the roll.
  3. Ensure the paper hatch is firmly latched (dual clicks on modern ESC/POS printers).
- **System & Browser Settings**:
  - Open browser print dialog (`Ctrl+P` / `Cmd+P`).
  - Destination: Select the thermal printer (e.g., *TVS RP-3200* or *Epson TM-T82*).
  - Paper Size: Set to `80mm` or `Roll Paper 80 x 297 mm`.
  - Margins: Set to **None** or **Minimum**.
  - Headers & Footers: **Uncheck** "Headers and Footers" to prevent browser URL timestamps from printing.
  - Scale: Default (100%).

### B. Barcode Scanner Typing Incorrect Characters or Too Slowly
- **Symptoms**: Scanning a barcode enters strange characters, skips characters, or triggers browser shortcuts.
- **Resolution**:
  1. **USB Keyboard Emulation**: Ensure the barcode scanner is programmed in "USB HID Keyboard Emulation" mode (scan the mode barcode in the scanner manual).
  2. **Inter-character Delay**: If characters are dropped on older counter tablets, scan the programming barcode for "10ms inter-character delay".
  3. **Carriage Return / Suffix**: Ensure the scanner sends `Enter` (CR/LF) after the barcode so the POS automatically commits the item into the cart.

---

## 2. Connectivity & Sync Issues

### A. Terminal Displays "Offline" Banner While Wi-Fi Is Connected
- **Symptoms**: Counter terminal shows orange "Offline" indicator even though local Wi-Fi router appears active.
- **Root Causes**:
  - The Wi-Fi router lost WAN (Internet) uplink, or the backend Node.js API process was stopped.
- **Resolution**:
  1. Check if the server machine is powered on and running `npm run dev:server` or production PM2 / systemd service.
  2. Test local ping from the terminal to the server IP (e.g. `ping 192.168.1.50`).
  3. *Note*: In offline mode, the cashier can still bill cash, card, and UPI sales uninterrupted. Transactions will automatically queue in IndexedDB and sync once connectivity is restored.

### B. Sync Issues Red Banner on Dashboard (`OVERSOLD` or `SERIES_GAP`)
- **Symptoms**: Owner dashboard shows a red banner: `N sync issues need review`.
- **Resolution**:
  1. Navigate to **Settings > Data & Safety > Sync Issues**.
  2. **`OVERSOLD` Issue**: Occurs when two counter terminals sold the last unit of a batch simultaneously offline. The server accepted the sale, generated a negative shortfall batch (`SHORTFALL`), and logged the issue.
     - *Action*: Inspect shelf stock. If stock is actually present, perform an Inventory Inward / Adjustment to clear the shortfall batch.
  3. **`SERIES_GAP` Issue**: Occurs if a device sequence jumped (e.g., from `A00010` to `A00012`).
     - *Action*: Confirm whether bill `A00011` was voided on the device or cancelled. File a formal series exception in the UI to document it for the GST auditor.

---

## 3. Financial & Cash Reconciliation

### A. Cash Drawer Discrepancy at Day Close
- **Symptoms**: Cashier's blind count does not match expected system cash during Day Close.
- **Root Causes**:
  - Unrecorded cash payout (e.g., small chai/stationery cash expense paid from drawer).
  - Tender mixup (cashier recorded a UPI transaction as Cash or vice versa).
- **Resolution**:
  1. Open **Reports > Sales Register** and filter by Cash transactions for the day.
  2. Match cash slips and physical bills in the drawer against listed bills.
  3. Enter the actual physical count. The system preserves both expected and actual cash counts, permanently recording the shortage/excess in the audit ledger.

---

## 4. Software & Database Operations

### A. Browser Cached Old Version After Server Update
- **Symptoms**: UI shows older layout or reports an unexpected network error after a new version was deployed.
- **Resolution**:
  1. Refresh the application using hard reload: `Shift + F5` or `Cmd + Shift + R`.
  2. If the Service Worker prompt "New update available" appears, click **Update Now** to activate the new bundle.
  3. To reset cached service worker manually: In Chrome DevTools > Application > Service Workers, click **Unregister** and reload.

### B. MongoDB Connection Refused or Primary Election Delay
- **Symptoms**: API logs display `MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017`.
- **Resolution**:
  1. Verify MongoDB service status:
     ```bash
     systemctl status mongod   # Linux
     brew services list        # macOS
     ```
  2. Start MongoDB service if stopped:
     ```bash
     systemctl start mongod
     ```
  3. Check MongoDB error log (`/var/log/mongodb/mongod.log`) for low disk space or port conflicts.

---

## 5. Security & Account Recovery

### A. Staff Locked Out or Forgotten Password
- **Resolution**:
  1. The shop owner can log in using their master account.
  2. Navigate to **Settings > Staff Accounts**.
  3. Click **Reset Password** on the affected staff member and provide a temporary 8+ character password.
