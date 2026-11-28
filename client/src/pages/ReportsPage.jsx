import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Boxes,
  IndianRupee,
  Clock,
  Calendar,
  Printer,
  AlertTriangle,
  Lock,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { reportsApi } from '../api/reports.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatINR } from '../utils/money.js';

export function ReportsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'gstr1' | 'stock' | 'pnl' | 'dues' | 'velocity'
  const [preset, setPreset] = useState('this_month'); // 'today' | 'last_7_days' | 'this_month' | 'this_year'
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setReportData(null);
    try {
      let res;
      if (activeTab === 'sales') {
        res = await reportsApi.getSales({ preset });
      } else if (activeTab === 'gstr1') {
        res = await reportsApi.getGstr1({ preset });
      } else if (activeTab === 'stock') {
        res = await reportsApi.getStockValuation();
      } else if (activeTab === 'pnl') {
        if (!isOwner) return;
        res = await reportsApi.getProfitLoss({ preset });
      } else if (activeTab === 'dues') {
        res = await reportsApi.getDuesAging();
      } else if (activeTab === 'velocity') {
        res = await reportsApi.getFastSlowMoving();
      }
      if (res) {
        setReportData(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, preset, isOwner]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const tabs = [
    { id: 'sales', label: 'Sales Summary', icon: Receipt },
    { id: 'gstr1', label: 'GSTR-1 Register', icon: FileSpreadsheet },
    { id: 'stock', label: 'Stock Valuation', icon: Boxes },
    ...(isOwner ? [{ id: 'pnl', label: 'Profit & Loss', icon: TrendingUp }] : []),
    { id: 'dues', label: 'Dues Aging', icon: Clock },
    { id: 'velocity', label: 'Fast/Slow Moving', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" /> Reports & Financial Hub
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-0.5">
            Real-time GST registers, inventory valuation, customer dues aging, and sales velocity
          </p>
        </div>

        {/* Date Preset Selector (only for period-based reports) */}
        {['sales', 'gstr1', 'pnl'].includes(activeTab) && (
          <div className="flex items-center gap-1 bg-surface border border-border p-1 rounded-xl self-start sm:self-auto">
            {[
              { id: 'today', label: 'Today' },
              { id: 'last_7_days', label: '7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'this_year', label: 'This Year' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  preset === p.id
                    ? 'bg-primary text-primary-ink font-bold shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-16 text-center text-muted space-y-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Computing report metrics...</p>
        </div>
      ) : !reportData ? (
        <div className="py-16 text-center text-muted">No data available for this report</div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: SALES SUMMARY */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Gross Sales</span>
                  <p className="text-xl font-black text-text mt-1">{formatINR(reportData.summary?.grossSalesPaise || 0)}</p>
                  <p className="text-[11px] text-muted mt-1">{reportData.summary?.billsCount || 0} bills completed</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Returns / Credit Notes</span>
                  <p className="text-xl font-black text-danger mt-1">-{formatINR(reportData.summary?.returnsTotalPaise || 0)}</p>
                  <p className="text-[11px] text-muted mt-1">{reportData.summary?.returnsCount || 0} returned</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Net Sales (Headline)</span>
                  <p className="text-xl font-black text-primary mt-1">{formatINR(reportData.summary?.netSalesPaise || 0)}</p>
                  <p className="text-[11px] text-muted mt-1">Gross minus Returns</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">GST Collected</span>
                  <p className="text-xl font-black text-text mt-1">{formatINR(reportData.summary?.netGstPaise || 0)}</p>
                  <p className="text-[11px] text-muted mt-1">CGST + SGST + IGST</p>
                </div>
              </div>

              {/* Payment Mode Collections */}
              <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-text uppercase tracking-wider">Payment Mode Receipts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-bg border border-border rounded-xl p-3 flex justify-between items-center">
                    <span className="text-xs text-muted font-semibold">Cash Receipts</span>
                    <span className="font-extrabold text-text">{formatINR(reportData.paymentModes?.cashPaid || 0)}</span>
                  </div>
                  <div className="bg-bg border border-border rounded-xl p-3 flex justify-between items-center">
                    <span className="text-xs text-muted font-semibold">UPI Receipts</span>
                    <span className="font-extrabold text-primary">{formatINR(reportData.paymentModes?.upiPaid || 0)}</span>
                  </div>
                  <div className="bg-bg border border-border rounded-xl p-3 flex justify-between items-center">
                    <span className="text-xs text-muted font-semibold">Card Receipts</span>
                    <span className="font-extrabold text-text">{formatINR(reportData.paymentModes?.cardPaid || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GSTR-1 OUTWARD REGISTER */}
          {activeTab === 'gstr1' && (
            <div className="space-y-6">
              {/* B2CS by Rate Table */}
              <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                  B2CS Intra-State Consumer Supplies (by GST Rate)
                </h3>
                {reportData.b2cs?.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No B2CS sales recorded in this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted border-b border-border pb-2">
                          <th className="text-left pb-2">GST Rate</th>
                          <th className="text-right pb-2">Taxable Value</th>
                          <th className="text-right pb-2">CGST</th>
                          <th className="text-right pb-2">SGST</th>
                          <th className="text-right pb-2">Total Invoice Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reportData.b2cs?.map((row) => (
                          <tr key={row.gstRate} className="hover:bg-bg/50">
                            <td className="py-2.5 font-bold text-text">{row.gstRate}%</td>
                            <td className="py-2.5 text-right text-text">{formatINR(row.taxablePaise)}</td>
                            <td className="py-2.5 text-right text-muted">{formatINR(row.cgstPaise)}</td>
                            <td className="py-2.5 text-right text-muted">{formatINR(row.sgstPaise)}</td>
                            <td className="py-2.5 text-right font-bold text-primary">{formatINR(row.totalPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* B2B Table if any */}
              {reportData.b2b?.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-text uppercase tracking-wider">B2B Registered Invoices</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted border-b border-border pb-2">
                          <th className="text-left pb-2">Bill No</th>
                          <th className="text-left pb-2">Customer / GSTIN</th>
                          <th className="text-right pb-2">Taxable</th>
                          <th className="text-right pb-2">Total GST</th>
                          <th className="text-right pb-2">Grand Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reportData.b2b?.map((row) => (
                          <tr key={row.billNo} className="hover:bg-bg/50">
                            <td className="py-2.5 font-bold text-text font-mono">{row.billNo}</td>
                            <td className="py-2.5 text-text">
                              {row.customerName} <span className="font-mono text-muted text-[10px]">({row.gstin})</span>
                            </td>
                            <td className="py-2.5 text-right text-text">{formatINR(row.taxablePaise)}</td>
                            <td className="py-2.5 text-right text-muted">{formatINR(row.cgstPaise + row.sgstPaise + row.igstPaise)}</td>
                            <td className="py-2.5 text-right font-bold text-primary">{formatINR(row.grandTotalPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STOCK VALUATION */}
          {activeTab === 'stock' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Inventory Cost Value</span>
                  <p className="text-xl font-black text-text mt-1">{formatINR(reportData.summary?.totalCostValuationPaise || 0)}</p>
                  <p className="text-[11px] text-muted mt-1">{reportData.summary?.totalBatches || 0} active batches</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Potential Retail Value</span>
                  <p className="text-xl font-black text-primary mt-1">{formatINR(reportData.summary?.totalRetailValuationPaise || 0)}</p>
                  <p className="text-[11px] text-muted mt-1">At selling price</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Potential Margin</span>
                  <p className="text-xl font-black text-success mt-1">{reportData.summary?.marginPct || 0}%</p>
                  <p className="text-[11px] text-muted mt-1">{formatINR(reportData.summary?.potentialProfitPaise || 0)} profit</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Value at Risk (30d)</span>
                  <p className="text-xl font-black text-warning mt-1">{formatINR(reportData.expiryBuckets?.within30dValuePaise || 0)}</p>
                  <p className="text-[11px] text-muted mt-1">Expiring within 30 days</p>
                </div>
              </div>

              {/* Batches Table */}
              <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-text uppercase tracking-wider">Active Batches Inventory</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted border-b border-border pb-2">
                        <th className="text-left pb-2">Product & Flavour</th>
                        <th className="text-left pb-2 font-mono">Batch No</th>
                        <th className="text-left pb-2">Expiry Date</th>
                        <th className="text-right pb-2">Qty Left</th>
                        <th className="text-right pb-2">Unit Cost</th>
                        <th className="text-right pb-2">Total Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reportData.batches?.map((b) => (
                        <tr key={b.batchId} className="hover:bg-bg/50">
                          <td className="py-2.5 font-bold text-text">
                            {b.productName} <span className="text-muted font-normal text-[11px]">{b.variantName}</span>
                          </td>
                          <td className="py-2.5 font-mono text-muted">{b.batchNo}</td>
                          <td className={`py-2.5 ${b.isExpired ? 'text-danger font-bold' : 'text-text'}`}>
                            {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-IN') : 'No Expiry'}
                          </td>
                          <td className="py-2.5 text-right font-bold text-text">{b.qtyLeft}</td>
                          <td className="py-2.5 text-right text-muted">{formatINR(b.unitCostPaise)}</td>
                          <td className="py-2.5 text-right font-bold text-primary">{formatINR(b.costValuationPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROFIT & LOSS (OWNER ONLY) */}
          {activeTab === 'pnl' && isOwner && (
            <div className="space-y-6 max-w-2xl">
              <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-text">Income Statement Breakdown</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted">Net Taxable Revenue (excl. GST)</span>
                    <span className="font-extrabold text-text">{formatINR(reportData.netTaxableRevenuePaise || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted">Cost of Goods Sold (COGS)</span>
                    <span className="font-bold text-danger">-{formatINR(reportData.netCogsPaise || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border bg-white/[0.05] px-2 rounded-lg">
                    <span className="font-bold text-text">Gross Profit</span>
                    <div className="text-right">
                      <span className="font-extrabold text-success">{formatINR(reportData.grossProfitPaise || 0)}</span>
                      <span className="text-xs text-muted block">Margin: {reportData.grossMarginPct || 0}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted">Stock Losses / Write-offs</span>
                    <span className="font-bold text-danger">-{formatINR(reportData.stockLossesPaise || 0)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-border text-base bg-primary/10 px-3 rounded-xl">
                    <span className="font-black text-text">Net Profit After Stock Losses</span>
                    <span className="font-black text-primary">{formatINR(reportData.netProfitPaise || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DUES AGING */}
          {activeTab === 'dues' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">0 - 15 Days</span>
                  <p className="text-xl font-black text-text mt-1">{formatINR(reportData.buckets?.b0to15Paise || 0)}</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">16 - 30 Days</span>
                  <p className="text-xl font-black text-warning mt-1">{formatINR(reportData.buckets?.b16to30Paise || 0)}</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">31 - 60 Days</span>
                  <p className="text-xl font-black text-danger mt-1">{formatINR(reportData.buckets?.b31to60Paise || 0)}</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">60+ Days (Critical)</span>
                  <p className="text-xl font-black text-danger mt-1">{formatINR(reportData.buckets?.b60plusPaise || 0)}</p>
                </div>
              </div>

              {/* Customers Due List */}
              <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-text uppercase tracking-wider">Customer Due Accounts</h3>
                {reportData.customers?.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No outstanding customer dues recorded!</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted border-b border-border pb-2">
                          <th className="text-left pb-2">Customer Name</th>
                          <th className="text-left pb-2">Phone</th>
                          <th className="text-right pb-2">Days Outstanding</th>
                          <th className="text-right pb-2">Due Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reportData.customers?.map((c) => (
                          <tr key={c.customerId} className="hover:bg-bg/50">
                            <td className="py-2.5 font-bold text-text">{c.name}</td>
                            <td className="py-2.5 font-mono text-muted">{c.phone}</td>
                            <td className="py-2.5 text-right font-bold text-warning">{c.daysAging} days</td>
                            <td className="py-2.5 text-right font-black text-danger">{formatINR(c.dueBalancePaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: FAST / SLOW MOVING & REORDER */}
          {activeTab === 'velocity' && (
            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                  Product Sales Velocity & Reorder Recommendations
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted border-b border-border pb-2">
                        <th className="text-left pb-2">Product & Flavour</th>
                        <th className="text-right pb-2">Current Stock</th>
                        <th className="text-right pb-2">30d Sold</th>
                        <th className="text-right pb-2">Daily Avg</th>
                        <th className="text-right pb-2">Stock Cover</th>
                        <th className="text-right pb-2">Suggested Reorder</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reportData.items?.map((item) => (
                        <tr key={item.variantId} className="hover:bg-bg/50">
                          <td className="py-2.5 font-bold text-text">
                            {item.productName} <span className="text-muted font-normal text-[11px]">{item.flavour} · {item.size}</span>
                          </td>
                          <td className={`py-2.5 text-right font-bold ${item.status === 'critical' ? 'text-danger' : 'text-text'}`}>
                            {item.stock}
                          </td>
                          <td className="py-2.5 text-right font-extrabold text-primary">{item.unitsSold30d}</td>
                          <td className="py-2.5 text-right text-muted">{item.avgDailySale}</td>
                          <td className="py-2.5 text-right text-text">
                            {item.daysOfStockLeft >= 999 ? '∞' : `${item.daysOfStockLeft}d`}
                          </td>
                          <td className="py-2.5 text-right font-black text-success">
                            {item.suggestedReorderQty > 0 ? `+${item.suggestedReorderQty} units` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
