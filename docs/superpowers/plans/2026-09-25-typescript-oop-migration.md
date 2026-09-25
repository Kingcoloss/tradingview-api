# แผนการ implement: ย้าย `@mathieuc/tradingview` ไป TypeScript + Bun/Node

> **สำหรับ agentic workers:** REQUIRED SUB-SKILL: ใช้ superpowers:subagent-driven-development (แนะนำ) หรือ superpowers:executing-plans เพื่อ implement plan ทีละ task โดยใช้ checkbox (`- [ ]`) สำหรับ tracking

**เป้าหมาย:** ย้าย library จาก JavaScript/CommonJS + JSDoc + Bun-only ไปเป็น TypeScript source, OOP สำหรับส่วน stateful, และรองรับทั้ง Bun >=1.3.0 กับ Node.js >=20 โดยไม่เปลี่ยน public API หรือ wire protocol แม้แต่ byte เดียว

**สถาปัตยกรรม:** เพิ่ม transport seam ที่เลือก adapter ตอน build (Bun native `WebSocket` vs `ws ^8`); pack 4 artifacts (Bun ESM/CJS + Node ESM/CJS) พร้อม shared `.d.ts`; ย้าย `axios`/`jszip`/`ws` เป็น `peerDependencies`; bump เป็น major 4.0.0

**Tech Stack:** TypeScript 5.x, Bun 1.3+, Node.js 20+, tsc + `bun build`, ws 8.x, ESLint (airbnb-base + @typescript-eslint)

**Spec:** `docs/superpowers/specs/2026-09-25-typescript-oop-migration-design.md` — plan นี้อิง spec โดยตรง executors ต้องอ่านทั้งสองไฟล์

## Global Constraints

- Public API ทุกตัวใน spec §2.1 คงชื่อ/arity/default/ประเภท getter/method เหมือนเดิมทุกประการ
- Wire bytes ต้อง byte-identical กับ baseline สำหรับ call sequence คงที่ (spec §6.4)
- Session id prefix: `qs`, `cs`, `rs`, `st`, `rsq_step`, `rsq_start`, `rsq_stop` — ห้ามเปลี่ยน
- `packet.p[0]` = session id; `packet.data[1]` = study/symbol key — routing order ต้องคงเดิม
- Login = `set_auth_token` `unshift` ไปหน้าสุด `#sendQueue`; drain เมื่อ `isOpen && #logged` เท่านั้น
- `QuoteMarket` symbol key = `` `=${JSON.stringify({ session, symbol })}` `` character-for-character
- Shared subscription: `quote_add_symbols` ครั้งเดียวต่อ key, `quote_remove_symbols` เมื่อ listener สุดท้ายปิด
- WebSocket-path errors → callback (`onError`) — throw ห้ามใช้ ยกเว้น argument validation (spec §2.4 invariant 9)
- HTTP rejection messages ต้องคงข้อความเดิมทุกตัวอักษร
- `getUser` redirect recursion cap = 5, error `'Too many redirects - possible WAF or geo-restriction'`
- ห้ามใช้ bare `this` ใน `http/miscRequests.ts` — ใช้ module-local function calls
- `global.TW_DEBUG` + `'§…'` trace prefix ต้องคงเดิม
- Private fields ใช้ `#field` syntax; `tsconfig` target = ES2022 ไม่ downlevel เป็น WeakMap
- Bun artifact `dist/bun/*` ต้องไม่มี reference ถึง `ws` (grep assertion); Node artifact `dist/node/*` ต้องมี
- `exports` map: condition `bun` ก่อน `node` ก่อน `default`
- Version bump เป็น `4.0.0`; engines `bun >=1.3.0`, `node >=20`; peers `axios ^1.5.0`, `jszip ^3.7.1`, `ws ^8` (ws optional)
- ห้าม export `src/` — ไม่มี subpath exports
- ESLint airbnb-base + relaxations เดิม (`no-console`, `no-await-in-loop`, `no-restricted-syntax`, `no-continue`, `guard-for-in` off) คงไว้; ห้าม refactor packet loops
- `bun test` เป็น runner; `tests/utils.ts` retry (3 ครั้ง) + timeout (10s) ห้ามขยาย
- Baseline quirk คงไว้: `Client.end()` ปิดเมื่อ `readyState` truthy (0/1/2/3) — ปิดเฉพาะเมื่อ `state !== 'closed'`; `seriesLoaded` slot ไม่มี `onSeriesLoaded` method; `getTA`/`get` closures ปิดทับ module-level function
- แผนและ progress artifacts (spec, plan, review notes) เขียนภาษาไทย; code identifiers, error strings, file paths, commands คงต้นฉบับ

## Review Focus

รายการ input class/failure mode ที่ spec สื่อแต่ยังไม่มี test ครอบชัดเจน เรียงลำดับตามโอกาสเจ็บผู้ใช้จริงมากสุด แต่ละข้อมี test ที่ผูกกับ task เจ้าของ code:

1. **Node consumer ลืมติดตั้ง `ws`** — import `dist/node/index.mjs` ต้องได้ MODULE_NOT_FOUND ที่ชัดเจน ไม่ใช่ silent fallback → test อยู่ Task 18 (pack suite consumer จำลอง Node ไม่มี `ws` และ assert error message)
2. **Consumer สร้าง `PineIndicator` จาก import route หนึ่ง แล้วส่งให้ `chart.Study` จาก route อื่น** — `instanceof` fail และ throw ข้อความเดิม → test อยู่ Task 15 (pack suite assert error string ตรง `'Indicator argument must be an instance of PineIndicator or BuiltInIndicator...'`)
3. **Frame ที่ส่งก่อน socket open** — ต้อง buffer ตามลำดับและ flush หลัง open+login เท่านั้น → test อยู่ Task 12 (fake-socket queue-ordering)
4. **`protocol_error` packet** — ต้อง fire `error` callback แล้วปิด transport ทันที ไม่ประมวลผล packet ถัดไป → test อยู่ Task 12
5. **Bun artifact bundling พลาดแล้ว inline `ws`** — Bun consumer โหลด `dist/bun/*` แล้วเจอ `require('ws')` → grep assertion ที่ Task 17 (pack suite) fail build

## Files Structure

โครงสร้างไฟล์ที่ target หลัง migrate เสร็จ:

```
src/
  index.ts                  # public facade (แทน main.js)
  types.ts                  # shared types
  utils.ts                  # genSessionID, genAuthCookies
  protocol.ts               # parseWSPacket, formatWSPacket, parseCompressed
  http/
    miscRequests.ts         # 10 HTTP functions
  transport/
    types.ts                # Transport, TransportEvents, TransportFactory
    bun.ts                  # Bun native WebSocket adapter
    node.ts                 # ws ^8 adapter
    default.ts              # ชี้ bun.ts ปกติ; Node build alias ไป node.ts
  client.ts                 # class Client
  quote/
    session.ts              # QuoteSession factory
    market.ts               # QuoteMarket factory
  chart/
    session.ts              # ChartSession factory
    study.ts                # ChartStudy factory
    graphicParser.ts        # pure
  classes/
    PineIndicator.ts
    BuiltInIndicator.ts
    PinePermManager.ts
tests/
  utils.ts                  # (คงเดิม, import path เปลี่ยนเป็น src/index)
  fake-transport.ts         # (ใหม่) TransportFactory test double
  fake-socket/*.test.ts     # (ใหม่) login/queue/routing tests
  pack/                     # (ใหม่) 4-route pack validation
    consumer-bun-esm.mjs
    consumer-bun-cjs.cjs
    consumer-node-esm.mjs
    consumer-node-cjs.cjs
    pack.test.ts
dist/
  bun/index.mjs, bun/index.cjs
  node/index.mjs, node/index.cjs
  types/index.d.ts
```


---

## Phase P0 — Toolchain setup

### Task 1: TypeScript toolchain + ESLint parser

**Owner:** Haiku
**Reviewer gate:** Fable — ตรวจว่า config ไม่เปลี่ยน runtime behavior, `bun test` เขียว, ไม่มี source file ถูกแตะต้อง

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Modify: `package.json` (devDependencies + scripts เท่านั้น, ยังไม่แตะ main/version/deps)
- Modify: `.eslintrc.js` (เพิ่ม `@typescript-eslint/parser` + override สำหรับ `*.ts`)

**Interfaces:**
- Produces:
  - script `typecheck` = `tsc --noEmit`
  - script `lint` = `eslint . --ext .js,.ts`
  - `tsconfig.json` มี `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `useDefineForClassFields: true`, `declaration: false`, `noEmit: true`
  - `tsconfig.build.json` extends แล้ว override เป็น `declaration: true`, `emitDeclarationOnly: true`, `outDir: "dist/types"`

- [ ] **Step 1: เพิ่ม devDependencies**

```bash
bun add -d typescript@^5.6.0 @typescript-eslint/parser@^7.0.0 @typescript-eslint/eslint-plugin@^7.0.0 @types/ws@^8.5.0 @types/node@^20.0.0
```

- [ ] **Step 2: เขียน `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "useDefineForClassFields": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["bun-types", "node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "main.js"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: เขียน `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist/types"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: แก้ `.eslintrc.js` เพิ่ม TS override**

เพิ่ม block:
```js
overrides: [
  {
    files: ['**/*.ts'],
    parser: '@typescript-eslint/parser',
    parserOptions: { ecmaVersion: 12, sourceType: 'module' },
    plugins: ['@typescript-eslint'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
],
```

- [ ] **Step 5: เพิ่ม scripts ใน `package.json`**

เพิ่ม (ยังไม่ลบ script เก่า):
```json
"typecheck": "tsc --noEmit",
"lint": "eslint . --ext .js,.ts",
"build:types": "tsc -p tsconfig.build.json"
```

- [ ] **Step 6: verify baseline ยังเขียว**

Run: `bun test && bun run typecheck && bun run lint`
Expected: ทุกคำสั่งผ่าน; ไม่มี test failure ใหม่

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json tsconfig.build.json package.json bun.lock .eslintrc.js
git commit -m "chore: add TypeScript toolchain and ESLint TS parser"
```

---

## Phase P1 — Pure modules → TypeScript

### Task 2: `src/types.ts` (typedef → TS types)

**Owner:** Haiku
**Reviewer gate:** Fable — ตรวจว่า type names ตรงกับ JSDoc เดิมทุกตัว, ไม่มี type ใหม่, ไม่มี rename

**Files:**
- Create: `src/types.ts`
- Delete: `src/types.js` (หลัง verify ว่าไม่มีที่อื่นอ่านผ่าน `require('./types')`)
- Test: (ไม่มี — pure type module ตรวจด้วย `tsc --noEmit`)

**Interfaces:**
- Produces: `export type MarketSymbol`, `export type Timezone`, `export type TimeFrame` — ชื่อและ union members ตรงกับ JSDoc

- [ ] **Step 1: เขียน `src/types.ts`**

```ts
/** Market symbol (like: 'BTCEUR' or 'KRAKEN:BTCEUR') */
export type MarketSymbol = string;

export type Timezone =
  | 'Etc/UTC' | 'exchange'
  | 'Pacific/Honolulu' | 'America/Juneau' | 'America/Los_Angeles'
  // … คัดลอก union member ทั้งหมดจาก src/types.js บรรทัด 6-30 ครบทุกตัว
  ;

export type TimeFrame =
  | '1' | '3' | '5' | '15' | '30'
  | '45' | '60' | '120' | '180' | '240'
  | '1D' | '1W' | '1M';
```

- [ ] **Step 2: grep ตรวจ consumer**

Run: `grep -rn "require.*types" src main.js tests`
Expected: ไม่มี hit (types module ปัจจุบัน export empty object เท่านั้น)

- [ ] **Step 3: ลบ `src/types.js`**

```bash
git rm src/types.js
```

- [ ] **Step 4: verify**

Run: `bun run typecheck && bun test`
Expected: ผ่านทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "refactor(types): migrate typedef namespace to TypeScript"
```

---

### Task 3: `src/utils.ts` (genSessionID, genAuthCookies)

**Owner:** Haiku
**Reviewer gate:** Fable — ตรวจ character set ของ session id ตรงกัน, `genAuthCookies` output byte-identical

**Files:**
- Create: `src/utils.ts`
- Modify: `src/miscRequests.js` (import path เปลี่ยนเป็น `./utils` เหมือนเดิม — Node/Bun resolver จับ `.ts` อัตโนมัติภายใต้ Bun; JS consumer ผ่าน `main.js` ยังคง require `./utils` ได้เพราะ Bun transpile ทันที)
- Modify: `src/chart/session.js`, `src/chart/study.js`, `src/quote/session.js`, `src/classes/PinePermManager.js` — import path เดิม `../utils` ใช้ต่อได้
- Delete: `src/utils.js`
- Test: `tests/unit/utils.test.ts` (ใหม่)

**Interfaces:**
- Produces:
  - `export function genSessionID(type?: string): string` — default `'xs'`, output `${type}_${12 random chars}`
  - `export function genAuthCookies(sessionId?: string, signature?: string): string` — default `''`; return `''` ถ้าไม่มี sessionId, `sessionid=<id>` ถ้าไม่มี signature, `sessionid=<id>;sessionid_sign=<sig>` ถ้ามีครบ

- [ ] **Step 1: เขียน failing test**

```ts
// tests/unit/utils.test.ts
import { describe, it, expect } from '../utils';
import { genSessionID, genAuthCookies } from '../../src/utils';

describe('utils', () => {
  it('genSessionID uses prefix and 12 alphanumeric chars', () => {
    const id = genSessionID('qs');
    expect(id).toMatch(/^qs_[A-Za-z0-9]{12}$/);
  });
  it('genSessionID defaults to xs', () => {
    expect(genSessionID()).toMatch(/^xs_[A-Za-z0-9]{12}$/);
  });
  it('genAuthCookies empty when no sessionId', () => {
    expect(genAuthCookies()).toBe('');
    expect(genAuthCookies('')).toBe('');
  });
  it('genAuthCookies sessionid only when no signature', () => {
    expect(genAuthCookies('abc')).toBe('sessionid=abc');
  });
  it('genAuthCookies both when full', () => {
    expect(genAuthCookies('abc', 'xyz')).toBe('sessionid=abc;sessionid_sign=xyz');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `bun test tests/unit/utils.test.ts`
Expected: FAIL (module not found หรือ ts source ยังไม่มี)

- [ ] **Step 3: เขียน `src/utils.ts`**

```ts
export function genSessionID(type: string = 'xs'): string {
  let r = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 12; i += 1) {
    r += c.charAt(Math.floor(Math.random() * c.length));
  }
  return `${type}_${r}`;
}

export function genAuthCookies(sessionId: string = '', signature: string = ''): string {
  if (!sessionId) return '';
  if (!signature) return `sessionid=${sessionId}`;
  return `sessionid=${sessionId};sessionid_sign=${signature}`;
}
```

- [ ] **Step 4: ลบ `src/utils.js`**

```bash
git rm src/utils.js
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `bun test tests/unit/utils.test.ts && bun test && bun run typecheck && bun run lint`
Expected: ผ่านทั้งหมด (JS consumer ที่ยังใช้ `require('./utils')` ต้องยังทำงานได้ผ่าน Bun transpile)

- [ ] **Step 6: Commit**

```bash
git add src/utils.ts tests/unit/utils.test.ts
git commit -m "refactor(utils): migrate to TypeScript with unit tests"
```

---

### Task 4: `src/protocol.ts` (parseWSPacket, formatWSPacket, parseCompressed)

**Owner:** Sonnet (High Effort) — silent-corruption risk บน compressed fallback chain
**Reviewer gate:** Fable — ตรวจ 4 fallback readers ครบ (identity, inflateSync, inflateRawSync, gunzipSync), base64 normalisation ตรง byte

**Files:**
- Create: `src/protocol.ts`
- Delete: `src/protocol.js`
- Test: `tests/unit/protocol.test.ts` (ใหม่)

**Interfaces:**
- Produces:
  - `export interface TWPacket { m?: string; p?: unknown[] }`
  - `export function parseWSPacket(str: string): TWPacket[]`
  - `export function formatWSPacket(packet: TWPacket | string | number): string` — return `~m~${msg.length}~m~${msg}` (msg = `JSON.stringify(packet)` ถ้า object, ไม่งั้น string ตรง)
  - `export async function parseCompressed(data: string): Promise<unknown>` — normaliseBase64 → JSZip → fallback ผ่าน 4 readers

- [ ] **Step 1: เขียน failing test**

```ts
// tests/unit/protocol.test.ts
import { describe, it, expect } from '../utils';
import { parseWSPacket, formatWSPacket, parseCompressed } from '../../src/protocol';
import * as zlib from 'node:zlib';

describe('protocol', () => {
  it('formatWSPacket wraps JSON with length prefix', () => {
    const out = formatWSPacket({ m: 'ping', p: [1] });
    const body = JSON.stringify({ m: 'ping', p: [1] });
    expect(out).toBe(`~m~${body.length}~m~${body}`);
  });
  it('formatWSPacket passes string through', () => {
    expect(formatWSPacket('~h~5' as any)).toBe(`~m~4~m~~h~5`);
  });
  it('parseWSPacket strips heartbeats, splits length prefix, parses JSON', () => {
    const body = JSON.stringify({ m: 'quote_completed', p: ['qs_abc', 'key'] });
    const frame = `~m~${body.length}~m~${body}~h~1`;
    const parsed = parseWSPacket(frame);
    expect(parsed).toEqual([{ m: 'quote_completed', p: ['qs_abc', 'key'] }]);
  });
  it('parseCompressed decodes zlib inflate fallback', async () => {
    const payload = { ok: true, x: 42 };
    const raw = Buffer.from(JSON.stringify(payload));
    const compressed = zlib.deflateSync(raw).toString('base64');
    // จงใจตัด padding ให้เหลือ URL-safe เพื่อ verify normaliseBase64
    const stripped = compressed.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const out = await parseCompressed(stripped);
    expect(out).toEqual(payload);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `bun test tests/unit/protocol.test.ts`

- [ ] **Step 3: เขียน `src/protocol.ts`**

Port `src/protocol.js` เป็น TS แบบ 1:1 (ดู source ปัจจุบัน) — ทุก function เดียวกัน, private helpers `normaliseBase64` และ `parseDecodedCompressed` (readers array 4 ตัว) เป็น module-private, no default export

- [ ] **Step 4: ลบ `src/protocol.js`**

```bash
git rm src/protocol.js
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `bun test && bun run typecheck && bun run lint`

- [ ] **Step 6: Commit**

```bash
git add src/protocol.ts tests/unit/protocol.test.ts
git commit -m "refactor(protocol): migrate to TypeScript preserving compression fallback chain"
```

---

### Task 5: `src/chart/graphicParser.ts`

**Owner:** Haiku
**Reviewer gate:** Fable — ตรวจ TRANSLATOR maps ตรงทั้งหมด, output field names ตรงกับ typedef, indexes lookup คงเดิม

**Files:**
- Create: `src/chart/graphicParser.ts`
- Delete: `src/chart/graphicParser.js`
- Test: `tests/unit/graphicParser.test.ts` (ใหม่)

**Interfaces:**
- Produces:
  - types ทั้งหมดจาก JSDoc เดิม (`ExtendValue`, `yLocValue`, `LabelStyleValue`, `LineStyleValue`, `BoxStyleValue`, `SizeValue`, `VAlignValue`, `HAlignValue`, `TextWrapValue`, `TablePositionValue`, `GraphicLabel`, `GraphicLine`, `GraphicBox`, `TableCell`, `GraphicTable`, `GraphicHorizline`, `GraphicPoint`, `GraphicPolygon`, `GraphicHorizHist`, `GraphicData`)
  - `export default function graphicParse(rawGraphic?: Record<string, unknown>, indexes?: number[]): GraphicData`

- [ ] **Step 1: เขียน failing test สำหรับ label + line + horizline mapping**

```ts
// tests/unit/graphicParser.test.ts
import { describe, it, expect } from '../utils';
import graphicParse from '../../src/chart/graphicParser';

describe('graphicParser', () => {
  it('maps labels with translator', () => {
    const raw = {
      dwglabels: {
        L1: { id: 1, x: 0, y: 10, yl: 'ab', t: 'hi', st: 'flg', ci: 1, tci: 2, sz: 'sm', ta: 'r', tt: 'x' },
      },
    };
    const out = graphicParse(raw, [1234]);
    expect(out.labels[0]).toMatchObject({
      id: 1, x: 1234, y: 10, yLoc: 'abovebar', text: 'hi', style: 'flag',
    });
  });
  // …เพิ่ม test สำหรับ lines, boxes, tables (matrix), horizlines, polygons, hhists
});
```

- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: เขียน `src/chart/graphicParser.ts`** — port 1:1 จาก `src/chart/graphicParser.js`
- [ ] **Step 4: ลบ `src/chart/graphicParser.js`**
- [ ] **Step 5: Run tests — expect PASS**

Run: `bun test && bun run typecheck && bun run lint`

- [ ] **Step 6: Commit**

```bash
git add src/chart/graphicParser.ts tests/unit/graphicParser.test.ts
git commit -m "refactor(graphicParser): migrate to TypeScript"
```

---

## Phase P2 — Transport seam

### Task 6: Transport interface + fake transport

**Owner:** Sonnet (High Effort)
**Reviewer gate:** Fable — ตรวจ interface ตรงกับ spec §3.2 byte-for-byte, state values 4 ตัว ('connecting' | 'open' | 'closing' | 'closed'), fake transport ไม่ทำ network

**Files:**
- Create: `src/transport/types.ts`
- Create: `tests/fake-transport.ts`
- Test: (ใช้ใน Task 12; task นี้แค่ตั้งเครื่องมือ)

**Interfaces:**
- Produces (จาก spec §3.2 ตายตัว):
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
- Produces (fake transport helper):
  - `export function createFakeTransport(): { factory: TransportFactory; sent: string[]; open(): void; deliver(frame: string): void; error(msg: string): void; close(): void; state: TransportState }`

- [ ] **Step 1: เขียน `src/transport/types.ts`** — content เท่ากับ block ด้านบน exact

- [ ] **Step 2: เขียน `tests/fake-transport.ts`**

```ts
import type { Transport, TransportFactory, TransportEvents, TransportState } from '../src/transport/types';

export function createFakeTransport() {
  const sent: string[] = [];
  let state: TransportState = 'connecting';
  let events: TransportEvents | null = null;
  const transport: Transport = {
    send(data) { sent.push(data); },
    close() { state = 'closed'; events?.onClose(); },
    get state() { return state; },
  };
  const factory: TransportFactory = (_opts, ev) => { events = ev; return transport; };
  return {
    factory,
    sent,
    open() { state = 'open'; events?.onOpen(); },
    deliver(frame: string) { events?.onMessage(frame); },
    error(msg: string) { events?.onError(msg); },
    close() { state = 'closed'; events?.onClose(); },
    get state() { return state; },
  };
}
```

- [ ] **Step 3: Verify compile**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/transport/types.ts tests/fake-transport.ts
git commit -m "feat(transport): define Transport interface and fake transport helper"
```

---

### Task 7: Bun native WebSocket adapter

**Owner:** Sonnet (High Effort)
**Reviewer gate:** Fable — ตรวจ header option ใช้ Bun extension, event.data ถูกส่ง string ตรง, state mapping ถูกต้อง

**Files:**
- Create: `src/transport/bun.ts`
- Create: `src/transport/default.ts`

**Interfaces:**
- Consumes: `TransportFactory`, `Transport`, `TransportState` จาก `./types`
- Produces:
  - `src/transport/bun.ts`: `export const bunTransport: TransportFactory`
  - `src/transport/default.ts`: `export { bunTransport as defaultTransport } from './bun'`

- [ ] **Step 1: เขียน `src/transport/bun.ts`**

```ts
import type { Transport, TransportFactory, TransportState } from './types';

const stateMap: Record<number, TransportState> = {
  0: 'connecting',
  1: 'open',
  2: 'closing',
  3: 'closed',
};

export const bunTransport: TransportFactory = (options, events) => {
  // Bun-specific: WebSocket constructor accepts `{ headers }` as second argument
  const ws = new WebSocket(options.url, { headers: options.headers } as any);
  ws.addEventListener('open', () => events.onOpen());
  ws.addEventListener('close', () => events.onClose());
  ws.addEventListener('error', (ev: any) => events.onError(String(ev?.message ?? 'WebSocket error')));
  ws.addEventListener('message', (ev: MessageEvent) => events.onMessage(String(ev.data)));
  const transport: Transport = {
    send(data) { ws.send(data); },
    close() { ws.close(); },
    get state() { return stateMap[ws.readyState] ?? 'closed'; },
  };
  return transport;
};
```

- [ ] **Step 2: เขียน `src/transport/default.ts`**

```ts
export { bunTransport as defaultTransport } from './bun';
```

- [ ] **Step 3: Verify compile + lint**

Run: `bun run typecheck && bun run lint`

- [ ] **Step 4: Commit**

```bash
git add src/transport/bun.ts src/transport/default.ts
git commit -m "feat(transport): add Bun native WebSocket adapter"
```

---

### Task 8: ClientOptions.transport injection wiring

**Owner:** Sonnet (High Effort)
**Reviewer gate:** Fable — ตรวจว่า Client ไม่มี `WebSocket` reference ตรงอีก, `isOpen` = `state === 'open'`, `end()` เรียก `close()` เมื่อ `state !== 'closed'` (ครอบ CONNECTING/OPEN/CLOSING เหมือน baseline)

**Files:**
- Modify: `src/client.js` (แก้เฉพาะจุด ยังไม่ port เป็น TS — port full ที่ Task 11)
- Test: ใช้ existing `bun test`

**Interfaces:**
- Consumes: `defaultTransport`, `TransportFactory` จาก `./transport/*`
- Produces: `ClientOptions.transport?: TransportFactory` — optional, default = `defaultTransport`

**หมายเหตุ:** Task นี้เป็น minimal wiring บน JS source เดิม เพื่อให้ Task 12 (fake-socket suite) เขียน test ได้ก่อน Task 11 port ทั้งไฟล์ ยังไม่ลบ direct `new WebSocket(...)` ทั้งหมด แค่แทรก transport shim

- [ ] **Step 1: เพิ่ม import + shim ใน `src/client.js`**

หัวไฟล์เพิ่ม:
```js
const { defaultTransport } = require('./transport/default');
```

แทนที่ constructor block ที่สร้าง `this.#ws = new WebSocket(...)` และ `addEventListener(...)` ด้วย transport factory pattern:
```js
const factory = clientOptions.transport || defaultTransport;
this.#transport = factory(
  {
    url: `wss://${server}.tradingview.com/socket.io/websocket?from=chart&type=chart`,
    headers: {
      Origin: 'https://www.tradingview.com',
      ...defaultHeaders,
      ...clientOptions.headers,
    },
  },
  {
    onOpen: () => this.sendQueue(),
    onClose: () => this.#handleEvent('disconnected'),
    onError: (msg) => this.#handleError('WebSocket', msg),
    onMessage: (data) => this.#parsePacket(data),
  },
);
```

- [ ] **Step 2: แก้ getter `isOpen` และ method ที่พึ่ง readyState**

```js
get isOpen() { return this.#transport.state === 'open'; }
```

ใน `sendQueue()`: เปลี่ยน `this.#ws.send` เป็น `this.#transport.send`
ใน `#parsePacket` (ping echo, protocol_error close): `this.#transport.close()`
ใน `end()`:
```js
end() {
  return new Promise((cb) => {
    if (this.#transport.state !== 'closed') this.#transport.close();
    cb();
  });
}
```

- [ ] **Step 3: Verify baseline suite ยังเขียว**

Run: `bun test`
Expected: PASS (ไม่มี test failure ใหม่); live tests ผ่านเหมือนเดิมถ้ามี `.env`

- [ ] **Step 4: Commit**

```bash
git add src/client.js
git commit -m "feat(client): route WebSocket through Transport seam with optional injection"
```

---

## Phase P3 — Stateful classes → TypeScript

### Task 9: `PineIndicator` → TS

**Owner:** Haiku
**Reviewer gate:** Fable — ตรวจ error message ตรง `'Input '${input.name}' (${propI}) must be ${types[input.type]} !'` และ `'Input '${input.name}' (${propI}) must be one values:'` และ `'Input '${key}' not found (${propI}).'` ต้อง byte-identical

**Files:**
- Create: `src/classes/PineIndicator.ts`
- Delete: `src/classes/PineIndicator.js`
- Test: `tests/unit/pineIndicator.test.ts` (ใหม่ — cover error messages)

**Interfaces:**
- Consumes: (none)
- Produces: `export default class PineIndicator` — public members: getters `pineId`, `pineVersion`, `description`, `shortDescription`, `inputs`, `plots`, `type`, `script`; methods `setType(type?)`, `setOption(key, value)`; constructor `(options: Indicator)`
- Produces types: `export interface IndicatorInput`, `export interface Indicator`, `export type IndicatorType`

- [ ] **Step 1: เขียน failing tests (error messages exact)**

```ts
// tests/unit/pineIndicator.test.ts
import { describe, it, expect } from '../utils';
import PineIndicator from '../../src/classes/PineIndicator';

const stub = () => new PineIndicator({
  pineId: 'X', pineVersion: '1', description: '', shortDescription: '',
  inputs: {
    in_0: { name: 'Length', inline: 'l', type: 'integer', value: 14, isHidden: false, isFake: false },
    in_1: { name: 'Src', inline: 's', type: 'text', value: 'close', isHidden: false, isFake: false, options: ['open', 'close'] },
  },
  plots: {},
  script: '',
} as any);

describe('PineIndicator.setOption', () => {
  it('throws exact type-mismatch message', () => {
    expect(() => stub().setOption(0, 'not-number')).toThrow(
      "Input 'Length' (in_0) must be Number !",
    );
  });
  it('throws exact options message', () => {
    expect(() => stub().setOption(1, 'invalid')).toThrow(
      "Input 'Src' (in_1) must be one of the values:",
    );
  });
  it('throws exact not-found message', () => {
    expect(() => stub().setOption('nope', 1)).toThrow(
      "Input 'nope' not found (undefined).",
    );
  });
});
```

**หมายเหตุสำคัญ:** ตรวจ source `src/classes/PineIndicator.js` ก่อนเขียน expected string ให้ตรง byte — text บาง fragment ในไฟล์ที่อ่านมีตัด (`must be one values:` vs `must be one of the values:`). Owner ต้องอ่าน file เต็มแล้ว copy exact string ที่ code จริง throw

- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Port `src/classes/PineIndicator.js` → `.ts`** — คง `#options`, `#type`, ทุก getter/method, ทุก error string ตรง byte
- [ ] **Step 4: ลบ .js เก่า**
- [ ] **Step 5: Run tests — expect PASS**
- [ ] **Step 6: Commit**

```bash
git add src/classes/PineIndicator.ts tests/unit/pineIndicator.test.ts
git commit -m "refactor(PineIndicator): migrate to TypeScript with error-message tests"
```

---

### Task 10: `BuiltInIndicator` + `PinePermManager` → TS

**Owner:** Haiku
**Reviewer gate:** Fable — ตรวจ `defaultValues` map ครบทุก key/type ตรงกับ baseline, error strings byte-identical (`Wrong buit-in indicator type "${type}"` typo คงเดิม), PinePermManager สร้าง cookie header + form encoding ตรง

**Files:**
- Create: `src/classes/BuiltInIndicator.ts`
- Create: `src/classes/PinePermManager.ts`
- Delete: `src/classes/BuiltInIndicator.js`, `src/classes/PinePermManager.js`
- Test: `tests/unit/builtInIndicator.errors.test.ts` (ใหม่) + `tests/unit/pinePermManager.test.ts` (ใหม่ — constructor validation เท่านั้น ไม่ hit network)

**Interfaces:**
- Produces:
  - `export default class BuiltInIndicator` — constructor `(type?: BuiltInIndicatorType)`, getters `type`, `options`, method `setOption(key, value, FORCE?)`
  - `export default class PinePermManager` — public fields `sessionId`, `signature`, `pineId`; methods `getUsers`, `addUser`, `modifyExpiration`, `removeUser`
  - Types: `BuiltInIndicatorType`, `BuiltInIndicatorOption`, `AuthorizationUser`

- [ ] **Step 1: เขียน failing tests**

BuiltInIndicator: constructor throw `'Wrong buit-in indicator type ""'` เมื่อ type ว่าง (คง typo "buit-in" ตามต้นฉบับ), setOption throw `"Wrong '${key}' value type '${valType}' (must be '${requiredType}')"` และ `"Option '${key}' is denied with '${type}' indicator"` — ตรวจ exact string จาก source

PinePermManager: constructor throw `'Please provide SessionID'`, `'Please provide a Signature'`, `'Please provide a PineID'`

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Port ทั้งสองไฟล์เป็น `.ts` — คง `defaultValues` map เต็ม, ทุก error string ตรง byte**
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add src/classes/BuiltInIndicator.ts src/classes/PinePermManager.ts tests/unit/builtInIndicator.errors.test.ts tests/unit/pinePermManager.test.ts
git commit -m "refactor(classes): migrate BuiltInIndicator and PinePermManager to TypeScript"
```

---

### Task 11: `Client` → TS (full port)

**Owner:** Sonnet (High Effort) — high-risk core; queue ordering, packet routing, `end()` quirk ต้องคงเดิม
**Reviewer gate:** Fable — checklist:
1. `#sendQueue` unshift auth token ก่อน push ทุก outbound packet
2. `sendQueue()` drain เมื่อ `isOpen && #logged` เท่านั้น
3. `#parsePacket`: number → ping echo `~h~n`; `protocol_error` → handleError + close; `p[0]` in `#sessions` → route; `!#logged` → emit `logged`; else → emit `data`
4. `end()` เรียก `close()` เมื่อ `state !== 'closed'` (ครอบ CONNECTING/OPEN/CLOSING)
5. `Session.Quote`, `Session.Chart` instance properties (ไม่ใช่ static)
6. `global.TW_DEBUG` + `'§…'` trace prefix คงเดิม
7. Anonymous path: `set_auth_token` payload = `['unauthorized_user_token']` แบบ synchronous ใน constructor
8. Authenticated path: unshift ใน `.then((user) => ...)` ของ `misc.getUser(...)` แล้ว call `sendQueue()`

**Files:**
- Create: `src/client.ts`
- Delete: `src/client.js`
- Test: pack tests ครอบ (Task 12+17); direct unit test เพิ่มใน Task 12

**Interfaces:**
- Consumes: `defaultTransport`, `TransportFactory`, `Transport`, `TransportOptions` จาก `./transport/*`; `formatWSPacket`, `parseWSPacket` จาก `./protocol`; `quoteSessionGenerator` จาก `./quote/session`; `chartSessionGenerator` จาก `./chart/session`; `getUser` จาก `./http/miscRequests`
- Produces: `export default class Client` — ตรงกับ spec §2.1

- [ ] **Step 1: Port `src/client.js` → `src/client.ts`** — คงลำดับ statements ใน constructor, สลับเฉพาะ `WebSocket` calls เป็น `transport.*`; typedef → interface exports (`SessionList`, `SendPacket`, `ClientBridge`, `ClientEvent`, `ClientOptions`, `SocketSession`)
- [ ] **Step 2: `#sessions`, `#callbacks`, `#sendQueue`, `#logged`, `#transport` เป็น private fields (`#` syntax)**
- [ ] **Step 3: `Session = { Quote: quoteSessionGenerator(this.#clientBridge), Chart: chartSessionGenerator(this.#clientBridge) }` เป็น instance property**
- [ ] **Step 4: ลบ `src/client.js`**
- [ ] **Step 5: Verify**

Run: `bun test && bun run typecheck && bun run lint`
Expected: ผ่านทั้งหมด (live suite ถ้า `.env` มี)

- [ ] **Step 6: Commit**

```bash
git add src/client.ts
git commit -m "refactor(client): migrate to TypeScript preserving queue and routing invariants"
```

---

### Task 12: Fake-socket suite (login/queue/routing/ping/protocol_error)

**Owner:** Sonnet (High Effort) — เป็น safety net ให้ทุก task หลังจากนี้
**Reviewer gate:** Fable — ทุก assertion เป็น deterministic, ไม่ใช้ network, ครอบ Review Focus #3 (frame-before-open) และ #4 (protocol_error)

**Files:**
- Create: `tests/fake-socket/login.test.ts`
- Create: `tests/fake-socket/queue.test.ts`
- Create: `tests/fake-socket/routing.test.ts`
- Create: `tests/fake-socket/ping.test.ts`
- Create: `tests/fake-socket/protocol-error.test.ts`
- Create: `tests/fake-socket/error-fallback.test.ts`
- Create: `tests/fake-socket/frame-recording.test.ts` — spec §6.4 byte-identical baseline

**Interfaces:**
- Consumes: `createFakeTransport` จาก `tests/fake-transport`, `Client` จาก `src/client`

- [ ] **Step 1: `login.test.ts` — anonymous auth ต้องเป็น frame แรก**

```ts
import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';
import Client from '../../src/client';

describe('fake-socket login', () => {
  it('sends set_auth_token unauthorized_user_token as first frame after open', () => {
    const fake = createFakeTransport();
    new Client({ transport: fake.factory });
    fake.open();
    expect(fake.sent[0]).toContain('set_auth_token');
    expect(fake.sent[0]).toContain('unauthorized_user_token');
  });
});
```

- [ ] **Step 2: `queue.test.ts` — frames ก่อน open ต้อง buffer + flush ตามลำดับ**

```ts
it('buffers outbound packets before open then flushes in order', () => {
  const fake = createFakeTransport();
  const client = new Client({ transport: fake.factory });
  client.send('test_early', ['a']);
  expect(fake.sent).toEqual([]); // ยังไม่มี frame ออก
  fake.open();
  expect(fake.sent[0]).toContain('set_auth_token'); // unshift ก่อน
  expect(fake.sent[1]).toContain('test_early');
});
```

- [ ] **Step 3: `ping.test.ts` — bare number → echo `~h~n`**

```ts
it('echoes bare-number ping as heartbeat', () => {
  const fake = createFakeTransport();
  new Client({ transport: fake.factory });
  fake.open();
  fake.sent.length = 0;
  fake.deliver('~m~1~m~5');
  expect(fake.sent).toEqual(['~m~4~m~~h~5']);
});
```

- [ ] **Step 4: `protocol-error.test.ts` — fire error + close**

```ts
it('fires error and closes transport on protocol_error', () => {
  const fake = createFakeTransport();
  const client = new Client({ transport: fake.factory });
  const errors: unknown[][] = [];
  client.onError((...msgs) => errors.push(msgs));
  fake.open();
  const body = JSON.stringify({ m: 'protocol_error', p: ['bad'] });
  fake.deliver(`~m~${body.length}~m~${body}`);
  expect(errors.length).toBe(1);
  expect(fake.state).toBe('closed');
});
```

- [ ] **Step 5: `routing.test.ts` — quote session + study routing**

- สร้าง `client.Session.Quote()` → subscribe symbol → deliver `qsd` packet ที่ `p[1].n === symbolKey` → assert `QuoteMarket.onData` เรียก
- สร้าง `client.Session.Chart()` → create study id `st_xxx` → deliver packet ที่ `data[1] === studyID` → assert study listener trigger, ไม่ trigger chart branch

- [ ] **Step 6: `error-fallback.test.ts` — ไม่มี onError → `console.error`**

```ts
it('falls back to console.error when no onError registered', () => {
  const fake = createFakeTransport();
  new Client({ transport: fake.factory });
  const spy = spyOn(console, 'error');
  fake.error('boom');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
```

- [ ] **Step 7: `frame-recording.test.ts` — golden frame sequence**

Record baseline (Sonnet ต้อง run bun test เมื่อ Task 8 เสร็จเพื่อ capture ที่จุดที่ยัง compat) — call sequence: create Client anonymous → Quote session → subscribe `BINANCE:BTCEUR` regular → create Chart session → setMarket → setSeries → delete both sessions → `end()`. Store frames เป็น fixture `tests/fixtures/baseline-frames.json`

Assert เมื่อ replay call sequence เดียวกัน frames output ตรง 1:1

- [ ] **Step 8: Run — expect PASS ทั้งชุด**

Run: `bun test tests/fake-socket/`

- [ ] **Step 9: Commit**

```bash
git add tests/fake-socket tests/fixtures/baseline-frames.json
git commit -m "test(fake-socket): add deterministic Transport-injected suite with golden frame recording"
```

---

### Task 13: `QuoteSession` + `QuoteMarket` → TS

**Owner:** Sonnet (High Effort) — shared subscription refcount + symbolKey exactness
**Reviewer gate:** Fable — checklist:
1. `#symbolKey = ` `` `=${JSON.stringify({ session, symbol })}` `` character-for-character
2. subscribe → ตรวจ `!#symbolListeners[key]` → `quote_add_symbols` เฉพาะครั้งแรก
3. `close()` → `<= 1` ก่อน delete → `quote_remove_symbols` เมื่อเหลือคนเดียว
4. `quote_completed` และ `qsd` routing ใน `QuoteSession.onData` ทำงานตาม baseline (unknown key ส่ง `quote_remove_symbols`)
5. `quote_create_session` + `quote_set_fields` เรียกใน constructor ตามลำดับ

**Files:**
- Create: `src/quote/session.ts`, `src/quote/market.ts`
- Delete: `src/quote/session.js`, `src/quote/market.js`
- Test: `tests/fake-socket/shared-subscription.test.ts` (ใหม่ ครอบ Review Focus)

**Interfaces:**
- Produces:
  - `export default function quoteSessionGenerator(client: ClientBridge): typeof QuoteSession`
  - `export default function quoteMarketGenerator(session: QuoteSessionBridge): typeof QuoteMarket`
  - Types: `SymbolListeners`, `QuoteSessionBridge`, `quoteField`, `quoteSessionOptions`, `MarketEvent`

- [ ] **Step 1: เขียน failing test shared-subscription**

```ts
it('shares one quote_add_symbols across markets with same key', () => {
  const fake = createFakeTransport();
  const client = new Client({ transport: fake.factory });
  fake.open();
  fake.sent.length = 0;
  const qs = new client.Session.Quote();
  const m1 = new qs.Market('BTCEUR', 'regular');
  const m2 = new qs.Market('BTCEUR', 'regular');
  const adds = fake.sent.filter((f) => f.includes('quote_add_symbols'));
  expect(adds.length).toBe(1);
  m1.close();
  const removesAfterFirst = fake.sent.filter((f) => f.includes('quote_remove_symbols'));
  expect(removesAfterFirst.length).toBe(0);
  m2.close();
  const removesFinal = fake.sent.filter((f) => f.includes('quote_remove_symbols'));
  expect(removesFinal.length).toBe(1);
});
```

- [ ] **Step 2: Port `src/quote/session.js` → `.ts`** — คง generator function ที่ return class, private fields, constructor call order
- [ ] **Step 3: Port `src/quote/market.js` → `.ts`** — คง `#symbolKey` string exact, listener index logic
- [ ] **Step 4: ลบ .js เก่า**
- [ ] **Step 5: Run — expect PASS**
- [ ] **Step 6: Commit**

```bash
git add src/quote tests/fake-socket/shared-subscription.test.ts
git commit -m "refactor(quote): migrate session and market to TypeScript with shared-subscription test"
```

---

### Task 14: `ChartSession` → TS (553 บรรทัด, high-risk)

**Owner:** Sonnet (High Effort)
**Reviewer gate:** Fable — checklist:
1. Session id prefixes `cs`, `rs`
2. `onData` order: `packet.data[1]` studyListener check → symbol_resolved → timescale_update/du (รวม `$prices` series + per-key study fanout) → symbol_error → series_error → critical_error
3. Replay session onData: `replay_ok` (resolves `#replayOKCB`), `replay_instance_id`, `replay_point`, `replay_resolutions`, `replay_data_end`, `critical_error`
4. `setSeries` ครั้งแรกใช้ `create_series`, ถัดไปใช้ `modify_series` (ตาม `#seriesCreated` flag)
5. `setMarket` ล้าง `#periods`, จัดการ replay create/delete, สร้าง `resolve_symbol` payload พร้อม ChartTypes mapping ตรง
6. `replayStep`/`replayStart`/`replayStop` ใช้ session id prefix `rsq_step`/`rsq_start`/`rsq_stop`
7. `Study = studyConstructor(this.#chartSession)` เป็น instance property
8. `delete()` ล้าง `#replayMode` และลบทั้ง `#chartSessionID` + `#replaySessionID` จาก `client.sessions`

**Files:**
- Create: `src/chart/session.ts`
- Delete: `src/chart/session.js`
- Test: pack test + fake-socket routing (Task 12) ครอบ; เพิ่ม 1 unit test สำหรับ `setMarket` payload

**Interfaces:**
- Consumes: `genSessionID`, `studyConstructor`, `ClientBridge`
- Produces: `export default function chartSessionGenerator(client: ClientBridge): typeof ChartSession`; types `ChartType`, `ChartInputs`, `StudyListeners`, `ChartSessionBridge`, `ChartEvent`, `PricePeriod`, `Subsession`, `MarketInfos`

- [ ] **Step 1: เขียน failing test สำหรับ setMarket resolve_symbol payload**

```ts
it('setMarket emits resolve_symbol with correct symbolInit shape', () => {
  const fake = createFakeTransport();
  const client = new Client({ transport: fake.factory });
  fake.open();
  const cs = new client.Session.Chart();
  fake.sent.length = 0;
  cs.setMarket('BINANCE:BTCEUR', { timeframe: '60', range: 50 });
  const resolveFrame = fake.sent.find((f) => f.includes('resolve_symbol'));
  expect(resolveFrame).toBeDefined();
  expect(resolveFrame).toContain('BINANCE:BTCEUR');
  expect(resolveFrame).toContain('"adjustment":"splits"');
});
```

- [ ] **Step 2: Port `src/chart/session.js` → `.ts` แบบ 1:1** — ทุก private field, ทุก callback registration, ทุก packet type handler อยู่ครบ
- [ ] **Step 3: ลบ .js เก่า**
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add src/chart/session.ts tests/fake-socket/chart-setmarket.test.ts
git commit -m "refactor(chart/session): migrate to TypeScript preserving packet routing order"
```

---

### Task 15: `ChartStudy` → TS (445 บรรทัด, high-risk)

**Owner:** Sonnet (High Effort)
**Reviewer gate:** Fable — checklist:
1. Constructor throw `'Indicator argument must be an instance of PineIndicator or BuiltInIndicator.\n Please use \'TradingView.getIndicator(...)\' function.'` byte-identical
2. `setIndicator` throw ข้อความเดียวกัน แล้วส่ง `modify_study`
3. `create_study` payload = `[chartSession.sessionID, studID, 'st1', 'sessionID', indicator.type, getInputs(indicator)]`
4. `study_completed` → emit `studyCompleted`
5. `timescale_update` / `du`: parse `data[1][studID]` → `.st` เป็น periods (map ตาม `instance.plots`), `.ns.d` เป็น graphics + strategy report
6. Compressed strategy: `parsed.dataCompressed` → `parseCompressed` async → `updateStrategyReport(report)`; ถ้า throw → `#handleError('Unable to decode compressed strategy report:', error.message)`
7. Graphics parsing: `parsed.graphicsCmds.erase` + `parsed.graphicsCmds.create` → mutate `#graphic` แบบ baseline
8. `remove()` → `remove_study` + delete `#studyListeners[studID]`

**Files:**
- Create: `src/chart/study.ts`
- Delete: `src/chart/study.js`
- Test: `tests/unit/chartStudy.errors.test.ts` (constructor + setIndicator error strings)

**Interfaces:**
- Consumes: `genSessionID`, `parseCompressed`, `graphicParse`, `PineIndicator`, `BuiltInIndicator`, `ChartSessionBridge`
- Produces: `export default function studyConstructor(chartSession: ChartSessionBridge): typeof ChartStudy`; types `TradeReport`, `PerfReport`, `FromTo`, `StrategyReport`, `UpdateChangeType`

- [ ] **Step 1: เขียน failing test error string**

```ts
it('throws exact message when constructed with non-indicator', () => {
  // ต้อง call ผ่าน chart session เพราะ constructor เป็น factory-returned class
  const fake = createFakeTransport();
  const client = new Client({ transport: fake.factory });
  fake.open();
  const cs = new client.Session.Chart();
  expect(() => new cs.Study({} as any)).toThrow(
    "Indicator argument must be an instance of PineIndicator or BuiltInIndicator.\n Please use 'TradingView.getIndicator(...)' function.",
  );
});
```

- [ ] **Step 2: Port 1:1** — คง async study listener, ทุก parsed key handling, ทุก error branch
- [ ] **Step 3: ลบ .js เก่า**
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add src/chart/study.ts tests/unit/chartStudy.errors.test.ts
git commit -m "refactor(chart/study): migrate to TypeScript preserving compressed strategy path"
```

---

## Phase P4 — HTTP layer

### Task 16: `src/http/miscRequests.ts`

**Owner:** Haiku (mechanical, no-this rule greppable) — reviewer Fable ตรวจ semantics
**Reviewer gate:** Fable — checklist:
1. **ห้ามใช้ bare `this` ใน function scope** (grep: `grep -n "\bthis\b" src/http/miscRequests.ts` → เหลือเฉพาะที่ปลอดภัย เช่น method chain บน object literal ที่ระบุชัด; module-level function ต้องไม่มี)
2. `searchMarket`/`searchMarketV3` result closures เรียก `getTA(id)` ตรงเป็น module-local function ไม่ใช่ `module.exports.getTA` และไม่ใช่ `this.getTA`
3. `searchIndicator`/`getPrivateIndicators` result closures เรียก `getIndicator(...)` ตรง
4. `getUser` recursion เรียกตัวเองด้วย function name ไม่ใช่ `module.exports.getUser` (default arg `redirectCount = 0`, cap `> 5` throw `'Too many redirects - possible WAF or geo-restriction'`)
5. Error strings byte-identical:
   - `` `Inexistent or unsupported indicator: "${data.reason}"` ``
   - `'Wrong or expired sessionid/signature'`
   - `'Wrong layout or credentials'`
   - `'Wrong layout, user credentials, or chart id.'`
   - `loginUser` throw `data.error` ตรง
6. `getDrawings` เรียก `getChartToken` local ไม่ใช่ `module.exports.getChartToken`
7. `getUser`/`loginUser` regex patterns ตรงเดิม (จำนวน group, ลำดับ)

**Files:**
- Create: `src/http/miscRequests.ts`
- Delete: `src/miscRequests.js`
- Modify: `tests/getUser-redirect.test.ts` (path `../src/miscRequests` → `../src/http/miscRequests`; module cache invalidation ยังใช้แนวเดิม)
- Test: existing `tests/getUser-redirect.test.ts`, `search.test.ts`, `authenticated.test.ts` ครอบ

**Interfaces:**
- Consumes: `axios`, `os`, `PineIndicator`, `genAuthCookies`
- Produces (module-level exports):
  - `export async function getTA(id: string): Promise<Periods | false>`
  - `export async function searchMarket(search: string, filter?: string): Promise<SearchMarketResult[]>`
  - `export async function searchMarketV3(search: string, filter?: string, offset?: number): Promise<SearchMarketResult[]>`
  - `export async function searchIndicator(search?: string): Promise<SearchIndicatorResult[]>`
  - `export async function getIndicator(id: string, version?: string, session?: string, signature?: string): Promise<PineIndicator>`
  - `export async function loginUser(username: string, password: string, remember?: boolean, UA?: string): Promise<User>`
  - `export async function getUser(session: string, signature?: string, location?: string, redirectCount?: number): Promise<User>`
  - `export async function getPrivateIndicators(session: string, signature?: string): Promise<SearchIndicatorResult[]>`
  - `export async function getChartToken(layout: string, credentials?: UserCredentials): Promise<string>`
  - `export async function getDrawings(layout: string, symbol?: string, credentials?: UserCredentials, chartID?: string): Promise<Drawing[]>`
  - Types: `advice`, `Period`, `Periods`, `SearchMarketResult`, `SearchIndicatorResult`, `User`, `UserCredentials`, `Drawing`, `DrawingPoint`

- [ ] **Step 1: Port `src/miscRequests.js` → `src/http/miscRequests.ts`**

- แปลง `module.exports = { getTA, ... }` เป็น named `export async function ...`
- ทุกครั้งที่ code เดิมเรียก `module.exports.getX(...)` (`getTA` ใน search closures, `getIndicator` ใน search/private, `getChartToken` ใน getDrawings, `getUser` ใน redirect recursion) แทนด้วย function name ตรง
- Private helpers `validateStatus`, `indicators`, `builtInIndicList`, `fetchScanData` เป็น module-scope ไม่ export

- [ ] **Step 2: ย้าย/แก้ `tests/getUser-redirect.test.ts`**

เปลี่ยน:
- `const miscPath = require.resolve('../src/miscRequests');` → `require.resolve('../src/http/miscRequests')`
- `const misc = require('../src/miscRequests');` → `require('../src/http/miscRequests')`
- `misc.getUser(...)` → `misc.getUser(...)` (path เดียวกัน)

- [ ] **Step 3: ลบ `src/miscRequests.js`**

- [ ] **Step 4: grep verify no bare `this`**

```bash
grep -n '\bthis\.' src/http/miscRequests.ts
```
Expected: ไม่มี output (หรือมีเฉพาะบน object literal ที่ชัดเจน)

- [ ] **Step 5: Run tests**

Run: `bun test && bun run typecheck && bun run lint`
Expected: ผ่านทั้งหมด (search, authenticated, getUser-redirect)

- [ ] **Step 6: Commit**

```bash
git add src/http tests/getUser-redirect.test.ts
git rm src/miscRequests.js
git commit -m "refactor(http): migrate miscRequests to TypeScript with no-bare-this rule"
```

---

## Phase P5 — Public facade + Bun build

### Task 17: `src/index.ts` + Bun dual build + shared `.d.ts`

**Owner:** Sonnet (High Effort) — resolution ordering + declaration merging tricky
**Reviewer gate:** Fable — checklist:
1. `index.ts` export ทุกตัวจาก spec §2.1 ครบ (10 HTTP functions + `Client`, `PineIndicator`, `BuiltInIndicator`, `PinePermManager`)
2. Default export = object `{ ...http, Client, PineIndicator, BuiltInIndicator, PinePermManager }` — ทำให้ `require('@mathieuc/tradingview').Client` และ `import TradingView from '@mathieuc/tradingview'; TradingView.Client` ใช้ได้
3. Namespace merge สำหรับ `TradingView.Client` / `TradingView.PineIndicator` เป็น type
4. `pack:bun` (ESM) และ script ใหม่ `pack:bun:cjs` (CJS) build จาก `src/index.ts` ผ่าน `bun build --target=bun`
5. `build:types` emit `dist/types/index.d.ts` เดียว
6. `dist/bun/index.mjs` และ `dist/bun/index.cjs` มี Client, PineIndicator, ... exports + default; grep `require('ws')` / `from 'ws'` = ไม่พบ

**Files:**
- Create: `src/index.ts`
- Create: `scripts/build-bun.mjs` — orchestrate bun build ESM + CJS + type emit + grep assertion
- Modify: `package.json` scripts (`pack:bun`, `pack:bun:cjs`, `build:bun`); ยังไม่แตะ `main`/`exports`
- Delete: `main.js` (หลัง verify pack tests ที่ Task 18 ผ่าน)
- Test: `tests/pack/bun-esm.test.ts`, `tests/pack/bun-cjs.test.ts` (ใหม่ — โหลด `dist/bun/*` ตรงเทียบ export set)

**Interfaces:**
- Produces: build script + `src/index.ts` public facade
- Consumes: source `src/**/*.ts`

- [ ] **Step 1: เขียน `src/index.ts`**

```ts
import Client from './client';
import PineIndicator from './classes/PineIndicator';
import BuiltInIndicator from './classes/BuiltInIndicator';
import PinePermManager from './classes/PinePermManager';
import * as http from './http/miscRequests';

export {
  getTA, searchMarket, searchMarketV3, searchIndicator, getIndicator,
  loginUser, getUser, getPrivateIndicators, getChartToken, getDrawings,
} from './http/miscRequests';
export { Client, PineIndicator, BuiltInIndicator, PinePermManager };
export type { ClientOptions, ClientEvent } from './client';
export type { IndicatorInput, Indicator, IndicatorType } from './classes/PineIndicator';
// … re-export type list ตาม spec §2.2

const TradingView = {
  ...http,
  Client,
  PineIndicator,
  BuiltInIndicator,
  PinePermManager,
};

export default TradingView;
```

- [ ] **Step 2: หลัง `build:types` แล้ว post-process `dist/types/index.d.ts`**

เพิ่ม namespace merge (append):
```ts
declare namespace TradingView {
  export type Client = InstanceType<typeof import('./client').default>;
  export type PineIndicator = InstanceType<typeof import('./classes/PineIndicator').default>;
  // …
}
```

script `scripts/append-namespace.mjs` ทำงานหลัง `tsc -p tsconfig.build.json`

- [ ] **Step 3: เขียน `scripts/build-bun.mjs`**

```js
import { $ } from 'bun';
await $`bun build src/index.ts --target=bun --format=esm --minify --outfile=dist/bun/index.mjs`;
await $`bun build src/index.ts --target=bun --format=cjs --minify --outfile=dist/bun/index.cjs`;
await $`bun run build:types`;
await $`node scripts/append-namespace.mjs`;
// grep assertion
const files = ['dist/bun/index.mjs', 'dist/bun/index.cjs'];
for (const f of files) {
  const txt = await Bun.file(f).text();
  if (/(require\(|from\s+)["']ws["']/.test(txt)) {
    console.error(`Bun artifact ${f} contains ws reference`);
    process.exit(1);
  }
}
console.log('bun build ok');
```

- [ ] **Step 4: แก้ `package.json` scripts**

```json
"build:bun": "bun run scripts/build-bun.mjs",
"pack:bun": "bun build src/index.ts --target=bun --format=esm --minify --outfile=dist/bun/index.mjs",
"pack:bun:cjs": "bun build src/index.ts --target=bun --format=cjs --minify --outfile=dist/bun/index.cjs"
```

(ยังคง script `pack:bundle` เดิมไปก่อน — จะแก้ที่ Task 19)

- [ ] **Step 5: เขียน pack test Bun**

```ts
// tests/pack/bun-esm.test.ts
import { describe, it, expect } from '../utils';

describe('pack: Bun ESM artifact', () => {
  it('exports 10 HTTP functions + 4 classes + default', async () => {
    const mod = await import('../../dist/bun/index.mjs' as any);
    expect(typeof mod.getTA).toBe('function');
    expect(typeof mod.searchMarketV3).toBe('function');
    // …ครบ 10 ตัว
    expect(typeof mod.Client).toBe('function');
    expect(typeof mod.PineIndicator).toBe('function');
    expect(typeof mod.BuiltInIndicator).toBe('function');
    expect(typeof mod.PinePermManager).toBe('function');
    expect(mod.default.Client).toBe(mod.Client);
  });
});
```

`bun-cjs.test.ts` ใช้ `require('../../dist/bun/index.cjs')` แนวเดียวกัน

- [ ] **Step 6: Build + run pack test**

```bash
bun run build:bun
bun test tests/pack/
```

- [ ] **Step 7: ลบ `main.js`**

verify ไม่มี test/example อ่านตรง (grep `require\('../main'\)`) — ถ้ามี ให้ update ที่ Task 20; ที่ปลอด delete ตอนนี้

- [ ] **Step 8: Commit**

```bash
git add src/index.ts scripts/build-bun.mjs scripts/append-namespace.mjs package.json tests/pack/bun-*.test.ts
git rm main.js
git commit -m "feat(build): add TypeScript public facade with Bun ESM+CJS build and pack tests"
```

---

## Phase P6 — Node adapter + full 4-route publish

### Task 18: Node `ws` adapter

**Owner:** Sonnet (High Effort)
**Reviewer gate:** Fable — checklist:
1. Static `import WebSocket from 'ws'` (ไม่ใช่ dynamic; ให้ bundler ตัดสิน)
2. Payload types (Buffer, Buffer[], ArrayBuffer, string) normalise เป็น string ก่อนส่ง `onMessage`
3. Error event ส่ง `err.message` เป็น string
4. State mapping ตรงกับ Bun adapter (`readyState` 0→connecting, 1→open, 2→closing, 3→closed)
5. Constructor รับ `{ headers }` argument

**Files:**
- Create: `src/transport/node.ts`

**Interfaces:**
- Produces: `export const nodeTransport: TransportFactory`

- [ ] **Step 1: เขียน `src/transport/node.ts`**

```ts
import WebSocket, { RawData } from 'ws';
import type { Transport, TransportFactory, TransportState } from './types';

const stateMap: Record<number, TransportState> = {
  [WebSocket.CONNECTING]: 'connecting',
  [WebSocket.OPEN]: 'open',
  [WebSocket.CLOSING]: 'closing',
  [WebSocket.CLOSED]: 'closed',
};

function normalise(data: RawData): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return (data as Buffer).toString('utf8');
}

export const nodeTransport: TransportFactory = (options, events) => {
  const ws = new WebSocket(options.url, { headers: options.headers });
  ws.on('open', () => events.onOpen());
  ws.on('close', () => events.onClose());
  ws.on('error', (err: Error) => events.onError(err.message));
  ws.on('message', (data) => events.onMessage(normalise(data)));
  const transport: Transport = {
    send(data) { ws.send(data); },
    close() { ws.close(); },
    get state() { return stateMap[ws.readyState] ?? 'closed'; },
  };
  return transport;
};
```

- [ ] **Step 2: Verify compile**

Run: `bun run typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/transport/node.ts
git commit -m "feat(transport): add ws-based Node adapter"
```

---

### Task 19: Node dual build + 4-route pack suite + grep both directions

**Owner:** Sonnet (High Effort)
**Reviewer gate:** Fable — checklist:
1. Node build alias `./transport/default` → `./transport/node` ที่ build time (ไม่ใช่ runtime probe)
2. `dist/node/index.mjs`, `dist/node/index.cjs` มี `ws` reference (grep POSITIVE); `dist/bun/*` ไม่มี (grep NEGATIVE)
3. Pack test 4 route pass: Bun+import, Bun+require, Node+import, Node+require
4. Node consumer ที่ไม่ติดตั้ง `ws` → import ล้มเหลวด้วย MODULE_NOT_FOUND ที่มี string `'ws'` (Review Focus #1)
5. Node child process ตรวจ path ที่ resolve ได้จริง (ผ่าน `import.meta.resolve` หรือ CJS `require.resolve`)

**Files:**
- Create: `scripts/build-node.mjs`
- Create: `scripts/build-all.mjs` — เรียก build-bun + build-node
- Create: `tests/pack/consumer-bun-esm.mjs`, `consumer-bun-cjs.cjs`, `consumer-node-esm.mjs`, `consumer-node-cjs.cjs`, `pack.test.ts`
- Create: `tests/pack/consumer-node-missing-ws.mjs` (Review Focus #1)
- Modify: `package.json` (`pack:bundle` → `pack:node`, เพิ่ม `pack:node:cjs`, `build:node`, `build:all`)

**Interfaces:**
- Consumes: `src/index.ts`, `src/transport/node.ts`
- Produces: `dist/node/index.mjs`, `dist/node/index.cjs`

- [ ] **Step 1: เขียน `scripts/build-node.mjs`**

```js
import { $ } from 'bun';
// Bun build with alias for default transport → node
await $`bun build src/index.ts --target=node --format=esm --minify --external ws --external axios --external jszip --outfile=dist/node/index.mjs --alias:./transport/default=./transport/node`;
await $`bun build src/index.ts --target=node --format=cjs --minify --external ws --external axios --external jszip --outfile=dist/node/index.cjs --alias:./transport/default=./transport/node`;
// grep positive
const files = ['dist/node/index.mjs', 'dist/node/index.cjs'];
for (const f of files) {
  const txt = await Bun.file(f).text();
  if (!/(require\(|from\s+)["']ws["']/.test(txt)) {
    console.error(`Node artifact ${f} missing ws reference`);
    process.exit(1);
  }
}
console.log('node build ok');
```

**ตรวจ:** `bun build --alias` syntax ต้อง verify กับ Bun 1.3+ (ถ้า Bun ยังไม่รองรับ path alias flag ให้ใช้ pre-build swap: copy `src/transport/node.ts` → `src/transport/default.ts` ชั่วคราว build เสร็จค่อย restore; log แนวทางเลือกใน review)

- [ ] **Step 2: เขียน 4 consumer scripts + `pack.test.ts`**

`tests/pack/pack.test.ts` spawn 4 consumers ผ่าน `Bun.spawn` (Bun scripts) และ `node` binary (Node scripts) แล้ว assert stdout เป็น JSON list export ครบ + resolved path ตรงกับที่คาด

`tests/pack/consumer-node-esm.mjs`:
```js
import * as mod from '@mathieuc/tradingview';
console.log(JSON.stringify({
  hasClient: typeof mod.Client === 'function',
  hasGetTA: typeof mod.getTA === 'function',
  resolved: import.meta.resolve('@mathieuc/tradingview'),
}));
```

Test runner ต้อง pack tarball, install ใน temp dir, run consumer, cleanup — โครง:
```ts
const tar = await Bun.spawn(['bun', 'pm', 'pack']).exited;
const tmp = await mkdtemp('/tmp/tvpack-');
// … copy tar, npm/bun install, spawn consumers, assert
```

- [ ] **Step 3: เขียน `consumer-node-missing-ws.mjs`**

Consumer install `@mathieuc/tradingview` แต่ **ไม่มี** `ws` → import ต้อง throw ที่มี `'ws'` ในข้อความ:
```js
try {
  await import('@mathieuc/tradingview');
  console.log(JSON.stringify({ ok: false, reason: 'expected throw' }));
} catch (e) {
  console.log(JSON.stringify({ ok: true, message: String(e.message) }));
}
```

- [ ] **Step 4: แก้ `package.json` scripts**

```json
"pack:node": "bun run scripts/build-node.mjs",
"build:node": "bun run scripts/build-node.mjs",
"build:all": "bun run scripts/build-bun.mjs && bun run scripts/build-node.mjs"
```

ลบ `pack:bundle` เก่า

- [ ] **Step 5: Run pack suite**

```bash
bun run build:all
bun test tests/pack/pack.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add scripts/build-node.mjs scripts/build-all.mjs tests/pack package.json
git commit -m "feat(build): add Node ws-external build and 4-route pack suite"
```

---

### Task 20: `package.json` manifest cutover (v4.0.0, peers, engines, exports)

**Owner:** Haiku (declarative) — reviewer Fable ตรวจ resolution ordering + peer meta
**Reviewer gate:** Fable — checklist:
1. `version: "4.0.0"`
2. `main: "./dist/node/index.cjs"`, `module: "./dist/node/index.mjs"`, `types: "./dist/types/index.d.ts"`
3. `exports["."]` มี condition `types` ก่อน แล้ว `bun` (import+require) ก่อน `node` (import+require) ก่อน `default`
4. `exports["./package.json"]` = `"./package.json"`
5. `peerDependencies`: `axios ^1.5.0`, `jszip ^3.7.1`, `ws ^8`
6. `peerDependenciesMeta.ws.optional = true`
7. `engines.bun >= 1.3.0`, `engines.node >= 20`
8. `dependencies` ว่างเปล่า (ย้ายไปเป็น peers หมด)
9. `files: ["dist"]`
10. ไม่มี `src/` ใน `files`; ไม่มี subpath exports

**Files:**
- Modify: `package.json`
- Create: `CHANGELOG.md` (ถ้ายังไม่มี) — เพิ่ม 4.0.0 entry ตาม spec §5.4

**Interfaces:**
- Consumes: build outputs `dist/{bun,node,types}`

- [ ] **Step 1: เขียน `package.json` block ใหม่ตาม spec §5.2/§5.3**

```json
{
  "name": "@mathieuc/tradingview",
  "version": "4.0.0",
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
  "files": ["dist"],
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

`scripts` block คงเดิม (Task 17+19 เพิ่มไว้แล้ว) + เพิ่ม `prepublishOnly: "bun run build:all"`

- [ ] **Step 2: เขียน `CHANGELOG.md` entry 4.0.0**

Content = spec §5.4 migration note ภาษาไทย: จุด public API ไม่เปลี่ยน, peers ต้อง install เอง, Node >=20 supported, deep imports ตาย, TypeScript declarations shipped

- [ ] **Step 3: Verify pack tests ยังผ่านหลัง manifest เปลี่ยน**

```bash
bun run build:all
bun test tests/pack
```

- [ ] **Step 4: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): 4.0.0 with peerDependencies and exports map"
```

---

### Task 21: CI matrix (Bun + Node 20/22)

**Owner:** Haiku (YAML declarative)
**Reviewer gate:** Fable — checklist:
1. Bun job คง concurrency group เดิม (`cancel-in-progress: false`) และเก็บ `TW_SESSION`/`TW_SIGNATURE` — เป็น job เดียวที่ run authenticated live suite
2. Node job matrix `[20, 22]` — ไม่ pass account secrets, ไม่ run authenticated live suite
3. Node job run: install (with `ws`), typecheck, lint, build:all, `bun test tests/pack tests/fake-socket tests/unit`, + anonymous live smoke (Node 20 เท่านั้น)
4. Anonymous smoke = create Client ไม่มี token, subscribe public symbol, รอ 1 event, exit 0

**Files:**
- Modify: `.github/workflows/tests.yml`
- Create: `tests/live-smoke/anonymous.test.ts` (Node 20 อย่างเดียว)

- [ ] **Step 1: เพิ่ม anonymous smoke test**

```ts
// tests/live-smoke/anonymous.test.ts
import { describe, it, expect } from '../utils';
import { Client } from '../../dist/node/index.mjs' as any;

describe.skipIf(process.env.SMOKE !== '1')('anonymous live smoke', () => {
  it('receives at least one quote packet for BINANCE:BTCUSDT', async () => {
    const client = new Client({});
    const qs = new client.Session.Quote();
    const m = new qs.Market('BINANCE:BTCUSDT');
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 20000);
      m.onData(() => { clearTimeout(t); resolve(); });
      m.onError((...msgs) => { clearTimeout(t); reject(new Error(msgs.join(' '))); });
    });
    m.close();
    qs.delete();
    await client.end();
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: แก้ `.github/workflows/tests.yml`**

```yaml
name: Tests
on:
  push:
  pull_request:
    branches: [main]
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * *'

jobs:
  Bun:
    runs-on: ubuntu-latest
    concurrency:
      group: ${{ github.workflow }}-bun-${{ github.ref }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun test
        env:
          SESSION: ${{ secrets.TW_SESSION }}
          SIGNATURE: ${{ secrets.TW_SIGNATURE }}
      - run: bun run build:all
      - run: bun test tests/pack

  Node:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run build:all
      - run: bun test tests/pack tests/fake-socket tests/unit
      - if: matrix.node == '20'
        run: bun test tests/live-smoke
        env:
          SMOKE: '1'
```

- [ ] **Step 3: Verify locally**

```bash
bun run build:all
SMOKE=1 bun test tests/live-smoke
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/tests.yml tests/live-smoke
git commit -m "ci: add Node 20/22 matrix with anonymous live smoke"
```

---

### Task 22: `README.md`, `examples/`, `CLAUDE.md` update

**Owner:** Haiku
**Reviewer gate:** Fable — checklist:
1. `README.md` มี section prerequisites Bun (`bun add @mathieuc/tradingview axios jszip`) + Node (`npm i @mathieuc/tradingview axios jszip ws`)
2. `README.md` migration note ชี้ CHANGELOG 4.0.0
3. `examples/**/*.js` ยังใช้ `require('../main')` — ต้องเปลี่ยนเป็น `require('@mathieuc/tradingview')` หรือ local path ที่ resolve ผ่าน `exports` map; ถ้ายังใช้ `main.js` ไม่ได้แล้วเพราะ Task 17 ลบไป — เลือกใช้ `require('..')` (package root) ให้ resolver จับ `exports` map
4. `CLAUDE.md` update: ลบ "Bun-only package" ทั้งบล็อก, เพิ่ม dual-runtime section, update commands (`bun run build:all`, node consumer note), update Testing section (Bun runs authenticated, Node runs pack + smoke)
5. Examples ยัง mirror test suite 1:1 (search.test.ts ↔ Search.js, ...)

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `examples/**/*.js` (14 ไฟล์)

- [ ] **Step 1: Update `README.md`**

เพิ่มหลัง existing intro:
```markdown
## Prerequisites

**Bun (≥1.3.0):**
```bash
bun add @mathieuc/tradingview axios jszip
```

**Node.js (≥20):**
```bash
npm install @mathieuc/tradingview axios jszip ws
```

## Migration to 4.0

Dependencies เป็น `peerDependencies` แล้ว — ติดตั้ง `axios`, `jszip` (และ `ws` บน Node) ด้วยตัวเอง ดู `CHANGELOG.md` สำหรับรายละเอียด
```

- [ ] **Step 2: Update `examples/*.js` (14 files)**

replace `require('../main')` → `require('..')` (package root, resolver จับ `exports`)

- [ ] **Step 3: Update `CLAUDE.md`**

- ลบ `**Bun-only package.**` paragraph
- เขียนใหม่ section "What this is": mention dual-runtime, TypeScript sources, build artifacts
- Update `## Commands`: เพิ่ม `bun run build:all`, `bun run typecheck`
- Update `## Architecture` intro: mention `src/transport/`, TS files
- คง "Invariants worth not breaking" ทั้งหมด (invariants ยังเหมือนเดิม)
- Update Testing: mention Bun runs authenticated + full suite, Node CI runs pack + fake-socket + smoke
- Add "Build" section: `bun run build:all` → 4 artifacts + `.d.ts`

- [ ] **Step 4: Verify examples run**

```bash
bun install --frozen-lockfile
bun run build:all
bun run example examples/SimpleChart.js
```

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md examples
git commit -m "docs: update README, CLAUDE, and examples for 4.0 dual-runtime"
```

---

## Spec Crosswalk

| Spec section | Task(s) |
|---|---|
| §2.1 Public API surface | 11 (Client), 9 (PineIndicator), 10 (BuiltInIndicator/PinePermManager), 13 (QuoteSession/Market), 14 (ChartSession), 15 (ChartStudy), 16 (HTTP), 17 (index.ts export set) |
| §2.2 Type contracts | 2 (types.ts), 9/10/13/14/15/16 (per-module types), 17 (namespace merge) |
| §2.3 Runtime contracts | 7 (Bun), 18 (Node), 8/11 (Client uses transport) |
| §2.4 Wire invariants (1-11) | 4 (protocol), 11 (Client packet routing), 12 (fake-socket tests), 13 (symbolKey/subscription), 14 (chart onData order), 15 (study routing/compression), 16 (HTTP errors + redirect cap) |
| §3.1 Layout | 2-16 (structural moves) |
| §3.2 Transport interface | 6 |
| §3.3 Adapters | 7 (Bun), 18 (Node) |
| §3.4 Build-time selection | 19 (alias) |
| §3.5 Injection | 8, 11 (ClientOptions.transport) |
| §4 Class/function boundaries | 9-16 |
| §5.1 Artifacts | 17 (Bun), 19 (Node), 17 (types) |
| §5.2 Exports map | 20 |
| §5.3 Peers/engines | 20 |
| §5.4 Migration note | 20 (CHANGELOG), 22 (README) |
| §6.1-6.3 Data/event/error flow | 11, 13, 14, 15 |
| §6.4 Invariants restated | 12 (frame recording), reviewer gate for 11/13/14/15 |
| §7.1 Existing suite | 16 (repoint getUser-redirect) |
| §7.2 Four load combinations | 19 (pack.test.ts) |
| §7.3 Fake socket | 12 |
| §7.4 Bun no-ws | 17 (grep), 19 (both directions) |
| §7.5 CI | 21 |
| §8 Phases | plan phases P0-P6 ตรงกัน |
| §9 Risks | plan Global Constraints + reviewer gates |
| §10 Agent responsibility | task Owner column |
| §11 Acceptance criteria | ตรวจสอบใน Task 21 (CI green) + reviewer gates |
| §12 Resolved decisions | ทั้ง plan สะท้อนออกมาแล้ว |

## Behavior change ที่ระบุใน 4.0.0

**`Client.end()` state check** — ผู้ใช้ตัดสินให้ทำตาม spec §3.2:

- **Baseline JS (3.x):** `if (this.#ws.readyState) this.#ws.close();` — เงื่อนไข truthy จับ 1/2/3 แต่ **ไม่จับ 0 (CONNECTING)**
- **4.0.0 (target):** `if (this.#transport.state !== 'closed') this.#transport.close();` — จับ `connecting`/`open`/`closing`

นี่เป็น **deliberate behavior change** ใน 4.0.0:
- Task 11 reviewer gate #4 คงถ้อยความ "ครอบ CONNECTING/OPEN/CLOSING" ตามเดิม
- Task 20 CHANGELOG entry ต้องรวมประโยค: `Client.end()` เดิมข้าม state CONNECTING → ตอนนี้ปิด socket ที่กำลัง connect ด้วย เพื่อให้ semantics ตรงกับชื่อ method
- Task 12 fake-socket suite เพิ่ม 1 test: สร้าง Client, `end()` ก่อน fake.open(), assert `fake.state === 'closed'`
