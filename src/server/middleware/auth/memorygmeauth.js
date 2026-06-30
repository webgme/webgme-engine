/*globals requireJS*/
/*eslint-env node*/

/**
 * In-memory GMEAuth implementation for auth-disabled / local deployments (no MongoDB).
 * @module Server:MemoryGMEAuth
 */
'use strict';

var Q = require('q'),
    UTIL = requireJS('common/util/util'),
    EventDispatcher = requireJS('common/EventDispatcher'),
    Logger = require('../../logger'),
    CONSTANTS = require('./constants'),
    MemoryMetadataStorage = require('./memorymetadatastorage'),
    MemoryAuthorizer = require('./memoryauthorizer'),
    MemoryMongoFacade = require('./memorymongofacade');

var MEMORY_TOKEN_PREFIX = 'memory-token:';

function MemoryGMEAuth(session, gmeConfig) {
    'use strict';

    if (gmeConfig.authentication.enable === true) {
        throw new Error(
            'MemoryGMEAuth is only for auth-disabled local deployments ' +
            '(config.authentication.enable must be false). ' +
            'Use the default MongoDB-backed GmeAuth for authenticated deployments.'
        );
    }

    var self = this,
        logger = Logger.create('gme:server:auth:memorygmeauth', gmeConfig.server.log),
        users = {},
        organizations = {},
        metadataStorage = new MemoryMetadataStorage(logger, gmeConfig),
        authorizer = new MemoryAuthorizer(logger, gmeConfig),
        mongoFacade = new MemoryMongoFacade();

    EventDispatcher.call(this);

    function _getUserRecord(userId) {
        var userData = users[userId];
        if (!userData || userData.type === CONSTANTS.ORGANIZATION || userData.disabled === true) {
            return null;
        }
        return userData;
    }

    function _cloneUser(userData) {
        var clone = JSON.parse(JSON.stringify(userData));
        delete clone.passwordHash;
        delete clone.resetHash;
        delete clone.lastReset;
        clone.data = clone.data || {};
        clone.settings = clone.settings || {};
        return clone;
    }

    function _prepareGuestAccount(callback) {
        var guestAcc = gmeConfig.authentication.guestAccount,
            canCreate = gmeConfig.authentication.guestCanCreate;

        if (_getUserRecord(guestAcc)) {
            logger.debug('Guest user exists');
        } else {
            logger.warn('User "' + guestAcc + '" was not found. We will attempt to create it automatically.');
            return addUser(guestAcc, guestAcc, guestAcc, canCreate, { overwrite: true, guestOrAdmin: true })
                .then(function () {
                    return getUser(guestAcc);
                })
                .then(function (guestAccount) {
                    logger.debug(
                        'Guest account "' + guestAccount._id + '" canCreate:',
                        guestAccount.canCreate === true
                    );
                    return guestAccount;
                })
                .nodeify(callback);
        }

        return getUser(guestAcc).nodeify(callback);
    }

    function connect(callback) {
        return _prepareGuestAccount()
            .then(function () {
                return authorizer.start({});
            })
            .then(function () {
                return metadataStorage.start({});
            })
            .then(function () {
                return mongoFacade;
            })
            .nodeify(callback);
    }

    function unload(callback) {
        return Q.all([authorizer.stop(), metadataStorage.stop()])
            .then(function () {
                users = {};
                organizations = {};
            })
            .nodeify(callback);
    }

    function authenticateUser(userId, password, callback) {
        var userData = _getUserRecord(userId);
        if (!userData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }

        if (userId === gmeConfig.authentication.guestAccount && gmeConfig.authentication.allowGuests === true) {
            return Q.resolve(userData).nodeify(callback);
        }

        if (password === userData.passwordHash || password === userData._plainPassword) {
            return Q.resolve(userData).nodeify(callback);
        }

        return Q.reject(new Error('incorrect password for user [' + userId + ']')).nodeify(callback);
    }

    function _makeMemoryToken(userId) {
        return MEMORY_TOKEN_PREFIX + userId;
    }

    function _parseMemoryToken(token) {
        if (typeof token !== 'string' || token.indexOf(MEMORY_TOKEN_PREFIX) !== 0) {
            throw new Error('Invalid memory token');
        }
        return token.substr(MEMORY_TOKEN_PREFIX.length);
    }

    function generateJWToken(userId, password, callback) {
        return authenticateUser(userId, password)
            .then(function () {
                return _makeMemoryToken(userId);
            })
            .nodeify(callback);
    }

    function generateJWTokenForAuthenticatedUser(userId, callback) {
        if (!_getUserRecord(userId)) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        return Q.resolve(_makeMemoryToken(userId)).nodeify(callback);
    }

    function verifyJWToken(token, callback) {
        var userId = _parseMemoryToken(token);
        if (!_getUserRecord(userId)) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        return Q.resolve({
            content: { userId: userId },
            renew: false
        }).nodeify(callback);
    }

    function regenerateJWToken(token, callback) {
        return verifyJWToken(token)
            .then(function (result) {
                return _makeMemoryToken(result.content.userId);
            })
            .nodeify(callback);
    }

    function getUser(userId, query, callback) {
        var userData;

        if (typeof query === 'function') {
            callback = query;
            query = null;
        }

        userData = _getUserRecord(userId);
        if (!userData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }

        if (query && query.disabled !== undefined && userData.disabled !== query.disabled) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }

        return Q.resolve(_cloneUser(userData)).nodeify(callback);
    }

    function listUsers(query, projection, callback) {
        var result;

        if (typeof query === 'function') {
            callback = query;
            query = null;
            projection = null;
        } else if (typeof projection === 'function') {
            callback = projection;
            projection = null;
        }

        result = Object.keys(users)
            .filter(function (id) {
                var userData = users[id];
                return userData.type !== CONSTANTS.ORGANIZATION && userData.disabled !== true;
            })
            .map(function (id) {
                return _cloneUser(users[id]);
            });

        return Q.resolve(result).nodeify(callback);
    }

    function addUser(userId, email, password, canCreate, options, callback) {
        if (typeof canCreate === 'function') {
            callback = canCreate;
            canCreate = true;
            options = {};
        } else if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        options = options || {};
        var overwrite = options.overwrite === true;

        if (users[userId] && !overwrite) {
            return Q.reject(new Error('user already exists [' + userId + ']')).nodeify(callback);
        }

        users[userId] = {
            _id: userId,
            email: email,
            passwordHash: password,
            _plainPassword: password,
            canCreate: canCreate === true,
            siteAdmin: options.siteAdmin === true,
            data: {},
            settings: {},
            orgs: [],
            disabled: false
        };

        self.dispatchEvent(CONSTANTS.USER_CREATED, { userId: userId });

        return Q.resolve().nodeify(callback);
    }

    function updateUser(userId, userData, callback) {
        var oldUserData = _getUserRecord(userId);
        if (!oldUserData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }

        oldUserData.email = userData.email || oldUserData.email;

        if (Object.hasOwn(userData, 'data')) {
            if (UTIL.isTrueObject(userData.data)) {
                oldUserData.data = userData.data;
            } else {
                return Q.reject(new Error('supplied userData.data is not an object [' + userData.data + ']'))
                    .nodeify(callback);
            }
        }

        if (Object.hasOwn(userData, 'settings')) {
            if (UTIL.isTrueObject(userData.settings)) {
                oldUserData.settings = userData.settings;
            } else {
                return Q.reject(new Error('supplied userData.settings is not an object [' + userData.settings + ']'))
                    .nodeify(callback);
            }
        }

        if (Object.hasOwn(userData, 'canCreate')) {
            oldUserData.canCreate = userData.canCreate === true;
        }

        return Q.resolve().nodeify(callback);
    }

    function updateUserDataField(userId, fields, overwrite, callback) {
        var userData = _getUserRecord(userId);
        if (!userData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        userData.data = userData.data || {};
        if (overwrite) {
            userData.data = fields;
        } else {
            Object.keys(fields).forEach(function (key) {
                userData.data[key] = fields[key];
            });
        }
        return Q.resolve(userData.data).nodeify(callback);
    }

    function setUserDataField(userId, keys, value, options, callback) {
        return updateUserDataField(userId, value, options && options.overwrite, callback);
    }

    function getUserDataField(userId, keys, callback) {
        var userData = _getUserRecord(userId);
        if (!userData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        return Q.resolve(userData.data || {}).nodeify(callback);
    }

    function deleteUserDataField(userId, keys, callback) {
        var userData = _getUserRecord(userId);
        if (!userData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        if (userData.data) {
            (keys || []).forEach(function (key) {
                delete userData.data[key];
            });
        }
        return Q.resolve().nodeify(callback);
    }

    function updateUserSettings(userId, settings, overwrite, callback) {
        var userData = _getUserRecord(userId);
        if (!userData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        if (typeof overwrite === 'function') {
            callback = overwrite;
            overwrite = false;
        }
        userData.settings = userData.settings || {};
        if (overwrite) {
            userData.settings = settings;
        } else {
            Object.keys(settings).forEach(function (key) {
                userData.settings[key] = settings[key];
            });
        }
        return Q.resolve(userData.settings).nodeify(callback);
    }

    function updateUserComponentSettings(userId, componentId, settings, overwrite, callback) {
        var userData = _getUserRecord(userId);
        if (!userData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        userData.settings = userData.settings || {};
        if (overwrite) {
            userData.settings[componentId] = settings;
        } else {
            userData.settings[componentId] = userData.settings[componentId] || {};
            Object.keys(settings).forEach(function (key) {
                userData.settings[componentId][key] = settings[key];
            });
        }
        return Q.resolve(userData.settings[componentId]).nodeify(callback);
    }

    function deleteUser(userId, force, callback) {
        if (typeof force === 'function') {
            callback = force;
            force = false;
        }

        if (!_getUserRecord(userId) && !users[userId]) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }

        if (force) {
            delete users[userId];
        } else {
            users[userId].disabled = true;
        }

        self.dispatchEvent(CONSTANTS.USER_DELETED, { userId: userId });
        return Q.resolve().nodeify(callback);
    }

    function reEnableUser(userId, callback) {
        if (!users[userId]) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        users[userId].disabled = false;
        return Q.resolve().nodeify(callback);
    }

    function resetPassword(userId, callback) {
        return Q.reject(new Error('Password reset is not supported in MemoryGMEAuth mode')).nodeify(callback);
    }

    function changePassword(userId, resetHash, newPassword, callback) {
        return Q.reject(new Error('Password reset is not supported in MemoryGMEAuth mode')).nodeify(callback);
    }

    function isValidReset(userId, resetHash, callback) {
        return Q.reject(new Error('Password reset is not supported in MemoryGMEAuth mode')).nodeify(callback);
    }

    function listOrganizations(callback) {
        return Q.resolve(Object.keys(organizations).map(function (id) {
            return organizations[id];
        })).nodeify(callback);
    }

    function getOrganization(orgId, callback) {
        if (!organizations[orgId]) {
            return Q.reject(new Error('no such organization [' + orgId + ']')).nodeify(callback);
        }
        return Q.resolve(organizations[orgId]).nodeify(callback);
    }

    function addOrganization(orgId, info, callback) {
        if (typeof info === 'function') {
            callback = info;
            info = {};
        }
        if (organizations[orgId]) {
            return Q.reject(new Error('organization already exists [' + orgId + ']')).nodeify(callback);
        }
        organizations[orgId] = {
            _id: orgId,
            type: CONSTANTS.ORGANIZATION,
            info: info || {},
            admins: [],
            disabled: false
        };
        self.dispatchEvent(CONSTANTS.ORGANIZATION_CREATED, { orgId: orgId });
        return Q.resolve().nodeify(callback);
    }

    function updateOrganizationInfo(orgId, info, callback) {
        if (!organizations[orgId]) {
            return Q.reject(new Error('no such organization [' + orgId + ']')).nodeify(callback);
        }
        organizations[orgId].info = info || organizations[orgId].info;
        return Q.resolve().nodeify(callback);
    }

    function removeOrganizationByOrgId(orgId, callback) {
        if (!organizations[orgId]) {
            return Q.reject(new Error('no such organization [' + orgId + ']')).nodeify(callback);
        }
        delete organizations[orgId];
        self.dispatchEvent(CONSTANTS.ORGANIZATION_DELETED, { orgId: orgId });
        return Q.resolve().nodeify(callback);
    }

    function reEnableOrganization(orgId, callback) {
        if (!organizations[orgId]) {
            return Q.reject(new Error('no such organization [' + orgId + ']')).nodeify(callback);
        }
        organizations[orgId].disabled = false;
        return Q.resolve().nodeify(callback);
    }

    function getAdminsInOrganization(orgId, callback) {
        if (!organizations[orgId]) {
            return Q.reject(new Error('no such organization [' + orgId + ']')).nodeify(callback);
        }
        return Q.resolve(organizations[orgId].admins || []).nodeify(callback);
    }

    function addUserToOrganization(userId, orgId, callback) {
        var org = organizations[orgId],
            userData = _getUserRecord(userId);
        if (!org || !userData) {
            return Q.reject(new Error('no such user or organization')).nodeify(callback);
        }
        userData.orgs = userData.orgs || [];
        if (userData.orgs.indexOf(orgId) === -1) {
            userData.orgs.push(orgId);
        }
        return Q.resolve().nodeify(callback);
    }

    function removeUserFromOrganization(userId, orgId, callback) {
        var userData = _getUserRecord(userId);
        if (!userData) {
            return Q.reject(new Error('no such user [' + userId + ']')).nodeify(callback);
        }
        userData.orgs = (userData.orgs || []).filter(function (id) {
            return id !== orgId;
        });
        return Q.resolve().nodeify(callback);
    }

    function setAdminForUserInOrganization(userId, orgId, isAdmin, callback) {
        var org = organizations[orgId];
        if (!org) {
            return Q.reject(new Error('no such organization [' + orgId + ']')).nodeify(callback);
        }
        org.admins = org.admins || [];
        var idx = org.admins.indexOf(userId);
        if (isAdmin && idx === -1) {
            org.admins.push(userId);
        } else if (!isAdmin && idx > -1) {
            org.admins.splice(idx, 1);
        }
        return Q.resolve().nodeify(callback);
    }

    function authorizeByUserId(userId, projectId, type, rights, callback) {
        var projectAuthParams = {
            entityType: authorizer.ENTITY_TYPES.PROJECT
        };
        logger.warn('authorizeByUserId/authorizeByUserOrOrgId are deprecated use authorizer.setAccessRights instead!');
        return authorizer.setAccessRights(userId, projectId, rights, projectAuthParams, callback);
    }

    this.unload = unload;
    this.connect = connect;

    this.listUsers = listUsers;
    this.getUser = getUser;
    this.addUser = addUser;
    this.updateUser = updateUser;
    this.updateUserDataField = updateUserDataField;
    this.setUserDataField = setUserDataField;
    this.getUserDataField = getUserDataField;
    this.deleteUserDataField = deleteUserDataField;
    this.updateUserSettings = updateUserSettings;
    this.updateUserComponentSettings = updateUserComponentSettings;
    this.deleteUser = deleteUser;
    this.reEnableUser = reEnableUser;
    this.resetPassword = resetPassword;
    this.changePassword = changePassword;
    this.isValidReset = isValidReset;

    this.listOrganizations = listOrganizations;
    this.getOrganization = getOrganization;
    this.addOrganization = addOrganization;
    this.updateOrganizationInfo = updateOrganizationInfo;
    this.deleteOrganization = this.removeOrganizationByOrgId = removeOrganizationByOrgId;
    this.reEnableOrganization = reEnableOrganization;

    this.getAdminsInOrganization = getAdminsInOrganization;
    this.addUserToOrganization = addUserToOrganization;
    this.removeUserFromOrganization = removeUserFromOrganization;
    this.setAdminForUserInOrganization = setAdminForUserInOrganization;

    this.authenticateUser = authenticateUser;
    this.generateJWToken = generateJWToken;
    this.generateJWTokenForAuthenticatedUser = generateJWTokenForAuthenticatedUser;
    this.regenerateJWToken = regenerateJWToken;
    this.verifyJWToken = verifyJWToken;

    this.metadataStorage = metadataStorage;
    this.authorizer = authorizer;

    this.CONSTANTS = CONSTANTS;

    this.authorizeByUserId = authorizeByUserId;
    this.authorizeByUserOrOrgId = authorizeByUserId;
}

MemoryGMEAuth.prototype = Object.create(EventDispatcher.prototype);
MemoryGMEAuth.prototype.constructor = MemoryGMEAuth;

module.exports = MemoryGMEAuth;
