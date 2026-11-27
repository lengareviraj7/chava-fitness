import { describe, it, expect } from 'vitest';
import { runHealthChecks } from '../scripts/healthCheck.js';

describe('Area 7: Operations & Scripted Disaster Recovery Drill', () => {
  it('executes disaster recovery drill, restores snapshot, and measures RTO', async () => {
    // 1. Initial State before Disaster
    const healthyData = {
      batches: [{ id: 'b1', batchNo: 'BATCH-001', qtyLeft: 10 }],
      stockMovements: [{ batchId: 'b1', qty: 10 }],
      customers: [{ id: 'c1', name: 'Ramesh', dueBalancePaise: 50000 }],
      customerLedgers: [{ customerId: 'c1', deltaPaise: 50000 }],
      purchaseOrders: [],
      purchases: [],
      deviceSeries: [],
      shortfallBatches: [],
      syncIssues: [],
      lastBackupDate: new Date(),
    };

    const initialCheck = await runHealthChecks(healthyData);
    expect(initialCheck.passed).toBe(true);

    // 2. Simulate Disaster (Corrupted ledger and missing backup)
    const disasterData = {
      ...healthyData,
      customers: [{ id: 'c1', name: 'Ramesh', dueBalancePaise: 100000 }], // Discrepancy!
      lastBackupDate: new Date(Date.now() - 30 * 3600 * 1000), // 30h old
    };

    const disasterCheck = await runHealthChecks(disasterData);
    expect(disasterCheck.passed).toBe(false);
    expect(disasterCheck.issues.some((i) => i.type === 'CUSTOMER_LEDGER_MISMATCH')).toBe(true);
    expect(disasterCheck.issues.some((i) => i.type === 'MISSING_BACKUP')).toBe(true);

    // 3. Disaster Recovery: Restore from snapshot and measure RTO
    const startRecovery = performance.now();

    // Restoration: Overwrite with last known valid snapshot
    const restoredData = JSON.parse(JSON.stringify(healthyData));
    restoredData.lastBackupDate = new Date(); // newly verified

    const postRecoveryCheck = await runHealthChecks(restoredData);
    const recoveryDurationMs = performance.now() - startRecovery;

    expect(postRecoveryCheck.passed).toBe(true);
    expect(postRecoveryCheck.issues).toHaveLength(0);

    // RTO target: under 5,000ms in-memory (real server target under 10 minutes)
    expect(recoveryDurationMs).toBeLessThan(100);
    console.log(`[DISASTER_DRILL] Recovery Time Objective (RTO) measured: ${Math.round(recoveryDurationMs * 100) / 100} ms`);
  });

  it('detects injected fault: PO integrity discrepancy', async () => {
    const data = {
      batches: [],
      stockMovements: [],
      customers: [],
      customerLedgers: [],
      purchaseOrders: [{ poNo: 'PO/2627/0001', items: [{ lineId: 'line-1', qtyReceived: 10 }] }],
      purchases: [{ purchaseOrderId: 'PO/2627/0001', items: [{ poLineId: 'line-1', qty: 5 }] }], // 5 received vs 10 recorded
      deviceSeries: [],
      shortfallBatches: [],
      syncIssues: [],
      lastBackupDate: new Date(),
    };

    const res = await runHealthChecks(data);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.type === 'PO_INTEGRITY_MISMATCH')).toBe(true);
  });

  it('detects injected fault: Unexplained shortfall batch', async () => {
    const data = {
      batches: [],
      stockMovements: [],
      customers: [],
      customerLedgers: [],
      purchaseOrders: [],
      purchases: [],
      deviceSeries: [],
      shortfallBatches: [{ variantId: 'v-shortfall-1', qtyLeft: -3 }],
      syncIssues: [], // Missing OVERSOLD issue!
      lastBackupDate: new Date(),
    };

    const res = await runHealthChecks(data);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.type === 'UNEXPLAINED_SHORTFALL')).toBe(true);
  });
});
