import * as mod from '@mathieuc/tradingview';

console.log(JSON.stringify({
  hasClient: typeof mod.Client === 'function',
  hasGetTA: typeof mod.getTA === 'function',
  resolved: import.meta.resolve('@mathieuc/tradingview'),
}));
