import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn.js';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast viewport */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-200 animate-in slide-in-from-bottom-2",
              t.type === 'success' && "bg-bg-card/95 border-accent-primary/50 text-text-main shadow-neon",
              t.type === 'error' && "bg-bg-card/95 border-danger/50 text-text-main",
              t.type === 'info' && "bg-bg-card/95 border-border-theme text-text-main"
            )}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-accent-primary shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-danger shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-accent-primary shrink-0" />}
            <span className="text-xs sm:text-sm font-medium flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-text-muted hover:text-text-main p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};
