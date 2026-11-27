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
