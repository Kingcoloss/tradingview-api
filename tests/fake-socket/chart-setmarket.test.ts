import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';

const Client = require('../../src/client').default;

describe('ChartSession.setMarket', () => {
  it('emits resolve_symbol with the expected symbolInit shape', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();
    const chart = new client.Session.Chart();
    fake.sent.length = 0;

    chart.setMarket('BINANCE:BTCEUR', { timeframe: '60', range: 50 });

    const resolveFrame = fake.sent.find((frame) => frame.includes('resolve_symbol'));
    expect(resolveFrame).toBeDefined();
    expect(resolveFrame).toContain('BINANCE:BTCEUR');
    expect(resolveFrame).toContain('\\"adjustment\\":\\"splits\\"');
  });
});
