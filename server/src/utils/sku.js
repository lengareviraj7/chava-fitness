/**
 * Generates a deterministic uppercase SKU code from product and variant attributes.
 * Format: <BRAND_PREFIX>-<NAME_PREFIX>-<FLAVOUR_PREFIX>-<SIZE_CLEAN>
 *
 * @param {object} params
 * @param {string} params.brand
 * @param {string} params.name
 * @param {string} [params.flavour]
 * @param {string} [params.size]
 * @returns {string}
 */
export function generateSku({ brand = '', name = '', flavour = '', size = '' } = {}) {
  const cleanWord = (w) => w.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Split on camelCase (e.g. MuscleBlaze -> ['Muscle', 'Blaze']) or whitespace
  const splitWords = (str) =>
    str
      .trim()
      .split(/(?=[A-Z][a-z])|\s+/)
      .map(cleanWord)
      .filter(Boolean);

  // Brand prefix: initials of split words
  const brandWords = splitWords(brand);
  let brandPrefix = '';
  if (brandWords.length > 1) {
    brandPrefix = brandWords.map((w) => w[0]).join('').slice(0, 3);
  } else if (brandWords.length === 1) {
    brandPrefix = brandWords[0].slice(0, 3);
  }
  if (!brandPrefix) brandPrefix = 'GEN';

  // Name prefix: initials of split words
  const nameWords = splitWords(name);
  let namePrefix = '';
  if (nameWords.length > 1) {
    namePrefix = nameWords.map((w) => w[0]).join('').slice(0, 4);
  } else if (nameWords.length === 1) {
    namePrefix = nameWords[0].slice(0, 3);
  }
  if (!namePrefix) namePrefix = 'ITM';

  // Flavour prefix: first 3 letters or 'STD' if empty/standard
  const flavClean = cleanWord(flavour);
  const flavPrefix = flavClean ? flavClean.slice(0, 3) : 'STD';

  // Size prefix: compact alphanumeric (e.g., '1 kg' -> '1KG', '2 lbs' -> '2LB', '500 g' -> '500G')
  const sizeClean = cleanWord(size) || 'STD';

  return `${brandPrefix}-${namePrefix}-${flavPrefix}-${sizeClean}`;
}
