const assert = require('node:assert/strict');

const pineOptions = {
  pineId: 'id', pineVersion: 'last', description: 'description',
  shortDescription: 'short', inputs: {}, plots: {}, script: '',
};

function checkMembers(instance, methods, getters = []) {
  for (const name of methods) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(instance), name);
    assert.equal(typeof descriptor?.value, 'function', name);
  }
  for (const name of getters) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(instance), name);
    assert.equal(typeof descriptor?.get, 'function', name);
  }
}

function checkShape(instance, ownFields, arities) {
  assert.deepEqual(Object.keys(instance).sort(), ownFields.sort());
  for (const [name, arity] of Object.entries(arities)) {
    assert.equal(instance[name].length, arity, name);
  }
}

module.exports = function checkApi(mod) {
  assert.deepEqual(Object.keys(mod).sort(), [
    'BuiltInIndicator', 'Client', 'PineIndicator', 'PinePermManager', 'default',
    'getChartToken', 'getDrawings', 'getIndicator', 'getPrivateIndicators',
    'getTA', 'getUser', 'loginUser', 'searchIndicator', 'searchMarket',
    'searchMarketV3',
  ].sort());
  for (const name of Object.keys(mod)) {
    if (name !== 'default') assert.equal(mod.default[name], mod[name], name);
  }
  const httpArities = {
    getTA: 1, searchMarket: 1, searchMarketV3: 1, searchIndicator: 0,
    getIndicator: 1, loginUser: 2, getUser: 1, getPrivateIndicators: 1,
    getChartToken: 1, getDrawings: 1,
  };
  for (const [name, arity] of Object.entries(httpArities)) {
    assert.equal(typeof mod[name], 'function', name);
    assert.equal(mod[name].length, arity, name);
  }
  const client = new mod.Client({ transport: () => ({
    send() {}, close() {}, get state() { return 'closed'; },
  }) });
  checkMembers(client, [
    'onConnected', 'onDisconnected', 'onLogged', 'onPing', 'onData',
    'onError', 'onEvent', 'send', 'sendQueue', 'end',
  ], ['isLogged', 'isOpen']);
  checkShape(client, ['Session'], { send: 1, sendQueue: 0, end: 0 });

  const pine = new mod.PineIndicator(pineOptions);
  checkMembers(pine, ['setType', 'setOption'], [
    'pineId', 'pineVersion', 'description', 'shortDescription',
    'inputs', 'plots', 'type', 'script',
  ]);
  checkShape(pine, [], { setType: 0, setOption: 2 });
  assert.equal(pine.type, 'Script@tv-scripting-101!');
  const builtIn = new mod.BuiltInIndicator('Volume@tv-basicstudies-241');
  checkMembers(builtIn, ['setOption'], ['type', 'options']);
  checkShape(builtIn, [], { setOption: 2 });
  assert.equal(builtIn.options.col_prev_close, false);
  const manager = new mod.PinePermManager('session', 'signature', 'pineId');
  checkMembers(manager, ['getUsers', 'addUser', 'modifyExpiration', 'removeUser']);
  checkShape(manager, ['sessionId', 'signature', 'pineId'], {
    getUsers: 0, addUser: 1, modifyExpiration: 1, removeUser: 1,
  });

  const quote = new client.Session.Quote();
  checkMembers(quote, ['delete']);
  checkShape(quote, ['Market'], { delete: 0 });
  const market = new quote.Market('BTCEUR');
  checkMembers(market, ['onLoaded', 'onData', 'onEvent', 'onError', 'close']);
  checkShape(market, [], { close: 0 });
  const chart = new client.Session.Chart();
  checkMembers(chart, [
    'setSeries', 'setMarket', 'setTimezone', 'fetchMore', 'replayStep',
    'replayStart', 'replayStop', 'onSymbolLoaded', 'onUpdate',
    'onReplayLoaded', 'onReplayResolution', 'onReplayEnd',
    'onReplayPoint', 'onError', 'delete',
  ], ['periods', 'infos']);
  checkShape(chart, ['Study'], {
    setSeries: 0, setMarket: 1, setTimezone: 1, fetchMore: 0,
    replayStep: 0, replayStart: 0, replayStop: 0, delete: 0,
  });
  const study = new chart.Study(pine);
  checkMembers(study, ['setIndicator', 'onReady', 'onUpdate', 'onError', 'remove'], [
    'periods', 'graphic', 'strategyReport',
  ]);
  checkShape(study, ['instance'], { setIndicator: 1, remove: 0 });
  assert.throws(() => study.setIndicator({}), {
    message: "Indicator argument must be an instance of PineIndicator or BuiltInIndicator.\n      Please use 'TradingView.getIndicator(...)' function.",
  });
  study.setIndicator(builtIn);
  study.remove();
  market.close();
  quote.delete();
  chart.delete();
  return true;
};
