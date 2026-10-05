// @ts-check
const TradingView = require('@mathieuc/tradingview');

/** @type {TradingView.Client} */
const client = new TradingView.Client({});
/** @type {TradingView.PineIndicator} */
const indicator = new TradingView.PineIndicator({
  pineId: 'id', pineVersion: 'last', description: 'description', shortDescription: 'short', inputs: {}, plots: {}, script: '',
});
void client;
void indicator;
