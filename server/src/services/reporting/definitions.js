/**
 * Central Reporting & Metric Definitions — Single Source of Truth
 * Keeps all aggregations, formulas, and metric calculations in one place.
 * In sync with docs/METRICS.md.
 */

export const METRIC_TIMEZONE = 'Asia/Kolkata';

/**
 * Calculates on-order quantity for a variant from active PO lines.
 * Status must be 'sent' or 'partially_received', line must not be closedShort.
 * @param {Array<{ status: string, items: Array<{ variantId: any, qtyOrdered: number, qtyReceived: number, closedShort?: boolean }> }>} purchaseOrders
 * @param {string|mongoose.Types.ObjectId} variantId
 * @returns {number}
 */
export function calculateOnOrderQty(purchaseOrders, variantId) {
  if (!Array.isArray(purchaseOrders) || !variantId) return 0;
  const targetId = variantId.toString();

  let total = 0;
  for (const po of purchaseOrders) {
    if (po.status !== 'sent' && po.status !== 'partially_received') continue;
    if (!Array.isArray(po.items)) continue;

    for (const item of po.items) {
      if (item.variantId?.toString() === targetId && !item.closedShort) {
        const remaining = Math.max((item.qtyOrdered || 0) - (item.qtyReceived || 0), 0);
        total += remaining;
      }
    }
  }
  return total;
}

/**
 * Pure function: calculates suggested reorder quantity.
 * @param {Object} params
 * @param {number} params.avgDailySale - Units per day over trailing 30 days
 * @param {number} params.reorderCoverDays - Target days of stock cover (default 30)
 * @param {number} params.qtyInStock - Current physical stock in units
 * @param {number} params.onOrderQty - Stock already on open POs
 * @param {number} [params.lowStockLimit=3] - Min threshold fallback if no sales history
 * @param {boolean} [params.hasSalesHistory=true]
 * @returns {{ suggestedQty: number, inputs: Object }}
 */
export function suggestedReorderQty({
  avgDailySale = 0,
  reorderCoverDays = 30,
  qtyInStock = 0,
  onOrderQty = 0,
  lowStockLimit = 3,
  hasSalesHistory = true,
}) {
  const coverDays = Math.max(7, Math.min(90, Number(reorderCoverDays) || 30));
  let suggested = 0;

  if (hasSalesHistory && avgDailySale > 0) {
    const targetStock = Math.ceil(avgDailySale * coverDays);
    suggested = targetStock - qtyInStock - onOrderQty;
  } else {
    // Fallback: 2x low stock limit minus existing & on-order stock
    suggested = Math.max(lowStockLimit * 2 - qtyInStock - onOrderQty, 0);
  }

  // Cap at 500 units; non-positive results return 0
  const finalQty = Math.max(0, Math.min(500, Math.round(suggested)));

  return {
    suggestedQty: finalQty,
    inputs: {
      avgDailySale: Number(avgDailySale.toFixed(2)),
      reorderCoverDays: coverDays,
      qtyInStock,
      onOrderQty,
      hasSalesHistory,
      lowStockLimit,
    },
  };
}
