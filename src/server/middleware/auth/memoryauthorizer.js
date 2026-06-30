/*globals*/
/*eslint-env node*/

/**
 * Permissive in-memory authorizer for auth-disabled / local deployments.
 * @author webgme-engine contributors
 */
'use strict';

var AuthorizerBase = require('./authorizerbase'),
    Q = require('q');

var FULL_RIGHTS = { read: true, write: true, delete: true };

function MemoryAuthorizer(mainLogger, gmeConfig) {
    var self = this,
        projectRights = {};

    AuthorizerBase.call(self, mainLogger, gmeConfig);

    function rightsKey(userId, projectId) {
        return userId + '::' + projectId;
    }

    this.getAccessRights = function (userId, entityId, params, callback) {
        if (params.entityType === AuthorizerBase.ENTITY_TYPES.PROJECT) {
            var stored = projectRights[rightsKey(userId, entityId)];
            return Q.resolve(stored || FULL_RIGHTS).nodeify(callback);
        } else if (params.entityType === AuthorizerBase.ENTITY_TYPES.USER) {
            return Q.resolve(FULL_RIGHTS).nodeify(callback);
        }

        return Q.reject(new Error('Unknown entity type [' + params.entityType + ']')).nodeify(callback);
    };

    this.setAccessRights = function (userId, entityId, rights, params, callback) {
        if (params.entityType !== AuthorizerBase.ENTITY_TYPES.PROJECT) {
            return Q.reject(new Error('Only ENTITY_TYPES.PROJECT allowed when setting access rights!'))
                .nodeify(callback);
        }

        if (userId === true) {
            Object.keys(projectRights).forEach(function (key) {
                if (key.indexOf('::' + entityId) > -1) {
                    delete projectRights[key];
                }
            });
            return Q.resolve().nodeify(callback);
        }

        var revoke = rights.read === false && rights.write === false && rights.delete === false;
        if (revoke) {
            delete projectRights[rightsKey(userId, entityId)];
        } else {
            projectRights[rightsKey(userId, entityId)] = {
                read: !!rights.read,
                write: !!rights.write,
                delete: !!rights.delete
            };
        }

        return Q.resolve().nodeify(callback);
    };

    this.start = function (params, callback) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise.nodeify(callback);
    };

    this.stop = function (callback) {
        projectRights = {};
        return AuthorizerBase.prototype.stop.call(self, callback);
    };
}

MemoryAuthorizer.prototype = Object.create(AuthorizerBase.prototype);
MemoryAuthorizer.prototype.constructor = MemoryAuthorizer;

module.exports = MemoryAuthorizer;
