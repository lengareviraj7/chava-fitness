import React, { useState } from 'react';
import { Trash2, CheckCircle, X } from 'lucide-react';
import { billingApi } from '../../api/billing.js';
import { formatINR } from '../../utils/money.js';

export function DeleteBillModal({ bill, onClose, onSuccess }) {
  const [reason, setReason] = useState('Created by mistake');
  const [permanentDelete, setPermanentDelete] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleDelete(e) {
    e.preventDefault();
    setIsDeleting(true);
    setError('');

    try {
      await billingApi.deleteBill(bill._id, {
        reason: reason.trim() || 'Created by mistake',
        permanentDelete,
      });

      setSuccess(
        permanentDelete
          ? 'Bill deleted and inventory restored to stock!'
          : 'Bill voided and inventory restored to stock!'
      );
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to delete/void bill');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4">
      <div className="bg-bg-elevated border border-danger/40 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2 text-danger">
            <div className="w-9 h-9 rounded-xl bg-danger/10 border border-danger/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-danger" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Delete Mistaken Bill</h3>
              <p className="text-xs text-muted font-mono">{bill.billNo}</p>
            </div>
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

        <form onSubmit={handleDelete} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 space-y-2 text-xs leading-relaxed text-danger">
            <p className="font-bold text-white">
              Are you sure you want to delete this bill?
            </p>
            <ul className="list-disc pl-4 space-y-1 text-danger/90">
              <li>
                All sold products will be <strong>restored back into inventory batches</strong>.
              </li>
              {bill.duePaise > 0 && (
                <li>
                  Customer Udhari balance of <strong>{formatINR(bill.duePaise)}</strong> will be completely cancelled.
                </li>
              )}
              <li>
                Invoice #{bill.billNo} will be removed from Udhari & active bills.
              </li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Reason for Removal
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Made by mistake, wrong items entered"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-danger"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={permanentDelete}
              onChange={(e) => setPermanentDelete(e.target.checked)}
              className="w-4 h-4 rounded border-border text-danger accent-danger"
            />
            <span>Delete bill record permanently from database</span>
          </label>

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
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl bg-danger text-white text-xs font-black hover:bg-danger/80 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-danger/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Removing...' : 'Confirm Delete & Restore Stock'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
