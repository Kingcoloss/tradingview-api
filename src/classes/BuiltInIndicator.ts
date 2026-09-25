export type BuiltInIndicatorType = 'Volume@tv-basicstudies-241'
  | 'VbPFixed@tv-basicstudies-241'
  | 'VbPFixed@tv-basicstudies-241!'
  | 'VbPFixed@tv-volumebyprice-53!'
  | 'VbPSessions@tv-volumebyprice-53'
  | 'VbPSessionsRough@tv-volumebyprice-53!'
  | 'VbPSessionsDetailed@tv-volumebyprice-53!'
  | 'VbPVisible@tv-volumebyprice-53';

export type BuiltInIndicatorOption = 'rowsLayout' | 'rows' | 'volume'
  | 'vaVolume' | 'subscribeRealtime' | 'first_bar_time'
  | 'first_visible_bar_time' | 'last_bar_time' | 'last_visible_bar_time'
  | 'extendPocRight';

const defaultValues: Partial<Record<BuiltInIndicatorType, Record<string, unknown>>> = {
  'Volume@tv-basicstudies-241': {
    length: 20,
    col_prev_close: false,
  },
  'VbPFixed@tv-basicstudies-241': {
    rowsLayout: 'Number Of Rows',
    rows: 24,
    volume: 'Up/Down',
    vaVolume: 70,
    subscribeRealtime: false,
    first_bar_time: NaN,
    last_bar_time: Date.now(),
    extendToRight: false,
    mapRightBoundaryToBarStartTime: true,
  },
  'VbPFixed@tv-basicstudies-241!': {
    rowsLayout: 'Number Of Rows',
    rows: 24,
    volume: 'Up/Down',
    vaVolume: 70,
    subscribeRealtime: false,
    first_bar_time: NaN,
    last_bar_time: Date.now(),
  },
  'VbPFixed@tv-volumebyprice-53!': {
    rowsLayout: 'Number Of Rows',
    rows: 24,
    volume: 'Up/Down',
    vaVolume: 70,
    subscribeRealtime: false,
    first_bar_time: NaN,
    last_bar_time: Date.now(),
  },
  'VbPSessions@tv-volumebyprice-53': {
    rowsLayout: 'Number Of Rows',
    rows: 24,
    volume: 'Up/Down',
    vaVolume: 70,
    extendPocRight: false,
  },
  'VbPSessionsRough@tv-volumebyprice-53!': {
    volume: 'Up/Down',
    vaVolume: 70,
  },
  'VbPSessionsDetailed@tv-volumebyprice-53!': {
    volume: 'Up/Down',
    vaVolume: 70,
    subscribeRealtime: false,
    first_visible_bar_time: NaN,
    last_visible_bar_time: Date.now(),
  },
  'VbPVisible@tv-volumebyprice-53': {
    rowsLayout: 'Number Of Rows',
    rows: 24,
    volume: 'Up/Down',
    vaVolume: 70,
    subscribeRealtime: false,
    first_visible_bar_time: NaN,
    last_visible_bar_time: Date.now(),
  },
};

export default class BuiltInIndicator {
  #type: BuiltInIndicatorType;

  get type(): BuiltInIndicatorType {
    return this.#type;
  }

  #options: Record<string, unknown> = {};

  get options(): Record<string, unknown> {
    return this.#options;
  }

  constructor(type: BuiltInIndicatorType | '' = '') {
    if (!type) throw new Error(`Wrong buit-in indicator type "${type}".`);

    this.#type = type;
    if (defaultValues[type]) this.#options = { ...defaultValues[type] };
  }

  setOption(key: BuiltInIndicatorOption | string, value: unknown, FORCE = false): void {
    if (FORCE) {
      this.#options[key] = value;
      return;
    }

    const defaults = defaultValues[this.#type];
    if (defaults && defaults[key] !== undefined) {
      const requiredType = typeof defaults[key];
      const valType = typeof value;
      if (requiredType !== valType) {
        throw new Error(`Wrong '${key}' value type '${valType}' (must be '${requiredType}')`);
      }
    }

    if (defaults && defaults[key] === undefined) {
      throw new Error(`Option '${key}' is denied with '${this.#type}' indicator`);
    }

    this.#options[key] = value;
  }
}
