import { describe, it, expect } from '../utils';
import PineIndicator from '../../src/classes/PineIndicator';

const stub = () => new PineIndicator({
  pineId: 'X',
  pineVersion: '1',
  description: 'Description',
  shortDescription: 'Short',
  inputs: {
    in_0: {
      name: 'Length',
      inline: 'length',
      type: 'integer',
      value: 14,
      isHidden: false,
      isFake: false,
    },
    in_1: {
      name: 'Src',
      inline: 'source',
      internalID: 'src',
      type: 'text',
      value: 'close',
      isHidden: false,
      isFake: false,
      options: ['open', 'close'],
    },
  },
  plots: { plot_0: 'Value' },
  script: 'script',
});

describe('PineIndicator', () => {
  it('preserves getters and indicator type', () => {
    const indicator = stub();
    expect([
      indicator.pineId, indicator.pineVersion, indicator.description,
      indicator.shortDescription, indicator.plots, indicator.script, indicator.type,
    ]).toEqual([
      'X', '1', 'Description', 'Short', { plot_0: 'Value' }, 'script',
      'Script@tv-scripting-101!',
    ]);
    indicator.setType('StrategyScript@tv-scripting-101!');
    expect(indicator.type).toBe('StrategyScript@tv-scripting-101!');
  });

  it('sets options by numeric id, direct id, inline name, and internal id', () => {
    const indicator = stub();
    indicator.setOption(0, 20);
    indicator.setOption('in_0', 21);
    indicator.setOption('source', 'open');
    indicator.setOption('src', 'close');
    expect(indicator.inputs.in_0.value).toBe(21);
    expect(indicator.inputs.in_1.value).toBe('close');
  });

  it('throws exact type-mismatch message', () => {
    expect(() => stub().setOption(0, 'not-number')).toThrow(
      "Input 'Length' (in_0) must be a Number !",
    );
  });

  it('throws exact options message', () => {
    expect(() => stub().setOption(1, 'invalid')).toThrow(
      "Input 'Src' (in_1) must be one of these values:",
    );
  });

  it('throws exact not-found message', () => {
    expect(() => stub().setOption('nope', 1)).toThrow(
      "Input 'nope' not found (undefined).",
    );
  });
});
