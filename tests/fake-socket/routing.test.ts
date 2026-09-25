import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';

const Client = require('../../src/client').default;

describe('fake-socket routing', () => {
  it('routes a quote packet to the matching QuoteMarket listener by symbol key', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();

    const quote = new client.Session.Quote();
    const market = new quote.Market('BTCEUR', 'regular');
    const received: unknown[] = [];
    market.onData((data: unknown) => received.push(data));

    const symbolKey = '={"session":"regular","symbol":"BTCEUR"}';
    const createFrame = fake.sent.find((f) => f.includes('quote_create_session'));
    expect(createFrame).toBeDefined();
    const qsID = (/"p":\["(qs_[A-Za-z0-9]+)"\]/.exec(createFrame as string) as RegExpExecArray)[1];

    const body = JSON.stringify({ m: 'qsd', p: [qsID, { n: symbolKey, s: 'ok', v: { lp: 1 } }] });
    fake.deliver(`~m~${body.length}~m~${body}`);

    expect(received.length).toBe(1);
    market.close();
  });

  it('routes a symbol_resolved packet to the chart branch, not a study listener', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();

    const chart = new client.Session.Chart();
    const symbolLoaded: unknown[] = [];
    chart.onSymbolLoaded(() => symbolLoaded.push(true));

    const createFrame = fake.sent.find((f) => f.includes('chart_create_session'));
    expect(createFrame).toBeDefined();
    const csID = (/"p":\["(cs_[A-Za-z0-9]+)"\]/.exec(createFrame as string) as RegExpExecArray)[1];

    const body = JSON.stringify({ m: 'symbol_resolved', p: [csID, 'ser_1', { pro_name: 'BTCEUR' }] });
    fake.deliver(`~m~${body.length}~m~${body}`);

    expect(symbolLoaded.length).toBe(1);
  });

  it('routes a packet whose data[1] matches a study id to the study listener, not symbolLoaded', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();

    const chart = new client.Session.Chart();
    const symbolLoaded: unknown[] = [];
    chart.onSymbolLoaded(() => symbolLoaded.push(true));

    // A packet with the same shape as symbol_resolved but a study id in data[1]
    // must not be mistaken for the chart session id.
    const body = JSON.stringify({ m: 'symbol_resolved', p: ['st_NOTCS', 'ser_1', {}] });
    fake.deliver(`~m~${body.length}~m~${body}`);

    expect(symbolLoaded.length).toBe(0);
  });
});
