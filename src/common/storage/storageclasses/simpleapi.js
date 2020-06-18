/*globals define*/
/*eslint-env node, browser*/
/**
 * TODO: Come up with an appropriate name for this.
 * TODO: Proper implementation needed, e.g. error handling.
 *
 * Provides REST-like functionality of the database.
 *
 * @author pmeijer / https://github.com/pmeijer
 */

define(['common/storage/storageclasses/watchers'], function (StorageWatcher) {
    'use strict';

    /**
     *
     * @param webSocket
     * @param logger
     * @param gmeConfig
     * @constructor
     * @class
     */
    function StorageSimpleAPI(webSocket, logger, gmeConfig) {
        // watcher counters determining when to join/leave a room on the sever
        this.logger = this.logger || logger.fork('storage');
        StorageWatcher.call(this, webSocket, logger, gmeConfig);
        this.webSocket = webSocket;
        this.gmeConfig = gmeConfig;
        this.logger.debug('StorageSimpleAPI ctor');
    }

    StorageSimpleAPI.prototype = Object.create(StorageWatcher.prototype);
    StorageSimpleAPI.prototype.constructor = StorageSimpleAPI;

    StorageSimpleAPI.prototype.getProjects = function (options, callback) {
        this.logger.debug('invoking getProjects', {metadata: options});
        return this.webSocket.getProjects(options).nodeify(callback);
    };

    StorageSimpleAPI.prototype.getProjectInfo = function (projectId, callback) {
        var data = {
            projectId: projectId,
            branches: true,
            info: true,
            hooks: true,
            rights: true
        };

        this.logger.debug('invoking getProjectInfo', {metadata: data});
        return this.webSocket.getProjects(data)
            .then(function (result) {
                return result[0];
            })
            .nodeify(callback);
    };

    StorageSimpleAPI.prototype.getBranches = function (projectId, callback) {
        var data = {
            projectId: projectId
        };
        this.logger.debug('invoking getBranches', {metadata: data});
        return this.webSocket.getBranches(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.getCommits = function (projectId, before, number, callback) {
        var data = {
            projectId: projectId,
            before: before,
            number: number
        };
        this.logger.debug('invoking getCommits', {metadata: data});
        return this.webSocket.getCommits(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.getHistory = function (projectId, start, number, callback) {
        var data = {
            projectId: projectId,
            start: start,
            number: number
        };
        this.logger.debug('invoking getHistory', {metadata: data});
        return this.webSocket.getHistory(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.squashCommits = function (projectId, fromCommit, toCommitOrBranch, msg, callback) {
        var data = {
            projectId: projectId,
            fromCommit: fromCommit,
            toCommitOrBranch: toCommitOrBranch,
            message: msg
        };
        this.logger.debug('invoking squashCommits', {metadata: data});
        return this.webSocket.squashCommits(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.getTags = function (projectId, callback) {
        var data = {
            projectId: projectId
        };
        this.logger.debug('invoking getTags', {metadata: data});
        return this.webSocket.getTags(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.getBranchHash = function (projectId, branchName, callback) {
        var data = {
            projectId: projectId,
            branchName: branchName
        };
        this.logger.debug('invoking getBranchHash', {metadata: data});
        return this.webSocket.getBranchHash(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.getLatestCommitData = function (projectId, branchName, callback) {
        var data = {
            projectId: projectId,
            branchName: branchName
        };
        this.logger.debug('invoking getLatestCommitData', {metadata: data});
        return this.webSocket.getLatestCommitData(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.getCommonAncestorCommit = function (projectId, commitA, commitB, callback) {
        var data = {
            commitA: commitA,
            commitB: commitB,
            projectId: projectId
        };
        this.logger.debug('invoking getCommonAncestorCommit', {metadata: data});
        return this.webSocket.getCommonAncestorCommit(data).nodeify(callback);
    };

    // Setters
    StorageSimpleAPI.prototype.createProject = function (projectName, ownerId, kind, callback) {
        var data = {
            projectName: projectName
        };

        if (callback === undefined) {
            if (typeof ownerId === 'function') {
                callback = ownerId;
            } else if (typeof kind === 'function') {
                data.ownerId = ownerId;
                callback = kind;
            } else {
                data.ownerId = ownerId;
                data.kind = kind;
            }
        } else {
            data.ownerId = ownerId;
            data.kind = kind;
        }

        this.logger.debug('invoking createProject', {metadata: data});

        return this.webSocket.createProject(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.deleteProject = function (projectId, callback) {
        var data = {
            projectId: projectId
        };
        this.logger.debug('invoking deleteProject', {metadata: data});
        return this.webSocket.deleteProject(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.transferProject = function (projectId, newOwnerId, callback) {
        var data = {
            projectId: projectId,
            newOwnerId: newOwnerId
        };
        this.logger.debug('invoking transferProject', {metadata: data});
        return this.webSocket.transferProject(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.duplicateProject = function (projectId, projectName, ownerId, callback) {
        var data = {
            projectId: projectId,
            projectName: projectName,
            ownerId: ownerId
        };

        if (callback === undefined && typeof ownerId === 'function') {
            callback = ownerId;
            data.ownerId = undefined;
        }

        this.logger.debug('invoking duplicateProject', {metadata: data});
        return this.webSocket.duplicateProject(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.setBranchHash = function (projectId, branchName, newHash, oldHash, callback) {
        var data = {
            projectId: projectId,
            branchName: branchName,
            newHash: newHash,
            oldHash: oldHash
        };

        this.logger.debug('invoking setBranchHash', {metadata: data});
        return this.webSocket.setBranchHash(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.createBranch = function (projectId, branchName, newHash, callback) {
        var data = {
            projectId: projectId,
            branchName: branchName,
            newHash: newHash,
            oldHash: ''
        };

        this.logger.debug('invoking createBranch', {metadata: data});
        return this.webSocket.setBranchHash(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.deleteBranch = function (projectId, branchName, oldHash, callback) {
        var data = {
            projectId: projectId,
            branchName: branchName,
            newHash: '',
            oldHash: oldHash
        };
        this.logger.debug('invoking deleteBranch', {metadata: data});
        return this.webSocket.setBranchHash(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.createTag = function (projectId, tagName, commitHash, callback) {
        var data = {
            projectId: projectId,
            tagName: tagName,
            commitHash: commitHash
        };
        this.logger.debug('invoking createTag', {metadata: data});
        return this.webSocket.createTag(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.deleteTag = function (projectId, tagName, callback) {
        var data = {
            projectId: projectId,
            tagName: tagName
        };
        this.logger.debug('invoking deleteTag', {metadata: data});
        return this.webSocket.deleteTag(data).nodeify(callback);
    };

    //temporary simple request and result functions
    StorageSimpleAPI.prototype.simpleRequest = function (parameters, callback) {
        this.logger.debug('invoking simpleRequest', {metadata: parameters});
        return this.webSocket.simpleRequest(parameters).nodeify(callback);
    };

    StorageSimpleAPI.prototype.simpleQuery = function (workerId, parameters, callback) {
        this.logger.debug('invoking simpleQuery; workerId, parameters', workerId, {metadata: parameters});
        return this.webSocket.simpleQuery(workerId, parameters).nodeify(callback);
    };

    StorageSimpleAPI.prototype.sendNotification = function (data, callback) {
        this.logger.debug('invoking sendNotification; ', {metadata: data});
        return this.webSocket.sendNotification(data).nodeify(callback);
    };

    StorageSimpleAPI.prototype.sendWsRouterMessage = function (routerId, messageType, payload, callback) {
        this.logger.debug('invoking sendWsRouterMessage', 
            {metadata: {routerId: routerId, messageType: messageType, payload: payload}});
        return this.webSocket.simpleRequest(routerId, messageType, payload).nodeify(callback);
    };

    return StorageSimpleAPI;
});