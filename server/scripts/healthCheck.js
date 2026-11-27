/**
 * Nightly Operations Health Check Script.
 * Detects faults across:
 * 1. Stock ledger integrity (sum of movements == batch qtyLeft).
 * 2. Customer ledger integrity (sum of ledger entries == customer dueBalancePaise).
 * 3. Purchase Order integrity (line qtyReceived == sum of linked purchase line quantities).
 * 4. Offline series continuity (detects sequence gaps).
 * 5. Shortfall batches without open OVERSOLD sync issues.
 * 6. Backup currency (verifies backup exists within last 24 hours).
 */

export async function runHealthChecks({
  batches = [],
  stockMovements = [],
  customers = [],
  customerLedgers = [],
  purchaseOrders = [],
  purchases = [],
  deviceSeries = [],
  shortfallBatches = [],
  syncIssues = [],
  lastBackupDate = new Date(),
}) {
  const issues = [];

  // 1. Stock Mismatch Check
  for (const batch of batches) {
    const movementsSum = stockMovements
      .filter((m) => m.batchId === batch._id?.toString() || m.batchId === batch.id)
      .reduce((sum, m) => sum + (m.qty || 0), 0);

    if (batch.qtyLeft !== movementsSum) {
      issues.push({
        type: 'STOCK_MISMATCH',
        message: `Batch ${batch.batchNo} qtyLeft (${batch.qtyLeft}) does not equal movements sum (${movementsSum}).`,
      });
    }
  }

  // 2. Customer Ledger Mismatch
  for (const cust of customers) {
    const ledgerSum = customerLedgers
      .filter((l) => l.customerId === cust._id?.toString() || l.customerId === cust.id)
      .reduce((sum, l) => sum + (l.deltaPaise || 0), 0);

    if (cust.dueBalancePaise !== ledgerSum) {
      issues.push({
        type: 'CUSTOMER_LEDGER_MISMATCH',
        message: `Customer ${cust.name} due (${cust.dueBalancePaise}) does not match ledger sum (${ledgerSum}).`,
      });
    }
  }

  // 3. Purchase Order Integrity
  for (const po of purchaseOrders) {
    for (const line of po.items || []) {
      const receivedInPurchases = purchases
        .filter((p) => p.purchaseOrderId === po.poNo || p.purchaseOrderId === po._id?.toString())
        .flatMap((p) => p.items || [])
        .filter((i) => i.poLineId === line.lineId)
        .reduce((sum, i) => sum + (i.qty || 0), 0);

      if (line.qtyReceived !== receivedInPurchases) {
        issues.push({
          type: 'PO_INTEGRITY_MISMATCH',
          message: `PO ${po.poNo} line ${line.lineId} qtyReceived (${line.qtyReceived}) does not match purchase receipts (${receivedInPurchases}).`,
        });
      }
    }
  }

  // 4. Offline Series Gap
  for (const ds of deviceSeries) {
    if (ds.expectedSeq && ds.lastSeq > ds.expectedSeq) {
      issues.push({
        type: 'OFFLINE_SERIES_GAP',
        message: `Device ${ds.deviceId} has sequence gap between ${ds.expectedSeq} and ${ds.lastSeq}.`,
      });
    }
  }

  // 5. Unexplained Shortfall Batches
  for (const sf of shortfallBatches) {
    const hasOpenIssue = syncIssues.some(
      (iss) => iss.type === 'OVERSOLD' && iss.status === 'open' && iss.variantId === sf.variantId
    );
    if (!hasOpenIssue && sf.qtyLeft < 0) {
      issues.push({
        type: 'UNEXPLAINED_SHORTFALL',
        message: `Variant ${sf.variantId} has negative shortfall stock (${sf.qtyLeft}) without an open OVERSOLD issue.`,
      });
    }
  }

  // 6. Missing Backup
  const hoursSinceBackup = (Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60);
  if (hoursSinceBackup > 24) {
    issues.push({
      type: 'MISSING_BACKUP',
      message: `Last backup was taken ${Math.round(hoursSinceBackup * 10) / 10} hours ago (threshold: 24h).`,
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    timestamp: new Date().toISOString(),
  };
}
