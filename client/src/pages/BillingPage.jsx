import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  UserCheck,
  UserPlus,
  CreditCard,
  QrCode,
  DollarSign,
  Printer,
  Share2,
  CheckCircle,
  Check,
  AlertCircle,
  X,
  Tag,
  Clock,
  Sparkles,
  ShoppingBag,
  History,
  Lock,
} from 'lucide-react';
import { billingApi, customersApi } from '../api/billing.js';
import { settingsApi } from '../api/settings.js';
import { productsApi, categoriesApi } from '../api/products.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatINR, paiseToRupees, rupeesToPaise } from '../utils/money.js';
import { toAsciiDigits } from '../utils/toAsciiDigits.js';
import { ReturnModal } from '../components/billing/ReturnModal.jsx';

export function BillingPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  const [returnBill, setReturnBill] = useState(null);

  const toast = useToast();

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
  const [defaultAddress, setDefaultAddress] = useState('Visapur');
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', address: 'Visapur' });
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [duplicateConflict, setDuplicateConflict] = useState(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Field refs
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const addressInputRef = useRef(null);
  const customerSearchRef = useRef(null);

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

  // Load Default Customer Address from Settings
  useEffect(() => {
    settingsApi.get().then((res) => {
      const addr = res.data?.data?.settings?.defaultCustomerAddress;
      if (addr) setDefaultAddress(addr);
    }).catch(() => {});
  }, []);

  function cleanPhone(raw) {
    if (!raw) return '';
    let p = toAsciiDigits(String(raw).trim()).replace(/\D/g, '');
    if (p.length === 12 && p.startsWith('91')) p = p.slice(2);
    else if (p.length === 11 && p.startsWith('0')) p = p.slice(1);
    return p;
  }

  function handleOpenNewCustomerModal(initialName = '', initialPhone = '') {
    setNewCustomerForm({
      name: initialName,
      phone: initialPhone,
      address: defaultAddress || 'Visapur',
    });
    setNameError('');
    setPhoneError('');
    setAddressError('');
    setDuplicateConflict(null);
    setShowNewCustomerModal(true);
    setTimeout(() => {
      if (initialName && !initialPhone) {
        phoneInputRef.current?.focus();
      } else {
        nameInputRef.current?.focus();
      }
    }, 50);
  }

  // Customer search debounced ~250ms
  useEffect(() => {
    const q = customerSearch.trim();
    if (!q) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(() => {
      customersApi.lookup(q).then((res) => {
        setCustomerResults(res.data?.data?.customers || []);
      }).catch(() => {
        setCustomerResults([]);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  async function handleSaveCustomer(e) {
    if (e) e.preventDefault();
    if (isSavingCustomer) return;

    let valid = true;
    const trimmedName = newCustomerForm.name.trim().replace(/\s+/g, ' ');
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setNameError('Name must be between 2 and 60 characters');
      valid = false;
    } else {
      setNameError('');
    }

    const cleanedPhone = cleanPhone(newCustomerForm.phone);
    if (!/^[6-9]\d{9}$/.test(cleanedPhone)) {
      setPhoneError('Must be a 10-digit Indian mobile starting with 6, 7, 8, or 9');
      valid = false;
    } else {
      setPhoneError('');
    }

    const trimmedAddress = (newCustomerForm.address || '').trim();
    if (!trimmedAddress) {
      setAddressError('Enter address');
      valid = false;
    } else {
      setAddressError('');
    }

    if (!valid) return;

    setIsSavingCustomer(true);
    setDuplicateConflict(null);

    try {
      const res = await customersApi.create({
        name: trimmedName,
        phone: cleanedPhone,
        address: trimmedAddress,
      });
      const customer = res.data?.data?.customer;
      setSelectedCustomer(customer);
      setShowNewCustomerModal(false);
      setNewCustomerForm({ name: '', phone: '', address: defaultAddress || 'Visapur' });
      setCustomerSearch('');
      toast.success('Customer added');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.error?.existingCustomer) {
        setDuplicateConflict(err.response.data.error.existingCustomer);
      } else {
        alert(err.response?.data?.error?.message || 'Failed to create customer');
      }
    } finally {
      setIsSavingCustomer(false);
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
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text uppercase tracking-wider">Customer</span>
                {!selectedCustomer && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface border border-border text-muted">
                    Walk-in
                  </span>
                )}
              </div>

              {!selectedCustomer && (
                <button
                  type="button"
                  onClick={() => handleOpenNewCustomerModal()}
                  className="text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> New customer
                </button>
              )}
            </div>

            {/* Attached Customer Card */}
            {selectedCustomer ? (
              <div className="bg-[#0D140F] border border-border rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-bold text-xs text-white truncate">{selectedCustomer.name}</span>
                    <span className="text-[11px] font-mono text-primary/90 font-medium">{selectedCustomer.phone}</span>
                  </div>
                  <p
                    className="text-[11px] text-muted truncate max-w-[240px]"
                    title={selectedCustomer.address || 'No address'}
                  >
                    {selectedCustomer.address || '—'}
                  </p>
                  {selectedCustomer.dueBalancePaise > 0 && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Pending {formatINR(selectedCustomer.dueBalancePaise)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Collect due
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                      setTimeout(() => customerSearchRef.current?.focus(), 50);
                    }}
                    className="text-xs text-text hover:text-primary px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-strong border border-border font-semibold transition-colors"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-muted hover:text-red-400 p-1 rounded-lg hover:bg-surface-strong transition-colors"
                    title="Remove customer (Walk-in)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Customer Search Bar (Walk-in) */
              <div className="relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    ref={customerSearchRef}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customerResults.length > 0) {
                          setSelectedCustomer(customerResults[0]);
                          setCustomerResults([]);
                          setCustomerSearch('');
                          searchInputRef.current?.focus();
                        } else if (customerSearch.trim().length >= 2) {
                          const typed = customerSearch.trim();
                          const digits = cleanPhone(typed);
                          if (digits.length >= 3) {
                            handleOpenNewCustomerModal('', digits);
                          } else {
                            handleOpenNewCustomerModal(typed, '');
                          }
                        }
                      }
                    }}
                    placeholder="Search customer (phone or name)..."
                    className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text placeholder:text-muted/40 focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Dropdown Results */}
                {customerSearch.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-bg-elevated border border-border rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-border">
                    {customerResults.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerResults([]);
                          setCustomerSearch('');
                          searchInputRef.current?.focus();
                        }}
                        className="w-full text-left p-2.5 text-xs hover:bg-surface flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text truncate">{c.name}</span>
                            <span className="text-muted font-mono">{c.phone}</span>
                          </div>
                          {c.address && (
                            <p className="text-[11px] text-muted truncate max-w-[220px]">{c.address}</p>
                          )}
                        </div>
                        {c.dueBalancePaise > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                            Pending {formatINR(c.dueBalancePaise)}
                          </span>
                        )}
                      </button>
                    ))}

                    {/* No Match Row */}
                    {customerResults.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const typed = customerSearch.trim();
                          const digits = cleanPhone(typed);
                          if (digits.length >= 3) {
                            handleOpenNewCustomerModal('', digits);
                          } else {
                            handleOpenNewCustomerModal(typed, '');
                          }
                        }}
                        className="w-full text-left p-2.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary font-semibold flex items-center justify-between transition-colors"
                      >
                        <span>+ Add new customer: "{customerSearch.trim()}"</span>
                        <span className="text-[10px] bg-primary/20 px-1.5 py-0.5 rounded font-mono">Enter</span>
                      </button>
                    )}
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
                    className="bg-[#0D140F] border border-border rounded-lg px-2.5 py-1 text-xs text-text font-medium focus:outline-none focus:border-primary transition-colors"
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
                      className="w-20 bg-[#0D140F] border border-border rounded-lg px-2 py-1 text-xs text-text font-mono focus:outline-none focus:border-primary"
                    />
                  )}
                </div>

                {/* Totals Breakdown */}
                <div className="bg-[#0D140F] border border-border rounded-xl p-3.5 font-mono text-xs space-y-2">
                  <div className="flex justify-between text-muted">
                    <span className="font-semibold text-muted">Subtotal:</span>
                    <span className="text-white font-semibold">{formatINR(quote.subtotalPaise)}</span>
                  </div>
                  {quote.totalDiscountPaise > 0 && (
                    <div className="flex justify-between text-primary font-bold">
                      <span>Discount:</span>
                      <span>-{formatINR(quote.totalDiscountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted">
                    <span className="font-semibold text-muted">GST (CGST+SGST):</span>
                    <span className="text-white font-semibold">{formatINR(quote.totalGstPaise)}</span>
                  </div>
                  {quote.roundOffPaise !== 0 && (
                    <div className="flex justify-between text-muted/70 text-[11px]">
                      <span>Round Off:</span>
                      <span className="text-white/80">{quote.roundOffPaise > 0 ? `+${quote.roundOffPaise}p` : `${quote.roundOffPaise}p`}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-text pt-2 border-t border-border/80 items-center">
                    <span className="text-white text-sm font-bold tracking-tight">Grand Total:</span>
                    <span className="text-primary text-xl font-black">{formatINR(quote.grandTotalPaise)}</span>
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
              <div className="space-y-2 bg-[#0D140F] p-3.5 rounded-xl border border-border">
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

            {/* Customer Details Snapshot */}
            {completedBill.customerSnapshot?.phone && (
              <div className="bg-[#0D140F] border border-border rounded-xl p-3.5 text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{completedBill.customerSnapshot.name}</span>
                  <span className="font-mono text-[11px] text-primary font-medium">{completedBill.customerSnapshot.phone}</span>
                </div>
                {completedBill.customerSnapshot.address && (
                  <p className="text-[11px] text-muted line-clamp-2">{completedBill.customerSnapshot.address}</p>
                )}
              </div>
            )}

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

          {/* Printable 80mm Receipt */}
          <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:text-black print:p-6 print:z-[99999]">
            <div className="max-w-[80mm] mx-auto text-xs font-mono space-y-2">
              <div className="text-center pb-2 border-b border-black">
                <h2 className="text-base font-bold">CHAVA FITNESS CLUB</h2>
                <p>Tax Invoice</p>
                <p>Bill: {completedBill.billNo}</p>
              </div>
              {completedBill.customerSnapshot?.phone && (
                <div className="pb-2 border-b border-black">
                  <p className="font-bold">{completedBill.customerSnapshot.name}</p>
                  <p>Ph: {completedBill.customerSnapshot.phone}</p>
                  {completedBill.customerSnapshot.address && (
                    <p className="break-words line-clamp-2">{completedBill.customerSnapshot.address}</p>
                  )}
                </div>
              )}
              <div className="divide-y divide-dashed divide-black">
                {completedBill.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span>{it.nameSnapshot} x{it.qty}</span>
                    <span>{formatINR(it.netPaise)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-black flex justify-between font-bold text-sm">
                <span>Total:</span>
                <span>{formatINR(completedBill.grandTotalPaise)}</span>
              </div>
            </div>
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
      {/* MODAL / BOTTOM SHEET: NEW CUSTOMER QUICK-ADD */}
      {/* ========================================================================= */}
      {showNewCustomerModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex md:items-center md:justify-center items-end"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowNewCustomerModal(false);
          }}
        >
          <div className="bg-bg-elevated border border-border w-full md:max-w-md md:rounded-2xl rounded-t-3xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-text text-base">New customer</h3>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="text-muted hover:text-text p-1 rounded-lg hover:bg-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 409 Conflict Banner */}
            {duplicateConflict && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-start gap-2 text-amber-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">This number belongs to {duplicateConflict.name}</p>
                    <p className="text-[11px] text-muted font-mono">
                      {duplicateConflict.phone} · {duplicateConflict.address || 'No address'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(duplicateConflict);
                      setShowNewCustomerModal(false);
                      setDuplicateConflict(null);
                      toast.success('Customer attached to bill');
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-primary-ink text-xs font-bold hover:brightness-110"
                  >
                    Use this customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateConflict(null);
                      phoneInputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-text"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              {/* Field 1: Name */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Name *
                </label>
                <input
                  ref={nameInputRef}
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => {
                    setNewCustomerForm((f) => ({ ...f, name: e.target.value }));
                    if (nameError) setNameError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      phoneInputRef.current?.focus();
                    }
                  }}
                  placeholder="e.g. Ramesh Patil"
                  className={`w-full bg-bg border ${
                    nameError ? 'border-red-500' : 'border-border'
                  } rounded-xl px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-primary`}
                />
                {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
              </div>

              {/* Field 2: Mobile Number */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Mobile number *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-muted pointer-events-none">
                    +91
                  </span>
                  <input
                    ref={phoneInputRef}
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    value={newCustomerForm.phone}
                    onChange={(e) => {
                      const clean = toAsciiDigits(e.target.value);
                      setNewCustomerForm((f) => ({ ...f, phone: clean }));
                      if (phoneError) setPhoneError('');
                      if (duplicateConflict) setDuplicateConflict(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addressInputRef.current?.focus();
                      }
                    }}
                    placeholder="9876543210"
                    className={`w-full bg-bg border ${
                      phoneError ? 'border-red-500' : 'border-border'
                    } rounded-xl pl-12 pr-10 py-2.5 text-sm font-mono text-text focus:outline-none focus:border-primary`}
                  />
                  {/^[6-9]\d{9}$/.test(cleanPhone(newCustomerForm.phone)) && (
                    <span className="absolute right-3.5 text-primary">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </div>
                {phoneError && <p className="text-xs text-red-400 mt-1">{phoneError}</p>}
              </div>

              {/* Field 3: Address */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Address *
                </label>
                <textarea
                  ref={addressInputRef}
                  required
                  rows={2}
                  maxLength={120}
                  value={newCustomerForm.address}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    setNewCustomerForm((f) => ({ ...f, address: e.target.value }));
                    if (addressError) setAddressError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveCustomer();
                    }
                  }}
                  placeholder="e.g. Visapur"
                  className={`w-full bg-bg border ${
                    addressError ? 'border-red-500' : 'border-border'
                  } rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none focus:border-primary resize-none`}
                />
                {addressError && <p className="text-xs text-red-400 mt-1">{addressError}</p>}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSavingCustomer ? 'Saving...' : 'Save and add to bill'}
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
