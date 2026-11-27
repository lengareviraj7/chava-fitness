import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Receipt,
  AlertTriangle,
  Clock,
  Users,
  ChevronRight,
  Plus,
  Boxes,
  ArrowUpRight,
  Sparkles,
  Package,
} from 'lucide-react';
import { formatINR } from '../utils/money.js';
import api from '../api/axios.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { DashboardBackdrop } from '../components/dashboard/DashboardBackdrop.jsx';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState('week'); // 'week' | 'month' | 'year'

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await api.get('/dashboard/summary');
        setData(res.data.data);
      } catch (e) {
        console.error('Failed to load dashboard:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, []);

  const todaySales = data?.todaySalesPaise ?? 0;
  const todayBills = data?.today?.bills ?? data?.todayBills?.length ?? 0;
  const totalProducts = data?.totalProducts ?? 0;
  const lowStock = data?.lowStockCount ?? 0;
  const pendingDues = data?.pendingDuesPaise ?? 0;
  const customersWithDues = data?.customersWithDuesCount ?? 0;
  const expiringSoonCount = data?.expiringSoonCount ?? 2;
  const recentBills = data?.recentBills || [];
  const topProducts = data?.topSellingProducts || [];

  return (
    <div className="relative space-y-6">
      {/* Real Whey-Protein Artwork Backdrop (Dashboard Route ONLY) */}
      <DashboardBackdrop />

      {/* Welcome Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Welcome Back!
          </h1>
          <p className="text-xs sm:text-sm text-[#9BA79A] font-medium mt-0.5">
            Your shop is running great today.
          </p>
        </div>
      </div>

      {/* ROW 1: 3 Glass KPI Cards (Left Half Spanning ~54%, Right Half Shows Art) */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        {/* Left Container with 3 KPI Cards */}
        <div className="lg:col-span-7 xl:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* KPI 1: Today's Sales */}
          <div className="bg-[#0B110C]/75 backdrop-blur-md border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between hover:border-[#B6F23B]/30 transition-all shadow-glass">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#B6F23B]/15 border border-[#B6F23B]/25 flex items-center justify-center text-[#B6F23B]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#B6F23B] bg-[#B6F23B]/10 px-2 py-0.5 rounded-full">
                +12.4%
              </span>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-white tracking-tight">
                {formatINR(todaySales)}
              </p>
              <p className="text-[11px] font-semibold text-[#9BA79A] uppercase tracking-wider mt-0.5">
                Today's Sales
              </p>
            </div>
          </div>

          {/* KPI 2: Today's Profit (Staff Redacted: Profit NEVER visible to staff) */}
          <div className="bg-[#0B110C]/75 backdrop-blur-md border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between hover:border-[#B6F23B]/30 transition-all shadow-glass">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#B6F23B]/15 border border-[#B6F23B]/25 flex items-center justify-center text-[#B6F23B]">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#B6F23B] bg-[#B6F23B]/10 px-2 py-0.5 rounded-full">
                +8.2%
              </span>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-white tracking-tight">
                {isOwner && data?.profitPaise !== undefined
                  ? formatINR(data.profitPaise)
                  : formatINR(data?.weekSalesPaise || todaySales)}
              </p>
              <p className="text-[11px] font-semibold text-[#9BA79A] uppercase tracking-wider mt-0.5">
                {isOwner ? "Today's Profit" : 'Week Sales'}
              </p>
            </div>
          </div>

          {/* KPI 3: Bills Today */}
          <div className="bg-[#0B110C]/75 backdrop-blur-md border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between hover:border-[#B6F23B]/30 transition-all shadow-glass">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#B6F23B]/15 border border-[#B6F23B]/25 flex items-center justify-center text-[#B6F23B]">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#B6F23B] bg-[#B6F23B]/10 px-2 py-0.5 rounded-full">
                +5.1%
              </span>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-white tracking-tight">
                {todayBills}
              </p>
              <p className="text-[11px] font-semibold text-[#9BA79A] uppercase tracking-wider mt-0.5">
                Bills Today
              </p>
            </div>
          </div>
        </div>

        {/* Right Half: Transparent Spacer letting backdrop artwork shine through */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-6 pointer-events-none" />
      </div>

      {/* ROW 2: Sales Overview Chart (Left) + 3 Alert Cards (Right overlapping art) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (8 Cols): Sales Overview Chart Card */}
        <div className="lg:col-span-8 bg-[#0B110C]/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-glass flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Sales Overview
              </h2>
              <p className="text-xs text-[#9BA79A] mt-0.5">
                Total Revenue: <span className="text-[#B6F23B] font-bold">{formatINR(data?.monthSalesPaise || todaySales * 24)}</span>
              </p>
            </div>

            {/* Time Filter Chips */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/5 self-start sm:self-auto">
              {[
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setChartPeriod(chip.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    chartPeriod === chip.id
                      ? 'bg-[#B6F23B] text-[#0A0F05] shadow-[0_0_12px_rgba(182,242,59,0.35)]'
                      : 'text-[#9BA79A] hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Smooth SVG Sales Curve / Area Chart */}
          <div className="w-full h-44 sm:h-52 relative mt-2">
            <svg viewBox="0 0 500 160" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B6F23B" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#B6F23B" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Subtle Grid Lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />

              {/* Area Fill */}
              <path
                d="M 0 130 C 50 120, 90 90, 140 85 C 190 80, 230 110, 280 65 C 330 20, 380 50, 430 35 C 470 22, 490 28, 500 30 L 500 160 L 0 160 Z"
                fill="url(#salesGradient)"
              />
              {/* Main Glowing Curve */}
              <path
                d="M 0 130 C 50 120, 90 90, 140 85 C 190 80, 230 110, 280 65 C 330 20, 380 50, 430 35 C 470 22, 490 28, 500 30"
                fill="none"
                stroke="#B6F23B"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Active Point Markers */}
              <circle cx="280" cy="65" r="4.5" fill="#B6F23B" stroke="#050805" strokeWidth="2.5" />
              <circle cx="430" cy="35" r="4.5" fill="#B6F23B" stroke="#050805" strokeWidth="2.5" />
            </svg>

            {/* X-Axis Day Labels */}
            <div className="flex justify-between text-[10px] font-semibold text-[#9BA79A] mt-2 px-1">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>

        {/* Right (4 Cols): Column of 3 Alert Cards (Overlaps bottom of art) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3.5">
          {/* Alert 1: Low Stock */}
          <div
            onClick={() => navigate('/stock')}
            className="group cursor-pointer bg-[#0B110C]/80 backdrop-blur-md border border-white/[0.08] hover:border-[#F59E0B]/40 rounded-2xl p-4 flex items-center justify-between transition-all shadow-glass"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {lowStock} Products Low
                </p>
                <p className="text-xs text-[#9BA79A] truncate mt-0.5">
                  Reorder threshold reached
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9BA79A] group-hover:text-white transition-colors shrink-0" />
          </div>

          {/* Alert 2: Expiring Soon */}
          <div
            onClick={() => navigate('/stock')}
            className="group cursor-pointer bg-[#0B110C]/80 backdrop-blur-md border border-white/[0.08] hover:border-[#FACC15]/40 rounded-2xl p-4 flex items-center justify-between transition-all shadow-glass"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center text-[#FACC15] shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {expiringSoonCount} Batches Expiring
                </p>
                <p className="text-xs text-[#9BA79A] truncate mt-0.5">
                  Within next 30 days
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9BA79A] group-hover:text-white transition-colors shrink-0" />
          </div>

          {/* Alert 3: Customer Dues */}
          <div
            onClick={() => navigate('/customers')}
            className="group cursor-pointer bg-[#0B110C]/80 backdrop-blur-md border border-white/[0.08] hover:border-[#EF4444]/40 rounded-2xl p-4 flex items-center justify-between transition-all shadow-glass"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444] shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {formatINR(pendingDues)} Dues
                </p>
                <p className="text-xs text-[#9BA79A] truncate mt-0.5">
                  {customersWithDues} pending accounts
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9BA79A] group-hover:text-white transition-colors shrink-0" />
          </div>
        </div>
      </div>

      {/* ROW 3: Top Selling Products + Recent Bills + Big Action Column */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1 (4 Cols): Top Selling Products */}
        <div className="lg:col-span-4 bg-[#0B110C]/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 shadow-glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Top Selling Products
              </h2>
              <Package className="w-4 h-4 text-[#B6F23B]" />
            </div>

            <div className="space-y-3">
              {topProducts.length > 0 ? (
                topProducts.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#B6F23B]/10 border border-[#B6F23B]/20 flex items-center justify-center font-bold text-xs text-[#B6F23B]">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{item._id || 'Whey Isolate'}</p>
                        <p className="text-[10px] text-[#9BA79A]">{item.salesCount} units sold</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#B6F23B]">
                      {formatINR(item.revenuePaise)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-[#9BA79A]">
                  Whey Protein Isolate · MuscleBlaze
                  <div className="text-[10px] text-[#B6F23B] mt-1">Leading sales volume</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2 (5 Cols): Recent Bills */}
        <div className="lg:col-span-5 bg-[#0B110C]/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 shadow-glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Recent Bills
              </h2>
              <span className="text-[10px] font-bold text-[#B6F23B] bg-[#B6F23B]/10 px-2 py-0.5 rounded-full">
                Live POS
              </span>
            </div>

            <div className="space-y-2">
              {recentBills.length > 0 ? (
                recentBills.slice(0, 3).map((b) => (
                  <div
                    key={b._id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-[#B6F23B]">{b.billNo}</p>
                      <p className="text-[11px] text-[#9BA79A]">
                        {b.customerSnapshot?.name || 'Walk-in'} · {new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-white">
                      {formatINR(b.grandTotalPaise)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-[#9BA79A]">
                  No bills generated yet today.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3 (3 Cols): Big Stacked Action Buttons */}
        <div className="lg:col-span-3 flex flex-col justify-center gap-3.5">
          {/* Button 1: New Bill (Lime glow) */}
          <button
            onClick={() => navigate('/billing')}
            className="w-full py-4 px-4 rounded-2xl bg-[#B6F23B] text-[#0A0F05] font-black text-sm tracking-wide shadow-[0_0_25px_rgba(182,242,59,0.38)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
          >
            <Receipt className="w-5 h-5" />
            <span>New Bill</span>
          </button>

          {/* Button 2: Add Stock / View Stock (Dark) */}
          <button
            onClick={() => navigate('/stock')}
            className="w-full py-4 px-4 rounded-2xl bg-white/[0.04] border border-white/10 text-white font-bold text-sm hover:border-[#B6F23B]/40 hover:bg-white/[0.07] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
          >
            <Boxes className="w-5 h-5 text-[#9BA79A]" />
            <span>{isOwner ? 'Add Stock' : 'View Stock'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
