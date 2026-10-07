import TradingView from '../../src/index';

let client!: TradingView.Client;
let pine!: TradingView.PineIndicator;
let builtIn!: TradingView.BuiltInIndicator;
let manager!: TradingView.PinePermManager;
let chart!: InstanceType<typeof client.Session.Chart>;
let study!: InstanceType<typeof chart.Study>;

void [client, pine, builtIn, manager, chart, study];
