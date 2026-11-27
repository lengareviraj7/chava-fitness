import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  ChevronRight,
  X,
  CheckCircle,
  Truck,
  RotateCcw,
  FileText,
  Trash2,
} from 'lucide-react';
import { stockApi, purchasesApi, suppliersApi } from '../api/stock.js';
import { productsApi } from '../api/products.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatINR, paiseToRupees, rupeesToPaise } from '../utils/money.js';

export function StockPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'purchases' | 'suppliers'

  // Stock State
  const [stockItems, setStockItems] = useState([]);
  const [stockStats, setStockStats] = useState({});
  const [loadingStock, setLoadingStock] = useState(true);
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [variantBatches, setVariantBatches] = useState([]);
  const [variantMovements, setVariantMovements] = useState([]);
  const [loadingDrawer, setLoadingDrawer] = useState(false);

  // Adjust Stock Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustBatch, setAdjustBatch] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    qty: '',
    direction: 'decrease',
    reason: 'damaged',
    notes: '',
  });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Purchases State
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  // Suppliers State
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', gstin: '', address: '' });
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState('');

  // Supplier Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', mode: 'cash', refNo: '' });
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Products Cache for Purchase Inward
  const [productsCache, setProductsCache] = useState([]);

  // Fetch Stock Data
  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const res = await stockApi.list({
        search: stockSearch,
        filter: stockFilter,
      });
      setStockItems(res.data.data.items || []);
      setStockStats(res.data.data.stats || {});
    } catch (e) {
      console.error('Failed to load stock:', e);
    } finally {
      setLoadingStock(false);
    }
  }, [stockSearch, stockFilter]);

  // Fetch Purchases
  const loadPurchases = useCallback(async () => {
    if (!isOwner) return;
    setLoadingPurchases(true);
    try {
      const res = await purchasesApi.list();
      setPurchases(res.data.data.purchases || []);
    } catch (e) {
      console.error('Failed to load purchases:', e);
    } finally {
      setLoadingPurchases(false);
    }
  }, [isOwner]);

  // Fetch Suppliers
  const loadSuppliers = useCallback(async () => {
    if (!isOwner) return;
    setLoadingSuppliers(true);
    try {
      const res = await suppliersApi.list();
      setSuppliers(res.data.data.suppliers || []);
    } catch (e) {
      console.error('Failed to load suppliers:', e);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (activeTab === 'stock') loadStock();
    else if (activeTab === 'purchases') loadPurchases();
    else if (activeTab === 'suppliers') loadSuppliers();
  }, [activeTab, loadStock, loadPurchases, loadSuppliers]);

  // Drawer batch & movements fetch
  async function openVariantDrawer(item) {
    setSelectedVariant(item);
    setLoadingDrawer(true);
    try {
      const res = await stockApi.getVariant(item.variantId);
      setVariantBatches(res.data.data.batches || []);
      setVariantMovements(res.data.data.movements || []);
    } catch (e) {
      console.error('Failed to load batch breakdown:', e);
    } finally {
      setLoadingDrawer(false);
    }
  }

  // Handle Stock Adjustment
  async function handleAdjustSubmit(e) {
    e.preventDefault();
    if (!adjustBatch) return;
    setAdjusting(true);
    setAdjustError('');
    try {
      await stockApi.adjust({
        batchId: adjustBatch._id,
        qty: Number(adjustForm.qty),
        direction: adjustForm.direction,
        reason: adjustForm.reason,
        notes: adjustForm.notes,
      });
      setShowAdjustModal(false);
      setAdjustForm({ qty: '', direction: 'decrease', reason: 'damaged', notes: '' });
      // Refresh drawer and stock list
      if (selectedVariant) openVariantDrawer(selectedVariant);
      loadStock();
    } catch (err) {
      setAdjustError(err.response?.data?.error?.message || 'Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  }

  // Handle Void Purchase
  async function handleVoidPurchase(e) {
    e.preventDefault();
    if (!selectedPurchase) return;
    setVoiding(true);
    setVoidError('');
    try {
      await purchasesApi.void(selectedPurchase._id, voidReason);
      setSelectedPurchase(null);
      setVoidReason('');
      loadPurchases();
      loadStock();
    } catch (err) {
      setVoidError(err.response?.data?.error?.message || 'Failed to void purchase');
    } finally {
      setVoiding(false);
    }
  }

  // Handle Supplier Create
  async function handleSupplierSubmit(e) {
    e.preventDefault();
    setSavingSupplier(true);
    setSupplierError('');
    try {
      await suppliersApi.create(supplierForm);
      setShowSupplierModal(false);
      setSupplierForm({ name: '', phone: '', gstin: '', address: '' });
      loadSuppliers();
    } catch (err) {
      setSupplierError(err.response?.data?.error?.message || 'Failed to create supplier');
    } finally {
      setSavingSupplier(false);
    }
  }

  // Handle Supplier Payment
  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!paymentSupplier) return;
    setPaying(true);
    setPaymentError('');
    try {
      await suppliersApi.recordPayment({
        supplierId: paymentSupplier._id,
        amountPaise: rupeesToPaise(Number(paymentForm.amount)),
        mode: paymentForm.mode,
        refNo: paymentForm.refNo,
      });
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', mode: 'cash', refNo: '' });
      loadSuppliers();
      loadPurchases();
    } catch (err) {
      setPaymentError(err.response?.data?.error?.message || 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight flex items-center gap-2">
            <Boxes className="w-7 h-7 text-primary" />
            Stock & Inventory
          </h1>
          <p className="text-muted text-sm mt-0.5">
            Physical stock batches, FEFO depletion, supplier invoices, and audit ledger
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-surface border border-border p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'stock'
                ? 'bg-primary text-primary-ink shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            Stock Batches
          </button>
          {isOwner && (
            <>
              <button
                onClick={() => setActiveTab('purchases')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'purchases'
                    ? 'bg-primary text-primary-ink shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                Purchases
              </button>
              <button
                onClick={() => setActiveTab('suppliers')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'suppliers'
                    ? 'bg-primary text-primary-ink shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                Suppliers
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STOCK BATCHES */}
      {/* ========================================================================= */}
      {activeTab === 'stock' && (
        <div className="space-y-5">
          {/* Mini Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-surface border border-border rounded-2xl p-4">
              <span className="text-xs text-muted font-medium">Total SKUs</span>
              <p className="text-xl sm:text-2xl font-black text-text mt-1">{stockStats.totalItems || 0}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <span className="text-xs text-warning font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
              </span>
              <p className="text-xl sm:text-2xl font-black text-warning mt-1">{stockStats.lowStockCount || 0}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <span className="text-xs text-yellow-400 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Expiring Soon
              </span>
              <p className="text-xl sm:text-2xl font-black text-yellow-400 mt-1">{stockStats.expiringSoonCount || 0}</p>
            </div>
            {isOwner && (
              <div className="bg-surface border border-border rounded-2xl p-4">
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Stock Value (Cost)
                </span>
                <p className="text-xl sm:text-2xl font-black text-primary mt-1">
                  {formatINR(stockStats.totalStockValuePaise || 0)}
                </p>
              </div>
            )}
          </div>

          {/* Search & Filter Chips */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search inventory by product, brand, SKU, or barcode..."
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {[
                { id: 'all', label: 'All Stock' },
                { id: 'low_stock', label: 'Low Stock' },
                { id: 'out_of_stock', label: 'Out of Stock' },
                { id: 'expiring_60d', label: 'Expiring <60d' },
                { id: 'expired', label: 'Expired' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setStockFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    stockFilter === chip.id
                      ? 'bg-primary text-primary-ink'
                      : 'bg-surface border border-border text-muted hover:text-text'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            {loadingStock ? (
              <div className="p-8 text-center text-muted">Loading inventory items...</div>
            ) : stockItems.length === 0 ? (
              <div className="p-12 text-center text-muted">
                <Boxes className="w-10 h-10 mx-auto text-muted/30 mb-2" />
                <p className="font-semibold text-text">No inventory items found</p>
                <p className="text-xs text-muted mt-1">Try clearing your filters or inward new stock from Purchases.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-elevated/50 text-xs font-semibold text-muted uppercase tracking-wider">
                      <th className="p-4">Product / Variant</th>
                      <th className="p-4">SKU & Barcode</th>
                      <th className="p-4 text-center">Batches</th>
                      <th className="p-4 text-center">Available Stock</th>
                      <th className="p-4">Nearest Expiry</th>
                      {isOwner && <th className="p-4 text-right">Stock Value</th>}
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {stockItems.map((item) => {
                      const isLow = item.status === 'low_stock';
                      const isOut = item.status === 'out_of_stock';
                      const isExp = item.expiryStatus === 'expired';
                      const isNearExp = item.expiryStatus === 'expiring_30d' || item.expiryStatus === 'expiring_60d';

                      return (
                        <tr
                          key={item.variantId}
                          onClick={() => openVariantDrawer(item)}
                          className="hover:bg-surface-strong/60 transition-colors cursor-pointer"
                        >
                          <td className="p-4">
                            <p className="font-bold text-text">{item.productName}</p>
                            <p className="text-xs text-muted">
                              {item.brand} • {item.flavour} ({item.size})
                            </p>
                          </td>
                          <td className="p-4 text-xs font-mono text-muted">
                            <p>{item.sku}</p>
                            {item.barcode && <p className="text-muted/60">{item.barcode}</p>}
                          </td>
                          <td className="p-4 text-center font-mono text-xs text-text">{item.batchCount}</td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isOut
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : isLow
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-primary/10 text-primary border border-primary/20'
                              }`}
                            >
                              {item.stock} units
                            </span>
                          </td>
                          <td className="p-4">
                            {item.nearestExpiry ? (
                              <span
                                className={`text-xs font-medium flex items-center gap-1 ${
                                  isExp
                                    ? 'text-red-400 font-bold'
                                    : isNearExp
                                    ? 'text-yellow-400'
                                    : 'text-text'
                                }`}
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(item.nearestExpiry).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            ) : (
                              <span className="text-xs text-muted">N/A</span>
                            )}
                          </td>
                          {isOwner && (
                            <td className="p-4 text-right font-mono font-bold text-text">
                              {formatINR(item.stockValuePaise || 0)}
                            </td>
                          )}
                          <td className="p-4 text-center">
                            <ChevronRight className="w-4 h-4 text-muted mx-auto" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: BATCH DETAILS & AUDIT MOVEMENTS */}
      {/* ========================================================================= */}
      {selectedVariant && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-bg-elevated border-l border-border w-full max-w-xl h-full flex flex-col p-6 overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-text">{selectedVariant.productName}</h2>
                <p className="text-xs text-muted">
                  {selectedVariant.flavour} ({selectedVariant.size}) • {selectedVariant.sku}
                </p>
              </div>
              <button
                onClick={() => setSelectedVariant(null)}
                className="p-1.5 rounded-xl hover:bg-surface text-muted hover:text-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDrawer ? (
              <div className="py-12 text-center text-muted">Loading batch breakdown...</div>
            ) : (
              <div className="space-y-6 mt-4 flex-1">
                {/* Active Batches Section */}
                <div>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Active Stock Batches (FEFO Order)
                  </h3>
                  {variantBatches.length === 0 ? (
                    <p className="text-xs text-muted">No active batches in inventory.</p>
                  ) : (
                    <div className="space-y-2">
                      {variantBatches.map((b) => (
                        <div
                          key={b._id}
                          className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-text">{b.batchNo}</span>
                              {b.expiryDate && (
                                <span className="text-xs text-muted flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Exp: {new Date(b.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                              Qty Left: <strong className="text-text">{b.qtyLeft}</strong> / {b.qtyReceived}
                              {isOwner && b.unitCostPaise != null && (
                                <> • Cost: <strong>{formatINR(b.unitCostPaise)}</strong></>
                              )}
                            </p>
                          </div>
                          {isOwner && (
                            <button
                              onClick={() => {
                                setAdjustBatch(b);
                                setShowAdjustModal(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-strong border border-border text-xs font-semibold text-text hover:text-primary transition-all"
                            >
                              Adjust
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stock Movement Audit Trail */}
                <div>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Recent Stock Movements (Audit Trail)
                  </h3>
                  {variantMovements.length === 0 ? (
                    <p className="text-xs text-muted">No movements recorded yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {variantMovements.map((m) => (
                        <div
                          key={m._id}
                          className="bg-surface/50 border border-border/60 rounded-lg p-2.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {m.qty > 0 ? (
                              <ArrowDownLeft className="w-4 h-4 text-primary shrink-0" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-warning shrink-0" />
                            )}
                            <div>
                              <p className="font-semibold text-text capitalize">
                                {m.type.replace('_', ' ')}: {m.qty > 0 ? `+${m.qty}` : m.qty} units
                              </p>
                              <p className="text-muted/60 text-[10px]">
                                {new Date(m.createdAt).toLocaleString('en-IN')} by {m.createdBy?.name || 'User'}
                              </p>
                            </div>
                          </div>
                          <span className="font-mono text-muted text-[11px]">Bal: {m.balanceAfter}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL STOCK ADJUSTMENT */}
      {/* ========================================================================= */}
      {showAdjustModal && adjustBatch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-text">Adjust Batch {adjustBatch.batchNo}</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjustError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustForm((f) => ({ ...f, direction: 'decrease' }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      adjustForm.direction === 'decrease'
                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-surface border-border text-muted'
                    }`}
                  >
                    Decrease (Damaged / Lost)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustForm((f) => ({ ...f, direction: 'increase' }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      adjustForm.direction === 'increase'
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'bg-surface border-border text-muted'
                    }`}
                  >
                    Increase (Count Correction)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustForm.qty}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, qty: e.target.value }))}
                  placeholder="e.g. 2"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Reason
                </label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="damaged">Damaged stock</option>
                  <option value="expired">Expired stock</option>
                  <option value="lost">Lost / Misplaced</option>
                  <option value="counting_correction">Physical inventory recount</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Audit Notes
                </label>
                <input
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional details for audit log..."
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting || !adjustForm.qty}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 disabled:opacity-50"
                >
                  {adjusting ? 'Adjusting...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PURCHASES (OWNER ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'purchases' && isOwner && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Inward Purchase Invoices</h2>
            <button
              onClick={() => {
                // Fetch products for picker
                productsApi.list({ limit: 100 }).then((r) => setProductsCache(r.data.data.products || []));
                setShowNewPurchase(true);
              }}
              className="flex items-center gap-2 bg-primary text-primary-ink font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Inward Purchase
            </button>
          </div>

          {loadingPurchases ? (
            <div className="p-8 text-center text-muted">Loading purchase invoices...</div>
          ) : purchases.length === 0 ? (
            <div className="p-12 text-center text-muted bg-surface border border-border rounded-2xl">
              <Truck className="w-10 h-10 mx-auto text-muted/30 mb-2" />
              <p className="font-semibold text-text">No purchases recorded</p>
              <p className="text-xs text-muted mt-1">Inward your first stock invoice from a supplier.</p>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-elevated/50 text-xs font-semibold text-muted uppercase tracking-wider">
                      <th className="p-4">Purchase No</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Supplier Inv No</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4 text-right">Due Balance</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {purchases.map((p) => (
                      <tr key={p._id} className="hover:bg-surface-strong/60 transition-colors">
                        <td className="p-4 font-mono font-bold text-text">{p.purchaseNo}</td>
                        <td className="p-4 font-medium text-text">{p.supplierId?.name || 'Supplier'}</td>
                        <td className="p-4 font-mono text-muted">{p.supplierInvoiceNo}</td>
                        <td className="p-4 text-muted text-xs">
                          {new Date(p.invoiceDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-text">{formatINR(p.totalPaise)}</td>
                        <td className="p-4 text-right font-mono font-bold text-warning">{formatINR(p.duePaise)}</td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              p.status === 'voided'
                                ? 'bg-red-500/10 text-red-400'
                                : p.paymentStatus === 'paid'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {p.status === 'voided' ? 'Voided' : p.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setSelectedPurchase(p)}
                            className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-text"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NEW PURCHASE INWARD */}
      {/* ========================================================================= */}
      {showNewPurchase && (
        <NewPurchaseModal
          suppliers={suppliers}
          products={productsCache}
          onClose={() => setShowNewPurchase(false)}
          onSuccess={() => {
            setShowNewPurchase(false);
            loadPurchases();
            loadStock();
          }}
          onAddSupplier={() => setShowSupplierModal(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: PURCHASE DETAILS & VOID */}
      {/* ========================================================================= */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-text">{selectedPurchase.purchaseNo}</h3>
                <p className="text-xs text-muted">
                  Supplier: {selectedPurchase.supplierId?.name} • Inv: {selectedPurchase.supplierInvoiceNo}
                </p>
              </div>
              <button onClick={() => setSelectedPurchase(null)} className="text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            {voidError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {voidError}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted uppercase">Inward Items</h4>
              {selectedPurchase.items?.map((it, idx) => (
                <div key={idx} className="bg-surface border border-border rounded-xl p-3 text-xs flex justify-between">
                  <div>
                    <p className="font-bold text-text">{it.nameSnapshot}</p>
                    <p className="text-muted">
                      {it.flavour} ({it.size}) • Batch: {it.batchNo}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-text">
                      {it.qty} × {formatINR(it.unitCostPaise)}
                    </p>
                    <p className="text-muted">{formatINR(it.lineTotalPaise)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-surface/60 rounded-xl p-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between text-muted">
                <span>Subtotal (Excl GST):</span>
                <span>{formatINR(selectedPurchase.subtotalPaise)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>GST:</span>
                <span>{formatINR(selectedPurchase.gstPaise)}</span>
              </div>
              <div className="flex justify-between font-bold text-text text-sm pt-1 border-t border-border">
                <span>Total Invoice:</span>
                <span>{formatINR(selectedPurchase.totalPaise)}</span>
              </div>
              <div className="flex justify-between text-warning font-bold">
                <span>Balance Due:</span>
                <span>{formatINR(selectedPurchase.duePaise)}</span>
              </div>
            </div>

            {selectedPurchase.status !== 'voided' && (
              <form onSubmit={handleVoidPurchase} className="pt-3 border-t border-border space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">
                    Void Purchase Reason (Owner Only)
                  </label>
                  <input
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    required
                    placeholder="Enter reason to void this inward..."
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-red-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={voiding || !voidReason.trim()}
                  className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/30 disabled:opacity-50"
                >
                  {voiding ? 'Voiding...' : 'Void Inward Invoice'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SUPPLIERS (OWNER ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && isOwner && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Wholesale Vendors & Suppliers</h2>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="flex items-center gap-2 bg-primary text-primary-ink font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          </div>

          {loadingSuppliers ? (
            <div className="p-8 text-center text-muted">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="p-12 text-center text-muted bg-surface border border-border rounded-2xl">
              <Truck className="w-10 h-10 mx-auto text-muted/30 mb-2" />
              <p className="font-semibold text-text">No suppliers registered</p>
              <p className="text-xs text-muted mt-1">Register suppliers to track purchase inwards and dues.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {suppliers.map((s) => (
                <div key={s._id} className="bg-surface border border-border rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-text text-base">{s.name}</h3>
                    <p className="text-xs text-muted mt-0.5">{s.phone}</p>
                    {s.gstin && <p className="text-xs text-muted font-mono mt-0.5">GSTIN: {s.gstin}</p>}
                    {s.address && <p className="text-xs text-muted/60 mt-1 line-clamp-2">{s.address}</p>}
                  </div>
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => {
                        setPaymentSupplier(s);
                        setShowPaymentModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
                    >
                      Record Payment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD SUPPLIER */}
      {/* ========================================================================= */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-text">Register New Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            {supplierError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {supplierError}
              </div>
            )}

            <form onSubmit={handleSupplierSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Supplier Name
                </label>
                <input
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Bright Commodities Pvt Ltd"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Phone</label>
                <input
                  required
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="10-digit mobile number"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  value={supplierForm.gstin}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, gstin: e.target.value }))}
                  placeholder="e.g. 27AABCC1234D1Z5"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Address (Optional)
                </label>
                <input
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Warehouse / city"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 disabled:opacity-50"
                >
                  {savingSupplier ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD SUPPLIER PAYMENT */}
      {/* ========================================================================= */}
      {showPaymentModal && paymentSupplier && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="font-bold text-text">Pay Supplier</h3>
                <p className="text-xs text-muted">{paymentSupplier.name}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {paymentError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 15000"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Mode</label>
                <select
                  value={paymentForm.mode}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, mode: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR</option>
                  <option value="bank">Bank Transfer / NEFT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Reference / Note (Optional)
                </label>
                <input
                  value={paymentForm.refNo}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, refNo: e.target.value }))}
                  placeholder="UTR / Cheque / Note"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying || !paymentForm.amount}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 disabled:opacity-50"
                >
                  {paying ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helper Component: New Purchase Modal
// -----------------------------------------------------------------------------
function NewPurchaseModal({ suppliers, products, onClose, onSuccess, onAddSupplier }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?._id || '');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([
    {
      productId: '',
      variantId: '',
      qty: 1,
      unitCostRupees: '',
      gstRate: 18,
      batchNo: '',
      expiryMonth: '',
    },
  ]);
  const [paidRupees, setPaidRupees] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [refNo, setRefNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Item helpers
  function setItemField(idx, field, val) {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };

      // If productId changed, select first variant
      if (field === 'productId') {
        const prod = products.find((p) => p._id === val);
        if (prod && prod.variants.length > 0) {
          copy[idx].variantId = prod.variants[0]._id;
          copy[idx].gstRate = prod.gstRate || 18;
          copy[idx].unitCostRupees = prod.variants[0].purchasePrice ? paiseToRupees(prod.variants[0].purchasePrice) : '';
        }
      }
      return copy;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        productId: products[0]?._id || '',
        variantId: products[0]?.variants[0]?._id || '',
        qty: 1,
        unitCostRupees: '',
        gstRate: 18,
        batchNo: '',
        expiryMonth: '',
      },
    ]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // Calculated totals
  const subtotalPaise = items.reduce((sum, it) => {
    const q = Number(it.qty) || 0;
    const cost = rupeesToPaise(Number(it.unitCostRupees) || 0);
    return sum + q * cost;
  }, 0);

  const gstPaise = items.reduce((sum, it) => {
    const q = Number(it.qty) || 0;
    const cost = rupeesToPaise(Number(it.unitCostRupees) || 0);
    const lineTaxable = q * cost;
    return sum + Math.round(lineTaxable * ((Number(it.gstRate) || 0) / 100));
  }, 0);

  const totalPaise = subtotalPaise + gstPaise;
  const initialPaidPaise = Math.min(rupeesToPaise(Number(paidRupees) || 0), totalPaise);
  const duePaise = totalPaise - initialPaidPaise;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supplierId) {
      setError('Please select or add a supplier');
      return;
    }
    if (!supplierInvoiceNo.trim()) {
      setError('Supplier invoice number is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        supplierId,
        supplierInvoiceNo,
        invoiceDate,
        paidPaise: initialPaidPaise,
        paymentMode,
        refNo,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          qty: Number(it.qty),
          unitCostPaise: rupeesToPaise(Number(it.unitCostRupees)),
          gstRate: Number(it.gstRate),
          batchNo: it.batchNo.trim(),
          expiryDate: it.expiryMonth ? `${it.expiryMonth}-01` : null,
        })),
      };

      await purchasesApi.create(payload);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to inward purchase');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-3xl p-6 space-y-4 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-bold text-text text-lg flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Inward Stock Purchase
          </h3>
          <button onClick={onClose} className="text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supplier & Invoice Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Supplier</label>
                <button
                  type="button"
                  onClick={onAddSupplier}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  + New
                </button>
              </div>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              >
                {suppliers.length === 0 && <option value="">No suppliers found</option>}
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Supplier Invoice No
              </label>
              <input
                required
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2026-981"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Invoice Date</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Inward Line Items</span>
              <button
                type="button"
                onClick={addItem}
                className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            {items.map((it, idx) => {
              const prod = products.find((p) => p._id === it.productId);
              return (
                <div key={idx} className="bg-surface border border-border rounded-xl p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">Product</label>
                      <select
                        required
                        value={it.productId}
                        onChange={(e) => setItemField(idx, 'productId', e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                      >
                        <option value="">Select product...</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.brand})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">Variant</label>
                      <select
                        required
                        value={it.variantId}
                        onChange={(e) => setItemField(idx, 'variantId', e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                      >
                        {prod?.variants?.map((v) => (
                          <option key={v._id} value={v._id}>
                            {v.flavour} ({v.size}) • SKU: {v.sku}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">Qty</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={it.qty}
                        onChange={(e) => setItemField(idx, 'qty', e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">Cost/Unit (₹ Excl)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={it.unitCostRupees}
                        onChange={(e) => setItemField(idx, 'unitCostRupees', e.target.value)}
                        placeholder="2200"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">GST%</label>
                      <select
                        value={it.gstRate}
                        onChange={(e) => setItemField(idx, 'gstRate', e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                      >
                        {[0, 5, 12, 18, 28].map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">Batch No</label>
                      <input
                        required
                        value={it.batchNo}
                        onChange={(e) => setItemField(idx, 'batchNo', e.target.value)}
                        placeholder="MB-2026-X"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary font-mono uppercase"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-muted mb-0.5">Expiry (MM/YYYY)</label>
                        <input
                          type="month"
                          value={it.expiryMonth}
                          onChange={(e) => setItemField(idx, 'expiryMonth', e.target.value)}
                          className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                        />
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-muted hover:text-red-400 p-1 mt-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals & Payment Section */}
          <div className="bg-surface border border-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between text-muted">
                <span>Subtotal (Excl GST):</span>
                <span>{formatINR(subtotalPaise)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Total GST:</span>
                <span>{formatINR(gstPaise)}</span>
              </div>
              <div className="flex justify-between font-bold text-text text-sm pt-1 border-t border-border">
                <span>Total Payable:</span>
                <span>{formatINR(totalPaise)}</span>
              </div>
              <div className="flex justify-between font-bold text-warning">
                <span>Remaining Due:</span>
                <span>{formatINR(duePaise)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-muted mb-0.5">Paid Now (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={paidRupees}
                    onChange={(e) => setPaidRupees(e.target.value)}
                    placeholder="0"
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-0.5">Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || items.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Recording Inward...' : 'Confirm Purchase Inward'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
