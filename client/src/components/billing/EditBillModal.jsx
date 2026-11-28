import React, { useState } from 'react';
import { Pencil, CheckCircle, X } from 'lucide-react';
import { billingApi } from '../../api/billing.js';
import { formatINR, paiseToRupees, rupeesToPaise } from '../../utils/money.js';

export function EditBillModal({ bill, onClose, onSuccess }) {
  const rawDate = bill.dueDate ? new Date(bill.dueDate).toISOString().slice(0, 10) : '';

  const [form, setForm] = useState({
    customerName: bill.customerName || bill.customerSnapshot?.name || '',
    customerPhone: bill.phone || bill.customerSnapshot?.phone || '',
    customerAddress: bill.address || bill.customerSnapshot?.address || 'Visapur',
    dueDate: rawDate,
    paidAmount: paiseToRupees(bill.paidPaise || 0).toString(),
    paymentMode: bill.paymentSummary?.[0]?.mode || 'cash',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const grandTotalPaise = bill.grandTotalPaise || 0;
  const currentPaidPaise = rupeesToPaise(Number(form.paidAmount) || 0);
  const remainingDuePaise = Math.max(0, grandTotalPaise - currentPaidPaise);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      await billingApi.editBill(bill._id, {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerAddress: form.customerAddress.trim(),
        dueDate: form.dueDate || null,
        paidAmountPaise: currentPaidPaise,
        paymentMode: form.paymentMode,
      });

      setSuccess('Bill updated successfully!');
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to update bill');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Edit Bill #{bill.billNo}
            </h3>
            <p className="text-xs text-muted">
              Total Invoice: <strong className="text-white font-mono">{formatINR(grandTotalPaise)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-success/10 border border-success/30 text-xs text-success flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Customer Name */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              required
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
            />
          </div>

          {/* Mobile & Village */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                placeholder="10-digit number"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Village / Address
              </label>
              <input
                type="text"
                value={form.customerAddress}
                onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))}
                placeholder="Visapur"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Promise Date */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Promise Date (Due Date)
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary"
            />
          </div>

          {/* Paid Amount & Live Udhari Calculation */}
          <div className="bg-[#0D140F] border border-border rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Total Payable:</span>
              <span className="font-mono font-bold text-white">{formatINR(grandTotalPaise)}</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Paid Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                max={paiseToRupees(grandTotalPaise)}
                value={form.paidAmount}
                onChange={(e) => setForm((f) => ({ ...f, paidAmount: e.target.value }))}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-border/60">
              <span className="text-danger font-bold">Remaining Udhari:</span>
              <span className="font-mono font-black text-danger text-sm">
                {formatINR(remainingDuePaise)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-xs font-black hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
