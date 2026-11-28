import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle,
  Search,
  MessageCircle,
  Share2,
  Copy,
  Check,
  Send,
  X,
  CreditCard,
  User,
  MapPin,
  FileText,
  DollarSign,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import axios from '../../api/axios.js';
import { formatINR, paiseToRupees, rupeesToPaise } from '../../utils/money.js';

export function UdhariTab({ user, onBillSelect }) {
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({
    totalOutstandingPaise: 0,
    totalBillsCount: 0,
    dueSoonCount: 0,
    overdueCount: 0,
    totalCustomersCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'due_soon' | 'overdue'
  const [search, setSearch] = useState('');

  // Settlement Modal State
  const [settleModalBill, setSettleModalBill] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMode, setSettleMode] = useState('cash');
  const [settleRefNo, setSettleRefNo] = useState('');
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState('');
  const [settleSuccess, setSettleSuccess] = useState('');

  // Reminder Modal State
  const [reminderModalBill, setReminderModalBill] = useState(null);
  const [copiedReminder, setCopiedReminder] = useState(false);

  const fetchUdhariList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/billing/udhari', {
        params: { filter, search },
      });
      if (res.data?.data) {
        setBills(res.data.data.bills || []);
        setSummary(
          res.data.data.summary || {
            totalOutstandingPaise: 0,
            totalBillsCount: 0,
            dueSoonCount: 0,
            overdueCount: 0,
            totalCustomersCount: 0,
          }
        );
      }
    } catch (err) {
      console.error('Failed to load udhari list', err);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchUdhariList();
  }, [fetchUdhariList]);

  // Open Settle Modal
  function handleOpenSettle(bill) {
    setSettleModalBill(bill);
    setSettleAmount(paiseToRupees(bill.duePaise).toString());
    setSettleMode('cash');
    setSettleRefNo('');
    setSettleError('');
    setSettleSuccess('');
  }

  // Submit Settlement
  async function handleConfirmSettle(e) {
    e.preventDefault();
    if (!settleModalBill) return;

    const amtPaise = rupeesToPaise(Number(settleAmount));
    if (!amtPaise || amtPaise <= 0) {
      setSettleError('Please enter a valid payment amount');
      return;
    }

    setIsSettling(true);
    setSettleError('');
    try {
      const res = await axios.post(`/billing/udhari/${settleModalBill._id}/settle`, {
        amountPaise: amtPaise,
        mode: settleMode,
        refNo: settleRefNo,
      });

      setSettleSuccess(`Settled successfully! Receipt: ${res.data.data.receiptNo}`);
      setTimeout(() => {
        setSettleModalBill(null);
        fetchUdhariList();
      }, 1200);
    } catch (err) {
      setSettleError(err.response?.data?.error || 'Failed to settle udhari payment');
    } finally {
      setIsSettling(false);
    }
  }

  // Open Reminder Modal
  function handleOpenReminder(bill) {
    setReminderModalBill(bill);
    setCopiedReminder(false);
  }

  // Dispatch Reminder via WhatsApp Web/App
  async function handleSendWhatsAppReminder(bill) {
    if (!bill.phone) return;
    const cleanPhone = bill.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(bill.reminderMessage)}`;

    // Mark reminder as dispatched in server
    try {
      await axios.post(`/billing/udhari/${bill._id}/remind`, { stage: bill.stage });
    } catch (e) {
      console.warn('Failed to record reminder metadata', e);
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    fetchUdhariList();
  }

  // Copy Reminder SMS to Clipboard
  async function handleCopyReminder(message) {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedReminder(true);
      setTimeout(() => setCopiedReminder(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  }

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. TOP KPI SUMMARY METRICS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Outstanding Udhari */}
        <div className="bg-[#0D140F] border border-border p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
            ₹
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
              Total Udhari
            </span>
            <span className="text-xl font-black text-primary font-mono">
              {formatINR(summary.totalOutstandingPaise)}
            </span>
            <span className="text-[10px] text-muted block mt-0.5">
              {summary.totalBillsCount} pending bills
            </span>
          </div>
        </div>

        {/* Overdue Count */}
        <div className="bg-[#0D140F] border border-border p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center font-black shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
              Overdue Dues
            </span>
            <span className="text-xl font-black text-danger font-mono">
              {summary.overdueCount}
            </span>
            <span className="text-[10px] text-muted block mt-0.5">
              Immediate action needed
            </span>
          </div>
        </div>

        {/* Due in <= 3 Days */}
        <div className="bg-[#0D140F] border border-border p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center font-black shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
              Due in ≤ 3 Days
            </span>
            <span className="text-xl font-black text-warning font-mono">
              {summary.dueSoonCount}
            </span>
            <span className="text-[10px] text-muted block mt-0.5">
              Advance reminders ready
            </span>
          </div>
        </div>

        {/* Credit Customers */}
        <div className="bg-[#0D140F] border border-border p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-black shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
              Customers with Due
            </span>
            <span className="text-xl font-black text-purple-400 font-mono">
              {summary.totalCustomersCount}
            </span>
            <span className="text-[10px] text-muted block mt-0.5">
              Tracked in Visapur
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH & FILTER TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-[#0D140F] border border-border p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Segmented Buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Dues' },
            { id: 'due_soon', label: 'Due Soon (≤ 3 Days)' },
            { id: 'overdue', label: 'Overdue' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                filter === tab.id
                  ? 'bg-primary text-primary-ink shadow-sm'
                  : 'bg-surface text-muted hover:text-text border border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input & Refresh */}
        <div className="flex items-center gap-2 w-full sm:w-80">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, phone, village..."
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-text placeholder:text-muted/60 focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={fetchUdhariList}
            className="p-2 rounded-xl bg-surface border border-border text-muted hover:text-text hover:bg-surface-strong transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. UDHARI CUSTOMER CARDS & LIST */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-12 text-center text-muted text-sm bg-[#0D140F] border border-border rounded-2xl">
          Loading Udhari records...
        </div>
      ) : bills.length === 0 ? (
        <div className="p-12 text-center text-muted bg-[#0D140F] border border-border rounded-2xl space-y-2">
          <CheckCircle className="w-10 h-10 text-primary mx-auto opacity-70" />
          <h4 className="text-base font-bold text-white">No Pending Udhari Found</h4>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {filter !== 'all' || search
              ? 'No matching udhari records for the selected filters.'
              : 'All bills are completely settled! No outstanding credit dues.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {bills.map((bill) => {
            const isOverdue = bill.stage === 'overdue';
            const isDueSoon = bill.stage === 'due_in_3_days' || bill.stage === 'due_today';

            return (
              <div
                key={bill._id}
                className={`bg-[#0D140F] border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:border-primary/40 ${
                  isOverdue
                    ? 'border-danger/40'
                    : isDueSoon
                    ? 'border-warning/40'
                    : 'border-border'
                }`}
              >
                {/* Header: Customer info & Status pill */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <User className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate max-w-[180px]">{bill.customerName}</span>
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted mt-0.5 font-mono">
                        <span className="text-primary/90">{bill.phone}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-muted">
                          <MapPin className="w-3 h-3 text-muted" /> {bill.address || 'Visapur'}
                        </span>
                      </div>
                    </div>

                    {/* Stage Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                        isOverdue
                          ? 'bg-danger/10 text-danger border-danger/30'
                          : bill.stage === 'due_today'
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                          : bill.stage === 'due_in_3_days'
                          ? 'bg-warning/10 text-warning border-warning/30'
                          : 'bg-primary/10 text-primary border-primary/30'
                      }`}
                    >
                      {isOverdue
                        ? `Overdue (${Math.abs(bill.daysRemaining)}d)`
                        : bill.stage === 'due_today'
                        ? 'Due Today'
                        : bill.stage === 'due_in_3_days'
                        ? `Due in ${bill.daysRemaining} days`
                        : `Due in ${bill.daysRemaining} days`}
                    </span>
                  </div>

                  {/* Bill Reference */}
                  <div className="text-[11px] text-muted/70 font-mono flex items-center justify-between pt-1 border-t border-border/50">
                    <span>Bill: {bill.billNo}</span>
                    <span>{new Date(bill.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                {/* Amounts Breakdown */}
                <div className="bg-[#0D140F] border border-border rounded-xl p-3 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-muted text-[11px]">
                    <span>Total Bill:</span>
                    <span>{formatINR(bill.grandTotalPaise)}</span>
                  </div>
                  <div className="flex justify-between text-muted text-[11px]">
                    <span>Paid So Far:</span>
                    <span>{formatINR(bill.paidPaise)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-border/60">
                    <span className="text-danger">Remaining Udhari:</span>
                    <span className="text-danger font-black">{formatINR(bill.duePaise)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted/80 pt-0.5">
                    <span>Promise Date:</span>
                    <span className="text-white font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" /> {bill.dueDateFormatted}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  {/* WhatsApp Reminder Button */}
                  <button
                    onClick={() => handleSendWhatsAppReminder(bill)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    title="Send WhatsApp Reminder"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  {/* Preview Reminder / Copy SMS */}
                  <button
                    onClick={() => handleOpenReminder(bill)}
                    className="p-2 rounded-xl bg-surface hover:bg-surface-strong border border-border text-muted hover:text-text transition-colors"
                    title="View & Copy Reminder Message"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* Settle / Pay Button */}
                  <button
                    onClick={() => handleOpenSettle(bill)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-primary text-primary-ink font-extrabold text-xs hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Collect & Clear</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: SETTLE / COLLECT UDHARI */}
      {/* ========================================================================= */}
      {settleModalBill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="font-bold text-white text-base">Collect & Clear Udhari</h3>
                <p className="text-xs text-muted font-mono">
                  Bill: {settleModalBill.billNo} • {settleModalBill.customerName}
                </p>
              </div>
              <button
                onClick={() => setSettleModalBill(null)}
                className="text-muted hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settleError && (
              <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
                {settleError}
              </div>
            )}

            {settleSuccess && (
              <div className="p-3 rounded-xl bg-success/10 border border-success/30 text-xs text-success flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{settleSuccess}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSettle} className="space-y-4">
              {/* Due Info Card */}
              <div className="bg-[#0D140F] border border-border rounded-xl p-3 flex justify-between items-center font-mono">
                <div>
                  <span className="text-[10px] text-muted uppercase tracking-wider block">
                    Outstanding Balance
                  </span>
                  <span className="text-base font-black text-danger">
                    {formatINR(settleModalBill.duePaise)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted uppercase tracking-wider block">
                    Village
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {settleModalBill.address || 'Visapur'}
                  </span>
                </div>
              </div>

              {/* Amount to Collect */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Amount to Collect (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  max={paiseToRupees(settleModalBill.duePaise)}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-base font-mono text-white focus:outline-none focus:border-primary"
                />
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'upi', label: 'UPI / QR' },
                    { id: 'bank', label: 'Bank / NEFT' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettleMode(m.id)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        settleMode === m.id
                          ? 'bg-primary text-primary-ink border-primary'
                          : 'bg-surface border-border text-muted hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference / Note */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Ref / Receipt Note (Optional)
                </label>
                <input
                  type="text"
                  value={settleRefNo}
                  onChange={(e) => setSettleRefNo(e.target.value)}
                  placeholder="e.g. GPay UPI Ref 9284..."
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleModalBill(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSettling}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-xs font-black hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSettling ? 'Processing...' : 'Confirm Payment & Clear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: PREVIEW & COPY REMINDER TEXT */}
      {/* ========================================================================= */}
      {reminderModalBill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="font-bold text-white text-base">Reminder Message</h3>
                <p className="text-xs text-muted">
                  {reminderModalBill.customerName} ({reminderModalBill.phone})
                </p>
              </div>
              <button
                onClick={() => setReminderModalBill(null)}
                className="text-muted hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0D140F] border border-border rounded-xl p-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                Formatted Text for Customer
              </span>
              <p className="text-xs text-white whitespace-pre-line font-mono leading-relaxed bg-black/30 p-3 rounded-lg border border-border/50">
                {reminderModalBill.reminderMessage}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleCopyReminder(reminderModalBill.reminderMessage)}
                className="flex-1 py-2.5 rounded-xl bg-surface border border-border text-xs font-bold text-white hover:bg-surface-strong flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedReminder ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                <span>{copiedReminder ? 'Copied to Clipboard!' : 'Copy Text'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSendWhatsAppReminder(reminderModalBill);
                  setReminderModalBill(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-black hover:bg-emerald-400 flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Open in WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
