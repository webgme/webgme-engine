/*eslint-env node*/
/*eslint no-console: 0*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */
'use strict';

var configFileName;
const fs = require('fs');

function warnDeprecated(name, value, hint) {
    if (typeof value !== 'undefined') {
        if (hint) {
            console.warn('WARNING! Deprecated configuration key', name + '.', hint);
        } else {
            console.warn('WARNING! Deprecated configuration key', name);
        }
    }
}

function throwValidationError(name, msg) {
    let prefix;
    if (configFileName) {
        prefix = 'In ' + configFileName;
    } else {
        prefix = 'In configuration';
    }
    prefix += ': ' + name + ' ';
    throw new Error(prefix + msg);
}

function throwTypeMiss(name, value, typeStr) {
    const msg = 'must be a(n) ' + typeStr + '. Got: "' + value + '".';
    throwValidationError(name, msg);
}

function assertTypeOf(name, value, type, orFalsy) {
    if (orFalsy && !value) {
        return;
    }
    if (typeof value !== type) {
        throwTypeMiss(name, value, type);
    }
}

function assertObject(name, value, orFalsy) {
    assertTypeOf(name, value, 'object', orFalsy);
}

function assertString(name, value, orFalsy) {
    assertTypeOf(name, value, 'string', orFalsy);
}

function assertNumber(name, value, orFalsy) {
    assertTypeOf(name, value, 'number', orFalsy);
}

function assertBoolean(name, value, orFalsy) {
    assertTypeOf(name, value, 'boolean', orFalsy);
}

function assertArray(name, value) {
    if (value instanceof Array === false) {
        throwTypeMiss(name, value, 'array');
    }
}

function assertEnum(name, value) {
    var validValues = Array.prototype.slice.call(arguments).splice(2),
        msg;

    if (validValues.indexOf(value) === -1) {
        if (configFileName) {
            msg = 'In ' + configFileName;
        } else {
            msg = 'In configuration';
        }
        msg += ': ' + name + ' must be one of: ' + validValues.toString() + '. Got: "' + value + '".';
        throw new Error(msg);
    }
}

function assertBooleanOrString(name, value, orFalsy) {
    try {
        assertTypeOf(name, value, 'boolean', orFalsy);
    } catch (e) {
        assertTypeOf(name, value, 'string', orFalsy);
    }
}

function assertFileExists(name, path) {
    try {
        fs.statSync(path);
    } catch (err) {
        throwValidationError(
            name,
            'must be a path to an existing file. Got: ' + path
        );
    }
}

// We will fail as early as possible
function validateConfig(configOrFileName) {
    var expectedKeys = [],
        mountPoints = {},
        mountPoint,
        config,
        errMsg,
        key;

    if (typeof configOrFileName === 'string') {
        configFileName = configOrFileName;
        config = require(configFileName);
    } else {
        config = configOrFileName;
    }

    assertObject('config', config);

    // addOn
    expectedKeys.push('addOn');
    assertObject('config.addOn', config.addOn);
    assertBoolean('config.addOn.enable', config.addOn.enable);
    assertArray('config.addOn.basePaths', config.addOn.basePaths);

    // authentication
    expectedKeys.push('authentication');
    assertObject('config.authentication', config.authentication);
    assertBoolean('config.authentication.enable', config.authentication.enable);
    assertBoolean('config.authentication.allowGuests', config.authentication.allowGuests);
    assertBooleanOrString('config.authentication.allowUserRegistration', config.authentication.allowUserRegistration);
    assertBoolean('config.authentication.registeredUsersCanCreate', config.authentication.registeredUsersCanCreate);
    assertBoolean('config.authentication.inferredUsersCanCreate', config.authentication.inferredUsersCanCreate);
    assertBoolean('config.authentication.newUserNeedsVerification', config.authentication.newUserNeedsVerification);
    assertBoolean('config.authentication.guestCanCreate', config.authentication.guestCanCreate);
    assertString('config.authentication.guestAccount', config.authentication.guestAccount);
    assertString('config.authentication.logOutUrl', config.authentication.logOutUrl);
    assertNumber('config.authentication.salts', config.authentication.salts);
    assertObject('config.authentication.jwt', config.authentication.jwt);
    assertNumber('config.authentication.jwt.expiresIn', config.authentication.jwt.expiresIn);
    assertString('config.authentication.jwt.privateKey', config.authentication.jwt.privateKey);
    assertString('config.authentication.jwt.publicKey', config.authentication.jwt.publicKey);
    assertArray('config.authentication.publicOrganizations', config.authentication.publicOrganizations);
    config.authentication.publicOrganizations.forEach(function (publicOrg, idx) {
        assertString('config.authentication.publicOrganizations[' + idx, ']', publicOrg);
    });
    assertObject('config.authentication.encryption', config.authentication.encryption);
    assertString('config.authentication.encryption.algorithm', config.authentication.encryption.algorithm);
    assertFileExists('config.authentication.encryption.key', config.authentication.encryption.key);
    key = fs.readFileSync(config.authentication.encryption.key);
    if (key.length !== 32) {
        throwValidationError(
            'config.authentication.encryption.key',
            'must be 32 bytes. Got: ' + key.length + ' bytes'
        );
    }
    assertBoolean('config.authentication.allowPasswordReset', config.authentication.allowPasswordReset);
    assertNumber('config.authentication.allowedResetInterval', config.authentication.allowedResetInterval);
    assertNumber('config.authentication.resetTimeout', config.authentication.resetTimeout);

    if (config.authentication.adminAccount) {
        assertString('config.authentication.adminAccount', config.authentication.adminAccount);
    }

    // bin scripts
    expectedKeys.push('bin');
    assertObject('config.bin', config.bin);
    assertObject('config.bin.log', config.bin.log);

    // blob
    expectedKeys.push('blob');
    assertObject('config.blob', config.blob);
    assertNumber('config.blob.compressionLevel', config.blob.compressionLevel);

    if (config.blob.compressionLevel < 0 || config.blob.compressionLevel > 9) {
        throw new Error('config.blob.compressionLevel must be an integer between 0 and 9. Got: ' +
            config.blob.compressionLevel);
    }

    assertString('config.blob.type', config.blob.type);
    assertString('config.blob.fsDir', config.blob.fsDir);
    assertObject('config.blob.s3', config.blob.s3);

    // client
    expectedKeys.push('client');
    assertObject('config.client', config.client);
    assertString('config.client.appDir', config.client.appDir);
    assertString('config.client.appVersion', config.client.appVersion);
    assertString('config.client.faviconPath', config.client.faviconPath);
    assertString('config.client.pageTitle', config.client.pageTitle, true);
    assertObject('config.client.log', config.client.log);
    assertString('config.client.log.level', config.client.log.level);

    // core
    expectedKeys.push('core');
    assertBoolean('config.core.enableCustomConstraints', config.core.enableCustomConstraints);
    assertNumber('config.core.overlayShardSize', config.core.overlayShardSize);
    if (config.core.overlayShardSize < 1000) {
        throw new Error('Overlay shard size must be at least 1000.');
    }

    // debug
    expectedKeys.push('debug');
    assertBoolean('config.debug', config.debug);

    expectedKeys.push('documentEditing');
    assertObject('config.documentEditing', config.documentEditing);
    assertBoolean('config.documentEditing.enable', config.documentEditing.enable, true);
    assertNumber('config.documentEditing.disconnectTimeout', config.documentEditing.disconnectTimeout);

    // executor
    expectedKeys.push('executor');
    assertObject('config.executor', config.executor);
    assertBoolean('config.executor.enable', config.executor.enable);
    assertBoolean('config.executor.authentication.enable', config.executor.authentication.enable);
    assertBoolean('config.executor.authentication.allowGuests', config.executor.authentication.allowGuests);
    assertString('config.executor.nonce', config.executor.nonce, true);
    warnDeprecated('config.executor.outputDir', config.executor.outputDir);
    assertString('config.executor.labelJobs', config.executor.labelJobs);
    assertNumber('config.executor.workerRefreshInterval', config.executor.workerRefreshInterval);
    assertNumber('config.executor.clearOutputTimeout', config.executor.clearOutputTimeout);
    assertBoolean('config.executor.clearOldDataAtStartUp', config.executor.clearOldDataAtStartUp);

    //mailer
    expectedKeys.push('mailer');
    assertObject('config.mailer', config.mailer);
    assertBoolean('config.mailer.enable', config.mailer.enable);
    assertBoolean('config.mailer.secure', config.mailer.secure);
    assertString('config.mailer.service', config.mailer.service);
    assertString('config.mailer.host', config.mailer.host);
    assertString('config.mailer.user', config.mailer.user);
    assertString('config.mailer.pwd', config.mailer.pwd);
    assertNumber('config.mailer.port', config.mailer.port);
    assertBoolean('config.mailer.sendPasswordReset', config.mailer.sendPasswordReset);
    // mongo configuration
    expectedKeys.push('mongo');
    assertObject('config.mongo', config.mongo);
    assertString('config.mongo.uri', config.mongo.uri);
    assertObject('config.mongo.options', config.mongo.options);

    // plugin
    expectedKeys.push('plugin');
    assertObject('config.plugin', config.plugin);
    assertBoolean('config.plugin.allowServerExecution', config.plugin.allowServerExecution);
    assertArray('config.plugin.basePaths', config.plugin.basePaths);
    assertBoolean('config.plugin.displayAll', config.plugin.displayAll);

    // requirejsPaths
    expectedKeys.push('requirejsPaths');
    assertObject('config.requirejsPaths', config.requirejsPaths);

    // rest
    expectedKeys.push('rest');
    assertObject('config.rest', config.rest);
    assertObject('config.rest.components', config.rest.components);

    for (key in config.rest.components) {
        if (typeof config.rest.components[key] === 'string') {
            mountPoint = key;
            // TODO: Add this warn when the cli tool has been updated.
            // console.warn('config.rest.components[' + key + '] is a string a not an object. ' +
            // 'It is recommended to change to the format described in #xxxx');
        } else {
            assertObject('config.rest.components[' + key + ']', config.rest.components[key]);
            assertString('config.rest.components[' + key + '].mount', config.rest.components[key].mount);
            assertString('config.rest.components[' + key + '].src', config.rest.components[key].src);
            assertObject('config.rest.components[' + key + '].options', config.rest.components[key].options, true);
            mountPoint = config.rest.components[key].mount;
        }

        if (mountPoints[mountPoint] === true) {
            throw new Error('Same mount point [' + mountPoint + '] specified more than once ' +
                'in config.rest.components.');
        } else {
            mountPoints[mountPoint] = true;
        }
    }

    //seedProjects
    expectedKeys.push('seedProjects');
    assertBoolean('config.seedProjects.enable', config.seedProjects.enable);
    assertString('config.seedProjects.defaultProject', config.seedProjects.defaultProject);
    assertArray('config.seedProjects.basePaths', config.seedProjects.basePaths);
    assertArray('config.seedProjects.createAtStartup', config.seedProjects.createAtStartup);
    config.seedProjects.createAtStartup.forEach(function (seedInfo, index) {
        assertObject('config.seedProjects.createAtStartup[' + index + ']', config.seedProjects.createAtStartup[index]);
        assertString('config.seedProjects.createAtStartup[' + index + '].seedId',
            config.seedProjects.createAtStartup[index].seedId);
        assertString('config.seedProjects.createAtStartup[' + index + '].projectName', seedInfo.projectName);
        assertObject('config.seedProjects.createAtStartup[' + index + '].rights', seedInfo.rights, true);
        if (seedInfo.creatorId) {
            assertString('config.seedProjects.createAtStartup[' + index + '].creatorId', seedInfo.creatorId);
        } else if (typeof config.authentication.adminAccount !== 'string') {
            throw new Error('Either config.seedProjects.createAtStartup[' + index +
                '].creatorId or config.authentication.adminAccount should exists!');
        }

        assertString('config.seedProjects.createAtStartup[' + index + '].ownerId', seedInfo.ownerId, true);
    });

    // server configuration
    expectedKeys.push('server');
    assertObject('config.server', config.server);
    assertNumber('config.server.port', config.server.port);
    assertNumber('config.server.timeout', config.server.timeout);
    assertObject('config.server.handle', config.server.handle);
    assertObject('config.server.workerManager', config.server.workerManager);
    assertString('config.server.workerManager.path', config.server.workerManager.path);
    assertObject('config.server.workerManager.options', config.server.workerManager.options);
    assertNumber('config.server.maxWorkers', config.server.maxWorkers);
    warnDeprecated('config.server.sessionStore', config.server.sessionStore,
        'JWTokens are used for authentication, see config.authentication.jwt');

    // server log
    assertObject('config.server.log', config.server.log);
    assertArray('config.server.log.transports', config.server.log.transports);
    // server extlib
    assertArray('config.server.extlibExcludes', config.server.extlibExcludes);
    // server bodyParser config
    assertObject('config.server.bodyParser', config.server.bodyParser);
    assertObject('config.server.bodyParser.json', config.server.bodyParser.json);

    // socketIO
    expectedKeys.push('socketIO');
    assertObject('config.socketIO', config.socketIO);
    assertObject('config.socketIO.clientOptions', config.socketIO.clientOptions);
    assertObject('config.socketIO.serverOptions', config.socketIO.serverOptions);
    assertObject('config.socketIO.adapter', config.socketIO.adapter);
    assertEnum('config.socketIO.adapter.type', config.socketIO.adapter.type.toLowerCase(), 'memory', 'redis');

    // storage
    expectedKeys.push('storage');
    assertObject('config.storage', config.storage);
    assertBoolean('config.storage.broadcastProjectEvents', config.storage.broadcastProjectEvents);
    warnDeprecated('config.storage.emitCommittedCoreObjects', config.storage.emitCommittedCoreObjects,
        'see new config at config.storage.maxEmittedCoreObjects');
    assertNumber('config.storage.maxEmittedCoreObjects', config.storage.maxEmittedCoreObjects);
    warnDeprecated('config.storage.patchRootCommunicationEnabled', config.storage.patchRootCommunicationEnabled,
        'Since 1.7.0 all node changes are transmitted as patch objects (unless newly created).');
    assertNumber('config.storage.cache', config.storage.cache);
    assertNumber('config.storage.loadBucketSize', config.storage.loadBucketSize);
    assertNumber('config.storage.loadBucketTimer', config.storage.loadBucketTimer);
    assertEnum('config.storage.keyType', config.storage.keyType, 'rand160Bits', 'ZSSHA', 'plainSHA1', 'rustSHA1');
    assertObject('config.storage.database', config.storage.database);
    assertEnum('config.storage.database.type', config.storage.database.type.toLowerCase(), 'mongo', 'redis', 'memory');
    assertObject('config.storage.database.options', config.storage.database.options);
    assertBoolean('config.storage.disableHashChecks', config.storage.disableHashChecks);
    assertBoolean('config.storage.requireHashesToMatch', config.storage.requireHashesToMatch);
    if (config.storage.disableHashChecks && config.storage.requireHashesToMatch) {
        throw new Error('Cannot set config.storage.disableHashChecks and requireHashesToMatch ' +
            'to true at the same time!');
    }

    //visualization
    expectedKeys.push('visualization');
    assertObject('config.visualization', config.visualization);
    assertArray('config.visualization.decoratorPaths', config.visualization.decoratorPaths);
    assertArray('config.visualization.svgDirs', config.visualization.svgDirs);
    assertArray('config.visualization.panelPaths', config.visualization.panelPaths);
    assertArray('config.visualization.visualizerDescriptors', config.visualization.visualizerDescriptors);
    assertObject('config.visualization.layout', config.visualization.layout);
    assertArray('config.visualization.layout.basePaths', config.visualization.layout.basePaths);

    //webhooks
    expectedKeys.push('webhooks');
    assertBoolean('config.webhooks.enable', config.webhooks.enable);
    assertEnum('config.webhooks.manager', config.webhooks.manager.toLowerCase(), 'memory', 'redis');
    if (config.webhooks.manager.toLowerCase() === 'redis' && config.socketIO.adapter.type.toLowerCase() !== 'redis') {
        throw new Error('config.webhooks.manager can only be ' +
            '\'redis\' if config.socketIO.adapter.type is \'redis\' as well');
    }

    if (Object.keys(config).length !== expectedKeys.length) {
        errMsg = 'Configuration had unexpected key(s):';
        for (key in config) {
            if (expectedKeys.indexOf(key) < 0) {
                errMsg += ' "' + key + '"';
            }
        }
        throw new Error(errMsg);
    }

    return config;
}

module.exports = {
    warnDeprecated: warnDeprecated,
    assertObject: assertObject,
    assertString: assertString,
    assertNumber: assertNumber,
    assertBoolean: assertBoolean,
    assertArray: assertArray,
    assertEnum: assertEnum,
    assertBooleanOrString: assertBooleanOrString,

    validateConfig: validateConfig
};
