/*globals define*/
/*eslint-env node, browser*/
/*eslint no-unused-vars: 0*/

/**
 * This class defines the common interface for a storage-project.
 *
 * @author pmeijer / https://github.com/pmeijer
 */

define([
    'q',
    'common/storage/project/cache',
    'common/storage/constants',
    'common/storage/util',
    'common/regexp',
], function (Q, ProjectCache, CONSTANTS, UTIL, REGEXP) {
    'use strict';

    /**
     *
     * @param {string} projectId - Id of project to be opened.
     * @param {object} storageObjectsAccessor - Exposes loadObject towards the database.
     * @param {GmeLogger} mainLogger - Logger instance from instantiator.
     * @param {GmeConfig} gmeConfig
     * @alias ProjectInterface
     * @constructor
     */
    function ProjectInterface(projectId, storageObjectsAccessor, mainLogger, gmeConfig) {

        /**
         * Unique ID of project, built up by the ownerId and projectName.
         *
         * @example
         * 'guest+TestProject', 'organization+TestProject2'
         * @type {string}
         */
        this.projectId = projectId;
        this.projectName = UTIL.getProjectNameFromProjectId(projectId);

        this.CONSTANTS = CONSTANTS;

        this.ID_NAME = CONSTANTS.MONGO_ID;

        /**
         * @type {GmeConfig}
         */
        this.gmeConfig = gmeConfig;

        /**
         * @type {GmeLogger}
         */
        this.logger = mainLogger.fork('Project:' + this.projectId);

        this.logger.debug('ctor', projectId);
        this.projectCache = new ProjectCache(storageObjectsAccessor, this.projectId, this.logger, gmeConfig);

        // Functions forwarded to project cache.
        /**
         * Inserts the given object to project-cache.
         *
         * @param {module:Storage~CommitObject|module:Core~ObjectData} obj - Object to be inserted in database.
         * @param {Object.<module:Core~ObjectHash, module:Core~ObjectData>} [stackedObjects] - When used by the core,
         * inserts between persists are stored here.
         * @func
         * @private
         */
        this.insertObject = this.projectCache.insertObject;

        /**
         * Try to create the full object from the patch object by looking for the base object in the cache.
         * If the base has been found it applies the patch and inserts the result. If any step fails it simply
         * ignores the insert.
         *
         * @param {module:Storage~CommitObject|module:Core~ObjectData} obj - Object to be inserted in database.
         * @func
         * @private
         */
        this.insertPatchObject = this.projectCache.insertPatchObject;

        /**
         * Callback for loadObject.
         *
         * @callback ProjectInterface~loadObjectCallback
         * @param {Error} err - If error occurred.
         * @param {module:Storage~CommitObject|module:Core~ObjectData} object - Object loaded from database,
         * commit-object or model data-blob.
         */

        /**
         * Loads the object with hash key from the database or
         * directly from the cache if recently loaded.
         * @param {string} key - Hash of object to load.
         * @param {ProjectInterface~loadObjectCallback} callback - Invoked when object is loaded.
         * @func
         * @private
         */
        this.loadObject = this.projectCache.loadObject;

        /**
         * Collects the objects from the server and pre-loads them into the cache
         * making the load of multiple objects faster.
         * @private
         * @param {string} rootKey - Hash of the object at the entry point of the paths.
         * @param {string[]} paths - List of paths that needs to be pre-loaded.
         * @param {function} callback - Invoked when objects have been collected.
         * @func
         * @private
         */
        this.loadPaths = this.projectCache.loadPaths;

        // Public API

        /**
         * Makes a commit to data base. Based on the root hash and commit message a new
         * {@link module:Storage.CommitObject} (with returned hash)
         * is generated and insert together with the core objects to the database on the server.
         *
         * @example
         * var persisted = core.persist(rootNode);
         *
         * project.makeCommit('master', ['#thePreviousCommitHash'], persisted.rootHash, persisted.objects, 'new commit')
         *   .then(function (result) {
         *     // result = {
         *     //   status: 'SYNCED',
         *     //   hash: '#thisCommitHash'
         *     // }
         *   })
         *   .catch(function (error) {
         *     // error.message = 'Not authorized to read project: guest+project'
         *   });
         * @example
         * project.makeCommit('master', ['#notPreviousCommitHash'], persisted.rootHash, persisted.objects, 'new commit')
         *   .then(function (result) {
         *     // result = {
         *     //   status: 'FORKED',
         *     //   hash: '#thisCommitHash'
         *     // }
         *   })...
         * @example
         * project.makeCommit(null, ['#anExistingCommitHash'], persisted.rootHash, persisted.objects, 'new commit')
         *   .then(function (result) {
         *     // result = {
         *     //   hash: '#thisCommitHash'
         *     // }
         *   })...
         * @example
         * project.makeCommit('master', ['#aPreviousCommitHash'], previousRootHash, {}, 'adding a commit to master')
         *   .then(function (result) {
         *     // result = {
         *     //   status: 'SYNCED',
         *     //   hash: '#thisCommitHash'
         *     // }
         *   })...
         * @param {string} branchName - Name of branch to update (none if null).
         * @param {module:Storage~CommitHash[]} parents - Parent commit hashes.
         * @param {module:Core~ObjectHash} rootHash - Hash of root object.
         * @param {module:Core~DataObject} coreObjects - Core objects associated with the commit.
         * @param {string} msg='n/a' - Commit message.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {module:Storage~CommitResult} callback.result - Status about the commit and branch update.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {@link module:Storage~CommitResult} <b>result</b>.<br>
         * On error the promise will be rejected with {Error} <b>error</b>.
         */
        this.makeCommit = function (branchName, parents, rootHash, coreObjects, msg, callback) {
            throw new Error('makeCommit must be overridden in derived class');
        };

        /**
         * Retrieves the metadata of the project.
         * @example
         * {
         *  _id: 'guest+example',
         *  owner: 'guest',
         *  name: 'example',
         *  info: {
         *      createdAt: '2016-12-02T17:52:25.029Z',
         *      viewedAt: '2017-01-30T22:45:15.269Z',
         *      modifiedAt: '2017-01-20T00:15:34.593Z',
         *      creator: 'guest',
         *      viewer: 'guest',
         *      modifier': 'guest'
         *  },
         *  hooks: {
         *      ConstraintCheckerHook': {
         *          url: 'http://127.0.0.1:8080/ConstraintCheckerHook',
         *          description': 'Checks if there are any meta violations in the project',
         *          events: ['COMMIT'],
         *          active: true,
         *          createdAt: '2017-01-19T23:22:46.834Z',
         *          updatedAt: '2017-01-19T23:22:46.834Z'
         *      }
         *  },
         *  rights: {
         *      read: true,
         *      write: true,
         *      delete: true
         *  },
         *  branches: {
         *      b1: '#998067142c7ff8067cd0c04a0ec4ef80d865606c',
         *      master: '#36df6f8c17b2ccf4e35a2a75b1e0adb928f82a61'
         *  }
         * }
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {object} callback.projectInfo - An object with info about the project.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {object} <b>projectInfo</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getProjectInfo = function (callback) {
            throw new Error('getProjectInfo must be overridden in derived class');
        };

        /**
         * Updates the head of the branch.
         * @param {string} branchName - Name of branch to update.
         * @param {module:Storage~CommitHash} newHash - New commit hash for branch head.
         * @param {module:Storage~CommitHash} oldHash - Current state of the branch head inside the database.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {module:Storage~CommitResult} callback.result - Status about the branch update.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {@link module:Storage~CommitResult} <b>result</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.setBranchHash = function (branchName, newHash, oldHash, callback) {
            throw new Error('setBranchHash must be overridden in derived class');
        };

        /**
         * Retrieves the commit hash for the head of the branch.
         * @param {string} branchName - Name of branch.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {module:Storage~CommitHash} callback.commitHash - The commit hash.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {@link module:Storage~CommitHash} <b>commitHash</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getBranchHash = function (branchName, callback) {
            throw new Error('getBranchHash must be overridden in derived class');
        };

        /**
         * Retrieves the root hash at the provided branch or commit-hash.
         * @param {string} branchNameOrCommitHash - Name of branch or a commit-hash.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {module:Core~ObjectHash} callback.rootHash - The root hash.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {@link module:Core~ObjectHash} <b>rootHash</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getRootHash = function (branchNameOrCommitHash, callback) {
            return this.getCommitObject(branchNameOrCommitHash)
                .then(function (commitObj) {
                    return commitObj.root;
                })
                .nodeify(callback);
        };

        /**
         * Creates a new branch with head pointing to the provided commit hash.
         * @param {string} branchName - Name of branch to create.
         * @param {module:Storage~CommitHash} newHash - New commit hash for branch head.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {module:Storage~CommitResult} callback.result - Status about the branch update.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {@link module:Storage~CommitResult} <b>result</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.createBranch = function (branchName, newHash, callback) {
            throw new Error('createBranch must be overridden in derived class');
        };

        /**
         * Deletes the branch.
         * @param {string} branchName - Name of branch to create.
         * @param {module:Storage~CommitHash} oldHash - Previous commit hash for branch head.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {module:Storage~CommitResult} callback.result - Status about the branch update.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {@link module:Storage~CommitResult} <b>result</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.deleteBranch = function (branchName, oldHash, callback) {
            throw new Error('deleteBranch must be overridden in derived class');
        };

        /**
         * Retrieves all branches and their current heads within the project.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {Object.<string, module:Storage~CommitHash>} callback.branches - An object with branch names as keys
         * and their commit-hashes as values.
         * @return {external:Promise}  On success the promise will be resolved with
         * Object.<string, {@link module:Storage~CommitHash}> <b>branches</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getBranches = function (callback) {
            throw new Error('getBranches must be overridden in derived class');
        };

        /**
         * Retrieves the commit-object at the provided branch or commit-hash.
         * @param {string} branchNameOrCommitHash - Name of branch or a commit-hash.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {module:Storage~CommitObject} callback.commit - The commit-object.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {@link module:Storage~CommitObject} <b>commitObject</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getCommitObject = function (branchNameOrCommitHash, callback) {
            var self = this,
                commitDeferred;

            if (REGEXP.HASH.test(branchNameOrCommitHash)) {
                commitDeferred = Q(branchNameOrCommitHash);
            } else {
                commitDeferred = this.getBranchHash(branchNameOrCommitHash);
            }

            return commitDeferred
                .then(function (commitHash) {
                    return Q.ninvoke(self, 'loadObject', commitHash);
                })
                .nodeify(callback);
        };

        /**
         * Retrieves an array of commits starting from a branch(es) and/or commitHash(es).
         * <br> The result is ordered by the rules (applied in order)
         * <br> 1. Descendants are always returned before their ancestors.
         * <br> 2. By their timestamp.
         * @param {string|module:Storage~CommitHash|string[]|module:Storage~CommitHash[]} start - Branch name,
         * commit hash or array of these.
         * @param {number} number - Number of commits to load.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {Array.<module:Storage~CommitObject>} callback.commits - The commits that match the input ordered
         * as explained.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * Array.<{@link module:Storage~CommitObject}> <b>commits</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getHistory = function (start, number, callback) {
            throw new Error('getHistory must be overridden in derived class');
        };

        /**
         * Retrieves and array of the latest (sorted by timestamp) commits for the project.
         * If timestamp is given it will get <b>number</b> of commits strictly before <b>before</b>.
         * If commit hash is specified that commit will be included too.
         * <br> N.B. due to slight time differences on different machines, ancestors may be returned before
         * their descendants. Unless looking for 'headless' commits 'getHistory' is the preferred method.
         * @param {number|module:Storage~CommitHash} before - Timestamp or commitHash to load history from.
         * @param {number} number - Number of commits to load.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {Array.<module:Storage~CommitObject>} callback.commits - The commits that match the input, ordered
         * by their time of insertion.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * Array.<{@link module:Storage~CommitObject}> <b>commits</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getCommits = function (before, number, callback) {
            throw new Error('getCommits must be overridden in derived class');
        };

        /**
         * Creates a new tag pointing to the provided commit hash.
         * @param {string} tagName - Name of tag to create.
         * @param {module:Storage~CommitHash} commitHash - Commit hash tag will point to.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         *
         * @return {external:Promise}  On success the promise will be resolved with nothing.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.createTag = function (tagName, commitHash, callback) {
            throw new Error('createTag must be overridden in derived class');
        };

        /**
         * Deletes the given tag.
         * @param {string} tagName - Name of tag to delete.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         *
         * @return {external:Promise}  On success the promise will be resolved with nothing.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.deleteTag = function (tagName, callback) {
            throw new Error('deleteTag must be overridden in derived class');
        };

        /**
         * Retrieves all tags and their commits hashes within the project.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution.
         * @param {Object.<string, module:Storage~CommitHash>} callback.tags - An object with tag names as keys and
         * their commit-hashes as values.
         * @return {external:Promise}  On success the promise will be resolved with
         * Object.<string, {@link module:Storage~CommitHash}> <b>tags</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getTags = function (callback) {
            throw new Error('getTags must be overridden in derived class');
        };

        /**
         * Retrieves the common ancestor of two commits. If no ancestor exists it will result in an error.
         *
         * @param {module:Storage~CommitHash} commitA - Commit hash.
         * @param {module:Storage~CommitHash} commitB - Commit hash.
         * @param {function} [callback] - If provided no promise will be returned.
         * @param {null|Error} callback.error - The result of the execution (will be non-null if e.g. the commits do
         * not exist or have no common ancestor).
         * @param {module:Storage~CommitHash} callback.commitHash - The commit hash of the common ancestor.
         *
         * @return {external:Promise}  On success the promise will be resolved with
         * {@link module:Storage~CommitHash} <b>commitHash</b>.<br>
         * On error the promise will be rejected with {@link Error} <b>error</b>.
         */
        this.getCommonAncestorCommit = function (commitA, commitB, callback) {
            throw new Error('getCommonAncestorCommit must be overridden in derived class');
        };

        /**
         * Return the identity of the current user of this project.
         * @return {string} the userId
         */
        this.getUserId = function () {
            throw new Error('getUserId must be overridden in derived class');
        };
    }

    return ProjectInterface;
});
