/*eslint-env node*/
/**
 * Strips away sensitive data from gmeConfig, use before sending it to the client.
 * @author pmeijer / https://github.com/pmeijer
 */

function getClientConfig(gmeConfig) {
    'use strict';
    var clientConfig = JSON.parse(JSON.stringify(gmeConfig)),
        key;

    delete clientConfig.server;
    clientConfig.server = {port: gmeConfig.server.port}; // This is only needed for the karma tests.
    
    delete clientConfig.webhooks;
    clientConfig.webhooks = {enable: gmeConfig.webhooks.enable};

    delete clientConfig.authentication.jwt.expiresIn;
    delete clientConfig.authentication.jwt.renewBeforeExpires;
    delete clientConfig.authentication.jwt.privateKey;
    delete clientConfig.authentication.jwt.publicKey;
    delete clientConfig.authentication.jwt.tokenGenerator;
    delete clientConfig.authentication.salts;
    delete clientConfig.authentication.authorizer;
    delete clientConfig.authentication.adminAccount;
    delete clientConfig.authentication.allowedResetInterval;
    delete clientConfig.authentication.resetTimeout;
    delete clientConfig.authentication.resetUrl;
    delete clientConfig.authentication.azureActiveDirectory;

    delete clientConfig.executor.nonce;
    delete clientConfig.mailer;
    delete clientConfig.mongo;
    delete clientConfig.blob;
    delete clientConfig.bin;
    delete clientConfig.socketIO.serverOptions;
    delete clientConfig.socketIO.adapter;
    delete clientConfig.storage.database;

    clientConfig.rest = {components: {}};

    for (key in gmeConfig.rest.components) {
        if (typeof gmeConfig.rest.components[key] === 'string') {
            clientConfig.rest.components[key] = {
                mount: key
            };
        } else {
            clientConfig.rest.components[key] = {
                mount: gmeConfig.rest.components[key].mount
            };
        }
    }

    clientConfig.storage.cache = clientConfig.storage.clientCacheSize;

    return clientConfig;
}

module.exports = getClientConfig;
