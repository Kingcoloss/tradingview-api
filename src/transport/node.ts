/* eslint-disable import/prefer-default-export, import/no-extraneous-dependencies */
import WebSocket, { type RawData } from 'ws';
import type { Transport, TransportFactory, TransportState } from './types';

const stateMap: Record<number, TransportState> = {
  [WebSocket.CONNECTING]: 'connecting',
  [WebSocket.OPEN]: 'open',
  [WebSocket.CLOSING]: 'closing',
  [WebSocket.CLOSED]: 'closed',
};

function normalise(data: RawData | string): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}

export const nodeTransport: TransportFactory = (options, events) => {
  const ws = new WebSocket(options.url, { headers: options.headers });
  ws.on('open', () => events.onOpen());
  ws.on('close', () => events.onClose());
  ws.on('error', (error: Error) => events.onError(error.message));
  ws.on('message', (data) => events.onMessage(normalise(data)));

  const transport: Transport = {
    send(data) { ws.send(data); },
    close() { ws.close(); },
    get state() { return stateMap[ws.readyState] ?? 'closed'; },
  };

  return transport;
};
