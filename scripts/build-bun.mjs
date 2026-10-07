import { $ } from 'bun';

await $`rm -rf dist/bun dist/types`;
await $`bun build src/index.ts --target=bun --format=esm --minify --external axios --external jszip --outfile=dist/bun/index.mjs`;
await $`bun build src/index.ts --target=bun --format=cjs --minify --external axios --external jszip --outfile=dist/bun/index.cjs`;
await $`bun run build:types`;

for (const file of ['dist/bun/index.mjs', 'dist/bun/index.cjs']) {
  const text = await Bun.file(file).text();
  if (/(?:require\s*\(\s*["']ws["']\s*\)|from\s*["']ws["'])/.test(text)) {
    throw new Error(`Bun artifact ${file} contains ws reference`);
  }
}

console.log('bun build ok');
