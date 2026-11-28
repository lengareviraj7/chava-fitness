import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertTriangle, Layers, ShieldAlert } from 'lucide-react';
import { MonthYearPicker } from './MonthYearPicker.jsx';
import { formatINR, rupeesToPaise } from '../../utils/money.js';

export function NewVariantInlinePanel({ product, onSave, onClose }) {
  const [flavour, setFlavour] = useState('');
  const [size, setSize] = useState('');
  const [barcode, setBarcode] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [qty, setQty] = useState(1);
  const [unitCostRupees, setUnitCostRupees] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [error, setError] = useState('');

  const gstRate = product?.gstRate ?? 0;
  const trackExpiry = product?.trackExpiry ?? true;

  function handleMrpChange(val) {
    setMrp(val);
    if (!sellingPrice || sellingPrice === mrp) {
      setSellingPrice(val);
    }
  }

  function handleDone(e) {
    e?.preventDefault();
    setError('');

    const mrpNum = parseFloat(mrp);
    const spNum = parseFloat(sellingPrice);
    const costNum = parseFloat(unitCostRupees);
    const qtyNum = parseInt(qty, 10);

    if (isNaN(mrpNum) || mrpNum <= 0) {
      setError('Valid MRP is required');
      return;
    }
    if (isNaN(spNum) || spNum <= 0) {
      setError('Valid Selling Price is required');
      return;
    }
    if (spNum > mrpNum) {
      setError(`Selling price (₹${spNum}) cannot exceed MRP (₹${mrpNum})`);
      return;
    }
    if (isNaN(qtyNum) || qtyNum < 1) {
      setError('Quantity must be at least 1');
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      setError('Valid Unit Cost (Excl GST) is required');
      return;
    }
    if (!batchNo.trim()) {
      setError('Batch number is required');
      return;
    }
    if (trackExpiry && !expiryMonth) {
      setError('Expiry date (MM/YYYY) is required');
      return;
    }

    const tempVariantId = `new_var_${Date.now()}`;
    const cleanFlavour = flavour.trim();
    const cleanSize = size.trim();
    const displayLabel = cleanFlavour && cleanSize ? `${cleanFlavour} (${cleanSize})` : cleanFlavour || cleanSize || 'Standard';

    onSave({
      productId: product._id,
      productName: product.name,
      brand: product.brand,
      tempVariantId,
      flavour: cleanFlavour,
      size: cleanSize,
      displayLabel,
      barcode: barcode.trim(),
      mrp: mrpNum,
      sellingPrice: spNum,
      qty: qtyNum,
      unitCostRupees: costNum,
      batchNo: batchNo.trim().toUpperCase(),
      expiryMonth,
      gstRate,
      isNewVariant: true,
    });
  }

  const costExcl = parseFloat(unitCostRupees) || 0;
  const sp = parseFloat(sellingPrice) || 0;
  const spExcl = sp / (1 + gstRate / 100);
  const isNegativeMargin = sp > 0 && costExcl > 0 && spExcl < costExcl;

  return createPortal(
    <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-bg-elevated border border-primary/30 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text text-sm sm:text-base">New Flavour / Size</h3>
                <span className="bg-primary/20 text-primary text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-primary/30">
                  NEW VARIANT
                </span>
              </div>
              <p className="text-xs text-muted truncate max-w-[280px]">
                {product?.name} ({product?.brand})
              </p>
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

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-muted text-[10px] font-semibold mb-1">Flavour (Optional)</label>
              <input
                value={flavour}
                onChange={(e) => setFlavour(e.target.value)}
                placeholder="e.g. Malai Kulfi"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-muted text-[10px] font-semibold mb-1">Pack Size (Optional)</label>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. 1 kg"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-muted text-[10px] font-semibold mb-1">Barcode (Optional)</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type barcode"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-muted text-[10px] font-semibold mb-1">MRP (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={mrp}
                onChange={(e) => handleMrpChange(e.target.value)}
                placeholder="3200"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-muted text-[10px] font-semibold mb-1">Selling Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="2800"
                className={`w-full bg-bg border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none font-mono ${
                  mrp && sp > mrp ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-muted text-[10px] font-semibold mb-1">Inward Qty *</label>
              <input
                type="number"
                min="1"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-muted text-[10px] font-semibold mb-1">Cost/Unit (₹ Excl) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={unitCostRupees}
                onChange={(e) => setUnitCostRupees(e.target.value)}
                placeholder="2100"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-muted text-[10px] font-semibold mb-1">Batch Number *</label>
              <input
                required
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value.toUpperCase())}
                placeholder="MK-2026-01"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base sm:text-xs text-text focus:outline-none focus:border-primary font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-muted text-[10px] font-semibold mb-1">
                Expiry (MM/YYYY) {trackExpiry && '*'}
              </label>
              <MonthYearPicker
                value={expiryMonth}
                onChange={(val) => setExpiryMonth(val)}
                required={trackExpiry}
              />
            </div>
          </div>

          {isNegativeMargin && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>
                Selling price (excl GST {formatINR(rupeesToPaise(Math.round(spExcl)))}) is less than unit cost ({formatINR(rupeesToPaise(Math.round(costExcl)))}).
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
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
            onClick={handleDone}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <Check className="w-4 h-4" /> Add Variant to Purchase
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}