import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Sparkles,
  Layers,
  ShieldAlert,
  Check,
  Edit2,
} from 'lucide-react';
import { stockApi, purchasesApi, suppliersApi } from '../api/stock.js';
import { productsApi, categoriesApi, brandsApi } from '../api/products.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatINR, paiseToRupees, rupeesToPaise } from '../utils/money.js';
import { MonthYearPicker } from '../components/stock/MonthYearPicker.jsx';
import { NewProductInlinePanel } from '../components/stock/NewProductInlinePanel.jsx';
import { NewVariantInlinePanel } from '../components/stock/NewVariantInlinePanel.jsx';

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

  // Products, Categories and Brands Cache for Purchase Inward
  const [searchParams] = useSearchParams();
  const [productsCache, setProductsCache] = useState([]);
  const [categoriesCache, setCategoriesCache] = useState([]);
  const [brandsCache, setBrandsCache] = useState([]);

  const loadPurchaseCatalogs = useCallback(async () => {
    if (!isOwner) return;
    try {
      const [pRes, cRes, bRes] = await Promise.all([
        productsApi.list({ limit: 150 }),
        categoriesApi.list(),
        brandsApi.list(),
      ]);
      setProductsCache(pRes.data?.data?.products || []);
      setCategoriesCache(cRes.data?.data?.categories || []);
      setBrandsCache(bRes.data?.data?.brands || []);
    } catch (e) {
      console.error('Failed to load purchase catalogs:', e);
    }
  }, [isOwner]);

  useEffect(() => {
    loadPurchaseCatalogs();
  }, [loadPurchaseCatalogs]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const actionParam = searchParams.get('action');
    if (tabParam === 'purchases' || actionParam === 'new') {
      setActiveTab('purchases');
      if (actionParam === 'new') {
        setShowNewPurchase(true);
      }
    }
  }, [searchParams]);

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
                          className="bg-[#0D140F] border border-border rounded-lg p-2.5 flex items-center justify-between text-xs"
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
          categories={categoriesCache}
          brands={brandsCache}
          onClose={() => setShowNewPurchase(false)}
          onSuccess={() => {
            setShowNewPurchase(false);
            loadPurchases();
            loadStock();
            loadPurchaseCatalogs();
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

            <div className="bg-[#0D140F] border border-border rounded-xl p-3.5 text-xs space-y-1.5 font-mono">
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
// Helper Component: Product Search & Combobox Picker
// -----------------------------------------------------------------------------
function ProductSearchPicker({
  valueProductId,
  valueTempProductId,
  selectedLabel,
  isNewProduct,
  products = [],
  newProducts = [],
  onSelectExisting,
  onSelectNewProduct,
  onOpenNewProductModal,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanQuery = query.trim().toLowerCase();

  // Filter existing products
  const matchingExisting = products.filter((p) => {
    if (!cleanQuery) return true;
    const matchName = p.name?.toLowerCase().includes(cleanQuery);
    const matchBrand = p.brand?.toLowerCase().includes(cleanQuery);
    const matchBarcode = p.variants?.some((v) => v.barcode?.toLowerCase().includes(cleanQuery));
    return matchName || matchBrand || matchBarcode;
  });

  // Filter new products in draft
  const matchingNew = newProducts.filter((p) => {
    if (!cleanQuery) return true;
    return p.name?.toLowerCase().includes(cleanQuery) || p.brand?.toLowerCase().includes(cleanQuery);
  });

  // Check if query is an exact barcode match
  const exactBarcodeMatch = cleanQuery
    ? products
        .flatMap((p) =>
          p.variants
            ?.filter((v) => v.barcode?.toLowerCase() === cleanQuery)
            .map((v) => ({ product: p, variant: v }))
        )[0]
    : null;

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        onClick={() => setOpen(true)}
        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
      >
        <span className={selectedLabel ? 'font-medium text-text truncate' : 'text-muted/60'}>
          {selectedLabel || 'Select or search product / barcode...'}
        </span>
        {isNewProduct ? (
          <span className="bg-primary/20 text-primary text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-primary/30 shrink-0 ml-1.5">
            NEW
          </span>
        ) : (
          <Search className="w-3.5 h-3.5 text-muted shrink-0 ml-1.5" />
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-bg-elevated border border-border rounded-xl shadow-2xl z-50 p-2 space-y-2 max-h-72 overflow-y-auto">
          {/* Search / Barcode Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type product name, brand or barcode..."
              className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
            />
          </div>

          {/* Barcode Quick Jump If Matched */}
          {exactBarcodeMatch && (
            <div
              onClick={() => {
                onSelectExisting(exactBarcodeMatch.product, exactBarcodeMatch.variant);
                setOpen(false);
              }}
              className="p-2 rounded-lg bg-primary/10 border border-primary/30 cursor-pointer hover:bg-primary/20 flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-bold text-primary">Exact Barcode Match Found:</p>
                <p className="text-xs font-semibold text-text">
                  {exactBarcodeMatch.product.name} ({exactBarcodeMatch.product.brand})
                </p>
                <p className="text-[10px] text-muted">
                  Variant: {exactBarcodeMatch.variant.flavour} {exactBarcodeMatch.variant.size}
                </p>
              </div>
              <span className="text-[10px] font-bold text-primary px-2 py-1 bg-primary/20 rounded">Select</span>
            </div>
          )}

          {/* New Products in Current Inward Draft */}
          {matchingNew.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block px-1">
                New Products In Draft
              </span>
              {matchingNew.map((np) => (
                <div
                  key={np.tempProductId}
                  onClick={() => {
                    onSelectNewProduct(np);
                    setOpen(false);
                  }}
                  className="p-2 rounded-lg hover:bg-surface cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="truncate">
                    <span className="font-bold text-text">{np.name}</span>{' '}
                    <span className="text-muted">({np.brand})</span>
                  </div>
                  <span className="bg-primary/20 text-primary text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-primary/30">
                    NEW
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Existing Products from Catalogue */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block px-1">
              Existing Catalogue ({matchingExisting.length})
            </span>
            {matchingExisting.slice(0, 20).map((p) => (
              <div
                key={p._id}
                onClick={() => {
                  onSelectExisting(p, p.variants?.[0]);
                  setOpen(false);
                }}
                className={`p-2 rounded-lg hover:bg-surface cursor-pointer flex items-center justify-between text-xs transition-colors ${
                  valueProductId === p._id ? 'bg-primary/10 border border-primary/20' : ''
                }`}
              >
                <div className="truncate">
                  <span className="font-semibold text-text">{p.name}</span>{' '}
                  <span className="text-muted">({p.brand})</span>
                </div>
                <span className="text-[10px] text-muted font-mono">{p.variants?.length || 0} variants</span>
              </div>
            ))}
          </div>

          {/* Zero Results / Barcode Match Nothing */}
          {matchingExisting.length === 0 && matchingNew.length === 0 && query.trim() && (
            <div
              onClick={() => {
                onOpenNewProductModal({ name: query.trim() });
                setOpen(false);
              }}
              className="p-2.5 rounded-lg bg-surface border border-primary/30 hover:bg-primary/10 cursor-pointer text-xs flex items-center gap-2 text-primary font-bold"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Create new product: "{query.trim()}"</span>
            </div>
          )}

          {/* Fixed Bottom Action: + New product */}
          <div className="pt-1 border-t border-border">
            <button
              type="button"
              onClick={() => {
                onOpenNewProductModal(query.trim() ? { name: query.trim() } : {});
                setOpen(false);
              }}
              className="w-full py-2 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-primary/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New product</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component: One-Step Inward Purchase Modal
// -----------------------------------------------------------------------------
function NewPurchaseModal({
  suppliers = [],
  products = [],
  categories = [],
  brands = [],
  onClose,
  onSuccess,
  onAddSupplier,
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?._id || '');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paidRupees, setPaidRupees] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [refNo, setRefNo] = useState('');

  // New products and new variants drafted in this purchase inward
  const [newProducts, setNewProducts] = useState([]);
  const [newVariants, setNewVariants] = useState([]);

  // Inward line items
  const [items, setItems] = useState([
    {
      productId: products[0]?._id || '',
      variantId: products[0]?.variants?.[0]?._id || '',
      tempProductId: null,
      tempVariantId: null,
      productName: products[0]?.name || '',
      brand: products[0]?.brand || '',
      variantLabel: products[0]?.variants?.[0]
        ? `${products[0].variants[0].flavour || ''} ${products[0].variants[0].size || ''}`.trim() || 'Standard'
        : 'Standard',
      flavour: products[0]?.variants?.[0]?.flavour || '',
      size: products[0]?.variants?.[0]?.size || '',
      barcode: products[0]?.variants?.[0]?.barcode || '',
      isNewProduct: false,
      isNewVariant: false,
      qty: 1,
      unitCostRupees: products[0]?.variants?.[0]?.purchasePrice
        ? paiseToRupees(products[0].variants[0].purchasePrice)
        : '',
      gstRate: products[0]?.gstRate ?? 18,
      batchNo: '',
      expiryMonth: '',
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);

  // Sub-panels
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductInitialData, setNewProductInitialData] = useState({});
  const [newVariantTargetProduct, setNewVariantTargetProduct] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 1. Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chava_inward_purchase_draft');
      if (saved) {
        const d = JSON.parse(saved);
        if (d.supplierId) setSupplierId(d.supplierId);
        if (d.supplierInvoiceNo) setSupplierInvoiceNo(d.supplierInvoiceNo);
        if (d.invoiceDate) setInvoiceDate(d.invoiceDate);
        if (d.paidRupees !== undefined) setPaidRupees(d.paidRupees);
        if (d.paymentMode) setPaymentMode(d.paymentMode);
        if (d.refNo) setRefNo(d.refNo);
        if (Array.isArray(d.newProducts)) setNewProducts(d.newProducts);
        if (Array.isArray(d.newVariants)) setNewVariants(d.newVariants);
        if (Array.isArray(d.items) && d.items.length > 0) {
          const npList = Array.isArray(d.newProducts) ? d.newProducts : [];
          const hydratedItems = d.items.map((it) => {
            if (it.tempProductId && (!it.productName || !it.brand)) {
              const matchedNp = npList.find((np) => np.tempProductId === it.tempProductId);
              if (matchedNp) {
                return {
                  ...it,
                  productName: it.productName || matchedNp.name,
                  brand: it.brand || matchedNp.brand,
                };
              }
            }
            return it;
          });
          setItems(hydratedItems);
        }
        setDraftRestored(true);
      }
    } catch (e) {
      console.warn('Failed to parse draft from localStorage', e);
    }
  }, []);

  // 2. Autosave draft on change
  useEffect(() => {
    const timer = setTimeout(() => {
      const draftPayload = {
        supplierId,
        supplierInvoiceNo,
        invoiceDate,
        paidRupees,
        paymentMode,
        refNo,
        newProducts,
        newVariants,
        items,
      };
      localStorage.setItem('chava_inward_purchase_draft', JSON.stringify(draftPayload));
    }, 400);

    return () => clearTimeout(timer);
  }, [supplierId, supplierInvoiceNo, invoiceDate, paidRupees, paymentMode, refNo, newProducts, newVariants, items]);

  function handleDiscardDraft() {
    localStorage.removeItem('chava_inward_purchase_draft');
    setNewProducts([]);
    setNewVariants([]);
    setItems([
      {
        productId: products[0]?._id || '',
        variantId: products[0]?.variants?.[0]?._id || '',
        tempProductId: null,
        tempVariantId: null,
        productName: products[0]?.name || '',
        brand: products[0]?.brand || '',
        variantLabel: 'Standard',
        flavour: '',
        size: '',
        barcode: '',
        isNewProduct: false,
        isNewVariant: false,
        qty: 1,
        unitCostRupees: '',
        gstRate: 18,
        batchNo: '',
        expiryMonth: '',
      },
    ]);
    setSupplierInvoiceNo('');
    setPaidRupees('');
    setDraftRestored(false);
  }

  // Add Row
  function handleAddRow() {
    const firstProd = products[0];
    const firstVar = firstProd?.variants?.[0];
    setItems((prev) => [
      ...prev,
      {
        productId: firstProd?._id || '',
        variantId: firstVar?._id || '',
        tempProductId: null,
        tempVariantId: null,
        productName: firstProd?.name || '',
        brand: firstProd?.brand || '',
        variantLabel: firstVar
          ? `${firstVar.flavour || ''} ${firstVar.size || ''}`.trim() || 'Standard'
          : 'Standard',
        flavour: firstVar?.flavour || '',
        size: firstVar?.size || '',
        barcode: firstVar?.barcode || '',
        isNewProduct: false,
        isNewVariant: false,
        qty: 1,
        unitCostRupees: firstVar?.purchasePrice ? paiseToRupees(firstVar.purchasePrice) : '',
        gstRate: firstProd?.gstRate ?? 18,
        batchNo: '',
        expiryMonth: '',
      },
    ]);
  }

  // Remove Row (cleans up newProduct if it was the last line)
  function handleRemoveRow(idx) {
    const target = items[idx];
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);

    if (target.tempProductId) {
      const stillHasLines = newItems.some((it) => it.tempProductId === target.tempProductId);
      if (!stillHasLines) {
        setNewProducts((prev) => prev.filter((np) => np.tempProductId !== target.tempProductId));
      }
    }
    if (target.tempVariantId) {
      const stillHasLines = newItems.some((it) => it.tempVariantId === target.tempVariantId);
      if (!stillHasLines) {
        setNewVariants((prev) => prev.filter((nv) => nv.tempVariantId !== target.tempVariantId));
      }
    }
  }

  function handleItemChange(idx, field, val) {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  }

  // Select existing product from search
  function handleSelectExisting(idx, prod, variant) {
    setItems((prev) => {
      const copy = [...prev];
      const targetVar = variant || prod.variants?.[0];
      copy[idx] = {
        ...copy[idx],
        productId: prod._id,
        variantId: targetVar?._id || '',
        tempProductId: null,
        tempVariantId: null,
        productName: prod.name,
        brand: prod.brand,
        variantLabel: targetVar
          ? `${targetVar.flavour || ''} ${targetVar.size || ''}`.trim() || 'Standard'
          : 'Standard',
        flavour: targetVar?.flavour || '',
        size: targetVar?.size || '',
        barcode: targetVar?.barcode || '',
        isNewProduct: false,
        isNewVariant: false,
        gstRate: prod.gstRate ?? 18,
        unitCostRupees: targetVar?.purchasePrice ? paiseToRupees(targetVar.purchasePrice) : copy[idx].unitCostRupees,
      };
      return copy;
    });
  }

  // Select draft new product
  function handleSelectNewProduct(idx, np) {
    const existingLines = items.filter((it) => it.tempProductId === np.tempProductId);
    const firstLine = existingLines[0];

    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        productId: null,
        variantId: null,
        tempProductId: np.tempProductId,
        tempVariantId: firstLine?.tempVariantId || `var_${Date.now()}`,
        productName: np.name,
        brand: np.brand,
        variantLabel: firstLine?.variantLabel || 'Standard',
        flavour: firstLine?.flavour || '',
        size: firstLine?.size || '',
        barcode: firstLine?.barcode || '',
        isNewProduct: true,
        isNewVariant: true,
        gstRate: np.gstRate ?? 18,
      };
      return copy;
    });
  }

  // Callback from NewProductInlinePanel
  function handleNewProductSaved({ product: np, variants: nvars }) {
    // Save to newProducts
    setNewProducts((prev) => {
      const filtered = prev.filter((p) => p.tempProductId !== np.tempProductId);
      return [...filtered, np];
    });

    // Create lines for all variants created
    const createdLines = nvars.map((v) => ({
      productId: null,
      variantId: null,
      tempProductId: np.tempProductId,
      tempVariantId: v.tempVariantId,
      productName: np.name,
      brand: np.brand,
      variantLabel: v.displayLabel || `${v.flavour || ''} ${v.size || ''}`.trim() || 'Standard',
      flavour: v.flavour || '',
      size: v.size || '',
      barcode: v.barcode || '',
      mrp: v.mrp,
      sellingPrice: v.sellingPrice,
      isNewProduct: true,
      isNewVariant: true,
      qty: v.qty || 1,
      unitCostRupees: v.unitCostRupees,
      gstRate: np.gstRate,
      batchNo: v.batchNo,
      expiryMonth: v.expiryMonth,
    }));

    // Replace placeholder first row or append
    setItems((prev) => {
      const isPlaceholder = prev.length === 1 && !prev[0].batchNo && !prev[0].tempProductId;
      if (isPlaceholder) {
        return createdLines;
      }
      return [...prev, ...createdLines];
    });

    setShowNewProductModal(false);
  }

  // Callback from NewVariantInlinePanel
  function handleNewVariantSaved(variantData) {
    setNewVariants((prev) => [...prev, variantData]);

    const newLine = {
      productId: variantData.productId,
      variantId: null,
      tempProductId: null,
      tempVariantId: variantData.tempVariantId,
      productName: variantData.productName,
      brand: variantData.brand,
      variantLabel: variantData.displayLabel || `${variantData.flavour || ''} ${variantData.size || ''}`.trim() || 'Standard',
      flavour: variantData.flavour,
      size: variantData.size,
      barcode: variantData.barcode,
      mrp: variantData.mrp,
      sellingPrice: variantData.sellingPrice,
      isNewProduct: false,
      isNewVariant: true,
      qty: variantData.qty,
      unitCostRupees: variantData.unitCostRupees,
      gstRate: variantData.gstRate,
      batchNo: variantData.batchNo,
      expiryMonth: variantData.expiryMonth,
    };

    setItems((prev) => [...prev, newLine]);
    setNewVariantTargetProduct(null);
  }

  // Totals calculations
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

  // Validation before opening confirm modal
  function handleInitiateSubmit(e) {
    e?.preventDefault();
    setError('');

    if (!supplierId) {
      setError('Please select or add a wholesale supplier');
      return;
    }
    if (!supplierInvoiceNo.trim()) {
      setError('Supplier invoice number is required');
      return;
    }
    if (items.length === 0) {
      setError('At least one inward item line is required');
      return;
    }

    // Validate all item lines
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const lineNum = i + 1;
      if (!it.productId && !it.tempProductId) {
        setError(`Line ${lineNum}: Please select a product or create a new product`);
        return;
      }
      if (Number(it.qty) < 1) {
        setError(`Line ${lineNum}: Quantity must be at least 1`);
        return;
      }
      if (it.unitCostRupees === '' || isNaN(Number(it.unitCostRupees)) || Number(it.unitCostRupees) < 0) {
        setError(`Line ${lineNum}: Valid unit cost (excl GST) is required`);
        return;
      }
      if (!it.batchNo?.trim()) {
        setError(`Line ${lineNum}: Batch number is required`);
        return;
      }
    }

    setShowConfirmModal(true);
  }

  // Final Atomic Save Request
  async function handleConfirmAtomicInward() {
    setSaving(true);
    setError('');

    try {
      const payload = {
        supplierId,
        supplierInvoiceNo: supplierInvoiceNo.trim(),
        invoiceDate,
        paidPaise: initialPaidPaise,
        paymentMode,
        refNo: refNo.trim(),
        idempotencyKey: `inward_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        newProducts: newProducts.map((p) => {
          const productLines = items.filter((it) => it.tempProductId === p.tempProductId);
          return {
            tempProductId: p.tempProductId,
            name: p.name.trim(),
            brand: p.brand.trim(),
            categoryId: p.category || p.categoryId,
            hsn: p.hsn ? p.hsn.trim() : '21069099',
            gstRate: Number(p.gstRate),
            lowStockLimit: Number(p.lowStockLimit) || 3,
            trackExpiry: p.trackExpiry !== false,
            variants: productLines.map((it) => ({
              tempId: it.tempVariantId,
              tempVariantId: it.tempVariantId,
              flavour: it.flavour || 'Standard',
              size: it.size || 'Standard',
              barcode: it.barcode ? it.barcode.trim() : null,
              mrp: it.mrp ? rupeesToPaise(it.mrp) : rupeesToPaise(Number(it.unitCostRupees) * 1.3),
              sellingPrice: it.sellingPrice
                ? rupeesToPaise(it.sellingPrice)
                : rupeesToPaise(Number(it.unitCostRupees) * 1.3),
            })),
          };
        }),
        newVariants: newVariants.map((v) => ({
          productId: v.productId,
          tempId: v.tempVariantId,
          tempVariantId: v.tempVariantId,
          flavour: v.flavour || 'Standard',
          size: v.size || 'Standard',
          barcode: v.barcode ? v.barcode.trim() : null,
          mrp: rupeesToPaise(v.mrp || 0),
          sellingPrice: rupeesToPaise(v.sellingPrice || 0),
        })),
        items: items.map((it) => ({
          productId: it.productId || undefined,
          variantId: it.variantId || undefined,
          tempProductId: it.tempProductId || undefined,
          tempVariantId: it.tempVariantId || undefined,
          qty: Number(it.qty),
          unitCostPaise: rupeesToPaise(Number(it.unitCostRupees)),
          gstRate: Number(it.gstRate),
          batchNo: it.batchNo.trim().toUpperCase(),
          expiryDate: it.expiryMonth ? `${it.expiryMonth}-01` : null,
        })),
      };

      await purchasesApi.create(payload);

      // On successful creation, wipe the draft
      localStorage.removeItem('chava_inward_purchase_draft');
      setShowConfirmModal(false);
      onSuccess();
    } catch (err) {
      setShowConfirmModal(false);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to record purchase inward. Please review errors.'
      );
    } finally {
      setSaving(false);
    }
  }

  // Count summaries for confirm dialog
  const totalUnits = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const selectedSupplier = suppliers.find((s) => s._id === supplierId);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-4xl p-4 sm:p-6 space-y-4 max-h-[94dvh] overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text text-base sm:text-lg">Inward Stock Purchase</h3>
                <span className="text-[10px] text-muted border border-border rounded-full px-2 py-0.5 font-mono">
                  ONE-STEP INWARD
                </span>
              </div>
              <p className="text-xs text-muted">Unified product creation &amp; stock receipt in one atomic invoice</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:text-text hover:bg-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Draft Notice */}
        {draftRestored && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs text-text flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-primary font-semibold">
              <Sparkles className="w-4 h-4 shrink-0" />
              Restored active draft from previous session
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-[11px] text-muted hover:text-red-400 font-semibold underline"
            >
              Discard Draft
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5 font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleInitiateSubmit} className="space-y-4 flex-1">
          {/* Supplier & Invoice Header Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Supplier <span className="text-red-400">*</span>
                </label>
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
                <option value="">Select Supplier...</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Supplier Invoice No <span className="text-red-400">*</span>
              </label>
              <input
                required
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2026-981"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Invoice Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Inward Line Items Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-primary" /> Inward Line Items ({items.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewProductModal(true)}
                  className="text-xs text-primary font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" /> + New Product
                </button>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-xs text-text font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>
            </div>

            {items.map((it, idx) => {
              const prod = products.find((p) => p._id === it.productId);
              const isNew = it.isNewProduct || it.isNewVariant;

              return (
                <div
                  key={idx}
                  className={`bg-surface border rounded-xl p-3 sm:p-4 space-y-3 transition-colors ${
                    it.isNewProduct ? 'border-primary/40 bg-primary/[0.02]' : 'border-border'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Product Search & Picker */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[11px] text-muted font-semibold">Product</label>
                        {it.isNewProduct && (
                          <span className="bg-primary/20 text-primary text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border border-primary/30">
                            NEW PRODUCT
                          </span>
                        )}
                      </div>
                      <ProductSearchPicker
                        valueProductId={it.productId}
                        valueTempProductId={it.tempProductId}
                        selectedLabel={
                          it.productName ? `${it.productName} (${it.brand})` : ''
                        }
                        isNewProduct={it.isNewProduct}
                        products={products}
                        newProducts={newProducts}
                        onSelectExisting={(p, v) => handleSelectExisting(idx, p, v)}
                        onSelectNewProduct={(np) => handleSelectNewProduct(idx, np)}
                        onOpenNewProductModal={(initial) => {
                          setNewProductInitialData(initial);
                          setShowNewProductModal(true);
                        }}
                      />
                    </div>

                    {/* Variant Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[11px] text-muted font-semibold">Variant / Flavour</label>
                        {prod && (
                          <button
                            type="button"
                            onClick={() => setNewVariantTargetProduct(prod)}
                            className="text-[10px] text-primary font-bold hover:underline"
                          >
                            + New flavour / size
                          </button>
                        )}
                      </div>

                      {it.isNewProduct || it.isNewVariant ? (
                        <div className="w-full bg-bg border border-primary/30 rounded-lg px-2.5 py-1.5 text-xs text-text flex items-center justify-between">
                          <span className="font-semibold text-text truncate">
                            {it.variantLabel || `${it.flavour || ''} ${it.size || ''}`.trim() || 'Standard'}
                          </span>
                          <span className="bg-primary/20 text-primary text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded">
                            {it.isNewProduct ? 'NEW' : 'NEW FLAVOUR'}
                          </span>
                        </div>
                      ) : (
                        <select
                          required
                          value={it.variantId}
                          onChange={(e) => {
                            if (e.target.value === '__NEW_VARIANT__') {
                              if (prod) setNewVariantTargetProduct(prod);
                            } else {
                              const foundVar = prod?.variants?.find((v) => v._id === e.target.value);
                              setItems((prev) => {
                                const copy = [...prev];
                                copy[idx] = {
                                  ...copy[idx],
                                  variantId: e.target.value,
                                  variantLabel: foundVar
                                    ? `${foundVar.flavour || ''} ${foundVar.size || ''}`.trim() || 'Standard'
                                    : 'Standard',
                                  flavour: foundVar?.flavour || '',
                                  size: foundVar?.size || '',
                                  barcode: foundVar?.barcode || '',
                                  unitCostRupees: foundVar?.purchasePrice
                                    ? paiseToRupees(foundVar.purchasePrice)
                                    : copy[idx].unitCostRupees,
                                };
                                return copy;
                              });
                            }
                          }}
                          className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                        >
                          {prod?.variants?.map((v) => (
                            <option key={v._id} value={v._id}>
                              {v.flavour} ({v.size}) • SKU: {v.sku}
                            </option>
                          ))}
                          <option value="__NEW_VARIANT__" className="text-primary font-bold">
                            + New flavour / size...
                          </option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Line Detail Inputs */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">Qty</label>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        required
                        value={it.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">Cost/Unit (₹ Excl)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        required
                        value={it.unitCostRupees}
                        onChange={(e) => handleItemChange(idx, 'unitCostRupees', e.target.value)}
                        placeholder="2200"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">GST%</label>
                      <select
                        value={it.gstRate}
                        onChange={(e) => handleItemChange(idx, 'gstRate', e.target.value)}
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
                        onChange={(e) => handleItemChange(idx, 'batchNo', e.target.value.toUpperCase())}
                        placeholder="MB-2026-X"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono uppercase"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-1">
                      <label className="block text-[11px] text-muted mb-0.5">Expiry (MM/YYYY)</label>
                      <MonthYearPicker
                        value={it.expiryMonth}
                        onChange={(val) => handleItemChange(idx, 'expiryMonth', val)}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-4">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-bg transition-colors"
                          title="Remove Line"
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
                    inputMode="decimal"
                    value={paidRupees}
                    onChange={(e) => setPaidRupees(e.target.value)}
                    placeholder="0"
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
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
          <div className="flex gap-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || items.length === 0}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Confirm Purchase Inward</span>
            </button>
          </div>
        </form>

        {/* Modal: Add New Product Inline Panel */}
        {showNewProductModal && (
          <NewProductInlinePanel
            initialData={newProductInitialData}
            categories={categories}
            brands={brands}
            onSave={handleNewProductSaved}
            onClose={() => setShowNewProductModal(false)}
            onSwitchToExisting={(existingProd) => {
              setShowNewProductModal(false);
              handleSelectExisting(items.length - 1, existingProd, existingProd.variants?.[0]);
            }}
          />
        )}

        {/* Modal: Add New Variant Inline Panel */}
        {newVariantTargetProduct && (
          <NewVariantInlinePanel
            product={newVariantTargetProduct}
            onSave={handleNewVariantSaved}
            onClose={() => setNewVariantTargetProduct(null)}
          />
        )}

        {/* Modal: Final Atomic Confirmation Summary */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-bg-elevated border border-primary/40 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h4 className="font-bold text-text text-base flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  Confirm Purchase Inward
                </h4>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="p-1 rounded-lg text-muted hover:text-text"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-surface rounded-xl p-3 space-y-1.5 border border-border">
                  <div className="flex justify-between">
                    <span className="text-muted">Supplier:</span>
                    <span className="font-bold text-text">{selectedSupplier?.name || 'Selected Supplier'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Invoice No:</span>
                    <span className="font-mono font-bold text-text">{supplierInvoiceNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Date:</span>
                    <span className="text-text">{invoiceDate}</span>
                  </div>
                </div>

                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 space-y-1 text-primary">
                  <p className="font-bold text-sm">
                    Creates {newProducts.length} new product{newProducts.length === 1 ? '' : 's'} &amp;{' '}
                    {newVariants.length} new variant{newVariants.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-text">
                    Receives <strong className="text-primary font-bold">{totalUnits} units</strong> across{' '}
                    {items.length} line item{items.length === 1 ? '' : 's'}.
                  </p>
                </div>

                <div className="bg-surface rounded-xl p-3 space-y-1 font-mono border border-border">
                  <div className="flex justify-between text-muted">
                    <span>Total Inward Value:</span>
                    <span className="font-bold text-text">{formatINR(totalPaise)}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Paid Now:</span>
                    <span>{formatINR(initialPaidPaise)}</span>
                  </div>
                  <div className="flex justify-between text-warning font-bold">
                    <span>Balance Due:</span>
                    <span>{formatINR(duePaise)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text"
                >
                  Back to Edit
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmAtomicInward}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                >
                  {saving ? 'Creating & Receiving...' : 'Confirm & Save Inward'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
