import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const nodeTransportPlugin = {
  name: 'node-transport',
  setup(build) {
    build.onLoad({ filter: /[/\\]transport[/\\]default\.ts$/ }, () => ({
      contents: 'export { nodeTransport as defaultTransport } from "./node";',
      loader: 'ts',
    }));
  },
};

const formats = process.argv.slice(2);
const selectedFormats = formats.length === 0 ? ['esm', 'cjs'] : formats;
if (!selectedFormats.every((format) => format === 'esm' || format === 'cjs')) {
  throw new Error('Node build formats must be esm or cjs');
}

if (formats.length === 0) {
  await rm('dist/node', { recursive: true, force: true });
} else {
  for (const format of selectedFormats) {
    await rm(`dist/node/index.${format === 'esm' ? 'mjs' : 'cjs'}`, { force: true });
  }
}
await mkdir('dist/node', { recursive: true });

for (const format of selectedFormats) {
  const outfile = `index.${format === 'esm' ? 'mjs' : 'cjs'}`;
  const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    target: 'node',
    format,
    minify: true,
    external: ['ws', 'axios', 'jszip'],
    outdir: 'dist/node',
    naming: outfile,
    plugins: [nodeTransportPlugin],
  });
  if (!result.success) throw new Error(`Node build failed for ${join('dist/node', outfile)}`);
}

for (const format of selectedFormats) {
  const file = `dist/node/index.${format === 'esm' ? 'mjs' : 'cjs'}`;
  const text = await Bun.file(file).text();
  if (!/(?:require\s*\(\s*["']ws["']\s*\)|from\s*["']ws["'])/.test(text)) {
    throw new Error(`Node artifact ${file} missing ws reference`);
  }
}

console.log('node build ok');
