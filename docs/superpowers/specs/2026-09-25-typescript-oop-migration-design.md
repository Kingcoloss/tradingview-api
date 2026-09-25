# TypeScript multi-runtime migration — design

- Date: 2026-09-25
- Status: approved design, no implementation yet
- Baseline commit: `d0415b51a5a02e5b5911005c10aba40a07c7da73`
- Package: `@mathieuc/tradingview` (currently `3.5.2`, CommonJS, Bun-only)

## 1. Intent, scope, non-goals, success criteria

### Intent

Move the library from JavaScript/CommonJS + JSDoc to TypeScript sources, and from
Bun-only to Bun **and** Node.js >= 20, without changing a single byte of the public
API or of the TradingView wire protocol. Types stop being comments and become the
compiled contract; runtime support stops being implicit and becomes two declared
build targets.

### Scope

- All of `src/**` and `main.js` converted to TypeScript.
- Stateful components become TypeScript classes (OOP); function modules stay pure
  function modules.
- A transport seam so the websocket layer can be Bun-native or `ws`-backed.
- Build outputs: per-target ESM + CJS, one shared `.d.ts` set.
- `package.json` `exports` map, `peerDependencies`, `engines`, major version bump.
- Test/CI changes needed to prove both runtimes and all four load combinations.
- `README.md` prerequisites, `examples/**` updated to the supported import forms.

### Non-goals

- No browser/bundler-for-web support. `node:zlib`, `node:os`, `Buffer` stay in use.
- No new features, endpoints, packets, or options.
- No renames, no deprecations, no signature changes, no error-message changes.
- No swap of `axios`, `jszip`, or the live-suite test runner (`bun test` stays the runner). The Node pack/fake-socket checks run under Node.
- No runtime transport auto-detection beyond what section 3.5 allows.
- No rewrite of the intentionally imperative packet/session loops.
- No detailed task breakdown — that is the implementation plan, written separately.

### Success criteria

1. Every symbol in section 2.1 is reachable, with identical shape, from all four
   load combinations in section 7.2.
2. `bun test` is green with `.env` present, and green-with-skips without it, at the
   same pass rate as the baseline.
3. `tsc --noEmit` clean; `npx eslint . --ext .js,.ts` clean.
4. Bun artifact contains no reference to `ws` (grep assertion, section 7.4).
5. Node >= 20 artifact runs the same fake-socket cases plus one anonymous live
   websocket smoke on Node 20; the full authenticated live suite remains Bun-run.
6. Wire bytes for a given call sequence are byte-identical to baseline (section 6.4).

## 2. Current contracts (verified against baseline)

### 2.1 Public API surface

`main.js` spreads `src/miscRequests.js` and attaches four classes. Consumers use all
three import forms today (`require`, default import, named import), so all three stay.

HTTP functions (from `src/miscRequests.js`, all `async`):

| Function | Signature |
|---|---|
| `getTA` | `(id)` |
| `searchMarket` | `(search, filter = '')` — deprecated, kept |
| `searchMarketV3` | `(search, filter = '', offset = 0)` |
| `searchIndicator` | `(search = '')` |
| `getIndicator` | `(id, version = 'last', session = '', signature = '')` |
| `loginUser` | `(username, password, remember = true, UA = 'TWAPI/3.0')` |
| `getUser` | `(session, signature = '', location = 'https://www.tradingview.com/', redirectCount = 0)` |
| `getPrivateIndicators` | `(session, signature = '')` |
| `getChartToken` | `(layout, credentials = {})` |
| `getDrawings` | `(layout, symbol = '', credentials = {}, chartID = '_shared')` |

Classes: `Client`, `PineIndicator`, `BuiltInIndicator`, `PinePermManager`.

Nested constructors (instance properties, not static):

- `client.Session.Quote` → `QuoteSession`
- `client.Session.Chart` → `ChartSession`
- `quoteSession.Market` → `QuoteMarket`
- `chartSession.Study` → `ChartStudy`

Members that must survive unchanged:

- `Client`: getters `isLogged`, `isOpen`; `send(t, p = [])`, `sendQueue()`, `end()`;
  callbacks `onConnected`, `onDisconnected`, `onLogged`, `onPing`, `onData`, `onError`,
  `onEvent`; options `{ token, signature, DEBUG, server, location, headers }`.
- `QuoteSession`: `constructor(options = {})` with `{ fields, customFields }`,
  `Market`, `delete()`.
- `QuoteMarket`: `constructor(symbol, session = 'regular')`, `onLoaded`, `onData`,
  `onEvent`, `onError`, `close()`.
- `ChartSession`: getters `periods`, `infos`; `setSeries(timeframe = '240', range = 100,
  reference = null)`, `setMarket(symbol, options = {})`, `setTimezone(timezone)`,
  `fetchMore(number = 1)`, `replayStep(number = 1)`, `replayStart(interval = 1000)`,
  `replayStop()`; `onSymbolLoaded`, `onUpdate`, `onReplayLoaded`, `onReplayResolution`,
  `onReplayEnd`, `onReplayPoint`, `onError`; `Study`, `delete()`.
- `ChartStudy`: public field `instance`; getters `periods`, `graphic`, `strategyReport`;
  `setIndicator(indicator)`, `onReady`, `onUpdate`, `onError`, `remove()`.
- `PineIndicator`: getters `pineId`, `pineVersion`, `description`, `shortDescription`,
  `inputs`, `plots`, `type`, `script`; `setType(type = 'Script@tv-scripting-101!')`,
  `setOption(key, value)`.
- `BuiltInIndicator`: getters `type`, `options`; `setOption(key, value, FORCE = false)`.
- `PinePermManager`: public fields `sessionId`, `signature`, `pineId`;
  `constructor(sessionId, signature, pineId)`; `getUsers(limit = 10,
  order = '-created')`, `addUser(username, expiration = null)`,
  `modifyExpiration(username, expiration = null)`, `removeUser(username)`.

Two baseline quirks are contract, not bugs, and are preserved verbatim:

- `ChartSession` registers a `seriesLoaded` callback slot but exposes no
  `onSeriesLoaded` method. The slot stays; no method is added.
- `searchMarket`/`searchMarketV3` results carry a `getTA()` closure, and
  `searchIndicator`/`getPrivateIndicators` results carry a `get()` closure. Both close
  over module-level functions, never over `this`.

### 2.2 Type contracts

The JSDoc typedefs are the published documentation and tests consume them as
namespaces — `tests/builtInIndicator.test.ts` writes `let client: TradingView.Client`
and `InstanceType<typeof client.Session.Chart>`, `tests/indicators.test.ts` writes
`{ [name: string]: TradingView.PineIndicator }`. So shared declarations must keep
**namespace-style access on the default/`require` export**: `TradingView.Client` usable
as both value and type. Use one shared `dist/types/index.d.ts` as an ESM declaration:
named value/type exports plus `declare const TradingView` for the object-shaped default
export, with a merged `namespace TradingView` that aliases the public class types.
`export default TradingView` supplies the default import. `export =` is deliberately
not used: it forbids the coexisting named exports that `tests/search.test.ts` relies on
(`import { searchMarket, searchIndicator, searchMarketV3 } from '../main'`).

The requirement is behavioural, so type fixtures must compile for (a) a TS ESM
consumer with `moduleResolution: bundler` using the default import, named imports,
and `TradingView.Client` / `TradingView.PineIndicator` as types, and (b) a CJS
JavaScript consumer using `require('@mathieuc/tradingview')` with `// @ts-check`,
accessing the same symbols through their JSDoc types. One shared `.d.ts` is a release
gate, not a preference; there is no alternative per-format declaration file in this
design. The declarations are a contract even when the generator needs a hand-authored
entry file to express namespace merging.

Typedefs that become exported TypeScript types, keeping their names:
`MarketSymbol`, `Timezone`, `TimeFrame` (`src/types.js`); `TWPacket` (`protocol`);
`Session`, `SessionList`, `SendPacket`, `ClientBridge`, `ClientEvent`, `ClientOptions`,
`SocketSession` (`client`); `SymbolListeners`, `QuoteSessionBridge`, `quoteField`,
`quoteSessionOptions` (`quote/session`); `MarketEvent` (`quote/market`); `ChartType`,
`ChartInputs`, `StudyListeners`, `ChartSessionBridge`, `ChartEvent`, `PricePeriod`,
`Subsession`, `MarketInfos` (`chart/session`); `TradeReport`, `PerfReport`, `FromTo`,
`StrategyReport`, `UpdateChangeType` (`chart/study`); `Indicator`, `IndicatorInput`,
`IndicatorType` (`PineIndicator`); `BuiltInIndicatorType`, `BuiltInIndicatorOption`
(`BuiltInIndicator`); `Periods`, `SearchMarketResult`, `SearchIndicatorResult`, `User`,
`UserCredentials`, `Drawing`, `DrawingPoint` (`miscRequests`); plus the
`graphicParser` output types.

### 2.3 Runtime contracts

- Bun: native global `WebSocket`, constructed with a **second argument**
  `{ headers }` — a Bun extension. Events wired with
  `addEventListener('open' | 'close' | 'error' | 'message')`, payload read from
  `event.data`. The `ws` npm package fails Bun's handshake with
  `Expected 101 status code`; that is why the native client is used.
- Node >= 20: no global `WebSocket` with header support (the undici global ignores
  custom headers), so `ws ^8` is required. `ws` uses EventEmitter `.on()` and hands
  the payload as the callback argument, not `event.data`.
- Node built-ins already required by the library: `node:zlib` (`inflateSync`,
  `inflateRawSync`, `gunzipSync`), `node:os` (`version`, `platform`, `arch`), `Buffer`.
  These work unchanged on both runtimes and are the reason browsers are out of scope.
- `global.TW_DEBUG` is the debug flag, set from `new Client({ DEBUG: true })`, and
  traced with the `'§…'` prefix idiom.

### 2.4 Wire contracts (invariants)

1. Frames are `~m~<length>~m~<payload>`; heartbeats are `~h~`. `parseWSPacket` /
   `formatWSPacket` are the only code allowed to know this.
2. Compressed payloads: base64 (possibly unpadded / URL-safe → `normaliseBase64`),
   then JSZip, falling back to raw / inflate / inflateRaw / gunzip.
3. Socket URL: `wss://{server}.tradingview.com/socket.io/websocket?from=chart&type=chart`,
   `server` defaulting to `data`. `Origin: https://www.tradingview.com` plus the
   default UA/`Accept-Language`/`Cache-Control`/`Pragma` headers, user `headers` last.
4. Login is a `set_auth_token` packet **unshifted to the front** of `#sendQueue`:
   the real `authToken` from `misc.getUser(...)`, else the literal
   `unauthorized_user_token`. `#sendQueue` drains only when the socket is open **and**
   `#logged`.
5. A bare-number packet is a ping, echoed as `~h~<n>`. `protocol_error` is fatal:
   report, then close. Otherwise `packet.p[0]` is a session id routed through
   `#sessions[id].onData`. A packet arriving before login is emitted as `logged`.
6. Session ids are generated client-side by `genSessionID(prefix)` with prefixes
   `qs`, `cs`, `rs`, `st`, `rsq_step`, `rsq_start`, `rsq_stop`. `p[0]` is the session
   id, `p[1]` the study or symbol key.
7. Study packets are matched on `packet.data[1]` against `studyListeners` **before**
   any type switch.
8. Quote symbol key is exactly `` `=${JSON.stringify({ session, symbol })}` ``; two
   `QuoteMarket` objects with the same key share one `quote_add_symbols` subscription,
   and `quote_remove_symbols` is only sent when the last listener closes.
9. Websocket-path errors are delivered through `onError` callbacks, never thrown —
   except argument validation, which throws deliberately: `ChartStudy`'s constructor and
   `setIndicator` on a non-indicator; `BuiltInIndicator`'s constructor on an empty type
   and `setOption` on an unknown option or wrong option type; `PineIndicator.setOption`
   on an unknown input, wrong type, or a value outside `input.options`;
   `PinePermManager`'s constructor on a missing `sessionId`, `signature`, or `pineId`.
   When no `error` callback is registered, the message goes to `console.error`.
   The HTTP functions are promise-based and reject (`Inexistent or unsupported
   indicator: "${data.reason}"`, `Wrong or expired sessionid/signature`, `Too many
   redirects - possible WAF or geo-restriction`, `Wrong layout or credentials`,
   `Wrong layout, user credentials, or chart id.`, and `loginUser`'s pass-through of
   `data.error`); `PinePermManager`'s methods rethrow `e.response.data.detail` on
   an axios failure.
10. Strategy reports arrive compressed (`dataCompressed` → `parseCompressed` →
    `parseTrades`); the same decode path feeds `#graphic` through `graphicParser`.
11. `getUser` follows redirects by recursion, capped at 5
    (`Too many redirects - possible WAF or geo-restriction`).

## 3. Module architecture

### 3.1 Layout

```
src/
  index.ts                 # public surface (replaces main.js)
  types.ts                 # shared type-only module
  utils.ts                 # pure: genSessionID, genAuthCookies
  protocol.ts              # pure: parseWSPacket, formatWSPacket, parseCompressed
  http/
    miscRequests.ts        # the 10 HTTP functions and private helpers
  transport/
    types.ts               # Transport, TransportEvents, TransportFactory
    bun.ts                 # native WebSocket adapter
    node.ts                # ws ^8 adapter
    default.ts             # Bun re-export for source tests / pack:bun; Node build aliases this to node.ts
  client.ts                # class Client
  quote/session.ts         # QuoteSession factory
  quote/market.ts          # QuoteMarket factory
  chart/session.ts         # ChartSession factory
  chart/study.ts           # ChartStudy factory
  chart/graphicParser.ts   # pure
  classes/{PineIndicator,BuiltInIndicator,PinePermManager}.ts
```

Existing file boundaries are kept 1:1 so review stays diffable; only `main.js` →
`src/index.ts`, `miscRequests.js` → `http/miscRequests.ts`, and the new `transport/`
are structural changes. `chart/session.ts` (553 lines today) and
`http/miscRequests.ts` (613) stay single files;
splitting them would churn the diff without serving the migration.

### 3.2 Transport interface

The seam is deliberately the smallest thing that covers both clients: a factory that
takes connection parameters plus four handlers and returns an object with `send`,
`close`, and a four-state `state` value.

```ts
export interface TransportEvents {
  onOpen(): void;
  onClose(): void;
  onError(message: string): void;
  onMessage(data: string): void;
}

export type TransportState = 'connecting' | 'open' | 'closing' | 'closed';

export interface Transport {
  send(data: string): void;
  close(): void;
  readonly state: TransportState;
}

export interface TransportOptions {
  url: string;
  headers: Record<string, string>;
}

export type TransportFactory = (
  options: TransportOptions,
  events: TransportEvents,
) => Transport;
```

Rationale: `Client` currently reads `this.#ws.readyState === WebSocket.OPEN` for
`Client.isOpen`, but `end()` closes for any truthy ready state — CONNECTING, OPEN, or
CLOSING — and skips only CLOSED. `state` preserves both behaviours without leaking
`ws` numeric constants or the DOM `WebSocket` constant into the core:
`Client.isOpen` is `state === 'open'`; `end()` calls `close()` when
`state !== 'closed'`. No `onPing`/`onPong`, no reconnect, no backpressure in the
interface — the protocol handles heartbeats inside `onMessage` and the library has
never reconnected.

### 3.3 Adapters

`transport/bun.ts` constructs native `new WebSocket(url, { headers })` (the Bun
header extension). It wires `open`, `close`, `error`, and `message` through
`addEventListener`; `message` forwards the string `event.data`. `transport/node.ts`
statically imports `WebSocket` from `ws`, constructs `new WebSocket(url, { headers })`,
and wires the corresponding `.on('open' | 'close' | 'error' | 'message')` events; the
Node `message` callback receives raw data, not an `event` object. Both adapters expose
`state` mapped from their socket's `readyState` constants; `Client` never sees those
constants. Both pass `error.message` as a string, matching the existing
`this.#handleError('WebSocket', err.message)` output.

Both normalise message payload to `string` before `parseWSPacket` sees it, so the
protocol layer keeps one input type. Node `ws` can deliver `Buffer`, `Buffer[]`, or
`ArrayBuffer`: decode each as UTF-8 (join chunks for `Buffer[]`). Bun's native socket
delivers `event.data`. No parse/decode logic is duplicated in `Client`.

### 3.4 Build-time entry selection

`src/client.ts` imports `{ defaultTransport } from './transport/default'`. There is no
runtime branch: the build picks which file that specifier resolves to.

- Bun build (`pack:bun`, `--target=bun`) takes `default.ts` as written → Bun adapter.
- Node build aliases `./transport/default` → `./transport/node` at build time.

Running the TypeScript sources directly (tests, examples) therefore gets the Bun
adapter with no build step, which matches the current developer experience. The
published `exports` map routes consumers to the matching artifact. `ws` is imported
only from `transport/node.ts`, which is what makes the section 7.4 grep assertion
meaningful in both directions.

### 3.5 Optional transport injection

`ClientOptions` gains one optional property:

```ts
transport?: TransportFactory;
```

`Client` uses `clientOptions.transport ?? defaultTransport`. This is additive — every
existing option keeps its meaning — and it is what makes fake-socket tests possible
without a network. It is also the single supported escape hatch for an unusual
runtime: supply a factory.

**YAGNI on runtime fallback.** There is deliberately no `try { require('ws') } catch`,
no `typeof WebSocket !== 'undefined'` probe, no adapter registry, and no per-runtime
capability detection. Build-time selection plus the `exports` map already answers
"which socket", and a runtime probe would make the Bun artifact reference `ws`,
breaking criterion 4. If some future runtime needs a third adapter, it passes
`transport` until it earns a build target.

## 4. Class / function boundaries

Stateful → class. Stateless → module-level function.

| Unit | Kind | State it owns |
|---|---|---|
| `Client` | class | socket, `#logged`, `#sessions`, `#sendQueue`, `#callbacks`, `Session` |
| `QuoteSession` | class from factory `(client) => class` | session id, `#symbolListeners`, `Market` |
| `QuoteMarket` | class from factory `(quoteSession) => class` | symbol, session, symbol key, listener id, `#lastData`, `#callbacks` |
| `ChartSession` | class from factory `(client) => class` | chart/replay ids, `#replayMode`, `#replayOKCB`, `#studyListeners`, `#periods`, `#infos`, `#callbacks`, `Study` |
| `ChartStudy` | class from factory `(chartSession) => class` | study id, `#periods`, `#indexes`, `#graphic`, `#strategyReport`, `#callbacks`, `instance` |
| `PineIndicator` | class | `#options`, `#type` |
| `BuiltInIndicator` | class | `#type`, `#options` |
| `PinePermManager` | class | `sessionId`, `signature`, `pineId` |

The factory-returning-class shape is kept for the four session/sub-object types. It is
what makes `new client.Session.Chart()` and `new chart.Study(indic)` work with no
arguments threaded through by the consumer, and the closed-over bridge
(`ClientBridge`, `QuoteSessionBridge`, `ChartSessionBridge`) is the documented
dependency. In TypeScript the factory's return type is named and exported so
declarations can refer to it, and `InstanceType<typeof client.Session.Chart>` keeps
working.

Pure function modules (no class, no instance state):

- `utils.ts` — `genSessionID`, `genAuthCookies` (both already module-level functions;
  `genAuthCookies` is internal, consumed by `http/*` and `PinePermManager`, and is not
  re-exported from `index.ts` because it is not in today's public surface).
- `protocol.ts` — `parseWSPacket`, `formatWSPacket`, `parseCompressed`, with
  `normaliseBase64` and `parseDecodedCompressed` private.
- `chart/graphicParser.ts` — packet-state → `GraphicData`.
- `http/miscRequests.ts` — the 10 functions plus private `fetchScanData`,
  `genAuthCookies`, `validateStatus`, `indicators`, `builtInIndicList`.
- `chart/study.ts` helpers `getInputs`, `parseTrades` stay module-private functions.

**The `module.exports.getX(...)` convention becomes ES module-local calls.** Baseline
must not use bare `this` in `miscRequests` because named ESM imports unbind it;
`searchMarket`/`searchMarketV3` closures and `getUser`'s redirect recursion depend on
that. In TypeScript these become plain module-scope function declarations called by
name (`getTA(id)`, `getIndicator(...)`, `getUser(...)`), which is strictly safer: there
is no receiver at all. The exported object is assembled once at the bottom of
`index.ts`. Any use of `this` in that file is a review-blocking defect.

`getInputs` branches on `instanceof PineIndicator`, and `ChartStudy` validation throws
on `!(x instanceof PineIndicator) && !(x instanceof BuiltInIndicator)`. With two
published formats, a consumer could hold a `PineIndicator` from one artifact and a
`ChartStudy` from another: `instanceof` fails. Preserve the existing validation shape
without a runtime brand: the pack tests guarantee that the constructor and indicator
from one import route work together. Mixing constructors across import/require routes
is not a current supported contract and is not added by this migration. `getIndicator`
returns the same constructor as the `ChartStudy` reached from that route.

## 5. Package outputs and manifest

### 5.1 Artifacts

| Path | Target | Format |
|---|---|---|
| `dist/bun/index.mjs` | Bun | ESM |
| `dist/bun/index.cjs` | Bun | CJS |
| `dist/node/index.mjs` | Node >= 20 | ESM |
| `dist/node/index.cjs` | Node >= 20 | CJS |
| `dist/types/index.d.ts` | both | shared declarations |

Both existing scripts are kept and extended; `pack:bun` produces the Bun pair,
`pack:bundle` the Node pair, and a `pack:types` step emits declarations once.
`bun build --target=bun` keeps its role for the Bun artifact. Minification stays.
Neither target bundles `axios`, `jszip`, or `ws` — they are peers (section 5.3).

### 5.2 Exports map

The `bun` condition must come **before** `node` and `default`, because Bun matches
both `bun` and `node`; first match wins.

```json
{
  "main": "./dist/node/index.cjs",
  "module": "./dist/node/index.mjs",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "bun": {
        "import": "./dist/bun/index.mjs",
        "require": "./dist/bun/index.cjs"
      },
      "node": {
        "import": "./dist/node/index.mjs",
        "require": "./dist/node/index.cjs"
      },
      "default": "./dist/node/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"]
}
```

Explicit `.mjs` / `.cjs` extensions instead of a `"type": "module"` field: the field
would reinterpret every bare `.js` in the repo, and `examples/**` is CommonJS
(`require('../main')`). Extensions make each artifact's format unambiguous regardless
of the package type, and leave the examples working as they do today.

`src/` is **not** exported. It is not a public contract: no subpath exports, no deep
imports. `main`/`module`/`types` remain for tooling that ignores `exports`, and point
at the Node build as the conservative default.

### 5.3 Dependencies and engines

```json
{
  "peerDependencies": {
    "axios": "^1.5.0",
    "jszip": "^3.7.1",
    "ws": "^8"
  },
  "peerDependenciesMeta": {
    "ws": { "optional": true }
  },
  "engines": {
    "bun": ">=1.3.0",
    "node": ">=20"
  }
}
```

`axios` and `jszip` move from `dependencies` to `peerDependencies` so consumers own
the versions of the two libraries whose objects cross the API boundary. `ws` is
optional because the Bun artifact never imports it. Node consumers who omit `ws` get a
module-resolution error at import of the Node artifact — acceptable and documented,
because the alternative (a lazy require with a friendly message) is exactly the runtime
fallback rejected in section 3.5.

`README.md` states prerequisites explicitly:

- Bun: `bun add @mathieuc/tradingview axios jszip`
- Node >= 20: `npm i @mathieuc/tradingview axios jszip ws`

### 5.4 Major version / migration note

This is a **breaking major release (4.0.0)** even though no API member changes, because
`dependencies` become `peerDependencies` and `engines` gains a Node floor. The
`CHANGELOG`/release note says, in these terms:

- Existing documented import/`require` forms need no source changes. Same names, same
  signatures, same callbacks, same errors.
- You must now install `axios` and `jszip` yourself, and `ws` on Node.
- Node >= 20 is supported; Bun >= 1.3.0 still is.
- Deep imports into `src/` (never supported) no longer resolve.
- TypeScript consumers get shipped declarations; `@ts-ignore` workarounds around this
  package can go.

## 6. Data, event, and error flow

### 6.1 Inbound

```
socket message (string)
  → Client via TransportEvents.onMessage
  → protocol.parseWSPacket
  → Client.#parsePacket, per packet:
      number            → echo `~h~n`, emit 'ping'
      protocol_error    → handleError, transport.close()
      p[0] in #sessions → session.onData({ type: packet.m, data: packet.p })
      !#logged          → emit 'logged'
      otherwise         → emit 'data'
```

Session-level: `QuoteSession.onData` routes `quote_completed` / `qsd` by symbol key to
every `QuoteMarket` listener (and sends `quote_remove_symbols` for an unknown key).
`ChartSession.onData` checks `studyListeners[packet.data[1]]` **first**, then handles
`symbol_resolved`, `timescale_update` / `du` (including the `$prices` series and
per-key study fan-out), `symbol_error`, `series_error`, `critical_error`. The replay
session id handles `replay_ok` (resolving the pending `#replayOKCB`),
`replay_instance_id`, `replay_point`, `replay_resolutions`, `replay_data_end`,
`critical_error`.

### 6.2 Outbound

```
caller → session/study method
  → bridge.send(type, params)
  → Client.send → protocol.formatWSPacket → #sendQueue.push → sendQueue()
  → drains only while (isOpen && #logged)
  → transport.send(frame)
```

Login jumps the queue: the `set_auth_token` frame is `unshift`ed, `#logged = true` is
set, and `sendQueue()` is called — for the authenticated path inside the
`misc.getUser(...)` promise, for the anonymous path synchronously in the constructor.

### 6.3 Events and errors

Every emitter keeps the same two-step shape: `#handleEvent(ev, ...data)` calls the
per-event callbacks then the `event` callbacks; `#handleError(...msgs)` falls back to
`console.error` when no `error` callback is registered. Callback arrays keep their
current names on `Client` (`connected`, `disconnected`, `logged`, `ping`, `data`,
`error`, `event`), `ChartSession` (`seriesLoaded`, `symbolLoaded`, `update`,
`replayLoaded`, `replayPoint`, `replayResolution`, `replayEnd`, `event`, `error`),
`ChartStudy` (`studyCompleted`, `update`, `event`, `error`), `QuoteMarket` (`loaded`,
`data`, `event`, `error`).

Typing rule: callbacks are typed per event, but the error/event channels stay
variadic (`(...args: unknown[]) => void`) to preserve today's pass-through of arbitrary
packet fragments. Types must not narrow what the runtime already emits.

### 6.4 Invariants restated as migration rules

- Never change a packet name, argument order, default value, or session id prefix.
- Keep `#sendQueue` ordering and the unshift-on-login.
- Keep study matching on `packet.data[1]` ahead of the type switch.
- Keep the symbol-key string construction character-for-character.
- Keep callback-based websocket errors; keep all argument-validation throws and HTTP
  promise rejection messages exactly (section 2.4, invariant 9).
- Keep `global.TW_DEBUG` and the `'§…'` trace prefixes.
- Private fields stay private: `#field` syntax, compiled with a TS target that emits
  native private fields (ES2022+), not `WeakMap` downleveling or `_field` renaming.
- Verification: a fake transport records every outbound frame for a fixed call
  sequence; the recorded frames are compared against the baseline recording.

## 7. Testing, CI, and pack validation

### 7.1 Existing suite

`bun test` stays the runner. Tests keep importing `describe`/`it`/`expect` from
`tests/utils.ts` (3 attempts, 10s per attempt, `runnerTimeout` derived) — retries are
not widened, and red-then-green is still not a pass. Authenticated suites keep
`describe.skipIf(!token || !signature)`. `study_limit_exceeded` remains a known
account-quota condition, not a defect. Tests currently import `'../main'`; they move to
the source entry (`'../src/index'`) for type-level coverage, while the pack tests in 7.2
exercise the published artifacts. `tests/getUser-redirect.test.ts` reaches into
`src/miscRequests` directly and is repointed to `src/http/miscRequests`; the same test
keeps exercising the redirect cap.

### 7.2 Four load combinations

A `tests/pack/` suite packs a tarball and runs in a temporary consumer directory
after the build, asserting for each combination that the export set matches section
2.1 exactly, that the four classes are constructible, and that `Client` can be
instantiated with an injected fake transport:

1. Bun + `import` → `dist/bun/index.mjs`
2. Bun + `require` → `dist/bun/index.cjs`
3. Node >= 20 + `import` → `dist/node/index.mjs`
4. Node >= 20 + `require` → `dist/node/index.cjs`

Combinations 3 and 4 run under `node`, driven from the same suite as child processes, so
one command covers all four. Resolution is asserted by checking which artifact path was
actually loaded, not just that the import succeeded.

### 7.3 Fake socket checks

A `TransportFactory` test double (no network) drives:

- Login: anonymous sends `set_auth_token` with `unauthorized_user_token`, first frame,
  before any session packet.
- Queue: frames sent before `open` are buffered and flushed in order after `open`.
- Ping: a bare-number packet produces exactly `~m~…~m~~h~<n>` back and a `ping` event.
- `protocol_error`: fires `error` and closes.
- Routing: a packet for a registered quote session reaches the matching
  `QuoteMarket.onData`; a packet whose `data[1]` is a study id reaches the study
  listener and not the chart branches.
- Shared subscription: two `QuoteMarket` objects with the same symbol+session produce
  one `quote_add_symbols`, and `quote_remove_symbols` only after the second `close()`.
- Error fallback: with no `onError` registered, `console.error` receives the message.
- Frame recording compared to the baseline recording (section 6.4).

These are the first non-network tests in the repo and they are what makes the
transport refactor reviewable. Live integration tests keep their role and their
caveats: they hit TradingView, they are the real system under test, they need `.env`
(`SESSION`, `SIGNATURE`), and a green run without `.env` does **not** mean the private
indicator paths ran.

### 7.4 Bun artifact must not reference `ws`

A build-verification step greps the Bun artifacts and fails on any hit:

```bash
! grep -nE '(require\(|from )["'"'"']ws["'"'"']' dist/bun/index.mjs dist/bun/index.cjs
```

The assertion is part of the pack suite, not a manual step, and the same check
asserts the positive direction on `dist/node/*` (a `ws` reference must be present).
A package-root resolver test (`import '@mathieuc/tradingview'` /
`require('@mathieuc/tradingview')` from an installed packed tarball), rather than
direct-path loading alone, proves the `bun`/`node` condition ordering selects those
exact files. The tarball's file list must contain only `dist/` and its manifest; neither
`src/` nor `main.js` is an allowed published entry.

### 7.5 CI

One workflow, two jobs, keeping the existing workflow/ref concurrency group
(`cancel-in-progress: false`) because authenticated runs share one TradingView
account/session and concurrent websocket tests are flaky:

- `Bun`: `bun install --frozen-lockfile`, typecheck, lint, `bun test`, build,
  pack validation (all four combinations + the grep assertions). Holds the
  authenticated live suite and the `TW_SESSION` / `TW_SIGNATURE` secrets.
- `Node`: Node 20 and 22, install with `ws`, run the fake-socket + pack suites, plus
  one anonymous live websocket smoke (a public symbol chart, no credentials) on Node 20
  only, so a `ws` handshake regression cannot pass unnoticed.

The Node job never uses the account secrets and never runs the authenticated suite;
one runtime exercising the authenticated network path per run is the whole reason the
concurrency group exists. The anonymous smoke adds no account contention.

## 8. Phased migration

Every phase ends runnable (`bun test` green, `tsc --noEmit` clean, lint clean) and is a
single revertable commit range. No phase leaves the package unpublishable.

| Phase | Content | Runnable check | Revert |
|---|---|---|---|
| P0 | `tsconfig.json`, TS dev deps, ESLint TS parser, `typecheck` script. No source moved. | `bun test` unchanged; `tsc --noEmit` on existing tests | revert config |
| P1 | Pure modules → TS: `types`, `utils`, `protocol`, `chart/graphicParser`. `main.js` stays CJS; Bun source tests resolve `.ts`, while the existing `pack:*` scripts keep building the untouched JS entry (no release yet). | `bun test`, `pack:*` | revert 4 files |
| P2 | Transport seam: `transport/*`, `ClientOptions.transport`, `Client` consumes `defaultTransport` (Bun adapter only, same JS entry). | `bun test` + fake-socket suite, `pack:*` | revert seam + client diff |
| P3 | Stateful units → TS classes: `client`, `quote/session`, `quote/market`, `chart/session`, `chart/study`, `classes/*`. The JS `main.js` facade remains only until P5. | `bun test` + fake-socket suite, `pack:*` | revert converted files |
| P4 | HTTP layer → TS: `miscRequests.js` moves to `http/miscRequests.ts`; `module.exports.getX` → module-local calls. The JS `main.js` facade remains until P5. | `bun test` (search/auth suites), `pack:*` | revert HTTP move |
| P5 | `src/index.ts` replaces `main.js`; dual Bun ESM/CJS build, `.d.ts` with namespace merge, Bun pack tests. Manifest still publishes the legacy `main.js` / 3.x until P6. | `bun test`, `pack:*`, Bun pack checks | revert entry/build diff |
| P6 | Node adapter/build, `exports` map, peers/engines, Node CI + smoke, README/examples, version → 4.0.0 and migration note. Cut over manifest atomically. | all four pack combinations, `bun test`, both CI jobs | revert entire cutover commit |

Ordering rationale: the transport seam (P2) lands before the class conversions (P3) so
the fake-socket tests exist while the riskiest logic is being rewritten; Node (P6)
lands last so a `ws` problem can never block the TypeScript conversion.

## 9. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | `ws` handshake behaves differently from Bun's native client (the known Bun failure was the reverse direction). | Node adapter is P6, behind the fake-socket suite plus a live smoke test in the Node job; adapter is ~20 lines and swappable via injection. |
| R2 | Private `#fields` downleveled to WeakMaps/renames, changing shape or perf. | `tsconfig` target ES2022; pack test asserts private state is not enumerable and public class fields (`Session`, `Market`, `Study`, `instance`, `sessionId`, `signature`, `pineId`) remain own properties. |
| R3 | `.d.ts` loses namespace-style access, breaking `TradingView.Client` as a type in existing tests. | Object-shaped default export + merged namespace aliases; compile `tests/**` plus TS ESM and TS CJS consumer fixtures (section 2.2). |
| R4 | `instanceof` fails if a consumer mixes classes from two artifacts in one process. | Out of contract today and not added; each pack-suite combination builds its indicator and study from the same import route, and the thrown message already names the fix (`TradingView.getIndicator(...)`). |
| R5 | `exports` map ordering puts Bun on the Node build (Bun matches `node` too). | `bun` condition first; pack test asserts the resolved artifact path per combination. |
| R6 | `dependencies` → `peerDependencies` breaks consumers silently. | Major version, README prerequisites, explicit migration note. |
| R7 | Type annotations narrow a real runtime shape (packets are looser than the typedefs). | Error/event channels stay variadic; packet payload types allow unknown keys; when in doubt the type widens, never the runtime. |
| R8 | Live tests mask a transport regression by passing on retry. | Fake-socket suite has no retries and no network; the frame recording is byte-compared. |
| R9 | Bun artifact drifts into referencing `ws` via a shared import. | Grep assertion in the pack suite; `ws` imported only from `transport/node.ts`. |
| R10 | Node lacks a Bun-equivalent global for something else later. | Only the socket needed a seam; `node:zlib` / `node:os` / `Buffer` already work on both, and browsers are a declared non-goal. |

## 10. Agent responsibility matrix

Model assignment for the implementation phase. Not a task breakdown — that is the
implementation plan.

| Area | Owner | Why |
|---|---|---|
| Transport interface, Bun and Node adapters | Sonnet | Runtime-specific, the only place a wrong abstraction is expensive |
| `Client`, quote/chart sessions, `ChartStudy` conversion | Sonnet | Packet routing, queue ordering, listener registries — the wire invariants live here |
| `protocol.ts` compression/base64 paths | Sonnet | Silent-corruption risk on the fallback chain |
| Packaging: dual build, `exports` map, peers, engines, `.d.ts` namespace merge | Sonnet | Resolution-order and declaration-merging subtleties |
| Fake-socket suite, pack suite, grep assertions | Sonnet | These are the safety net for everything else |
| `types.ts`, `utils.ts`, `graphicParser.ts`, typedef → TS type transcription | Haiku | Mechanical, verified by the compiler |
| `PineIndicator`, `BuiltInIndicator`, `PinePermManager` conversion | Haiku | Self-contained state, no wire coupling |
| `http/miscRequests.ts` mechanical conversion (signatures, no `this`) | Haiku | Repetitive; the no-`this` rule is greppable |
| `examples/**` updates, `README.md` prerequisites, migration note | Haiku | Documentation, mirrors the test suite 1:1 |
| CI workflow edits (Bun + Node jobs, matrix, concurrency) | Haiku | Declarative YAML against a stated shape |
| Review of every phase against this spec and repo standards | Fable | Independent check on public-API preservation, wire invariants, and scope creep |

Fable's review gate per phase: public API diff is empty, wire invariants (section 6.4)
hold, no new runtime dependency, no `this` in `miscRequests`, no scope beyond the phase.

## 11. Acceptance criteria

1. Every member in section 2.1 is present with identical names, arities, defaults, and
   getter/method kind. A public-API snapshot test enforces this.
2. All four load combinations (section 7.2) pass, and each asserts the resolved
   artifact path.
3. `dist/bun/*` contains no `ws` reference; `dist/node/*` does. Both asserted by grep
   in CI.
4. Fake-socket suite passes with no network: login ordering, queue flush, ping echo,
   `protocol_error` close, quote/study routing, shared-subscription refcount, error
   fallback to `console.error`.
5. Outbound frame recording for the fixed call sequence is byte-identical to the
   baseline recording.
6. `bun test` on Bun >= 1.3.0 green with `.env`; green-with-skips without it.
7. Node 20 and 22 jobs green.
8. `tsc --noEmit` clean; `npx eslint . --ext .js,.ts` clean with the existing
   airbnb-base relaxations intact (`no-console`, `no-await-in-loop`,
   `no-restricted-syntax`, `no-continue`, `guard-for-in` stay off; the packet loops are
   not refactored to satisfy the base rules).
9. `tests/**` compile unchanged in their use of `TradingView.Client`,
   `TradingView.PineIndicator`, and `InstanceType<typeof client.Session.Chart>`.
10. Every argument-validation path throws the same message as baseline, HTTP rejections
    carry the same messages, and all other websocket-path errors still arrive via
    `onError` (falling back to `console.error` when unregistered).
11. `package.json`: version `4.0.0`, `engines.node >= 20`, `engines.bun >= 1.3.0`,
    `axios`/`jszip`/`ws` as peers with `ws` optional, no `src/` subpath export.
12. `README.md` lists Bun and Node prerequisites; `examples/**` still mirrors the test
    suite 1:1 and runs on both runtimes.

## 12. Resolved decisions

| Question | Decision |
|---|---|
| Language and paradigm | TypeScript; OOP classes for stateful components, pure function modules elsewhere |
| Runtimes | Bun >= 1.3.0 and Node >= 20. No browser. |
| Bun socket | Native `WebSocket` with the `headers` extension |
| Node socket | `ws ^8` behind a thin transport adapter |
| Adapter selection | Build-time entry selection plus the `exports` map; no runtime probing |
| Escape hatch | Optional `ClientOptions.transport` factory injection |
| Runtime fallback chain | Rejected (YAGNI) — it would also break the Bun/`ws` grep assertion |
| Public contract | The import bundle only; `src/` is internal, no deep imports |
| Build scripts | `pack:bun` and `pack:bundle` both kept; each target ships real ESM + CJS; one shared `.d.ts` set |
| Dependency model | `axios`, `jszip`, `ws` are peers; `ws` optional; missing `ws` on Node is an import-time resolution error, documented |
| Versioning | Breaking major (4.0.0) with a migration note, despite an unchanged API surface |
| API preservation | All named/default/`require` exports, the 10 HTTP functions, 4 classes, nested `client.Session.Chart` / `.Quote`, `chart.Study`, `quoteSession.Market`, every `on*` callback, thrown-vs-callback error split, and every wire invariant |
| Test runner | `bun test` stays; `tests/utils.ts` retry/timeout facade unchanged |
| Node CI coverage | Fake-socket + pack suites on Node 20 and 22; one anonymous live websocket smoke on Node 20. Authenticated live suite stays on Bun to protect the shared account |
| Baseline quirks | `seriesLoaded` without `onSeriesLoaded`, and the `getTA`/`get` result closures, are preserved as-is |
| Agent assignment | Sonnet: logic/transport/packaging/tests. Haiku: mechanical conversion, docs, examples, CI. Fable: per-phase review. |

No open questions.
