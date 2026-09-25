import { describe, expect, it } from '../utils';

class FakeWebSocket {
  static instance: FakeWebSocket;

  readyState = 0;

  handlers: Record<string, (event: any) => void> = {};

  sent: string[] = [];

  closed = false;

  constructor(public url: string, public options: unknown) {
    FakeWebSocket.instance = this;
  }

  addEventListener(name: string, handler: (event: any) => void) {
    this.handlers[name] = handler;
  }

  send(data: string) { this.sent.push(data); }

  close() { this.closed = true; }
}

describe('bun transport', () => {
  it('adapts Bun native WebSocket headers, state, and events', async () => {
    const OriginalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    try {
      const { bunTransport } = await import('../../src/transport/bun');
      const received: string[] = [];
      const transport = bunTransport(
        { url: 'wss://example.test', headers: { Origin: 'https://example.test' } },
        {
          onOpen() { received.push('open'); },
          onClose() { received.push('close'); },
          onError(message) { received.push(`error:${message}`); },
          onMessage(data) { received.push(`message:${data}`); },
        },
      );
      const ws = FakeWebSocket.instance;

      expect([ws.url, ws.options]).toEqual([
        'wss://example.test',
        { headers: { Origin: 'https://example.test' } },
      ]);
      expect(transport.state).toBe('connecting');
      ws.readyState = 1;
      ws.handlers.open({});
      ws.handlers.message({ data: 42 });
      ws.handlers.error({ message: 'broken' });
      transport.send('frame');
      transport.close();
      ws.handlers.close({});

      expect(transport.state).toBe('open');
      expect(ws.sent).toEqual(['frame']);
      expect(ws.closed).toBe(true);
      expect(received).toEqual(['open', 'message:42', 'error:broken', 'close']);

      ws.readyState = 2;
      expect(transport.state).toBe('closing');
      ws.readyState = 3;
      expect(transport.state).toBe('closed');
      ws.readyState = 99;
      expect(transport.state).toBe('closed');
    } finally {
      globalThis.WebSocket = OriginalWebSocket;
    }
  });
});
