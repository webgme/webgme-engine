/*eslint-env node*/
/*eslint no-console: 0*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

var env = process.env.NODE_ENV || 'default',
    configFilename = __dirname + '/config.' + env + '.js',
    config = require(configFilename),
    validateConfig = require(__dirname + '/validator').validateConfig,
    overrideFromEnv = require('./overridefromenv');

console.info('Using configuration from ' + configFilename);
overrideFromEnv(config);
validateConfig(config);

module.exports = config;


