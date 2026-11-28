import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  Clock,
  Plus,
  CheckCircle,
  AlertCircle,
  Calendar,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  History,
  X,
} from 'lucide-react';
import { dayCloseApi } from '../../api/dayClose.js';
import { formatINR, paiseToRupees, rupeesToPaise } from '../../utils/money.js';

export function DayCloseTab({ user }) {
  const isOwner = user?.role === 'owner';
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);

  // Cash Movement Modal state
  const [entryType, setEntryType] = useState('expense');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);

  // Close Day Form state
  const [countedCash, setCountedCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [submittingClose, setSubmittingClose] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Denominations
  const [denominations, setDenominations] = useState({
    500: '',
    200: '',
    100: '',
    50: '',
    20: '',
    10: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, histRes] = await Promise.all([
        dayCloseApi.getSummary(),
        dayCloseApi.getHistory(),
      ]);
      setSummary(sumRes.data.data);
      setHistory(histRes.data.data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-calculate counted cash from denominations
  function handleDenomChange(denom, count) {
    const nextDenoms = { ...denominations, [denom]: count };
    setDenominations(nextDenoms);

    let total = 0;
    for (const [d, c] of Object.entries(nextDenoms)) {
      const parsedCount = parseInt(c) || 0;
      total += parseInt(d) * parsedCount;
    }
    if (total > 0) {
      setCountedCash(total.toString());
    }
  }

  async function handleAddCashEntry(e) {
    e.preventDefault();
    if (!entryAmount || Number(entryAmount) <= 0 || !entryNote.trim()) return;
    setSavingEntry(true);
    try {
      await dayCloseApi.addCashEntry({
        type: entryType,
        amountPaise: rupeesToPaise(entryAmount),
        note: entryNote.trim(),
      });
      setShowEntryModal(false);
      setEntryAmount('');
      setEntryNote('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to add cash movement');
    } finally {
      setSavingEntry(false);
    }
  }

  async function handleCloseDay(e) {
    e.preventDefault();
    if (!countedCash || Number(countedCash) < 0) {
      setError('Please enter counted drawer cash amount');
      return;
    }

    setSubmittingClose(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await dayCloseApi.closeDay({
        countedCashPaise: rupeesToPaise(countedCash),
        denominations,
        note: closeNote.trim(),
      });
      setSuccessMsg('Day closed successfully!');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to close day');
    } finally {
      setSubmittingClose(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading Day Close metrics...</div>;
  }

  const figures = summary?.figures || {};
  const isClosed = summary?.isClosed;
  const currentClose = summary?.currentClose;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text">Counter Day Close & Cash Drawer</h2>
            {isClosed ? (
              <span className="bg-success/15 border border-success/30 text-success text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Day Closed
              </span>
            ) : (
              <span className="bg-warning/15 border border-warning/30 text-warning text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Open / In Progress
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1">Date: {summary?.date}</p>
        </div>

        <button
          onClick={() => setShowEntryModal(true)}
          className="flex items-center gap-1.5 bg-surface border border-border hover:border-primary/40 text-text px-3.5 py-2 rounded-xl text-xs font-semibold self-start sm:self-auto transition-colors"
        >
          <Plus className="w-4 h-4 text-primary" /> Record Cash Movement
        </button>
      </div>

      {/* Figures Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <p className="text-[11px] text-muted uppercase font-bold tracking-wider">Opening Cash</p>
          <p className="text-base font-extrabold text-text mt-1">{formatINR(figures.openingCashPaise || 0)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <p className="text-[11px] text-muted uppercase font-bold tracking-wider">Cash Sales</p>
          <p className="text-base font-extrabold text-success mt-1">{formatINR(figures.cashSales || 0)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <p className="text-[11px] text-muted uppercase font-bold tracking-wider">UPI / Card Sales</p>
          <p className="text-base font-extrabold text-primary mt-1">
            {formatINR((figures.upiSales || 0) + (figures.cardSales || 0))}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <p className="text-[11px] text-muted uppercase font-bold tracking-wider">Cash Dues Collected</p>
          <p className="text-base font-extrabold text-text mt-1">{formatINR(figures.cashDueCollected || 0)}</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-3.5">
          <p className="text-[11px] text-muted uppercase font-bold tracking-wider">Cash Refunds</p>
          <p className="text-base font-extrabold text-danger mt-1">-{formatINR(figures.cashRefunds || 0)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <p className="text-[11px] text-muted uppercase font-bold tracking-wider">Expenses / Payouts</p>
          <p className="text-base font-extrabold text-danger mt-1">-{formatINR(figures.expenses || 0)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <p className="text-[11px] text-muted uppercase font-bold tracking-wider">Bank Deposits / Draws</p>
          <p className="text-base font-extrabold text-muted mt-1">
            -{formatINR((figures.bankDeposits || 0) + (figures.ownerDraws || 0))}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <p className="text-[11px] text-muted uppercase font-bold tracking-wider">Total Bills / Returns</p>
          <p className="text-base font-extrabold text-text mt-1">
            {figures.billsCount || 0} bills · {figures.returnsCount || 0} ret
          </p>
        </div>
      </div>

      {/* Expected Cash Card for Owner */}
      {isOwner && summary?.expectedCashPaise !== undefined && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-wider">System Expected Cash in Drawer</span>
            <p className="text-2xl font-black text-text mt-0.5">{formatINR(summary.expectedCashPaise)}</p>
            <p className="text-xs text-muted mt-1">
              Opening ({formatINR(figures.openingCashPaise || 0)}) + Inflows ({formatINR((figures.cashSales || 0) + (figures.cashDueCollected || 0) + (figures.cashIn || 0))}) - Outflows ({formatINR((figures.cashRefunds || 0) + (figures.expenses || 0) + (figures.bankDeposits || 0) + (figures.ownerDraws || 0))})
            </p>
          </div>
          {currentClose && (
            <div className="text-right">
              <span className="text-xs font-bold text-muted uppercase">Difference at Close</span>
              <p
                className={`text-xl font-black ${
                  currentClose.differencePaise === 0
                    ? 'text-success'
                    : currentClose.differencePaise > 0
                    ? 'text-primary'
                    : 'text-danger'
                }`}
              >
                {currentClose.differencePaise >= 0 ? '+' : ''}
                {formatINR(currentClose.differencePaise)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Close Day Action Form */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-base font-bold text-text">
          {isClosed ? 'Re-Close Day (Submit Revision)' : 'Submit Drawer Cash Count'}
        </h3>
        <p className="text-xs text-muted">
          Count physical currency notes in the cash drawer and enter below.
        </p>

        <form onSubmit={handleCloseDay} className="space-y-4">
          {/* Denominations Helper */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Note Denominations Count (Optional Quick Calculator)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[500, 200, 100, 50, 20, 10].map((d) => (
                <div key={d} className="bg-bg border border-border rounded-xl p-2 text-center">
                  <span className="text-[10px] font-bold text-muted">₹{d}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={denominations[d]}
                    onChange={(e) => handleDenomChange(d, e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-sm text-text focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Total Counted Cash in Drawer (₹) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="e.g. 15450"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-lg font-black text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Closing Remarks / Note
              </label>
              <input
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder="e.g. Clean handoff to night shift"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-xl p-3">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-success/10 border border-success/30 text-success text-xs rounded-xl p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submittingClose || !countedCash}
            className="w-full py-3 rounded-xl bg-primary text-primary-ink font-bold text-sm hover:brightness-110 disabled:opacity-60 transition-all"
          >
            {submittingClose ? 'Closing Day...' : isClosed ? 'Update Day Close' : 'Confirm & Close Day'}
          </button>
        </form>
      </div>

      {/* Historical Closes */}
      {history.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <h3 className="text-base font-bold text-text flex items-center gap-2">
            <History className="w-4 h-4 text-muted" /> Day Close Records
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-border pb-2">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-right pb-2">Counted Cash</th>
                  {isOwner && <th className="text-right pb-2">Expected Cash</th>}
                  {isOwner && <th className="text-right pb-2">Discrepancy</th>}
                  <th className="text-left pb-2 pl-4">Closed By</th>
                  <th className="text-left pb-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h) => (
                  <tr key={h._id} className="hover:bg-bg/50">
                    <td className="py-2.5 font-bold text-text">{h.date}</td>
                    <td className="py-2.5 text-right font-extrabold text-primary">
                      {formatINR(h.countedCashPaise)}
                    </td>
                    {isOwner && (
                      <td className="py-2.5 text-right text-text font-semibold">
                        {formatINR(h.expectedCashPaise)}
                      </td>
                    )}
                    {isOwner && (
                      <td
                        className={`py-2.5 text-right font-bold ${
                          h.differencePaise === 0
                            ? 'text-success'
                            : h.differencePaise > 0
                            ? 'text-primary'
                            : 'text-danger'
                        }`}
                      >
                        {h.differencePaise >= 0 ? '+' : ''}
                        {formatINR(h.differencePaise)}
                      </td>
                    )}
                    <td className="py-2.5 pl-4 text-muted">{h.closedBy?.name || 'Staff'}</td>
                    <td className="py-2.5 text-muted truncate max-w-xs">{h.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Record Petty Cash Movement */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-text text-base">Record Cash Movement</h3>
              <button
                onClick={() => setShowEntryModal(false)}
                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCashEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Movement Type
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="expense">Expense (Store Petty Cash)</option>
                  <option value="cash_in">Cash In (Float Added)</option>
                  <option value="bank_deposit">Bank Deposit (Cash Deposited)</option>
                  <option value="owner_draw">Owner Draw / Withdrawal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Amount (₹) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="1"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-base font-bold text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Description / Note *
                </label>
                <input
                  required
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  placeholder="e.g. Cleaning supplies or daily tea"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-primary/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEntry || !entryAmount || !entryNote.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 disabled:opacity-60"
                >
                  {savingEntry ? 'Saving...' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
