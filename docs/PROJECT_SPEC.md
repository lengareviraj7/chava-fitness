# CHAVA FITNESS CLUB ERP - MASTER PROJECT SPECIFICATION

## 1. Overview & Vision
A production-quality ERP for a protein and supplement retail shop in India: **CHAVA FITNESS CLUB**.
This is a real business management application handling real money and stock. Precision, simplicity, reliability, performance, and correctness are paramount.

- **Shop Name**: CHAVA FITNESS CLUB
- **Currency**: Indian Rupee (INR - ₹). Stored strictly as integer paise.
- **Taxation**: Indian Goods and Services Tax (GST) compliant.
- **Roles**:
  - `owner`: Full administrative access (pricing, purchases, stock, users, shop settings, financial reports, approval PIN).
  - `staff`: Billing and operational focus. Must NEVER see purchase prices, cost, or profit margins (enforced on server).
- **Core Loop**:
  `Purchase Stock` -> `Store in Inventory (Batch + Expiry)` -> `Sell (Billing/POS)` -> `Customers (Dues/Ledger)` -> `Reports`
- **Primary Navigation (EXACTLY 7 Items)**:
  1. Dashboard
  2. Billing (POS)
  3. Products
  4. Stock / Purchase
  5. Customers
  6. Reports
  7. Settings

---

## 2. Fixed Design Identity & UI/UX Standards
- **Brand**: CHAVA FITNESS CLUB
- **Design Aesthetic**: Premium futuristic SaaS, glassmorphism, clean tables and cards, modern typography, minimal text, excellent visual hierarchy, smooth transitions.
- **Color System**:
  - Primary Background: `#080B0D`
  - Secondary Background: `#101719`
  - Card Background: `#151D1F`
  - Border: `#293334`
  - Primary Accent: `#B8F36B` (Neon Lime Green)
  - Secondary Accent: `#8BD63D`
  - Main Text: `#F5F7F4`
  - Muted Text: `#9BA7A1`
  - Danger: `#FF6262`
  - Warning: `#FFB84D`
- **Typography**: Inter or Manrope.
- **3D Visual Experience**:
  - Centerpiece for Dashboard: Premium 3D protein supplement container (revolving animation, floating particles, glowing neon-green energy ring, dark cinematic lighting, soft green atmospheric glow).
  - Performance: Lazy-load 3D canvas (Three.js / React Three Fiber or optimized canvas visual), provide high-fidelity fallback illustration / image, respect `prefers-reduced-motion`, disable expensive shaders on low-powered mobile. Never block business operations.
  - Used on Dashboard only — no distracting 3D animations inside Billing/POS workflow.
- **Non-Negotiable Responsiveness**:
  - 320px width mobile to desktop monitors.
  - Dedicated mobile layouts (not just scaled-down desktop).
  - Touch-friendly (minimum 44px touch targets).
  - Controlled table scrolling or card transformation on mobile.
  - Mobile drawer navigation, bottom sheets for mobile actions, sticky primary buttons.
  - Billing screen must be 100% usable on mobile phones.

---

## 3. Tech Stack (Fixed)
- **Backend**:
  - Node.js 20+
  - Express
  - Mongoose & MongoDB (Replica Set required for multi-document ACID transactions; support both local Docker replica set and MongoDB Atlas via `MONGODB_URI`)
  - Zod (request schema validation)
  - JWT in `httpOnly` secure cookies
  - bcrypt (passwords & owner PIN)
  - helmet, cors, express-rate-limit (login throttling), dotenv, cookie-parser
  - Language: JavaScript with ES Modules (`"type": "module"`)
- **Frontend**:
  - React + Vite
  - Tailwind CSS configured with the exact brand color palette and typography
  - React Router DOM
  - Axios (configured with credentials for cookie forwarding)
  - Lucide React (clean icons)
- **Testing**:
  - Vitest on the backend
  - `mongodb-memory-server` in replica-set mode for transactions and schema integration tests
- **Monorepo Directory Structure**:
  ```text
  /server
    /src
      /config
      /models
      /routes
      /controllers
      /services
      /middleware
      /utils
      /seed
    /tests
    package.json
  /client
    /src
      /api
      /components
      /layouts
      /pages
      /utils
    package.json
  /docs
    PROJECT_SPEC.md
  docker-compose.yml (single-node MongoDB replica set)
  README.md
  package.json (root scripts)
  ```
- **Architectural Flow**:
  `Route` -> `Controller` -> `Service` -> `Model`
  - Controllers only handle HTTP request mapping and response dispatching.
  - Business logic, computations, and authorization checks live strictly in Services.
- **API Standards**:
  - Base path: `/api/v1`
  - Success format: `{ "success": true, "data": ... }`
  - Error format: `{ "success": false, "error": { "message": "...", "code": "..." } }`

---

## 4. MongoDB & Data Rules
1. **Replica Set**:
   - Single-node replica set (`rs0`) in Docker or Atlas cluster. Required for multi-document ACID transactions.
2. **Integer Currency (Paise)**:
   - ALL money is stored as integers in **paise** (`₹1.00 = 100 paise`). Floats are strictly prohibited for monetary values.
   - Util helpers: `rupeesToPaise`, `paiseToRupees`, `formatINR` (`en-IN` format).
3. **Soft Deletes & Auditing**:
   - `timestamps: true` on all relevant schemas.
   - Soft deletes (`isActive: Boolean`) for users, categories, products, variants. Never hard-delete records referenced by bills or ledger entries.
4. **Embedding vs. Referencing**:
   - **Products**: Embed `variants[]` (flavour + size; each variant has its own `sku`, optional `barcode`, `mrp`, `sellingPrice`, `purchasePrice`).
   - **Bills** (Phase 3): Embed snapshot of items (`name`, `hsn`, `price`, `gstRate`, `purchasePriceCost` at time of sale).
   - **Separate Collections**: `users`, `categories`, `products`, `settings`, `suppliers`, `purchases`, `stock_batches`, `stock_movements`, `customers`, `bills`, `payments`, `returns`, `counters`, `cash_sessions`, `audit_logs`.
5. **Indexes**:
   - `users.phone`: unique
   - `categories.name`: unique
   - `products`: text index on `name` + `brand`
   - `variants.sku`: unique
   - `variants.barcode`: partial unique index (only when present and non-empty)
6. **Server-Side Data Stripping**:
   - `purchasePrice` and profit margins MUST be removed from API responses for `staff` on the server side.

---

## 5. Non-Negotiable Business Rules (Permanent Source of Truth)
1. **Product Variants & Stock**: Product variants maintain independent stock. Stock is maintained batch-wise with expiry dates.
2. **Stock Movements**: Stock changes ONLY through `stock_movements` entries. Purchases increase stock; sales decrease stock; returns restore eligible stock. Complete audit trail maintained.
3. **FEFO Allocation**: Earliest-expiry valid batches are sold first (FEFO). Expired batches cannot be sold through normal billing.
4. **Atomic Checkout Transaction**: Checkout runs in ONE MongoDB multi-document transaction (bill + payments + stock decrement + customer dues) with an idempotency key to prevent double billing.
5. **Bill Immutability**: A completed bill is NEVER edited or deleted. Corrections happen through returns (credit notes) plus a new bill.
6. **Server Authoritative**: Server does all calculations (taxes, discounts, totals, balances). The frontend only displays results.
7. **Bill Item Snapshot**: Line items snapshot name, HSN, price, GST rate, and cost at time of sale.
8. **Bill Number Sequence**: Format `PS/2627/000123` (consecutive per financial year April-March), assigned only upon completion, atomically generated from `counters`.
9. **GST Rules**: MRP is inclusive of GST. `taxable = Math.round(net / (1 + rate/100))`. CGST + SGST for same-state / walk-in; IGST for inter-state B2B. GST rate and HSN are editable per product.
10. **Credit & Supplier Ledgers**: Credit payments update customer outstanding balances; supplier payments update supplier outstanding balances.
11. **Owner PIN & Audit**: Owner PIN required for: discounts above staff limit, sales below cost, returns, cancellations, backdating. All recorded in `audit_logs`.
12. **Real Data**: No fake statistics or hardcoded mock data in production dashboard/reports.

---

## 6. Development Phases
- **Phase 1 (CURRENT)**: Foundation, Auth, Shop Profile, Categories, Products & Variants
- **Phase 2**: Suppliers, Purchase Entry, Stock Batches, and Stock Ledger (FEFO tracking)
- **Phase 3**: Billing (POS) with Multi-Document Checkout Transaction & Invoice Printing
- **Phase 4**: Customers, Ledger / Dues, Returns (Credit Notes), Cash Drawer Sessions
- **Phase 5**: Dashboard (with 3D Supplement Hero Visual), Day Close, Financial & Tax Reports
- **Phase 6**: Data Backup & Restore, Polish, Hardening

---

## 7. Phase 1 Scope & Implementation Details

### 7.1 Server Foundation & Security
- Express server with `cors`, `helmet`, `cookie-parser`, `dotenv`.
- Login rate-limiter: `express-rate-limit`.
- Error handling middleware returning `{ success: false, error: { message, code } }`.
- Zod schema validation middleware for `body`, `query`, and `params`.
- Mongoose connection handling MongoDB replica sets.

### 7.2 Auth & Roles
- `POST /api/v1/auth/login`: Phone + password, returns JWT in `httpOnly` secure cookie.
- `GET /api/v1/auth/me`: Verifies cookie and returns user profile.
- `POST /api/v1/auth/logout`: Clears cookie.
- Role middleware: `requireRole('owner')`.
- Staff response serializer: Strips `purchasePrice` completely before sending to staff.

### 7.3 Users & Owner PIN (Owner Only)
- User Model: `name`, `phone`, `password` (bcrypt), `role` (`owner` | `staff`), `pin` (bcrypt hashed 4-6 digit owner PIN), `isActive`.
- Endpoints: List staff, create staff, toggle active status, reset password, set/update owner PIN.

### 7.4 Shop Profile (Settings)
- Settings Model: `shopName` ("CHAVA FITNESS CLUB"), `address`, `phone`, `email`, `gstin`, `state`, `billPrefix` ("PS").
- Owner can update, staff can read.

### 7.5 Categories
- Category Model: `name` (unique), `description`, `isActive`.
- Owner CRUD; staff read-only.

### 7.6 Products & Variants
- Product Model:
  - `name`, `brand`, `categoryId`, `hsn`, `gstRate`, `lowStockLimit`, `isActive`.
  - Embedded `variants[]`: `flavour`, `size`, `sku` (unique), `barcode` (optional, unique if present), `mrp` (paise), `sellingPrice` (paise, `<= mrp`), `purchasePrice` (paise, owner only), `isActive`.
- Validation: `sellingPrice <= mrp`, prices >= 0, unique SKU, unique non-empty barcode.
- Search & filter: Category chips, search by name/brand/barcode/sku, pagination.

### 7.7 Seeding
- Seed script (`server/src/seed/seed.js`):
  - Owner account (`DEFAULT_OWNER_PHONE`, `DEFAULT_OWNER_PASSWORD`).
  - Shop profile: "CHAVA FITNESS CLUB".
  - 8 Categories: Whey Protein, Mass Gainer, Creatine, Pre-Workout, BCAA/EAA, Vitamins & Health, Fat Burners, Accessories.
  - ~10 realistic supplement products with flavour/size variants.

### 7.8 Frontend UI/UX (Tailwind CSS)
- **Theme**: Dark futuristic palette (`#080B0D`, `#101719`, `#151D1F`, `#293334`, `#B8F36B` neon lime accents).
- **Navigation**: EXACTLY 7 items in the left sidebar:
  1. Dashboard (placeholder: "Coming in Phase 5")
  2. Billing (POS) (placeholder: "Coming in Phase 3")
  3. Products (Active Phase 1)
  4. Stock / Purchase (placeholder: "Coming in Phase 2")
  5. Customers (placeholder: "Coming in Phase 4")
  6. Reports (placeholder: "Coming in Phase 5")
  7. Settings (Active Phase 1: Shop Profile + Users + Categories)
- **Responsiveness**: Mobile drawer, bottom sheets / responsive modals, touch-friendly (>44px targets), no horizontal page scroll, table cards on mobile.
- **Amounts**: Displayed in INR format (`₹1,24,999.00`).

### 7.9 Automated Vitest Test Suite
- `tests/money.test.js`: Paise conversions, rounding, `en-IN` formatting.
- `tests/auth.test.js`: Login, JWT cookie, roles.
- `tests/product.test.js`: Product creation, variant rules (`sellingPrice <= mrp`), unique SKU.
- `tests/staff-security.test.js`: Confirms `purchasePrice` is never returned to Staff.


---

## 7. UI Design System (Phase 1.5)

### 7.1 Design Tokens & Colors
Dark, premium gym/fitness aesthetic with a neon lime accent. Dark theme ONLY (no theme toggle).
CSS variables mapped into Tailwind CSS:
- `--bg`: `#050805`
- `--bg-elevated`: `#0B110C`
- `--surface`: `rgba(255, 255, 255, 0.04)`
- `--surface-strong`: `rgba(255, 255, 255, 0.07)`
- `--border`: `rgba(255, 255, 255, 0.08)`
- `--primary`: `#B6F23B` (neon lime)
- `--primary-glow`: `#7CFF1F`
- `--primary-ink`: `#0A0F05` (text on lime buttons)
- `--text`: `#F4F7F1`
- `--muted`: `#9BA79A`
- Status Colors:
  - `--warning`: `#F59E0B` (low stock)
  - `--caution`: `#FACC15` (expiring soon)
  - `--purple`: `#A855F7` (customer dues)
  - `--danger`: `#EF4444`
  - `--success`: `#22C55E`

### 7.2 Radii, Elevation & Glow
- Cards: `rounded-[20px]` (20px)
- Buttons: `rounded-[14px]` (14px)
- Chips & Pills: `rounded-full` (999px)
- Glass Cards: Surface background + 1px border (`--border`) + backdrop-blur (`backdrop-blur-md` / `backdrop-blur-lg`).
- Primary Glow: `0 0 24px rgba(124, 255, 31, 0.35)`
- Page Background: Near-black (`#050805`) with soft green radial glows (bottom-left and top-right).
- Typography: Plus Jakarta Sans (self-hosted via `@fontsource-variable/plus-jakarta-sans`, no external CDN). Big bold numbers for KPIs. Icons from `lucide-react`.

### 7.3 Shared Components
All UI must use these shared components without ad-hoc colors or one-off styles:
- `Card`: Glass styling with surface backdrop-blur and 1px border.
- `StatCard`: Icon tile + large KPI number + label + % change badge (green up arrow / red down arrow).
- `Button`: Primary lime with glow + primary-ink text, secondary dark, ghost, danger. Min 44px touch targets.
- `Input`, `Select`, `Textarea`: Dark glass input with subtle border, focus ring in lime.
- `Badge`: Status badges with semi-transparent background and colored text/dot.
- `Chip` / `Tabs`: Active state = lime filled pill with dark text (`--primary-ink`).
- `Modal`: Glass modal overlay, dialog with backdrop-blur, accessible close button.
- `Table`: Dark table with hover rows, automatic mobile card fallback (stacked view at <= 390px).
- `EmptyState`: Centered icon, title, description, and action button with retry support.
- `Skeleton`: Shimmering placeholder blocks for async loading states.
- `Toast`: Global notification toast system for success/error/warning.
- `ConfirmDialog`: Modal confirmation for destructive/critical actions.

### 7.4 Animated Hero Backdrop (`<HeroBackdrop />`)
Reusable backdrop located on the Dashboard (top-right area, behind cards, faded with a gradient mask so text remains crisp and legible):
- Product tub image floats up and down (~6s, ease-in-out) with subtle tilt (+/- 2 deg). Loaded from `client/public/assets/hero/tub.png` or fallback built-in SVG placeholder tub (dark tub, lime label "WHEY PROTEIN").
- Glowing neon ring (ellipse with lime gradient stroke + blur glow) rotating around the tub (~14s, linear, infinite).
- 2 to 3 SVG dumbbells drifting/orbiting slowly at varying speeds (18s to 26s), slightly blurred for depth.
- Soft green glow blobs drifting in the background; up to 20 CSS-only powder particles floating upward.
- Performance & accessibility: Only animate `transform` and `opacity`, use `will-change` sparingly, pause animations on `document.hidden`, respect `prefers-reduced-motion` (render static), and hide tub on viewports < 768px (retaining subtle ambient glow).

### 7.5 Layout & Top Bar
- **Sidebar (Static Shell)**:
  - Width: 262px at >= 1280px, 232px from 1024px to 1279px, and 76px icon rail from 768px to 1023px. Width depends ONLY on screen size, NEVER on the route.
  - NOTE (DELIBERATE CHANGE): The Phase 3 rule "billing counter auto-collapses the sidebar" is REMOVED. The sidebar remains strictly static across all routes.
  - Persistent layout element that never unmounts or remounts on route change; zero entrance/exit animations or width transitions.
  - SVG dumbbell brand mark + shop name ("Chava / Fitness Club").
  - Exactly 7 menu items in strict order:
    1. Dashboard
    2. Billing (POS)
    3. Products
    4. Stock / Purchase
    5. Customers
    6. Reports
    7. Settings
  - Active item = lime filled pill with dark text and glow. Inactive items = muted text. Soft green swoosh glow at sidebar bottom.
  - User footer card: avatar with initials, user name, role Owner/Staff, dropdown with Language and Logout. User chip removed from top bar.
  - Mobile (<768px): keep existing bottom tab bar and normal page scrolling.
- **Top Bar**:
  - Global product search input with `Ctrl/Cmd + K` keyboard shortcut.
  - Notification bell with unread dot.
  - Date pill showing today's formatted date (e.g. `Mon, 28 Apr 2025`).
  - Sticky with transparent background; gets blurred dark background only after scrolling 8px or more. User chip removed.

### 7.6 Dashboard Screen Layout
1. **Row 1 - StatCards**: Today's Sales, Today's Profit (Owner only), Bills Today. Each with % change vs yesterday.
2. **Sales Overview Card**: Recharts area chart with neon lime line, gradient fill, tooltip pill, y-axis formatted in k (`₹10k`, `₹20k`), tabs for This Week / This Month / This Year.
3. **Alerts Column (Right)**:
   - Low Stock (amber)
   - Expiring Soon (yellow)
   - Customer Dues (purple)
   - Clickable cards with counts/amounts and chevrons.
4. **Bottom Row**:
   - Top Selling Products (range dropdown, thumbnail, product name, sales count, neon lime progress bar).
   - Recent Bills (bill number, amount in ₹, green status dot, relative time e.g. "2 min ago").
   - Quick action buttons: "New Bill" (primary lime + glow) and "Add Stock" (secondary dark).
5. **Staff Security Enforcement**:
   - `today.profitPaise` and `today.profitChangePct` are stripped on the server side in `GET /api/v1/dashboard/summary` if the user is staff.
   - Staff UI never renders the Profit card or any margin metrics.

### 7.7 Demo Dashboard Service
- Endpoint: `GET /api/v1/dashboard/summary?range=week|month|year`
- Service: `server/src/services/dashboardDemo.service.js` cleanly isolated behind service layer.
- Returns `{ isDemo: true, today: { salesPaise, profitPaise, bills, ... }, salesSeries: [...], alerts: {...}, topProducts: [...], recentBills: [...] }`.


---

## 8. Phase 2: Suppliers, Purchases, Stock Batches & Ledger Specification

### 8.1 Menu & Navigation
- The existing navigation item **Stock / Purchase** becomes an active route (`/stock`) containing 3 tabs:
  1. **Stock** (Default; accessible to Owner and Staff with role-based field redaction)
  2. **Purchases** (Owner only; 403 Forbidden for Staff)
  3. **Suppliers** (Owner only; 403 Forbidden for Staff)
- No other items are added to the 7-item menu.

### 8.2 Collections & Data Models
1. **`suppliers`**:
   - `name`: String, required, trimmed.
   - `phone`: String, required, indexed.
   - `gstin`: String, optional.
   - `address`: String, optional.
   - `isActive`: Boolean, default `true`.
   - `timestamps: true`.
2. **`purchases`**:
   - `purchaseNo`: String, unique (e.g., `PU/2627/0001` generated atomically via `counters` for current FY).
   - `supplierId`: ObjectId ref `suppliers`, required, indexed.
   - `supplierInvoiceNo`: String, required, trimmed.
   - `invoiceDate`: Date, required.
   - `items`: Array of embedded subdocuments:
     - `productId`: ObjectId ref `products`, required.
     - `variantId`: ObjectId, required.
     - `nameSnapshot`: String, required.
     - `flavour`: String.
     - `size`: String.
     - `qty`: Integer, required, min 1.
     - `unitCostPaise`: Integer paise (EXCLUDING GST), required, >= 0.
     - `gstRate`: Number (e.g. 18 for 18%), required, >= 0.
     - `batchNo`: String, required, trimmed.
     - `expiryDate`: Date (stored as the LAST day of the selected month at 23:59:59.999Z, or `null` if `trackExpiry === false`).
     - `batchId`: ObjectId ref `stock_batches`.
     - `lineTaxablePaise`: Integer paise, required.
     - `lineGstPaise`: Integer paise, required.
     - `lineTotalPaise`: Integer paise, required.
   - `subtotalPaise`: Integer paise, required.
   - `gstPaise`: Integer paise, required.
   - `totalPaise`: Integer paise, required.
   - `paidPaise`: Integer paise, default 0, required.
   - `duePaise`: Integer paise, required.
   - `paymentStatus`: Enum `['paid', 'partial', 'unpaid']`.
   - `status`: Enum `['active', 'voided']`, default `'active'`.
   - `voidReason`: String (required if status is 'voided').
   - `createdBy`: ObjectId ref `users`, required.
   - `idempotencyKey`: String, unique, required.
   - `timestamps: true`.
3. **`supplier_payments`**:
   - `supplierId`: ObjectId ref `suppliers`, required, indexed.
   - `purchaseId`: ObjectId ref `purchases`, optional, indexed.
   - `amountPaise`: Integer paise, required, > 0.
   - `mode`: Enum `['cash', 'upi', 'bank']`, required.
   - `refNo`: String, optional.
   - `paidAt`: Date, default `Date.now`.
   - `createdBy`: ObjectId ref `users`, required.
   - `timestamps: true`.
4. **`stock_batches`**:
   - `productId`: ObjectId ref `products`, required, indexed.
   - `variantId`: ObjectId, required, indexed.
   - `batchNo`: String, required, trimmed.
   - `expiryDate`: Date (null if untracked).
   - `qtyReceived`: Integer, required, >= 0.
   - `qtyLeft`: Integer, required, >= 0.
   - `unitCostPaise`: Integer paise, required, >= 0.
   - `purchaseId`: ObjectId ref `purchases`, required, indexed.
   - Unique compound index: `{ variantId: 1, batchNo: 1, expiryDate: 1 }`.
   - Secondary index: `{ variantId: 1, expiryDate: 1 }`.
   - `timestamps: true`.
5. **`stock_movements` (The Immutable Ledger)**:
   - `productId`: ObjectId ref `products`, required.
   - `variantId`: ObjectId, required, indexed.
   - `batchId`: ObjectId ref `stock_batches`, required, indexed.
   - `qty`: Integer (positive = in, negative = out), required.
   - `type`: Enum `['purchase', 'purchase_void', 'sale', 'sale_return', 'adjustment']`, required.
   - `reason`: String (required for adjustment: `'damaged' | 'expired' | 'lost' | 'counting_correction'`).
   - `refType`: String (e.g., `'purchase'`, `'adjustment'`), required.
   - `refId`: ObjectId, required.
   - `balanceAfter`: Integer (batch `qtyLeft` immediately after movement), required.
   - `createdBy`: ObjectId ref `users`, required.
   - `createdAt`: Date, default `Date.now`.
   - Compound index: `{ variantId: 1, createdAt: -1 }`.
   - Compound index: `{ refType: 1, refId: 1 }`.
   - Rule: NEVER update or delete movements. Blocked at Mongoose middleware level; no edit/delete route exists.
6. **`audit_logs`**:
   - `userId`: ObjectId ref `users`, required, indexed.
   - `action`: String, required.
   - `refType`: String, required.
   - `refId`: ObjectId, optional.
   - `details`: Object / Mixed, default `{}`.
   - `createdAt`: Date, default `Date.now`, indexed.
7. **`counters`**:
   - `_id`: String (e.g. `'PU_2627'`), required.
   - `seq`: Integer, default 0, required.
   - Helper `nextSequence(key, session)` uses atomic `findOneAndUpdate` with `$inc: { seq: 1 }` and `upsert: true`.
   - Helper `getFinancialYear(date)` computes financial year in `Asia/Kolkata` time zone (e.g. April 1, 2026 to March 31, 2027 yields `"2627"`).
8. **Product Schema Update**:
   - Add `trackExpiry`: Boolean, default `true`.
   - Set to `false` for products in category "Accessories".
   - Safe migration/seed handles existing products.

### 8.3 Business Rules & Logic
1. **No Direct Stock Edits**: Variant stock is never edited directly. It changes exclusively through `stock_movements`. `stock_batches.qtyLeft` is an atomically updated cached value inside the movement transaction.
2. **Atomic Purchase Transaction**:
   - Runs in a single MongoDB transaction:
     - Generate `purchaseNo` via `nextSequence`.
     - Calculate line items, GST, and totals on the server.
     - Create or increment `stock_batches` (if same `variantId + batchNo + expiryDate` exists, increment `qtyReceived` and `qtyLeft`).
     - Create positive `purchase` `stock_movements`.
     - Update variant's `purchasePrice` to the latest unit cost.
     - Record supplier payment if `paidPaise > 0`.
     - Save purchase document with unique `idempotencyKey`.
3. **Expiry Handling**:
   - Entered as MM/YYYY in the UI; stored as the last millisecond of that month in UTC.
   - Dates in the past are rejected with 400 Bad Request.
   - Dates within `EXPIRY_WARN_DAYS` (60 days) trigger UI warning but are allowed.
   - If `trackExpiry === false`, expiry field is omitted and stored as `null`.
4. **Purchase Void Rules**:
   - Owner only, reason required.
   - Permitted ONLY if for every batch created by that purchase, `qtyLeft === qtyReceived` (no sales or adjustments have occurred).
   - If any stock was consumed, void is blocked with error instructing the owner to perform a stock adjustment instead.
   - Void writes reversing `purchase_void` negative stock movements, sets purchase status to `voided`, and reverses supplier due/payment.
5. **Tax & Unit Cost Rules**:
   - `unitCostPaise` excludes GST.
   - `lineTaxablePaise = qty * unitCostPaise`.
   - `lineGstPaise = Math.round(lineTaxablePaise * (gstRate / 100))`.
   - `lineTotalPaise = lineTaxablePaise + lineGstPaise`.
   - Totals calculated on server.
6. **Atomic Manual Stock Adjustments**:
   - Owner only.
   - Reasons: `damaged`, `expired`, `lost`, `counting_correction`.
   - Direction: `decrease` (negative qty) or `increase` (positive qty).
   - Decrementing uses conditional update `{ _id: batchId, qtyLeft: { $gte: qty } }` ensuring batch never goes negative even under concurrency.
   - Writes `stock_movements` and `audit_logs`.
7. **Supplier Payment Allocation**:
   - If `purchaseId` is provided, applies directly to that purchase (capped at `duePaise`).
   - If no `purchaseId` is specified, FIFO allocates across oldest unpaid/partial purchases for that supplier.
   - Payment cannot exceed supplier's total pending due.
8. **Constants (`server/src/config/constants.js`)**:
   - `EXPIRY_WARN_DAYS = 60`
   - `EXPIRY_CRITICAL_DAYS = 30`
   - `DEFAULT_LOW_STOCK = 3`
9. **Stock Definitions**:
   - Low stock: variant's total `qtyLeft <= product.lowStockLimit`.
   - Expiring soon: has at least one batch with `qtyLeft > 0` expiring within `EXPIRY_WARN_DAYS`.
   - Expired: batch has `qtyLeft > 0` and `expiryDate < now`.
10. **FEFO Allocation Helper (`allocateBatches(variantId, qty, session)`)**:
    - Queries active batches for `variantId` where `qtyLeft > 0` and `(expiryDate == null || expiryDate >= now)`.
    - Sorted by `expiryDate ASC` (nulls last) then `createdAt ASC`.
    - Allocates quantity across batches, returning array of `{ batchId, batchNo, expiryDate, qty, unitCostPaise }`.
    - Throws error if total available stock is insufficient. Prepared and unit-tested for Phase 3 billing.

### 8.4 Permissions & Data Redaction
- **Owner**: Full access to all endpoints and fields.
- **Staff**:
  - Allowed: `GET /api/v1/stock` (stock quantities, status, nearest expiry, variants).
  - Forbidden (403): All routes under `/api/v1/purchases`, `/api/v1/suppliers`, `/api/v1/supplier-payments`, and `/api/v1/stock/adjustments`.
  - Redaction: Server completely strips `unitCostPaise`, `stockValuePaise`, `supplierId`, `purchasePrice`, and supplier details from any Staff response.

### 8.5 API Specifications
- `GET /api/v1/suppliers`: Search, `isActive` filter.
- `POST /api/v1/suppliers`: Create supplier (Owner).
- `PUT /api/v1/suppliers/:id`: Update supplier (Owner).
- `GET /api/v1/suppliers/:id/summary`: Total purchased, total paid, pending balance, purchase list (Owner).
- `GET /api/v1/purchases`: Filters by supplier, date range, payment status, status.
- `POST /api/v1/purchases`: Create purchase with atomic transaction (Owner).
- `GET /api/v1/purchases/:id`: Purchase details with line items and batches (Owner).
- `POST /api/v1/purchases/:id/void`: Void purchase with atomic reversal (Owner).
- `POST /api/v1/supplier-payments`: Record payment (Owner).
- `GET /api/v1/supplier-payments?supplierId=`: List payments.
- `GET /api/v1/stock`: Variant-level inventory, filters (`category`, `search`, `lowStock`, `expiringDays`, `expired`, `outOfStock`), pagination.
- `GET /api/v1/stock/variants/:variantId`: Batches and movement history.
- `POST /api/v1/stock/adjustments`: Manual stock adjustment (Owner).
- `GET /api/v1/stock/alerts`: Real counts and summary lists for dashboard alert cards.

### 8.6 Frontend Screens (Dark Theme & Shared Components)
1. **Stock / Purchase Page (`/stock`) with 3 Tabs**:
   - **Tab 1: Stock** (Default):
     - Top mini stat cards: Total Items, Low Stock, Expiring Soon.
     - Category chips + filter chips (`All`, `Low stock`, `Out of stock`, `Expiring 30d`, `Expiring 60d`, `Expired`).
     - Responsive table with mobile card fallback: product name, flavour/size, barcode, stock quantity with badge (In stock / Low / Out), nearest expiry with status color (red expired, amber <30d, yellow <60d), stock value (owner only).
     - Row click opens Side Drawer: batch breakdown (batch no, expiry, qty left, cost for owner), recent movement ledger, and "Adjust stock" button opening modal.
   - **Tab 2: Purchases** (Owner only):
     - Filterable list (purchase no, supplier, invoice no, date, total, status badges).
     - "New Purchase" button opening modal or dedicated entry form.
     - Purchase details view with Void button.
   - **Tab 3: Suppliers** (Owner only):
     - Supplier list with pending dues, total purchases, search.
     - Add/Edit supplier modal.
     - Supplier detail view with purchase history and "Pay Supplier" modal.
2. **New Purchase Form**:
   - Supplier select with quick-add modal.
   - Invoice number, invoice date.
   - Line entry scan-or-search box (scanning barcode or searching adds row and focuses qty).
   - Variant picker, qty, unit cost, GST%, batch no, expiry month picker (hidden if untracked), live line total.
   - Selling price vs unit cost warning (does not block).
   - Live totals preview (subtotal, GST, total), payment section (paid now, payment mode, balance due).
   - Confirmation step on submit.
3. **Dashboard Real Alert Integration**:
   - Low Stock and Expiring Soon cards wired to `/api/v1/stock/alerts`.
   - Alert cards navigate directly to `/stock` with active filter chip preselected (`lowStock` or `expiring60d`).
   - "Add Stock" quick action button navigates to Purchases tab / New Purchase form.
   - Top bar demo chip text updated to: `"Sales figures are demo data"`.

### 8.7 Testing & Verification Suite
- Atomic transaction failure rollback test.
- Purchase idempotency test (same key prevents duplicate).
- Batch merge test (same variant + batchNo + expiryDate increments qty).
- Void purchase verification: succeeds on untouched stock, blocked on consumed stock, reverses supplier debt.
- Stock adjustments concurrency and negative prevention test.
- Ledger integrity: sum of movements equals batch `qtyLeft` (plus `npm run stock:reconcile` script).
- FEFO allocation unit test (`allocateBatches`).
- Financial year util boundary test (March 31 vs April 1 in `Asia/Kolkata`).
- Supplier payment allocation and overpayment rejection test.
- Staff security test: 403 on purchases/suppliers, complete absence of cost/supplier/stock value fields.


---

## 9. Phase 3: Billing (POS) & Checkout Specification

### 9.1 Menu & Navigation
- The existing navigation item **Billing (POS)** becomes an active route (`/billing`) with 2 tabs:
  1. **New Bill** (Default counter view; sidebar remains fixed according to static viewport rules, no auto-collapse)
  2. **Bills** (Completed bills list; today's bills for staff, all bills + date range for owner)
- No other items are added to the 7-item menu.

### 9.2 Collections & Data Models
1. **`customers` (Minimal for Phase 3)**:
   - `name`: String, required.
   - `phone`: String, required, unique index.
   - `gstin`: String, optional.
   - `state`: String (derived from GSTIN's first 2 digits using GST state-code map, or defaults to shop state).
   - `dueBalancePaise`: Integer, default 0, required.
   - `isActive`: Boolean, default true.
   - `timestamps: true`.
2. **`bills` (Completed Bills Only)**:
   - `billNo`: String, unique (e.g. `PS/2627/000123`).
   - `fy`: String (e.g. `"2627"`).
   - `status`: String, default `"completed"`.
   - `customerId`: ObjectId ref `customers`, optional.
   - `customerSnapshot`: `{ name, phone, gstin, state }`.
   - `gstType`: Enum `['intra', 'inter']`.
   - `staffId`: ObjectId ref `users`, required.
   - `staffNameSnapshot`: String, required.
   - `items`: Array of subdocuments:
     - `lineId`: String, required.
     - `productId`: ObjectId ref `products`, required.
     - `variantId`: ObjectId, required.
     - `nameSnapshot`: String, required.
     - `brand`: String.
     - `flavour`: String.
     - `size`: String.
     - `hsn`: String.
     - `barcode`: String.
     - `qty`: Integer, required, min 1.
     - `mrpPaise`: Integer, required.
     - `unitPricePaise`: Integer (GST-inclusive), required.
     - `priceOverridden`: Boolean, default false.
     - `lineDiscountPaise`: Integer, default 0.
     - `billDiscountSharePaise`: Integer, default 0.
     - `netPaise`: Integer, required.
     - `taxablePaise`: Integer, required.
     - `cgstPaise`: Integer, default 0.
     - `sgstPaise`: Integer, default 0.
     - `igstPaise`: Integer, default 0.
     - `gstRate`: Number, required.
     - `allocations`: `[{ batchId, batchNo, expiryDate, qty, unitCostPaise }]`.
     - `costTotalPaise`: Integer, required.
     - `returnedQty`: Integer, default 0 (for Phase 4).
   - `subtotalPaise`: Integer, required.
   - `lineDiscountTotalPaise`: Integer, default 0.
   - `billDiscountPaise`: Integer, default 0.
   - `taxablePaise`: Integer, required.
   - `cgstPaise`: Integer, default 0.
   - `sgstPaise`: Integer, default 0.
   - `igstPaise`: Integer, default 0.
   - `roundOffPaise`: Integer, default 0.
   - `grandTotalPaise`: Integer, required.
   - `savingsPaise`: Integer, default 0.
   - `paidPaise`: Integer, default 0.
   - `duePaise`: Integer, default 0.
   - `paymentSummary`: `[{ mode, amountPaise }]`.
   - `profitPaise`: Integer, required (omitted for Staff).
   - `idempotencyKey`: String, unique index, required.
   - `createdAt`: Date, default `Date.now`.
   - **Immutability Guard**: Pre-save/pre-update hooks block any update or delete on completed bills except for whitelisted Phase 4 fields (`returnedQty`, `paidPaise`, `duePaise`, `paymentSummary`).
3. **`payments`**:
   - `billId`: ObjectId ref `bills`, required, indexed.
   - `customerId`: ObjectId ref `customers`, optional, indexed.
   - `mode`: Enum `['cash', 'upi', 'card']`, required.
   - `amountPaise`: Integer, required, > 0.
   - `refNo`: String, optional.
   - `cashTenderedPaise`: Integer, optional.
   - `type`: String, default `"sale"`.
   - `createdAt`: Date, default `Date.now`.
4. **`held_carts`**:
   - `holdCode`: String, unique (e.g. `H-0007` from `nextSequence("hold")`).
   - `staffId`: ObjectId ref `users`, required.
   - `customerId`: ObjectId ref `customers`, optional.
   - `cart`: Object (raw cart: lines, discounts, overrides), required.
   - `createdAt`: Date, default `Date.now`.
5. **`stock_movements` Update**:
   - Supports `type: "sale"`, negative quantity, `refType: "bill"`, `refId: bill._id`.
6. **`Settings` Updates**:
   - `upiId`: String, optional.
   - `receiptFooter`: String, default `"Sealed, unopened items can be returned within 7 days with this bill."`.
   - `receiptFormat`: Enum `['thermal', 'a4']`, default `'thermal'`.
   - `staffMaxDiscountPct`: Number, default 5.
   - `billPrefix`: String, 2 to 4 uppercase letters/digits (default `"PS"`), total bill number <= 16 chars.
   - `state`: Validated against Indian GST state list.

### 9.3 Calculation Engine (`server/src/services/billing/calculator.js`)
Pure function, no database calls, integer arithmetic:
1. `gross = qty * unitPricePaise`.
2. Line discount:
   - percent: `Math.round(gross * pct / 100)`
   - amount: paise directly. Capped at `gross`.
3. Bill discount:
   - percent applies to sum of `(gross - lineDiscount)`; capped at that sum.
   - Distributed across lines in proportion to `(gross - lineDiscount)` using the **Largest-Remainder Method** (Hamilton-Hare) so the shares sum *exactly* to `billDiscountPaise`.
4. `net = gross - lineDiscount - billDiscountShare`.
5. `taxable = Math.round(net * 100 / (100 + gstRate))`
6. `gst = net - taxable`.
7. Intra-state: `cgst = Math.floor(gst / 2)`, `sgst = gst - cgst`. Inter-state: `igst = gst`.
8. Totals: `sum of lines`. `roundOff` rounds grand total to nearest ₹1 (100 paise):
   - `rawGrandTotal = sum(net)`.
   - `rounded = Math.round(rawGrandTotal / 100) * 100`.
   - `roundOffPaise = rounded - rawGrandTotal`.
   - `grandTotalPaise = rounded`.
9. `savingsPaise = sum(qty * mrpPaise) - sum(netPaise)`.
10. `profitPaise = totalTaxablePaise - totalCostPaise`.
- Grouping: Aggregates GST rates for tax breakdown reporting on receipts.

### 9.4 Price, Discount & Owner PIN Approval Rules
- Selling price authoritative on server from `variant.sellingPrice`.
- Price override allowed via `priceOverridePaise` on client line.
- Staff requires Owner PIN for:
  1. `DISCOUNT_ABOVE_LIMIT`: Total discount (line + bill) exceeds `staffMaxDiscountPct` of pre-discount subtotal.
  2. `PRICE_OVERRIDE`: Any price override submitted.
  3. `BELOW_COST`: Any line where unit taxable value (`lineTaxablePaise / qty`) < allocated unit cost (`unitCostPaise`). (For Staff, error does not reveal cost).
- Owner requires no PIN, but below-cost triggers UI warning and (1)-(3) write to `audit_logs`.
- PIN lockout: 5 consecutive failed attempts lock user/session for 5 minutes.

### 9.5 The Checkout Transaction
Enclosed in `session.withTransaction`:
1. Check `idempotencyKey`: if existing bill found, return it immediately with `{ duplicate: true }`.
2. Reload fresh variants, products, customer, and settings.
3. For each line, call `allocateBatches(variantId, qty, session)`. Fail with `INSUFFICIENT_STOCK` if short.
4. Run pure calculation engine. If calculated grand total differs from `expectedGrandTotalPaise`, abort with 409 `PRICE_CHANGED` and return fresh quote.
5. Verify approval PIN if approvals required.
6. Validate payments: cash/upi/card only, sum(paid) <= grandTotal, due = grandTotal - paid. If due > 0, customer is strictly required. Cash tendered must be >= cash payment.
7. Decrement stock atomically: `updateOne({ _id: batchId, qtyLeft: { $gte: n } }, { $inc: { qtyLeft: -n } })`. Abort if modified count is 0. Insert `stock_movements` (`type: "sale"`).
8. Generate `billNo` atomically via `nextSequence` (`PS/2627/000123`).
9. Insert bill document, insert payments, increment `customer.dueBalancePaise` by due amount, write audit logs.
10. Commit transaction. On any abort, all changes and sequence consumption roll back.

### 9.6 POS Counter Screen (`/billing`)
- Two tabs: **New Bill** | **Bills**.
- Sidebar remains static (Phase 3 billing auto-collapse rule REMOVED).
- Focused scan-or-search bar (barcode scan types + Enter; debounced product search; category tiles).
- Web Audio API soft success/error beeps.
- Cart lines: variant, qty stepper, unit price (tap to override), line discount, warnings (low stock, near expiry), remove.
- Real-time debounced quote (`POST /billing/quote`) with sequence guard to ignore stale responses.
- Auto-save cart to `localStorage`.
- Hotkeys: F2 (New Bill), F3 (Customer focus), F4 (Hold cart), F6 (Held list drawer), F8 (Pay), Esc (Close modals), `?` (Shortcuts cheat-sheet).
- Payment Modal (F8): Cash / UPI / Card / Credit tabs, split payment rows, change due calculator, dynamic UPI QR code generator (`upi://pay`), approval PIN prompt if required.
- Success Screen: Bill number, total, change due, Print button (Enter to print), WhatsApp share link (`wa.me/91...`), New Bill button.
- Mobile (<768px): Single column, search sheet, sticky bottom summary with Pay button.

### 9.7 Receipts & Printing
- `<Receipt />` component with Thermal (80mm `@page`) and A4 invoice layouts based on `settings.receiptFormat`.
- Content: "TAX INVOICE", shop profile, GSTIN, bill number, date/time, staff, customer, itemized table with HSN/batches/expiry, GST breakdown grouped by rate, round-off, totals, payments, savings, footer notice.
- Reprint action logs to `audit_logs` and prints receipt with `"DUPLICATE COPY"` banner.
- Documentation in README for thermal printer setup and Chrome `--kiosk-printing`.

### 9.8 Dashboard Real-Time Integration
- Wire Today's Sales (`sum(grandTotal)`), Today's Profit (`sum(profitPaise)` owner only), Bills Today, and Recent Bills (last 5) to real DB aggregations for Asia/Kolkata "today" vs yesterday.
- Update demo banner chip text to: `"Chart and top sellers are demo data"`.


---

## 10. Mobile-First Rules & Standards (Part A)

### 10.1 Viewport Breakpoints & Responsive Architecture
- **Breakpoints**:
  - Phone: `360px - 767px`
  - Tablet: `768px - 1023px`
  - Laptop / Desktop: `1024px+`
- **Zero Horizontal Scrolling**: Every screen must have `document.documentElement.scrollWidth <= window.innerWidth` across all viewports (`360px`, `390px`, `430px`, `768px`, `1024px`, `1440px`).
- **Dynamic Viewport Height**: Use `100dvh` instead of `100vh` to accommodate browser address bar shrink/expansion.
- **Safe Area Insets**: Explicit padding with `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, etc. on bottom navigation bars, floating elements, and sheets. `viewport-fit=cover` in `index.html`.
- **Landscape Phone Support**: Responsive layouts reflow cleanly to keep the billing counter usable in landscape.

### 10.2 Navigation & Controls on Mobile
- **Phone Bottom Tab Bar**: 5 items:
  1. Home (Dashboard)
  2. Billing (Visually emphasized with primary neon-lime background/glow)
  3. Products
  4. Stock
  5. More (Opens a bottom sheet containing Customers, Reports, Settings, Users [owner only], and Logout).
  - The 7-item logical menu rule is preserved.
  - Automatically hidden when virtual keyboard is active (`visualViewport.height < window.innerHeight`).
- **Tablet / Desktop Navigation**:
  - Tablet (`768px - 1023px`): 76px icon rail.
  - Desktop (`1024px - 1279px`): 232px sidebar.
  - Large Desktop (`1280px+`): 262px sidebar.
  - DELIBERATE RULE CHANGE: Sidebar width depends ONLY on screen size, never on the route. Auto-collapse on Billing is REMOVED.
- **Modals & Drawers on Phone**:
  - Modals transform into Bottom Sheets (rounded top, drag handle, max height `90dvh`, internal scrolling, sticky bottom action bar).
  - Side drawers become full-screen sheets on viewports `< 768px`.
- **Touch Ergonomics**:
  - Minimum touch target size `44x44px`.
  - Spacing at least `8px` between tappable controls.
  - Visible pressed/active states (`active:scale-[0.98]` or opacity). No hover-only interactions.
- **Form Ergonomics**:
  - Input font size minimum `16px` on phone to prevent iOS auto-zoom.
  - Proper `inputmode` and `type`: phone (`type="tel" inputmode="numeric"`), amounts (`inputmode="decimal"`), PIN (`inputmode="numeric"` with masked input).
  - Persistent labels (not placeholder-only); inline validation errors.
  - Number inputs with live `₹` prefix and formatted `en-IN` as typed.

### 10.3 Camera Barcode Scanner (`<CameraScanner />`)
- Reusable full-screen sheet with viewfinder, torch/flashlight toggle if supported, manual entry fallback, vibration (`navigator.vibrate([40, 30, 40])`) and Web Audio chirp on scan.
- Native `BarcodeDetector` API used where supported; fallback to `@zxing/browser`.
- Formats supported: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, QR.
- Scan buttons provided next to:
  1. Billing scan/search input
  2. Purchase line item entry
  3. Product form barcode field
- LAN Dev Mode: `@vitejs/plugin-basic-ssl` configured for `npm run dev:lan` enabling testing on real mobile hardware over HTTPS.

### 10.4 Minimal PWA Installation
- Web App Manifest: name (defaults to "Chava Fitness Club"), short name, standalone display, theme/background colors mapped to tokens, generated 192x192, 512x512, and maskable PNG icons.
- `apple-touch-icon` and `theme-color` meta tags.
- NO service worker and NO client-side API caching to prevent stale billing or stock data.

### 10.5 Automated Responsive Testing Suite
- Dev dependency: `@playwright/test`.
- Test suite (`npm run test:responsive`) runs at `360px`, `390px`, `430px`, `768px`, `1024px`, and `1440px`.
- Asserts: zero horizontal overflow, primary actions visible, bottom bar present on mobile and hidden on desktop, and touch targets >= 44px. Saves screenshots under `docs/screenshots/phase4/`.

---

## 11. Phase 4: Customers, Due Collection, Returns & Day Close (Part B)

### 11.1 Menu & Tabs
- **Customers**: Active route (`/customers`) with 3 tabs:
  1. All
  2. With dues
  3. Refill reminders
- **Billing (POS)**: Now has 3 tabs:
  1. New Bill
  2. Bills (includes Returns bill lookup and Credit Notes toggle)
  3. Day Close

### 11.2 Collections & Data Schemas
1. **`customers` Model Updates**:
   - `openingDuePaise`: Integer, default 0 (prior udhaar before software).
   - `dueBalancePaise`: Integer, cached balance. Invariant: `dueBalancePaise = openingDuePaise remaining + sum(bill.duePaise) === sum(customer_ledger.amountPaise)`.
   - `lastReminderAt`: Date, optional.
2. **`customer_ledger` (Append-Only Ledger)**:
   - `customerId`: ObjectId ref `customers`, required, indexed.
   - `type`: Enum `['opening', 'bill_due', 'due_payment', 'return_adjust']`, required.
   - `amountPaise`: Integer (+ increases due, - decreases due), required.
   - `balanceAfterPaise`: Integer, required.
   - `refType`: String (`'opening' | 'bill' | 'payment' | 'return'`), required.
   - `refId`: ObjectId, optional.
   - `note`: String, optional.
   - `createdBy`: ObjectId ref `users`, required.
   - `createdAt`: Date, default `Date.now`, indexed.
   - Model-level block on updates and deletes.
3. **`payments` Updates**:
   - `type`: Enum `['sale', 'due', 'refund']`.
   - For `type: "due"`:
     - `allocations`: Array of `{ target: 'opening' | ObjectId (billId), amountPaise: Integer }`.
     - `receiptNo`: String (e.g. `RC/2627/000001` via `nextSequence("rc_" + fy)` in transaction).
4. **`returns` (Credit Notes)**:
   - `creditNoteNo`: String, unique (`CN/2627/000001` via `nextSequence("cn_" + fy)`).
   - `fy`: String (`"2627"`).
   - `billId`: ObjectId ref `bills`, required.
   - `billNoSnapshot`: String, required.
   - `customerSnapshot`: `{ name, phone, gstin, state }`.
   - `items`: Subdocuments:
     - `lineId`, `variantId`, `nameSnapshot`, `flavour`, `size`, `hsn`, `gstRate`, `qty`.
     - `stockOutcome`: Enum `['sealed', 'damaged']`.
     - `mrpPaise`, `unitPricePaise`, `netPaise`, `taxablePaise`, `cgstPaise`, `sgstPaise`, `igstPaise`.
     - `costReturnedPaise`: Integer (0 if damaged).
     - `restoredTo`: `[{ batchId, qty }]` (populated if sealed).
   - `totals`: `{ taxablePaise, cgstPaise, sgstPaise, igstPaise }`.
   - `roundOffPaise`: Integer.
   - `grandTotalPaise`: Integer.
   - `settlement`:
     - `adjustedAgainstDuePaise`: Integer, default 0.
     - `payouts`: `[{ mode: 'cash' | 'upi' | 'card', amountPaise, refNo }]`.
   - `reason`: Enum `['changed_mind', 'wrong_item', 'damaged_product', 'expired_product', 'other']`.
   - `note`: String.
   - `profitAdjustmentPaise`: Integer (negative).
   - `withinWindow`: Boolean.
   - `approvedBy`: ObjectId ref `users` (Owner PIN approver).
   - `staffId`: ObjectId ref `users`.
   - `idempotencyKey`: String, unique index.
   - `createdAt`: Date, default `Date.now`.
   - Model-level guard: immutable.
5. **`bills` Updates**:
   - `items[].returnedQty`: Integer, default 0.
   - `items[].allocations[].returnedQty`: Integer, default 0.
   - `returnStatus`: Enum `['none', 'partial', 'full']`, default `'none'`.
   - `returnedTotalPaise`: Integer, default 0.
   - Whitelist in Phase 3 Mongoose guard updated to allow: `returnedQty`, `allocations[].returnedQty`, `returnStatus`, `returnedTotalPaise`, `duePaise`, `paidPaise`, `paymentSummary`. All other fields immutable.
6. **`cash_entries` (Owner Only, Immutable)**:
   - `date`: String (`YYYY-MM-DD` in `Asia/Kolkata`), indexed.
   - `type`: Enum `['cash_in', 'expense', 'bank_deposit', 'owner_draw']`.
   - `amountPaise`: Integer, > 0.
   - `note`: String, required.
   - `createdBy`: ObjectId ref `users`.
   - `createdAt`: Date, default `Date.now`.
7. **`day_closes`**:
   - `date`: String (`YYYY-MM-DD` in `Asia/Kolkata`), indexed.
   - `version`: Integer, default 1.
   - `status`: Enum `['active', 'superseded']`, default `'active'`.
   - `openingCashPaise`: Integer, required.
   - `figures`: Snapshot object containing `cashSalesPaise`, `upiSalesPaise`, `cardSalesPaise`, `creditGivenPaise`, `cashDueCollectedPaise`, `upiDueCollectedPaise`, `cardDueCollectedPaise`, `refundsByMode`, `cashInPaise`, `expensesPaise`, `bankDepositsPaise`, `ownerDrawPaise`, `billsCount`, `returnsCount`, `grossSalesPaise`, `returnsPaise`, `netSalesPaise`.
   - `expectedCashPaise`: Integer.
   - `countedCashPaise`: Integer.
   - `differencePaise`: Integer (`counted - expected`).
   - `denominations`: Object (breakdown of 500, 200, 100, 50, 20, 10, coins).
   - `note`: String.
   - `closedBy`: ObjectId ref `users`.
   - `closedAt`: Date, default `Date.now`.
8. **`Settings` Updates**:
   - `returnWindowDays`: Number, default 7.
   - `refillReminderDays`: Number, default 30.
   - `reminderMessageTemplate`: String (default `"Hi {name}, hope you're crushing your workouts! Just checking in from {shop}—looks like your {product} might be running low. Reply here if you need a refill!"`).
9. **`Category` Updates**:
   - `refillable`: Boolean, default false. Set `true` for Whey Protein, Mass Gainer, Creatine, Pre-Workout, BCAA/EAA, Vitamins & Health.

### 11.3 Core Business Logic & Pure Calculation Functions

#### 11.3.1 Due Payment Allocation (`server/src/services/billing/dueAllocation.js`)
- Pure function `allocateDuePayment({ openingDueRemainingPaise, billsWithDues, paymentAmountPaise })`:
  - Enforces payment amount <= total pending due.
  - Allocates FIFO: opening due first, then oldest bills by `createdAt`.
  - Returns `{ allocations: [{ target: 'opening' | billId, amountPaise }], remainingDuePaise }`.
- Transaction:
  - Updates `customer.dueBalancePaise` with conditional `$gte: 0`.
  - Updates bills (`duePaise` down, `paidPaise` up, `paymentSummary` appended).
  - Creates `payment` record (`type: "due"`, sequential `receiptNo`).
  - Writes `customer_ledger` entries.

#### 11.3.2 Return Calculations (`server/src/services/billing/returnCalculator.js`)
- Pure function `calculateReturn({ bill, returnLines })`:
  - Validates `qty <= (line.qty - line.returnedQty)`.
  - Cumulative proportional rounding:
    `refundNet(c) = Math.round(line.netPaise * c / line.qty)`.
    `thisReturnNet = refundNet(prevReturned + qty) - refundNet(prevReturned)`.
  - Identical cumulative proportional math for `taxablePaise` and tax components (`cgst`, `sgst`, `igst`).
  - Credit note grand total rounded to nearest ₹1 (100 paise) with separate `roundOffPaise`.
  - If bill is fully returned, absorbs any discrepancy so sum of credit notes equals original bill grand total.
  - Profit adjustment: `- (taxableReturned - costOfSealedReturned)`. Damaged units keep cost as loss.
- Settlement:
  - If bill has remaining `duePaise`, credit note first adjusts against due (`adjustedAgainstDuePaise`), reducing bill due and customer balance via ledger `return_adjust`.
  - Balance refunded as cash/upi/card (`payments` type `"refund"`).
- Sealed units restored to their exact source batches via `stock_movements` (`type: "sale_return"`). Damaged units are not restocked.
- Concurrency protection: `Bill.updateOne({ _id: bill._id, items: { $elemMatch: { lineId, returnedQty: prevQty } } }, ...)` aborts on race.
- Owner PIN required for all staff returns.

#### 11.3.3 Day Close Cash Formula
`expectedCash = openingCash + cashSales + cashDueCollected + cashIn - cashRefunds - expenses - bankDeposits - ownerDraws`.
- Day boundaries: `00:00:00` to `23:59:59.999` in `Asia/Kolkata`.
- Opening cash = counted cash of previous active day close (first close prompts owner).
- Staff view: **Blind Count** (staff enters counted cash only; expected cash and difference are stripped from staff responses).
- Re-closing creates a new active version and marks prior as `superseded`.

#### 11.3.4 Refill Reminders Logic
Eligible if:
- Customer bought product in a category where `refillable === true`.
- Quantity bought was not completely returned.
- Days since purchase >= `settings.refillReminderDays`.
- Has valid phone number.
- `lastReminderAt` is null or >= 7 days ago.
- Action: Generates WhatsApp `wa.me` URL with populated template; marks `lastReminderAt = Date.now()`.

### 11.4 Dashboard Integration (Phase 4 Updates)
- Today's Sales = `grossSales - creditNotesToday`.
- Today's Profit = `grossProfit + profitAdjustmentsToday` (Owner only; omitted for Staff).
- Bills Today = count of completed bills.
- Customer Dues Alert = live sum of all customers' `dueBalancePaise`.
- Unclosed Day Warning Chip shown to Owner if previous day was not closed.

### 11.5 Scripts & Tests
- `npm run migrate:phase4`: Idempotent backfill of `customer_ledger` from existing dues, sets `category.refillable`, default settings.
- `npm run seed:phase4`: Realistic seed with opening dues, due payments, 5 diverse returns (sealed, partial, damaged, due adjustment, out-of-window), closed day with discrepancy, and refill reminders.
- `npm run customers:reconcile`: Asserts `customer.dueBalancePaise === opening + sum(bill dues) === sum(ledger)`.
- Playwright suite: 6 viewports (`360`, `390`, `430`, `768`, `1024`, `1440px`) asserting zero horizontal scroll, touch targets >= 44px, and screenshot capture.


---

## 12. Phase 5: Real Dashboard + Reports

### 12.1 Scope & Constraints
- **Read-only phase**: No new write operations, no new business features, no business logic changes.
- **Owner-only reports**: Every `/api/v1/reports/*` route and export endpoint returns 403 for staff.
- **Single metric source of truth**: All metric calculations import from `server/src/services/reporting/definitions.js` (and documented in `docs/METRICS.md`). No metric re-implemented elsewhere.

### 12.2 Metric Definitions (All dates in Asia/Kolkata; money in integer paise)
Full canonical definitions live in `docs/METRICS.md` and `server/src/services/reporting/definitions.js`.
- **Gross Sales**: `Σ bills.grandTotalPaise` for bills created in the period (GST-inclusive).
- **Returns**: `Σ returns.grandTotalPaise` for credit notes issued in the period (by issue date, not original bill date).
- **Net Sales**: `Gross Sales − Returns`. The headline "Sales" number everywhere.
- **Taxable Sales**: `Σ bill.taxablePaise − Σ return.taxable`.
- **GST Collected**: `Σ bill GST − Σ credit note GST`.
- **Gross Profit**: `Σ bills.profitPaise + Σ returns.profitAdjustmentPaise` (adjustments are negative). Margin % = `profit / net taxable sales`.
- **Stock Write-offs**: Cost value of `stock_movements` with `type: "adjustment"` and negative `qty`, reasons `damaged | expired | lost`, in the period. Shown as a separate "Profit after stock losses" line in the Profit report (not deducted from dashboard gross profit).
- **Payment Mode Totals**: From `payments` collection (not `bill.paymentSummary`): sale payments by mode and `createdAt`; due collections (`type: "due"`) and refunds (`type: "refund"`) separately. Credit given = `bills.grandTotalPaise − Σ(bill's sale payments)`.
- **Stock Value**: `Σ (qtyLeft × unitCostPaise)` per batch (GST-exclusive cost). Potential Retail Value: `Σ (qtyLeft × variant.sellingPrice)`. Expired stock shown separately.
- **Average Daily Sale**: Units sold (net of returns) in the last 30 days ÷ 30 per variant.
- **Days of Stock Left**: `qtyLeft / averageDailySale` (capped at display max 999+).
- **Date Presets**: Today, Yesterday, Last 7 days, This month, Last month, This financial year (Apr–Mar), Last financial year, Custom (max 366 days). Weeks start on Monday. All timezone-aware using `Asia/Kolkata`.

### 12.3 Dashboard (Full Real Data — Demo Service Deleted)
- Delete `server/src/services/dashboardDemo.service.js`, `isDemo` flag, and demo chip.
- `GET /api/v1/dashboard/summary?range=week|month|year`:
  - **Owner**: Today's Net Sales, Today's Gross Profit, Bills Today (each with % change vs yesterday; "New" when yesterday = 0; never NaN or Infinity); Sales Overview chart (net sales series); Top 5 Selling (units + revenue); Recent Bills (last 5 all); Alerts (Low Stock, Expiring Soon, `customerDuesPaise`); Unclosed Day flag.
  - **Staff**: Only their own net sales and bill count for today, Low Stock & Expiring alerts (counts only, no cost), their own recent bills, New Bill button. No profit, no chart, no Top Selling revenue, no dues total. API omits the fields entirely.
- Auto-refresh: every 60 seconds while tab is visible (`visibilitychange`), pull-to-refresh on phones, "Updated X min ago" label. Skeletons and error/retry states.

### 12.4 Reports Hub (`/reports`, Owner Only)
- 6 report cards in a column on phones, 2-3 column grid on laptop. Each card shows icon, title, description, and a preview of the key figure for the current month.
- Each report at `/reports/<name>` with:
  - URL-persisted filter parameters (shareable, back-button safe).
  - Preset date chips + Custom (bottom sheet date pickers on phones).
  - Summary stat cards, lazy-loaded Recharts chart, detail table (cards on phones with "tap to expand"), pinned totals.
  - Sticky phone action bar: Export CSV, Print, Share.
  - Server-side pagination / "load more". Sorting on key columns. Skeletons and retry.

### 12.5 The 6 Reports
1. **Sales** (`/reports/sales`): Group by Day | Month | Staff. Bills, gross sales, discounts, returns, net sales, taxable, GST, cash, UPI, card, credit. Chart: net sales per period. Tap day → Bills filtered. WhatsApp "Share summary".
2. **Profit** (`/reports/profit`): Group by Day | Product | Category | Brand. Net taxable, COGS, gross profit, margin %. Top section: gross profit → write-offs → "Profit After Stock Losses". Sold-below-cost list. Highest / lowest margin products.
3. **Stock** (`/reports/stock`): Current snapshot. Columns: product, variant, qty, stock value, retail value, potential profit, avg daily sale, days of stock left, last sold date, last supplier. Filters: category, search, Low stock, Out of stock, Not selling (30 / 60 / 90 days). Reorder List mode (grouped by last supplier, shareable as text).
4. **Expiry** (`/reports/expiry`): Batch-level, buckets: Expired / ≤30 days / 31–60 / 61–90 (using `EXPIRY_CRITICAL_DAYS` and `EXPIRY_WARN_DAYS`). Value at risk per bucket. "Adjust stock" row action reuses Phase 2 sheet. "Stock losses in period" section (date-filtered).
5. **GST** (`/reports/gst`): Month picker + quarters + custom. Outward supplies by rate (B2B / B2C net of credit notes). B2B invoice register. Credit note register. HSN summary. Input GST from active purchases. "Estimated net GST payable" (labeled "Estimate only"). CSV exports: one per section, CA-ready, NOT a GST-portal JSON.
6. **Customer Dues** (`/reports/dues`): Snapshot + period. Aging buckets by bill date (0–30, 31–60, 61–90, 90+, plus "Before software"). Collection in period. Customer list sorted by due / oldest due, bill-wise expansion, WhatsApp Remind button.

### 12.6 Exports, Print & Share
- **CSV**: UTF-8 with BOM; rupee amounts as 2-decimal plain numbers; dates as DD/MM/YYYY; first lines: shop name, report name, period, generated timestamp; filename: `chava_sales_2026-11-01_to_2026-11-30.csv`. CSV-injection protection (prefix `= + - @` with `'`). Streamed server-side.
- **Print**: A4 print stylesheet (landscape for wide tables); shop name header, title, period, page numbers, repeating column headers; no nav chrome.
- **Mobile Share**: Web Share API with CSV file; fallback to download. Audit log written per export.

### 12.7 Performance, Indexes & Load Test
- Required indexes: `bills(createdAt)`, `bills(staffId, createdAt)`, `bills(customerId, createdAt)`, `returns(createdAt)`, `payments(type, createdAt)`, `stock_batches(variantId, qtyLeft)`, `stock_movements(type, createdAt)`.
- Aggregations use `allowDiskUse: true` and `maxTimeMS: 10000`.
- `npm run seed:load`: builds ~20,000 bills / 80,000 line items in a separate `*_perf` database (refuses any other DB or production).
- `npm run test:perf`: every report and dashboard query must respond in < 1500ms and use an index (no COLLSCAN). Asserts and reports.


---

## 13. Phase 6: Production Readiness (Final Phase)

> Scope: operational hardening only. No new business features, no new menu items, no multi-shop, no paid monitoring. New owner-facing screens live exclusively inside **Settings** tabs.

### 13.1 Deployment Architecture (Fixed)
- **Database**: MongoDB Atlas Flex cluster, Mumbai region (`ap-south-1`), accessed via `MONGODB_URI` over TLS (`mongodb+srv://`). Atlas network access restricted to the VPS static IP. Two DB users: `app_user` (readWrite on the shop database only) and `backup_user` (read-only). Admin user is never used in the application.
- **App Server**: One Ubuntu LTS VPS (≥ 2 GB RAM), Docker Compose with two containers: `app` (Node server, non-root, multi-stage build) and `caddy` (reverse proxy, automatic HTTPS, serves built React client, gzip/zstd). No database container in production.
- **Dev**: Unchanged `docker-compose.yml` with the local single-node MongoDB replica set.
- **Production**: `docker-compose.prod.yml` + `Caddyfile` + `.env.production.example`.
- **New dependencies (server)**: `pino`, `pino-http`, `node-cron`, `@aws-sdk/client-s3`, `csv-parse`.
- **New dev dependencies**: `@axe-core/playwright`.

### 13.2 Encrypted Off-Site Backups
- **Backup service** (`server/src/services/backup/`):
  - Runs `mongodump --archive --gzip` using `backup_user` credentials (`BACKUP_MONGODB_URI`).
  - Encrypts with AES-256-GCM (Node.js built-in `crypto`, streaming/chunked, authenticated encryption).
  - Computes SHA-256 checksum of the encrypted archive.
  - Uploads to S3-compatible storage (Cloudflare R2, Backblaze B2, or AWS S3).
  - File naming: `<shop-slug>/<YYYY>/<MM>/backup_<YYYY-MM-DD_HHmm>_IST.archive.gz.enc`.
  - Manifest JSON alongside each backup: `{ size, checksum, collections: { name, count }[], appVersion, createdAt, verified: false }`.
- **Storage adapters**: `s3` (production) and `local-folder` (dev/test). Same interface.
- **Schedule**: `node-cron` at 02:30 IST daily. MongoDB-based distributed lock prevents double runs across app instances.
- **Manual trigger**: `POST /api/v1/system/backup` (owner only, rate-limited 1 per 5 minutes).
- **Pre-deploy backup**: called automatically by `deploy.sh`; deployment aborts if the backup fails.
- **Post-upload verification**: Re-download manifest, compare size and checksum; mark `verified: true`. Retry 3× with exponential backoff; record as failed after all retries.
- **Retention policy**: keep 14 daily, 8 weekly (Sunday), 12 monthly (1st of month). Delete only objects with this app's prefix; never delete the newest successful backup. Log all pruned keys.
- **Restore script** (`npm run backup:restore -- --file <key|path> --to <dbName>`): download, verify checksum, decrypt, `mongorestore` into target. Refuses to restore into the live database unless `--confirm-overwrite <exact live db name>` is passed and always writes a safety backup first.
- **Restore drill** (`npm run backup:drill`): takes latest backup (creates one if none), restores into `<db>_drill_<timestamp>`, asserts collection counts match the manifest, runs `stock:reconcile` and `customers:reconcile` on the restored copy, checks the last bill number. Prints PASS/FAIL, drops temp database, records result in `system_checks`.
- **Dockerfile** installs MongoDB Database Tools (`mongodump`/`mongorestore`).

### 13.3 Settings > "Data & Safety" Tab (Owner Only)
1. **Backup status**: last successful backup (time-ago, size, verified badge), next scheduled time, last 10 runs with status, "Backup now" button (shows progress), last drill result, "Atlas snapshots enabled" info text.
2. **Health checks**: nightly at 03:15 IST — runs stock reconcile, customer ledger reconcile, bill-number-gap check; stores results in `system_checks`. Screen shows green/red per check with last run time and "Run now" button. On mismatch, shows affected record IDs.
3. **Audit log viewer**: paginated, filters (user, action, date range, text search), sensitive details redacted, CSV export via existing rules.
4. **Import data** (see §13.7).
5. **App info**: version, build time, environment name, database name (masked).
6. **Owner dashboard banners** (not shown to staff): red "No successful backup in 26 hours", red "Health check found a mismatch", amber "Backup restore drill not run in 35 days". Each links to this Settings tab.

### 13.4 Security Hardening

**Authentication & Sessions**:
- Cookie flags: `httpOnly`, `Secure` (production), `SameSite=Strict`, path-scoped. `trust proxy` configured correctly for Caddy.
- CSRF defence: `SameSite=Strict` plus a required custom header (`X-Requested-With: XMLHttpRequest`) on every state-changing request; reject all others with 403.
- `tokenVersion` on `users`: incrementing on password change, reset, deactivation, or "log out everywhere" immediately invalidates all existing JWTs.
- Password policy: minimum 8 characters; rejects the 1,000 most common passwords and passwords matching the user's phone number or name. `mustChangePassword` flag on staff accounts set by owner at creation or password reset.
- Login protection: rate-limit by IP AND phone number; progressive lockout in MongoDB (not in-memory) — 5 failures → 5 min, 10 → 30 min. Generic error messages (never reveal whether phone exists). Constant-time `bcrypt.compare`.
- Owner PIN: lockout counter/state stored in MongoDB (persistent across restarts). 5-attempt / 5-minute rule. Audit log on every failure and success.

**Input & Output**:
- NoSQL injection guard: reject any request key starting with `$` or containing `.` in body, query or params. Returns 400.
- All Zod schemas use `.strict()`. Staff can never set `role`, `isActive`, `tokenVersion`, prices, or `createdBy`.
- Request size limits: JSON 200 KB, CSV upload 2 MB.
- Global API rate limit: 300 requests/min per authenticated user; tighter limits on export and import endpoints.
- Pagination cap: max 100 per page.
- `maxTimeMS: 10000` on all aggregations and long queries.
- Error handler: no stack traces or internal messages in production. Every error response carries a `requestId` that is also in the log.
- No `dangerouslySetInnerHTML` anywhere. User-supplied text escaped in receipts, print views, and WhatsApp text.

**Headers & Network**:
- `helmet` with strict CSP: `default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; no 'unsafe-eval'; frame-ancestors 'none'`. `Permissions-Policy: camera=(self), geolocation=(), microphone=()`.
- HSTS 1 year; `Referrer-Policy: strict-origin-when-cross-origin`; `X-Content-Type-Options: nosniff`.
- CORS locked to app origin (redundant in production via same-origin Caddy serving, but set defensively).

**Secrets & Config**:
- `npm run check:prod-env`: refuses startup if any secret is missing, shorter than 32 random characters, equal to example values, `MONGODB_URI` is not `mongodb+srv://`, `NODE_ENV` is not production, or `BACKUP_ENCRYPTION_KEY` is missing.
- `npm run check:secrets`: scans the repo for committed secrets (regex patterns for keys, URIs with passwords, common patterns). Run in CI.
- `.gitignore` covers every `.env` file and backup outputs.
- Pino logging: JSON logs, `requestId` on every log line, redact `password`, `pin`, `token`, `cookie`, `authorization`, mask phone numbers (last 3 digits only). Docker log rotation: `json-file`, `max-size: 10m`, `max-file: 5`.
- Graceful shutdown on `SIGTERM`: finish in-flight requests, close MongoDB connection cleanly.

### 13.5 Production Deployment Files
- **`Dockerfile`** (multi-stage, non-root user, minimal base, `healthcheck` on `/healthz`, `NODE_ENV=production`, installs MongoDB Database Tools).
- **`docker-compose.prod.yml`**: `app` + `caddy`, `restart: unless-stopped`, resource limits, log rotation, named volumes for Caddy data only.
- **`Caddyfile`**: auto-HTTPS for `DOMAIN`, serves `/dist` with long-cache for hashed assets and `no-cache` for `index.html`, reverse-proxies `/api`, `/healthz`, `/readyz`, compression, security headers, `www →` apex redirect.
- **`/healthz`**: process alive, no sensitive data.
- **`/readyz`**: database reachable, returns `{ ok: true|false, version: "..." }` only.
- **`/version.json`**: git SHA + build time. Client polls every 5 minutes; shows "New version available, tap to refresh" banner. Never auto-reloads.
- **`deploy.sh`** (idempotent): prerequisites check → pre-deploy backup → pull code → build images tagged with git SHA → run all `migrate:*` scripts → restart containers → wait for `/readyz` → auto-rollback to previous SHA if health check fails.
- **`rollback.sh`**: manual rollback to a specified previous image tag.
- **Container timezone**: UTC. All business logic uses explicit `Asia/Kolkata`. Tests must pass under both `TZ=UTC` and `TZ=Asia/Kolkata`.

### 13.6 Go-Live Data Tools
1. **`npm run setup:production`** (interactive): creates the owner account, shop profile, default categories with `refillable` flags, default settings. Creates zero demo data. Refuses to run if any user already exists (unless `--force`).
2. **`npm run reset:demo`**: wipes all transactional data (bills, payments, returns, purchases, suppliers, stock batches/movements, customers, ledger, cash entries, day closes, counters, audit logs, etc.) while keeping owner accounts, shop profile, and categories. Optional `--keep-products`. Requires `ALLOW_RESET=true` env, typing the exact database name, and typing the phrase `DELETE ALL DATA`. Runs a backup first. Bill/CN/receipt number series reset to 1. `ALLOW_RESET` must be removed after go-live.

### 13.7 Data Import Tool (Settings > Data & Safety > Import)
Three importers, each with a downloadable CSV template, UTF-8 (with or without BOM), trimmed values, case-insensitive header aliases, max 5,000 rows / 2 MB:
- **Products**: `category, brand, product_name, hsn, gst_rate, low_stock_limit, track_expiry, flavour, size, barcode, sku, mrp, selling_price, purchase_price`. Rows with same brand + product + category merge into one product with multiple variants. Existing variants skipped. Validates category existence, `sellingPrice ≤ mrp`, valid GST rate, unique barcode/SKU.
- **Opening Stock**: `barcode or sku, qty, batch_no, expiry (MM/YYYY), unit_cost`. Creates `stock_batches` and `stock_movements` of type `opening` (refType `opening_stock_import`), tied to an `import_runs` record. Never appears in purchases, supplier dues, or input GST. Same file (by SHA-256) cannot be imported twice. Warning shown if bills already exist.
- **Customers**: `name, phone, gstin, opening_due`. Creates new customers by phone only; existing are skipped and their dues never changed. Positive `opening_due` creates the `opening` ledger entry.
- **Flow**: Upload → Dry-run preview (create / skip / error per row, first 20 shown, full error CSV downloadable) → Confirm → Single all-or-nothing transaction → Result summary → Audit log.

### 13.8 Frontend Polish
- Global `<ErrorBoundary>` with friendly screen and "Reload". 404 page. Offline banner ("No internet. Billing is paused until you reconnect") that disables Complete Bill, Collect Payment, and Return while offline. Cart safe in localStorage.
- Session-expired flow: redirect to login and return to same screen with cart intact.
- Remove all dead code, unused dependencies, TODO comments, demo remnants. No `console.log` of data in production builds.
- Accessibility: automated axe checks on every main screen at 390px and 1440px, zero serious/critical violations. Visible focus states, correct ARIA labels and roles.
- Initial JS bundle under 300 KB gzipped (route-level code splitting, Recharts and camera scanner lazy-loaded). Build script fails CI if budget is exceeded.
- `/version.json` polling (5 min), "New version available" banner (never auto-reloads).

### 13.9 Documentation Created in Phase 6
- `docs/BACKUP_RESTORE.md`: how backups work, step-by-step restore guide, where to store `BACKUP_ENCRYPTION_KEY` safely, monthly drill recommendation.
- `docs/SECURITY.md`: threat model, protections, secret rotation guide, incident procedures.
- `docs/DEPLOY.md`: beginner-friendly first-deployment walkthrough (domain, VPS, SSH keys, firewall, Docker, Atlas, object storage, `.env`, first backup and drill, HTTPS test, UptimeRobot, common problems).
- `docs/RUNBOOK.md`: site-down playbook, database-unreachable, backup failure, disk full, restore, rollback.
- `docs/USER_GUIDE_STAFF.md`: one-page guide (make a bill, hold, receive due, return, close the day).
- `docs/USER_GUIDE_OWNER.md`: daily routine, reports, stock, backups, dashboard banners.
- `docs/GO_LIVE_CHECKLIST.md`: tick-box checklist for CA sign-off, printer/scanner test, UPI QR test, PIN set, staff accounts, import and spot-check, first backup and drill, HTTPS + camera test, `ALLOW_RESET` removed, passwords stored, first-week parallel-run plan, monthly routine.


---

## 14. Product Photos & Hero Image Design (Enhancement)

### 14.1 Overview & Fixed Design Decisions
- **One photo per PRODUCT** (not per flavour variant). Missing photo falls back gracefully to the existing category-icon tile with brand initials.
- **MongoDB Binary Storage**: Images are stored directly in MongoDB inside `product_images` (`thumb` and `medium` binary fields) so that nightly backups, restore drills, and Atlas snapshots include them automatically without external object storage dependencies.
- **Mandatory Server-Side Re-encoding**: The server ALWAYS re-encodes every upload using `sharp`. The original uploaded file is never stored, never saved to disk, and never served.
- **Zero SSRF Surface**: No fetching images from external URLs. Only authenticated multipart uploads.
- **Strict Scope Boundaries**: Photos are NEVER included on printed receipts, credit notes, reports, or CSV exports. No variant-level photos.

### 14.2 Data Models & Schemas

#### 14.2.1 Collection: `product_images`
```javascript
{
  kind: { type: String, enum: ['product', 'hero'], required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true, sparse: true },
  thumb: { type: Buffer, required: true },       // 160x160 WebP (max 20 KB)
  medium: { type: Buffer, required: true },      // 600x600 WebP (max 120 KB)
  thumbBytes: { type: Number, required: true },
  mediumBytes: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  hash: { type: String, required: true },         // SHA-256 of medium image buffer
  hasAlpha: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}
// Unique compound index: kind 'product' + productId (one image per product)
productImagesSchema.index({ kind: 1, productId: 1 }, { unique: true, partialFilterExpression: { kind: 'product' } });
```

#### 14.2.2 Product & Settings Modifications
- `products`: gains `imageVersion: { type: String, default: null }` (first 10 chars of SHA-256 hash). Updated in the same MongoDB transaction as image upload/deletion.
- `settings`: gains `heroImageVersion: { type: String, default: null }` (first 10 chars of SHA-256 hash).

#### 14.2.3 Collection: `image_staging` (Bulk Upload Temporary Store)
```javascript
{
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalFilename: { type: String, required: true },
  thumb: { type: Buffer, required: true },
  medium: { type: Buffer, required: true },
  thumbBytes: { type: Number, required: true },
  mediumBytes: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  hash: { type: String, required: true },
  hasAlpha: { type: Boolean, default: false },
  matchedProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  matchStatus: { type: String, enum: ['matched', 'ambiguous', 'none'], default: 'none' },
  matchedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  createdAt: { type: Date, default: Date.now, expires: 3600 } // TTL index: auto-deletes abandoned previews after 1 hour
}
```

### 14.3 Image Processing Pipeline (`server/src/services/image/imageProcessor.js`)
- **Signature & Magic Bytes Verification**: Validate real file signature (magic bytes) for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and WebP (`52 49 46 46 ... 57 45 42 50`). Never trust client file extension or Content-Type header.
- **Decompression Bomb Protection**: Enforce `limitInputPixels: 24000000` (24 MP max). Files over 8 MB or > 24 MP rejected immediately.
- **Animated Image Rejection**: Inspect metadata; reject animated GIF / animated WebP (`pages > 1`).
- **EXIF Stripping & Auto-Orientation**: Auto-rotate orientation based on EXIF, then strip all metadata (GPS, camera tags, author info).
- **Contain Fitting**: Fit inside square (600x600 for medium, 160x160 for thumb) with `contain` fit (nothing cropped).
  - If source image has alpha/transparency: transparent background (`rgba(0,0,0,0)`).
  - If opaque: matte background using dark surface color `#0B110C` (or `#050805`).
- **Adaptive WebP Compression**: Output WebP format. Dynamically adjust quality (starting at 82, stepping down if needed) to ensure `medium <= 120 KB` and `thumb <= 20 KB`.
- **Hero Image Processing**: Accepts PNG or WebP up to 4 MB. Processed to 900px wide WebP preserving transparency (no square crop). Stored under `kind: "hero"`.
- **Friendly Unsupported Format Message**: For HEIC/HEIF or unsupported formats, return friendly error: *"Please use JPG, PNG or WebP. On iPhone choose Most Compatible in Camera settings or share the photo as JPG"*.

### 14.4 API Endpoints (`/api/v1`)

| Method | Endpoint | Auth / Role | Description |
|---|---|---|---|
| `PUT` | `/api/v1/products/:id/image` | Owner Only | Multipart (`image`, max 1 file, 8 MB max). Transacted with `imageVersion`. Audit-logged. |
| `DELETE` | `/api/v1/products/:id/image` | Owner Only | Deletes image & sets `imageVersion: null` in single transaction. |
| `PUT` | `/api/v1/settings/hero-image` | Owner Only | Multipart (`image`, max 1 file, 4 MB max). Transacted with `heroImageVersion`. |
| `DELETE` | `/api/v1/settings/hero-image` | Owner Only | Deletes hero image & resets `heroImageVersion: null`. |
| `POST` | `/api/v1/products/images/bulk-preview` | Owner Only | Multipart (`images`, up to 20 files, 8 MB each). Stages in `image_staging`. |
| `POST` | `/api/v1/products/images/bulk-confirm` | Owner Only | Body `{ assignments: [{ stagedId, productId, replaceExisting }] }`. Single transaction. |
| `GET` | `/api/v1/system/image-storage` | Owner Only | Returns count, total bytes/MB, and percentage of overall MongoDB database size. |
| `GET` | `/api/v1/images/products/:productId/:size` | Authenticated (Cookie) | Serves `thumb` or `medium` WebP with `v=<imageVersion>`. Private cache headers + ETag 304. |
| `GET` | `/api/v1/images/hero` | Authenticated (Cookie) | Serves hero WebP with `v=<heroImageVersion>`. Private cache headers + ETag 304. |

#### HTTP Response Headers for Image Serving:
- `Content-Type: image/webp`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: private, max-age=31536000, immutable`
- `ETag: W/"<sha256-hash>"` (returns `304 Not Modified` on matching `If-None-Match`)

### 14.5 Bulk Image Matching Rules
For each uploaded file in bulk preview, extract filename without extension, trim, and evaluate:
1. **Barcode Match**: Match against `Product.variants.barcode` (exact).
2. **SKU Match**: Match against `Product.variants.sku` (case-insensitive exact).
3. **Normalized Brand + Name**: Match normalized `"brand + product name"` (lowercase, alphanumeric only, spaces collapsed).
- Exactly 1 match $\rightarrow$ status `matched`.
- $> 1$ match $\rightarrow$ status `ambiguous` (requires manual selection).
- 0 match $\rightarrow$ status `none` (requires manual pick or skip).
- Replacing an existing photo requires `replaceExisting: true` tick. Confirm operation validates staging ownership and executes all updates atomically.

### 14.6 UI Components & Mobile Experience
- **`<ProductImage productId imageVersion size alt />`**: Explicit width/height (160x160 or 600x600), `loading="lazy"`, `decoding="async"`, fallback to category icon tile with brand monogram.
- **Product Form Photo Upload**:
  - Phone: "Take photo" (`capture="environment"`) & "Choose from gallery".
  - Desktop: Drag-and-drop zone with preview & progress bar.
  - Client-side Canvas resizing: Shrink large photos to max 1600px dimension before upload to save cellular data.
- **Products Page**: Thumbnails on list/table cards, "Missing photo" filter chip, coverage indicator (`X of Y products have photos`), and "Bulk photos" modal trigger.
- **Bulk Upload Sheet**: Full-screen mobile bottom-sheet / modal displaying staged thumbnails, matched product tags, conflict badges, replacement toggles, and commit button.
- **Counter & Tile Virtualization**: Billing search & category tile grid uses lazy rendering to avoid offscreen image requests.
- **Settings Hero Upload**: Shop profile card allowing upload of custom transparent tub hero image for `<HeroBackdrop />`.


---

## 15. Language Support Design (i18n: en, hi, mr) (Enhancement)

### 15.1 Fixed Decisions & Scope Boundaries
- **Supported Languages**: `en` (English, default and single source of truth), `hi` (हिन्दी), `mr` (मराठी). Language names are always rendered in their native script.
- **Language Scope**: Interface UI only. Receipts, credit notes, due receipts, CSV exports, report CSV headers, server logs, and developer documentation stay in English. User-entered data (e.g. names, notes) is preserved as entered without runtime machine translation.
- **Strict Number & Money Invariant**: All numbers, currency amounts (₹), quantities, percentages, and dates ALWAYS use Latin digits (`0-9`) with standard Indian numbering grouping (e.g. `₹1,24,850`). Formatted via `Intl` with `en-IN` number format forced to `-u-nu-latn`. Month and day names may follow the locale (`hi-IN`, `mr-IN`) with Latin digits.
- **Universal Technical Terms**: The following terms are never translated and remain in English across all languages: `GST`, `GSTIN`, `HSN`, `UPI`, `CGST`, `SGST`, `IGST`, `SKU`, `QR`, `PIN`, `MRP`, `WhatsApp`, `CSV`, `PDF`.
- **Per-User Language Setting**: Stored on `users.language` with shop-level fallback `settings.defaultLanguage`. Stored in `localStorage` for unauthenticated sessions on the login page; switching is instantaneous without page reload and persists across sessions via `PATCH /api/v1/auth/me/language`.
- **Beta Flag**: Configured in `client/src/i18n/languages.js` with `beta: true` for `hi` and `mr`, displaying `(beta)` until official review completion.

### 15.2 Client Architecture & Namespaces
- **Libraries**: `i18next` and `react-i18next`.
- **Code Splitting & Bundle Budget**: English strings are bundled with the app; Hindi and Marathi namespaces are lazy-loaded via dynamic `import()` per namespace/route so initial JS bundle remains $< 300\text{ KB}$ gzipped.
- **Namespaces**: `common`, `auth`, `dashboard`, `billing`, `products`, `stock`, `customers`, `reports`, `settings`, `errors`, `validation`.
- **Key Conventions**: Nested keys (`billing.pay.confirm`). No sentence assembly or concatenation. Interpolation (`{{count}}`, `{{name}}`), plurals (`_one`, `_other`), and `<Trans>` for inline elements. No raw HTML in translation strings.
- **Typography & Font Fallback**:
  - Add `Noto Sans Devanagari` (`@fontsource-variable/noto-sans-devanagari`) as fallback after `Plus Jakarta Sans`, scoped via `unicode-range` so font weights load on-demand only when Devanagari characters are rendered.
  - Body line-height $\ge 1.5$, heading line-height $\ge 1.3$. No fixed pixel heights on buttons, chips, tabs, or table rows (use `min-h-[44px]` and padding). Text wrapping enabled on tabs/chips. Never truncate primary action buttons with ellipsis.
  - Disable `uppercase` and `letter-spacing` in Devanagari to prevent breaking conjunct glyphs.
  - Receipts and A4 invoice font stack includes `Noto Sans Devanagari` to print customer and item names legibly.

### 15.3 Server Error Codes & Decoupled Localization
- **Zero Display Strings from Backend**: The server returns zero human-readable display messages for UI rendering.
- **Standard Code Registry (`server/src/errors/codes.js`)**: All operational and business errors return structured codes and parameters:
  ```json
  {
    "success": false,
    "error": {
      "code": "INSUFFICIENT_STOCK",
      "params": { "available": 2, "requested": 5 }
    }
  }
  ```
- **Zod Validation Structure**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "fields": [{ "path": "phone", "code": "INVALID_PHONE_FORMAT", "params": {} }]
    }
  }
  ```
- All dashboard alerts, status values, audit actions, return reasons, payment modes, and stock statuses use standardized machine enums mapped to localized client strings.

### 15.4 Unicode & Input Handling
- **Server-Side Unicode Normalization**: All user-entered text (product names, brands, flavours, notes, categories, suppliers, customers) is defensively normalized to Unicode NFC, trimmed, and whitespace-collapsed before saving. Unique indexes check normalized values.
- **Grapheme-Aware Length Limits**: Length limits use grapheme cluster counting (`Intl.Segmenter`) rather than UTF-16 code units so conjuncts and vowel marks are not truncated mid-character.
- **Digit Transliteration (`toAsciiDigits`)**: A shared utility converts Devanagari digits (`०-९`) and Arabic-Indic digits to ASCII (`0-9`) on both client and server before validating numeric fields (phone, PIN, barcode, quantities, amounts).
- **Devanagari Search & Collation**: MongoDB indexes use `default_language: "none"` to prevent English-specific stemming on Indic terms. Text queries perform normalized NFC substring matches. Lists sort via `Intl.Collator` on client and Unicode collation on server.

### 15.5 Translation Governance & Tooling
- **`docs/GLOSSARY.md`**: Canonical glossary defining standardized retail terminology across English, Hindi, and Marathi.
- **`npm run i18n:export-review`**: Exports `docs/i18n-review.csv` (UTF-8 with BOM) containing keys, namespace, screen context, and strings in all 3 languages.
- **`npm run i18n:import-review`**: Validates and safely merges reviewed translations without modifying English keys.
- **`npm run i18n:status`**: Reports translation coverage and review progress per language and namespace.
- **`npm run i18n:check`**: Verifies 100% key parity across `en`, `hi`, `mr`, validates placeholder tags, and asserts no unapproved raw keys.
- **Pseudo-Locale `en-XA`**: Used exclusively in test suites to verify layout elasticity (+40% text expansion) and detect hard-coded strings.


---

## 16. Purchase Orders Design (Enhancement)

### 16.1 Design Decisions & Scope Boundaries
- **Owner-Only Capability**: All PO management, tracking, and "On order" stock data are strictly restricted to the Owner. Staff accounts see zero PO screens, zero PO API endpoints, and zero `onOrderQty` fields.
- **Stock / Purchase Menu Integration**: Added as a 4th tab inside the existing screen: `Stock | Purchases | Orders | Suppliers`. No new sidebar or bottom-nav items.
- **Zero Automatic Side-Effects on Accounting/Stock**: Purchase orders are planning and commitment documents. They DO NOT modify physical inventory, stock movements, supplier dues, or GST. Stock and supplier dues change ONLY upon inwarding via the existing Purchase entry workflow.
- **Explicit Send Workflow**: Sending consists of generating shareable WhatsApp click-to-chat links (`wa.me/91...?text=...`) or printing an A4 PDF order. "Mark as sent" is an explicit manual owner confirmation; the app never marks orders sent automatically.
- **Language Boundaries**: PO documents (printed order, WhatsApp message text) are English-only. The ERP application UI for PO management is fully localized in English, Hindi, and Marathi.

### 16.2 Data Model: `purchase_orders`
```javascript
{
  poNo: { type: String, required: true, unique: true }, // Format: PO/2627/0001 (FY sequence)
  fy: { type: String, required: true },                 // e.g. "2627"
  status: {
    type: String,
    enum: ['draft', 'sent', 'partially_received', 'received', 'closed', 'cancelled'],
    default: 'draft',
    index: true
  },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  supplierSnapshot: {
    name: { type: String, required: true },
    phone: { type: String },
    gstin: { type: String }
  },
  expectedDate: { type: Date, default: null },
  note: { type: String, default: '' },
  revision: { type: Number, default: 1 },
  revisions: [{
    revisionNumber: Number,
    amendedAt: { type: Date, default: Date.now },
    amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true },
    snapshotItems: [mongoose.Schema.Types.Mixed]
  }],
  items: [{
    lineId: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    nameSnapshot: { type: String, required: true },
    brand: { type: String, required: true },
    flavour: { type: String, required: true },
    size: { type: String, required: true },
    barcode: { type: String },
    qtyOrdered: { type: Number, required: true, min: 1 },
    qtyReceived: { type: Number, default: 0, min: 0 },
    expectedUnitCostPaise: { type: Number, min: 0 }, // Informational only, GST-exclusive
    gstRate: { type: Number, default: 18 },
    closedShort: { type: Boolean, default: false }
  }],
  estimatedTotalPaise: { type: Number, default: 0 },
  sentAt: { type: Date, default: null },
  sentVia: { type: String, enum: ['whatsapp', 'print', 'other', null], default: null },
  closeReason: { type: String },
  cancelReason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idempotencyKey: { type: String, unique: true, required: true },
  receipts: [{
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    receivedAt: { type: Date, default: Date.now }
  }]
}
```
- **Indexes**:
  - `{ status: 1, createdAt: -1 }`
  - `{ supplierId: 1, createdAt: -1 }`
  - `{ 'items.variantId': 1, status: 1 }`
- **Purchase Linkage**: `purchases` collection gains optional `purchaseOrderId`; each inward item gains optional `poLineId`.
- **Shop Setting**: `settings` gains `reorderCoverDays` (default 30, integer between 7 and 90).

### 16.3 Business Rules & State Machine
1. **On-Order Calculation**: `onOrderQty = Σ max(qtyOrdered - qtyReceived, 0)` for POs in `sent` or `partially_received` with `closedShort == false`.
2. **Suggested Reorder Algorithm (`suggestedReorderQty`)**:
   - `ceil(avgDailySale * reorderCoverDays) - qtyInStock - onOrderQty`.
   - Fallback: `max(lowStockLimit * 2 - qtyInStock - onOrderQty, 0)`.
   - Capped at 500 units; $\le 0$ results are ignored.
3. **Reorder to Order Flow**:
   - Owner selects low-stock items from the Reorder list.
   - Automatically groups items by last known supplier; items without previous supplier appear in an interactive "Select Supplier" bucket.
   - Generates 1 Draft PO per supplier in an atomic operation.
4. **Amendment Workflow**:
   - Sent/partial orders can be amended by Owner (mandatory audit reason).
   - Quantity cannot be lowered below already `qtyReceived`.
   - Increments `revision`, archives prior line snapshot in `revisions[]`.
5. **Inward Receiving Transaction**:
   - Clicking "Receive Stock" pre-fills existing Purchase screen with remaining PO quantities and expected costs.
   - Saving the purchase updates the PO in the SAME transaction: increments `qtyReceived`, appends to `receipts[]`, updates status (`partially_received` or `received`).
   - Over-receipt is allowed with visual warning; unlinked items are accepted.
6. **Voiding Inward Purchases**:
   - Voiding a purchase linked to a PO atomically reverses `qtyReceived` and rolls back PO status.
7. **Close Short & Cancel**:
   - Close Short: Open lines flagged `closedShort: true`, PO status set to `closed` (stops counting on-order).
   - Cancel: Allowed only if `qtyReceived == 0`.

### 16.4 API Specifications (/api/v1 - Owner Only)
- `GET /purchase-orders`: List POs with filters (`status`, `supplier`, `overdue`, `search`) and pagination.
- `POST /purchase-orders`: Create draft PO with idempotency key.
- `GET /purchase-orders/:id`: Detail view with lines, revision history, and linked purchases.
- `PUT /purchase-orders/:id`: Update draft PO.
- `POST /purchase-orders/:id/send`: Mark order sent (`sentVia: "whatsapp" | "print" | "other"`).
- `POST /purchase-orders/:id/amend`: Amend sent order with audit reason.
- `POST /purchase-orders/:id/close`: Close short remaining lines with reason.
- `POST /purchase-orders/:id/cancel`: Cancel order (0 received only).
- `GET /purchase-orders/:id/receive-prefill`: Prefill payload for New Purchase screen.
- `POST /purchase-orders/from-reorder/preview`: Stateless preview grouping variants by supplier.
- `POST /purchase-orders/from-reorder`: Atomic creation of multiple draft POs.
- `GET /purchase-orders/:id/share`: Formats WhatsApp shareable text and supplier phone.


---

## 17. Offline Billing Design for Registered Counter Devices (Final Enhancement)

### 17.1 Deliberate Exceptions to Foundational Architecture Rules
1. **Service Worker Allowance**: A service worker (`vite-plugin-pwa` / Workbox) is now formally allowed, but restricted strictly to precaching and serving the built app shell (static hashed assets) and offline navigation fallbacks. It is strictly configured with `NetworkOnly` for all `/api/*`, `/healthz`, and `/readyz` endpoints—it **NEVER** caches, intercepts, or mocks API requests.
2. **Narrow Client-Side Calculation Exception**: The foundational rule *"the client never calculates money"* has exactly **ONE narrow exception**: the client-side offline billing module, which executes a byte-identical copy of `server/src/services/billing/calculator.js` to price carts when disconnected. Online billing remains 100% server-authoritative (`POST /billing/quote` and server checkout transaction), unchanged.

### 17.2 Feature Flags & Activation Rules
- **Global Setting**: `settings.offlineBilling.enabled` (Boolean, default `false`).
- **Device Setting**: `devices.offlineEnabled` (Boolean, per-device enablement).
- When `settings.offlineBilling.enabled === false`, the offline subsystem is completely inert, and the app functions identically to its pre-enhancement state.

### 17.3 Scope: What Works Offline vs What is Blocked
- **Allowed Offline**:
  - Barcode scanning & catalog text search against local IndexedDB cache.
  - Item quantities, line discounts, and bill discounts up to `staffMaxDiscountPct`.
  - Walk-in customers or typed customer name + phone (deduplicated by phone at sync).
  - Cash, UPI (local QR generation with manual "Payment received" confirm), and Card payments.
  - Fully paid transactions only.
  - Thermal 80mm and A4 receipt printing.
  - Local cart hold and resume; cart autosave.
- **Blocked Offline (with translated explanation)**:
  - Credit / partial payments and customer dues.
  - Discounts exceeding `staffMaxDiscountPct`.
  - Price overrides and sales below cost.
  - B2B / GSTIN customers and inter-state tax billing.
  - Returns, credit notes, exchanges, and due collections.
  - Day close, supplier purchases, stock adjustments, and CSV imports.
  - Reports and live WhatsApp sharing (marked "available after sync").
  - Creation/editing of products, categories, or settings.
  - Note: Owner accounts offline are restricted to the same staff rules (no offline PIN bypasses).

### 17.4 Data Models & Schemas

#### 17.4.1 `devices`
```javascript
{
  name: { type: String, required: true },
  seriesLetter: { type: String, required: true, enum: ['A', 'B', 'C', 'D', 'E'], unique: true },
  tokenHash: { type: String, required: true, unique: true }, // SHA-256 of 256-bit secret token
  status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
  offlineEnabled: { type: Boolean, default: false },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastSeenAt: { type: Date, default: null },
  lastSyncAt: { type: Date, default: null },
  pendingCount: { type: Number, default: 0 },
  oldestPendingAt: { type: Date, default: null },
  appVersion: { type: String },
  userAgent: { type: String },
  catalogVersionHeld: { type: Number, default: 0 }
}
```

#### 17.4.2 `device_pairings`
```javascript
{
  codeHash: { type: String, required: true, unique: true }, // SHA-256 of 6-digit numeric code
  deviceData: { name: String, seriesLetter: String },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // 10-minute TTL
  attempts: { type: Number, default: 0 }, // Locked after 5 failed attempts
  usedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}
```

#### 17.4.3 `device_series`
```javascript
{
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  fy: { type: String, required: true },
  lastSeq: { type: Number, default: 0 }
}
// Unique compound index on (deviceId, fy)
```

#### 17.4.4 `price_history`
```javascript
{
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sellingPricePaise: { type: Number, required: true },
  mrpPaise: { type: Number, required: true },
  gstRate: { type: Number, required: true },
  hsn: { type: String, required: true },
  effectiveFrom: { type: Date, required: true, default: Date.now },
  effectiveTo: { type: Date, default: null } // null = current active pricing
}
// Compound index on (variantId, effectiveFrom, effectiveTo)
```

#### 17.4.5 `catalog_versions`
```javascript
{
  version: { type: Number, required: true, unique: true },
  asOf: { type: Date, required: true, default: Date.now }
}
```

#### 17.4.6 `offline_bills_log`
```javascript
{
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  fy: { type: String, required: true },
  seq: { type: Number, required: true },
  clientUuid: { type: String, required: true, unique: true },
  payloadHash: { type: String, required: true },
  status: { type: String, enum: ['accepted', 'duplicate', 'quarantined'], required: true },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },
  rawPayload: { type: mongoose.Schema.Types.Mixed }, // Preserved for quarantined items
  receivedAt: { type: Date, default: Date.now }
}
// Unique index on (deviceId, fy, seq)
```

#### 17.4.7 `sync_issues`
```javascript
{
  type: {
    type: String,
    enum: [
      'OVERSOLD', 'PRICE_MISMATCH', 'GST_MISMATCH', 'CALC_MISMATCH',
      'BELOW_COST', 'DISCOUNT_ABOVE_LIMIT', 'POSSIBLE_DUPLICATE',
      'SERIES_GAP', 'CLOCK_SUSPECT', 'STAFF_INACTIVE', 'DEVICE_REVOKED',
      'REJECTED_MALFORMED', 'OFFLINE_DISABLED', 'PAYMENT_RULE_VIOLATION'
    ],
    required: true,
    index: true
  },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },
  seq: { type: Number },
  details: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolutionNote: { type: String },
  createdAt: { type: Date, default: Date.now }
}
```

#### 17.4.8 `series_exceptions`
```javascript
{
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  fy: { type: String, required: true },
  seq: { type: Number, required: true },
  reason: { type: String, enum: ['lost_unsynced', 'duplicate_online', 'void_other'], required: true },
  note: { type: String, required: true },
  declaredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}
```

#### 17.4.9 Bill & Batch Modifications
- `bills`: gains `source` (`"online" | "offline"`), `deviceId`, `deviceSeq`, `deviceCreatedAt`, `clockCorrectionMs`, `syncedAt`, `clientUuid`, `catalogVersion`, and `serverRecomputed: { grandTotalPaise, taxablePaise, gstPaise }`.
- `stock_batches`: gains `kind` (`"normal" | "shortfall"`, default `"normal"`). Shortfall batches have `batchNo: "SHORTFALL"` and are the single location in the database where `qtyLeft` may become negative to track oversold physical units.

### 17.5 Numbering Scheme: Device Series
- Format: `${billPrefix}/${fy}/${letter}${seq padded to 5}`, e.g., `PS/2627/A00123`.
- Strict length invariant: Fits within 16 characters (validated during registration).
- Atomic sequence generation in device IndexedDB within a `readwrite` transaction during checkout completion.

### 17.6 Ingestion Pipeline (`POST /api/v1/offline/sync`)
Processes up to 20 bills in strict sequential order. Each bill runs in an isolated MongoDB transaction:
1. **Idempotency & Conflict Check**: Validate `clientUuid` and `(deviceId, fy, seq)`.
2. **Structural Validation (Zod)**: Reject malformed payloads to quarantine.
3. **Effective Timestamp Resolution**: `createdAt = deviceCreatedAt + clockCorrectionMs`. Flag `CLOCK_SUSPECT` if out-of-bounds.
4. **Device & Staff Verification**: Verify device active; quarantine if revoked.
5. **Price & Tax Audit**: Compare with `price_history` as of catalog snapshot date.
6. **Server Calculator Recomputation**: Recompute totals; store differences in `serverRecomputed`. Issued amounts stay on the bill.
7. **Rule Guards**: Flag `DISCOUNT_ABOVE_LIMIT` or `BELOW_COST`.
8. **FEFO Allocation & Shortfall Management**: Allocate stock. If insufficient, assign remainder to `shortfall` batch and raise `OVERSOLD`.
9. **Atomic Persistence**: Save bill, payment, customer upsert, device sequence increment, and sync logs.

---

## 18. Dashboard Background and Static Shell Specification

### 18.1 Static App Shell Architecture (>= 768px Tablet & Laptop)
- **Viewport Layout**: The shell is a fixed viewport grid: `height: 100dvh; overflow: hidden; display: flex`. `html` and `body` must never scroll at >= 768px (`overflow: hidden`).
- **Scroll Container**: The `<main>` element is the single vertical scrolling container:
  `overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable`.
- **Persistent Sidebar**:
  - The sidebar never unmounts, remounts, or re-renders across route changes.
  - Zero entrance/exit animations, zero width transitions, zero hover movement/scale, and zero sliding indicators. Active navigation item changes instantly via color swap only.
  - Width: Exactly 262px at >= 1280px, 232px from 1024px to 1279px, and 76px icon rail from 768px to 1023px.
  - The Phase 3 rule "billing counter auto-collapses the sidebar" is PERMANENTLY REMOVED. Sidebar width depends solely on viewport width.
  - Internal sidebar scrolling (`overflow-y: auto`) appears only if content exceeds viewport height.
- **Mobile Phones (< 768px)**:
  - Preserves standard mobile document scrolling and bottom navigation tab bar. Fixed shell grid is omitted on mobile.
- **Top Bar**:
  - Search pill with `Cmd/Ctrl + K` hint, notification bell with unread indicator dot, and localized date pill.
  - User profile chip is removed from the top bar (lives exclusively in the sidebar footer card).
  - Sticky with transparent background; acquires a blurred dark background only after content scrolls >= 8px.

### 18.2 Dashboard Background Art (`<DashboardBackdrop />`)
- **Route Isolation**: Mounted exclusively on `/` (Dashboard). Other routes render dark background with subtle ambient glows.
- **Placement & Sizing**: Positioned at top-right of main scroller behind cards:
  - Box: `position: absolute; top: 0; right: 0; width: min(62%, 1100px); height: clamp(380px, 46vh, 560px); pointer-events: none; z-index: 0`.
  - Image: `object-fit: cover; object-position: 70% 20%`. Tuned so that at 1672x941 viewport the tub center is at approx x=77%, y=24% of content area.
- **Edge Blending**: Blended into page with overlay gradient divs (left-edge fade to `#050805`, bottom fade, top vignette). Zero `mask-image` or `mask-composite` (Safari compatibility).
- **Subtle Motion**:
  - Gentle floating layer (`translateY(0)` to `translateY(-10px)` with +/-0.6deg tilt, 7s, ease-in-out, alternate).
  - Soft lime radial glow pulsing opacity (5s).
  - Up to 16 tiny blurred dust dots drifting upward.
  - Animations pause on `document.hidden` (`visibilitychange`) and disable under `prefers-reduced-motion`.
- **Image Delivery**:
  - `<picture>` / `srcset` with 2000px and 800px WebP, explicit `width` and `height`, `fetchpriority="high"`, `decoding="async"`, eager loading.
  - Fallback: Green ambient gradient if file is missing (zero broken image icons, zero fake SVG tubs).
- **Build Pipeline**:
  - Script `npm run hero:build` uses `sharp` to process `client/public/assets/hero/src/dashboard-bg-original.png` into `dashboard-bg-2000.webp` (<220 KB) and `dashboard-bg-800.webp` (<90 KB).

### 18.3 Dashboard Content & Grid (Matching Image A at 1672x941)
- **Top Section**: "Welcome Back! / Your shop is running great today." headline.
- **Row 1**: 3 Glass KPI cards (Today's Sales, Today's Profit [owner only], Bills Today) spanning left half; right half exposes backdrop art.
- **Row 2**:
  - Left: Sales Overview line chart card (wide) with This Week / Month / Year chips.
  - Right: Column of 3 alert cards (Low Stock, Expiring Soon, Customer Dues) overlapping the bottom of the backdrop art.
- **Row 3**:
  - Top Selling Products card (with thumbnail and lime progress bar).
  - Recent Bills card.
  - Action column: "New Bill" (lime glow button) and "Add Stock" (secondary dark button; "View Stock" for staff).
- **Cash Drawer Alert**: Slim single-line warning strip between top bar and KPI row if previous day was not closed.

