import { spyOn } from 'bun:test';
import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';

const Client = require('../../src/client').default;

describe('fake-socket error fallback', () => {
  it('falls back to console.error when no onError registered', () => {
    const fake = createFakeTransport();
    // eslint-disable-next-line no-new
    new Client({ transport: fake.factory });
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    fake.open();
    fake.error('boom');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
