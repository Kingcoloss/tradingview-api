import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';
import baseline from '../fixtures/baseline-frames.json';

const Client = require('../../src/client').default;

describe('fake-socket frame recording', () => {
  it('replays the Task 8 golden call sequence byte-identical to the baseline', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const fake = createFakeTransport();
      const client = new Client({ transport: fake.factory });
      fake.open();
      const quote = new client.Session.Quote();
      const market = new quote.Market('BINANCE:BTCEUR', 'regular');
      const chart = new client.Session.Chart();
      chart.setMarket('BINANCE:BTCEUR', { timeframe: 'D' });
      chart.setSeries('15');
      market.close();
      quote.delete();
      chart.delete();
      await client.end();

      expect(fake.sent).toEqual(baseline);
    } finally {
      Math.random = originalRandom;
    }
  });
});
