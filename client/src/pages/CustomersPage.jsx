import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Search,
  Plus,
  IndianRupee,
  Calendar,
  Phone,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  MessageCircle,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { customersApi } from '../api/customers.js';
import { formatINR, paiseToRupees, rupeesToPaise } from '../utils/money.js';

// ---- Customer Form Modal ----
function CustomerFormModal({ customer, onSave, onClose }) {
  const isEdit = !!customer;
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    gstin: customer?.gstin || '',
    state: customer?.state || 'Maharashtra',
    openingDue: customer ? paiseToRupees(customer.openingDuePaise || 0) : '0',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address?.trim() || '',
        gstin: form.gstin.trim(),
        state: form.state.trim(),
        openingDuePaise: rupeesToPaise(form.openingDue),
      };
      if (isEdit) {
        await customersApi.update(customer._id, payload);
      } else {
        await customersApi.create(payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 className="font-bold text-text text-lg">{isEdit ? 'Edit Customer' : 'Add New Customer'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Customer Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ramesh Patil"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Phone Number (10 digits) *
            </label>
            <input
              required
              pattern="^[6-9]\d{9}$"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Address (Optional)
            </label>
            <input
              maxLength={120}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. Visapur"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                State
              </label>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Opening Due (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={isEdit}
                value={form.openingDue}
                onChange={(e) => setForm({ ...form, openingDue: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              GSTIN (Optional)
            </label>
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              placeholder="e.g. 27AAAAA0000A1Z5"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text font-mono focus:outline-none focus:border-primary"
            />
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-xl p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-primary/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ---- Due Collection Modal ----
function DueCollectionModal({ customer, onClose, onSuccess }) {
  const [amount, setAmount] = useState(paiseToRupees(customer.dueBalancePaise));
  const [mode, setMode] = useState('cash');
  const [refNo, setRefNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  async function handleCollect(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const amountPaise = rupeesToPaise(amount);
      const res = await customersApi.collectDue(customer._id, {
        amountPaise,
        mode,
        refNo: refNo.trim(),
      });
      setReceipt(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Collection failed');
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 className="font-bold text-text text-lg">Collect Customer Due</h2>
          <button
            onClick={() => {
              if (receipt) onSuccess();
              else onClose();
            }}
            className="p-2 rounded-xl hover:bg-surface text-muted hover:text-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {receipt ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text">Payment Collected!</h3>
              <p className="text-xs text-muted font-mono mt-1">Receipt: {receipt.receiptNo}</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-left text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Customer:</span>
                <span className="font-bold text-text">{customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Amount Collected:</span>
                <span className="font-extrabold text-primary">{formatINR(receipt.payment?.amountPaise || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Mode:</span>
                <span className="font-semibold uppercase text-text">{receipt.payment?.mode}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted">Remaining Due:</span>
                <span className="font-bold text-warning">{formatINR(receipt.customer?.dueBalancePaise || 0)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold flex items-center justify-center gap-1.5 hover:border-primary/40 text-text"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={onSuccess}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCollect} className="space-y-4">
            <div className="bg-surface border border-border rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted">Customer</p>
                <p className="font-bold text-text text-sm">{customer.name}</p>
                <p className="text-xs text-muted font-mono">{customer.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Total Outstanding</p>
                <p className="font-extrabold text-danger text-base">{formatINR(customer.dueBalancePaise)}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Amount to Collect (₹)
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="1"
                max={paiseToRupees(customer.dueBalancePaise)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-base font-bold text-text focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['cash', 'upi', 'card'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                      mode === m
                        ? 'bg-primary text-primary-ink border-primary'
                        : 'bg-surface border-border text-muted hover:border-primary/40'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {mode !== 'cash' && (
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Reference / UTR No.
                </label>
                <input
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="Optional reference number"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-xl p-3">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-primary/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !amount || Number(amount) <= 0}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold hover:brightness-110 disabled:opacity-60"
              >
                {loading ? 'Processing...' : 'Collect Payment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

// ---- Customer Ledger Modal ----
function CustomerLedgerModal({ customer, onClose }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLedger() {
      try {
        const res = await customersApi.getLedger(customer._id);
        setLedger(res.data.data.ledger || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchLedger();
  }, [customer._id]);

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-text text-lg">Customer Account Ledger</h2>
            <p className="text-xs text-muted">{customer.name} · {customer.phone}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          <div className="bg-surface border border-border rounded-xl p-3 flex justify-between items-center text-sm">
            <span className="text-muted">Current Outstanding Balance:</span>
            <span className="font-extrabold text-danger text-base">{formatINR(customer.dueBalancePaise)}</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted">Loading ledger entries...</div>
          ) : ledger.length === 0 ? (
            <div className="py-12 text-center text-muted">No ledger transactions recorded yet.</div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface border-b border-border text-muted">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Note</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-right p-3">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledger.map((entry) => (
                    <tr key={entry._id} className="hover:bg-white/[0.06] active:bg-primary/[0.12] transition-colors">
                      <td className="p-3 text-muted">
                        {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            entry.amountPaise > 0
                              ? 'bg-danger/10 text-danger'
                              : 'bg-success/10 text-success'
                          }`}
                        >
                          {entry.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-text truncate max-w-xs">{entry.note || '-'}</td>
                      <td className={`p-3 text-right font-bold ${entry.amountPaise > 0 ? 'text-danger' : 'text-success'}`}>
                        {entry.amountPaise > 0 ? '+' : ''}{formatINR(entry.amountPaise)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-text">
                        {formatINR(entry.balanceAfterPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Main Customers Page ----
export function CustomersPage() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'dues' | 'reminders'
  const [customers, setCustomers] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [collectCustomer, setCollectCustomer] = useState(null);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'reminders') {
        const res = await customersApi.getReminders();
        setReminders(res.data.data.reminders || []);
      } else {
        const res = await customersApi.list({
          search,
          hasDues: activeTab === 'dues',
        });
        setCustomers(res.data.data.customers || []);
        setTotalCount(res.data.data.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSendReminder(rem) {
    window.open(rem.waLink, '_blank');
    try {
      await customersApi.markReminderSent(rem.customerId);
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  const totalDuesPaise = customers.reduce((s, c) => s + (c.dueBalancePaise || 0), 0);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">Customers & Dues</h1>
          <p className="text-muted text-sm mt-0.5">
            Manage customer accounts, credit dues, and automated refill reminders
          </p>
        </div>
        <button
          onClick={() => {
            setEditCustomer(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-primary text-primary-ink font-bold px-4 py-2.5 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Users className="w-4 h-4" /> All Customers
        </button>
        <button
          onClick={() => setActiveTab('dues')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'dues'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <IndianRupee className="w-4 h-4" /> With Dues
          {activeTab === 'dues' && totalDuesPaise > 0 && (
            <span className="bg-danger/20 text-danger text-[10px] px-2 py-0.5 rounded-full font-bold">
              {formatINR(totalDuesPaise)}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'reminders'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Clock className="w-4 h-4" /> Refill Reminders
        </button>
      </div>

      {/* Search Input for Customer list */}
      {activeTab !== 'reminders' && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or phone..."
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {/* Tab 1 & 2: Customers Table / Cards */}
      {activeTab !== 'reminders' && (
        <>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-surface border border-border rounded-2xl h-16 animate-pulse" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16 text-muted border border-dashed border-border rounded-2xl">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">No customers found</p>
              <p className="text-xs mt-1">Try adjusting your search or add a new customer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((c) => {
                const hasDue = (c.dueBalancePaise || 0) > 0;
                return (
                  <div
                    key={c._id}
                    className="bg-surface border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text text-base">{c.name}</span>
                        {hasDue && (
                          <span className="bg-danger/10 border border-danger/30 text-danger text-[10px] px-2 py-0.5 rounded-full font-bold">
                            Due: {formatINR(c.dueBalancePaise)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5" /> {c.phone}
                        </span>
                        <span>{c.address || '-'}</span>
                        {c.state && <span>{c.state}</span>}
                        {c.gstin && <span className="font-mono">GST: {c.gstin}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => setLedgerCustomer(c)}
                        className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-text hover:border-primary/40 flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted" /> Ledger
                      </button>
                      {hasDue && (
                        <button
                          onClick={() => setCollectCustomer(c)}
                          className="px-3 py-2 rounded-xl bg-primary text-primary-ink text-xs font-bold hover:brightness-110 flex items-center gap-1"
                        >
                          <IndianRupee className="w-3.5 h-3.5" /> Collect Due
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab 3: Refill Reminders */}
      {activeTab === 'reminders' && (
        <>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-surface border border-border rounded-2xl h-16 animate-pulse" />
              ))}
            </div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-16 text-muted border border-dashed border-border rounded-2xl">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">No refill reminders due</p>
              <p className="text-xs mt-1">All customers who purchased supplements are well-stocked.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((r) => (
                <div
                  key={r.customerId}
                  className="bg-surface border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text text-base">{r.customerName}</span>
                      <span className="bg-warning/10 text-warning text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {r.daysAgo} days ago
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      Purchased: <span className="text-text font-semibold">{r.productName}</span> · Phone: {r.phone}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSendReminder(r)}
                    className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:brightness-110 self-end sm:self-auto transition-all"
                  >
                    <MessageCircle className="w-4 h-4" /> Send WhatsApp Reminder
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showAddModal && (
        <CustomerFormModal
          customer={editCustomer}
          onSave={() => {
            setShowAddModal(false);
            setEditCustomer(null);
            loadData();
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditCustomer(null);
          }}
        />
      )}

      {collectCustomer && (
        <DueCollectionModal
          customer={collectCustomer}
          onClose={() => setCollectCustomer(null)}
          onSuccess={() => {
            setCollectCustomer(null);
            loadData();
          }}
        />
      )}

      {ledgerCustomer && (
        <CustomerLedgerModal
          customer={ledgerCustomer}
          onClose={() => setLedgerCustomer(null)}
        />
      )}
    </div>
  );
}
