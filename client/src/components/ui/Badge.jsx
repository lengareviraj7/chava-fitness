import React from 'react';
import { cn } from '../../utils/cn.js';

export const Badge = ({
  children,
  variant = 'default', // 'default' | 'accent' | 'warning' | 'danger' | 'outline'
  className,
  ...props
}) => {
  const variants = {
    default: "bg-bg-secondary text-text-muted border border-border-theme",
    accent: "bg-accent-primary/15 text-accent-primary border border-accent-primary/30",
    warning: "bg-warning/15 text-warning border border-warning/30",
    danger: "bg-danger/15 text-danger border border-danger/30",
    outline: "border border-border-theme text-text-main",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
