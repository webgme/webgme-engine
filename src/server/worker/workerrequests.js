/*globals requireJS*/
/*eslint-env node*/

/**
 * @author pmeijer / https://github.com/pmeijer
 */
'use strict';

var Core = requireJS('common/core/coreQ'),
    Storage = requireJS('common/storage/nodestorage'),
    STORAGE_CONSTANTS = requireJS('common/storage/constants'),
    merger = requireJS('common/core/users/merge'),
    BlobClientClass = requireJS('blob/BlobClient'),
    blobUtil = requireJS('blob/util'),
    constraint = requireJS('common/core/users/constraintchecker'),
    metaRules = requireJS('common/core/users/metarules'),
    webgmeUtils = require('../../utils'),
    storageUtils = requireJS('common/storage/util'),
    metaRename = requireJS('common/core/users/metarename'),
    serialization = requireJS('common/util/serialization'),
    _ = require('underscore'),

    // JsZip can't for some reason extract the exported files..
    AdmZip = require('adm-zip'),
    Q = require('q'),

    PluginNodeManager = require('../../plugin/nodemanager');

/**
 *
 * @param {GmeLogger} mainLogger
 * @param {GmeConfig} gmeConfig
 * @param {string} [webgmeUrl]
 * @constructor
 */
function WorkerRequests(mainLogger, gmeConfig, webgmeUrl) {
    var logger = mainLogger.fork('WorkerFunctions');

    function getConnectedStorage(webgmeToken, projectId, callback) {
        var deferred = Q.defer(),
            storage = Storage.createStorage(webgmeUrl, webgmeToken, logger, gmeConfig);

        storage.open(function (networkState) {
            var connErr;
            if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                if (typeof projectId === 'string') {
                    storage.openProject(projectId, function (err, project, branches, access) {
                        if (err) {
                            storage.close(function (err2) {
                                if (err2) {
                                    logger.error(err2);
                                }

                                deferred.reject(err);
                            });
                        } else {
                            deferred.resolve({
                                storage: storage,
                                project: project,
                                branches: branches,
                                access: access
                            });
                        }
                    });
                } else {
                    deferred.resolve(storage);
                }
            } else {
                connErr = new Error('Problems with connection to the webgme server, network state: ' + networkState);
                logger.error(connErr);
                deferred.reject(connErr);
            }
        });

        return deferred.promise.nodeify(callback);
    }

    /**
     * This event handler is added after the initial connect (potentially failed)
     * @param finishFn
     * @returns {Function}
     */
    function getNetworkStatusChangeHandler(finishFn) {
        var timeoutId;
        return function (storage, status) {
            var UNRECOVERABLE_STATUSES = [
                storage.CONSTANTS.INCOMPATIBLE_CONNECTION,
                storage.CONSTANTS.CONNECTION_ERROR,
                storage.CONSTANTS.JWT_EXPIRED
            ];

            if (status === storage.CONSTANTS.DISCONNECTED) {
                logger.warn('Connected worker got disconnected from server, awaiting reconnect',
                    gmeConfig.server.workerDisconnectTimeout);

                timeoutId = setTimeout(function () {
                    finishFn(new Error('Unexpected network status: ' + status));
                }, gmeConfig.server.workerDisconnectTimeout);
            } else if (status === storage.CONSTANTS.RECONNECTED) {
                clearTimeout(timeoutId);
            } else if (UNRECOVERABLE_STATUSES.indexOf(status) > -1) {
                clearTimeout(timeoutId);
                finishFn(new Error('Unexpected network status: ' + status));
            }
        };
    }

    function _getCoreAndRootNode(storage, projectId, commitHash, branchName, tagName, callback) {
        var deferred = Q.defer(),
            internalPromise,
            context = {};

        storage.openProject(projectId, function (err, project, branches) {
            if (err) {
                deferred.reject(new Error('Cannot open project: ' + err));
                return;
            }

            internalPromise = Q(null);
            context.project = project;
            if (typeof tagName === 'string') {
                internalPromise = project.getTags();
            } else if (typeof branchName === 'string') {
                if (branches.hasOwnProperty(branchName) === false) {
                    deferred.reject(new Error('Branch did not exist [' + branchName + ']'));
                    return;
                }
                commitHash = branches[branchName];
            }
            internalPromise
                .then(function (tags) {
                    if (tags) {
                        if (tags.hasOwnProperty(tagName) === false) {
                            deferred.reject(new Error('Tag did not exist [' + tagName + ']'));
                            return;
                        }
                        commitHash = tags[tagName];
                    }
                    return Q.ninvoke(context.project, 'loadObject', commitHash);
                })
                .then(function (commitObject) {
                    context.commitObject = commitObject;

                    context.core = new Core(project, {
                        globConf: gmeConfig,
                        logger: logger.fork('core')
                    });

                    return context.core.loadRoot(commitObject.root);
                })
                .then(function (rootNode) {
                    context.rootNode = rootNode;

                    deferred.resolve(context);
                })
                .catch(deferred.reject);
        });

        return deferred.promise.nodeify(callback);
    }

    function getBlobClient(webgmeToken) {
        return new BlobClientClass({
            serverPort: gmeConfig.server.port,
            httpsecure: false,
            server: '127.0.0.1',
            webgmeToken: webgmeToken,
            logger: logger.fork('BlobClient')
        });
    }

    /**
     * Executes a plugin.
     *
     * @param {string} webgmeToken
     * @param {string} [socketId] - Id of socket that send the request (used for notifications).
     * @param {string} pluginName
     * @param {object} context
     * @param {object} context.managerConfig - where the plugin should execute.
     * @param {string} context.managerConfig.project - id of project.
     * @param {string} context.managerConfig.activeNode - path to activeNode.
     * @param {string} [context.managerConfig.activeSelection=[]] - paths to selected nodes.
     * @param {string} [context.managerConfig.commitHash] - commit hash to start the plugin from
     * (if falsy will use HEAD of branchName)
     * @param {string} [context.managerConfig.branchName] - branch which to save to.
     * @param {string} [context.namespace=''] - used namespace during execution ('' represents all namespaces).
     * @param {object} [context.pluginConfig=%defaultForPlugin%] - specific configuration for the plugin.
     * @param {object} [context.executionId] - unique identifier of the execution necessary for proper messaging.
     * @param {function} callback
     */
    function executePlugin(webgmeToken, socketId, pluginName, context, callback) {
        var storage,
            errResult,
            pluginContext,
            pluginManager = new PluginNodeManager(webgmeToken, null, logger, gmeConfig, webgmeUrl),
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('plugin [' + pluginName + '] failed with error', err);
                    if (!result) {
                        result = pluginManager.getPluginErrorResult(pluginName, pluginName, err.message,
                            context && context.managerConfig && context.managerConfig.project);
                    } else if (!result.error) {
                        result.error = err.message;
                    }
                } else {
                    logger.debug('plugin [' + pluginName + '] completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            },
            plugin,
            onNotification = function (emitter, event) {
                if (event.type === storage.CONSTANTS.PLUGIN_NOTIFICATION) {
                    if (event.notification && event.notification.executionId === context.executionId) {
                        if (event.notification.type === storage.CONSTANTS.PLUGIN_NOTIFICATION_TYPE.ABORT) {
                            plugin.onAbort();
                        } else if (event.notification.type === storage.CONSTANTS.PLUGIN_NOTIFICATION_TYPE.MESSAGE) {
                            plugin.onMessage(event.notification.messageId, event.notification.content);
                        }
                    } else {
                        logger.error('Unexpected plugin-notification', new Error(JSON.stringify(event)));
                    }

                }
            };

        if (gmeConfig.plugin.allowServerExecution === false) {
            errResult = pluginManager.getPluginErrorResult(pluginName, pluginName,
                'plugin execution on server side is disabled');
            callback(null, errResult);
            return;
        }

        if (typeof pluginName !== 'string' || typeof context !== 'object') {
            errResult = pluginManager.getPluginErrorResult(pluginName, pluginName, 'invalid parameters');
            callback(new Error('invalid parameters'), errResult);
            return;
        }

        logger.debug('executePlugin', pluginName, socketId);

        logger.debug('executePlugin context', {metadata: context});
        getConnectedStorage(webgmeToken, context.managerConfig.project)
            .then(function (res) {
                storage = res.storage || res;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));


                storage.webSocket.addEventListener(storage.CONSTANTS.NOTIFICATION, onNotification);
                // storage.addEventListener(storage.CONSTANTS.NOTIFICATION, onNotification);

                pluginContext = JSON.parse(JSON.stringify(context.managerConfig));

                pluginContext.project = res.project;
                if (typeof context.managerConfig.project !== 'string') {
                    throw new Error('Invalid argument, data.projectId is not a string.');
                }

                logger.debug('Opened project, got branches:', context.managerConfig.project, res.branches);

                if (typeof socketId === 'string') {
                    logger.debug('socketId provided for plugin execution - notifications available.');
                    pluginManager.notificationHandlers = [function (data, callback) {
                        if (data.notification.type && data.notification.type ===
                            STORAGE_CONSTANTS.PLUGIN_NOTIFICATION_TYPE.INITIATED) {
                            data.executionId = context.executionId;
                            data.pluginSocketId = storage.webSocket.socket.id;
                        }
                        data.originalSocketId = socketId;
                        storage.sendNotification(data, callback);
                    }];
                }

                pluginManager.projectAccess = res.access;

                // pluginManager.executePlugin(pluginName, context.pluginConfig, pluginContext, finish);

                return pluginManager.initializePlugin(pluginName);
            })
            .then(function (plugin_) {
                plugin = plugin_;
                return pluginManager.configurePlugin(plugin, context.pluginConfig, pluginContext);
            })
            .then(function () {
                pluginManager.runPluginMain(plugin, finish);
            })
            .catch(finish)
            .done();
    }

    /**
     * Extracts the exported zip file and adds the contained files to the blob using
     * the import-part of ExportImport Plugin.
     * @param {string|Buffer} filenameOrBuffer
     * @param {BlobClient} blobClient
     * @param function [callback]
     * @returns {string} - The project json as a string
     * @private
     */
    function _extractProjectJsonAndAddAssets(filenameOrBuffer, blobClient, callback) {
        var zip = new AdmZip(filenameOrBuffer),
            artifact = blobClient.createArtifact('files'),
            projectStr;

        return Q.all(zip.getEntries()
            .map(function (entry) {
                var entryName = entry.entryName;
                if (entryName === 'project.json') {
                    projectStr = zip.readAsText(entry);
                } else {
                    return artifact.addFileAsSoftLink(entryName, zip.readFile(entry));
                }
            })
        )
            .then(function () {
                var metadata = artifact.descriptor;
                return blobUtil.addAssetsFromExportedProject(logger, blobClient, metadata);
            })
            .then(function () {
                return JSON.parse(projectStr);
            })
            .nodeify(callback);
    }

    function _getProjectJsonFromFileSeed(name, webgmeToken) {
        return webgmeUtils.getSeedDictionary(gmeConfig)
            .then(function (seedMap) {
                var blobClient,
                    filename;

                if (gmeConfig.seedProjects.enable !== true) {
                    throw new Error('File seeding is disabled from gmeConfig');
                } else if (seedMap.hasOwnProperty(name) === false) {
                    throw new Error('unknown file seed [' + name + ']');
                }

                filename = seedMap[name];
                blobClient = getBlobClient(webgmeToken);

                return _extractProjectJsonAndAddAssets(filename, blobClient);
            })
            .then(function (projectJson) {
                if (typeof projectJson.kind !== 'string') {
                    projectJson.kind = name;
                    logger.debug('Seed did not define a kind, the seed-name [' + name + '] will be used ' +
                        'as kind for new project.');
                }

                return {
                    projectJson: projectJson,
                    //msg: 'Seeded project from file-seed ' + name + '.webgmex.'
                    seedName: name + '.webgmex'
                };
            });
    }

    function _getProjectJsonFromProject(storage, projectId, branchName, commitHash, callback) {
        var deferred = Q.defer(),
            options = {};

        storage.openProject(projectId, function (err, project, branches/*, access*/) {
            if (err) {
                deferred.reject(err);
                return;
            }

            if (commitHash) {
                options.commitHash = commitHash;
            } else {
                branchName = branchName || 'master';
                if (!branches[branchName]) {
                    deferred.reject(new Error('unknown branch: ' + branchName));
                    return;
                }

                options.branchName = branchName;
            }

            Q.all([project.getProjectInfo(), storageUtils.getProjectJson(project, options)])
                .then(function (res) {
                    res[1].kind = res[0].info.kind;
                    deferred.resolve({
                        projectJson: res[1],
                        commitHash: commitHash
                    });
                })
                .catch(deferred.reject);
        });

        return deferred.promise.nodeify(callback);
    }

    function _getProjectJsonFromBlob(blobClient, packageHash, fullProject) {

        return blobClient.getObject(packageHash)
            .then(function (buffer) {
                if (buffer instanceof Buffer !== true) {
                    throw new Error('invalid package received');
                }

                return _extractProjectJsonAndAddAssets(buffer, blobClient);
            })
            .then(function (projectJson) {
                if (fullProject && projectJson.selectionInfo) {
                    throw new Error('given package is not a full project');
                }

                if (!fullProject && !projectJson.selectionInfo) {
                    throw new Error('given package contains a full project and not a model');
                }

                return {
                    projectJson: projectJson,
                    blobHash: packageHash
                };
            });
    }

    function _createProjectFromRawJson(storage, projectName, ownerId, branchName, projectJson, msg, callback) {
        var result = {
                projectId: null,
                branchName: branchName,
                commitHash: null
            },
            project;

        return Q.ninvoke(storage, 'createProject', projectName, ownerId, projectJson.kind)
            .then(function (projectId) {
                result.projectId = projectId;

                return storage.openProject(projectId);
            })
            .then(function (res) {
                project = res[0];
                return storageUtils.insertProjectJson(project, projectJson, {
                    commitMessage: msg
                });
            })
            .then(function (commitResult) {
                result.commitHash = commitResult.hash;
                return project.createBranch(branchName, commitResult.hash);
            })
            .then(function () {
                return result;
            })
            .nodeify(callback);
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {string} projectName - Name of new project.
     * @param {string} [ownerId] - Owner of new project, if not given falls back to user associated with the token.
     * @param {object} parameters
     * @param {string} parameters.seedName - Name of seed: file, projectId or blobHash
     * @param {string} parameters.type - 'db', 'file' or 'blob'
     * @param {string} [parameters.seedBranch='master'] - If type === db, optional name of branch.
     * @param {string} [parameters.seedCommit] - If type === db, optional commit-hash to seed from
     * @param {string} [parameters.branchName] - If type === db, optional commit-hash to seed from
     * if given branchName will not be used.
     * @param {string} [parameters.kind]
     * @param {function} callback
     * @param {string} callback.projectId
     * @param {string} callback.branchName
     * @param {string} callback.commitHash
     */
    function seedProject(webgmeToken, projectName, ownerId, parameters, callback) {
        var storage,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('seeding [' + parameters.seedName + '] failed with error', err);
                } else {
                    logger.debug('seeding [' + parameters.seedName + '] to [' + result.projectId + '] completed');
                }
                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('seedProject');

        if (typeof projectName !== 'string' || parameters === null || typeof parameters !== 'object' ||
            typeof parameters.seedName !== 'string' || typeof parameters.type !== 'string') {
            callback(new Error('Invalid parameters'));
            return;
        }

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                logger.debug('seedProject - storage is connected');

                if (parameters.type === 'file') {
                    logger.debug('seedProject - seeding from file:', parameters.seedName);
                    return _getProjectJsonFromFileSeed(parameters.seedName, webgmeToken);
                } else if (parameters.type === 'db') {
                    logger.debug('seedProject - seeding from existing project:', parameters.seedName);
                    return _getProjectJsonFromProject(storage, parameters.seedName, parameters.seedBranch,
                        parameters.seedCommit);
                } else if (parameters.type === 'blob') {
                    return _getProjectJsonFromBlob(getBlobClient(webgmeToken), parameters.seedName, true);
                } else {
                    throw new Error('Unknown seeding type [' + parameters.type + ']');
                }
            })
            .then(function (res) {
                var commitMessage = 'Seeded project from ';
                // First set the correct kind of the project.
                res.projectJson.kind = typeof parameters.kind === 'string' ? parameters.kind : res.projectJson.kind;

                if (parameters.type === 'file') {
                    commitMessage += 'file-seed ' + res.seedName + '.';
                } else if (parameters.type === 'db') {
                    commitMessage += 'project-seed ' + parameters.seedName + '@' + res.commitHash + '.';
                } else if (parameters.type === 'blob') {
                    commitMessage = 'Imported project from uploaded blob ' + res.blobHash + '.';
                }

                return _createProjectFromRawJson(storage, projectName, ownerId,
                    parameters.branchName || 'master', res.projectJson, commitMessage);
            })
            .nodeify(finish);
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {string} projectId
     * @param {string} branchOrCommitA - CommitHash or branchName.
     * @param {string} branchOrCommitB - CommitHash or branchName.
     * @param {function} callback
     */
    function diff(webgmeToken, projectId, branchOrCommitA, branchOrCommitB, callback) {
        var storage,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('diff [' + projectId + '] failed with error', err);
                } else {
                    logger.debug('diff [' + projectId + '] completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('diff ' + projectId + ' ' + branchOrCommitA + ' -> ' + branchOrCommitB);

        getConnectedStorage(webgmeToken, projectId)
            .then(function (res) {
                var loggerCompare = logger.fork('compare');
                storage = res.storage || res;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));

                return merger.diff({
                    project: res.project,
                    branchOrCommitA: branchOrCommitA,
                    branchOrCommitB: branchOrCommitB,
                    logger: loggerCompare,
                    gmeConfig: gmeConfig
                });
            })
            .nodeify(finish);
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {string} projectId
     * @param {string} mine - CommitHash or branchName merge into 'theirs'.
     * @param {string} theirs - CommitHash or branchName that 'mine' will be merged into.
     * @param {function} callback
     */
    function autoMerge(webgmeToken, projectId, mine, theirs, callback) {
        var storage,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('autoMerge [' + projectId + '] failed with error', err);
                } else {
                    logger.debug('autoMerge [' + projectId + '] completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('autoMerge ' + projectId + ' ' + mine + ' -> ' + theirs);

        getConnectedStorage(webgmeToken, projectId)
            .then(function (res) {
                var mergeLogger = logger.fork('merge');
                storage = res.storage || res;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));

                function mergeTillSyncOrConflict(currentMine) {
                    return merger.merge({
                        project: res.project,
                        gmeConfig: gmeConfig,
                        logger: mergeLogger,
                        myBranchOrCommit: currentMine,
                        theirBranchOrCommit: theirs,
                        auto: true
                    })
                        .then(function (result) {
                            if (result.conflict && result.conflict.items.length > 0) {
                                return result;
                            } else if (result.targetBranchName && !result.updatedBranch) {
                                return mergeTillSyncOrConflict(result.finalCommitHash);
                            } else {
                                return result;
                            }
                        });
                }

                mergeTillSyncOrConflict(mine)
                    .nodeify(finish);
            })
            .catch(finish)
            .done();
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {object} partial
     * @param {function} callback
     */
    function resolve(webgmeToken, partial, callback) {
        var storage,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('resolve [' + partial.projectId + '] failed with error', err);
                } else {
                    logger.debug('resolve [' + partial.projectId + '] completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('resolve ' + partial.projectId + ' ' + partial.baseCommitHash + ' -> ' + partial.branchName);

        getConnectedStorage(webgmeToken, partial.projectId)
            .then(function (res) {
                storage = res.storage || res;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));

                merger.resolve({
                    project: res.project,
                    gmeConfig: gmeConfig,
                    logger: logger.fork('merge'),
                    partial: partial
                })
                    .nodeify(finish);
            })
            .catch(finish)
            .done();
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {string} projectId
     * @param {object} parameters
     * @param {string} parameters.commitHash - State of project to check.
     * @param {string[]} parameters.nodePaths - Paths to nodes to be check.
     * @param {boolean} parameters.includeChildren - If truthy - will recursively check all the children of the nodes.
     * @param {string} [parameters.checkType='META'] - 'META', 'CUSTOM' or 'BOTH'.
     * @param {function} callback
     */
    function checkConstraints(webgmeToken, projectId, parameters, callback) {
        var storage,
            checkType,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('checkConstraints [' + projectId + '] failed with error', err);
                } else {
                    logger.debug('checkConstraints [' + projectId + '] completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('checkConstraints ' + projectId);

        if (typeof projectId !== 'string' || typeof parameters.commitHash !== 'string' ||
            typeof parameters.nodePaths !== 'object' || parameters.nodePaths instanceof Array !== true) {
            callback(new Error('invalid parameters: ' + JSON.stringify(parameters)));
            return;
        }

        if (parameters.checkType === constraint.TYPES.CUSTOM || parameters.checkType === constraint.TYPES.BOTH) {
            checkType = parameters.checkType;
            if (gmeConfig.core.enableCustomConstraints !== true) {
                callback(new Error('Custom constraints is not enabled!'));
                return;
            }
        } else {
            checkType = constraint.TYPES.META;
        }

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, projectId, parameters.commitHash, null);
            })
            .then(function (res) {
                var constraintChecker,
                    metaInconsistencies;

                function checkFromPath(nodePath) {
                    if (parameters.includeChildren) {
                        return constraintChecker.checkModel(nodePath);
                    } else {
                        return constraintChecker.checkNode(nodePath);
                    }
                }

                if (checkType === constraint.TYPES.META || checkType === constraint.TYPES.BOTH) {
                    metaInconsistencies = metaRules.checkMetaConsistency(res.core, res.rootNode);
                    if (metaInconsistencies.length > 0) {
                        return [{
                            info: 'Inconsistent Meta',
                            commit: parameters.commitHash,
                            hasViolation: true,
                            metaInconsistencies: metaInconsistencies
                        }];
                    }
                }

                constraintChecker = new constraint.Checker(res.core, logger);
                constraintChecker.initialize(res.rootNode, parameters.commitHash, checkType);

                return Q.all(parameters.nodePaths.map(checkFromPath));
            })
            .nodeify(finish);
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {object} parameters - One of rootHash, commitHash and branchName must be given.
     * @param {string} parameters.projectId
     * @param {string} [parameters.rootHash] - The hash of the tree root.
     * @param {string} [parameters.commitHash] - The tree associated with the commitHash.
     * @param {string} [parameters.branchName] - The tree at the given branch.
     * @param {string} [parameters.tagName] - The tree at the given tag.
     * @param {boolean} [parameters.withAssets=false] - Bundle the encountered assets linked from attributes.
     * @param {string} [parameters.kind] - If not given will use the one defined in project (if any).
     * @param {function} callback
     */
    function exportProjectToFile(webgmeToken, parameters, callback) {
        var storage,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('exportProjectToFile failed with error', err);
                } else {
                    logger.debug('exportProjectToFile completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('exportProjectToFile', {metadata: parameters});

        getConnectedStorage(webgmeToken, parameters.projectId)
            .then(function (res) {
                storage = res.storage || res;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));

                return serialization.exportProjectToFile(res.project, getBlobClient(webgmeToken), parameters);
            })
            .nodeify(finish);
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.commitHash
     * @param {string[]} parameters.paths
     * @param {boolean} [parameters.withAssets=false]
     * @param {function} callback
     */
    function exportSelectionToFile(webgmeToken, parameters, callback) {
        var storage,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('exportSelectionToFile failed with error', err);
                } else {
                    logger.debug('exportSelectionToFile completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('exportSelectionToFile', {metadata: parameters});

        getConnectedStorage(webgmeToken, parameters.projectId)
            .then(function (res) {
                storage = res.storage;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));

                return serialization.exportModelsToFile(res.project, getBlobClient(webgmeToken), parameters);
            })
            .nodeify(finish);
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.branchName
     * @param {string} parameters.blobHash
     * @param {string} parameters.parentPath - path to node where the selection should be imported.
     * @param {function} callback
     */
    function importSelectionFromFile(webgmeToken, parameters, callback) {
        var projectJson,
            context,
            storage,
            blobClient = getBlobClient(webgmeToken),
            checkSelectionValidity = function (parent, info) {
                var deferred = Q.defer(),
                    selectionNodes = [],
                    otherChildren = [],
                    selectionRelids = [],
                    hasError = false;
                
                Object.keys(info.relids).forEach(function (hash) {
                    selectionRelids.push(info.relids[hash]);
                });

                context.core.loadChildren(parent)
                    .then(function (children) {
                        var validMetaNodes;

                        children.forEach(function (child) {
                            if (selectionRelids.indexOf(context.core.getRelid(child)) !== -1) {
                                selectionNodes.push(child);
                            } else {
                                otherChildren.push(child);
                            }
                        });
                        validMetaNodes = context.core.getValidChildrenMetaNodes({
                            node: parent, 
                            children: otherChildren, 
                            multiplicity: true
                        });

                        selectionNodes.forEach(function (node) {
                            var hasValidBase = false;
                            validMetaNodes.forEach(function (base) {
                                if (context.core.isTypeOf(node, base)) {
                                    hasValidBase = true;
                                }
                            });
                            if (!hasValidBase) {
                                hasError = true;
                            }
                        });

                        if (hasError) {
                            deferred.reject(
                                new Error('The selection has elements that are not valid child of the target node!')
                            );
                        } else {
                            deferred.resolve();
                        }
                    });
                return deferred.promise;
            },
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('importSelectionFromFile failed with error', err);
                } else {
                    logger.debug('importSelectionFromFile completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('importSelectionFromFile', {metadata: parameters});

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));

                if (parameters.hasOwnProperty('parentPath') === false) {
                    throw new Error('No parentPath given');
                }
                return _getCoreAndRootNode(storage, parameters.projectId, null, parameters.branchName, null);
            })
            .then(function (context_) {
                context = context_;

                return _getProjectJsonFromBlob(blobClient, parameters.blobHash, false);
            })
            .then(function (res) {
                var contentJson = {
                    rootHash: null,
                    objects: res.projectJson.objects
                };

                projectJson = res.projectJson;

                return storageUtils.insertProjectJson(context.project,
                    contentJson,
                    {commitMessage: 'commit that represents the selection content'});
            })
            .then(function (commitResult) {
                logger.debug('Selection content was persisted [' + commitResult.hash + ']');
                return context.core.loadByPath(context.rootNode, parameters.parentPath);
            })
            .then(function (parent) {
                var closureInfo;

                if (parent === null) {
                    throw new Error('Given parentPath does not exist [' + parameters.parentPath + ']');
                }

                closureInfo = context.core.importClosure(parent, projectJson.selectionInfo);

                if (closureInfo instanceof Error) {
                    throw closureInfo;
                }

                return checkSelectionValidity(parent, closureInfo);
            })
            .then(function () {
                //now as everything is imported, we need to check if the models are even valid in their new context
                var persisted;

                persisted = context.core.persist(context.rootNode);

                return context.project.makeCommit(
                    parameters.branchName,
                    [context.commitObject._id],
                    persisted.rootHash,
                    persisted.objects,
                    'importing models');
            })
            .nodeify(finish);
    }


    function _persistLibrary(context, libraryName, branchName, update) {
        var persisted = context.core.persist(context.rootNode),
            info = context.core.getLibraryInfo(context.rootNode, libraryName),
            message = update ? 'updates library [' : 'adds library [';

        if (info.projectId) {
            message += info.projectId;
            if (info.branchName) {
                message += ':' + info.branchName;
                if (info.commitHash) {
                    message += '@' + info.commitHash;
                }
            } else if (info.commitHash) {
                message += ':' + info.commitHash;
            }
        } else {
            message += '_no_info_';
        }

        message += ']';

        return context.project.makeCommit(branchName, [context.commitObject._id], persisted.rootHash,
            persisted.objects, message);
    }

    /**
     * parameters.blobHash or parameters.libraryInfo must be given.
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.branchName
     * @param {string} parameters.libraryName
     * @param {string} [parameters.blobHash] - Add from an uploaded file.
     * @param {string} [parameters.seed] - Add from a seed on the server.
     * @param {object} [parameters.libraryInfo] - Add from an existing project.
     * @param {string} [parameters.libraryInfo.projectId] - if libraryInfo, projectId must be given.
     * @param {string} [parameters.libraryInfo.branchName] - if libraryInfo and not commitHash, it must be given.
     * @param {string} [parameters.libraryInfo.commitHash] - if libraryInfo and not branchName, it must be given.
     * @param {function} callback
     */
    function addLibrary(webgmeToken, parameters, callback) {
        var projectJson,
            context,
            storage,
            blobClient = getBlobClient(webgmeToken),
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('addLibrary failed with error', err);
                } else {
                    logger.debug('addLibrary completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('addLibrary', {metadata: parameters});

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, parameters.projectId, null, parameters.branchName, null);
            })
            .then(function (context_) {
                context = context_;

                if (typeof parameters.libraryName !== 'string' ||
                    context.core.getLibraryNames(context.rootNode).indexOf(parameters.libraryName) !== -1) {
                    throw new Error('New library name should be unique [' + parameters.libraryName + ']!');
                }

                if (parameters.blobHash) {
                    return _getProjectJsonFromBlob(blobClient, parameters.blobHash, true);
                } else if (parameters.libraryInfo) {
                    if (parameters.libraryInfo.projectId === parameters.projectId) {
                        throw new Error('Not allowed to add self as a library [' + parameters.projectId + ']');
                    }

                    return _getProjectJsonFromProject(storage,
                        parameters.libraryInfo.projectId,
                        parameters.libraryInfo.branchName,
                        parameters.libraryInfo.commitHash);

                } else if (parameters.seed) {
                    return _getProjectJsonFromFileSeed(parameters.seed, webgmeToken);
                } else {
                    throw new Error('Missing information about the library to add.');
                }
            })
            .then(function (res) {
                projectJson = res.projectJson;

                return storageUtils.insertProjectJson(context.project, projectJson,
                    {commitMessage: 'commit that represents the library to be imported'});
            })
            .then(function (/*commitResult*/) {

                return context.core.addLibrary(context.rootNode, parameters.libraryName, projectJson.rootHash, {
                    projectId: projectJson.projectId,
                    branchName: projectJson.branchName,
                    commitHash: projectJson.commitHash
                });
            })
            .then(function () {
                return _persistLibrary(context, parameters.libraryName, parameters.branchName, false);
            })
            .nodeify(finish);
    }

    /**
     * If blobHash nor libraryInfo is given, will attempt to "refresh" library based on the
     * libraryInfo stored at the library node.
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.branchName
     * @param {string} parameters.libraryName
     * @param {string} [parameters.blobHash] - Update from an uploaded file.
     * @param {string} [parameters.seed] - Update from a seed on the server.
     * @param {object} [parameters.libraryInfo] - Update from an existing project.
     * @param {string} [parameters.libraryInfo.projectId] - if libraryInfo, projectId must be given.
     * @param {string} [parameters.libraryInfo.branchName] - if libraryInfo and not commitHash, it must be given.
     * @param {string} [parameters.libraryInfo.commitHash] - if libraryInfo and not branchName, it must be given.
     * @param {function} callback
     */
    function updateLibrary(webgmeToken, parameters, callback) {
        var projectId = parameters.projectId,
            context,
            storage,
            projectJson,
            blobClient = getBlobClient(webgmeToken),
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('updateLibrary failed with error', err);
                } else {
                    logger.debug('updateLibrary completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('updateLibrary', {metadata: parameters});

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, projectId, null, parameters.branchName, null);
            })
            .then(function (context_) {
                var libs = context_.core.getLibraryNames(context_.rootNode),
                    libraryInfo;

                context = context_;

                if (libs.indexOf(parameters.libraryName) < 0) {
                    throw new Error('No such library "' + parameters.libraryName +
                        '" among [' + libs.toString() + '].');
                }

                libraryInfo = context_.core.getLibraryInfo(context_.rootNode, parameters.libraryName);

                if (parameters.blobHash) {
                    return _getProjectJsonFromBlob(blobClient, parameters.blobHash, true);
                } else if (parameters.libraryInfo) {
                    return _getProjectJsonFromProject(storage,
                        parameters.libraryInfo.projectId,
                        parameters.libraryInfo.branchName,
                        parameters.libraryInfo.commitHash);
                } else if (parameters.seed) {
                    return _getProjectJsonFromFileSeed(parameters.seed, webgmeToken);
                } else if (libraryInfo && libraryInfo.projectId && libraryInfo.branchName) {
                    // We have to dig out library info from our own project
                    if (projectId === libraryInfo.projectId) {
                        throw new Error('Automatic update of self-contained libraries are not allowed!');
                    }

                    return _getProjectJsonFromProject(storage, libraryInfo.projectId, libraryInfo.branchName, null);
                } else {
                    throw new Error('only libraries that follows branch can be refreshed!');
                }
            })
            .then(function (res) {
                projectJson = res.projectJson;
                return storageUtils.insertProjectJson(context.project, projectJson, {
                    commitMessage: 'commit that represents the library to be updated'
                });
            })
            .then(function (/*commitResult*/) {
                return context.core.updateLibrary(context.rootNode, parameters.libraryName, projectJson.rootHash, {
                    projectId: projectJson.projectId,
                    branchName: projectJson.branchName,
                    commitHash: projectJson.commitHash
                }, null/*placeholder for instructions*/);
            })
            .then(function () {
                return _persistLibrary(context, parameters.libraryName, parameters.branchName, true);
            })
            .nodeify(finish);
    }

    /**
     *
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     *
     * @param {string} [parameters.commitHash] - Specific commit to update from
     * @param {string} [parameters.branchName] - Branch to update from and update the branch hash
     * @param {string} [parameters.tagName] - Specific tag to update from
     *
     * @param {string} [parameters.blobHash] - Provide if webgmex file is in blob storage
     * @param {string} [parameters.seedName] - Provide if webgmex is a seed.
     * @param {function} callback
     */
    function updateProjectFromFile(webgmeToken, parameters, callback) {
        var projectJson,
            context,
            storage,
            blobClient = getBlobClient(webgmeToken),
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('updateProjectFromFile failed with error', err);
                } else {
                    logger.debug('updateProjectFromFile completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        logger.debug('updateProjectFromFile', {metadata: parameters});

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, parameters.projectId,
                    parameters.commitHash, parameters.branchName, parameters.tagName);
            })
            .then(function (context_) {
                context = context_;
                if (parameters.blobHash) {
                    return _getProjectJsonFromBlob(blobClient, parameters.blobHash, true);
                } else if (parameters.seedName) {
                    return _getProjectJsonFromFileSeed(parameters.seedName, webgmeToken);
                } else {
                    throw new Error('blobHash or seedName must be provided');
                }
            })
            .then(function (res) {
                projectJson = res.projectJson;

                // This resolves with commitResult.
                return storageUtils.insertProjectJson(context.project, projectJson, {
                    branch: parameters.branchName,
                    parentCommit: [context.commitObject[STORAGE_CONSTANTS.MONGO_ID]],
                    commitMessage: 'update project from file'
                });
            })
            .nodeify(finish);
    }

    /**
     * It gathers the information on which meta nodes define / alter the given concept
     * (pointer/set/attribute/aspect) and renames all of them. It also propagates the renaming throughout
     * the whole project.
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.branchName
     * @param {string} parameters.nodePath - the starting meta node's path.
     * @param {string} parameters.type - the type of the definitions to rename ['pointer'|'set'|'attribute'|'aspect].
     * @param {string} parameters.oldName - the current name of the concept.
     * @param {string} parameters.newName - the new name of the concept.
     * @param {function} callback
     */
    function renameConcept(webgmeToken, parameters, callback) {
        var storage,
            context,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('renameConcept failed with error', err);
                } else {
                    logger.debug('renameConcept completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, parameters.projectId, undefined, parameters.branchName, undefined);
            })
            .then(function (context_) {
                context = context_;
                return context.core.loadByPath(context.rootNode, parameters.nodePath);
            })
            .then(function (node) {
                return metaRename.metaConceptRename(context.core, node, parameters.type,
                    parameters.oldName, parameters.newName);
            })
            .then(function () {
                var persisted = context.core.persist(context.rootNode);

                return context.project.makeCommit(
                    parameters.branchName,
                    [context.commitObject._id],
                    persisted.rootHash,
                    persisted.objects,
                    'rename concept [' + parameters.oldName + '->' + parameters.newName +
                    '] of [' + parameters.nodePath + ']');
            })
            .nodeify(finish);
    }

    /**
     * Renames the given attribute definition and propagates the change throughout the whole project.
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.branchName
     * @param {string} parameters.nodePath - the starting meta node's path.
     * @param {string} parameters.oldName - the current name of the attribute definition.
     * @param {string} parameters.newName - the new name of the attribute definition.
     * @param {function} callback
     */
    function changeAttributeMeta(webgmeToken, parameters, callback) {
        var storage,
            context,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('changeAttributeMeta failed with error', err);
                } else {
                    logger.debug('changeAttributeMeta completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, parameters.projectId, parameters.commitHash,
                    parameters.branchName, parameters.tagName);
            })
            .then(function (context_) {
                context = context_;
                return context.core.loadByPath(context.rootNode, parameters.nodePath);
            })
            .then(function (node) {
                context.core.renameAttributeMeta(node, parameters.oldName, parameters.newName);
                context.core.setAttributeMeta(node, parameters.newName, parameters.meta);
                parameters.excludeOriginNode = true;
                parameters.type = 'attribute';
                return metaRename.propagateMetaDefinitionRename(context.core, node, parameters);
            })
            .then(function () {
                var persisted = context.core.persist(context.rootNode);

                return context.project.makeCommit(
                    parameters.branchName,
                    [context.commitObject._id],
                    persisted.rootHash,
                    persisted.objects,
                    'rename attribute definition [' + parameters.oldName + '->' + parameters.newName +
                    '] of [' + parameters.nodePath + ']');
            })
            .nodeify(finish);
    }

    /**
     * Renames the given pointer relation definitions and propagates the change throughout the whole project.
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.branchName
     * @param {string} parameters.type - the type of the relation ['pointer'|'set'].
     * @param {string} parameters.nodePath - the starting meta node's path.
     * @param {string} parameters.targetPath - the path of the meta node that is the target of
     * the relationship definition.
     * @param {string} parameters.oldName - the current name of the concept.
     * @param {string} parameters.newName - the new name of the concept.
     * @param {function} callback
     */
    function renameMetaPointerTarget(webgmeToken, parameters, callback) {
        var storage,
            context,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('changeAttributeMeta failed with error', err);
                } else {
                    logger.debug('changeAttributeMeta completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, parameters.projectId, parameters.commitHash,
                    parameters.branchName, parameters.tagName);
            })
            .then(function (context_) {
                context = context_;
                return Q.all([context.core.loadByPath(context.rootNode, parameters.nodePath),
                    context.core.loadByPath(context.rootNode, parameters.targetPath)]);
            })
            .then(function (nodes) {
                context.core.movePointerMetaTarget(nodes[0], nodes[1], parameters.oldName, parameters.newName);
                return metaRename.propagateMetaDefinitionRename(context.core, nodes[0], parameters);
            })
            .then(function () {
                var persisted = context.core.persist(context.rootNode);

                return context.project.makeCommit(
                    parameters.branchName,
                    [context.commitObject._id],
                    persisted.rootHash,
                    persisted.objects,
                    'rename pointer definition [' + parameters.oldName + '->' +
                    parameters.newName + '] of [' + parameters.nodePath + '] regarding target [' +
                    parameters.targetPath + ']');
            })
            .nodeify(finish);
    }

    /**
     * Renames the given aspect definition and propagates the change throughout the whole project.
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.branchName
     * @param {string} parameters.nodePath - the starting meta node's path.
     * @param {string} parameters.oldName - the current name of the aspect definition.
     * @param {string} parameters.newName - the new name of the aspect definition.
     * @param {function} callback
     */
    function changeAspectMeta(webgmeToken, parameters, callback) {
        var storage,
            context,
            node,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('changeAspectMeta failed with error', err);
                } else {
                    logger.debug('changeAspectMeta completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, parameters.projectId, parameters.commitHash,
                    parameters.branchName, parameters.tagName);
            })
            .then(function (context_) {
                context = context_;
                return context.core.loadByPath(context.rootNode, parameters.nodePath);
            })
            .then(function (node_) {
                var promises = [],
                    i;
                node = node_;

                for (i = 0; i < parameters.meta.length; i += 1) {
                    promises.push(context.core.loadByPath(context.rootNode, parameters.meta[i]));
                }
                return Q.all(promises);
            })
            .then(function (members) {
                var oldMembers = context.core.getAspectMeta(node, parameters.oldName),
                    sameMembers = _.intersection(oldMembers, parameters.meta),
                    newMembers = _.difference(parameters.meta, oldMembers),
                    nodes = {},
                    i;

                for (i = 0; i < members.length; i += 1) {
                    nodes[context.core.getPath(members[i])] = members[i];
                }

                for (i = 0; i < sameMembers.length; i += 1) {
                    context.core.moveAspectMetaTarget(node, nodes[sameMembers[i]],
                        parameters.oldName, parameters.newName);
                }

                for (i = 0; i < newMembers.length; i += 1) {
                    context.core.setAspectMetaTarget(node, parameters.newName, nodes[newMembers[i]]);
                }

                context.core.renameSet(node, parameters.oldName, parameters.newName);
                context.core.delAspectMeta(node, parameters.oldName);
                return metaRename.propagateMetaDefinitionRename(context.core, node, {
                    excludeOriginNode: true,
                    type: 'aspect',
                    oldName: parameters.oldName,
                    newName: parameters.newName
                });
            })
            .then(function () {
                var persisted = context.core.persist(context.rootNode);

                return context.project.makeCommit(
                    parameters.branchName,
                    [context.commitObject._id],
                    persisted.rootHash,
                    persisted.objects,
                    'rename aspect definition [' + parameters.oldName +
                    '->' + parameters.newName + '] of [' + parameters.nodePath + ']');
            })
            .nodeify(finish);
    }

    /**
     * Renames the given aspect definition and propagates the change throughout the whole project.
     * @param {string} webgmeToken
     * @param {object} parameters
     * @param {string} parameters.projectId
     * @param {string} parameters.branchName
     * @param {string} parameters.nodePath - the starting meta node's path.
     * @param {'attribute'|'pointer'|'set'|'containment'|'aspect'} parameters.type - the type of the rule
     * that needs to be removed.
     * @param {string} parameters.name - the name of the definition.
     * @param {string} parameters.targetPath - in case of relational rules, there must be a target node.
     * @param {function} callback
     */
    function removeMetaRule(webgmeToken, parameters, callback) {
        var storage,
            context,
            node,
            finish = function (err, result) {
                if (err) {
                    err = err instanceof Error ? err : new Error(err);
                    logger.error('removeMetaRule failed with error', err);
                } else {
                    logger.debug('removeMetaRule completed');
                }

                if (storage) {
                    storage.close(function (closeErr) {
                        callback(err || closeErr, result);
                    });
                } else {
                    callback(err, result);
                }
            };

        getConnectedStorage(webgmeToken)
            .then(function (storage_) {
                storage = storage_;
                storage.addEventListener(storage.CONSTANTS.NETWORK_STATUS_CHANGED,
                    getNetworkStatusChangeHandler(finish));
                return _getCoreAndRootNode(storage, parameters.projectId, parameters.commitHash,
                    parameters.branchName, parameters.tagName);
            })
            .then(function (context_) {
                context = context_;
                return context.core.loadByPath(context.rootNode, parameters.nodePath);
            })
            .then(function (node_) {
                node = node_;
                switch (parameters.type) {
                    case 'attribute':
                        context.core.delAttributeMeta(node, parameters.name);
                        break;
                    case 'pointer':
                    case 'set':
                        context.core.delPointerMetaTarget(node, parameters.name, parameters.targetPath);
                        if (context.core.getValidTargetPaths(node, parameters.name).length === 0) {
                            context.core.delPointerMeta(node, parameters.name);
                        }
                        break;
                    case 'containment':
                        context.core.delChildMeta(node, parameters.targetPath);
                        break;
                    case 'aspect':
                        if (typeof parameters.targetPath === 'string') {
                            context.core.delAspectMetaTarget(node, parameters.name, parameters.targetPath);
                        }

                        if (typeof parameters.targetPath !== 'string') {
                            context.core.delAspectMeta(node, parameters.name);
                        }
                }

                return metaRename.propagateMetaDefinitionRemove(context.core, node, parameters);
            })
            .then(function () {
                var persisted;

                persisted = context.core.persist(context.rootNode);

                context.project.makeCommit(
                    parameters.branchName,
                    [context.commitObject._id],
                    persisted.rootHash,
                    persisted.objects,
                    'remove meta definition [' + parameters.name + '] of [' + parameters.nodePath + ']');
            })
            .nodeify(finish);
    }

    return {
        executePlugin: executePlugin,
        seedProject: seedProject,
        diff: diff,
        autoMerge: autoMerge,
        resolve: resolve,
        checkConstraints: checkConstraints,
        exportProjectToFile: exportProjectToFile,
        importProjectFromFile: function (webgmeToken, parameters, callback) {
            var params = {
                type: 'blob',
                seedName: parameters.blobHash,

                kind: parameters.kind
            };

            seedProject(webgmeToken, parameters.projectName, parameters.ownerId, params, function (err, res) {
                res = res ? res.projectId : res;
                callback(err, res);
            });
        },
        exportSelectionToFile: exportSelectionToFile,
        importSelectionFromFile: importSelectionFromFile,
        addLibrary: addLibrary,
        updateLibrary: updateLibrary,
        updateProjectFromFile: updateProjectFromFile,
        renameConcept: renameConcept,
        changeAttributeMeta: changeAttributeMeta,
        renameMetaPointerTarget: renameMetaPointerTarget,
        changeAspectMeta: changeAspectMeta,
        removeMetaRule: removeMetaRule,

        // This is exposed for unit tests and reuse..
        _addZippedExportToBlob: _extractProjectJsonAndAddAssets,
        _getProjectJsonFromFileSeed: _getProjectJsonFromFileSeed,
    };
}

module.exports = WorkerRequests;