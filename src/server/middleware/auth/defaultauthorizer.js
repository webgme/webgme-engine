/*globals*/
/*eslint-env node*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */
'use strict';

var AuthorizerBase = require('./authorizerbase'),
    GME_AUTH_CONSTANTS = require('./constants'),
    Q = require('q');

function DefaultAuthorizer(mainLogger, gmeConfig) {
    var self = this;

    self.collection = null;

    AuthorizerBase.call(self, mainLogger, gmeConfig);

    function _getProjection(/*args*/) {
        var ret = {},
            i;
        for (i = 0; i < arguments.length; i += 1) {
            ret[arguments[i]] = 1;
        }
        return ret;
    }

    function getProjectAuthorizationByUserOrOrgId(userId, projectId, callback) {
        var ops = ['read', 'write', 'delete'];
        return self.collection.findOne({
            _id: userId,
            disabled: { $ne: true }
        }, _getProjection('siteAdmin', 'orgs', 'projects.' + projectId))
            .then(function (userData) {
                if (!userData) {
                    return Q.reject(new Error('no such user [' + userId + ']'));
                }

                if (userData.siteAdmin) {
                    return Q.resolve({read: true, write: true, delete: true});
                }

                userData.orgs = userData.orgs || [];

                var user = userData.projects[projectId] || {};

                return Q.all(ops.map(function (op) {
                    // Check if the user is in any org that has project access. 
                    var query;
                    if ((userData.projects[projectId] || {})[op]) {
                        return 1; // user has the right
                    }

                    if (userData.orgs.length === 0) {
                        return 0; // no orgs to check
                    }

                    query = { _id: { $in: userData.orgs }, disabled: { $ne: true } };
                    query['projects.' + projectId + '.' + op] = true;
                    return self.collection.findOne(query, { _id: 1 });
                })).then(function (rwd) {
                    var ret = {};
                    ops.forEach(function (op, i) {
                        ret[op] = (user[op] || rwd[i]) ? true : false;
                    });
                    return Q.resolve(ret);
                });
            })
            .nodeify(callback);
    }

    function removeProjectRightsForAll(projectId, callback) {
        var update = { $unset: {} };
        update.$unset['projects.' + projectId] = '';
        return self.collection.updateMany({}, update)
            .then(function (result) {
                return Q.resolve(result).nodeify(callback);
            })
            .catch(function (err) {
                return Q.reject(err).nodeify(callback);
            });
    }

    /**
     *
     * @param userId {string}
     * @param callback
     * @returns {*}
     */
    function getUser(userId, callback) {
        return self.collection.findOne({
            _id: userId,
            type: { $ne: GME_AUTH_CONSTANTS.ORGANIZATION },
            disabled: { $ne: true }
        })
            .then(function (userData) {
                if (!userData) {
                    return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
                }

                delete userData.passwordHash;
                userData.data = userData.data || {};
                userData.settings = userData.settings || {};

                return Q.resolve(userData).nodeify(callback);
            })
            .catch(function (err) {
                return Q.reject(err).nodeify(callback);
            });
    }

    function getAdminsInOrganization(orgId, callback) {
        return self.collection.findOne({ _id: orgId, type: GME_AUTH_CONSTANTS.ORGANIZATION, disabled: { $ne: true } },
            { admins: 1 })
            .then(function (org) {
                if (!org) {
                    return Q.reject(new Error('no such organization [' + orgId + ']')).nodeify(callback);
                }
                return Q.resolve(org.admins).nodeify(callback);
            })
            .catch(function (err) {
                return Q.reject(err).nodeify(callback);
            });
    }

    /**
     *
     * @param userOrOrgId {string}
     * @param projectId {string}
     * @param type {string} 'set', 'delete'
     * @param rights {object} {read: true, write: true, delete: true}
     * @param callback
     * @returns {*}
     */
    function authorizeByUserOrOrgId(userOrOrgId, projectId, type, rights, callback) {
        var update;

        if (type === 'set') {
            update = { $set: {} };
            update.$set['projects.' + projectId] = rights;
        } else if (type === 'delete') {
            update = { $unset: {} };
            update.$unset['projects.' + projectId] = '';
        } else {
            return Q.reject(new Error('unknown type ' + type))
                .nodeify(callback);
        }

        return self.collection.updateOne({ _id: userOrOrgId, disabled: { $ne: true } }, update)
            .then(function (result) {
                if (result.matchedCount !== 1) {
                    throw new Error('no such user or org [' + userOrOrgId + ']');
                }
                return Q.resolve().nodeify(callback);
            })
            .catch(function (err) {
                return Q.reject(err).nodeify(callback);
            });
    }

    this.getAccessRights = function (userId, entityId, params, callback) {
        if (params.entityType === AuthorizerBase.ENTITY_TYPES.PROJECT) {
            return getProjectAuthorizationByUserOrOrgId(userId, entityId, callback);
        } else if (params.entityType === AuthorizerBase.ENTITY_TYPES.USER) {
            return getUser(userId)
                .then(function (user) {
                    const readOnly = { read: true, write: false, delete: false };
                    const readWrite = { read: true, write: true, delete: false };

                    if (user.siteAdmin) {
                        return { read: true, write: true, delete: true };
                    }

                    if (!user.canCreate) {
                        return readOnly;
                    }

                    if (userId === entityId) {
                        return readWrite;
                    }

                    return getAdminsInOrganization(entityId)
                        .then(function (admins) {
                            if (admins.indexOf(userId) > -1) {
                                return readWrite;
                            }

                            return readOnly;
                        });
                })
                .nodeify(callback);
        }
    };

    this.setAccessRights = function (userId, entityId, rights, params, callback) {
        var revoke = rights.read === false && rights.write === false && rights.delete === false;
        if (params.entityType === AuthorizerBase.ENTITY_TYPES.PROJECT) {
            if (userId === true) {
                return removeProjectRightsForAll(entityId, callback);
            } else if (revoke) {
                return authorizeByUserOrOrgId(userId, entityId, 'delete', callback);
            } else {
                return authorizeByUserOrOrgId(userId, entityId, 'set', rights, callback);
            }
        } else {
            throw new Error('Only ENTITY_TYPES.PROJECT allowed when setting access rights!');
        }
    };

    this.start = function (params, callback) {
        var deferred = Q.defer();

        self.collection = params.collection;

        deferred.resolve();

        return deferred.promise.nodeify(callback);
    };
}

DefaultAuthorizer.prototype = Object.create(AuthorizerBase.prototype);
DefaultAuthorizer.prototype.constructor = DefaultAuthorizer;

module.exports = DefaultAuthorizer;