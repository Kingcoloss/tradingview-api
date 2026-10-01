import { appendFile } from 'node:fs/promises';

const namespace = `

declare namespace TradingView {
  export type Client = InstanceType<typeof import('./client').default>;
  export type PineIndicator = InstanceType<typeof import('./classes/PineIndicator').default>;
  export type BuiltInIndicator = InstanceType<typeof import('./classes/BuiltInIndicator').default>;
  export type PinePermManager = InstanceType<typeof import('./classes/PinePermManager').default>;
}
`;

await appendFile('dist/types/index.d.ts', namespace);
