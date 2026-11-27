import React from 'react';
import { PackageOpen, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils/cn.js';

export const EmptyState = ({
  icon: Icon = PackageOpen,
  title = "No data found",
  description = "No records currently match your criteria.",
  actionLabel,
  onAction,
  className
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border-theme bg-bg-card/30", className)}>
      <div className="w-14 h-14 rounded-2xl bg-bg-secondary flex items-center justify-center text-accent-primary border border-border-theme mb-4 shadow-neon">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-base sm:text-lg font-semibold text-text-main mb-1">{title}</h4>
      <p className="text-sm text-text-muted max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary" size="md">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const ErrorState = ({
  title = "Something went wrong",
  message = "An error occurred while loading this section.",
  onRetry,
  className
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-danger/30 bg-danger/5", className)}>
      <div className="w-12 h-12 rounded-full bg-danger/20 flex items-center justify-center text-danger mb-3 border border-danger/30">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-text-main mb-1">{title}</h4>
      <p className="text-xs sm:text-sm text-text-muted max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Try Again
        </Button>
      )}
    </div>
  );
};
