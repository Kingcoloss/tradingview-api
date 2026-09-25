/* eslint-disable import/prefer-default-export */
import type {
  Transport,
  TransportEvents,
  TransportFactory,
  TransportState,
} from '../src/transport/types';

export function createFakeTransport() {
  const sent: string[] = [];
  let state: TransportState = 'connecting';
  let events: TransportEvents | null = null;
  const transport: Transport = {
    send(data) { sent.push(data); },
    close() { state = 'closed'; events?.onClose(); },
    get state() { return state; },
  };
  const factory: TransportFactory = (_opts, ev) => { events = ev; return transport; };
  return {
    factory,
    sent,
    open() { state = 'open'; events?.onOpen(); },
    deliver(frame: string) { events?.onMessage(frame); },
    error(msg: string) { events?.onError(msg); },
    close() { state = 'closed'; events?.onClose(); },
    get state() { return state; },
  };
}
