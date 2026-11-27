import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Package, Edit2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, X } from 'lucide-react';
import { productsApi, categoriesApi } from '../api/products.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatINR, rupeesToPaise, paiseToRupees } from '../utils/money.js';

// ---- Product Form Modal ----
function ProductForm({ product, categories, onSave, onClose, onCategoryCreated }) {
  const isEdit = !!product;
  const [form, setForm] = useState(() =>
    product
      ? {
          name: product.name,
          brand: product.brand,
          category: product.category?._id || product.category,
          hsn: product.hsn,
          gstRate: product.gstRate,
          description: product.description || '',
          variants: product.variants.map((v) => ({
            ...v,
            mrp: paiseToRupees(v.mrp),
            sellingPrice: paiseToRupees(v.sellingPrice),
            purchasePrice: paiseToRupees(v.purchasePrice),
            stock: v.stock ?? 0,
            minStockLevel: v.minStockLevel ?? 3,
          })),
        }
      : {
          name: '', brand: '', category: categories[0]?._id || '', hsn: '21069099', gstRate: 0, description: '',
          variants: [{ flavour: '', size: '', sku: '', barcode: '', mrp: '', sellingPrice: '', purchasePrice: '', stock: 0, minStockLevel: 3 }],
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catCreating, setCatCreating] = useState(false);

  useEffect(() => {
    if (!form.category && categories.length > 0) {
      setForm((f) => ({ ...f, category: categories[0]._id }));
    }
  }, [categories, form.category]);

  async function handleCreateCategory() {
    if (!newCatName.trim()) return;
    setCatCreating(true);
    try {
      const res = await categoriesApi.create({ name: newCatName.trim() });
      const newCat = res.data.data.category;
      if (onCategoryCreated) {
        onCategoryCreated(newCat);
      }
      setField('category', newCat._id);
      setNewCatName('');
      setShowAddCategory(false);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create category');
    } finally {
      setCatCreating(false);
    }
  }

  function setField(key, val) { setForm((f) => ({ ...f, [key]: val })); }
  function setVariant(i, key, val) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[i] = { ...variants[i], [key]: val };
      return { ...f, variants };
    });
  }
  function addVariant() {
    setForm((f) => ({ ...f, variants: [...f.variants, { flavour: '', size: '', sku: '', barcode: '', mrp: '', sellingPrice: '', purchasePrice: '', stock: 0, minStockLevel: 3 }] }));
  }
  function removeVariant(i) {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        variants: form.variants.map((v) => ({
          ...v,
          mrp: rupeesToPaise(v.mrp),
          sellingPrice: rupeesToPaise(v.sellingPrice),
          purchasePrice: rupeesToPaise(v.purchasePrice),
          stock: Math.max(0, Number(v.stock) || 0),
          minStockLevel: Math.max(0, Number(v.minStockLevel) || 3),
        })),
      };
      if (isEdit) {
        await productsApi.update(product._id, payload);
      } else {
        await productsApi.create(payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-elevated z-10">
          <h2 className="font-bold text-text text-lg">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface text-muted hover:text-text"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Product Name', key: 'name', placeholder: 'e.g. Whey Protein Isolate' },
              { label: 'Brand', key: 'brand', placeholder: 'e.g. MuscleBlaze' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">{label}</label>
                <input
                  value={form[key]} onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder} required
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-primary"
                />
              </div>
            ))}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider">Category</label>
                <button
                  type="button"
                  onClick={() => setShowAddCategory((v) => !v)}
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> {showAddCategory ? 'Cancel' : 'New Category'}
                </button>
              </div>

              {showAddCategory && (
                <div className="flex gap-2 mb-2">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New category name..."
                    autoFocus
                    className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={catCreating || !newCatName.trim()}
                    onClick={handleCreateCategory}
                    className="bg-primary text-primary-ink font-bold px-3 py-2 rounded-xl text-xs hover:brightness-110 disabled:opacity-50"
                  >
                    {catCreating ? 'Adding...' : 'Add'}
                  </button>
                </div>
              )}

              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                required
                className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary"
              >
                {categories.length === 0 && (
                  <option value="">-- No Categories (Click "+ New Category" above) --</option>
                )}
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">GST Rate</label>
              <select value={form.gstRate} onChange={(e) => setField('gstRate', Number(e.target.value))}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary">
                {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">HSN Code</label>
              <input value={form.hsn} onChange={(e) => setField('hsn', e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary" />
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Variants</span>
              <button type="button" onClick={addVariant}
                className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add Variant
              </button>
            </div>
            {form.variants.map((v, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-4 mb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">Variant {i + 1}</span>
                  {form.variants.length > 1 && (
                    <button type="button" onClick={() => removeVariant(i)} className="text-danger/70 hover:text-danger">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Flavour', key: 'flavour', placeholder: 'Chocolate' },
                    { label: 'Size', key: 'size', placeholder: '1 kg' },
                    { label: 'SKU', key: 'sku', placeholder: 'MB-WPI-CHO-1KG' },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">{label}</label>
                      <input value={v[key] || ''} onChange={(e) => setVariant(i, key, e.target.value)}
                        placeholder={placeholder} required={key !== 'barcode'}
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-primary" />
                    </div>
                  ))}
                  {[
                    { label: 'MRP (₹)', key: 'mrp' },
                    { label: 'Selling Price (₹)', key: 'sellingPrice' },
                    { label: 'Purchase Price (₹)', key: 'purchasePrice' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">{label}</label>
                      <input type="number" step="0.01" min="0" value={v[key] || ''} onChange={(e) => setVariant(i, key, e.target.value)}
                        required
                        className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-sm text-text focus:outline-none focus:border-primary" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                      Stock / Opening Units
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={v.stock ?? 0}
                      onChange={(e) => setVariant(i, 'stock', e.target.value)}
                      placeholder="0"
                      className="w-full bg-bg border border-primary/40 rounded-lg px-2.5 py-2 text-sm text-text font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Min Stock Alert</label>
                    <input type="number" min="0" value={v.minStockLevel ?? 3} onChange={(e) => setVariant(i, 'minStockLevel', e.target.value)}
                      className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-sm text-text focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-xl px-4 py-3">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-muted text-sm font-semibold hover:border-primary/40 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 transition-all disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Quick Stock Modal ----
function QuickStockModal({ product, variant, onSave, onClose }) {
  const [addQty, setAddQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const qty = parseInt(addQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid positive number of units');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updatedVariants = product.variants.map((v) => {
        if (v._id === variant._id) {
          return {
            ...v,
            stock: (v.stock || 0) + qty,
          };
        }
        return v;
      });

      await productsApi.update(product._id, {
        name: product.name,
        brand: product.brand,
        category: product.category?._id || product.category,
        hsn: product.hsn,
        gstRate: product.gstRate,
        description: product.description,
        variants: updatedVariants,
      });

      onSave();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update stock');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-text text-base">Add Stock</h3>
            <p className="text-muted text-xs">{product.name} ({variant.flavour} · {variant.size})</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-3 flex justify-between items-center text-xs">
            <span className="text-muted font-medium">Current Stock on Hand:</span>
            <span className="font-bold text-text text-sm">{variant.stock || 0} units</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Units to Add
            </label>
            <input
              type="number"
              min="1"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              placeholder="e.g. 10"
              autoFocus
              required
              className="w-full bg-bg border border-primary/40 rounded-xl px-3 py-2.5 text-base text-text font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {addQty && Number(addQty) > 0 && (
              <p className="text-xs text-primary mt-1.5 font-medium">
                New stock total will be: {(variant.stock || 0) + Number(addQty)} units
              </p>
            )}
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-primary/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !addQty}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Main Page ----
export function ProductsPage() {
  const { isOwner } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [quickStockTarget, setQuickStockTarget] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.list({ search, category: selectedCat, isActive: 'all' }),
        categoriesApi.list(),
      ]);
      setProducts(prodRes.data.data.products);
      setCategories(catRes.data.data.categories);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCat]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(id) {
    await productsApi.toggleActive(id);
    load();
  }

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-text tracking-tight">Products</h1>
          <p className="text-muted text-sm mt-0.5">{products.length} products</p>
        </div>
        {isOwner && (
          <button onClick={() => { setEditProduct(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-primary text-primary-ink font-bold px-4 py-2.5 rounded-xl text-sm hover:brightness-110 transition-all active:scale-95">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, brand, SKU…"
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCat('')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${selectedCat === '' ? 'bg-primary text-primary-ink border-primary' : 'bg-surface border-border text-muted hover:border-primary/40'}`}>
            All
          </button>
          {categories.map((c) => (
            <button key={c._id} onClick={() => setSelectedCat(c._id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${selectedCat === c._id ? 'bg-primary text-primary-ink border-primary' : 'bg-surface border-border text-muted hover:border-primary/40'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-surface border border-border rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No products found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const isExpanded = expanded[p._id];
            const totalStock = p.variants.reduce((s, v) => s + (v.stock || 0), 0);
            return (
              <div key={p._id} className={`bg-surface border rounded-2xl transition-all ${p.isActive ? 'border-border' : 'border-border opacity-60'}`}>
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggleExpand(p._id)}>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text text-sm truncate">{p.name}</p>
                    <p className="text-muted text-xs">{p.brand} · {p.category?.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-text">Stock: {totalStock}</p>
                    <p className="text-xs text-muted">{p.variants.length} variant{p.variants.length !== 1 ? 's' : ''}</p>
                  </div>
                  {isOwner && (
                    <button onClick={(e) => { e.stopPropagation(); handleToggle(p._id); }}
                      className="ml-2 text-muted hover:text-primary transition-colors">
                      {p.isActive ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  )}
                  {isOwner && (
                    <button onClick={(e) => { e.stopPropagation(); setEditProduct(p); setShowForm(true); }}
                      className="ml-1 text-muted hover:text-primary transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                </div>
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted">
                            <th className="text-left pb-2 font-semibold">Flavour / Size</th>
                            <th className="text-right pb-2 font-semibold">MRP</th>
                            <th className="text-right pb-2 font-semibold">Price</th>
                            {isOwner && <th className="text-right pb-2 font-semibold">Cost</th>}
                            <th className="text-right pb-2 font-semibold">Stock</th>
                            <th className="text-left pb-2 font-semibold pl-3">SKU</th>
                            {isOwner && <th className="text-right pb-2 font-semibold">Stock Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {p.variants.map((v) => {
                            const isLow = v.stock <= (v.minStockLevel || 3);
                            return (
                              <tr key={v._id} className="border-t border-border/50">
                                <td className="py-2 text-text">{v.flavour} · {v.size}</td>
                                <td className="text-right text-muted">{formatINR(v.mrp)}</td>
                                <td className="text-right text-text font-semibold">{formatINR(v.sellingPrice)}</td>
                                {isOwner && <td className="text-right text-muted">{formatINR(v.purchasePrice)}</td>}
                                <td className={`text-right font-bold ${isLow ? 'text-warning' : 'text-success'}`}>{v.stock}</td>
                                <td className="text-left pl-3 text-muted font-mono">{v.sku}</td>
                                {isOwner && (
                                  <td className="text-right py-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickStockTarget({ product: p, variant: v });
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold text-[11px] transition-colors"
                                    >
                                      <Plus className="w-3 h-3" /> Add Stock
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editProduct}
          categories={categories}
          onSave={() => { setShowForm(false); setEditProduct(null); load(); }}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
          onCategoryCreated={(newCat) => setCategories((prev) => [...prev, newCat])}
        />
      )}

      {quickStockTarget && (
        <QuickStockModal
          product={quickStockTarget.product}
          variant={quickStockTarget.variant}
          onSave={() => { setQuickStockTarget(null); load(); }}
          onClose={() => setQuickStockTarget(null)}
        />
      )}
    </div>
  );
}
