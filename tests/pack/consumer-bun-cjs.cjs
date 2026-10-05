const mod = require('@mathieuc/tradingview');

console.log(JSON.stringify({
  hasClient: typeof mod.Client === 'function',
  hasGetTA: typeof mod.getTA === 'function',
  resolved: require.resolve('@mathieuc/tradingview'),
}));
