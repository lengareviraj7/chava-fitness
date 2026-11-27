import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  UserCheck,
  CreditCard,
  QrCode,
  DollarSign,
  Printer,
  Share2,
  CheckCircle,
  X,
  Tag,
  Clock,
  Sparkles,
  ShoppingBag,
  History,
  Lock,
} from 'lucide-react';
import { billingApi, customersApi } from '../api/billing.js';
import { productsApi, categoriesApi } from '../api/products.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatINR, paiseToRupees, rupeesToPaise } from '../utils/money.js';
import { ReturnModal } from '../components/billing/ReturnModal.jsx';
import { DayCloseTab } from '../components/billing/DayCloseTab.jsx';

export function BillingPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history' | 'dayClose'
  const [returnBill, setReturnBill] = useState(null);

  // Catalog State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Cart State
  const [cartItems, setCartItems] = useState([]);
  const [billDiscountType, setBillDiscountType] = useState('none'); // 'none' | 'pct' | 'amount'
  const [billDiscountValue, setBillDiscountValue] = useState('');

  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', gstin: '' });

  // Quote / Totals State
  const [quote, setQuote] = useState({
    subtotalPaise: 0,
    lineDiscountTotalPaise: 0,
    billDiscountPaise: 0,
    taxablePaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    totalGstPaise: 0,
    roundOffPaise: 0,
    grandTotalPaise: 0,
    savingsPaise: 0,
  });

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'upi' | 'card' | 'split'
  const [cashTendered, setCashTendered] = useState('');
  const [splitPayments, setSplitPayments] = useState({ cash: '', upi: '', card: '' });
  const [approvalPin, setApprovalPin] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Success / Receipt State
  const [completedBill, setCompletedBill] = useState(null);

  // History State
  const [billsHistory, setBillsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Barcode input ref
  const searchInputRef = useRef(null);

  // Load Products & Categories
  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.list({ search: searchQuery, category: selectedCat, limit: 100 }),
        categoriesApi.list(),
      ]);
      setProducts(prodRes.data.data.products || []);
      setCategories(catRes.data.data.categories || []);
    } catch (e) {
      console.error('Failed to load POS catalog:', e);
    } finally {
      setLoadingCatalog(false);
    }
  }, [searchQuery, selectedCat]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Load Bills History
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await billingApi.listBills({ limit: 50 });
      setBillsHistory(res.data.data.bills || []);
    } catch (e) {
      console.error('Failed to load bills:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  // Calculate Quote whenever cart or bill discount changes
  useEffect(() => {
    if (cartItems.length === 0) {
      setQuote({
        subtotalPaise: 0,
        lineDiscountTotalPaise: 0,
        billDiscountPaise: 0,
        taxablePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalGstPaise: 0,
        roundOffPaise: 0,
        grandTotalPaise: 0,
        savingsPaise: 0,
      });
      return;
    }

    const billDiscount =
      billDiscountType !== 'none' && Number(billDiscountValue) > 0
        ? {
            type: billDiscountType,
            value: billDiscountType === 'pct' ? Number(billDiscountValue) : rupeesToPaise(Number(billDiscountValue)),
          }
        : null;

    billingApi
      .getQuote({
        items: cartItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
          unitPricePaise: item.unitPricePaise,
          priceOverridden: item.priceOverridden,
          lineDiscount: item.lineDiscount,
        })),
        billDiscount,
      })
      .then((res) => {
        if (res.data.data.quote) setQuote(res.data.data.quote);
      })
      .catch((e) => console.error('Quote calculation error:', e));
  }, [cartItems, billDiscountType, billDiscountValue]);

  // Add Variant to Cart
  function addToCart(product, variant) {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.variantId === variant._id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].qty += 1;
        return copy;
      }
      return [
        ...prev,
        {
          productId: product._id,
          variantId: variant._id,
          name: product.name,
          brand: product.brand,
          flavour: variant.flavour,
          size: variant.size,
          sku: variant.sku,
          barcode: variant.barcode,
          mrpPaise: variant.mrp,
          unitPricePaise: variant.sellingPrice,
          priceOverridden: false,
          qty: 1,
          lineDiscount: null,
        },
      ];
    });
  }

  function updateQty(variantId, delta) {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.variantId === variantId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  }

  function removeFromCart(variantId) {
    setCartItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  // Barcode / Search handler
  function handleSearchKeyDown(e) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      // Match exact barcode
      for (const p of products) {
        for (const v of p.variants) {
          if (v.barcode && v.barcode.toLowerCase() === searchQuery.trim().toLowerCase()) {
            addToCart(p, v);
            setSearchQuery('');
            return;
          }
        }
      }
      // Or exact SKU
      for (const p of products) {
        for (const v of p.variants) {
          if (v.sku && v.sku.toLowerCase() === searchQuery.trim().toLowerCase()) {
            addToCart(p, v);
            setSearchQuery('');
            return;
          }
        }
      }
    }
  }

  // Customer search
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(() => {
      customersApi.list({ search: customerSearch.trim() }).then((res) => {
        setCustomerResults(res.data.data.customers || []);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  async function handleCreateCustomer(e) {
    e.preventDefault();
    try {
      const res = await customersApi.create(newCustomerForm);
      setSelectedCustomer(res.data.data.customer);
      setShowNewCustomerModal(false);
      setNewCustomerForm({ name: '', phone: '', gstin: '' });
      setCustomerSearch('');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to create customer');
    }
  }

  // Checkout Execution
  async function handleCheckout() {
    setCheckingOut(true);
    setCheckoutError('');

    try {
      const grandTotal = quote.grandTotalPaise;
      let payments = [];

      if (paymentMode === 'cash') {
        payments.push({ mode: 'cash', amountPaise: grandTotal, cashTenderedPaise: rupeesToPaise(Number(cashTendered) || 0) });
      } else if (paymentMode === 'upi') {
        payments.push({ mode: 'upi', amountPaise: grandTotal });
      } else if (paymentMode === 'card') {
        payments.push({ mode: 'card', amountPaise: grandTotal });
      } else if (paymentMode === 'split') {
        const c = rupeesToPaise(Number(splitPayments.cash) || 0);
        const u = rupeesToPaise(Number(splitPayments.upi) || 0);
        const cd = rupeesToPaise(Number(splitPayments.card) || 0);
        if (c > 0) payments.push({ mode: 'cash', amountPaise: c });
        if (u > 0) payments.push({ mode: 'upi', amountPaise: u });
        if (cd > 0) payments.push({ mode: 'card', amountPaise: cd });
      }

      const payload = {
        customerId: selectedCustomer?._id || null,
        items: cartItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          qty: it.qty,
          unitPricePaise: it.unitPricePaise,
          priceOverridden: it.priceOverridden,
          lineDiscount: it.lineDiscount,
        })),
        billDiscount:
          billDiscountType !== 'none' && Number(billDiscountValue) > 0
            ? {
                type: billDiscountType,
                value: billDiscountType === 'pct' ? Number(billDiscountValue) : rupeesToPaise(Number(billDiscountValue)),
              }
            : null,
        payments,
        approvalPin: approvalPin || null,
        idempotencyKey: 'pos-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      };

      const res = await billingApi.checkout(payload);
      setCompletedBill(res.data.data.bill);
      setShowPaymentModal(false);
      // Reset cart
      setCartItems([]);
      setSelectedCustomer(null);
      setBillDiscountType('none');
      setBillDiscountValue('');
      setCashTendered('');
      setApprovalPin('');
    } catch (err) {
      setCheckoutError(err.response?.data?.error?.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <Receipt className="w-7 h-7 text-primary" />
            Billing & POS Counter
          </h1>
          <p className="text-muted text-xs sm:text-sm">High-speed counter checkout, FEFO allocation, and GST tax invoices</p>
        </div>

        <div className="flex items-center bg-surface border border-border p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'new' ? 'bg-primary text-primary-ink shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            New Bill
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'history' ? 'bg-primary text-primary-ink shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            Bills & Returns
          </button>
          <button
            onClick={() => setActiveTab('dayClose')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'dayClose' ? 'bg-primary text-primary-ink shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            Day Close
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: NEW BILL POS COUNTER */}
      {/* ========================================================================= */}
      {activeTab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Catalog & Search (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Search & Barcode Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan barcode (or type product name / SKU and press Enter)..."
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary font-medium"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCat('')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  selectedCat === ''
                    ? 'bg-primary text-primary-ink'
                    : 'bg-surface border border-border text-muted hover:text-text'
                }`}
              >
                All Products
              </button>
              {categories.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setSelectedCat(c._id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                    selectedCat === c._id
                      ? 'bg-primary text-primary-ink'
                      : 'bg-surface border border-border text-muted hover:text-text'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Catalog Grid */}
            <div className="bg-surface border border-border rounded-2xl p-4 max-h-[68dvh] overflow-y-auto">
              {loadingCatalog ? (
                <div className="p-8 text-center text-muted text-sm">Loading catalog items...</div>
              ) : products.length === 0 ? (
                <div className="p-10 text-center text-muted">
                  <ShoppingBag className="w-8 h-8 mx-auto text-muted/30 mb-2" />
                  <p className="font-semibold text-text text-sm">No products in catalog</p>
                  <p className="text-xs text-muted mt-1">Create products in Products or inward stock from Stock/Purchases.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {products.flatMap((prod) =>
                    prod.variants
                      .filter((v) => v.isActive)
                      .map((variant) => (
                        <button
                          key={variant._id}
                          onClick={() => addToCart(prod, variant)}
                          className="bg-bg-elevated/90 hover:bg-surface border border-border/80 hover:border-primary/50 rounded-xl p-3 text-left transition-all active:scale-[0.98] flex flex-col justify-between group"
                        >
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted/70 tracking-wider">
                              {prod.brand}
                            </span>
                            <h4 className="text-xs font-bold text-text line-clamp-1 group-hover:text-primary transition-colors">
                              {prod.name}
                            </h4>
                            <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
                              {variant.flavour} • {variant.size}
                            </p>
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-text">
                              {formatINR(variant.sellingPrice)}
                            </span>
                            <span className="text-[10px] text-primary/80 font-bold bg-primary/10 px-1.5 py-0.5 rounded">
                              + Add
                            </span>
                          </div>
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Cart & Checkout (5 Cols) */}
          <div className="lg:col-span-5 bg-bg-elevated border border-border rounded-2xl p-4 space-y-4">
            {/* Customer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              {selectedCustomer ? (
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-bold text-xs text-text">{selectedCustomer.name}</p>
                    <p className="text-[11px] text-muted">{selectedCustomer.phone}</p>
                  </div>
                </div>
              ) : (
                <span className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-primary" /> Walk-in Customer
                </span>
              )}

              <div className="flex items-center gap-2">
                {selectedCustomer ? (
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs text-muted hover:text-red-400 font-semibold"
                  >
                    Clear
                  </button>
                ) : (
                  <button
                    onClick={() => setShowNewCustomerModal(true)}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    + Register
                  </button>
                )}
              </div>
            </div>

            {/* Customer Search Bar (if walk-in) */}
            {!selectedCustomer && (
              <div className="relative">
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Lookup customer by phone or name..."
                  className="w-full bg-surface border border-border rounded-xl px-3 py-1.5 text-xs text-text placeholder:text-muted/40 focus:outline-none focus:border-primary"
                />
                {customerResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-bg-elevated border border-border rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-border">
                    {customerResults.map((c) => (
                      <button
                        key={c._id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerResults([]);
                          setCustomerSearch('');
                        }}
                        className="w-full text-left p-2.5 text-xs hover:bg-surface flex justify-between"
                      >
                        <span className="font-bold text-text">{c.name}</span>
                        <span className="text-muted">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cart Items List */}
            <div className="space-y-2 max-h-[38dvh] overflow-y-auto pr-1">
              {cartItems.length === 0 ? (
                <div className="py-12 text-center text-muted">
                  <ShoppingBag className="w-8 h-8 mx-auto text-muted/30 mb-2" />
                  <p className="text-xs font-semibold text-text">Cart is empty</p>
                  <p className="text-[11px] text-muted">Scan barcode or click items to add</p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div
                    key={item.variantId}
                    className="bg-surface border border-border rounded-xl p-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex-1 mr-2">
                      <p className="font-bold text-text line-clamp-1">{item.name}</p>
                      <p className="text-[11px] text-muted">
                        {item.flavour} ({item.size}) • {formatINR(item.unitPricePaise)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Qty Stepper */}
                      <div className="flex items-center bg-bg border border-border rounded-lg">
                        <button
                          onClick={() => updateQty(item.variantId, -1)}
                          className="p-1 hover:text-text text-muted"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 font-mono font-bold text-text">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.variantId, 1)}
                          className="p-1 hover:text-text text-muted"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Total */}
                      <span className="font-mono font-bold text-text w-16 text-right">
                        {formatINR(item.unitPricePaise * item.qty)}
                      </span>

                      {/* Remove */}
                      <button
                        onClick={() => removeFromCart(item.variantId)}
                        className="text-muted hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Discount & Totals Summary */}
            {cartItems.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                {/* Discount Control */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted flex items-center gap-1 font-semibold">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Bill Discount:
                  </span>
                  <select
                    value={billDiscountType}
                    onChange={(e) => setBillDiscountType(e.target.value)}
                    className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text focus:outline-none"
                  >
                    <option value="none">None</option>
                    <option value="pct">Percent (%)</option>
                    <option value="amount">Amount (₹)</option>
                  </select>
                  {billDiscountType !== 'none' && (
                    <input
                      type="number"
                      min="0"
                      value={billDiscountValue}
                      onChange={(e) => setBillDiscountValue(e.target.value)}
                      placeholder={billDiscountType === 'pct' ? '5%' : '₹100'}
                      className="w-20 bg-bg border border-border rounded-lg px-2 py-1 text-xs text-text font-mono focus:outline-none focus:border-primary"
                    />
                  )}
                </div>

                {/* Totals Breakdown */}
                <div className="bg-surface/50 border border-border rounded-xl p-3 font-mono text-xs space-y-1">
                  <div className="flex justify-between text-muted">
                    <span>Subtotal:</span>
                    <span>{formatINR(quote.subtotalPaise)}</span>
                  </div>
                  {quote.totalDiscountPaise > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Discount:</span>
                      <span>-{formatINR(quote.totalDiscountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted">
                    <span>GST (CGST+SGST):</span>
                    <span>{formatINR(quote.totalGstPaise)}</span>
                  </div>
                  {quote.roundOffPaise !== 0 && (
                    <div className="flex justify-between text-muted/60 text-[11px]">
                      <span>Round Off:</span>
                      <span>{quote.roundOffPaise > 0 ? `+${quote.roundOffPaise}p` : `${quote.roundOffPaise}p`}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-text pt-1.5 border-t border-border/80">
                    <span>Grand Total:</span>
                    <span className="text-primary">{formatINR(quote.grandTotalPaise)}</span>
                  </div>
                </div>

                {/* Checkout Trigger Button */}
                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={cartItems.length === 0}
                  className="w-full py-3 rounded-xl bg-primary text-primary-ink font-extrabold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-neon"
                >
                  Proceed to Checkout ({formatINR(quote.grandTotalPaise)})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHECKOUT & PAYMENT SPLIT */}
      {/* ========================================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="font-bold text-text text-base">Select Payment Method</h3>
                <p className="text-xs text-muted">Payable: {formatINR(quote.grandTotalPaise)}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkoutError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {checkoutError}
              </div>
            )}

            {/* Payment Mode Selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: DollarSign },
                { id: 'upi', label: 'UPI / QR', icon: QrCode },
                { id: 'card', label: 'Card', icon: CreditCard },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setPaymentMode(tab.id)}
                    className={`p-3 rounded-xl text-xs font-bold border flex flex-col items-center gap-1.5 transition-all ${
                      paymentMode === tab.id
                        ? 'bg-primary text-primary-ink border-primary shadow-sm'
                        : 'bg-surface border-border text-muted hover:text-text'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tendered Change Calculator if Cash */}
            {paymentMode === 'cash' && (
              <div className="space-y-2 bg-surface/50 p-3 rounded-xl border border-border">
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                  Cash Tendered (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={paiseToRupees(quote.grandTotalPaise).toString()}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text font-mono focus:outline-none focus:border-primary"
                />
                {Number(cashTendered) > paiseToRupees(quote.grandTotalPaise) && (
                  <p className="text-xs font-mono font-bold text-primary flex justify-between pt-1">
                    <span>Change Due:</span>
                    <span>
                      {formatINR(rupeesToPaise(Number(cashTendered)) - quote.grandTotalPaise)}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Owner PIN approval if staff */}
            {!isOwner && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                  Owner Approval PIN (if required)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={approvalPin}
                  onChange={(e) => setApprovalPin(e.target.value)}
                  placeholder="4-digit PIN..."
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text font-mono focus:outline-none focus:border-primary"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkingOut}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-extrabold hover:brightness-110 disabled:opacity-50"
              >
                {checkingOut ? 'Checking out...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: COMPLETED RECEIPT SCREEN */}
      {/* ========================================================================= */}
      {completedBill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-6 space-y-4 text-center">
            <CheckCircle className="w-12 h-12 text-primary mx-auto" />
            <h3 className="text-xl font-black text-text">Sale Completed!</h3>
            <p className="font-mono text-sm font-bold text-primary">{completedBill.billNo}</p>
            <p className="text-xs text-muted">Total: {formatINR(completedBill.grandTotalPaise)}</p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-surface border border-border text-text text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-surface-strong"
              >
                <Printer className="w-4 h-4" /> Print
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Thank you for shopping at Chava Fitness Club! Bill: ${completedBill.billNo}, Amount: ${formatINR(
                    completedBill.grandTotalPaise
                  )}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-green-500/30"
              >
                <Share2 className="w-4 h-4" /> WhatsApp
              </a>
            </div>

            <button
              onClick={() => setCompletedBill(null)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-extrabold hover:brightness-110"
            >
              Start New Bill
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BILLS HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {loadingHistory ? (
            <div className="p-8 text-center text-muted">Loading bills history...</div>
          ) : billsHistory.length === 0 ? (
            <div className="p-12 text-center text-muted">
              <Receipt className="w-10 h-10 mx-auto text-muted/30 mb-2" />
              <p className="font-semibold text-text">No completed bills found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-elevated/50 text-xs font-semibold text-muted uppercase tracking-wider">
                    <th className="p-4">Bill No</th>
                    <th className="p-4">Date / Time</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4 text-center">Items</th>
                    <th className="p-4 text-right">Grand Total</th>
                    <th className="p-4 text-center">Cashier</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {billsHistory.map((b) => (
                    <tr key={b._id} className="hover:bg-surface-strong/60 transition-colors">
                      <td className="p-4 font-mono font-bold text-text">{b.billNo}</td>
                      <td className="p-4 text-xs text-muted">{new Date(b.createdAt).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-text">{b.customerSnapshot?.name || 'Walk-in'}</td>
                      <td className="p-4 text-center font-mono text-xs">{b.items?.length || 0}</td>
                      <td className="p-4 text-right font-mono font-bold text-primary">
                        {formatINR(b.grandTotalPaise)}
                      </td>
                      <td className="p-4 text-center text-xs text-muted">{b.staffNameSnapshot}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setCompletedBill(b)}
                            className="px-2.5 py-1 rounded bg-surface border border-border text-xs text-text hover:text-primary transition-colors"
                          >
                            Receipt
                          </button>
                          {b.status !== 'returned' && (
                            <button
                              onClick={() => setReturnBill(b)}
                              className="px-2.5 py-1 rounded bg-danger/10 border border-danger/30 text-xs text-danger hover:bg-danger/20 font-semibold transition-colors"
                            >
                              Return
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DAY CLOSE */}
      {/* ========================================================================= */}
      {activeTab === 'dayClose' && <DayCloseTab user={user} />}

      {/* ========================================================================= */}
      {/* MODAL: QUICK REGISTER CUSTOMER */}
      {/* ========================================================================= */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-text text-sm">Register Customer</h3>
              <button onClick={() => setShowNewCustomerModal(false)} className="text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Name</label>
                <input
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Vikram Shinde"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Phone</label>
                <input
                  required
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="10-digit mobile number"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  value={newCustomerForm.gstin}
                  onChange={(e) => setNewCustomerForm((f) => ({ ...f, gstin: e.target.value }))}
                  placeholder="e.g. 27AABCC1234D1Z5"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL: PROCESS RETURN */}
      {/* ========================================================================= */}
      {returnBill && (
        <ReturnModal
          bill={returnBill}
          user={user}
          onClose={() => setReturnBill(null)}
          onSuccess={() => {
            setReturnBill(null);
            loadHistory();
          }}
        />
      )}
    </div>
  );
}
