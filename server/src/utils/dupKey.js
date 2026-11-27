/**
 * Normalizes brand, product name, and categoryId into a canonical dupKey string.
 * Enforces NFC normalization, lowercase, punctuation stripping, and whitespace collapsing.
 *
 * @param {string} brand
 * @param {string} name
 * @param {string|object} categoryId
 * @returns {string}
 */
export function normalizeDupKey(brand = '', name = '', categoryId = '') {
  const normString = (str) =>
    String(str || '')
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const normBrand = normString(brand);
  const normName = normString(name);
  const catStr = String(categoryId?._id || categoryId || '').trim();

  return `${normBrand}|${normName}|${catStr}`;
}
