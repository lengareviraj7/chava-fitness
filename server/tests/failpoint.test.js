import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { failpoint, setFailpoint, clearFailpoint } from '../src/utils/failpoint.js';

describe('Area 3: Failpoint Mechanism & Production Inertness', () => {
  beforeEach(() => {
    clearFailpoint();
  });

  afterEach(() => {
    clearFailpoint();
    process.env.NODE_ENV = 'test';
  });

  it('triggers an error in test mode when failpoint matches', () => {
    setFailpoint('checkout_after_bill_insert');
    expect(() => failpoint('checkout_after_bill_insert')).toThrowError('Injected failpoint error at: checkout_after_bill_insert');
  });

  it('is a no-op when failpoint name does not match', () => {
    setFailpoint('checkout_after_bill_insert');
    expect(() => failpoint('different_step')).not.toThrow();
  });

  it('GUARANTEED INERT when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    setFailpoint('critical_database_write');
    expect(() => failpoint('critical_database_write')).not.toThrow();
  });
});
