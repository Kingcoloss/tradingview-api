import { describe, it, expect } from '../utils';
import { genSessionID, genAuthCookies } from '../../src/utils';

describe('utils', () => {
  it('genSessionID uses prefix and 12 alphanumeric chars', () => {
    const id = genSessionID('qs');
    expect(id).toMatch(/^qs_[A-Za-z0-9]{12}$/);
  });
  it('genSessionID defaults to xs', () => {
    expect(genSessionID()).toMatch(/^xs_[A-Za-z0-9]{12}$/);
  });
  it('genAuthCookies empty when no sessionId', () => {
    expect(genAuthCookies()).toBe('');
    expect(genAuthCookies('')).toBe('');
  });
  it('genAuthCookies sessionid only when no signature', () => {
    expect(genAuthCookies('abc')).toBe('sessionid=abc');
  });
  it('genAuthCookies both when full', () => {
    expect(genAuthCookies('abc', 'xyz')).toBe('sessionid=abc;sessionid_sign=xyz');
  });
});
