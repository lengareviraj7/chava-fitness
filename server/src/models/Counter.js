import mongoose from 'mongoose';

// Atomic counter for bill/purchase sequence numbers
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "bill_2627", "purchase_2627"
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/**
 * Atomically increment and return next sequence number for a given key.
 * @param {string} key - e.g. "bill_2627", "purchase_2627"
 * @param {ClientSession} session - optional MongoDB transaction session
 * @returns {Promise<number>}
 */
export async function nextSeq(key, session = null) {
  const options = { upsert: true, new: true };
  if (session) options.session = session;
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    options
  );
  return doc.seq;
}

/**
 * Returns 4-digit fiscal year e.g. "2627" for April 1, 2026 - March 31, 2027 in Asia/Kolkata.
 */
export function getFinancialYear(date = new Date()) {
  const d = new Date(date);
  const kolkataDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const month = kolkataDate.getMonth();
  const year = kolkataDate.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}
