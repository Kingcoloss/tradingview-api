export interface IndicatorInput {
  name: string;
  inline: string;
  internalID?: string;
  tooltip?: string;
  type: 'text' | 'source' | 'integer' | 'float' | 'resolution' | 'bool' | 'color';
  value: string | number | boolean;
  isHidden: boolean;
  isFake: boolean;
  options?: string[];
}

export interface Indicator {
  pineId: string;
  pineVersion: string;
  description: string;
  shortDescription: string;
  inputs: Record<string, IndicatorInput>;
  plots: Record<string, string>;
  script: string;
}

export type IndicatorType = 'Script@tv-scripting-101!'
  | 'StrategyScript@tv-scripting-101!';

export default class PineIndicator {
  #options: Indicator;

  #type: IndicatorType = 'Script@tv-scripting-101!';

  constructor(options: Indicator) {
    this.#options = options;
  }

  get pineId(): string {
    return this.#options.pineId;
  }

  get pineVersion(): string {
    return this.#options.pineVersion;
  }

  get description(): string {
    return this.#options.description;
  }

  get shortDescription(): string {
    return this.#options.shortDescription;
  }

  get inputs(): Record<string, IndicatorInput> {
    return this.#options.inputs;
  }

  get plots(): Record<string, string> {
    return this.#options.plots;
  }

  get type(): IndicatorType {
    return this.#type;
  }

  setType(type: IndicatorType = 'Script@tv-scripting-101!'): void {
    this.#type = type;
  }

  get script(): string {
    return this.#options.script;
  }

  setOption(key: number | string, value: unknown): void {
    let propI: string | undefined = '';

    if (this.#options.inputs[`in_${key}`]) propI = `in_${key}`;
    else if (this.#options.inputs[key]) propI = String(key);
    else {
      propI = Object.keys(this.#options.inputs).find((inputID) => (
        this.#options.inputs[inputID].inline === key
        || this.#options.inputs[inputID].internalID === key
      ));
    }

    if (propI && this.#options.inputs[propI]) {
      const input = this.#options.inputs[propI];

      const types: Partial<Record<IndicatorInput['type'], string>> = {
        bool: 'Boolean',
        integer: 'Number',
        float: 'Number',
        text: 'String',
      };

      // eslint-disable-next-line valid-typeof
      if (types[input.type] && typeof value !== types[input.type]?.toLowerCase()) {
        throw new Error(`Input '${input.name}' (${propI}) must be a ${types[input.type]} !`);
      }

      if (input.options && !input.options.includes(value as string)) {
        throw new Error(
          `Input '${input.name}' (${propI}) must be one of these values:`,
          input.options as unknown as globalThis.ErrorOptions,
        );
      }

      input.value = value as IndicatorInput['value'];
    } else throw new Error(`Input '${key}' not found (${propI}).`);
  }
}
