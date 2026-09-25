import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';

const Client = require('../../src/client').default;

describe('fake-socket protocol_error', () => {
  it('fires error and closes transport on protocol_error', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    const errors: unknown[][] = [];
    client.onError((...msgs: unknown[]) => errors.push(msgs));
    fake.open();

    const body = JSON.stringify({ m: 'protocol_error', p: ['bad'] });
    fake.deliver(`~m~${body.length}~m~${body}`);

    expect(errors.length).toBe(1);
    expect(errors[0][0]).toBe('Client critical error:');
    expect(fake.state).toBe('closed');
  });
});
