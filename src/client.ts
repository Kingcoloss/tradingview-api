import chartSessionGenerator from './chart/session';
import misc from './miscRequests';
import {
  formatWSPacket,
  parseWSPacket,
  type TWPacket,
} from './protocol';
import quoteSessionGenerator from './quote/session';
import { defaultTransport } from './transport/default';
import type { Transport, TransportFactory } from './transport/types';

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var TW_DEBUG: boolean | undefined;
}

export interface SessionPacket {
  type: string;
  data: unknown[];
}

export interface Session {
  type: 'quote' | 'chart' | 'replay';
  onData(data: SessionPacket): void;
}

export type SessionList = Record<string, Session>;

export type SendPacket = (type: string, data?: unknown[]) => void;

export interface ClientBridge {
  sessions: SessionList;
  send: SendPacket;
}

export type ClientEvent = 'connected' | 'disconnected' | 'logged' | 'ping'
  | 'data' | 'error' | 'event';

export interface ClientOptions {
  token?: string;
  signature?: string;
  DEBUG?: boolean;
  server?: 'data' | 'prodata' | 'widgetdata';
  location?: string;
  headers?: Record<string, string>;
  transport?: TransportFactory;
}

/* eslint-disable camelcase */
export interface SocketSession {
  session_id: string;
  timestamp: number;
  timestampMs: number;
  release: string;
  studies_metadata_hash: string;
  protocol: 'json' | string;
  javastudies: string;
  auth_scheme_vsn: number;
  via: string;
}
/* eslint-enable camelcase */

type ClientCallback = (...args: any[]) => void;

type ClientCallbacks = Record<ClientEvent, ClientCallback[]>;

export default class Client {
  #transport: Transport;

  #logged = false;

  /** If the client is logged in */
  get isLogged(): boolean {
    return this.#logged;
  }

  /** If the client was closed */
  get isOpen(): boolean {
    return this.#transport.state === 'open';
  }

  #sessions: SessionList = {};

  #callbacks: ClientCallbacks = {
    connected: [],
    disconnected: [],
    logged: [],
    ping: [],
    data: [],
    error: [],
    event: [],
  };

  #handleEvent(ev: ClientEvent, ...data: unknown[]): void {
    this.#callbacks[ev].forEach((callback) => callback(...data));
    this.#callbacks.event.forEach((callback) => callback(ev, ...data));
  }

  #handleError(...msgs: unknown[]): void {
    if (this.#callbacks.error.length === 0) console.error(...msgs);
    else this.#handleEvent('error', ...msgs);
  }

  /** When client is connected. */
  onConnected(cb: () => void): void {
    this.#callbacks.connected.push(cb);
  }

  /** When client is disconnected. */
  onDisconnected(cb: () => void): void {
    this.#callbacks.disconnected.push(cb);
  }

  /** When client is logged in. */
  onLogged(cb: (socketSession: SocketSession) => void): void {
    this.#callbacks.logged.push(cb);
  }

  /** When server is pinging the client. */
  onPing(cb: (value: number) => void): void {
    this.#callbacks.ping.push(cb);
  }

  /** When unparsed data is received. */
  onData(cb: (...data: unknown[]) => void): void {
    this.#callbacks.data.push(cb);
  }

  /** When a client error happens. */
  onError(cb: (...data: unknown[]) => void): void {
    this.#callbacks.error.push(cb);
  }

  /** When a client event happens. */
  onEvent(cb: (event: ClientEvent, ...data: unknown[]) => void): void {
    this.#callbacks.event.push(cb);
  }

  #parsePacket(str: string): void {
    if (!this.isOpen) return;

    (parseWSPacket(str) as Array<TWPacket | number>).forEach((packet) => {
      if (global.TW_DEBUG) console.log('§90§30§107 CLIENT §0 PACKET', packet);
      if (typeof packet === 'number') {
        this.#transport.send(formatWSPacket(`~h~${packet}`));
        this.#handleEvent('ping', packet);
        return;
      }

      if (packet.m === 'protocol_error') {
        this.#handleError('Client critical error:', packet.p);
        this.#transport.close();
        return;
      }

      if (packet.m && packet.p) {
        const parsed = {
          type: packet.m,
          data: packet.p,
        };

        const session = packet.p[0] as string;

        if (session && this.#sessions[session]) {
          this.#sessions[session].onData(parsed);
          return;
        }
      }

      if (!this.#logged) {
        this.#handleEvent('logged', packet);
        return;
      }

      this.#handleEvent('data', packet);
    });
  }

  #sendQueue: string[] = [];

  /** Send a custom packet. */
  send(type: string, data: unknown[] = []): void {
    this.#sendQueue.push(formatWSPacket({ m: type, p: data }));
    this.sendQueue();
  }

  /** Send all waiting packets. */
  sendQueue(): void {
    while (this.isOpen && this.#logged && this.#sendQueue.length > 0) {
      const packet = this.#sendQueue.shift() as string;
      this.#transport.send(packet);
      if (global.TW_DEBUG) console.log('§90§30§107 > §0', packet);
    }
  }

  constructor(clientOptions: ClientOptions = {}) {
    if (clientOptions.DEBUG) global.TW_DEBUG = clientOptions.DEBUG;

    const server = clientOptions.server || 'data';
    const defaultHeaders = {
      // eslint-disable-next-line max-len
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    };

    const factory = clientOptions.transport || defaultTransport;
    this.#transport = factory(
      {
        url: `wss://${server}.tradingview.com/socket.io/websocket?from=chart&type=chart`,
        headers: {
          Origin: 'https://www.tradingview.com',
          ...defaultHeaders,
          ...clientOptions.headers,
        },
      },
      {
        onOpen: () => {
          this.#handleEvent('connected');
          this.sendQueue();
        },
        onClose: () => {
          this.#logged = false;
          this.#handleEvent('disconnected');
        },
        onError: (msg) => this.#handleError('WebSocket', msg),
        onMessage: (data) => this.#parsePacket(data),
      },
    );

    if (clientOptions.token) {
      misc.getUser(
        clientOptions.token,
        clientOptions.signature ? clientOptions.signature : '',
        clientOptions.location ? clientOptions.location : 'https://tradingview.com',
      ).then((user) => {
        this.#sendQueue.unshift(formatWSPacket({
          m: 'set_auth_token',
          p: [user.authToken],
        }));
        this.#logged = true;
        this.sendQueue();
      }).catch((err) => {
        this.#handleError('Credentials error:', err.message);
      });
    } else {
      this.#sendQueue.unshift(formatWSPacket({
        m: 'set_auth_token',
        p: ['unauthorized_user_token'],
      }));
      this.#logged = true;
      this.sendQueue();
    }
  }

  #clientBridge: ClientBridge = {
    sessions: this.#sessions,
    send: (type, data) => this.send(type, data),
  };

  /** Session constructors bound to this client. */
  Session = {
    Quote: quoteSessionGenerator(this.#clientBridge),
    Chart: chartSessionGenerator(this.#clientBridge),
  };

  /** Close the websocket connection. */
  end(): Promise<void> {
    return new Promise((cb) => {
      if (this.#transport.state !== 'closed') this.#transport.close();
      cb();
    });
  }
}
