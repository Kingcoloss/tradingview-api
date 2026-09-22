import { describe, expect, it as bunIt } from 'bun:test';

export { describe, expect };

export const wait = (ms: number) => (
  new Promise((resolve) => { setTimeout(resolve, ms); })
);

const attempts = 3;
const TEST_TIMEOUT = 10000;
const RETRY_DELAY = 1000;

/**
 * Retry a flaky network-dependent test body. Replacement for vitest's `retry: 3`,
 * which bun:test does not provide. Import `it` from here instead of 'bun:test'.
 * @param {() => void | Promise<void>} fn test body
 * @param {number} timeout timeout for each attempt
 */
async function withRetry(fn: () => void | Promise<void>, timeout: number) {
  for (let i = 1; i <= attempts; i += 1) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout);
        }),
      ]);
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.warn(`retry ${i}/${attempts} failed:`, err);
      await wait(RETRY_DELAY);
    } finally {
      clearTimeout(timer);
    }
  }
}

type TestBody = () => void | Promise<void>;
type TestFn = (name: string, fn: TestBody, timeout?: number) => void;
type ItFn = TestFn & {
  skip: TestFn;
  skipIf: (condition: boolean) => TestFn;
};

const runnerTimeout = (timeout: number) => (timeout * attempts) + (RETRY_DELAY * attempts);

/** `it` with retry, mirroring the bun:test `it` methods used by this suite. */
export const it = ((name, fn, timeout = TEST_TIMEOUT) => (
  bunIt(name, () => withRetry(fn, timeout), runnerTimeout(timeout))
)) as ItFn;

it.skip = (name, fn, timeout = TEST_TIMEOUT) => (
  bunIt.skip(name, () => withRetry(fn, timeout), runnerTimeout(timeout))
);
it.skipIf = (condition) => (name, fn, timeout = TEST_TIMEOUT) => {
  bunIt.skipIf(condition)(name, () => withRetry(fn, timeout), runnerTimeout(timeout));
};

export function calculateTimeGap(periods: { time: number }[]) {
  let minTimeGap = Infinity;

  for (let i = 1; i < periods.length; i += 1) {
    minTimeGap = Math.min(
      minTimeGap,
      periods[i - 1].time - periods[i].time,
    );
  }

  return minTimeGap;
}

export default {
  wait,
  it,
  calculateTimeGap,
};