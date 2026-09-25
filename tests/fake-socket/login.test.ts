import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';
import { formatWSPacket } from '../../src/protocol';

const Client = require('../../src/client').default;

describe('fake-socket login', () => {
  it('sends set_auth_token unauthorized_user_token as first frame after open', () => {
    const fake = createFakeTransport();
    // eslint-disable-next-line no-new
    new Client({ transport: fake.factory });
    fake.open();
    expect(fake.sent[0]).toBe(
      formatWSPacket({ m: 'set_auth_token', p: ['unauthorized_user_token'] }),
    );
  });

  it('closes before open transitions to closed without throwing', async () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    await client.end();
    expect(fake.state).toBe('closed');
  });
});
