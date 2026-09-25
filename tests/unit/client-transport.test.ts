import { describe, expect, it } from '../utils';
import { createFakeTransport } from '../fake-transport';
import { formatWSPacket } from '../../src/protocol';

const Client = require('../../src/client').default;

describe('client transport injection', () => {
  it('queues login first, routes events, and closes through injected transport', async () => {
    const OriginalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = class ForbiddenWebSocket {
      constructor() { throw new Error('direct WebSocket construction'); }
    } as unknown as typeof WebSocket;

    try {
      const fake = createFakeTransport();
      let factoryOptions: unknown;
      const events: string[] = [];
      const client = new Client({
        headers: { 'X-Test': 'yes' },
        transport: (options: unknown, handlers: unknown) => {
          factoryOptions = options;
          return fake.factory(options as never, handlers as never);
        },
      });
      client.onConnected(() => events.push('connected'));
      client.onDisconnected(() => events.push('disconnected'));
      client.onPing((value: number) => events.push(`ping:${value}`));
      client.onError((...args: unknown[]) => events.push(`error:${args.join(':')}`));
      client.send('custom', ['value']);

      expect(fake.sent).toEqual([]);
      expect(factoryOptions).toEqual({
        url: 'wss://data.tradingview.com/socket.io/websocket?from=chart&type=chart',
        headers: expect.objectContaining({
          Origin: 'https://www.tradingview.com',
          'X-Test': 'yes',
        }),
      });

      fake.open();
      expect(fake.sent).toEqual([
        formatWSPacket({ m: 'set_auth_token', p: ['unauthorized_user_token'] }),
        formatWSPacket({ m: 'custom', p: ['value'] }),
      ]);
      fake.deliver('~m~1~m~5');
      fake.error('broken');
      expect(fake.sent.at(-1)).toBe(formatWSPacket('~h~5'));
      expect(events).toEqual(['connected', 'ping:5', 'error:WebSocket:broken']);

      await client.end();
      expect(fake.state).toBe('closed');
      expect(events.at(-1)).toBe('disconnected');
    } finally {
      globalThis.WebSocket = OriginalWebSocket;
    }
  });

  it('end closes a connecting transport', async () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    await client.end();
    expect(fake.state).toBe('closed');
  });
});
