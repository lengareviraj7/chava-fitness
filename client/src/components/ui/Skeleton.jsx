import React from 'react';
import { cn } from '../../utils/cn.js';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-bg-card/70 border border-border-theme/40",
        className
      )}
      {...props}
    />
  );
};

export const CardSkeleton = () => (
  <div className="bg-bg-card/80 border border-border-theme rounded-xl p-5 space-y-4">
    <div className="flex justify-between items-center">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <Skeleton className="h-8 w-2/3" />
    <div className="pt-2 flex gap-2">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
    </div>
  </div>
);
