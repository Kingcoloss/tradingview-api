import {
  afterAll, beforeAll, describe, expect, it,
} from 'bun:test';
import {
  cp, mkdtemp, readFile, rm, writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

const packageName = '@mathieuc/tradingview';
const packageRoot = process.cwd();
let tempDir = '';
let packedTarball = '';

const httpFunctionNames = [
  'getTA',
  'searchMarket',
  'searchMarketV3',
  'searchIndicator',
  'getIndicator',
  'loginUser',
  'getUser',
  'getPrivateIndicators',
  'getChartToken',
  'getDrawings',
];
const classNames = ['Client', 'PineIndicator', 'BuiltInIndicator', 'PinePermManager'];

type ConsumerResult = {
  resolved: string;
  httpFunctions: string[];
  classes: string[];
  clientConstructible: boolean;
  nested: { quote: boolean; chart: boolean };
};

type MissingWsResult = {
  resolve: { threw: boolean };
  imported: { ok: boolean; code?: string; message?: string };
};

async function run(command: string[], cwd: string) {
  const child = Bun.spawn({
    cmd: command, cwd, stdout: 'pipe', stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function runConsumer(command: string[], expectedPath: string) {
  const result = await run(command, tempDir);
  expect(result.exitCode).toBe(0);
  const output = JSON.parse(result.stdout) as ConsumerResult;
  expect(output.httpFunctions).toEqual(httpFunctionNames);
  expect(output.classes).toEqual(classNames);
  expect(output.clientConstructible).toBe(true);
  expect(output.nested).toEqual({ quote: true, chart: true });
  expect(output.resolved.replace(/\\/g, '/')).toContain(expectedPath);
}

describe('packed package runtime routes', () => {
  beforeAll(async () => {
    expect((await run(['bun', 'run', 'build:all'], packageRoot)).exitCode).toBe(0);
    const bunArtifact = await Promise.all([
      readFile(join(packageRoot, 'dist/bun/index.mjs'), 'utf8'),
      readFile(join(packageRoot, 'dist/bun/index.cjs'), 'utf8'),
    ]);
    const nodeArtifact = await Promise.all([
      readFile(join(packageRoot, 'dist/node/index.mjs'), 'utf8'),
      readFile(join(packageRoot, 'dist/node/index.cjs'), 'utf8'),
    ]);
    const wsReference = /(?:require\s*\(\s*["']ws["']\s*\)|from\s*["']ws["'])/;
    expect(bunArtifact.some((text) => wsReference.test(text))).toBe(false);
    expect(nodeArtifact.every((text) => wsReference.test(text))).toBe(true);
    expect((await run(['bun', 'pm', 'pack'], packageRoot)).exitCode).toBe(0);

    const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { name: string; version: string };
    const tarball = `${packageJson.name.replace('@', '').replace('/', '-')}-${packageJson.version}.tgz`;
    packedTarball = join(packageRoot, tarball);
    tempDir = await mkdtemp('/tmp/tvpack-');
    await cp(packedTarball, join(tempDir, tarball));
    const listing = await run(['tar', '-tzf', tarball], tempDir);
    expect(listing.exitCode).toBe(0);
    const entries = listing.stdout.trim().split('\n');
    expect(entries).toContain('package/package.json');
    expect(entries).toContain('package/dist/types/index.d.ts');
    for (const path of ['bun/index.mjs', 'bun/index.cjs', 'node/index.mjs', 'node/index.cjs']) {
      expect(entries).toContain(`package/dist/${path}`);
    }
    expect(entries.every((name) => (
      name === 'package/package.json'
      || name === 'package/README.md'
      || name === 'package/CHANGELOG.md'
      || name.startsWith('package/dist/')
    ))).toBe(true);
    expect(entries).not.toContain('package/main.js');
    for (const name of ['consumer-bun-esm.mjs', 'consumer-bun-cjs.cjs', 'consumer-node-esm.mjs', 'consumer-node-cjs.cjs']) {
      await cp(join(packageRoot, 'tests/pack', name), join(tempDir, name));
    }
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({
      private: true,
      dependencies: {
        [packageName]: `file:${tarball}`,
        axios: '^1.5.0',
        jszip: '^3.7.1',
        ws: '^8',
      },
    }));
    expect((await run(['bun', 'install', '--ignore-scripts'], tempDir)).exitCode).toBe(0);
  }, 60_000);

  afterAll(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    if (packedTarball) await rm(packedTarball, { force: true });
  });

  it('routes Bun import to Bun ESM artifact', async () => {
    await runConsumer(['bun', 'consumer-bun-esm.mjs'], 'dist/bun/index.mjs');
  });

  it('routes Bun require to Bun CJS artifact', async () => {
    await runConsumer(['bun', 'consumer-bun-cjs.cjs'], 'dist/bun/index.cjs');
  });

  it('routes Node import to Node ESM artifact', async () => {
    await runConsumer(['node', 'consumer-node-esm.mjs'], 'dist/node/index.mjs');
  });

  it('routes Node require to Node CJS artifact', async () => {
    await runConsumer(['node', 'consumer-node-cjs.cjs'], 'dist/node/index.cjs');
  });

  it('fails Node import when ws peer is absent', async () => {
    const missingWs = await mkdtemp('/tmp/tvpack-no-peer-');
    try {
      const tarball = (await readFile(join(tempDir, 'package.json'), 'utf8'));
      const installed = JSON.parse(tarball) as { dependencies: Record<string, string> };
      const packageTarball = installed.dependencies[packageName].slice('file:'.length);
      await cp(join(tempDir, packageTarball), join(missingWs, packageTarball));
      await writeFile(join(missingWs, 'package.json'), JSON.stringify({
        private: true,
        dependencies: {
          [packageName]: `file:${packageTarball}`,
          axios: '^1.5.0',
          jszip: '^3.7.1',
        },
      }));
      expect((await run(['bun', 'install', '--ignore-scripts'], missingWs)).exitCode).toBe(0);
      await rm(join(missingWs, 'node_modules/ws'), { recursive: true, force: true });
      await cp(join(packageRoot, 'tests/pack/consumer-node-missing-ws.mjs'), join(missingWs, 'consumer-node-missing-ws.mjs'));
      const result = await run(['node', 'consumer-node-missing-ws.mjs'], missingWs);
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as MissingWsResult;
      expect(output.resolve.threw).toBe(true);
      expect(output.imported.ok).toBe(true);
      expect(output.imported.code).toBe('ERR_MODULE_NOT_FOUND');
      expect(output.imported.message).toMatch(/Cannot find package 'ws'|Cannot find module 'ws'/);
    } finally {
      await rm(missingWs, { recursive: true, force: true });
    }
  });
});
