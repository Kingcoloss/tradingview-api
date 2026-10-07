import Client from './client';
import BuiltInIndicator from './classes/BuiltInIndicator';
import PineIndicator from './classes/PineIndicator';
import PinePermManager from './classes/PinePermManager';
import * as http from './http/miscRequests';

export {
  getTA, searchMarket, searchMarketV3, searchIndicator, getIndicator,
  loginUser, getUser, getPrivateIndicators, getChartToken, getDrawings,
} from './http/miscRequests';
export {
  Client, PineIndicator, BuiltInIndicator, PinePermManager,
};

export type {
  ClientBridge, ClientEvent, ClientOptions, SendPacket, Session, SessionList,
  SessionPacket, SocketSession,
} from './client';
export type {
  Indicator, IndicatorInput, IndicatorType,
} from './classes/PineIndicator';
export type {
  BuiltInIndicatorOption, BuiltInIndicatorType,
} from './classes/BuiltInIndicator';
export type { AuthorizationUser } from './classes/PinePermManager';
export type {
  ChartEvent, ChartInputs, ChartOptions, ChartSessionBridge, ChartType,
  MarketInfos, PricePeriod, StudyListeners, Subsession,
} from './chart/session';
export type {
  FromTo, PerfReport, StrategyReport, TradeReport, UpdateChangeType,
} from './chart/study';
export type {
  MarketEvent,
} from './quote/market';
export type {
  QuoteSessionBridge, SymbolListeners, quoteField, quoteSessionOptions,
} from './quote/session';
export type {
  Drawing, DrawingPoint, Period, Periods, SearchIndicatorResult,
  SearchMarketResult, User, UserCredentials, advice,
} from './http/miscRequests';
export type { MarketSymbol, TimeFrame, Timezone } from './types';
export type { TWPacket } from './protocol';
export type {
  Transport, TransportEvents, TransportFactory, TransportOptions, TransportState,
} from './transport/types';
export type * from './chart/graphicParser';

/* eslint-disable no-shadow */
declare namespace TradingView {
  type Client = InstanceType<typeof import('./client').default>;
  type PineIndicator = InstanceType<typeof import('./classes/PineIndicator').default>;
  type BuiltInIndicator = InstanceType<typeof import('./classes/BuiltInIndicator').default>;
  type PinePermManager = InstanceType<typeof import('./classes/PinePermManager').default>;
}
/* eslint-enable no-shadow */

// TypeScript merges this value with the namespace above.
// eslint-disable-next-line no-redeclare
const TradingView = {
  ...http,
  Client,
  PineIndicator,
  BuiltInIndicator,
  PinePermManager,
};

export default TradingView;
