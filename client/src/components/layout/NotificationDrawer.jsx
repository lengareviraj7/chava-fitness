import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  X,
  AlertTriangle,
  Clock,
  CreditCard,
  Truck,
  RotateCw,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import api from '../../api/axios.js';

export function NotificationDrawer({ isOpen, onClose, onCountUpdate }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'stock' | 'dues'

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Initial count load on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      const list = res.data.data.notifications || [];
      setNotifications(list);
      if (onCountUpdate) {
        onCountUpdate(list.length);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleAction(link) {
    onClose();
    navigate(link);
  }

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (filter === 'stock') return n.type === 'low_stock' || n.type === 'expiring';
    if (filter === 'dues') return n.type === 'customer_due' || n.type === 'supplier_due';
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex justify-end">
      <div className="bg-[#0B110C] border-l border-white/10 w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#B6F23B]/10 border border-[#B6F23B]/20 flex items-center justify-center text-[#B6F23B]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Notifications
                {notifications.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#B6F23B]/20 text-[#B6F23B] text-[10px] font-extrabold">
                    {notifications.length}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-[#9BA79A]">Live shop alerts & reminders</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchNotifications}
              disabled={loading}
              title="Refresh alerts"
              className="p-2 rounded-xl text-[#9BA79A] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="p-2 rounded-xl text-[#9BA79A] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-white/5 flex gap-2 bg-white/[0.01]">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-[#B6F23B] text-[#050805]'
                : 'text-[#9BA79A] hover:text-white hover:bg-white/5'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('stock')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              filter === 'stock'
                ? 'bg-[#B6F23B] text-[#050805]'
                : 'text-[#9BA79A] hover:text-white hover:bg-white/5'
            }`}
          >
            Stock & Expiry
          </button>
          <button
            onClick={() => setFilter('dues')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              filter === 'dues'
                ? 'bg-[#B6F23B] text-[#050805]'
                : 'text-[#9BA79A] hover:text-white hover:bg-white/5'
            }`}
          >
            Dues & Credit
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#9BA79A] animate-pulse">
              Checking for new alerts...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-[#B6F23B]/60 mx-auto" />
              <p className="text-sm font-bold text-white">All caught up!</p>
              <p className="text-xs text-[#9BA79A] max-w-xs mx-auto">
                No active warnings, low stock batches, or overdue payments right now.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isDanger = item.severity === 'danger';
              const isWarning = item.severity === 'warning';

              const icon =
                item.type === 'low_stock' ? (
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                ) : item.type === 'expiring' ? (
                  <Clock className="w-4 h-4 text-[#EF4444]" />
                ) : item.type === 'customer_due' ? (
                  <CreditCard className="w-4 h-4 text-[#3B82F6]" />
                ) : (
                  <Truck className="w-4 h-4 text-[#8B5CF6]" />
                );

              const borderColor = isDanger
                ? 'border-[#EF4444]/30 bg-[#EF4444]/5'
                : isWarning
                ? 'border-[#F59E0B]/30 bg-[#F59E0B]/5'
                : 'border-white/[0.08] bg-white/[0.02]';

              return (
                <div
                  key={item.id}
                  className={`border rounded-2xl p-3.5 space-y-2.5 transition-all hover:border-white/20 ${borderColor}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white/5">{icon}</div>
                      <span className="text-xs font-bold text-white">{item.title}</span>
                    </div>
                    {isDanger && (
                      <span className="text-[10px] uppercase font-bold text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">
                        Action Required
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#F4F7F1]/80 leading-relaxed">{item.message}</p>

                  <div className="pt-1 flex items-center justify-between border-t border-white/5">
                    <span className="text-[10px] text-[#9BA79A]">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleAction(item.link)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[#B6F23B] text-[#050805] hover:brightness-110 transition-all"
                    >
                      <span>{item.actionLabel || 'View'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-white/[0.01] text-center text-[11px] text-[#9BA79A]">
          Chava ERP Alert System
        </div>
      </div>
    </div>
  );
}
