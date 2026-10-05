import TradingView, { Client, PineIndicator } from '@mathieuc/tradingview';

const client: TradingView.Client = new Client({});
const indicator: TradingView.PineIndicator = new PineIndicator({
  pineId: 'id', pineVersion: 'last', description: 'description', shortDescription: 'short', inputs: {}, plots: {}, script: '',
});
void client;
void indicator;
