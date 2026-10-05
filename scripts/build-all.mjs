import { $ } from 'bun';

await $`bun run scripts/build-bun.mjs`;
await $`bun run scripts/build-node.mjs`;
