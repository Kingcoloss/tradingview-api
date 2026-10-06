import { Client } from '../../dist/node/index.mjs';

const client = new Client();
let quoteSession;
let market;
let timeout;

try {
  quoteSession = new client.Session.Quote({ fields: 'price' });
  market = new quoteSession.Market('BINANCE:BTCUSDT');
  await new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('Timed out waiting for public quote data')), 20_000);
    market.onData((data) => {
      if (typeof data.lp === 'number') resolve();
    });
    market.onError((...messages) => reject(new Error(messages.join(' '))));
    client.onError((...messages) => reject(new Error(messages.join(' '))));
  });
  console.log('Received public BINANCE:BTCUSDT quote data');
} finally {
  clearTimeout(timeout);
  market?.close();
  quoteSession?.delete();
  await client.end();
}
