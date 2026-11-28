import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, AlertTriangle, Check, X, ShieldAlert, Sparkles, Layers } from 'lucide-react';
import { productsApi } from '../../api/products.js';
import { MonthYearPicker } from './MonthYearPicker.jsx';
import { formatINR, rupeesToPaise } from '../../utils/money.js';

const GST_RATES = [0, 5, 12, 18, 28];

export function NewProductInlinePanel({
  initialData = {},
  categories = [],
  brands = [],
  onSave,
  onClose,
  onSwitchToExisting,
}) {
  // Product state
  const [name, setName] = useState(initialData.name || '');
  const [brand, setBrand] = useState(initialData.brand || '');
  const [categoryId, setCategoryId] = useState(initialData.categoryId || categories[0]?._id || '');
  const [hsn, setHsn] = useState(initialData.hsn || '21069099');
  const [gstRate, setGstRate] = useState(initialData.gstRate !== undefined ? initialData.gstRate : 0); // Default 0% (option kept)
  const [lowStockLimit, setLowStockLimit] = useState(initialData.lowStockLimit ?? 3);
  const [trackExpiry, setTrackExpiry] = useState(initialData.trackExpiry ?? true);

  // Variants state (at least 1 variant row)
  const [variants, setVariants] = useState(() => {
    if (initialData.variants && initialData.variants.length > 0) {
      return initialData.variants;
    }
    return [
      {
        tempVariantId: `var_${Date.now()}_0`,
        flavour: initialData.flavour || '',
        size: initialData.size || '',
        barcode: initialData.barcode || '',
        mrp: initialData.mrp || '',
        sellingPrice: initialData.sellingPrice || '',
        qty: initialData.qty || 1,
        unitCostRupees: initialData.unitCostRupees || '',
        batchNo: initialData.batchNo || '',
        expiryMonth: initialData.expiryMonth || '',
      },
    ];
  });

  const [error, setError] = useState('');
  const [similarCheck, setSimilarCheck] = useState({ loading: false, exactMatch: null, similar: [] });

  // Update trackExpiry default when category changes (turn off for Accessories)
  useEffect(() => {
    const selectedCat = categories.find((c) => c._id === categoryId);
    if (selectedCat && selectedCat.name.toLowerCase().includes('accessories')) {
      setTrackExpiry(false);
    }
  }, [categoryId, categories]);

  // Live duplicate detection
  const duplicateTimeout = useRef(null);
  useEffect(() => {
    if (!name.trim() || !brand.trim() || !categoryId) {
      setSimilarCheck({ loading: false, exactMatch: null, similar: [] });
      return;
    }

    if (duplicateTimeout.current) clearTimeout(duplicateTimeout.current);

    duplicateTimeout.current = setTimeout(async () => {
      setSimilarCheck((prev) => ({ ...prev, loading: true }));
      try {
        const res = await productsApi.getSimilar({
          name: name.trim(),
          brand: brand.trim(),
          categoryId,
        });
        const data = res.data?.data || {};
        setSimilarCheck({
          loading: false,
          exactMatch: data.isExactMatch ? data.exactMatch : null,
          similar: data.similar || [],
        });
      } catch (e) {
        setSimilarCheck({ loading: false, exactMatch: null, similar: [] });
      }
    }, 300);

    return () => {
      if (duplicateTimeout.current) clearTimeout(duplicateTimeout.current);
    };
  }, [name, brand, categoryId]);

  function handleAddVariantRow() {
    setVariants((prev) => [
      ...prev,
      {
        tempVariantId: `var_${Date.now()}_${prev.length}`,
        flavour: '',
        size: '',
        barcode: '',
        mrp: '',
        sellingPrice: '',
        qty: 1,
        unitCostRupees: '',
        batchNo: '',
        expiryMonth: '',
      },
    ]);
  }

  function handleRemoveVariantRow(idx) {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleVariantChange(idx, field, val) {
    setVariants((prev) => {
      const copy = [...prev];
      const cur = { ...copy[idx], [field]: val };

      // Auto default selling price from MRP if selling price not manually entered
      if (field === 'mrp' && (!cur.sellingPrice || cur.sellingPrice === copy[idx].mrp)) {
        cur.sellingPrice = val;
      }

      copy[idx] = cur;
      return copy;
    });
  }

  function handleValidateAndDone(e) {
    e?.preventDefault();
    setError('');

    // Validations
    if (!name.trim() || name.trim().length < 2 || name.trim().length > 80) {
      setError('Product name must be between 2 and 80 characters');
      return;
    }
    if (!brand.trim()) {
      setError('Brand is required');
      return;
    }
    if (!categoryId) {
      setError('Please select a category');
      return;
    }
    const resolvedGstRate = (gstRate === null || gstRate === undefined) ? 0 : gstRate;

    // Check exact match block
    if (similarCheck.exactMatch) {
      setError(`A product "${similarCheck.exactMatch.name}" under brand "${similarCheck.exactMatch.brand}" already exists. Please switch to it or rename this product.`);
      return;
    }

    // Validate variants
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const rowLabel = variants.length > 1 ? `Variant ${i + 1}` : 'Variant';

      const mrpNum = parseFloat(v.mrp);
      const spNum = parseFloat(v.sellingPrice);
      const costNum = parseFloat(v.unitCostRupees);
      const qtyNum = parseInt(v.qty, 10);

      if (isNaN(mrpNum) || mrpNum <= 0) {
        setError(`${rowLabel}: Valid MRP is required`);
        return;
      }
      if (isNaN(spNum) || spNum <= 0) {
        setError(`${rowLabel}: Valid selling price is required`);
        return;
      }
      if (spNum > mrpNum) {
        setError(`${rowLabel}: Selling price (₹${spNum}) cannot exceed MRP (₹${mrpNum})`);
        return;
      }
      if (isNaN(qtyNum) || qtyNum < 1) {
        setError(`${rowLabel}: Quantity must be at least 1`);
        return;
      }
      if (isNaN(costNum) || costNum < 0) {
        setError(`${rowLabel}: Valid unit cost (excl GST) is required`);
        return;
      }
      if (!v.batchNo.trim()) {
        setError(`${rowLabel}: Batch number is required`);
        return;
      }
      if (trackExpiry && !v.expiryMonth) {
        setError(`${rowLabel}: Expiry date (MM/YYYY) is required for expiring products`);
        return;
      }
    }

    const tempProductId = initialData.tempProductId || `prod_${Date.now()}`;
    const selectedCat = categories.find((c) => c._id === categoryId);

    const productPayload = {
      tempProductId,
      name: name.trim(),
      brand: brand.trim(),
      category: categoryId,
      categoryName: selectedCat?.name || '',
      hsn: hsn.trim(),
      gstRate: Number(gstRate),
      lowStockLimit: Number(lowStockLimit) || 3,
      trackExpiry: Boolean(trackExpiry),
    };

    const variantPayloads = variants.map((v) => {
      const flavour = v.flavour.trim();
      const size = v.size.trim();
      const displayLabel = flavour && size ? `${flavour} (${size})` : flavour || size || 'Standard';

      return {
        tempProductId,
        tempVariantId: v.tempVariantId,
        flavour: flavour || '',
        size: size || '',
        displayLabel,
        barcode: v.barcode.trim(),
        mrp: parseFloat(v.mrp),
        sellingPrice: parseFloat(v.sellingPrice),
        qty: parseInt(v.qty, 10),
        unitCostRupees: parseFloat(v.unitCostRupees),
        batchNo: v.batchNo.trim().toUpperCase(),
        expiryMonth: v.expiryMonth,
        gstRate: Number(gstRate),
        isNewProduct: true,
      };
    });

    onSave({ product: productPayload, variants: variantPayloads });
  }

  return createPortal(
    <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      {/* Container: Bottom Sheet on Mobile (<768px), Centered Modal on Desktop (>=768px) */}
      <div className="bg-bg-elevated border border-primary/30 rounded-t-3xl sm:rounded-2xl w-full max-w-3xl max-h-[92dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text text-base sm:text-lg">New Product &amp; Stock Inward</h3>
                <span className="bg-primary/20 text-primary text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-primary/30">
                  NEW
                </span>
              </div>
              <p className="text-xs text-muted">Create product &amp; receive inward stock together in one atomic step</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-text hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-2.5 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Exact Match Warning */}
          {similarCheck.exactMatch && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <p className="font-bold">Existing product found!</p>
                  <p className="text-[11px] text-amber-200/80">
                    "{similarCheck.exactMatch.name}" under brand "{similarCheck.exactMatch.brand}" already exists in the catalogue.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSwitchToExisting?.(similarCheck.exactMatch)}
                className="px-3 py-1.5 rounded-xl bg-amber-400 text-black font-bold text-xs hover:brightness-110 shrink-0 whitespace-nowrap"
              >
                Switch to Existing
              </button>
            </div>
          )}

          {/* Product Master Fields */}
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-4">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
              1. Product Master Details
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-muted font-semibold mb-1">
                  Product Name <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 100% Gold Standard Whey"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text placeholder:text-muted/40 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted font-semibold mb-1">
                  Brand <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  list="brands-datalist"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Optimum Nutrition"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text placeholder:text-muted/40 focus:outline-none focus:border-primary"
                />
                <datalist id="brands-datalist">
                  {brands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-muted font-semibold mb-1">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary"
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted font-semibold mb-1">HSN Code</label>
                <input
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  placeholder="21069099"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            {/* GST % Segmented Selection (Defaults to 0%, option to change kept) */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-muted font-semibold text-xs">
                  GST Rate (%)
                </label>
                <span className="text-[10px] text-muted font-medium">Default: 0% (Non-GST registered)</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {GST_RATES.map((r) => {
                  const isSelected = (gstRate ?? 0) === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setGstRate(r)}
                      className={`py-2 rounded-xl border text-center font-bold text-xs transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-ink border-primary shadow-sm'
                          : 'bg-bg border-border text-muted hover:border-primary/40 hover:text-text'
                      }`}
                    >
                      {r}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between bg-bg border border-border rounded-xl px-3 py-2">
                <div>
                  <span className="font-semibold text-text block">Track Expiry</span>
                  <span className="text-[10px] text-muted">Enforce MM/YYYY batch expiry</span>
                </div>
                <input
                  type="checkbox"
                  checked={trackExpiry}
                  onChange={(e) => setTrackExpiry(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-muted font-semibold mb-1">Low-Stock Alert Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={lowStockLimit}
                  onChange={(e) => setLowStockLimit(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Variants and Inward Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                2. Flavours, Sizes &amp; Inward Stock ({variants.length})
              </span>
              <button
                type="button"
                onClick={handleAddVariantRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Flavour / Size
              </button>
            </div>

            {variants.map((v, idx) => {
              const costExcl = parseFloat(v.unitCostRupees) || 0;
              const sp = parseFloat(v.sellingPrice) || 0;
              const mrp = parseFloat(v.mrp) || 0;
              const rate = gstRate ?? 0;
              // Approx selling price excluding GST to compare with cost
              const spExcl = sp / (1 + rate / 100);
              const isNegativeMargin = sp > 0 && costExcl > 0 && spExcl < costExcl;
              const estimatedMarginPaise = Math.round((spExcl - costExcl) * 100);

              return (
                <div
                  key={v.tempVariantId || idx}
                  className="bg-surface border border-border rounded-2xl p-4 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="font-bold text-text text-xs">
                      Variant {idx + 1}: {v.flavour || v.size ? `${v.flavour} ${v.size}`.trim() : 'Standard'}
                    </span>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariantRow(idx)}
                        className="p-1 rounded-lg text-muted hover:text-red-400 transition-colors"
                        title="Remove Variant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Variant Specifications */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">Flavour (Optional)</label>
                      <input
                        value={v.flavour}
                        onChange={(e) => handleVariantChange(idx, 'flavour', e.target.value)}
                        placeholder="e.g. Double Rich Chocolate"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">Size / Pack (Optional)</label>
                      <input
                        value={v.size}
                        onChange={(e) => handleVariantChange(idx, 'size', e.target.value)}
                        placeholder="e.g. 2 kg or 5 lbs"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">Barcode (Optional)</label>
                      <input
                        value={v.barcode}
                        onChange={(e) => handleVariantChange(idx, 'barcode', e.target.value)}
                        placeholder="Scan or type barcode"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
                      />
                    </div>
                  </div>

                  {/* Pricing & Stock Inward Inputs */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 items-start">
                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">MRP (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={v.mrp}
                        onChange={(e) => handleVariantChange(idx, 'mrp', e.target.value)}
                        placeholder="4500"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">Selling Price (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={v.sellingPrice}
                        onChange={(e) => handleVariantChange(idx, 'sellingPrice', e.target.value)}
                        placeholder="3999"
                        className={`w-full bg-bg border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none font-mono ${
                          mrp && sp > mrp ? 'border-red-500' : 'border-border focus:border-primary'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">Qty *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={v.qty}
                        onChange={(e) => handleVariantChange(idx, 'qty', e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">Cost/Unit (₹ Excl) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={v.unitCostRupees}
                        onChange={(e) => handleVariantChange(idx, 'unitCostRupees', e.target.value)}
                        placeholder="2800"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">Batch No *</label>
                      <input
                        required
                        value={v.batchNo}
                        onChange={(e) => handleVariantChange(idx, 'batchNo', e.target.value.toUpperCase())}
                        placeholder="ON-26-A1"
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-muted text-[10px] mb-0.5">
                        Expiry (MM/YYYY) {trackExpiry && '*'}
                      </label>
                      <MonthYearPicker
                        value={v.expiryMonth}
                        onChange={(val) => handleVariantChange(idx, 'expiryMonth', val)}
                        required={trackExpiry}
                      />
                    </div>
                  </div>

                  {/* Amber Margin Warning / Estimation */}
                  {isNegativeMargin ? (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>
                        Low / Negative margin: Net selling price ({formatINR(rupeesToPaise(Math.round(spExcl)))}) is less than unit cost ({formatINR(rupeesToPaise(Math.round(costExcl)))}).
                      </span>
                    </div>
                  ) : sp > 0 && costExcl > 0 ? (
                    <div className="text-[10px] text-muted font-mono flex items-center gap-2">
                      <span>
                        Expected unit margin: <strong className="text-primary font-semibold">{formatINR(estimatedMarginPaise)}</strong>
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky Done / Save Footer */}
        <div className="p-4 sm:p-5 border-t border-border bg-bg-elevated/95 backdrop-blur-md shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleValidateAndDone}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <Check className="w-4 h-4" /> Done &amp; Add to Purchase
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}