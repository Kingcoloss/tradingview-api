import type { ClientBridge, SendPacket, SessionPacket } from '../client';
import type { TimeFrame, Timezone } from '../types';
import { genSessionID } from '../utils';

import studyConstructor from './study';

export type ChartType = 'HeikinAshi' | 'Renko' | 'LineBreak' | 'Kagi'
  | 'PointAndFigure' | 'Range';

const ChartTypes: Record<ChartType, string> = {
  HeikinAshi: 'BarSetHeikenAshi@tv-basicstudies-60!',
  Renko: 'BarSetRenko@tv-prostudies-40!',
  LineBreak: 'BarSetPriceBreak@tv-prostudies-34!',
  Kagi: 'BarSetKagi@tv-prostudies-34!',
  PointAndFigure: 'BarSetPnF@tv-prostudies-34!',
  Range: 'BarSetRange@tv-basicstudies-72!',
};

export interface ChartInputs {
  atrLength?: number;
  source?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
  style?: 'ATR' | string;
  boxSize?: number;
  reversalAmount?: number;
  sources?: 'Close';
  wicks?: boolean;
  lb?: number;
  oneStepBackBuilding?: boolean;
  phantomBars?: boolean;
  range?: number;
}

export type StudyListeners = Record<string, (packet: SessionPacket) => void>;

export interface ChartSessionBridge {
  sessionID: string;
  studyListeners: StudyListeners;
  indexes: Record<number, number>;
  send: SendPacket;
}

export type ChartEvent = 'seriesLoaded' | 'symbolLoaded' | 'update'
  | 'replayLoaded' | 'replayPoint' | 'replayResolution' | 'replayEnd'
  | 'event' | 'error';

export interface PricePeriod {
  time: number;
  open: number;
  close: number;
  max: number;
  min: number;
  volume: number;
}

export interface Subsession {
  id: string;
  description: string;
  private: boolean;
  session: string;
  'session-correction': string;
  'session-display': string;
}

/* eslint-disable camelcase */
export interface MarketInfos {
  series_id: string;
  base_currency: string;
  base_currency_id: string;
  name: string;
  full_name: string;
  pro_name: string;
  description: string;
  short_description: string;
  exchange: string;
  listed_exchange: string;
  provider_id: string;
  currency_id: string;
  currency_code: string;
  variable_tick_size: string;
  pricescale: number;
  pointvalue: number;
  session: string;
  session_display: string;
  type: string;
  has_intraday: boolean;
  fractional: boolean;
  is_tradable: boolean;
  minmov: number;
  minmove2: number;
  timezone: string;
  is_replayable: boolean;
  has_adjustment: boolean;
  has_extended_hours: boolean;
  bar_source: string;
  bar_transform: string;
  bar_fillgaps: boolean;
  allowed_adjustment: string;
  subsession_id: string;
  pro_perm: string;
  base_name: unknown[];
  legs: unknown[];
  subsessions: Subsession[];
  typespecs: unknown[];
  resolutions: unknown[];
  aliases: unknown[];
  alternatives: unknown[];
  [key: string]: unknown;
}
/* eslint-enable camelcase */

export interface ChartOptions {
  timeframe?: TimeFrame;
  range?: number;
  to?: number;
  adjustment?: 'splits' | 'dividends';
  backadjustment?: boolean;
  session?: 'regular' | 'extended';
  currency?: 'EUR' | 'USD' | string;
  type?: ChartType;
  inputs?: ChartInputs;
  replay?: number;
}

type ChartCallback = (...args: any[]) => void;
type ChartCallbacks = Record<ChartEvent, ChartCallback[]>;

export default function chartSessionGenerator(client: ClientBridge) {
  return class ChartSession {
  #chartSessionID = genSessionID('cs');

  #replaySessionID = genSessionID('rs');

  #replayMode = false;

  #replayOKCB: Record<string, () => void> = {};

  /** Parent client */
  #client = client;

  #studyListeners: StudyListeners = {};

  /** Table of periods values indexed by timestamp. */
  #periods: Record<number, PricePeriod> = {};

  /** List of periods values. */
  get periods(): PricePeriod[] {
    return Object.values(this.#periods).sort((a, b) => b.time - a.time);
  }

  /** Current market infos. */
  #infos: Partial<MarketInfos> = {};

  /** Current market infos. */
  get infos(): Partial<MarketInfos> {
    return this.#infos;
  }

  #callbacks: ChartCallbacks = {
    seriesLoaded: [],
    symbolLoaded: [],
    update: [],

    replayLoaded: [],
    replayPoint: [],
    replayResolution: [],
    replayEnd: [],

    event: [],
    error: [],
  };

  #handleEvent(ev: ChartEvent, ...data: unknown[]): void {
    this.#callbacks[ev].forEach((callback) => callback(...data));
    this.#callbacks.event.forEach((callback) => callback(ev, ...data));
  }

  #handleError(...msgs: unknown[]): void {
    if (this.#callbacks.error.length === 0) console.error(...msgs);
    else this.#handleEvent('error', ...msgs);
  }

  constructor() {
    this.#client.sessions[this.#chartSessionID] = {
      type: 'chart',
      onData: (packet: any) => {
        if (global.TW_DEBUG) console.log('§90§30§106 CHART SESSION §0 DATA', packet);

        if (typeof packet.data[1] === 'string' && this.#studyListeners[packet.data[1]]) {
          this.#studyListeners[packet.data[1]](packet);
          return;
        }

        if (packet.type === 'symbol_resolved') {
          this.#infos = {
            series_id: packet.data[1],
            ...packet.data[2],
          };

          this.#handleEvent('symbolLoaded');
          return;
        }

        if (['timescale_update', 'du'].includes(packet.type)) {
          const changes: string[] = [];

          Object.keys(packet.data[1]).forEach((k) => {
            changes.push(k);
            if (k === '$prices') {
              const periods = packet.data[1].$prices;
              if (!periods || !periods.s) return;

              periods.s.forEach((p: { i: number; v: number[] }) => {
                [this.#chartSession.indexes[p.i]] = p.v;
                this.#periods[p.v[0]] = {
                  time: p.v[0],
                  open: p.v[1],
                  close: p.v[4],
                  max: p.v[2],
                  min: p.v[3],
                  volume: Math.round(p.v[5] * 100) / 100,
                };
              });

              return;
            }

            if (this.#studyListeners[k]) this.#studyListeners[k](packet);
          });

          this.#handleEvent('update', changes);
          return;
        }

        if (packet.type === 'symbol_error') {
          this.#handleError(`(${packet.data[1]}) Symbol error:`, packet.data[2]);
          return;
        }

        if (packet.type === 'series_error') {
          this.#handleError('Series error:', packet.data[3]);
          return;
        }

        if (packet.type === 'critical_error') {
          const [, name, description] = packet.data;
          this.#handleError('Critical error:', name, description);
        }
      },
    };

    this.#client.sessions[this.#replaySessionID] = {
      type: 'replay',
      onData: (packet: any) => {
        if (global.TW_DEBUG) console.log('§90§30§106 REPLAY SESSION §0 DATA', packet);

        if (packet.type === 'replay_ok') {
          if (this.#replayOKCB[packet.data[1]]) {
            this.#replayOKCB[packet.data[1]]();
            delete this.#replayOKCB[packet.data[1]];
          }
          return;
        }

        if (packet.type === 'replay_instance_id') {
          this.#handleEvent('replayLoaded', packet.data[1]);
          return;
        }

        if (packet.type === 'replay_point') {
          this.#handleEvent('replayPoint', packet.data[1]);
          return;
        }

        if (packet.type === 'replay_resolutions') {
          this.#handleEvent('replayResolution', packet.data[1], packet.data[2]);
          return;
        }

        if (packet.type === 'replay_data_end') {
          this.#handleEvent('replayEnd');
          return;
        }

        if (packet.type === 'critical_error') {
          const [, name, description] = packet.data;
          this.#handleError('Critical error:', name, description);
        }
      },
    };

    this.#client.send('chart_create_session', [this.#chartSessionID]);
  }

  #seriesCreated = false;

  #currentSeries = 0;

  /**
   * @param {import('../types').TimeFrame} timeframe Chart period timeframe
   * @param {number} [range] Number of loaded periods/candles (Default: 100)
   * @param {number} [reference] Reference candle timestamp (Default is now)
   */
  setSeries(timeframe: TimeFrame = '240', range = 100, reference: number | null = null): void {
    if (!this.#currentSeries) {
      this.#handleError('Please set the market before setting series');
      return;
    }

    const calcRange = !reference ? range : ['bar_count', reference, range];

    this.#periods = {};

    this.#client.send(`${this.#seriesCreated ? 'modify' : 'create'}_series`, [
      this.#chartSessionID,
      '$prices',
      's1',
      `ser_${this.#currentSeries}`,
      timeframe,
      this.#seriesCreated ? '' : calcRange,
    ]);

    this.#seriesCreated = true;
  }

  /**
   * Set the chart market
   * @param {string} symbol Market symbol
   * @param {Object} [options] Chart options
   * @param {import('../types').TimeFrame} [options.timeframe] Chart period timeframe
   * @param {number} [options.range] Number of loaded periods/candles (Default: 100)
   * @param {number} [options.to] Last candle timestamp (Default is now)
   * @param {'splits' | 'dividends'} [options.adjustment] Market adjustment
   * @param {boolean} [options.backadjustment] Market backadjustment of futures contracts
   * @param {'regular' | 'extended'} [options.session] Chart session
   * @param {'EUR' | 'USD' | string} [options.currency] Chart currency
   * @param {ChartType} [options.type] Chart custom type
   * @param {ChartInputs} [options.inputs] Chart custom inputs
   * @param {number} [options.replay] Replay mode starting point (Timestamp)
   */
  setMarket(symbol: string, options: ChartOptions = {}): void {
    this.#periods = {};

    if (this.#replayMode) {
      this.#replayMode = false;
      this.#client.send('replay_delete_session', [this.#replaySessionID]);
    }

    const symbolInit: Record<string, any> = {
      symbol: symbol || 'BTCEUR',
      adjustment: options.adjustment || 'splits',
    };

    if (options.backadjustment) symbolInit.backadjustment = 'default';
    if (options.session) symbolInit.session = options.session;
    if (options.currency) symbolInit['currency-id'] = options.currency;

    if (options.replay) {
      if (!this.#replayMode) {
        this.#replayMode = true;
        this.#client.send('replay_create_session', [this.#replaySessionID]);
      }

      this.#client.send('replay_add_series', [
        this.#replaySessionID,
        'req_replay_addseries',
        `=${JSON.stringify(symbolInit)}`,
        options.timeframe,
      ]);

      this.#client.send('replay_reset', [
        this.#replaySessionID,
        'req_replay_reset',
        options.replay,
      ]);
    }

    const complex = options.type || options.replay;
    const chartInit: Record<string, any> = complex ? {} : symbolInit;

    if (complex) {
      if (options.replay) chartInit.replay = this.#replaySessionID;
      chartInit.symbol = symbolInit;
      chartInit.type = options.type ? ChartTypes[options.type] : undefined;
      if (options.type) chartInit.inputs = { ...options.inputs };
    }

    this.#currentSeries += 1;

    this.#client.send('resolve_symbol', [
      this.#chartSessionID,
      `ser_${this.#currentSeries}`,
      `=${JSON.stringify(chartInit)}`,
    ]);

    this.setSeries(options.timeframe, options.range, options.to);
  }

  /**
   * Set the chart timezone
   * @param {import('../types').Timezone} timezone New timezone
   */
  setTimezone(timezone: Timezone): void {
    this.#periods = {};
    this.#client.send('switch_timezone', [this.#chartSessionID, timezone]);
  }

  /**
   * Fetch x additional previous periods/candles values
   * @param {number} number Number of additional periods/candles you want to fetch
   */
  fetchMore(number = 1): void {
    this.#client.send('request_more_data', [this.#chartSessionID, '$prices', number]);
  }

  /**
   * Fetch x additional previous periods/candles values
   * @param {number} number Number of additional periods/candles you want to fetch
   * @returns {Promise} Raise when the data has been fetched
   */
  replayStep(number = 1): Promise<void> {
    return new Promise((cb) => {
      if (!this.#replayMode) {
        this.#handleError('No replay session');
        return;
      }

      const reqID = genSessionID('rsq_step');
      this.#client.send('replay_step', [this.#replaySessionID, reqID, number]);
      this.#replayOKCB[reqID] = () => { cb(); };
    });
  }

  /**
   * Start fetching a new period/candle every x ms
   * @param {number} interval Number of additional periods/candles you want to fetch
   * @returns {Promise} Raise when the replay mode starts
   */
  replayStart(interval = 1000): Promise<void> {
    return new Promise((cb) => {
      if (!this.#replayMode) {
        this.#handleError('No replay session');
        return;
      }

      const reqID = genSessionID('rsq_start');
      this.#client.send('replay_start', [this.#replaySessionID, reqID, interval]);
      this.#replayOKCB[reqID] = () => { cb(); };
    });
  }

  /**
   * Stop fetching a new period/candle every x ms
   * @returns {Promise} Raise when the replay mode stops
   */
  replayStop(): Promise<void> {
    return new Promise((cb) => {
      if (!this.#replayMode) {
        this.#handleError('No replay session');
        return;
      }

      const reqID = genSessionID('rsq_stop');
      this.#client.send('replay_stop', [this.#replaySessionID, reqID]);
      this.#replayOKCB[reqID] = () => { cb(); };
    });
  }

  /**
   * When a symbol is loaded
   * @param {() => void} cb
   * @event
   */
  onSymbolLoaded(cb: () => void): void {
    this.#callbacks.symbolLoaded.push(cb);
  }

  /**
   * When a chart update happens
   * @param {(changes: ('$prices' | string)[]) => void} cb
   * @event
   */
  onUpdate(cb: (changes: ('$prices' | string)[]) => void): void {
    this.#callbacks.update.push(cb);
  }

  /**
   * When the replay session is ready
   * @param {() => void} cb
   * @event
   */
  onReplayLoaded(cb: (instanceID: string) => void): void {
    this.#callbacks.replayLoaded.push(cb);
  }

  /**
   * When the replay session has new resolution
   * @param {(
   *   timeframe: import('../types').TimeFrame,
   *   index: number,
   * ) => void} cb
   * @event
   */
  onReplayResolution(cb: (timeframe: TimeFrame, index: number) => void): void {
    this.#callbacks.replayResolution.push(cb);
  }

  /**
   * When the replay session ends
   * @param {() => void} cb
   * @event
   */
  onReplayEnd(cb: () => void): void {
    this.#callbacks.replayEnd.push(cb);
  }

  /**
   * When the replay session cursor has moved
   * @param {(index: number) => void} cb
   * @event
   */
  onReplayPoint(cb: (index: number) => void): void {
    this.#callbacks.replayPoint.push(cb);
  }

  /**
   * When chart error happens
   * @param {(...any) => void} cb Callback
   * @event
   */
  onError(cb: (...args: unknown[]) => void): void {
    this.#callbacks.error.push(cb);
  }

  /** @type {ChartSessionBridge} */
  #chartSession: ChartSessionBridge = {
    sessionID: this.#chartSessionID,
    studyListeners: this.#studyListeners,
    indexes: {},
    send: (type, data) => this.#client.send(type, data),
  };

  Study = studyConstructor(this.#chartSession);

  /** Delete the chart session */
  delete(): void {
    if (this.#replayMode) this.#client.send('replay_delete_session', [this.#replaySessionID]);
    this.#client.send('chart_delete_session', [this.#chartSessionID]);
    delete this.#client.sessions[this.#chartSessionID];
    delete this.#client.sessions[this.#replaySessionID];
    this.#replayMode = false;
  }
  };
}
