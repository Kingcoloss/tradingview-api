import { genSessionID } from '../utils';
import quoteMarketConstructor from './market';
import type { ClientBridge, SendPacket } from '../client';

export type SymbolListeners = Record<string, Array<(packet: any) => void>>;

export interface QuoteSessionBridge {
  sessionID: string;
  symbolListeners: SymbolListeners;
  send: SendPacket;
}

export type quoteField = 'base-currency-logoid'
  | 'ch' | 'chp' | 'currency-logoid' | 'provider_id'
  | 'currency_code' | 'current_session' | 'description'
  | 'exchange' | 'format' | 'fractional' | 'is_tradable'
  | 'language' | 'local_description' | 'logoid' | 'lp'
  | 'lp_time' | 'minmov' | 'minmove2' | 'original_name'
  | 'pricescale' | 'pro_name' | 'short_name' | 'type'
  | 'update_mode' | 'volume' | 'ask' | 'bid' | 'fundamentals'
  | 'high_price' | 'low_price' | 'open_price' | 'prev_close_price'
  | 'rch' | 'rchp' | 'rtc' | 'rtc_time' | 'status' | 'industry'
  | 'basic_eps_net_income' | 'beta_1_year' | 'market_cap_basic'
  | 'earnings_per_share_basic_ttm' | 'price_earnings_ttm'
  | 'sector' | 'dividends_yield' | 'timezone' | 'country_code';

export interface quoteSessionOptions {
  fields?: 'all' | 'price';
  customFields?: quoteField[];
}

function getQuoteFields(fieldsType?: 'all' | 'price'): string[] {
  if (fieldsType === 'price') {
    return ['lp'];
  }

  return [
    'base-currency-logoid', 'ch', 'chp', 'currency-logoid',
    'currency_code', 'current_session', 'description',
    'exchange', 'format', 'fractional', 'is_tradable',
    'language', 'local_description', 'logoid', 'lp',
    'lp_time', 'minmov', 'minmove2', 'original_name',
    'pricescale', 'pro_name', 'short_name', 'type',
    'update_mode', 'volume', 'ask', 'bid', 'fundamentals',
    'high_price', 'low_price', 'open_price', 'prev_close_price',
    'rch', 'rchp', 'rtc', 'rtc_time', 'status', 'industry',
    'basic_eps_net_income', 'beta_1_year', 'market_cap_basic',
    'earnings_per_share_basic_ttm', 'price_earnings_ttm',
    'sector', 'dividends_yield', 'timezone', 'country_code',
    'provider_id',
  ];
}

export default function quoteSessionGenerator(client: ClientBridge) {
  return class QuoteSession {
    #sessionID = genSessionID('qs');

    /** Parent client */
    #client = client;

    #symbolListeners: SymbolListeners = {};

    constructor(options: quoteSessionOptions = {}) {
      this.#client.sessions[this.#sessionID] = {
        type: 'quote',
        onData: (packet: any) => {
          if (global.TW_DEBUG) console.log('§90§30§102 QUOTE SESSION §0 DATA', packet);

          if (packet.type === 'quote_completed') {
            const symbolKey = packet.data[1];
            if (!this.#symbolListeners[symbolKey]) {
              this.#client.send('quote_remove_symbols', [this.#sessionID, symbolKey]);
              return;
            }
            this.#symbolListeners[symbolKey].forEach((h) => h(packet));
          }

          if (packet.type === 'qsd') {
            const symbolKey = packet.data[1].n;
            if (!this.#symbolListeners[symbolKey]) {
              this.#client.send('quote_remove_symbols', [this.#sessionID, symbolKey]);
              return;
            }
            this.#symbolListeners[symbolKey].forEach((h) => h(packet));
          }
        },
      };

      const fields = (options.customFields && options.customFields.length > 0
        ? options.customFields
        : getQuoteFields(options.fields)
      );

      this.#client.send('quote_create_session', [this.#sessionID]);
      this.#client.send('quote_set_fields', [this.#sessionID, ...fields]);
    }

    #quoteSession: QuoteSessionBridge = {
      sessionID: this.#sessionID,
      symbolListeners: this.#symbolListeners,
      send: (t, p) => this.#client.send(t, p),
    };

    Market = quoteMarketConstructor(this.#quoteSession);

    /** Delete the quote session */
    delete(): void {
      this.#client.send('quote_delete_session', [this.#sessionID]);
      delete this.#client.sessions[this.#sessionID];
    }
  };
}
