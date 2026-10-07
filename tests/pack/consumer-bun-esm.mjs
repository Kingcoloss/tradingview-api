import * as mod from '@mathieuc/tradingview';
import checkApi from './api-contract.cjs';

const apiContract = checkApi(mod);
const client = new mod.Client({ transport: () => ({ send() {}, close() {}, get state() { return 'closed'; } }) });
console.log(JSON.stringify({
  resolved: import.meta.resolve('@mathieuc/tradingview'),
  apiContract,
  httpFunctions: ['getTA', 'searchMarket', 'searchMarketV3', 'searchIndicator', 'getIndicator', 'loginUser', 'getUser', 'getPrivateIndicators', 'getChartToken', 'getDrawings'].filter((name) => typeof mod[name] === 'function'),
  classes: ['Client', 'PineIndicator', 'BuiltInIndicator', 'PinePermManager'].filter((name) => typeof mod[name] === 'function'),
  clientConstructible: typeof client.end === 'function',
  nested: { quote: typeof client.Session.Quote === 'function', chart: typeof client.Session.Chart === 'function' },
}));
