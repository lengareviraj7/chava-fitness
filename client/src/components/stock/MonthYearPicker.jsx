import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';

const MONTHS = [
  { val: '01', label: '01 - Jan' },
  { val: '02', label: '02 - Feb' },
  { val: '03', label: '03 - Mar' },
  { val: '04', label: '04 - Apr' },
  { val: '05', label: '05 - May' },
  { val: '06', label: '06 - Jun' },
  { val: '07', label: '07 - Jul' },
  { val: '08', label: '08 - Aug' },
  { val: '09', label: '09 - Sep' },
  { val: '10', label: '10 - Oct' },
  { val: '11', label: '11 - Nov' },
  { val: '12', label: '12 - Dec' },
];

/**
 * Safari-safe Expiry Picker (MM/YYYY)
 * Uses masked text input with auto-slash + quick month/year select dropdown.
 * Never uses <input type="month">.
 * Validates past dates and flags < 60 days near-expiry warnings.
 */
export function MonthYearPicker({ value = '', onChange, required = false, disabled = false, id }) {
  // value is expected to be 'YYYY-MM'
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const years = useMemo(() => {
    const list = [];
    for (let y = currentYear - 1; y <= currentYear + 10; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Derived state for display MM/YYYY
  const [textVal, setTextVal] = useState(() => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length === 2) {
      return `${parts[1]}/${parts[0]}`;
    }
    return value;
  });

  const [showQuickSelect, setShowQuickSelect] = useState(false);

  useEffect(() => {
    if (!value) {
      setTextVal('');
    } else {
      const parts = value.split('-');
      if (parts.length === 2) {
        setTextVal(`${parts[1]}/${parts[0]}`);
      }
    }
  }, [value]);

  // Evaluate validity
  const { isPast, isExpiringSoon, error } = useMemo(() => {
    if (!value) {
      return { isPast: false, isExpiringSoon: false, error: required ? 'Expiry required' : null };
    }
    const parts = value.split('-');
    if (parts.length !== 2) return { isPast: false, isExpiringSoon: false, error: 'Invalid date' };
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return { isPast: false, isExpiringSoon: false, error: 'Invalid date' };
    }

    // Check past
    if (y < currentYear || (y === currentYear && m < currentMonth)) {
      return { isPast: true, isExpiringSoon: false, error: 'Expiry cannot be in the past' };
    }

    // Check near expiry (< 60 days)
    const expiryDate = new Date(y, m - 1, 1);
    const now = new Date();
    const diffDays = Math.round((expiryDate - now) / (1000 * 60 * 60 * 24));
    const isExpiringSoon = diffDays >= 0 && diffDays <= 60;

    return { isPast: false, isExpiringSoon, error: null };
  }, [value, required, currentYear, currentMonth]);

  function handleTextInput(e) {
    let raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw.length > 6) raw = raw.slice(0, 6);

    let formatted = raw;
    if (raw.length >= 3) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setTextVal(formatted);

    if (raw.length === 6) {
      const mm = raw.slice(0, 2);
      const yyyy = raw.slice(2);
      const mNum = parseInt(mm, 10);
      if (mNum >= 1 && mNum <= 12) {
        onChange?.(`${yyyy}-${mm}`);
      }
    } else if (raw.length === 0) {
      onChange?.('');
    }
  }

  function handleMonthSelect(mm) {
    const curParts = (value || '').split('-');
    const curY = curParts[0] || String(currentYear + 1);
    onChange?.(`${curY}-${mm}`);
  }

  function handleYearSelect(yyyy) {
    const curParts = (value || '').split('-');
    const curM = curParts[1] || '12';
    onChange?.(`${yyyy}-${curM}`);
  }

  const selectedMonth = value ? value.split('-')[1] : '';
  const selectedYear = value ? value.split('-')[0] : '';

  return (
    <div className="relative space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM/YYYY"
            value={textVal}
            onChange={handleTextInput}
            disabled={disabled}
            className={`w-full bg-bg border rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-text placeholder:text-muted/40 font-mono focus:outline-none transition-colors ${
              isPast
                ? 'border-red-500/70 focus:border-red-500'
                : isExpiringSoon
                ? 'border-amber-500/70 focus:border-amber-500'
                : 'border-border focus:border-primary'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowQuickSelect((s) => !s)}
          title="Pick Month / Year"
          className={`p-1.5 rounded-lg border text-muted hover:text-text transition-colors shrink-0 ${
            showQuickSelect ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-border'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inline Quick Selector Dropdown */}
      {showQuickSelect && (
        <div className="p-2 rounded-xl bg-surface border border-border space-y-2 shadow-lg text-xs animate-in fade-in duration-150">
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[10px] text-muted mb-0.5 uppercase tracking-wider">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthSelect(e.target.value)}
                className="w-full bg-bg border border-border rounded px-1.5 py-1 text-xs text-text focus:outline-none focus:border-primary"
              >
                <option value="">Month...</option>
                {MONTHS.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-0.5 uppercase tracking-wider">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => handleYearSelect(e.target.value)}
                className="w-full bg-bg border border-border rounded px-1.5 py-1 text-xs text-text focus:outline-none focus:border-primary"
              >
                <option value="">Year...</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Validation Message */}
      {isPast && (
        <p className="text-[10px] text-red-400 font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" /> Expiry date is in the past
        </p>
      )}
      {!isPast && isExpiringSoon && (
        <p className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" /> Near expiry (&lt; 60 days)
        </p>
      )}
    </div>
  );
}