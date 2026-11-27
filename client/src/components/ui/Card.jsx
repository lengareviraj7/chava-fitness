import React from 'react';
import { cn } from '../../utils/cn.js';

export const Card = ({ children, className, glow = false, ...props }) => {
  return (
    <div
      className={cn(
        "bg-bg-card/80 backdrop-blur-md border border-border-theme rounded-xl p-4 sm:p-6 transition-all duration-200",
        glow && "border-accent-primary/40 shadow-neon",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, action, className }) => {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div>
        <h3 className="font-semibold text-text-main text-base sm:text-lg tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs sm:text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
