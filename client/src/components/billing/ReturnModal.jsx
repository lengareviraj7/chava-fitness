import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Printer, ArrowLeft } from 'lucide-react';
import { returnsApi } from '../../api/returns.js';
import { formatINR, paiseToRupees, rupeesToPaise } from '../../utils/money.js';

export function ReturnModal({ bill, user, onClose, onSuccess }) {
  const isOwner = user?.role === 'owner';
  const billDate = new Date(bill.createdAt).getTime();
  const daysSince = (Date.now() - billDate) / (1000 * 60 * 60 * 24);
  const withinWindow = daysSince <= 7;
  const requiresOwnerPin = !isOwner || !withinWindow;

  // Track return quantities and options per line item - default to purchased returnable quantity
  const [returnConfig, setReturnConfig] = useState(() => {
    const init = {};
    for (const item of bill.items || []) {
      const maxReturn = Math.max(0, item.qty - (item.returnedQty || 0));
      init[item.lineId] = {
        qty: maxReturn,
        maxReturn,
        isDamaged: false,
      };
    }
    return init;
  });

  const [reason, setReason] = useState('changed_mind');
  const [note, setNote] = useState('');
  const [refundMode, setRefundMode] = useState('cash');
  const [ownerPin, setOwnerPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creditNoteResult, setCreditNoteResult] = useState(null);

  // Compute total estimate
  const selectedLines = Object.entries(returnConfig)
    .filter(([_, cfg]) => cfg.qty > 0)
    .map(([lineId, cfg]) => ({
      lineId,
      qty: cfg.qty,
      isDamaged: cfg.isDamaged,
    }));

  const estimatedRefundPaise = selectedLines.reduce((sum, line) => {
    const orig = bill.items.find((i) => i.lineId === line.lineId);
    if (!orig) return sum;
    const unitPrice = Math.round(orig.netPaise / orig.qty);
    return sum + unitPrice * line.qty;
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (selectedLines.length === 0) {
      setError('Please select at least 1 item quantity to return');
      return;
    }
    if (requiresOwnerPin && !ownerPin) {
      setError('Owner PIN is required to approve this return');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await returnsApi.create({
        billId: bill._id,
        returnLines: selectedLines,
        settlement: {
          payouts: [{ mode: refundMode, amountPaise: estimatedRefundPaise }],
        },
        reason,
        note,
        ownerPin: requiresOwnerPin ? ownerPin : undefined,
      });

      setCreditNoteResult(res.data.data.creditNote);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Return processing failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-[#0D140F]">
          <div>
            <h3 className="font-bold text-text text-base">Process Bill Return</h3>
            <p className="text-xs text-muted font-mono">Original Bill: {bill.billNo}</p>
          </div>
          <button
            onClick={() => {
              if (creditNoteResult) onSuccess();
              else onClose();
            }}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {creditNoteResult ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-text">Return Completed!</h4>
              <p className="text-xs text-muted font-mono mt-1">
                Credit Note: {creditNoteResult.creditNoteNo}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-left text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Refund Amount:</span>
                <span className="font-extrabold text-primary">
                  {formatINR(creditNoteResult.grandTotalPaise)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Mode:</span>
                <span className="font-semibold uppercase text-text">{refundMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Reason:</span>
                <span className="text-text capitalize">{creditNoteResult.reason.replace('_', ' ')}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold flex items-center justify-center gap-1.5 hover:border-primary/40 text-text"
              >
                <Printer className="w-4 h-4" /> Print Note
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
          /* Return Form */
          <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
            {!withinWindow && (
              <div className="bg-warning/10 border border-warning/30 text-warning text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Return window (7 days) has passed. Owner PIN required.</span>
              </div>
            )}

            {/* Line Items Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                  Select Items to Return
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReturnConfig((prev) => {
                        const next = { ...prev };
                        for (const item of bill.items || []) {
                          const max = Math.max(0, item.qty - (item.returnedQty || 0));
                          if (next[item.lineId]) {
                            next[item.lineId] = { ...next[item.lineId], qty: max };
                          }
                        }
                        return next;
                      });
                    }}
                    className="text-[11px] text-primary hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-muted/40 text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReturnConfig((prev) => {
                        const next = { ...prev };
                        for (const key of Object.keys(next)) {
                          next[key] = { ...next[key], qty: 0 };
                        }
                        return next;
                      });
                    }}
                    className="text-[11px] text-muted hover:text-text font-semibold"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {bill.items?.map((item) => {
                  const maxReturn = item.qty - (item.returnedQty || 0);
                  const cfg = returnConfig[item.lineId] || { qty: 0, isDamaged: false };
                  if (maxReturn <= 0) return null;

                  return (
                    <div
                      key={item.lineId}
                      className="bg-surface border border-border rounded-xl p-3 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-text text-sm">{item.nameSnapshot}</p>
                          <p className="text-xs text-muted">
                            Sold: {item.qty} · Returned: {item.returnedQty || 0} · Max: {maxReturn}
                          </p>
                        </div>
                        <span className="font-bold text-primary text-sm">
                          {formatINR(item.unitPricePaise)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <label className="text-xs text-muted flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cfg.isDamaged}
                            onChange={(e) =>
                              setReturnConfig((prev) => ({
                                ...prev,
                                [item.lineId]: {
                                  ...prev[item.lineId],
                                  isDamaged: e.target.checked,
                                },
                              }))
                            }
                            className="rounded border-border accent-primary"
                          />
                          <span>Damaged / Expired (don't restock)</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">Return Qty:</span>
                          <input
                            type="number"
                            min="0"
                            max={maxReturn}
                            value={cfg.qty}
                            onChange={(e) => {
                              const val = Math.max(
                                0,
                                Math.min(maxReturn, parseInt(e.target.value) || 0)
                              );
                              setReturnConfig((prev) => ({
                                ...prev,
                                [item.lineId]: { ...prev[item.lineId], qty: val },
                              }));
                            }}
                            className="w-16 bg-bg border border-border rounded-lg px-2 py-1 text-center font-bold text-sm text-text focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Return Reason & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="changed_mind">Changed Mind</option>
                  <option value="wrong_item">Wrong Item</option>
                  <option value="damaged_product">Damaged Product</option>
                  <option value="expired_product">Expired Product</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Refund Mode
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {['cash', 'upi', 'card'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRefundMode(m)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                        refundMode === m
                          ? 'bg-primary text-primary-ink border-primary'
                          : 'bg-surface border-border text-muted hover:border-primary/40'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Note / Remarks (Optional)
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason details..."
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              />
            </div>

            {/* Owner PIN Verification */}
            {requiresOwnerPin && (
              <div>
                <label className="block text-xs font-semibold text-warning uppercase tracking-wider mb-1">
                  Owner Security PIN *
                </label>
                <input
                  required
                  type="password"
                  maxLength={6}
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value)}
                  placeholder="Enter Owner PIN to authorize"
                  className="w-full bg-bg border border-warning/50 rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-warning"
                />
              </div>
            )}

            {/* Refund Total Preview */}
            <div className="bg-surface border border-border rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-muted uppercase font-semibold">Estimated Refund Total</span>
              <span className="text-base font-extrabold text-primary">
                {formatINR(estimatedRefundPaise)}
              </span>
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-xl p-3">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-primary/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedLines.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-bold hover:brightness-110 disabled:opacity-60"
              >
                {loading ? 'Processing...' : 'Issue Credit Note'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
