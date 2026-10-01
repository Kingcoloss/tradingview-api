import { describe, it, expect } from '../utils';

const exports = [
  'getTA', 'searchMarket', 'searchMarketV3', 'searchIndicator', 'getIndicator',
  'loginUser', 'getUser', 'getPrivateIndicators', 'getChartToken', 'getDrawings',
  'Client', 'PineIndicator', 'BuiltInIndicator', 'PinePermManager',
];

describe('Bun ESM artifact', () => {
  it('exports every public function and class with an object default', async () => {
    const mod = await import('../../dist/bun/index.mjs' as string);
    for (const name of exports) {
      expect(typeof mod[name]).toBe('function');
      expect(mod.default[name]).toBe(mod[name]);
    }
  });
});
