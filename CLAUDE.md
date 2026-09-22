# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@mathieuc/tradingview` — unofficial **Bun** client for TradingView's internal websocket and HTTP endpoints: realtime prices, quote fields, indicator values, replay mode, drawings. Published on npm (`Mathieu2301/TradingView-API`), so anything merged is consumed by strangers. CommonJS, no build step — `main.js` is the entrypoint and re-exports `miscRequests` plus the four classes.

**Bun-only package.** Runtime, package manager, and test runner are Bun (`engines.bun >= 1.3.0`); there is no Node compatibility contract anymore. `bun.lock` is the lockfile of record — do not run npm/node/yarn.

The websocket transport uses Bun's **native `WebSocket`**, not the `ws` npm package: `ws`'s handshake fails under Bun's HTTP stack (`Expected 101 status code`) while the native client connects. Native client takes a `headers` option (a Bun extension; that is where `Origin` comes from) and wires events with `addEventListener('open' | 'close' | 'error' | 'message')` reading `event.data` — not `ws`'s EventEmitter `.on()` API.

## Commands

```bash
bun install                       # install (CI: bun install --frozen-lockfile)
bun test                          # run all tests
bun test tests/search.test.ts     # one file
bun test tests/search.test.ts -t "gets TA"   # one test by name
npx eslint . --ext .js            # lint (airbnb-base)
bun run example examples/SimpleChart.js        # run an example with .env loaded
bun --watch run examples/SimpleChart.js        # watch variant
```

Env comes from `.env` (see `.env.sample`): `SESSION` = `sessionid` cookie, `SIGNATURE` = `sessionid_sign` cookie. Bun auto-loads `.env`, so every test file sees it. Authenticated suites self-skip with `describe.skipIf(!token || !signature)` — a green run without `.env` does **not** mean the private-indicator paths were exercised.

## Architecture

Two transports live in one library and both need auth cookies for private data:

- **Websocket** — `src/client.js`, `src/protocol.js`, `src/{quote,chart}/*`, `src/classes/*`. Realtime values.
- **HTTP (axios)** — `src/miscRequests.js`. `searchMarket`, `searchMarketV3`, `searchIndicator`, `getTA`, `getIndicator`, `getPrivateIndicators`, `getChartToken`, `getDrawings`, `loginUser`, `getUser`.

### The websocket path, layer by layer

1. **Wire format** — `src/protocol.js`. Frames are `~m~<length>~m~` length-prefixed (heartbeats are `~h~`), payloads may be zlib-compressed and base64-encoded (TradingView sometimes drops padding / uses URL-safe chars — hence `normaliseBase64`). `parseWSPacket` / `formatWSPacket` are the only places that should know this format.
2. **Client** — one `WebSocket` per `Client`, to `wss://{server}.tradingview.com/socket.io/websocket`. Outbound packets go through `#sendQueue`, which drains only when the socket is open **and** `#logged`. Login is a `set_auth_token` packet unshifted to the queue front: a real `authToken` obtained from `misc.getUser(token, signature)` when credentials were passed, otherwise the literal `unauthorized_user_token`.
3. **Packet routing** — `Client#parsePacket` is the single dispatcher. A bare number is a ping (echoed back as `~h~n`); `protocol_error` is fatal (logs and closes); otherwise `packet.p[0]` is a session id and the packet is handed to `#sessions[sessionID].onData`. Packets arriving before login are treated as the logged-in event.
4. **Sessions** — `src/quote/session.js` and `src/chart/session.js` are factories taking a `ClientBridge` (`{ sessions, send }`), each registering itself in `client.sessions` under a locally generated id. `ChartSession` holds three: chart, replay, and a study-scoped id.
5. **Sub-objects** — `quote/market.js` registers into a `SymbolListeners` map keyed by `={JSON.stringify({session, symbol})}`; two `Market` objects with the same key share one `quote_add_symbols` subscription. `chart/study.js` registers into `StudyListeners` keyed by study id.
6. **Indicator model** — `PineIndicator` and `BuiltInIndicator` expose similar `setOption` surfaces but send different payload shapes; `study.getInputs()` branches on `instanceof`. `PinePermManager` manages invite-only indicator access against the pine-facade HTTP API.

### Invariants worth not breaking

- **Session ids are the routing key.** They are generated client-side (`genSessionID('qs' | 'cs' | 'rs')`) and echoed by the server; `p[0]` is always the session id, `p[1]` the study or symbol key. Changing id prefixes or shapes breaks dispatch silently.
- **Study packets are matched by `packet.data[1]`** against the listener map before any type switch — see `ChartSession`'s `onData`.
- **Errors are callback-based** (`onError`), never thrown — except argument validation (`Study#setIndicator` throws when handed a non-indicator), which is deliberate and load-bearing for user feedback.
- **Strategy reports arrive compressed** (`dataCompressed` → `parseCompressed` → `parseTrades`); the same decode path feeds `#graphic` drawing state through `chart/graphicParser.js`.
- **Never use bare `this` for cross-method calls in `src/miscRequests.js`.** Its public methods are consumed as named ESM imports (`import { searchMarketV3 } from '../main'`), which unbinds `this`; the file's own convention is `module.exports.getX(...)`. This bit `searchMarket`/`searchMarketV3` returning `getTA` closures and `getUser`'s redirect recursion.

### Types

The project is fully JSDoc-typed (`src/types.js` plus per-module typedefs) — this is the public API documentation, and tests consume it as namespaces (`TradingView.PineIndicator`). Typedefs are part of the contract: update them in the same change as the behavior.

## Conventions

- ESLint is `airbnb-base` with deliberate local relaxations in `.eslintrc.js`: `no-console` off, and `no-await-in-loop` / `no-restricted-syntax` / `no-continue` / `guard-for-in` off because packet and session loops are intentionally sequential and imperative. Do not re-enable these per-file or refactor the loops to satisfy the base rules.
- `devDependencies` are permitted only in `tests/**` (`import/no-extraneous-dependencies`).
- Packet tracing uses `global.TW_DEBUG` (set via `new Client({ DEBUG: true })`) and the existing `if (global.TW_DEBUG) console.log('§…')` prefix idiom. Follow it when adding tracing.

## Testing

Tests are **live integration against TradingView**, not mocked units. Consequences:

- `tests/utils.ts` applies the 10s per-attempt timeout (third argument to `bun:test`'s `it`) and wraps `it`/`it.skip`/`it.skipIf` with 3 attempts, because Bun has no native test retry and the network is the system under test. Do not treat red-then-green as a pass; do not widen retries. There is no `bunfig.toml`: Bun's `[test]` section only reads `root`/`preload`/`smol`/`coverage` — the timeout lives in `tests/utils.ts`.
- CI has one Bun job with workflow/ref concurrency because authenticated runs share one account/session (`TW_SESSION` / `TW_SIGNATURE` secrets) and concurrent websocket tests are flaky.
- `tests/utils.ts` exports the test facade plus shared helpers (`wait`, `calculateTimeGap`). Import `describe`, `it`, and `expect` from it — not directly from `bun:test` — so retries and the timeout apply consistently.
- `authenticated.test.ts`'s "creates a chart with all user indicators" can fail with TradingView's server-side `study_limit_exceeded` ("maximum number of studies per chart"). That is an account-quota condition, not a code defect or a Bun regression — repeated local runs exhaust it while `main`'s scheduled CI stays green.
- Replay is covered twice — real replay (`replayMode.test.ts`) and the free-plan workaround (`FakeReplayMode.js`). Both paths matter.

`examples/` is the usage-pattern catalog and mirrors the test suite one-to-one (`search.test.ts` ↔ `Search.js`, `replayMode.test.ts` ↔ `ReplayMode.js`, …). A new feature normally earns both a test and an example.

## Source discovery

A `graphify` knowledge graph of this repo is generated locally into `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`). Query it (`/graphify query "…"`) before grepping across `src/` when tracing callers, packet flows, or the session/study listener wiring. It is generated output, not a source of truth — verify against the files before acting on it.
