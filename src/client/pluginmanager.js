/*globals define*/
/*eslint-env browser*/

/**
 * @author pmeijer / https://github.com/pmeijer
 */


define([
    'plugin/managerbase',
    'blob/BlobClient',
    'common/storage/project/project',
    'common/Constants',
    'common/util/key',
    'q',
    'superagent'
], function (PluginManagerBase, BlobClient, Project, CONSTANTS, generateKey, Q, superagent) {
    'use strict';

    var ROOT_PATH = '';

    /**
     *
     * @param client
     * @param storage
     * @param state
     * @param mainLogger
     * @param gmeConfig
     * @constructor
     */
    function PluginManager(client, storage, state, mainLogger, gmeConfig) {

        var self = this,
            logger = mainLogger.fork('PluginManager'),
            runningPlugins = {};

        this.getCurrentPluginContext = function (pluginId, activeNodeId, activeSelectionIds) {
            var activeNode,
                validPlugins,
                context = {
                    managerConfig: {
                        project: client.getProjectObject(),
                        branchName: client.getActiveBranchName(),
                        commitHash: client.getActiveCommitHash(),
                        activeNode: ROOT_PATH,
                        activeSelection: [],
                        namespace: ''
                    },
                    pluginConfig: null
                };

            // If executed from the Generic UI we can access the active- and selected-nodes.
            if (typeof WebGMEGlobal !== 'undefined') {
                /* eslint-disable no-undef*/
                context.managerConfig.activeSelection = WebGMEGlobal.State.getActiveSelection();
                context.managerConfig.activeNode = WebGMEGlobal.State.getActiveObject();
                /* eslint-enable no-undef*/
            }

            if (activeSelectionIds) {
                context.managerConfig.activeSelection = activeSelectionIds;
            }

            if (typeof activeNodeId === 'string') {
                context.managerConfig.activeNode = activeNodeId;
            }

            // Given the active-node we infer the namespace (user may still select another one).
            activeNodeId = context.managerConfig.activeNode;
            if (activeNodeId && pluginId) {
                activeNode = client.getNode(activeNodeId);
                if (activeNode === null) {
                    logger.warn('Getting context for non-available' + 
                        ' node is dangerous and could lead to failed plugin execution [' + 
                        pluginId + '][' + activeNodeId + '].');
                    return context;
                }
                do {
                    validPlugins = activeNode.getOwnRegistry('validPlugins');
                    if (validPlugins && validPlugins.indexOf(pluginId) > -1) {
                        // The plugin was defined at this particular node, we use the namespace of it.
                        context.managerConfig.namespace = activeNode.getNamespace();
                        break;
                    }

                    activeNode = activeNode.getBaseId() ? client.getNode(activeNode.getBaseId()) : null;
                } while (activeNode);
            }

            return context;
        };

        function getPluginMetadata(pluginId) {
            var deferred = Q.defer();

            superagent.get(gmeConfig.client.mountedPath + '/api/plugins/' + pluginId + '/metadata')
                .end(function (err, res) {
                    if (err) {
                        deferred.reject(err);
                    }
                    deferred.resolve(res.body);
                });

            return deferred.promise;
        }

        function getSanitizedManagerConfig(config) {
            var sanitized = {},
                keys = Object.keys(config);

            keys.forEach(function (key) {
                switch (key) {
                    case 'project':
                        if (typeof config.project === 'string') {
                            sanitized.project = config.project;
                        } else {
                            sanitized.project = config.project.projectId;
                        }
                        break;
                    default:
                        sanitized[key] = config[key];

                }
            });

            return sanitized;
        }

        function getSanitizedPluginContext(context) {
            var sanitized = {},
                keys = Object.keys(context);

            keys.forEach(function (key) {
                switch (key) {
                    case 'managerConfig':
                        sanitized.managerConfig = getSanitizedManagerConfig(context.managerConfig);
                        break;
                    default:
                        sanitized[key] = context[key];

                }
            });

            return sanitized;
        }

        function getSanitizedPluginEntry(pluginEntry) {
            var sanitized = {},
                keys = Object.keys(pluginEntry);

            keys.forEach(function (key) {
                switch (key) {
                    case 'plugin':
                        break;
                    case 'context':
                        sanitized.context = getSanitizedPluginContext(pluginEntry.context);
                        break;
                    default:
                        sanitized[key] = pluginEntry[key];
                }
            });

            return sanitized;
        }

        /**
         * Run the plugin in the browser.
         * @param {string|function} pluginIdOrClass - id or class for plugin.
         * @param {object} context
         * @param {object} context.managerConfig - where the plugin should execute.
         * @param {ProjectInterface} context.managerConfig.project - project (e.g. client.getProjectObject()).
         * @param {string} [context.managerConfig.activeNode=''] - path to activeNode.
         * @param {string} [context.managerConfig.activeSelection=[]] - paths to selected nodes.
         * @param {string} context.managerConfig.commitHash - commit hash to start the plugin from.
         * @param {string} [context.managerConfig.branchName] - branch which to save to.
         * @param {string} [context.managerConfig.namespace=''] - used namespace ('' represents root namespace).
         * @param {object} [context.pluginConfig=%defaultForPlugin%] - specific configuration for the plugin.
         * @param {function(err, PluginResult)} callback
         */
        this.runBrowserPlugin = function (pluginIdOrClass, context, callback) {
            var pluginEntry,
                blobClient = new BlobClient({
                    logger: logger.fork('BlobClient'),
                    relativeUrl: gmeConfig.client.mountedPath + '/rest/blob/'
                }),
                pluginManager = new PluginManagerBase(blobClient, null, mainLogger, gmeConfig),
                plugin,
                executionId;

            pluginManager.browserSide = true;

            pluginManager.projectAccess = client.getProjectAccess();

            pluginManager.notificationHandlers = [function (data, callback) {
                data.executionId = executionId;
                self.dispatchPluginNotification(data);
                callback(null);
            }];

            // pluginManager.executePlugin(pluginIdOrClass, context.pluginConfig, context.managerConfig, callback);
            pluginManager.initializePlugin(pluginIdOrClass)
                .then(function (plugin_) {
                    plugin = plugin_;

                    pluginEntry = {
                        id: plugin.getId(),
                        name: plugin.getName(),
                        plugin: plugin,
                        metadata: plugin.pluginMetadata,
                        context: context,
                        canBeAborted: plugin.pluginMetadata.canBeAborted,
                        start: Date.now(),
                        clientSide: true,
                        executionId: null,
                        result: null
                    };

                    executionId = generateKey({
                        id: pluginEntry.id,
                        name: pluginEntry.name,
                        start: pluginEntry.start
                    }, gmeConfig);
                    pluginEntry.executionId = executionId;
                    runningPlugins[executionId] = pluginEntry;

                    return pluginManager.configurePlugin(plugin, context.pluginConfig, context.managerConfig);
                })
                .then(function () {
                    return Q.ninvoke(pluginManager, 'runPluginMain', plugin);
                })
                .then(function (result) {
                    if (runningPlugins.hasOwnProperty(executionId)) {
                        delete runningPlugins[executionId];
                    } else {
                        logger.error('Running plugin registry misses entry [' + pluginEntry.id +
                            '][' + executionId + '].');
                    }
                    pluginEntry.result = result;
                    client.dispatchEvent(client.CONSTANTS.PLUGIN_FINISHED, getSanitizedPluginEntry(pluginEntry));
                    callback(null, result);
                })
                .catch(function (err) {
                    if (runningPlugins.hasOwnProperty(executionId)) {
                        delete runningPlugins[executionId];
                    } else {
                        logger.error('Running plugin registry misses entry [' + pluginEntry.id +
                            '][' + executionId + '].');
                    }
                    pluginEntry.result = null;
                    client.dispatchEvent(client.CONSTANTS.PLUGIN_FINISHED, getSanitizedPluginEntry(pluginEntry));
                    var pluginResult = pluginManager.getPluginErrorResult(
                        plugin.getId(),
                        plugin.getName(),
                        'Exception was raised, err: ' + err.stack, plugin && plugin.projectId
                    );
                    logger.error(err.stack);
                    callback(err.message, pluginResult);
                })
                .done();
        };

        /**
         * Run the plugin on the server inside a worker process.
         * @param {string|function} pluginIdOrClass - id or class for plugin.
         * @param {object} context
         * @param {object} context.managerConfig - where the plugin should execute.
         * @param {ProjectInterface|string} context.managerConfig.project - project or id of project.
         * @param {string} [context.managerConfig.activeNode=''] - path to activeNode.
         * @param {string} [context.managerConfig.activeSelection=[]] - paths to selected nodes.
         * @param {string} context.managerConfig.commitHash - commit hash to start the plugin from.
         * @param {string} [context.managerConfig.branchName] - branch which to save to.
         * @param {string} [context.managerConfig.namespace=''] - used namespace ('' represents root namespace).
         * @param {object} [context.pluginConfig=%defaultForPlugin%] - specific configuration for the plugin.
         * @param {function} callback
         */
        this.runServerPlugin = function (pluginIdOrClass, context, callback) {
            var pluginEntry,
                executionId,
                pluginId = typeof pluginIdOrClass === 'string' ? pluginIdOrClass : pluginIdOrClass.metadata.id;
            if (context.managerConfig.project instanceof Project) {
                context.managerConfig.project = context.managerConfig.project.projectId;
            }

            getPluginMetadata(pluginId)
                .then(function (metadata) {
                    pluginEntry = {
                        id: pluginId,
                        name: metadata.name,
                        plugin: null,
                        metadata: metadata,
                        context: context,
                        canBeAborted: metadata.canBeAborted,
                        start: Date.now(),
                        clientSide: false,
                        executionId: null,
                        result: null
                    };

                    executionId = generateKey({
                        id: pluginId,
                        name: pluginEntry.name,
                        start: pluginEntry.start
                    }, gmeConfig);
                    pluginEntry.executionId = executionId;
                    runningPlugins[executionId] = pluginEntry;

                    context.executionId = executionId;

                    storage.simpleRequest({
                        command: CONSTANTS.SERVER_WORKER_REQUESTS.EXECUTE_PLUGIN,
                        name: pluginId,
                        context: context
                    }, function (err, result) {
                        if (runningPlugins.hasOwnProperty(executionId)) {
                            delete runningPlugins[executionId];
                        } else {
                            logger.error('Running plugin registry misses entry [' + pluginEntry.id +
                                '][' + executionId + '].');
                        }

                        pluginEntry.result = result;
                        client.dispatchEvent(client.CONSTANTS.PLUGIN_FINISHED, getSanitizedPluginEntry(pluginEntry));
                        if (err) {
                            callback(err, err.result);
                        } else {
                            callback(null, result);
                        }
                    });
                })
                .catch(function (err) {
                    callback(err, null);
                });
        };

        /**
         * @param {string[]} pluginIds - All available plugins on the server.
         * @param {string} [nodePath=''] - Node to get the validPlugins from.
         * @returns {string[]} - Filtered plugin ids.
         */
        this.filterPlugins = function (pluginIds, nodePath) {
            var filteredIds = [],
                validPlugins,
                i,
                node;

            logger.debug('filterPluginsBasedOnNode allPlugins, given nodePath', pluginIds, nodePath);
            if (!nodePath) {
                logger.debug('filterPluginsBasedOnNode nodePath not given - will fall back on root-node.');
                nodePath = ROOT_PATH;
            }

            node = state.nodes[nodePath];

            if (!node) {
                logger.warn('filterPluginsBasedOnNode node not loaded - will fall back on root-node.', nodePath);
                nodePath = ROOT_PATH;
                node = state.nodes[nodePath];
            }

            if (!node) {
                logger.warn('filterPluginsBasedOnNode root node not loaded - will return full list.');
                return pluginIds;
            }

            validPlugins = (state.core.getRegistry(node.node, 'validPlugins') || '').split(' ');
            for (i = 0; i < validPlugins.length; i += 1) {
                if (pluginIds.indexOf(validPlugins[i]) > -1) {
                    filteredIds.push(validPlugins[i]);
                } else if (validPlugins[i] === '') {
                    // Skip empty strings..
                } else {
                    logger.warn('Registered plugin for node at path "' + nodePath +
                        '" is not amongst available plugins', pluginIds);
                }
            }

            return filteredIds;
        };

        this.dispatchPluginNotification = function (data) {
            var notification = {
                severity: data.notification.severity || 'info',
                message: '[Plugin] ' + data.pluginName + ' - ' + data.notification.message
            };

            if (typeof data.notification.progress === 'number') {
                notification.message += ' [' + data.notification.progress + '%]';
            }

            logger.debug('plugin notification', data);
            if (data.notification && data.notification.type === CONSTANTS.STORAGE.PLUGIN_NOTIFICATION_TYPE.INITIATED) {
                if (runningPlugins.hasOwnProperty(data.executionId)) {
                    runningPlugins[data.executionId].socketId = data.pluginSocketId;
                    client.dispatchEvent(client.CONSTANTS.PLUGIN_INITIATED,
                        getSanitizedPluginEntry(runningPlugins[data.executionId]));
                }
            } else {
                client.dispatchEvent(client.CONSTANTS.NOTIFICATION, notification);
                client.dispatchEvent(client.CONSTANTS.PLUGIN_NOTIFICATION, data);
            }

        };

        this.getRunningPlugins = function () {
            var sanitizedData = {},
                executionIds = Object.keys(runningPlugins);

            executionIds.forEach(function (executionId) {
                if (runningPlugins.hasOwnProperty(executionId)) {
                    sanitizedData[executionId] = getSanitizedPluginEntry(runningPlugins[executionId]);
                }
            });
            return sanitizedData;
        };

        this.abortPlugin = function (pluginExecutionId) {
            var pluginEntry = runningPlugins[pluginExecutionId];
            if (pluginEntry) {
                if (!pluginEntry.metadata.canBeAborted) {
                    throw new Error('Aborting plugin [' + pluginEntry.name + '] is not allowed.');
                }

                if (pluginEntry.clientSide) {
                    pluginEntry.plugin.onAbort();
                } else if (pluginEntry.socketId) {
                    storage.sendNotification({
                        type: CONSTANTS.STORAGE.PLUGIN_NOTIFICATION,
                        notification: {
                            toBranch: false,
                            type: CONSTANTS.STORAGE.PLUGIN_NOTIFICATION_TYPE.ABORT,
                            executionId: pluginExecutionId
                        },
                        originalSocketId: pluginEntry.socketId,
                    });
                }
            }
        };

        this.sendMessageToPlugin = function (pluginExecutionId, messageId, content) {
            var pluginEntry = runningPlugins[pluginExecutionId];
            if (pluginEntry) {
                if (pluginEntry.clientSide) {
                    pluginEntry.plugin.onMessage(messageId, content);
                } else if (pluginEntry.socketId) {
                    storage.sendNotification({
                        type: CONSTANTS.STORAGE.PLUGIN_NOTIFICATION,
                        notification: {
                            toBranch: false,
                            type: CONSTANTS.STORAGE.PLUGIN_NOTIFICATION_TYPE.MESSAGE,
                            executionId: pluginExecutionId,
                            messageId: messageId,
                            content: content
                        },
                        originalSocketId: pluginEntry.socketId,
                    });
                }
            }
        };
    }

    return PluginManager;

});
