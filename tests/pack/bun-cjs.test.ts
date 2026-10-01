import { describe, it, expect } from '../utils';

const exports = [
  'getTA', 'searchMarket', 'searchMarketV3', 'searchIndicator', 'getIndicator',
  'loginUser', 'getUser', 'getPrivateIndicators', 'getChartToken', 'getDrawings',
  'Client', 'PineIndicator', 'BuiltInIndicator', 'PinePermManager',
];

describe('Bun CJS artifact', () => {
  it('exports every public function and class directly', () => {
    // eslint-disable-next-line global-require
    const mod = require('../../dist/bun/index.cjs');
    for (const name of exports) expect(typeof mod[name]).toBe('function');
  });
});
