/**
 * Independent In-Memory Oracle Model for Simulation v2.
 * Pure JavaScript, zero database or production business code imports.
 * Tracks stock, shortfall, dues, cash drawer, and financial figures independently.
 */

export class SimulationOracle {
  constructor() {
    this.batches = new Map(); // batchId -> { batchId, variantId, qtyLeft, expiryDate, kind }
    this.customers = new Map(); // customerId -> { id, name, phone, dueBalancePaise }
    this.cashDrawer = new Map(); // dateStr -> { openingCashPaise, cashInPaise, cashOutPaise, countedCashPaise, shortagePaise }
    this.purchaseOrders = new Map(); // poId -> { poId, poNo, status, items: [] }
    this.bills = new Map(); // billId -> { billId, billNo, grandTotalPaise, taxablePaise, gstPaise, profitPaise, source }
    this.returns = new Map(); // returnId -> { returnId, grandTotalPaise, profitAdjustmentPaise }
  }

  recordPurchaseBatch({ batchId, variantId, qty, expiryDate }) {
    this.batches.set(batchId, {
      batchId,
      variantId,
      qtyLeft: qty,
      expiryDate,
      kind: 'normal',
    });
  }

  recordPurchaseOrder({ poId, poNo, items }) {
    this.purchaseOrders.set(poId, {
      poId,
      poNo,
      status: 'sent',
      items: items.map((i) => ({ ...i, qtyReceived: 0, closedShort: false })),
    });
  }

  recordPOReceive({ poId, receivedItems }) {
    const po = this.purchaseOrders.get(poId);
    if (!po) return;

    for (const rec of receivedItems) {
      const line = po.items.find((i) => i.variantId === rec.variantId);
      if (line) {
        line.qtyReceived += rec.qty;
      }
    }

    const allReceived = po.items.every((i) => i.closedShort || i.qtyReceived >= i.qtyOrdered);
    const someReceived = po.items.some((i) => i.qtyReceived > 0);
    po.status = allReceived ? 'received' : someReceived ? 'partially_received' : po.status;
  }

  getOnOrderQty(variantId) {
    let sum = 0;
    for (const po of this.purchaseOrders.values()) {
      if (po.status !== 'sent' && po.status !== 'partially_received') continue;
      for (const item of po.items) {
        if (item.variantId === variantId && !item.closedShort) {
          sum += Math.max(item.qtyOrdered - item.qtyReceived, 0);
        }
      }
    }
    return sum;
  }

  recordSale({ billId, billNo, dateStr, items, customerId, duePaise = 0, isCash = true, grandTotalPaise = 0, taxablePaise = 0, gstPaise = 0, profitPaise = 0, source = 'online' }) {
    this.bills.set(billId, {
      billId,
      billNo,
      grandTotalPaise,
      taxablePaise,
      gstPaise,
      profitPaise,
      source,
    });

    // Decrement stock across batches (FEFO)
    for (const item of items) {
      let remainingToDeduct = item.qty;
      for (const b of this.batches.values()) {
        if (b.variantId === item.variantId && b.kind === 'normal' && b.qtyLeft > 0) {
          const deduct = Math.min(b.qtyLeft, remainingToDeduct);
          b.qtyLeft -= deduct;
          remainingToDeduct -= deduct;
          if (remainingToDeduct === 0) break;
        }
      }

      // If physical stock insufficient, assign shortfall batch
      if (remainingToDeduct > 0) {
        const shortfallKey = `shortfall-${item.variantId}`;
        let sf = this.batches.get(shortfallKey);
        if (!sf) {
          sf = { batchId: shortfallKey, variantId: item.variantId, qtyLeft: 0, kind: 'shortfall' };
          this.batches.set(shortfallKey, sf);
        }
        sf.qtyLeft -= remainingToDeduct; // negative balance
      }
    }

    // Customer dues
    if (customerId && duePaise > 0) {
      let cust = this.customers.get(customerId);
      if (cust) {
        cust.dueBalancePaise += duePaise;
      }
    }

    // Cash drawer
    if (isCash && grandTotalPaise > duePaise) {
      const cashReceived = grandTotalPaise - duePaise;
      this._addCash(dateStr, cashReceived);
    }
  }

  recordReturn({ returnId, billId, dateStr, items, grandTotalPaise, profitAdjustmentPaise, isCashRefund = true }) {
    this.returns.set(returnId, {
      returnId,
      billId,
      grandTotalPaise,
      profitAdjustmentPaise,
    });

    // Restock sealed items
    for (const item of items) {
      if (!item.isDamaged && item.batchId) {
        const batch = this.batches.get(item.batchId);
        if (batch) {
          batch.qtyLeft += item.qty;
        }
      }
    }

    // Cash refund out of drawer
    if (isCashRefund && grandTotalPaise > 0) {
      this._deductCash(dateStr, grandTotalPaise);
    }
  }

  recordDuePayment({ customerId, dateStr, amountPaise, isCash = true }) {
    const cust = this.customers.get(customerId);
    if (cust) {
      cust.dueBalancePaise = Math.max(0, cust.dueBalancePaise - amountPaise);
    }
    if (isCash) {
      this._addCash(dateStr, amountPaise);
    }
  }

  recordDayClose({ dateStr, countedCashPaise }) {
    const drawer = this.cashDrawer.get(dateStr) || { cashInPaise: 0, cashOutPaise: 0 };
    const expected = drawer.cashInPaise - drawer.cashOutPaise;
    drawer.countedCashPaise = countedCashPaise;
    drawer.shortagePaise = expected - countedCashPaise;
    this.cashDrawer.set(dateStr, drawer);
  }

  _addCash(dateStr, amount) {
    const d = this.cashDrawer.get(dateStr) || { cashInPaise: 0, cashOutPaise: 0 };
    d.cashInPaise += amount;
    this.cashDrawer.set(dateStr, d);
  }

  _deductCash(dateStr, amount) {
    const d = this.cashDrawer.get(dateStr) || { cashInPaise: 0, cashOutPaise: 0 };
    d.cashOutPaise += amount;
    this.cashDrawer.set(dateStr, d);
  }

  getTotals() {
    let grossSales = 0;
    let netSales = 0;
    let totalTaxable = 0;
    let grossProfit = 0;

    for (const b of this.bills.values()) {
      grossSales += b.grandTotalPaise;
      totalTaxable += b.taxablePaise;
      grossProfit += b.profitPaise;
    }

    let returnsTotal = 0;
    for (const r of this.returns.values()) {
      returnsTotal += r.grandTotalPaise;
      grossProfit += r.profitAdjustmentPaise; // negative integer
    }

    netSales = grossSales - returnsTotal;

    return {
      grossSales,
      returnsTotal,
      netSales,
      totalTaxable,
      grossProfit,
    };
  }
}
