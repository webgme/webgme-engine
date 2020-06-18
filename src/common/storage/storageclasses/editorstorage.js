/*globals define*/
/*eslint-env node*/
/**
 * This class implements the functionality needed to edit a model in a specific project and branch in a
 * collaborative fashion.
 *
 * It keeps a state of the open projects which in turn keeps track of the open branches.
 *
 * Each project is associated with a project-cache which is shared amongst the branches. So switching
 * between branches is (potentially) an operation that does not require lots of server round-trips.
 *
 * It is possible to have multiple projects open and multiple branches within each project. However
 * one instance of a storage can only hold a single instance of a project (or branch within a project).
 *
 * @author pmeijer / https://github.com/pmeijer
 */

define([
    'common/storage/storageclasses/objectloaders',
    'common/storage/constants',
    'common/storage/project/project',
    'common/storage/project/branch',
    'common/util/assert',
    'common/util/key',
    'common/storage/util',
    'q'
], function (StorageObjectLoaders, CONSTANTS, Project, Branch, assert, generateKey, UTIL, Q) {
    'use strict';

    /**
     *
     * @param webSocket
     * @param mainLogger
     * @param gmeConfig
     * @constructor
     */
    function EditorStorage(webSocket, mainLogger, gmeConfig) {
        var self = this,
            logger = mainLogger.fork('storage'),
            projects = {};

        self.logger = logger;
        self.userId = null;
        self.serverVersion = null;

        StorageObjectLoaders.call(this, webSocket, mainLogger, gmeConfig);

        function triggerNetworkChange(connectionState, networkHandler) {
            networkHandler(connectionState);
            self.dispatchEvent(CONSTANTS.NETWORK_STATUS_CHANGED, connectionState);
        }

        /**
         * Dig out the context for the server-worker request. Needed to determine if
         * the request needs be queued on the current commit-queue.
         * @param {object} swmParams
         * @returns {object} If the request contains a projectId and (branchName and/or commitHash). It
         * will return an object with projectId and (branchName and/or commitHash).
         */
        function extractSWMContext(swmParams) {
            var result = {};

            if (swmParams.projectId) {
                result.projectId = swmParams.projectId;
                if (swmParams.branchName || swmParams.branch || swmParams.commitHash || swmParams.commit) {
                    // Add any of these.
                    result.branchName = swmParams.branchName || swmParams.branch;
                    result.commitHash = swmParams.commitHash || swmParams.commit;
                }
            } else if (swmParams.context &&
                swmParams.context.managerConfig &&
                swmParams.context.managerConfig.project) {
                // This is a plugin request..
                result.projectId = swmParams.context.managerConfig.project;
                result.commitHash = swmParams.context.managerConfig.commitHash;
                result.branchName = swmParams.context.managerConfig.branchName;
            }

            return result;
        }

        this.open = function (networkHandler) {
            webSocket.connect(function (err, connectionState) {
                if (err) {
                    logger.error(err);
                    triggerNetworkChange(CONSTANTS.CONNECTION_ERROR, networkHandler);
                } else if (connectionState === CONSTANTS.CONNECTED) {
                    self.connected = true;
                    self.userId = webSocket.userId;
                    self.serverVersion = webSocket.serverVersion;
                    triggerNetworkChange(CONSTANTS.CONNECTED, networkHandler);
                } else if (connectionState === CONSTANTS.RECONNECTING) {
                    // This is an internal state only to handle rejoining of rooms.
                    // Technically the websocket is connected at this point.
                    self.reconnecting = true;
                } else if (connectionState === CONSTANTS.RECONNECTED) {
                    self.connected = true;
                    self._rejoinWatcherRooms()
                        .then(function () {
                            return self._rejoinBranchRooms();
                        })
                        .then(function () {
                            self.reconnecting = false;
                            triggerNetworkChange(CONSTANTS.RECONNECTED, networkHandler);
                        })
                        .catch(function (err) {
                            logger.error('failing during reconnect', err);
                            triggerNetworkChange(CONSTANTS.CONNECTION_ERROR, networkHandler);
                        });

                } else if (connectionState === CONSTANTS.DISCONNECTED) {
                    self.connected = false;
                    triggerNetworkChange(CONSTANTS.DISCONNECTED, networkHandler);
                } else if (connectionState === CONSTANTS.INCOMPATIBLE_CONNECTION) {
                    triggerNetworkChange(connectionState, networkHandler);
                } else if (connectionState === CONSTANTS.JWT_ABOUT_TO_EXPIRE) {
                    triggerNetworkChange(connectionState, networkHandler);
                } else if (connectionState === CONSTANTS.JWT_EXPIRED) {
                    triggerNetworkChange(connectionState, networkHandler);
                } else {
                    logger.error('unexpected connection state');
                    triggerNetworkChange(CONSTANTS.CONNECTION_ERROR, networkHandler);
                }
            });
        };

        this.close = function (callback) {
            logger.debug('Closing storage, openProjects', Object.keys(projects));

            return Q.allSettled(Object.keys(projects)
                .map(function (projectId) {
                    return self.closeProject(projectId);
                }))
                .then(function () {
                    // Remove the handler for the socket.io events 'connect' and 'disconnect'.
                    logger.debug('Removing connect and disconnect events');
                    webSocket.socket.removeAllListeners('connect');
                    webSocket.socket.removeAllListeners('disconnect');
                    // Disconnect from the server.
                    logger.debug('Disconnecting web-socket');
                    webSocket.disconnect();
                    self.connected = false;
                    // Remove all local event-listeners.
                    webSocket.clearAllEvents();
                    self.clearAllEvents();
                })
                .nodeify(callback);
        };

        this.getToken = function () {
            return webSocket.ioClient.getToken();
        };

        this.setToken = function (newToken) {
            return webSocket.ioClient.setToken(newToken);
        };

        /**
         * Callback for openProject.
         *
         * @callback EditorStorage~openProjectCallback
         * @param {string} err - error string.
         * @param {Project} project - the newly opened project.
         * @param {object} branches - the newly opened project.
         * @example
         * // branches is of the form
         * // { master: '#somevalidhash', b1: '#someothervalidhash' }
         */

        /**
         *
         * @param {string} projectId - name of project to open.
         * @param {EditorStorage~openProjectCallback} - callback
         */
        this.openProject = function (projectId, callback) {
            var deferred,
                data = {
                    projectId: projectId
                };

            if (projects[projectId]) {
                return Q.reject(new Error('project is already open ' + projectId)).nodeify(callback);
            }

            webSocket.openProject(data)
                .spread(function (branches, access) {
                    var project = new Project(projectId, self, logger, gmeConfig);
                    projects[projectId] = project;

                    if (callback) {
                        callback(null, project, branches, access);
                    } else {
                        deferred.resolve([project, branches, access]);
                    }
                })
                .catch(function (err) {
                    if (callback) {
                        callback(err);
                    } else {
                        deferred.reject(err);
                    }
                });

            if (!callback) {
                deferred = Q.defer();
                return deferred.promise;
            }
        };

        this.closeProject = function (projectId, callback) {
            logger.debug('closeProject', projectId);

            if (projects[projectId]) {
                return Q.allSettled(Object.keys(projects[projectId].branches)
                    .map(function (branchName) {
                        return self.closeBranch(projectId, branchName);
                    }))
                    .then(function () {
                        if (self.connected) {
                            return webSocket.closeProject({projectId: projectId});
                        } else {
                            logger.debug('Disconnected while closing project.. skipping webSocket request to server.');
                        }
                    })
                    .then(function () {
                        delete projects[projectId];
                    })
                    .nodeify(callback);
            } else {
                logger.warn('Project is not open ', projectId);
                return Q().nodeify(callback);
            }
        };

        this.openBranch = function (projectId, branchName, hashUpdateHandler, branchStatusHandler, callback) {
            var project = projects[projectId],
                data = {
                    projectId: projectId,
                    branchName: branchName
                },
                deferred,
                branch;

            if (!project) {
                return Q.reject(
                    new Error('Cannot open branch, ' + branchName + ', project ' + projectId + ' is not opened.'))
                    .nodeify(callback);
            }

            if (project.branches[branchName]) {
                return Q.reject(new Error('Branch is already open ' + branchName + ', project: ' + projectId))
                    .nodeify(callback);
            }

            logger.debug('openBranch, calling webSocket openBranch', projectId, branchName);

            deferred = Q.defer();

            webSocket.openBranch(data)
                .then(function (latestCommit) {
                    var branchHash;

                    branch = new Branch(branchName, project.logger);
                    project.branches[branchName] = branch;

                    // Update state of branch
                    branch.latestCommitData = latestCommit;
                    branchHash = latestCommit.commitObject[CONSTANTS.MONGO_ID];
                    branch.updateHashes(branchHash, branchHash);

                    // Add handlers to branch and set the remote update handler for the web-socket.
                    branch.addHashUpdateHandler(hashUpdateHandler);
                    branch.addBranchStatusHandler(branchStatusHandler);

                    branch._remoteUpdateHandler = function (_ws, updateData, initCallback) {
                        var j,
                            originHash = updateData.commitObject[CONSTANTS.MONGO_ID];
                        logger.debug('_remoteUpdateHandler invoked for project, branch', projectId, branchName);
                        for (j = 0; j < updateData.coreObjects.length; j += 1) {
                            if (updateData.coreObjects[j] && updateData.coreObjects[j].type === 'patch') {
                                project.insertPatchObject(updateData.coreObjects[j]);
                            } else {
                                project.insertObject(updateData.coreObjects[j]);
                            }
                        }

                        branch.queueUpdate(updateData);
                        branch.updateHashes(null, originHash);

                        if (branch.getCommitQueue().length === 0) {
                            if (branch.getUpdateQueue().length === 1) {
                                self._pullNextQueuedCommit(projectId, branchName, initCallback); // hashUpdateHandlers
                            }
                        } else {
                            logger.debug('commitQueue is not empty, only updating originHash.');
                        }
                    };

                    branch._remoteUpdateHandler(null, latestCommit, function (err) {
                        webSocket.addEventListener(webSocket.getBranchUpdateEventName(projectId, branchName),
                            branch._remoteUpdateHandler);

                        if (err) {
                            deferred.reject(err);
                        } else {
                            deferred.resolve(latestCommit);
                        }
                    });
                })
                .catch(deferred.reject);

            return deferred.promise.nodeify(callback);
        };

        this.closeBranch = function (projectId, branchName, callback) {
            var project = projects[projectId],
                branch;

            logger.debug('closeBranch', projectId, branchName);

            if (!project) {
                logger.warn('closeBranch: project is not open', projectId, branchName);
                return Q(null).nodeify(callback);
            }

            branch = project.branches[branchName];

            if (!branch) {
                logger.warn('closeBranch: project does not have given branch.', projectId, branchName);
                return Q(null).nodeify(callback);
            }

            // This will prevent memory leaks and expose if a commit is being
            // processed at the server this time (see last error in _pushNextQueuedCommit).
            branch.dispatchBranchStatus(null);

            // Stop listening to events from the server
            webSocket.removeEventListener(webSocket.getBranchUpdateEventName(projectId, branchName),
                branch._remoteUpdateHandler);

            branch.cleanUp();
            if (self.connected) {
                return webSocket.closeBranch({projectId: projectId, branchName: branchName})
                    .then(function () {
                        delete project.branches[branchName];
                    })
                    .nodeify(callback);
            } else {
                logger.debug('Disconnected while closing branch.. skipping webSocket request to server.');
                delete project.branches[branchName];
                return Q(null).nodeify(callback);
            }
        };

        this.forkBranch = function (projectId, branchName, forkName, commitHash, callback) {
            var project = projects[projectId],
                branch,
                forkData;

            this.logger.debug('forkBranch', projectId, branchName, forkName, commitHash);

            if (!project) {
                return Q.reject(new Error('Cannot fork branch, ' + branchName + ', project '
                    + projectId + ' is not opened.'))
                    .nodeify(callback);
            }

            branch = project.branches[branchName];

            if (!branch) {
                return Q.reject(new Error('Cannot fork branch, branch is not open ' + branchName +
                    ', project: ' + projectId))
                    .nodeify(callback);
            }

            forkData = branch.getCommitsForNewFork(commitHash, forkName); // commitHash = null defaults to latest commit
            self.logger.debug('forkBranch - forkData', forkData);

            if (forkData === false) {
                return Q.reject(new Error('Could not find specified commitHash: ' + commitHash)).nodeify(callback);
            }

            return self.persistCommits(forkData.queue)
                .then(function () {
                    return self.createBranch(projectId, forkName, forkData.commitHash);
                })
                .then(function () {
                    return forkData.commitHash;
                })
                .nodeify(callback);
        };

        this.persistCommits = function (commitQueue, callback) {
            var deferred = Q.defer(),
                commitHash;

            function commitNext(i) {
                var currentCommitData = commitQueue[i];

                if (i < commitQueue.length) {
                    currentCommitData = commitQueue[i];
                    logger.debug('persistCommits - commitNext, currentCommitData', currentCommitData);
                    delete currentCommitData.branchName;
                    commitHash = currentCommitData.commitObject[CONSTANTS.MONGO_ID];

                    webSocket.makeCommit(currentCommitData)
                        .then(function (result) {
                            logger.debug('persistCommits - commit successful, hash', result);
                            commitNext(i += 1);
                        })
                        .catch(deferred.reject);
                } else {
                    deferred.resolve(commitHash);
                }
            }

            commitNext(0);

            return deferred.promise.nodeify(callback);
        };

        this.makeCommit = function (projectId, branchName, parents, rootHash, coreObjects, msg, callback) {
            var project = projects[projectId],
                branch,
                commitId,
                commitCallback,
                persistQueueElement = {},
                commitData = {
                    rootHash: rootHash,
                    projectId: projectId,
                    commitObject: null,
                    coreObjects: {},
                    changedNodes: null
                },
                keys = Object.keys(coreObjects),
                i;

            //handling patch object creation
            // console.time('patch-computation');
            for (i = 0; i < keys.length; i += 1) {
                if (UTIL.coreObjectHasOldAndNewData(coreObjects[keys[i]])) {
                    // Patch type object.
                    persistQueueElement[keys[i]] = coreObjects[keys[i]].newData;
                    if (keys[i] === rootHash) {
                        // console.time('root-patch-computation');
                    }
                    commitData.coreObjects[keys[i]] = UTIL.getPatchObject(coreObjects[keys[i]].oldData,
                        coreObjects[keys[i]].newData);
                    //if (keys[i] === rootHash) {
                    // console.timeEnd('root-patch-computation');
                    //}
                } else if (coreObjects[keys[i]].newData && coreObjects[keys[i]].newHash) {
                    // A new object with no previous data (send the entire data).
                    commitData.coreObjects[keys[i]] = coreObjects[keys[i]].newData;
                    persistQueueElement[keys[i]] = coreObjects[keys[i]].newData;
                } else {
                    // A regular object.
                    commitData.coreObjects[keys[i]] = coreObjects[keys[i]];
                    persistQueueElement[keys[i]] = coreObjects[keys[i]];
                }
            }
            // console.timeEnd('patch-computation');
            // console.time('getChangedNodes');

            commitData.changedNodes = UTIL.getChangedNodes(commitData.coreObjects, rootHash);

            // console.timeEnd('getChangedNodes');

            commitData.commitObject = self._getCommitObject(projectId, parents, commitData.rootHash, msg);

            if (project) {
                project.insertObject(commitData.commitObject);
                commitId = commitData.commitObject[CONSTANTS.MONGO_ID];

                commitCallback = function commitCallback() {
                    delete project.projectCache.queuedPersists[commitId];
                    self.logger.debug('Removed now persisted core-objects from cache: ',
                        Object.keys(project.projectCache.queuedPersists).length);
                    callback.apply(null, arguments);
                };

                project.projectCache.queuedPersists[commitId] = persistQueueElement;
                logger.debug('Queued non-persisted core-objects in cache: ',
                    Object.keys(project.projectCache.queuedPersists).length);
            } else {
                commitCallback = callback;
            }

            if (typeof branchName === 'string') {
                commitData.branchName = branchName;
                branch = project ? project.branches[branchName] : null;
            }

            logger.debug('makeCommit', commitData);
            if (branch) {
                logger.debug('makeCommit, branch is open will commit using commitQueue. branchName:', branchName);
                self._commitToBranch(projectId, branchName, commitData, parents[0], commitCallback);
            } else {
                webSocket.makeCommit(commitData, commitCallback);
            }

            return commitData.commitObject;
        };

        this.setBranchHash = function (projectId, branchName, newHash, oldHash, callback) {
            var project = projects[projectId];

            logger.debug('setBranchHash', projectId, branchName, newHash, oldHash);
            if (project && project.branches[branchName]) {
                logger.debug('setBranchHash, branch is open, will notify other local users about change');
                project.loadObject(newHash, function (err, commitObject) {
                    var commitData;
                    if (err) {
                        logger.error('setBranchHash, failed to load in commitObject');
                        //branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.ERROR, err);
                        callback(err);
                        return;
                    }
                    logger.debug('setBranchHash, loaded commitObject');
                    commitData = {
                        projectId: projectId,
                        branchName: branchName,
                        coreObjects: {},
                        changedNodes: null,
                        commitObject: commitObject,
                        oldHash: oldHash
                    };
                    self._commitToBranch(projectId, branchName, commitData, oldHash, callback);
                });
            } else {
                StorageObjectLoaders.prototype.setBranchHash.call(self,
                    projectId, branchName, newHash, oldHash)
                    .nodeify(callback);
            }
        };

        this.simpleRequest = function (parameters, callback) {
            // This method is overridden here in order to avoid worker-requests
            // to be sent out referencing commits that haven't made it to the server yet.
            var context = extractSWMContext(parameters),
                commitHash,
                deferred,
                queuedInBranch;

            if (context.projectId && projects[context.projectId]) {
                // The request deals with a currently opened project - let's see if there is
                // a commitHash and/or branch associated with the request..
                if (context.commitHash) {
                    commitHash = context.commitHash;

                    if (context.branchName &&
                        projects[context.projectId].branches[context.branchName] &&
                        projects[context.projectId].branches[context.branchName].getQueuedHashes()
                            .indexOf(context.commitHash) > -1) {
                        // Since both commitHash and branchName was specified and the commitHash was queued
                        // in that branch - this is the branch to pick.
                        queuedInBranch = context.branchName;
                    } else {
                        // No branch was specified - let's see if the commit is queued in any opened branch.
                        // (Typically there's really only one open.)
                        Object.keys(projects[context.projectId].branches)
                            .forEach(function (branchName) {
                                if (projects[context.projectId].branches[branchName].getQueuedHashes()
                                    .indexOf(context.commitHash) > -1) {
                                    queuedInBranch = branchName;
                                }
                            });
                    }
                } else if (context.branchName && projects[context.projectId].branches[context.branchName]) {
                    // There is no specific commit-associated with request. However since branchName was passed
                    // we can only assume that it should run on the last commit in that branch.

                    commitHash = projects[context.projectId].branches[context.branchName].getQueuedHashes()[0];

                    if (commitHash) {
                        queuedInBranch = context.branchName;
                    }
                }

                if (queuedInBranch) {
                    deferred = Q.defer();

                    projects[context.projectId].branches[queuedInBranch].queueWorkerRequest(commitHash, {
                        release: function () {
                            StorageObjectLoaders.prototype.simpleRequest.call(self, parameters)
                                .then(deferred.resolve)
                                .catch(deferred.reject);
                        },
                        abort: function () {
                            deferred.reject(new Error('Queued worker request was aborted. Commit ' + commitHash +
                                ' in branch [' + queuedInBranch + '] never made it to the server.'));
                        }
                    });

                    return deferred.promise.nodeify(callback);
                }
            }

            return StorageObjectLoaders.prototype.simpleRequest.call(self, parameters).nodeify(callback);
        };

        this._commitToBranch = function (projectId, branchName, commitData, oldCommitHash, callback) {
            var project = projects[projectId],
                newCommitHash = commitData.commitObject._id,
                branch = project.branches[branchName],
                wasFirstInQueue,
                eventData = {
                    commitData: commitData,
                    local: true
                };

            logger.debug('_commitToBranch, [oldCommitHash, localHash]', oldCommitHash, branch.getLocalHash());

            if (oldCommitHash === branch.getLocalHash()) {
                branch.updateHashes(newCommitHash, null);
                branch.queueCommit(commitData, callback);

                if (branch.inSync === false) {
                    branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.AHEAD_NOT_SYNC);
                } else {
                    branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.AHEAD_SYNC);
                }

                // Get the queue length before dispatching because within the asynchrony,
                // the queue may get longer and we end up never pushing any commit.
                wasFirstInQueue = branch.getCommitQueue().length === 1;

                branch.dispatchHashUpdate(eventData, function (err, proceed) {
                    logger.debug('_commitToBranch, dispatchHashUpdate done. [err, proceed]', err, proceed);

                    if (err) {
                        branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.ERROR, err);
                        callback(new Error('Commit failed being loaded in users: ' + err));
                    } else if (proceed === true) {
                        if (wasFirstInQueue) {
                            logger.debug('_commitToBranch, commit was first in queue - will start pushing commit');
                            self._pushNextQueuedCommit(projectId, branchName);
                        } else {
                            logger.debug('_commitToBranch, commit was NOT first in queue');
                        }
                    } else {
                        callback(new Error('Commit halted when loaded in users (proceed was not true).'));
                    }
                });
            } else {
                // The current user is behind the local branch, e.g. plugin trying to save after client changes.
                logger.warn('_commitToBranch, incoming commit parent was not the same as the localHash ' +
                    'for the branch, commit will be canceled!');
                callback(null, {status: CONSTANTS.CANCELED, hash: newCommitHash});
            }
        };

        this._pushNextQueuedCommit = function (projectId, branchName) {
            var project = projects[projectId],
                branch = project.branches[branchName],
                commitData;

            logger.debug('_pushNextQueuedCommit, length=', branch.getCommitQueue().length);

            commitData = branch.getFirstCommit();

            logger.debug('_pushNextQueuedCommit, makeCommit [from# -> to#]',
                commitData.commitObject.parents[0], commitData.commitObject._id);

            webSocket.makeCommit(commitData, function (err, result) {
                var mergeCommitData;
                if (err) {
                    logger.error('makeCommit failed', err);
                }

                if (branch.isOpen) {
                    branch.callbackQueue[0](err, result);
                    if (!err && result) {
                        branch.commitInserted(result.hash);
                        if (result.status === CONSTANTS.SYNCED) {
                            branch.inSync = true;
                            branch.updateHashes(null, result.hash);
                            branch.getFirstCommit(true);
                            if (branch.getCommitQueue().length === 0) {
                                branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.SYNC);
                            } else {
                                branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.AHEAD_SYNC);
                                self._pushNextQueuedCommit(projectId, branchName);
                            }
                        } else if (result.status === CONSTANTS.MERGED) {
                            branch.inSync = true;
                            branch.updateHashes(null, result.mergeHash);

                            if (branch.getCommitQueue().length === 1) {
                                // Finds the MERGED commit-data and clears the update-queue.
                                mergeCommitData = branch.getMergedCommit(result.mergeHash);
                                branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.MERGING);
                                branch.dispatchHashUpdate({commitData: mergeCommitData, local: false},
                                    function (err, proceed) {
                                        branch.getFirstCommit(true);
                                        if (err) {
                                            logger.error('Loading of merged commit failed with error', err,
                                                {metadata: mergeCommitData});
                                            branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.ERROR, err);
                                        } else if (proceed === true) {
                                            logger.debug('Merged commit was successfully loaded, updating localHash.');
                                            branch.updateHashes(result.mergeHash, null);
                                            // TODO: What if a commit is made during the hashUpdate?
                                            branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.SYNC);
                                            return;
                                        } else {
                                            logger.warn('Loading of update commit was aborted',
                                                {metadata: result.mergeHash});
                                        }
                                    }
                                );
                            } else {
                                branch.getFirstCommit(true);
                                branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.MERGING);
                                self._pushNextQueuedCommit(projectId, branchName);
                            }
                        } else if (result.status === CONSTANTS.FORKED) {
                            branch.inSync = false;
                            branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.AHEAD_NOT_SYNC);
                        } else {
                            err = new Error('Unsupported commit status ' + result.status);
                            logger.error(err);
                            branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.ERROR, err);
                        }
                    } else {
                        branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.ERROR,
                            err || new Error('No result at commit.'));
                    }
                } else {
                    logger.error('_pushNextQueuedCommit returned from server but the branch was closed, ' +
                        'the branch has probably been closed while waiting for the response.', projectId, branchName);
                }
            });
        };

        this._pullNextQueuedCommit = function (projectId, branchName, callback) {
            assert(projects.hasOwnProperty(projectId), 'Project not opened: ' + projectId);
            var project = projects[projectId],
                branch = project.branches[branchName],
                error,
                updateData;

            if (!branch) {
                error = new Error('Branch, ' + branchName + ', not in project ' + projectId + '.');
                if (callback) {
                    callback(error);
                    return;
                } else {
                    throw error;
                }
            }

            logger.debug('About to update, updateQueue', {metadata: branch.getUpdateQueue()});
            if (branch.getUpdateQueue().length === 0) {
                logger.debug('No queued updates, returns');
                branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.SYNC);
                if (callback) {
                    callback(null);
                }
                return;
            }

            updateData = branch.getFirstUpdate();

            if (branch.isOpen) {
                branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.PULLING);
                branch.dispatchHashUpdate({commitData: updateData, local: false}, function (err, proceed) {
                    var originHash = updateData.commitObject[CONSTANTS.MONGO_ID];
                    if (err) {
                        logger.error('Loading of update commit failed with error', err, {metadata: updateData});
                        branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.ERROR, err);
                    } else if (proceed === true) {
                        logger.debug('New commit was successfully loaded, updating localHash.');
                        branch.updateHashes(originHash, null);
                        branch.getFirstUpdate(true);
                        if (branch.getCommitQueue().length === 0) {
                            self._pullNextQueuedCommit(projectId, branchName, callback);
                        }
                        return;
                    } else {
                        logger.warn('Loading of update commit was aborted', {metadata: updateData});
                    }
                    if (callback) {
                        callback(new Error('Loading the first commit was aborted'));
                    }
                });
            } else {
                logger.error('_pullNextQueuedCommit returned from server but the branch was closed.',
                    projectId, branchName);
            }
        };

        this._getCommitObject = function (projectId, parents, rootHash, msg) {
            msg = msg || 'n/a';
            var commitObj = {
                    root: rootHash,
                    parents: parents,
                    updater: [self.userId],
                    time: Date.now(),
                    message: msg,
                    type: CONSTANTS.COMMIT_TYPE,
                    __v: CONSTANTS.VERSION
                },
                commitHash = '#' + generateKey(commitObj, gmeConfig);

            commitObj[CONSTANTS.MONGO_ID] = commitHash;

            return commitObj;
        };

        this._rejoinBranchRooms = function (callback) {
            var projectId,
                project,
                branchName,
                branchRooms = [],
                promises = [];

            logger.debug('_rejoinBranchRooms');

            function afterRejoin(projectId, branchName) {
                var project = projects[projectId],
                    deferred = Q.defer();

                logger.debug('_rejoinBranchRooms, rejoined branch room', projectId, branchName);

                if (project) {
                    project.getBranchHash(branchName)
                        .then(function (branchHash) {
                            var branch = project.branches[branchName],
                                queuedCommitHash;
                            logger.debug('_rejoinBranchRooms received branchHash', projectId, branchName, branchHash);

                            if (!branch) {
                                throw new Error('_rejoinBranchRooms branch was closed ' + projectId + ':' + branchName);
                            }

                            if (branch.getCommitQueue().length > 0) {
                                queuedCommitHash = branch.getFirstCommit().commitObject._id;
                                logger.debug('_rejoinBranchRooms, commits were queued length=, firstQueuedCommitHash',
                                    branch.getCommitQueue().length, queuedCommitHash);

                                project.getCommonAncestorCommit(branchHash, queuedCommitHash)
                                    .then(function (commonCommitHash) {
                                        var result;
                                        // The commit made it to the server but the acknowledgement was
                                        // interrupted by the disconnect.

                                        logger.debug('_rejoinBranchRooms getCommonAncestorCommit',
                                            projectId, branchName, commonCommitHash);

                                        if (branch.isOpen === false) {
                                            throw new Error('_rejoinBranchRooms branch was closed ' +
                                                projectId + ':' + branchName);
                                        }

                                        function dispatchSynced() {
                                            result = {status: CONSTANTS.SYNCED, hash: branchHash};

                                            branch.callbackQueue[0](null, result);
                                            branch.inSync = true;
                                            branch.updateHashes(null, branchHash);
                                            branch.getFirstCommit(true);
                                            if (branch.getCommitQueue().length === 0) {
                                                branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.SYNC);
                                            } else {
                                                branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.AHEAD_SYNC);
                                                self._pushNextQueuedCommit(projectId, branchName);
                                            }
                                        }

                                        function dispatchForked() {
                                            result = {status: CONSTANTS.FORKED, hash: branchHash};

                                            branch.callbackQueue[0](null, result);
                                            branch.inSync = false;
                                            branch.dispatchBranchStatus(CONSTANTS.BRANCH_STATUS.AHEAD_NOT_SYNC);
                                        }

                                        // c - the commit made by this storage
                                        // H - the head of the branch
                                        if (commonCommitHash === queuedCommitHash) {
                                            // The commit is (or was) in sync with the branch.
                                            //  Hc  or  H
                                            //  |       c
                                            //  |       |
                                            // In case two the next commit made will be forked.
                                            dispatchSynced();
                                        } else if (commonCommitHash === branchHash) {
                                            // The branch has moved back since the commit was made.
                                            // Treat it like the commit was forked.
                                            //  c
                                            //  H
                                            dispatchForked();
                                        } else {
                                            // The branch has moved forward in a different direction.
                                            //  c   H
                                            //   \ /
                                            dispatchForked();
                                        }

                                        deferred.resolve();
                                    })
                                    .catch(function (err) {
                                        try {
                                            if (err.message.indexOf('Commit object does not exist [' +
                                                queuedCommitHash) > -1) {
                                                // Commit never made it to the server - push it.
                                                logger.debug('First queued commit never made it to the server - push!');
                                                self._pushNextQueuedCommit(projectId, branchName);
                                                deferred.resolve();
                                            } else {
                                                deferred.reject(err);
                                            }
                                        } catch (err) {
                                            deferred.reject(err);
                                        }
                                    });
                            } else {
                                logger.debug('_rejoinBranchRooms, no commits were queued during disconnect.');
                                deferred.resolve();
                            }
                        })
                        .catch(function (err) {
                            deferred.reject(err);
                        });
                } else {
                    deferred.reject(new Error('_rejoinBranchRooms project was closed ' + projectId + ':' + branchName));
                }

                return deferred.promise;
            }

            for (projectId in projects) {
                if (projects.hasOwnProperty(projectId)) {
                    project = projects[projectId];
                    logger.debug('_rejoinBranchRooms found project', projectId);
                    for (branchName in project.branches) {
                        if (project.branches.hasOwnProperty(branchName)) {
                            logger.debug('_rejoinBranchRooms joining branch', projectId, branchName);

                            branchRooms.push({
                                projectId: projectId,
                                branchName: branchName
                            });

                            promises.push(webSocket.watchBranch({
                                projectId: projectId,
                                branchName: branchName,
                                join: true
                            }));
                        }
                    }
                }
            }

            return Q.all(promises)
                .then(function () {
                    return Q.all(branchRooms.map(function (data) {
                        // Deal with commit queue for each room after rejoining.
                        return afterRejoin(data.projectId, data.branchName);
                    }));
                })
                .nodeify(callback);
        };

        this.sendWsRouterMessage = webSocket.sendWsRouterMessage;
        this.onWebsocketRouterMessage = webSocket.onWebsocketRouterMessage;
         
        this.CONSTANTS = CONSTANTS;
    }

    EditorStorage.prototype = Object.create(StorageObjectLoaders.prototype);
    EditorStorage.prototype.constructor = EditorStorage;

    EditorStorage.CONSTANTS = CONSTANTS;

    return EditorStorage;
});
