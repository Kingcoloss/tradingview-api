export interface TransportEvents {
  onOpen(): void;
  onClose(): void;
  onError(message: string): void;
  onMessage(data: string): void;
}
export type TransportState = 'connecting' | 'open' | 'closing' | 'closed';
export interface Transport {
  send(data: string): void;
  close(): void;
  readonly state: TransportState;
}
export interface TransportOptions {
  url: string;
  headers: Record<string, string>;
}
export type TransportFactory = (
  options: TransportOptions,
  events: TransportEvents,
) => Transport;
