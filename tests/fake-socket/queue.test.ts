import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';
import { formatWSPacket } from '../../src/protocol';

const Client = require('../../src/client').default;

describe('fake-socket queue', () => {
  it('buffers outbound packets before open then flushes in order', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    client.send('test_early', ['a']);
    expect(fake.sent).toEqual([]);
    fake.open();
    expect(fake.sent).toEqual([
      formatWSPacket({ m: 'set_auth_token', p: ['unauthorized_user_token'] }),
      formatWSPacket({ m: 'test_early', p: ['a'] }),
    ]);
  });

  it('sends packets appended after open immediately in call order', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();
    fake.sent.length = 0;
    client.send('first', []);
    client.send('second', []);
    expect(fake.sent).toEqual([
      formatWSPacket({ m: 'first', p: [] }),
      formatWSPacket({ m: 'second', p: [] }),
    ]);
  });
});
