/*eslint-env node*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

var path = require('path'),
    config = require('./config.default');

config.server.port = 42024;

config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme_tests';
config.mongo.options.poolSize = 2; // 5 is the default

config.blob.fsDir = './test-tmp/blob-storage';

config.executor.workerRefreshInterval = 100;
config.executor.clearOldDataAtStartUp = true;

config.authentication.salts = 1;

//FIXME: Have a common dir for this..
config.plugin.basePaths.push(path.join(__dirname, '../test/plugin/scenarios/plugins'));
config.plugin.allowServerExecution = true;
config.storage.database.options = {
    //port: 6666
};

config.addOn.basePaths.push(path.join(__dirname, '../test/addon/addOns'));

config.socketIO.clientOptions.reconnection = false;

config.server.log = {
    transports: [{
        transportType: 'Console',
        options: {
            level: 'error',
            //silent: true,
            colorize: true,
            timestamp: true,
            prettyPrint: true,
            handleExceptions: true,
            depth: 2
        }
    }]
};

config.plugin.basePaths.push(path.join(__dirname, '../test-karma/assets/plugins'));

config.rest.components.ExampleRestRouter = './middleware/ExampleRestRouter';

module.exports = config;
