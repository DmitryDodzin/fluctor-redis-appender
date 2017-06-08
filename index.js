
const package = require('./package.json');

const METADATA = {
  NAME: 'redis',
  VERSION: package.version,
  API_VERSION: 1,
  SUPPORT: 0x00000111
};

const appender = require('./lib/appender');

module.exports = {
  METADATA,
  appender
};