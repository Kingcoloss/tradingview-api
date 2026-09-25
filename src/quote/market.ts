import type { QuoteSessionBridge } from './session';

export type MarketEvent = 'loaded' | 'data' | 'error';

interface QuotePacket {
  type: string;
  data: unknown[];
}

type MarketCallback = (...args: any[]) => void;

type MarketCallbacks = Record<MarketEvent | 'event', MarketCallback[]>;

export default function quoteMarketConstructor(quoteSession: QuoteSessionBridge) {
  return class QuoteMarket {
    #symbolListeners = quoteSession.symbolListeners;

    #symbol: string;

    #session: string;

    #symbolKey: string;

    #symbolListenerID = 0;

    #lastData: Record<string, unknown> = {};

    #callbacks: MarketCallbacks = {
      loaded: [],
      data: [],
      event: [],
      error: [],
    };

    #handleEvent(ev: MarketEvent, ...data: unknown[]): void {
      this.#callbacks[ev].forEach((e) => e(...data));
      this.#callbacks.event.forEach((e) => e(ev, ...data));
    }

    #handleError(...msgs: unknown[]): void {
      if (this.#callbacks.error.length === 0) console.error(...msgs);
      else this.#handleEvent('error', ...msgs);
    }

    /**
     * @param symbol Market symbol (like: 'BTCEUR' or 'KRAKEN:BTCEUR')
     * @param session Market session (like: 'regular' or 'extended')
     */
    constructor(symbol: string, session = 'regular') {
      this.#symbol = symbol;
      this.#session = session;
      this.#symbolKey = `=${JSON.stringify({ session, symbol })}`;

      if (!this.#symbolListeners[this.#symbolKey]) {
        this.#symbolListeners[this.#symbolKey] = [];
        quoteSession.send('quote_add_symbols', [
          quoteSession.sessionID,
          this.#symbolKey,
        ]);
      }

      this.#symbolListenerID = this.#symbolListeners[this.#symbolKey].length;

      this.#symbolListeners[this.#symbolKey][this.#symbolListenerID] = (packet: QuotePacket) => {
        if (global.TW_DEBUG) console.log('§90§30§105 MARKET §0 DATA', packet);

        const p1 = packet.data[1] as { s?: string; v?: Record<string, unknown> };

        if (packet.type === 'qsd' && p1.s === 'ok') {
          this.#lastData = {
            ...this.#lastData,
            ...p1.v,
          };
          this.#handleEvent('data', this.#lastData);
          return;
        }

        if (packet.type === 'quote_completed') {
          this.#handleEvent('loaded');
          return;
        }

        if (packet.type === 'qsd' && p1.s === 'error') {
          this.#handleError('Market error', packet.data);
        }
      };
    }

    /** When quote market is loaded. */
    onLoaded(cb: () => void): void {
      this.#callbacks.loaded.push(cb);
    }

    /** When quote data is received. */
    onData(cb: (data: Record<string, unknown>) => void): void {
      this.#callbacks.data.push(cb);
    }

    /** When quote event happens. */
    onEvent(cb: (...args: unknown[]) => void): void {
      this.#callbacks.event.push(cb);
    }

    /** When quote error happens. */
    onError(cb: (...args: unknown[]) => void): void {
      this.#callbacks.error.push(cb);
    }

    /** Close this listener. */
    close(): void {
      if (this.#symbolListeners[this.#symbolKey].length <= 1) {
        quoteSession.send('quote_remove_symbols', [
          quoteSession.sessionID,
          this.#symbolKey,
        ]);
      }
      delete this.#symbolListeners[this.#symbolKey][this.#symbolListenerID];
    }
  };
}
