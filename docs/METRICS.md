# Metric Definitions — Single Source of Truth

> This document is generated from and must stay in sync with `server/src/services/reporting/definitions.js`.
> No metric may be computed anywhere else. Any change to a definition must be made in that file first, then reflected here.

All dates are in the **Asia/Kolkata** timezone (IST, UTC+5:30).
All money values are **integer paise** (₹1.00 = 100 paise).
All database queries use `$dateToString` / `$dateTrunc` with `timezone: "Asia/Kolkata"`.

---

## 1. Period Boundaries
- A **day** runs from `00:00:00.000 IST` to `23:59:59.999 IST`.
- A **week** runs Monday to Sunday.
- A **financial year** runs April 1 to March 31 (e.g. FY 2026-27 = "2627").
- Month boundaries are calendar months.

**Allowed Date Presets**:

| Preset | Start | End |
|---|---|---|
| Today | Start of today (IST) | End of today (IST) |
| Yesterday | Start of yesterday | End of yesterday |
| Last 7 days | 7 days ago (inclusive) | End of yesterday |
| This month | 1st of current month | End of today |
| Last month | 1st of last month | Last day of last month |
| This financial year | Apr 1 of current FY | End of today |
| Last financial year | Apr 1 of prev FY | Mar 31 of prev FY |
| Custom | User-selected | User-selected (max 366 days) |

---

## 2. Sales Metrics

### 2.1 Gross Sales
```
Σ bills.grandTotalPaise  WHERE bills.createdAt IN period AND bills.status = "completed"
```
- Includes GST.
- Voided bills are excluded.

### 2.2 Returns
```
Σ returns.grandTotalPaise  WHERE returns.createdAt IN period
```
- Counted on the **credit note issue date**, NOT the original bill date.
- Immutable once written.

### 2.3 Net Sales *(headline "Sales" everywhere)*
```
Net Sales = Gross Sales − Returns
```

### 2.4 Taxable Sales
```
Taxable = Σ bills.taxablePaise − Σ returns.totals.taxablePaise  (both in period)
```

### 2.5 GST Collected (Net)
```
GST = Σ bills GST components − Σ returns GST components  (all in period)
```
Components: `cgstPaise`, `sgstPaise`, `igstPaise`.

### 2.6 Credit Given
```
Credit Given per bill = bill.grandTotalPaise − Σ(payments WHERE billId = bill._id AND type = "sale").amountPaise
```
Totals over the period are summed per bill, never from `bill.paymentSummary`.

### 2.7 Payment Mode Totals
Source: `payments` collection only.
- **Sale receipts**: `payments WHERE type = "sale" AND createdAt IN period`, grouped by `mode` (cash / upi / card).
- **Due collections**: `payments WHERE type = "due" AND createdAt IN period`, grouped by `mode`.
- **Refunds**: `payments WHERE type = "refund" AND createdAt IN period`, grouped by `mode`.

---

## 3. Profit Metrics

### 3.1 Gross Profit
```
Gross Profit = Σ bills.profitPaise + Σ returns.profitAdjustmentPaise   (both in period)
```
`returns.profitAdjustmentPaise` is a negative integer.
Shown on the dashboard labeled **"Gross profit"**.

### 3.2 Gross Margin %
```
Margin % = Gross Profit / Net Taxable Sales × 100
```
Only shown when `Net Taxable Sales > 0`.

### 3.3 Stock Write-offs
```
Write-offs = Σ |qty| × unitCostPaise  WHERE stock_movements.type = "adjustment"
             AND stock_movements.qty < 0
             AND stock_movements.reason IN ["damaged","expired","lost"]
             AND stock_movements.createdAt IN period
```
`unitCostPaise` is taken from `stock_batches` for the referenced `batchId` at the time of the movement.

### 3.4 Profit After Stock Losses
```
Profit After Stock Losses = Gross Profit − Stock Write-offs
```
Shown only on the **Profit report**, never on the dashboard.

---

## 4. Stock Metrics

### 4.1 Stock Value (at cost)
```
Stock Value = Σ (batch.qtyLeft × batch.unitCostPaise)  over all stock_batches
```
GST-exclusive (input cost only). Expired batches included but broken out separately.

### 4.2 Potential Retail Value
```
Retail Value = Σ (batch.qtyLeft × variant.sellingPrice)  over all stock_batches
```
Uses current `sellingPrice`; a snapshot value at the time the report is generated.

### 4.3 Potential Profit (Stock)
```
Potential Profit = Retail Value − Stock Value
```

### 4.4 Average Daily Sale (per variant)
```
Avg Daily Sale = ( units sold in last 30 days − units returned in last 30 days ) / 30
```
Minimum clamped to 0.

### 4.5 Days of Stock Left
```
Days of Stock = qtyLeft / Avg Daily Sale
```
Displayed as `∞` or `999+` when `Avg Daily Sale = 0` and `qtyLeft > 0`.

---

## 5. Expiry Metrics

### 5.1 Expiry Buckets
Constants from `server/src/config/constants.js`:
- `EXPIRY_CRITICAL_DAYS = 30`
- `EXPIRY_WARN_DAYS = 60`

| Bucket | Condition |
|---|---|
| Expired | `expiryDate < now` |
| Within 30 days | `now ≤ expiryDate < now + 30d` |
| 31–60 days | `now + 30d ≤ expiryDate < now + 60d` |
| 61–90 days | `now + 60d ≤ expiryDate < now + 90d` |

Only batches where `qtyLeft > 0` and `trackExpiry = true` are included.

### 5.2 Value at Risk (per batch)
```
Value at Risk = batch.qtyLeft × batch.unitCostPaise
```

---

## 6. GST Report Metrics

All GST calculations use the **snapshot values** stored in each bill/credit-note at the time of sale. Changing a product's GST rate after the sale has zero effect on historical reports.

### 6.1 Outward Supplies (Net of Credit Notes, per GST rate)
```
Taxable (net)  = Σ bill line taxable − Σ credit note line taxable   (in period, same rate)
CGST (net)     = Σ bill line cgst − Σ credit note line cgst
SGST (net)     = Σ bill line sgst − Σ credit note line sgst
IGST (net)     = Σ bill line igst − Σ credit note line igst
```

### 6.2 B2B vs B2C Split
- **B2B**: bills/credit notes where `customerSnapshot.gstin` is non-empty.
- **B2C**: all others (walk-in and customers without GSTIN).

### 6.3 Input GST from Purchases
```
Input GST = Σ purchase.gstPaise  WHERE purchase.status = "active"
                                  AND purchase.invoiceDate IN period
```
Voided purchases (`status = "voided"`) are excluded.

### 6.4 Estimated Net GST Payable
```
Estimated Net GST = Output GST (net) − Input GST
```
Labeled: **"Estimate for reference only. Your CA will file the return."**

---

## 7. Customer Dues Metrics

### 7.1 Total Customer Dues (snapshot)
```
Total Dues = Σ customer.dueBalancePaise  WHERE customer.isActive = true
```

### 7.2 Aging Buckets (by bill date)
Bills with `duePaise > 0` grouped by `bills.createdAt`:

| Bucket | Condition |
|---|---|
| 0–30 days | Bill date >= today − 30 days |
| 31–60 days | today − 60 ≤ bill date < today − 30 |
| 61–90 days | today − 90 ≤ bill date < today − 60 |
| 90+ days | bill date < today − 90 |
| Before software | From `customer.openingDuePaise` remaining |

### 7.3 Due Collections (in period)
```
Collected = Σ payments.amountPaise  WHERE type = "due" AND createdAt IN period
```

---

## 8. Dashboard Staff vs Owner Payloads

| Field | Owner | Staff |
|---|---|---|
| Today's net sales | ✅ (all bills) | ✅ (own bills only) |
| Today's gross profit | ✅ | ❌ omitted |
| Bills today | ✅ | ✅ (own only) |
| % change vs yesterday | ✅ | ✅ (own) |
| Sales Overview chart | ✅ | ❌ omitted |
| Top Selling (revenue) | ✅ | ❌ omitted |
| Top Selling (units) | ✅ | ❌ omitted |
| Recent Bills | ✅ (last 5 all) | ✅ (own last 5 today) |
| Low Stock alert | ✅ | ✅ (count only, no cost) |
| Expiring Soon alert | ✅ | ✅ (count only, no cost) |
| Customer Dues total | ✅ | ❌ omitted |
| Unclosed Day flag | ✅ | ❌ omitted |

---

## 9. Edge Cases & Guards
- If yesterday gross sales = 0 and today > 0: show **"New"** (not `+∞%`).
- If yesterday gross sales = 0 and today = 0: show **"—"**.
- Never return `NaN`, `Infinity`, or `null` for numeric dashboard fields; default to `0`.
- All aggregations run with `allowDiskUse: true` and `maxTimeMS: 10000`.
- Dashboard auto-refreshes every 60 seconds while the browser tab is active; pauses when hidden.


---

## 10. Inventory & Replenishment Metrics

### 10.1 On-Order Quantity (per variant)
```
On-Order Qty = Σ max(items.qtyOrdered − items.qtyReceived, 0)
WHERE purchase_orders.status IN ["sent", "partially_received"]
  AND items.closedShort = false
  AND items.variantId = <variantId>
```
- Drafts, closed, and cancelled purchase orders contribute exactly 0.
- Partially received orders count only remaining open quantity (`qtyOrdered - qtyReceived`).
- Lines flagged `closedShort: true` contribute 0 regardless of order status.
- **Access Rule**: Owner only. Never returned to Staff in any product, stock, billing, or dashboard payload.

### 10.2 Suggested Reorder Quantity (Formula)
```
suggestedReorderQty = ceil(avgDailySale × reorderCoverDays) − qtyInStock − onOrderQty
```
- `avgDailySale` = net units sold in the trailing 30 days ÷ 30.
- `reorderCoverDays` = shop setting (default 30, range 7 to 90).
- Fallback (no sales history): `max(lowStockLimit × 2 − qtyInStock − onOrderQty, 0)`.
- Cap: Maximum 500 units per suggestion.
- Proposals $\le 0$ are discarded (return 0).
