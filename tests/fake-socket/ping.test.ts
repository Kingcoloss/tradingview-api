import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';

const Client = require('../../src/client').default;

describe('fake-socket ping', () => {
  it('echoes bare-number ping as heartbeat and emits ping event', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();
    fake.sent.length = 0;

    const pings: number[] = [];
    client.onPing((value: number) => pings.push(value));

    fake.deliver('~m~1~m~5');

    expect(fake.sent).toEqual(['~m~4~m~~h~5']);
    expect(pings).toEqual([5]);
  });
});
