import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function rupeesToPaise(rupees) {
  if (rupees === null || rupees === undefined || isNaN(rupees)) return 0;
  return Math.round(Number(rupees) * 100);
}

export function paiseToRupees(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return 0;
  return Number(paise) / 100;
}

export function formatINR(paise, showDecimals = true) {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
}
