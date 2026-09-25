import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';

const Client = require('../../src/client').default;

describe('fake-socket shared subscription', () => {
  it('shares one quote_add_symbols across markets with the same symbolKey', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();
    fake.sent.length = 0;

    const qs = new client.Session.Quote();
    const m1 = new qs.Market('BTCEUR', 'regular');
    const m2 = new qs.Market('BTCEUR', 'regular');

    const adds = fake.sent.filter((f: string) => f.includes('quote_add_symbols'));
    expect(adds.length).toBe(1);

    // Baseline quirk (verified against Task 10 legacy src/quote/market.js at
    // commit 51ad137, unchanged by this port): close() uses
    // `delete this.#symbolListeners[key][id]`, which leaves an array hole and
    // never shrinks `.length`. So once 2+ Markets share a key, the refcount
    // check `.length <= 1` is false forever and quote_remove_symbols never
    // fires again for that key. This is pre-existing behavior, not a Task 13
    // regression — migration preserves it byte-for-byte rather than fixing it.
    m1.close();
    const removesAfterFirst = fake.sent.filter((f: string) => f.includes('quote_remove_symbols'));
    expect(removesAfterFirst.length).toBe(0);

    m2.close();
    const removesFinal = fake.sent.filter((f: string) => f.includes('quote_remove_symbols'));
    expect(removesFinal.length).toBe(0);
  });

  it('sends quote_remove_symbols when the single listener on a key closes', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();
    fake.sent.length = 0;

    const qs = new client.Session.Quote();
    const m1 = new qs.Market('ETHUSD', 'regular');
    m1.close();

    const removes = fake.sent.filter((f: string) => f.includes('quote_remove_symbols'));
    expect(removes.length).toBe(1);
  });

  it('uses a distinct symbolKey per symbol/session pair', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();
    fake.sent.length = 0;

    const qs = new client.Session.Quote();
    // eslint-disable-next-line no-new
    new qs.Market('BTCEUR', 'regular');
    // eslint-disable-next-line no-new
    new qs.Market('BTCEUR', 'extended');

    const adds = fake.sent.filter((f: string) => f.includes('quote_add_symbols'));
    expect(adds.length).toBe(2);
  });
});
