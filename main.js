const miscRequests = require('./src/miscRequests');
const Client = require('./src/client');
const BuiltInIndicator = require('./src/classes/BuiltInIndicator').default;
const PineIndicator = require('./src/classes/PineIndicator').default;
const PinePermManager = require('./src/classes/PinePermManager').default;

module.exports = { ...miscRequests };
module.exports.Client = Client;
module.exports.BuiltInIndicator = BuiltInIndicator;
module.exports.PineIndicator = PineIndicator;
module.exports.PinePermManager = PinePermManager;
