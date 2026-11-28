import React from 'react';
import { cn } from '../../utils/cn.js';

export const Table = ({ children, className }) => {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-theme bg-bg-card/40">
      <table className={cn("w-full text-left text-sm text-text-muted", className)}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ children, className }) => {
  return (
    <thead className={cn("bg-bg-secondary/80 text-xs uppercase tracking-wider text-text-muted border-b border-border-theme", className)}>
      {children}
    </thead>
  );
};

export const TableBody = ({ children, className }) => {
  return (
    <tbody className={cn("divide-y border-border", className)}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ children, className, onClick }) => {
  return (
    <tr 
      onClick={onClick}
      className={cn(
        "hover:bg-white/[0.06] active:bg-primary/[0.12] transition-colors",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </tr>
  );
};

export const TableHead = ({ children, className }) => {
  return (
    <th className={cn("py-3.5 px-4 font-semibold text-text-main", className)}>
      {children}
    </th>
  );
};

export const TableCell = ({ children, className }) => {
  return (
    <td className={cn("py-3.5 px-4 text-text-main", className)}>
      {children}
    </td>
  );
};
