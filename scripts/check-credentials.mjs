#!/usr/bin/env bun
// Diagnose TradingView credentials without ever printing their values.
//
// Usage:
//   bun scripts/check-credentials.mjs       # Bun auto-loads .env
//
// Exit codes:
//   0 credentials verified against getUser
//   2 SESSION or SIGNATURE missing / empty
//   3 TradingView rejected the credentials (`Wrong or expired sessionid/signature`)
//   4 unexpected failure (network, parse, etc.)

import { getUser } from '../src/index.ts';

function mask(value) {
  if (!value) return '<unset>';
  const len = value.length;
  return `len=${len} value=<redacted>`;
}

const session = process.env.SESSION ?? '';
const signature = process.env.SIGNATURE ?? '';

console.log('Credential diagnostic');
console.log(`  SESSION   ${mask(session)}`);
console.log(`  SIGNATURE ${mask(signature)}`);

if (!session || !signature) {
  console.log('\nStatus: MISSING');
  console.log('Set SESSION and SIGNATURE in .env (sessionid / sessionid_sign cookies).');
  process.exit(2);
}

try {
  const user = await getUser(session, signature);
  console.log('\nStatus: OK');
  console.log(`  id        ${user.id}`);
  console.log(`  username  ${user.username}`);
  console.log(`  joinDate  ${user.joinDate}`);
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`\nStatus: FAILED (${message})`);
  if (/Wrong or expired sessionid\/signature/i.test(message)) {
    console.log('TradingView rejected the cookies. Refresh them from a logged-in browser session.');
    process.exit(3);
  }
  console.log('Unexpected failure; inspect the message above.');
  process.exit(4);
}
