/**
 * Money utilities for the client.
 * Server always sends integer paise; we convert for display only.
 */

export function paiseToRupees(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return 0;
  return Number(paise) / 100;
}

export function rupeesToPaise(rupees) {
  if (rupees === null || rupees === undefined || isNaN(rupees)) return 0;
  return Math.round(Number(rupees) * 100);
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

/** Short form: ₹1.2L, ₹45K, etc. */
export function formatINRShort(paise) {
  const rupees = paiseToRupees(paise);
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return formatINR(paise, false);
}
