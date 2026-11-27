import React from 'react';
import { cn } from '../../utils/cn.js';

export const Button = React.forwardRef(({
  children,
  className,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'md',        // 'sm' | 'md' | 'lg' | 'icon'
  disabled = false,
  loading = false,
  icon: Icon,
  type = 'button',
  ...props
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none min-h-[44px]";
  
  const variants = {
    primary: "bg-accent-primary hover:bg-accent-secondary text-bg-primary font-bold shadow-neon hover:shadow-neon-strong",
    secondary: "bg-bg-secondary hover:bg-bg-primary text-text-main border border-border-theme hover:border-accent-primary/50",
    outline: "border border-border-theme hover:border-accent-primary text-text-main hover:text-accent-primary bg-transparent",
    ghost: "text-text-muted hover:text-text-main hover:bg-bg-secondary/60",
    danger: "bg-danger/20 hover:bg-danger/30 text-danger border border-danger/40",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5 min-h-[38px] sm:min-h-[36px]",
    md: "px-4 py-2.5 text-sm gap-2 min-h-[44px]",
    lg: "px-6 py-3.5 text-base gap-2.5 min-h-[48px]",
    icon: "p-2.5 min-h-[44px] min-w-[44px]",
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
