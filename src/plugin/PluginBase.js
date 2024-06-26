/*globals define, requirejs*/
/*eslint-env node, browser*/

/**
 * This is the base class that plugins should inherit from.
 * (Using the PluginGenerator - the generated plugin will do that.)
 *
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            'q',
            'plugin/PluginConfig',
            'plugin/PluginResultBase',
            'plugin/PluginResult',
            'plugin/InterPluginResult',
            'plugin/PluginMessage',
            'plugin/PluginNodeDescription',
            'plugin/util',
            'common/storage/constants'
        ], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('q'),
            require('./PluginConfig'),
            require('./PluginResultBase'),
            require('./PluginResult'),
            require('./InterPluginResult'),
            require('./PluginMessage'),
            require('./PluginNodeDescription'),
            require('./util'),
            require('../common/storage/constants')
        );
    }
}(function (Q,
            PluginConfig,
            PluginResultBase,
            PluginResult,
            InterPluginResult,
            PluginMessage,
            PluginNodeDescription,
            pluginUtil,
            STORAGE_CONSTANTS) {
    'use strict';

    /**
     * Initializes a new instance of a plugin object, which should be a derived class.
     *
     * @constructor
     * @alias PluginBase
     */
    function PluginBase() {
        // set by initialize

        /**
         * @type {PluginMetadata}
         */
        this.pluginMetadata = null;

        /**
         * @type {GmeConfig}
         */
        this.gmeConfig = null;

        /**
         * @type {GmeLogger}
         */
        this.logger = null;

        /**
         * @type {BlobClient}
         */
        this.blobClient = null;

        this._currentConfig = null;

        // set by configure

        /**
         * @type {Core}
         */
        this.core = null;

        /**
         * @type {ProjectInterface}
         */
        this.project = null;

        this.projectName = null;
        this.projectId = null;
        this.branchName = null;

        this.branchHash = null;
        this.commitHash = null;
        this.currentHash = null;

        /**
         * @type {module:Core~Node}
         */
        this.rootNode = null;

        /**
         * @type {module:Core~Node}
         */
        this.activeNode = null;

        /**
         * @type {module:Core~Node[]}
         */
        this.activeSelection = [];

        /**
         * The namespace the META nodes are coming from (set by invoker).
         * The default is the full meta, i.e. the empty string namespace.
         * For example, if a project has a library A with a library B. The possible namespaces are:
         * '', 'A' and 'A.B'.
         * @type {string}
         */
        this.namespace = '';

        /**
         * The resolved META nodes based on the active namespace. Index by the fully qualified meta node names
         * with the namespace stripped off at the start.
         *
         * For example, if a project has a library A with a library B. If the project and the libraries all have
         * two meta nodes named a and b. Depending on the namespace the META will have the following keys:
         *
         * 1) namespace = '' -> ['a', 'b', 'A.a', 'A.b', 'A.B.a', 'A.B.b']
         * 2) namespace = 'A' -> ['a', 'b', 'B.a', 'B.b']
         * 3) namespace = 'A.B' -> ['a', 'b']
         *
         * (N.B. 'a' and 'b' in example 3) are pointing to the meta nodes defined in A.B.)
         *
         * @type {Object<string, module:Core~Node>}
         */
        this.META = null;

        /**
         * @type {PluginResultBase}
         */
        this.result = null;

        this.isConfigured = false;

        this.callDepth = 0;

        this.notificationHandlers = [];

        this.invokedPlugins = [];
    }

    //<editor-fold desc="Methods must be overridden by the derived classes">

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * <br>- Do NOT use console.log use this.logger.[error,warning,info,debug] instead.
     * <br>- Do NOT put any user interaction logic UI, etc. inside this function.
     * <br>- callback always have to be called even if error happened.
     *
     * @param {function} callback - the result callback
     * @param {null|Error} callback.err - status of the call
     * @param {PluginResult} callback.result - plugin result
     */
    PluginBase.prototype.main = function (/*callback*/) {
        throw new Error('implement this function in the derived class');
    };

    /**
     * Readable name of this plugin that can contain spaces.
     *
     * @returns {string}
     */
    PluginBase.prototype.getId = function () {
        if (this.pluginMetadata) {
            return this.pluginMetadata.id;
        } else {
            throw new Error('pluginMetadata is not defined - implement this function in the derived class');
        }
    };

    /**
     * Readable name of this plugin that can contain spaces.
     *
     * @returns {string}
     */
    PluginBase.prototype.getName = function () {
        if (this.pluginMetadata) {
            return this.pluginMetadata.name;
        } else {
            throw new Error('pluginMetadata is not defined - implement this function in the derived class');
        }
    };

    //</editor-fold>
    //<editor-fold desc="Methods could be overridden by the derived classes">

    /**
     * Current version of this plugin using semantic versioning.
     * @returns {string}
     */
    PluginBase.prototype.getVersion = function () {
        return this.pluginMetadata ? this.pluginMetadata.version : '0.1.0';
    };

    /**
     * A detailed description of this plugin and its purpose. It can be one or more sentences.
     *
     * @returns {string}
     */
    PluginBase.prototype.getDescription = function () {
        return this.pluginMetadata ? this.pluginMetadata.description : '';
    };

    /**
     * Configuration structure with names, descriptions, minimum, maximum values, default values and
     * type definitions.
     *
     * Example:
     *
     * [{
     *    "name": "logChildrenNames",
     *    "displayName": "Log Children Names",
     *    "description": '',
     *    "value": true, // this is the 'default config'
     *    "valueType": "boolean",
     *    "readOnly": false
     * },{
     *    "name": "logLevel",
     *    "displayName": "Logger level",
     *    "description": '',
     *    "value": "info",
     *    "valueType": "string",
     *    "valueItems": [
     *          "debug",
     *          "info",
     *          "warn",
     *          "error"
     *      ],
     *    "readOnly": false
     * },{
     *    "name": "maxChildrenToLog",
     *    "displayName": "Maximum children to log",
     *    "description": 'Set this parameter to blabla',
     *    "value": 4,
     *    "minValue": 1,
     *    "valueType": "number",
     *    "readOnly": false
     * }]
     *
     * @returns {object[]}
     */
    PluginBase.prototype.getConfigStructure = function () {
        return this.pluginMetadata ? this.pluginMetadata.configStructure : [];
    };
    //</editor-fold>
    //<editor-fold desc="Methods that can be used by the derived classes">

    /**
     * Updates the current success flag with a new value.
     *
     * NewValue = OldValue && Value
     *
     * @param {boolean} value - apply this flag on current success value
     * @param {string|null} message - optional detailed message
     */
    PluginBase.prototype.updateSuccess = function (value, message) {
        var prevSuccess = this.result.getSuccess();
        var newSuccessValue = prevSuccess && value;

        this.result.setSuccess(newSuccessValue);
        var msg = '';
        if (message) {
            msg = ' - ' + message;
        }

        this.logger.debug('Success was updated from ' + prevSuccess + ' to ' + newSuccessValue + msg);
    };

    /**
     * WebGME can export the META types as path and this method updates the generated domain specific types with
     * webgme node objects. These can be used to define the base class of new objects created through the webgme API.
     *
     * @param {object} generatedMETA
     */
    PluginBase.prototype.updateMETA = function (generatedMETA) {
        var name;
        for (name in this.META) {
            if (Object.hasOwn(this.META, name)) {
                generatedMETA[name] = this.META[name];
            }
        }

        // TODO: check if names are not the same
        // TODO: log if META is out of date
    };

    /**
     * Checks if the given node is of the given meta-type.
     * Usage: <tt>self.isMetaTypeOf(aNode, self.META['FCO']);</tt>
     * @param {module:Core~Node} node - Node to be checked for type.
     * @param {module:Core~Node} metaNode - Node object defining the meta type.
     * @returns {boolean} - True if the given object was of the META type.
     */
    PluginBase.prototype.isMetaTypeOf = function (node, metaNode) {
        if (metaNode) {
            return this.core.isTypeOf(node, metaNode);
        }

        return false;
    };

    /**
     * Finds and returns the node object defining the meta type for the given node.
     * @param {module:Core~Node} node - Node to be checked for type.
     * @returns {module:Core~Node} - Node object defining the meta type of node.
     */
    PluginBase.prototype.getMetaType = function (node) {
        return this.core.getMetaType(node);
    };

    /**
     * Returns true if node is a direct instance of a meta-type node (or a meta-type node itself).
     * @param {module:Core~Node} node - Node to be checked.
     * @returns {boolean}
     */
    PluginBase.prototype.baseIsMeta = function (node) {
        var self = this,
            baseName,
            namespace,
            baseNode = self.core.getBase(node);
        if (!baseNode) {
            // FCO does not have a base node, by definition function returns true.
            return true;
        }

        baseName = self.core.getAttribute(baseNode, 'name');
        namespace = self.core.getNamespace(baseNode).substr(self.namespace.length);

        if (namespace) {
            baseName = namespace + '.' + baseName;
        }

        return Object.hasOwn(self.META, baseName) &&
            self.core.getGuid(self.META[baseName]) === self.core.getGuid(baseNode);
    };

    /**
     * Gets the current configuration of the plugin that was set by the user and plugin manager.
     *
     * @returns {PluginConfig}
     */
    PluginBase.prototype.getCurrentConfig = function () {
        return this._currentConfig;
    };

    /**
     * Creates a new message for the user and adds it to the result.
     *
     * @param {module:Core~Node|object} node - webgme object which is related to the message
     * @param {string} message - feedback to the user
     * @param {string} severity - severity level of the message: 'debug', 'info' (default), 'warning', 'error'.
     */
    PluginBase.prototype.createMessage = function (node, message, severity) {
        var severityLevel = severity || 'info';

        var descriptor = new PluginNodeDescription({
            name: node ? this.core.getAttribute(node, 'name') : '',
            id: node ? this.core.getPath(node) : ''
        });
        var pluginMessage = new PluginMessage({
            commitHash: this.currentHash,
            activeNode: descriptor,
            message: message,
            severity: severityLevel
        });

        this.result.addMessage(pluginMessage);
    };

    /**
     * Sends a notification back to the invoker of the plugin, can be used to notify about progress.
     * @param {string|object} message - Message string or object containing message.
     * @param {string} message.message - If object it must contain a message.
     * @param {number} [message.progress] - Approximate progress (in %) of the plugin at time of sending.
     * @param {string} [message.severity='info'] - Severity level ('success', 'info', 'warn', 'error')
     * @param {boolean} [message.toBranch=false] - If true, and the plugin is running on the server on a branch -
     * will broadcast to all sockets in the branch room.
     * @param {function(Error)} [callback] - optional callback invoked when message has been emitted from server.
     * @param {null|Error} callback.err - status of the call
     */
    PluginBase.prototype.sendNotification = function (message, callback) {
        var self = this,
            cnt = self.notificationHandlers.length,
            notification = {},
            data = {
                type: STORAGE_CONSTANTS.PLUGIN_NOTIFICATION,
                notification: notification,
                projectId: self.projectId,
                branchName: self.branchName,
                pluginName: self.getName(),
                pluginId: self.getId(),
                pluginVersion: self.getVersion()
            };

        if (typeof message === 'string') {
            notification.message = message;
            notification.severity = notification.severity || 'info';
        } else {
            data.notification = message;
        }


        callback = callback || function (err) {
            if (err) {
                self.logger.error(err);
            }
        };

        function emitToHandlers() {
            if (cnt === 0) {
                callback(null);
                return;
            }
            cnt -= 1;
            self.notificationHandlers[cnt](data, function (err) {
                if (err) {
                    callback(err);
                } else {
                    emitToHandlers();
                }
            });
        }

        emitToHandlers();
    };

    /**
     * Saves all current changes if there is any to a new commit.
     * If the commit result is either 'FORKED' or 'CANCELED', it creates a new branch.
     *
     * N.B. This is a utility function for saving/persisting data. The plugin has access to the project and core
     * instances and may persist and make the commit as define its own behavior for e.g. 'FORKED' commits.
     * To report the commits in the PluginResult make sure to invoke this.addCommitToResult with the given status.
     *
     * @param {string|null} message - commit message
     * @param {function} [callback] - the result callback
     * @param {null|Error} callback.err - status of the call
     * @param {module:Storage~CommitResult} callback.commitResult - status of the commit made
     * @return {external:Promise} If no callback is given, the result will be provided in a promise
     */
    PluginBase.prototype.save = function (message, callback) {
        var self = this,
            persisted,
            commitMessage = '[Plugin] ' + self.getName() + ' (v' + self.getVersion() + ') updated the model.';

        commitMessage = message ? commitMessage + ' - ' + message : commitMessage;

        if (this.callDepth > 0) {
            self.logger.debug('Call-depth is greater than zero, will not persist "', this.callDepth, '"');
            self.result.addCommitMessage(commitMessage);
            return Q.resolve({
                hash: self.currentHash,
                // TODO: Do we need a status? Which one? SYNCED so it can proceed?
            }).nodeify(callback);
        }

        self.logger.debug('Saving project');
        persisted = self.core.persist(self.rootNode);
        if (Object.keys(persisted.objects).length === 0) {
            self.logger.debug('save invoked with no changes, will still proceed');
        }

        return self.project.makeCommit(self.branchName,
            [self.currentHash],
            persisted.rootHash,
            persisted.objects,
            commitMessage)
            .then(function (commitResult) {
                if (commitResult.status === STORAGE_CONSTANTS.SYNCED) {
                    self.currentHash = commitResult.hash;
                    self.logger.debug('"' + self.branchName + '" was updated to the new commit.');
                    self.addCommitToResult(STORAGE_CONSTANTS.SYNCED);
                    return commitResult;
                } else if (commitResult.status === STORAGE_CONSTANTS.FORKED) {
                    self.currentHash = commitResult.hash;
                    return self._createFork();
                } else if (commitResult.status === STORAGE_CONSTANTS.CANCELED) {
                    // Plugin running in the browser and the client has made changes since plugin was invoked.
                    // Since the commitData was never sent to the server, a commit w/o branch is made before forking.
                    return self.project.makeCommit(null,
                        [self.currentHash],
                        persisted.rootHash,
                        persisted.objects,
                        commitMessage)
                        .then(function (commitResult) {
                            self.currentHash = commitResult.hash; // This is needed in case hash is randomly generated.
                            return self._createFork();
                        });
                } else if (commitResult.status === STORAGE_CONSTANTS.MERGED) {
                    self.currentHash = commitResult.mergeHash;
                    self.addCommitToResult(STORAGE_CONSTANTS.MERGED);
                    // N.B. If the plugin makes multiple saves, it should fast-forward after a merged commit.
                    // Otherwise each new commit will have to be merge as well.
                    return commitResult;
                } else if (!self.branchName) {
                    self.currentHash = commitResult.hash;
                    self.addCommitToResult(commitResult.status);
                    return commitResult;
                } else {
                    throw new Error('setBranchHash returned unexpected status' + commitResult.status);
                }
            })
            .nodeify(callback);
    };

    PluginBase.prototype._createFork = function (callback) {
        // User can set self.forkName, but must make sure it is unique.
        var self = this,
            oldBranchName = self.branchName,
            forkName = self.forkName || self.branchName + '_' + Date.now();
        self.logger.warn('Plugin got forked from "' + self.branchName + '". ' +
            'Trying to create a new branch "' + forkName + '".');

        return self.project.createBranch(forkName, self.currentHash)
            .then(function (forkResult) {
                if (forkResult.status === STORAGE_CONSTANTS.SYNCED) {
                    self.branchName = forkName;
                    self.logger.debug('"' + self.branchName + '" was updated to the new commit.' +
                        '(Successive saves will try to save to this new branch.)');
                    self.addCommitToResult(STORAGE_CONSTANTS.FORKED);

                    return {status: STORAGE_CONSTANTS.FORKED, forkName: forkName, hash: forkResult.hash};
                } else if (forkResult.status === STORAGE_CONSTANTS.FORKED) {
                    self.branchName = null;
                    self.addCommitToResult(STORAGE_CONSTANTS.FORKED);

                    throw new Error('Plugin got forked from "' + oldBranchName + '". ' +
                        'And got forked from "' + forkName + '" too.');
                } else {
                    throw new Error('createBranch returned unexpected status' + forkResult.status);
                }
            })
            .nodeify(callback);
    };

    /**
     * If plugin is started from a branch - it will reload the instance's nodes and update the currentHash to
     * the current hash of the branch.
     *
     * N.B. Use this with caution, for instance manually referenced nodes in a plugin will still be part of the
     * previous commit. Additionally if the namespaces have changed between commits - the this.META might end up
     * being empty.
     * @param {function} [callback] - the result callback
     * @param {null|Error} callback.err - status of the call
     * @param {boolean} callback.didUpdate - true if there was a change and it updated the state to it
     * @return {external:Promise} If no callback is given, the result will be provided in a promise
     */
    PluginBase.prototype.fastForward = function (callback) {
        var self = this,
            options;

        if (this.callDepth > 0) {
            self.logger.warn('callDepth is greater than zero, will not fast-forward "', this.callDepth, '"');
            return Q.resolve(false).nodeify(callback);
        }

        return self.project.getBranchHash(self.branchName)
            .then(function (branchHash) {
                if (branchHash === '') {
                    throw new Error('Branch does not exist [' + self.branchName + ']');
                } else if (branchHash === self.currentHash) {
                    return false;
                } else {
                    options = {
                        activeNode: self.core.getPath(self.activeNode),
                        activeSelection: self.activeSelection.forEach(function (node) {
                            return self.core.getPath(node);
                        }),
                        namespace: self.namespace
                    };

                    return pluginUtil.loadNodesAtCommitHash(
                        self.project,
                        self.core,
                        branchHash,
                        self.logger,
                        options
                    );
                }
            })
            .then(function (result) {
                var didUpdate;

                if (result === false) {
                    didUpdate = false;
                } else {
                    self.currentHash = result.commitHash;
                    self.rootNode = result.rootNode;
                    self.activeNode = result.activeNode;
                    self.activeSelection = result.activeSelection;
                    self.META = result.META;
                    didUpdate = true;
                }

                return didUpdate;
            })
            .nodeify(callback);
    };

    /**
     * Adds the commit to the results. N.B. if you're using your own save method - make sure to update
     * this.currentHash and this.branchName accordingly before adding the commit.
     *
     * @param {string} status - Status of the commit 'SYNCED', 'FORKED', 'CANCELED', null.
     */
    PluginBase.prototype.addCommitToResult = function (status) {
        var newCommit = {
            commitHash: this.currentHash,
            branchName: this.branchName,
            status: status
        };

        this.result.addCommit(newCommit);
        this.logger.debug('newCommit added', newCommit);
    };

    /**
     * Checks if the activeNode has registered the plugin.
     *
     * @param {string} pluginId - Id of plugin
     * @returns {Error} - returns undefined if valid and an Error if not.
     */
    PluginBase.prototype.isInvalidActiveNode = function (pluginId) {
        var validPlugins = this.core.getRegistry(this.activeNode, 'validPlugins') || '';
        this.logger.debug('validPlugins for activeNode', validPlugins);

        if (validPlugins.split(' ').indexOf(pluginId) === -1) {
            return new Error('Plugin not registered as validPlugin for active node, validPlugins "' +
                validPlugins + '"');
        }
    };

    /**
     * Loads all the nodes in the subtree starting from node and returns a map from paths to nodes.
     * @param {module:Core~Node} [node=self.rootNode] - Optional node to preload nodes from,
     * by default all will be loaded.
     * @param {function} [callback] - the result callback
     * @param {null|Error} callback.err - status of the call
     * @param {object} callback.nodeMap - keys are paths and values are nodes
     * @return {external:Promise} If no callback is given, the result will be provided in a promise
     */
    PluginBase.prototype.loadNodeMap = function (node, callback) {
        var self = this;
        return self.core.loadSubTree(node || self.rootNode)
            .then(function (nodeArr) {
                var nodes = {},
                    i;

                for (i = 0; i < nodeArr.length; i += 1) {
                    nodes[self.core.getPath(nodeArr[i])] = nodeArr[i];
                }

                return nodes;
            })
            .nodeify(callback);
    };

    /**
     * Retrieves the identity of the current user of the opened project (the user who invoked the plugin).
     * @return {string} the userId
     */
    PluginBase.prototype.getUserId = function () {
        return this.project.getUserId();
    };

    /**
     * Initializes and invokes the given plugin (at pluginId).
     * Things to note:
     *  1. If the invoked plugin calls save - it will not persist nor make a commit. The message will be recorded in
     *  the InterPluginResult.
     *  2. Artifacts and files saved will be added to the blob-storage. Invoked plugins can expose the content by adding
     *  it to itself - the instance will be available in the InterPluginResult.
     *
     * @param {string} pluginId - Id of plugin that should be invoked
     * @param {object} [context] - Optional context for the invoked plugin
     * @param {object} [context.namespace=this.namespace] - Namespace (relative this.namespace)
     * @param {module:Core~Node} [context.activeNode=this.activeNode] - Active node of invoked plugin
     * @param {Array<module:Core~Node>} [context.activeSelection=this.activeSelection] - Active selection
     * of invoked plugin
     * @param {object} [context.pluginConfig] - Specific configuration parameters that should be used for the
     * invocation.
     * If not provided will first check if the currentConfig of this plugin contains this plugin as dependency within
     * the array this._currentConfig._dependencies. Finally it will fall back to the default config of the plugin.
     * @param {function} [callback] - the result callback
     * @param {null|Error} callback.err - status of the call
     * @param {InterPluginResult} callback.result - result from the invoked plugin
     * @return {external:Promise} If no callback is given, the result will be provided in a promise
     */
    PluginBase.prototype.invokePlugin = function (pluginId, context, callback) {
        var self = this,
            deferred = Q.defer(),
            pluginInstance;

        context = context || {};

        function getPluginClass() {
            var requireDeferred = Q.defer(),
                pluginPath = 'plugin/' + pluginId + '/' + pluginId + '/' + pluginId;

            requirejs([pluginPath],
                function (PluginClass) {
                    self.logger.debug('requirejs plugin from path: ' + pluginPath);
                    requireDeferred.resolve(PluginClass);
                },
                function (err) {
                    requireDeferred.reject(err);
                }
            );

            return requireDeferred.promise;
        }

        getPluginClass()
            .then(function (PluginClass) {
                var pluginConfig,
                    cfgKey;

                pluginInstance = new PluginClass();

                pluginInstance.initialize(self.logger.fork(pluginId), self.blobClient.getNewInstance(), self.gmeConfig);
                pluginInstance.result = new InterPluginResult(pluginInstance);

                ['core', 'project', 'branch', 'projectName', 'projectId', 'branchName', 'branchHash', 'commitHash',
                    'currentHash', 'rootNode', 'notificationHandlers']
                    .forEach(function (sameField) {
                        pluginInstance[sameField] = self[sameField];
                    });

                pluginInstance.activeNode = context.activeNode || self.activeNode;
                pluginInstance.activeSelection = context.activeSelection || self.activeSelection;

                if (context.namespace) {
                    pluginInstance.namespace = self.namespace === '' ?
                        context.namespace : self.namespace + '.' + context.namespace;

                    pluginInstance.META = pluginUtil
                        .getMetaNodesMap(pluginInstance.core,
                            pluginInstance.rootNode,
                            pluginInstance.logger,
                            pluginInstance.namespace);
                } else {
                    pluginInstance.namespace = self.namespace;
                    pluginInstance.META = self.META;
                }

                // Plugin config
                // 1. Get the default config for the plugin instance.
                pluginConfig = pluginInstance.getDefaultConfig();

                // 2. If the current-plugin has a sub-config for this plugin (from the default UI) - add those.
                if (Object.hasOwn(self._currentConfig, '_dependencies') &&
                    Object.hasOwn(self._currentConfig._dependencies, pluginId) &&
                    Object.hasOwn(self._currentConfig._dependencies[pluginId], 'pluginConfig')) {

                    for (cfgKey in self._currentConfig._dependencies[pluginId].pluginConfig) {
                        pluginConfig[cfgKey] = self._currentConfig._dependencies[pluginId].pluginConfig[cfgKey];
                    }
                }

                // 3. Finally use the specific config passed here.
                if (context.pluginConfig) {
                    for (cfgKey in context.pluginConfig) {
                        pluginConfig[cfgKey] = context.pluginConfig[cfgKey];
                    }
                }

                pluginInstance.setCurrentConfig(pluginConfig);
                pluginInstance.isConfigured = true;
                pluginInstance.callDepth = self.callDepth + 1;

                self.invokedPlugins.push(pluginInstance);
                return Q.ninvoke(pluginInstance, 'main');
            })
            .then(function (res) {
                var i;
                for (i = 0; i < self.invokedPlugins.length; i += 1) {
                    if (pluginInstance === self.invokedPlugins[i]) {
                        self.invokedPlugins.splice(i, 1);
                    }
                }
                deferred.resolve(res || pluginInstance.result);
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise.nodeify(callback);
    };

    /**
     * Adds a file to the blob storage and adds it to the plugin-result.
     * @param {string} name - file name.
     * @param {string|Buffer|ArrayBuffer} data - file content.
     * @param {function} [callback] - if provided no promise will be returned.
     * @param {null|Error} callback.err - status of the call
     * @param {string} callback.metadataHash - the "id" of the uploaded file
     * @return {external:Promise} If no callback is given, the result will be provided in a promise
     */
    PluginBase.prototype.addFile = function (name, content, callback) {
        var self = this;

        return this.blobClient.putFile(name, content)
            .then(function (metadataHash) {
                self.result.addArtifact(metadataHash);
                return metadataHash;
            })
            .nodeify(callback);
    };

    /**
     * Adds multiple files to the blob storage and bundles them as an artifact of which the hash is added to the
     * plugin-result.
     * @param {string} name - name of the file bundle.
     * @param {object.<string, string|Buffer|ArrayBuffer>} files - Keys are file names and values the content.
     * @param {function} [callback] - if provided no promise will be returned.
     * @param {null|Error} callback.err - status of the call.
     * @param {string} callback.metadataHash - the "id" of the uploaded artifact.
     * @return {external:Promise} If no callback is given, the result will be provided in a promise.
     */
    PluginBase.prototype.addArtifact = function (name, files, callback) {
        var self = this,
            artifact = this.blobClient.createArtifact(name);

        return artifact.addFilesAsSoftLinks(files)
            .then(function () {
                return artifact.save();
            })
            .then(function (metadataHash) {
                self.result.addArtifact(metadataHash);
                return metadataHash;
            })
            .nodeify(callback);
    };

    /**
     * Retrieves the file from blob storage.
     * @param {string} metadataHash - the "id" of the file to retrieve.
     * @param {null|Error} callback.err - status of the call.
     * @param {string} callback.content - the file content.
     * @return {external:Promise} If no callback is given, the result will be provided in a promise.
     */
    PluginBase.prototype.getFile = function (metadataHash, callback) {
        return this.blobClient.getObjectAsString(metadataHash).nodeify(callback);
    };

    /**
     * Retrieves the file from blob storage in binary format.
     * @param {string} metadataHash - the "id" of the file to retrieve.
     * @param {string} [subpath] - optional file-like path to sub-object if complex blob
     * @param {null|Error} callback.err - status of the call.
     * @param {Buffer} callback.content - the file content.
     * @return {external:Promise} If no callback is given, the result will be provided in a promise.
     */
    PluginBase.prototype.getBinFile = function (metadataHash, subpath, callback) {
        return this.blobClient.getObject(metadataHash, callback || null, subpath || null);
    };

    /**
     * Retrieves all the files in the artifact from the blob storage.
     * @param {string} metadataHash - the "id" of the artifact to retrieve.
     * @param {null|Error} callback.err - status of the call.
     * @param {object.<string, string>} callback.files - Keys are file names, and values the content.
     * @return {external:Promise} If no callback is given, the result will be provided in a promise.
     */
    PluginBase.prototype.getArtifact = function (metadataHash, callback) {
        var self = this,
            result = {};

        return this.blobClient.getMetadata(metadataHash)
            .then(function (metadata) {
                var promises = Object.keys(metadata.content)
                    .map(function (fileName) {
                        return self.blobClient.getObjectAsString(metadata.content[fileName].content)
                            .then(function (content) {
                                result[fileName] = content;
                            });
                    });

                return Q.all(promises);
            })
            .then(function () {
                return result;
            })
            .nodeify(callback);
    };


    //</editor-fold>
    //<editor-fold desc="Methods that are used by the Plugin Manager. Derived classes should not use these methods">

    /**
     * Initializes the plugin with objects that can be reused within the same plugin instance.
     *
     * @param {GmeLogger} logger - logging capability to console (or file) based on PluginManager configuration
     * @param {BlobClient} blobClient - virtual file system where files can be generated then saved as a zip file.
     * @param {GmeConfig} gmeConfig - global configuration for webGME.
     */
    PluginBase.prototype.initialize = function (logger, blobClient, gmeConfig) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = console;
        }

        if (!gmeConfig) {
            // TODO: Remove this check at some point
            throw new Error('gmeConfig was not provided to Plugin.initialize!');
        }

        this.blobClient = blobClient;
        this.gmeConfig = gmeConfig;

        this._currentConfig = null;
        // initialize default configuration
        this.setCurrentConfig(this.getDefaultConfig());

        this.isConfigured = false;
    };

    /**
     * Configures this instance of the plugin for a specific execution. This function is called before the main by
     * the PluginManager.
     * Initializes the result with a new object.
     *
     * @param {object} config - specific context: project, branch, core, active object and active selection.
     */
    PluginBase.prototype.configure = function (config) {
        var self = this;
        this.core = config.core;
        this.project = config.project;
        this.branch = config.branch;  // This is only for client side.
        this.projectName = config.projectName;
        this.projectId = config.projectId;
        this.branchName = config.branchName;
        this.branchHash = config.branchName ? config.commitHash : null;

        this.commitHash = config.commitHash;
        this.currentHash = config.commitHash;

        this.rootNode = config.rootNode;
        this.activeNode = config.activeNode;
        this.activeSelection = config.activeSelection;

        this.namespace = config.namespace || '';

        this.META = this.META = config.META;

        this.result = new PluginResult();
        this.result.setProjectId(this.projectId);

        this.addCommitToResult(STORAGE_CONSTANTS.SYNCED);

        this.isConfigured = true;

        setTimeout(function () {
            self.sendNotification({
                toBranch: false,
                message: 'Plugin initialized.',
                progress: 0,
                type: STORAGE_CONSTANTS.PLUGIN_NOTIFICATION_TYPE.INITIATED
            });
        }, 0);
    };

    /**
     * Gets the default configuration based on the configuration structure for this plugin.
     *
     * @returns {PluginConfig}
     */
    PluginBase.prototype.getDefaultConfig = function () {
        var configStructure = this.getConfigStructure(),
            defaultConfig = new PluginConfig();

        for (var i = 0; i < configStructure.length; i += 1) {
            defaultConfig[configStructure[i].name] = configStructure[i].value;
        }

        return defaultConfig;
    };

    /**
     * Sets the current configuration of the plugin.
     *
     * @param {PluginConfig} newConfig - this is the actual configuration and NOT the configuration structure.
     */
    PluginBase.prototype.setCurrentConfig = function (newConfig) {
        this._currentConfig = newConfig;
    };

    /**
     * Gets the metadata for the plugin.
     *
     * @returns {PluginMetaData}
     */
    PluginBase.prototype.getMetadata = function () {
        return this.pluginMetadata;
    };

    /**
     * Gets the ids of the directly defined dependencies of the plugin
     *
     * @returns {string[]}
     */
    PluginBase.prototype.getPluginDependencies = function () {
        if (this.pluginMetadata && this.pluginMetadata.dependencies) {
            return this.pluginMetadata.dependencies
                .map(function (data) {
                    return data.id;
                });
        } else {
            return [];
        }
    };

    /**
     * Aborts the execution of a plugin.
     */
    PluginBase.prototype.onAbort = function () {
        throw new Error('onAbort function is not implemented!');
    };

    /**
     * Can send a message to the plugin.
     * @param {string} messageType - string identifier of the message.
     * @param {object} content - object that holds arbitrary content of the message.
     */
    PluginBase.prototype.onMessage = function (messageType, content) {
        if (this.logger) {
            this.logger.warn('Message [' + messageType + '] was received but no message handling is implemented!');
            this.logger.debug('Unhandled [' + messageType + '] with content:', content);
        }
    };
    //</editor-fold>

    return PluginBase;
}));
