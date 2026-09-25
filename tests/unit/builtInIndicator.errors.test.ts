import { describe, expect, it } from '../utils';
import BuiltInIndicator from '../../src/classes/BuiltInIndicator';

const TYPES = [
  'Volume@tv-basicstudies-241',
  'VbPFixed@tv-basicstudies-241',
  'VbPFixed@tv-basicstudies-241!',
  'VbPFixed@tv-volumebyprice-53!',
  'VbPSessions@tv-volumebyprice-53',
  'VbPSessionsRough@tv-volumebyprice-53!',
  'VbPSessionsDetailed@tv-volumebyprice-53!',
  'VbPVisible@tv-volumebyprice-53',
] as const;

describe('BuiltInIndicator', () => {
  it('throws exact constructor message', () => {
    expect(() => new BuiltInIndicator()).toThrow('Wrong buit-in indicator type "".');
  });

  it('preserves every default map shape and value type', () => {
    const options = TYPES.map((type) => new BuiltInIndicator(type).options);
    expect(options).toEqual([
      { length: 20, col_prev_close: false },
      {
        rowsLayout: 'Number Of Rows',
        rows: 24,
        volume: 'Up/Down',
        vaVolume: 70,
        subscribeRealtime: false,
        first_bar_time: NaN,
        last_bar_time: expect.any(Number),
        extendToRight: false,
        mapRightBoundaryToBarStartTime: true,
      },
      {
        rowsLayout: 'Number Of Rows',
        rows: 24,
        volume: 'Up/Down',
        vaVolume: 70,
        subscribeRealtime: false,
        first_bar_time: NaN,
        last_bar_time: expect.any(Number),
      },
      {
        rowsLayout: 'Number Of Rows',
        rows: 24,
        volume: 'Up/Down',
        vaVolume: 70,
        subscribeRealtime: false,
        first_bar_time: NaN,
        last_bar_time: expect.any(Number),
      },
      {
        rowsLayout: 'Number Of Rows',
        rows: 24,
        volume: 'Up/Down',
        vaVolume: 70,
        extendPocRight: false,
      },
      { volume: 'Up/Down', vaVolume: 70 },
      {
        volume: 'Up/Down',
        vaVolume: 70,
        subscribeRealtime: false,
        first_visible_bar_time: NaN,
        last_visible_bar_time: expect.any(Number),
      },
      {
        rowsLayout: 'Number Of Rows',
        rows: 24,
        volume: 'Up/Down',
        vaVolume: 70,
        subscribeRealtime: false,
        first_visible_bar_time: NaN,
        last_visible_bar_time: expect.any(Number),
      },
    ]);
  });

  it('throws exact type and denied-option messages', () => {
    const indicator = new BuiltInIndicator('Volume@tv-basicstudies-241');
    expect(() => indicator.setOption('length', '20')).toThrow(
      "Wrong 'length' value type 'string' (must be 'number')",
    );
    expect(() => indicator.setOption('rows', 24)).toThrow(
      "Option 'rows' is denied with 'Volume@tv-basicstudies-241' indicator",
    );
  });

  it('supports valid and forced options', () => {
    const indicator = new BuiltInIndicator('Volume@tv-basicstudies-241');
    indicator.setOption('length', 30);
    indicator.setOption('custom', true, true);
    expect(indicator.options).toEqual({ length: 30, col_prev_close: false, custom: true });
  });
});
