# Database Model & Data Invariants

## 1. Fundamental Data Invariants
1. **Integer Money (No Floats)**: All monetary figures (prices, taxes, discounts, totals, dues, balances) are stored strictly as **integer paise** (`1 Rupee = 100 paise`). Floats are never stored or computed.
2. **Bill Immutability**: A finalized bill is never edited or deleted. Corrections are performed via Credit Notes (`returns`) and new bills.
3. **Atomic Transactions**: All checkout, return, purchase, and due payment workflows run inside multi-document MongoDB transactions (`session.withTransaction`).
4. **FEFO Allocation**: Inventory is consumed strictly in First-Expired, First-Out order. Expired batches cannot be allocated for sale.
5. **Shortfall Containment**: Oversold items during offline outages are allocated to dedicated shortfall batches (`kind: "shortfall"`). Standard batches never go negative.

---

## 2. Key Collection Schemas & Critical Indexes

### `bills`
- Key Fields: `billNo` (unique string), `fy` (financial year), `source` (`online` | `offline`), `items[]` (embedded snapshots: name, HSN, price, GST rate, cost), `taxablePaise`, `cgstPaise`, `sgstPaise`, `igstPaise`, `grandTotalPaise`, `profitPaise`.
- Indexes:
  - `{ billNo: 1 }` (unique)
  - `{ createdAt: -1, status: 1 }`
  - `{ customerId: 1, createdAt: -1 }`

### `stock_batches`
- Key Fields: `variantId` (ObjectId), `batchNo` (string), `expiryDate` (Date), `qtyLeft` (Number), `unitCostPaise` (Number), `kind` (`normal` | `shortfall`).
- Indexes:
  - `{ variantId: 1, expiryDate: 1, qtyLeft: 1 }`
  - `{ kind: 1 }`

### `stock_movements`
- Key Fields: `variantId`, `batchId`, `type` (`purchase` | `sale` | `sale_return` | `adjustment` | `opening`), `qty` (positive for increase, negative for decrease), `balanceAfter`.
- Indexes:
  - `{ variantId: 1, createdAt: -1 }`
  - `{ batchId: 1 }`

### `customers` & `customer_ledger`
- Key Fields: `phone` (unique), `name`, `dueBalancePaise` (integer $\ge 0$).
- Ledger Fields: `customerId`, `type` (`sale_credit` | `due_payment` | `return_adjust`), `deltaPaise`, `balanceAfterPaise`.
- Indexes:
  - `{ phone: 1 }` (unique)
  - `{ customerId: 1, createdAt: -1 }`

---

## 3. Invariant Verification Scripts
- `npm run test:audit`: Property-based mathematical tests checking line totals, rounding, and non-negative customer dues.
- `server/scripts/healthCheck.js`: Evaluates stock movements sum against batch quantities and customer ledger sums against customer due balances.
