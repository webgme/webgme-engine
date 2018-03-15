/*globals define*/
/*eslint-env node, browser*/
/**

 *
 * Storage.openProject resolves with an instance of this classes.
 *
 * @author pmeijer / https://github.com/pmeijer
 */

define([
    'common/storage/project/interface',
    'common/storage/project/branch',
    'q'
], function (ProjectInterface, Branch, Q) {
    'use strict';

    /**
     * This project uses a common storage to connect to the database on the server via web-sockets.
     * It can run under both nodeJS and in the browser.
     *
     *
     * @param {string} projectId - Id of project to be opened.
     * @param {object} storage - Storage connected to the server and database.
     * @param {object} mainLogger - Logger instance.
     * @param {GmeConfig} gmeConfig
     * @alias Project
     * @constructor
     * @augments ProjectInterface
     */
    function Project(projectId, storage, mainLogger, gmeConfig) {
        var self = this;
        this.branches = {};

        ProjectInterface.call(this, projectId, storage, mainLogger, gmeConfig);

        // Functions defined in ProjectInterface
        this.makeCommit = function (branchName, parents, rootHash, coreObjects, msg, callback) {
            return Q.ninvoke(storage, 'makeCommit', self.projectId, branchName, parents, rootHash, coreObjects, msg)
                .nodeify(callback);
        };

        this.getProjectInfo = function (callback) {
            return Q.ninvoke(storage, 'getProjectInfo', self.projectId)
                .nodeify(callback);
        };

        this.setBranchHash = function (branchName, newHash, oldHash, callback) {
            return Q.ninvoke(storage, 'setBranchHash', self.projectId, branchName, newHash, oldHash)
                .nodeify(callback);
        };

        this.getBranchHash = function (branchName, callback) {
            return Q.ninvoke(storage, 'getBranchHash', self.projectId, branchName)
                .nodeify(callback);
        };

        this.createBranch = function (branchName, newHash, callback) {
            return Q.ninvoke(storage, 'createBranch', self.projectId, branchName, newHash)
                .nodeify(callback);
        };

        this.deleteBranch = function (branchName, oldHash, callback) {
            return Q.ninvoke(storage, 'deleteBranch', self.projectId, branchName, oldHash)
                .nodeify(callback);
        };

        this.getBranches = function (callback) {
            return Q.ninvoke(storage, 'getBranches', self.projectId)
                .nodeify(callback);
        };

        this.createTag = function (tagName, commitHash, callback) {
            return Q.ninvoke(storage, 'createTag', self.projectId, tagName, commitHash)
                .nodeify(callback);
        };

        this.deleteTag = function (tagName, callback) {
            return Q.ninvoke(storage, 'deleteTag', self.projectId, tagName)
                .nodeify(callback);
        };

        this.getTags = function (callback) {
            return Q.ninvoke(storage, 'getTags', self.projectId)
                .nodeify(callback);
        };

        this.getCommits = function (before, number, callback) {
            return Q.ninvoke(storage, 'getCommits', self.projectId, before, number)
                .nodeify(callback);
        };

        this.getHistory = function (start, number, callback) {
            return Q.ninvoke(storage, 'getHistory', self.projectId, start, number)
                .nodeify(callback);
        };

        this.getCommonAncestorCommit = function (commitA, commitB, callback) {
            return Q.ninvoke(storage, 'getCommonAncestorCommit', self.projectId, commitA, commitB)
                .nodeify(callback);
        };

        this.squashCommits = function (fromCommit, toCommitOrBranch, message, callback) {
            return Q.ninvoke(storage, 'squashCommits', self.projectId, fromCommit, toCommitOrBranch, message)
                .nodeify(callback);
        };

        this.getUserId = function () {
            return storage.userId;
        };

        /**
         * Start watching the document at the provided context.
         * @param {object} data
         * @param {string} data.branchName
         * @param {string} data.nodeId
         * @param {string} data.attrName
         * @param {string} data.attrValue - If the first client entering the document the value will be used
         * @param {function} atOperation - Triggered when other clients' operations were applied
         * @param {ot.Operation} atOperation.operation - Triggered when other clients made changes
         * @param {function} atSelection - Triggered when other clients send their selection info
         * @param {object} atSelection.data
         * @param {ot.Selection | null} atSelection.data.selection - null is passed when other client leaves
         * @param {string} atSelection.data.userId - name/id of other user
         * @param {string} atSelection.data.socketId - unique id of other user
         * @param {function} [callback]
         * @param {Error | null} callback.err - If failed to watch the document
         * @param {object} callback.data
         * @param {string} callback.data.docId - Id of document
         * @param {string} callback.data.document - Current document on server
         * @param {number} callback.data.revision - Revision at server when connecting
         * @param {object} callback.data.users - Users that were connected when connecting
         * @returns {Promise}
         */
        this.watchDocument = function (data, atOperation, atSelection, callback) {
            data.projectId = self.projectId;
            return storage.watchDocument(data, atOperation, atSelection).nodeify(callback);
        };

        /**
         * Stop watching the document.
         * @param {object} data
         * @param {string} data.docId - document id, if not provided branchName, nodeId, attrName must be.
         * @param {string} [data.branchName]
         * @param {string} [data.nodeId]
         * @param {string} [data.attrName]
         * @param {function} [callback]
         * @param {Error | null} callback.err - If failed to unwatch the document
         * @returns {Promise}
         */
        this.unwatchDocument = function (data, callback) {
            if (!data.docId) {
                data.projectId = self.projectId;
            }

            return storage.unwatchDocument(data).nodeify(callback);
        };

        /**
         * Send operation made, and optionally selection, on document at docId.
         * @param {object} data
         * @param {string} data.docId
         * @param {ot.TextOperation} data.operation
         * @param {ot.Selection} [data.selection]
         */
        this.sendDocumentOperation = function (data) {
            return storage.sendDocumentOperation(data);
        };

        /**
         * Send selection on document at docId. (Will only be transmitted if client is Synchronized.)
         * @param {object} data
         * @param {string} data.docId
         * @param {ot.Selection} data.selection
         */
        this.sendDocumentSelection = function (data) {
            return storage.sendDocumentSelection(data);
        };
    }

    Project.prototype = Object.create(ProjectInterface.prototype);
    Project.prototype.constructor = Project;

    return Project;
});