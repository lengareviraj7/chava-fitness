import React from 'react';
import { cn } from '../../utils/cn.js';

export const Input = React.forwardRef(({
  label,
  error,
  icon: Icon,
  className,
  wrapperClassName,
  ...props
}, ref) => {
  return (
    <div className={cn("w-full flex flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-text-muted pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-text text-sm",
            "placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary",
            "transition-colors duration-150 min-h-[44px]",
            Icon && "pl-10",
            error && "border-danger focus:border-danger focus:ring-danger",
            className
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-danger font-medium mt-0.5">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export const Select = React.forwardRef(({
  label,
  error,
  options = [],
  className,
  wrapperClassName,
  children,
  ...props
}, ref) => {
  return (
    <div className={cn("w-full flex flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          "w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-text text-sm",
          "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary",
          "transition-colors duration-150 min-h-[44px]",
          error && "border-danger focus:border-danger",
          className
        )}
        {...props}
      >
        {children ? children : options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#0E1610] text-text">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-danger font-medium mt-0.5">{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';
