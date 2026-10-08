import { describe, it, expect } from '../utils';
import { createFakeTransport } from '../fake-transport';
import BuiltInIndicator from '../../src/classes/BuiltInIndicator';

const Client = require('../../src/client').default;

const invalidIndicatorMessage = "Indicator argument must be an instance of PineIndicator or BuiltInIndicator.\n      Please use 'TradingView.getIndicator(...)' function.";

describe('ChartStudy validation', () => {
  it('keeps the constructor error byte-identical', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();
    const chart = new client.Session.Chart();
    expect(() => new chart.Study({} as BuiltInIndicator)).toThrow(invalidIndicatorMessage);
  });

  it('keeps setIndicator error byte-identical', () => {
    const fake = createFakeTransport();
    const client = new Client({ transport: fake.factory });
    fake.open();
    const chart = new client.Session.Chart();
    const study = new chart.Study(new BuiltInIndicator('Volume@tv-basicstudies-241'));
    expect(() => study.setIndicator({} as BuiltInIndicator)).toThrow(invalidIndicatorMessage);
  });
});
