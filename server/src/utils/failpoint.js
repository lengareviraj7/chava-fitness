import { env } from '../config/env.js';

let activeFailpoint = null;

/**
 * Test-only failpoint injection helper.
 * Throws an Error with the failpoint name if matching activeFailpoint.
 * GUARANTEED NO-OP in production environment.
 *
 * @param {string} name
 */
export function failpoint(name) {
  if (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') {
    return; // Guaranteed inert in production
  }
  if (activeFailpoint && activeFailpoint === name) {
    const error = new Error(`Injected failpoint error at: ${name}`);
    error.code = 'INJECTED_FAILPOINT';
    throw error;
  }
}

export function setFailpoint(name) {
  activeFailpoint = name;
}

export function clearFailpoint() {
  activeFailpoint = null;
}
