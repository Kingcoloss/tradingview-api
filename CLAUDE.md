# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@mathieuc/tradingview` — unofficial Bun ≥1.3.0 and Node.js ≥20 client for TradingView's internal websocket and HTTP endpoints: realtime prices, quote fields, indicator values, replay mode, drawings. Published on npm (`Mathieu2301/TradingView-API`), so anything merged is consumed by strangers. TypeScript source enters through `src/index.ts`; `bun run build:all` emits Bun and Node ESM/CJS artifacts plus shared TypeScript declarations. The package `exports` map selects the runtime artifact and exposes the same ten HTTP functions and four classes.

Use Bun for package management, builds, and tests; `bun.lock` is the lockfile of record. Use Node for the Node consumer routes and anonymous websocket smoke. Bun consumers use the native `WebSocket` (including Bun's `headers` option and `addEventListener` events); Node consumers use the `ws` peer via `src/transport/node.ts` (EventEmitter events). Adapter selection happens at build time, not by runtime probing. Consumers install `axios` and `jszip` peers, plus `ws` on Node.

## Commands

```bash
bun install --frozen-lockfile     # install; bun.lock is authoritative
bun run build:all                 # Bun ESM/CJS, Node ESM/CJS, shared .d.ts
bun run typecheck                 # source typecheck
bun run typecheck:consumer        # shipped declaration fixtures
bun test                          # full Bun suite (authenticated when .env is set)
bun test tests/pack/pack.test.ts  # package-root route and artifact checks
bun test tests/fake-socket tests/unit  # deterministic transport/unit suites
bun run lint                      # lint .js and .ts (airbnb-base)
node tests/live-smoke/anonymous.mjs  # Node artifact public-quote smoke after build
bun run example examples/SimpleChart.js        # run an example with .env loaded
bun --watch run examples/SimpleChart.js        # watch variant
```

Env comes from `.env` (see `.env.sample`): `SESSION` = `sessionid` cookie, `SIGNATURE` = `sessionid_sign` cookie. Bun auto-loads `.env`, so every test file sees it. Authenticated suites self-skip with `describe.skipIf(!token || !signature)` — a green run without `.env` does **not** mean the private-indicator paths were exercised.

## Architecture

Two transports live in one library and both need auth cookies for private data:

- **Websocket** — TypeScript modules in `src/client.ts`, `src/protocol.ts`, `src/transport/`, `src/{quote,chart}/*`, and `src/classes/*`. Realtime values. Bun uses native `WebSocket`; Node uses the `ws` adapter.
- **HTTP (axios)** — `src/http/miscRequests.ts`. `searchMarket`, `searchMarketV3`, `searchIndicator`, `getTA`, `getIndicator`, `getPrivateIndicators`, `getChartToken`, `getDrawings`, `loginUser`, `getUser`.
- **Artifacts** — `src/index.ts` is bundled to `dist/bun/index.{mjs,cjs}`, `dist/node/index.{mjs,cjs}`, and shared `dist/types/index.d.ts`. Conditional exports route Bun and Node separately.

### The websocket path, layer by layer

1. **Wire format** — `src/protocol.ts`. Frames are `~m~<length>~m~` length-prefixed (heartbeats are `~h~`), payloads may be zlib-compressed and base64-encoded (TradingView sometimes drops padding / uses URL-safe chars — hence `normaliseBase64`). `parseWSPacket` / `formatWSPacket` are the only places that should know this format.
2. **Client** — one `WebSocket` per `Client`, to `wss://{server}.tradingview.com/socket.io/websocket`. Outbound packets go through `#sendQueue`, which drains only when the socket is open **and** `#logged`. Login is a `set_auth_token` packet unshifted to the queue front: a real `authToken` obtained from `misc.getUser(token, signature)` when credentials were passed, otherwise the literal `unauthorized_user_token`.
3. **Packet routing** — `Client#parsePacket` is the single dispatcher. A bare number is a ping (echoed back as `~h~n`); `protocol_error` is fatal (logs and closes); otherwise `packet.p[0]` is a session id and the packet is handed to `#sessions[sessionID].onData`. Packets arriving before login are treated as the logged-in event.
4. **Sessions** — `src/quote/session.ts` and `src/chart/session.ts` are factories taking a `ClientBridge` (`{ sessions, send }`), each registering itself in `client.sessions` under a locally generated id. `ChartSession` holds three: chart, replay, and a study-scoped id.
5. **Sub-objects** — `quote/market.ts` registers into a `SymbolListeners` map keyed by `={JSON.stringify({session, symbol})}`; two `Market` objects with the same key share one `quote_add_symbols` subscription. `chart/study.ts` registers into `StudyListeners` keyed by study id.
6. **Indicator model** — `PineIndicator` and `BuiltInIndicator` expose similar `setOption` surfaces but send different payload shapes; `study.getInputs()` branches on `instanceof`. `PinePermManager` manages invite-only indicator access against the pine-facade HTTP API.

### Invariants worth not breaking

- **Session ids are the routing key.** They are generated client-side (`genSessionID('qs' | 'cs' | 'rs')`) and echoed by the server; `p[0]` is always the session id, `p[1]` the study or symbol key. Changing id prefixes or shapes breaks dispatch silently.
- **Study packets are matched by `packet.data[1]`** against the listener map before any type switch — see `ChartSession`'s `onData`.
- **Errors are callback-based** (`onError`), never thrown — except argument validation (`Study#setIndicator` throws when handed a non-indicator), which is deliberate and load-bearing for user feedback.
- **Strategy reports arrive compressed** (`dataCompressed` → `parseCompressed` → `parseTrades`); the same decode path feeds `#graphic` drawing state through `chart/graphicParser.ts`.
- **Never use bare `this` for cross-method calls in `src/http/miscRequests.ts`.** Public methods are consumed as named ESM imports, which unbind `this`; use module-local calls. This protects `searchMarket`/`searchMarketV3` `getTA` closures and `getUser` redirect recursion.

### Types

The project is TypeScript-typed (`src/types.ts` plus per-module types) and ships `dist/types/index.d.ts`. Types are public documentation; tests and consumers use namespaces such as `TradingView.PineIndicator`. Update types with behavior changes.

## Conventions

- ESLint is `airbnb-base` with deliberate local relaxations in `.eslintrc.js`: `no-console` off, and `no-await-in-loop` / `no-restricted-syntax` / `no-continue` / `guard-for-in` off because packet and session loops are intentionally sequential and imperative. Do not re-enable these per-file or refactor the loops to satisfy the base rules.
- `devDependencies` are permitted only in `tests/**` (`import/no-extraneous-dependencies`).
- Packet tracing uses `global.TW_DEBUG` (set via `new Client({ DEBUG: true })`) and the existing `if (global.TW_DEBUG) console.log('§…')` prefix idiom. Follow it when adding tracing.

## Testing

The project has deterministic fake-socket/unit checks and **live integration** checks against TradingView.

- `tests/utils.ts` applies the 10s per-attempt timeout (third argument to `bun:test`'s `it`) and wraps live `it`/`it.skip`/`it.skipIf` with 3 attempts. Do not widen retries or treat red-then-green as a pass. There is no `bunfig.toml`: the timeout lives in `tests/utils.ts`.
- The Bun CI job is the only job with `TW_SESSION` / `TW_SIGNATURE`; it runs the authenticated full suite under workflow/ref concurrency. A green run without `.env` does **not** exercise private-indicator paths.
- The Node 20/22 CI matrix runs typecheck, lint, build-backed pack, fake-socket, and unit suites without account secrets. Node 20 also runs `tests/live-smoke/anonymous.mjs` directly with `node` against the Node artifact and waits for public quote data.
- `tests/utils.ts` exports the live-test facade plus shared helpers (`wait`, `calculateTimeGap`). Import `describe`, `it`, and `expect` from it when the retry/timeout facade is required.
- `authenticated.test.ts`'s "creates a chart with all user indicators" can fail with TradingView's server-side `study_limit_exceeded` ("maximum number of studies per chart"). That is an account-quota condition, not a code defect or a Bun regression — repeated local runs exhaust it while scheduled CI stays green.
- Replay is covered twice — real replay (`replayMode.test.ts`) and the free-plan workaround (`FakeReplayMode.js`). Both paths matter.

`examples/` is the usage-pattern catalog and mirrors the test suite one-to-one (`search.test.ts` ↔ `Search.js`, `replayMode.test.ts` ↔ `ReplayMode.js`, …). A new feature normally earns both a test and an example.

## Subagent worktrees

`Agent` may use `isolation: "worktree"` for work that needs a separate checkout. Verify the worktree before editing: confirm its path, HEAD commit, branch, and `git status --short`; an isolated checkout may start from an older HEAD and does not inherit uncommitted files. If HEAD differs from the task base, stop and reconcile it before implementation. Before bringing changes back, review the commit range and diff, check for untracked files, and run the relevant gates in the destination checkout. Do not assume isolation is safe merely because the parameter was supplied.

## Source discovery

A `graphify` knowledge graph of this repo is generated locally into `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`). Query it (`/graphify query "…"`) before grepping across `src/` when tracing callers, packet flows, or the session/study listener wiring. It is generated output, not a source of truth — verify against the files before acting on it.
