import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Package,
  Users,
  Receipt,
  Truck,
  Compass,
  ArrowRight,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import api from '../../api/axios.js';
import { formatINR } from '../../utils/money.js';

export function CommandPaletteModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({
    products: [],
    customers: [],
    bills: [],
    suppliers: [],
    navItems: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      search('');
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global keydown: Escape to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  async function search(q) {
    setLoading(true);
    try {
      const res = await api.get('/search', { params: { q } });
      setResults(res.data.data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    search(val);
  }

  function handleSelect(path) {
    onClose();
    navigate(path);
  }

  if (!isOpen) return null;

  const hasAnyResults =
    results.navItems.length > 0 ||
    results.products.length > 0 ||
    results.customers.length > 0 ||
    results.bills.length > 0 ||
    results.suppliers.length > 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-start justify-center p-4 sm:pt-20">
      <div className="bg-[#0B110C] border border-white/15 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-white/[0.02]">
          <Search className="w-5 h-5 text-[#B6F23B] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search products, customers, bills, suppliers, or pages..."
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-[#9BA79A] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                search('');
                inputRef.current?.focus();
              }}
              className="text-[#9BA79A] hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/70 border border-white/10 shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading && (
            <div className="py-8 text-center text-xs text-[#9BA79A] animate-pulse">
              Searching across records...
            </div>
          )}

          {!loading && !hasAnyResults && (
            <div className="py-12 text-center space-y-2">
              <Search className="w-8 h-8 text-[#9BA79A]/40 mx-auto" />
              <p className="text-sm font-semibold text-white">No matches found for "{query}"</p>
              <p className="text-xs text-[#9BA79A]">
                Try searching by product name, barcode, customer phone, or bill number.
              </p>
            </div>
          )}

          {/* Quick Page Navigation */}
          {results.navItems?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#9BA79A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#B6F23B]" /> Quick Navigation
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {results.navItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(item.path)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#B6F23B]/40 hover:bg-[#B6F23B]/10 text-left transition-all group"
                  >
                    <span className="text-xs font-semibold text-white group-hover:text-[#B6F23B]">
                      {item.title}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#9BA79A] group-hover:text-[#B6F23B] transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {results.products?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#9BA79A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#B6F23B]" /> Products ({results.products.length})
              </p>
              <div className="space-y-1.5">
                {results.products.map((prod) => (
                  <div
                    key={prod._id}
                    onClick={() => handleSelect('/products')}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#B6F23B]/40 hover:bg-white/[0.05] cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{prod.name}</p>
                      <p className="text-[11px] text-[#9BA79A]">
                        {prod.brand} • {prod.variants?.length || 0} variant(s)
                      </p>
                    </div>
                    <div className="text-right">
                      {prod.variants?.[0] && (
                        <>
                          <p className="text-xs font-bold text-[#B6F23B]">
                            {formatINR(prod.variants[0].sellingPrice)}
                          </p>
                          <p className="text-[10px] text-[#9BA79A]">
                            Stock: {prod.variants[0].stock}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers */}
          {results.customers?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#9BA79A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#B6F23B]" /> Customers ({results.customers.length})
              </p>
              <div className="space-y-1.5">
                {results.customers.map((cust) => (
                  <div
                    key={cust._id}
                    onClick={() => handleSelect('/customers')}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#B6F23B]/40 hover:bg-white/[0.05] cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{cust.name}</p>
                      <p className="text-[11px] text-[#9BA79A]">
                        {cust.phone} {cust.address ? `• ${cust.address}` : ''}
                      </p>
                    </div>
                    {cust.dueBalancePaise > 0 ? (
                      <span className="text-xs font-bold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 px-2 py-0.5 rounded-md">
                        Due: {formatINR(cust.dueBalancePaise)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#9BA79A]">Clear</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bills */}
          {results.bills?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#9BA79A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-[#B6F23B]" /> Invoices & Bills ({results.bills.length})
              </p>
              <div className="space-y-1.5">
                {results.bills.map((bill) => (
                  <div
                    key={bill._id}
                    onClick={() => handleSelect('/billing')}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#B6F23B]/40 hover:bg-white/[0.05] cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white font-mono">{bill.billNo}</p>
                      <p className="text-[11px] text-[#9BA79A]">
                        {bill.customerSnapshot?.name || 'Walk-in'} •{' '}
                        {new Date(bill.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-[#B6F23B]">
                        {formatINR(bill.grandTotalPaise)}
                      </p>
                      {bill.duePaise > 0 && (
                        <p className="text-[10px] text-[#EF4444]">
                          Udhari: {formatINR(bill.duePaise)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suppliers */}
          {results.suppliers?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#9BA79A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#B6F23B]" /> Suppliers ({results.suppliers.length})
              </p>
              <div className="space-y-1.5">
                {results.suppliers.map((sup) => (
                  <div
                    key={sup._id}
                    onClick={() => handleSelect('/stock')}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#B6F23B]/40 hover:bg-white/[0.05] cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{sup.name}</p>
                      <p className="text-[11px] text-[#9BA79A]">{sup.phone}</p>
                    </div>
                    <span className="text-[11px] text-[#B6F23B] font-semibold">
                      View Ledger →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[11px] text-[#9BA79A]">
          <span>Type to search across everything in the ERP</span>
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/70">ESC</kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
