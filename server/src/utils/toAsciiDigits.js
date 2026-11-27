/**
 * Transliterates Devanagari numerals (०-९) and Arabic-Indic numerals (٠-٩)
 * to standard ASCII digits (0-9).
 * Preserves all other characters untouched.
 *
 * @param {string|number} input
 * @returns {string}
 */
export function toAsciiDigits(input) {
  if (input === null || input === undefined) return '';
  const str = String(input);

  // Devanagari: U+0966 to U+096F
  // Arabic-Indic: U+0660 to U+0669
  // Eastern Arabic-Indic: U+06F0 to U+06F9
  return str.replace(/[\u0966-\u096F\u0660-\u0669\u06F0-\u06F9]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x0966 && code <= 0x096F) {
      return String(code - 0x0966);
    }
    if (code >= 0x0660 && code <= 0x0669) {
      return String(code - 0x0660);
    }
    if (code >= 0x06F0 && code <= 0x06F9) {
      return String(code - 0x06F0);
    }
    return char;
  });
}
