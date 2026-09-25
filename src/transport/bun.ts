/* eslint-disable import/prefer-default-export */
import type { Transport, TransportFactory, TransportState } from './types';

const stateMap: Record<number, TransportState> = {
  0: 'connecting',
  1: 'open',
  2: 'closing',
  3: 'closed',
};

export const bunTransport: TransportFactory = (options, events) => {
  // Bun-specific: WebSocket constructor accepts `{ headers }` as second argument
  const ws = new WebSocket(options.url, { headers: options.headers } as any);
  ws.addEventListener('open', () => events.onOpen());
  ws.addEventListener('close', () => events.onClose());
  ws.addEventListener('error', (ev: any) => events.onError(String(ev?.message ?? 'WebSocket error')));
  ws.addEventListener('message', (ev: globalThis.MessageEvent) => events.onMessage(String(ev.data)));
  const transport: Transport = {
    send(data) { ws.send(data); },
    close() { ws.close(); },
    get state() { return stateMap[ws.readyState] ?? 'closed'; },
  };
  return transport;
};
