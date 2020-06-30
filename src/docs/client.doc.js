/**
 * @author kecso / https://github.com/kecso
 * @author pmeijer / https://github.com/pmeijer
 */

/**
 * @description The Client class represents the Client API which is the way to communicate
 * with your project from your user-defined UI pieces. It allows project selection, project tracking,
 * model interpretation and model manipulation.
 *
 * !! Documentation of the class is incomplete !!
 *
 * What is mainly missing are the node setters. Until added here use the [Core documentation]{@link Core}
 * and simply replace any Core nodes in the arguments with the id/path of the nodes instead.
 *
 * @class Client
 *
 * @param {GmeConfig} gmeConfig - the main configuration of the WebGME that holds information
 * about the server and other options.
 */

// Node related
/**
 * @description Returns the [GMENode]{@link GMENode} of the given node if it has been loaded.
 * @function getNode
 * @memberOf Client
 * @instance
 *
 * @param {string} path - the path of the node in question.
 *
 * @return {(GMENode|null)} If the node is loaded it will be returned, otherwise null.
 */

/**
 * @description Returns all meta-nodes as [GMENodes]{@link GMENode}.
 * @function getAllMetaNodes
 * @memberOf Client
 * @instance
 *
 * @param {boolean} asObject - If true return an object with ids/path as keys and nodes as values.
 *
 * @return {GMENode[]|object} If the node is loaded it will be returned, otherwise null.
 */

// Territory related
/**
 * @description Adds a "user" for receiving events regarding nodes in a specified territory.
 * @function addUI
 * @memberOf Client
 * @instance
 * @example
 * // The eventHandler is invoked whenever there are changes to the nodes
 // matching any of the patterns.
 // There are three cases when it is triggered:
 // 1) updateTerritory was invoked by us.
 // 2) Another client made changes to nodes within the territory.
 // 3) We made changes to any of the nodes (via the setters).
 function eventHandler(events) {
  var i,
      nodeObj;
  for (i = 0; i < events.length; i += 1) {
    if (events[i].etype === 'load') {
      // The node is loaded and we have access to it.
      // It was either just created or this is the initial
      // updateTerritory we invoked.
      nodeObj = client.getNode(events[i].eid);
    } else if (events[i].etype === 'update') {
      // There were changes made to the node (or any of its bases, meta-types and/or reverse relationships).
      // The node is still loaded and we have access to it.
      nodeObj = client.getNode(events[i].eid);
    } else if (events[i].etype === 'unload') {
      // The node was removed from the model (we can no longer access it).
      // We still get the path/id via events[i].eid
    } else {
      // "Technical events" not used.
    }
  }
}

 var userId = client.addUI(null, eventHandler);
 * @param {object} [ui] - Object with additional methods to be invoked.
 * @param {function} [ui.reLaunch] - Triggered when active project/branch is switched.
 * @param {function} eventHandler - Function invoked at changes for, or initial loading of, nodes within the
 * "user's" territory.
 * @param {object[]} eventHandler.events - Array of event data for affected nodes within the territory.
 * @param {string} [guid] - Unique id of user (if not provided one will be generated).
 * @return {string} The id (guid) of the newly added "user".
 */

/**
 * @description Updates the patterns for the territories defined for the "user" at guid.
 * @function updateTerritory
 * @memberOf Client
 * @instance
 * @example
 * // The patterns are defined by using the ids of the nodes and optionally specifying a depth in the containment-
 * hierarchy from that node
 client.updateTerritory('ae1b4f8e-32ea-f26f-93b3-ab9c8daa8a42', {
        '/a/b': {
            children: 0 // Will only add '/a/b' to the territory
        },
        '/a/c': {
            // children can be left out, implies 0
        },
        '/a/d': {
            children: 1 // '/a/d' and all its children are included
        },
        '/a/e': {
            children: 3 // We can go arbitrarily deep down (note in large models too big territories can be slow!)
        }
    });
 * @param {string} guid - The unique id of the added "user".
 * @param {object} patterns - The definition for the new territory.
 */

/**
 * @description Removes the [user]{@link Client.addUI} at guid and no more events will be triggered at
 * its event-handler.
 * @function removeUI
 * @memberOf Client
 * @instance
 * @example
 * var id = client.addUI(null, function (events) {
 *      // Say we only wanted the initial updateTerritory event.
 *      client.removeUI(id);
 *  });
 *
 *  client.updateTerritory(id);
 * @param {string} guid - The unique id of the "user" to remove.
 */
// Plugin related
/**
 * @description Helper method for obtaining the context for a plugin execution. If WebGMEGlobal is defined it is
 * used to get the activeNode and activeSelection (if not specified). The model context, that is project, branch,
 * commitHash is obtained using the state of the client. If there is an activeNode - the namespace will be the namespace
 * of the first base that defines the pluginId at the "validPlugins" registry.
 * @function getCurrentPluginContext
 * @memberOf Client
 * @instance
 * @param {string} pluginId - Id of plugin.
 * @param {string} [activeNodeId=WebGMEGlobal.State.getActiveObject() || ''] - Specific id for active node.
 * @param {string[]} [activeSelectionIds=WebGMEGlobal.State.getActiveSelection() || []] - Specific ids for
 * active-selection.
 * @return {object} The context needed for runBrowserPlugin/runServerPlugin.
 */

/**
 * @description Helper method for filtering out the registered plugins from the available ones.
 * @function filterPlugins
 * @memberOf Client
 * @instance
 * @param {string[]} pluginIds - Typically all available plugins on the server.
 * @param {string} [nodePath=''] - Node to get the validPlugins from.
 * @return {string[]} Filtered plugin ids.
 */

/**
 * @description Execute the specified plugin inside the browser at the provided context.
 * @function runBrowserPlugin
 * @memberOf Client
 * @instance
 * @param {string} pluginId - Id of plugin.
 * @param {object} context
 * @param {object} context.managerConfig - Where the plugin should execute.
 * @param {ProjectInterface} context.managerConfig.project - Project (can be obtained via
 * [client.getProjectObject()]{@link Client#getProjectObject}).
 * @param {string} [context.managerConfig.activeNode=''] - Path to activeNode.
 * @param {string} [context.managerConfig.activeSelection=[]] - Paths to selected nodes.
 * @param {string} context.managerConfig.commitHash - Commit hash to start the plugin from.
 * @param {string} [context.managerConfig.branchName] - Branch which to save to.
 * @param {string} [context.managerConfig.namespace=''] - Used namespace ('' represents root namespace).
 * @param {object} [context.pluginConfig=%defaultForPlugin%] - Specific configuration for the plugin.
 * @param {function(err, PluginResult)} callback
 *
 *  @fires Client#PLUGIN_INITIATED
 *  @fires Client#PLUGIN_FINISHED
 */

/**
 * @description Execute the specified plugin on the server at the provided context. Before invoking a plugin on
 * the server you need to make sure that the given commitHash has been persisted in the database.
 * @function runServerPlugin
 * @memberOf Client
 * @instance
 * @param {string} pluginId - Id of plugin.
 * @param {object} context
 * @param {object} context.managerConfig - Where the plugin should execute.
 * @param {ProjectInterface|string} context.managerConfig.project - Project or id of project.
 * @param {string} [context.managerConfig.activeNode=''] - Path to activeNode.
 * @param {string} [context.managerConfig.activeSelection=[]] - Paths to selected nodes.
 * @param {string} context.managerConfig.commitHash - Commit hash to start the plugin from.
 * @param {string} [context.managerConfig.branchName] - Branch which to save to.
 * @param {string} [context.managerConfig.namespace=''] - Used namespace ('' represents root namespace).
 * @param {object} [context.pluginConfig=%defaultForPlugin%] - Specific configuration for the plugin.
 * @param {function} callback
 *
 *  @fires Client#PLUGIN_INITIATED
 *  @fires Client#PLUGIN_FINISHED
 */

// Transactions
/**
 * @description Starts a transaction where all changes to nodes are bundled into a single commit. All commit-messages
 * for each change will be joined and separated by '\n'.
 * @function startTransaction
 * @memberOf Client
 * @instance
 * @example
 * var nodeId = 'someIdToANodeThatIsLoaded';
 client.startTransaction('start of commitMessage');

 // While transaction is open nothing will be committed to the server.
 client.setAttributes(nodeId, 'name', 'newName', 'changes within the transaction');

 client.setRegistry(nodeId, 'position', {x: 100, y:200}, 'some more changes');

 // When we have made all of our changes we make a single commit.
 client.completeTransaction('end of commitMessage', function (err, result) {
  // Here we have the option to get notified when the commit has reached the server
  // and been persisted in the database.

  // The commit hash of the new state of our model.
  console.log(result.hash);

  // If we are working in a branch - this is the status of our commit.
  // 'SYNCED', 'FORKED'.
  console.log(result.status);
});
 * @param {string} [msg='['] - Start of commit-message.
 */

/**
 * @description Completes any open transaction and persists the changes to server.
 * @function completeTransaction
 * @memberOf Client
 * @instance
 * @example
 * var nodeId = 'someIdToANodeThatIsLoaded';
 client.startTransaction('start of commitMessage');

 // While transaction is open nothing will be committed to the server.
 client.setAttributes(nodeId, 'name', 'newName', 'changes within the transaction');

 client.setRegistry(nodeId, 'position', {x: 100, y:200}, 'some more changes');

 // When we have made all of our changes we make a single commit.
 client.completeTransaction('end of commitMessage', function (err, result) {
  // Here we have the option to get notified when the commit has reached the server
  // and been persisted in the database.

  // The commit hash of the new state of our model.
  console.log(result.hash);

  // If we are working in a branch - this is the status of our commit.
  // 'SYNCED', 'FORKED'.
  console.log(result.status);
});
 * @param {string} [msg=']'] - End of commit-message.
 * @param {function} [callback] - Optional callback that's invoked when the commit has reached the server.
 */

/**
 * @description Trigger the client to dispatch a NOTIFICATION (in the generic UI the notification widget listens
 * to these).
 * @function notifyUser
 * @memberOf Client
 * @instance
 * @param {object|string} [notification] - Notification to user (if string given will be set at notification.message)
 * @param {string} notification.message - Message of notification
 * @param {string} [notification.severity='info'] - Notification severity level ('success', 'info', 'warn', 'error')
 */

// Libraries
/**
 * @description Returns an array of all libraries at the current project and commit/branch.
 * @function getLibraryNames
 * @memberOf Client
 * @instance
 * @returns {string[]} - Fully qualified names of libraries (including libraries of libraries)
 */

/**
 * @description Returns the info associated with the library in the current project and commit/branch.
 * @function getLibraryInfo
 * @memberOf Client
 * @instance
 * @param {string} libraryName - Name of library.
 * @returns {object} - Info stored at library.
 */


/**
 * @description Sends a server request to add specified library to the current project and branch.
 * @function addLibrary
 * @memberOf Client
 * @param {string} name - Name of new library (cannot contain dots or exist already)
 * @param {string|object} blobHashLibraryInfoOrSeedName - If blobHash string given will import library from blob,
 * if string will import from seed, otherwise project at info (will also be added to info at library).
 * @param {string} blobHashLibraryInfoOrSeedName.projectId - The projectId of your library.
 * @param {string} [blobHashLibraryInfoOrSeedName.branchName] - The branch that your library follows in the
 * origin project.
 * @param {string} [blobHashLibraryInfoOrSeedName.commitHash] - The commit-hash of your library.
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If request failed.
 * @param {module:Storage~CommitResult} callback.result - Result from the commit made.
 * @instance
 */

/**
 * @description Sends a server request to update the specified library at the current project and branch.
 * @function updateLibrary
 * @memberOf Client
 * @param {string} name - Name of library to update.
 * @param {string|object} blobHashLibraryInfoOrSeedName - If blobHash string given will update library from blob,
 * if string will update from seed, otherwise project at info (will also be added to info at library).
 * @param {string} blobHashOrLibraryInfo.projectId - The projectId of your library.
 * @param {string} [blobHashOrLibraryInfo.branchName] - The branch that your library follows in the origin project.
 * @param {string} [blobHashOrLibraryInfo.commitHash] - The commit-hash of your library.
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If request failed.
 * @param {module:Storage~CommitResult} callback.result - Result from the commit made.
 * @instance
 */

/**
 * @description Remove the library from the current project and branch.
 * @function removeLibrary
 * @memberOf Client
 * @instance
 * @param {string} libraryName - Name of library to remove.
 */

/**
 * @description Rename the library in the current project and branch.
 * @function renameLibrary
 * @memberOf Client
 * @instance
 * @param {string} oldName - Name of library to rename.
 * @param {string} newName - New name of library.
 */

/**
 * @description Updates the given project and branch name with the provided context.
 * @function updateProjectFromFile
 * @memberOf Client
 * @param {string} projectId - Id of project to update.
 * @param {string} branchName - Branch that should be updated.
 * @param {string} blobHashOrSeedName - If blobHash string will update from the webgmex at the blob,
 * if string will update from the webgmex seed.
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If request failed.
 * @param {module:Storage~CommitResult} callback.result - Result from the commit made.
 * @instance
 */

/**
 * @description Get the identity of the current user of the client/storage.
 * @function getUserId
 * @memberOf Client
 * @instance
 * @returns {string} the userId
 */

/**
 * @description Establishes a websocket-connection to the storage/database on the server. If already connected - it will
 * resolve immediately. Note that the client itself attempts to reconnect on unintended disconnections. To monitor the
 * status register for the client.CONSTANTS.NETWORK_STATUS_CHANGED event.
 * @function connectToDatabase
 * @memberOf Client
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If the request failed.
 *
 * @fires Client#NETWORK_STATUS_CHANGED
 * @instance
 */

/**
 * @description Ends the websocket-connection to the storage/database on the server.
 * @function disconnectFromDatabase
 * @memberOf Client
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If the request failed.
 *
 * @fires Client#NETWORK_STATUS_CHANGED
 * @instance
 */

/**
 * @description Selects a new project and opens a branch for monitoring. Any previously opened project/branch will be
 * closed. If the same project is already open - it will resolve immediately and keep that project open.
 * (To only change the branch use selectBranch instead). If branchName is given and it does not exist,
 * the project will be closed and the callback will resolve with an error.
 * If branchName is NOT given it will attempt proceed in the following in order and break if successful at any step:
 *  1) Select the 'master' if available.
 *  2) Select any available branch.
 *  3) Select the latest commit.
 *  4) Close the project and resolve with an error.
 * @function selectProject
 * @memberOf Client
 * @param {string} projectId - Id of project to be selected
 * @param {string} [branchName='master'] - branch to open
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If the request failed.
 *
 * @fires Client#PROJECT_OPENED
 * @fires Client#PROJECT_CLOSED
 * @fires Client#BRANCH_OPENED
 * @fires Client#BRANCH_CLOSED
 * @fires Client#BRANCH_CHANGED
 * @instance
 */

/**
 * @description Closes the currently selected project. If a branch is opened it will be closed as well.
 * Will resolve with error if no project is opened.
 * @function closeProject
 * @memberOf Client
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If the request failed.
 * @instance
 *
 * @fires Client#PROJECT_CLOSED
 * @fires Client#BRANCH_CLOSED
 * @fires Client#BRANCH_CHANGED
 */

/**
 * @description Selects a branch in the currently opened project. It will close any currently opened branch.
 * If the same branch is opened it will close and reselect it (this differs from how selectProject works).
 * @function selectBranch
 * @memberOf Client
 * @param {string} branchName - Name of branch to open.
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If the request failed.
 * @fires Client#BRANCH_OPENED
 * @fires Client#BRANCH_CLOSED
 * @fires Client#BRANCH_CHANGED
 * @instance
 */

/**
 * @description Selects a specific commit and enters "read-only" mode see [isReadOnly]{@link Client#isReadOnly} and
 * [isReadOnlyCommit]{@link Client#isReadOnlyCommit}.
 * If a branch is opened it will be closed. Will resolve with error if the commit does not exist.
 * @function selectCommit
 * @memberOf Client
 * @param {string} commitHash - Unique id for the commit to select.
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If the request failed.
 *
 * @fires Client#BRANCH_CLOSED
 * @fires Client#BRANCH_CHANGED
 * @instance
 */

/**
 * @description Returns true if either the selected project is read-only for the connected user or if a commit
 * is selected, i.e. if either [isReadOnlyCommit]{@link Client#isReadOnlyCommit} or
 * [isProjectReadOnly]{@link Client#isProjectReadOnly} return true.
 * @function isReadOnly
 * @memberOf Client
 * @instance
 * @returns {boolean} True if in read-only state.
 */

/**
 * @description Returns true if the selected project is read-only for the connected user.
 * @function isProjectReadOnly
 * @memberOf Client
 * @instance
 * @returns {boolean} True if the user only has read-access to the project.
 */

/**
 * @description Returns true if a specific commit is selected (no branch opened).
 * @function isCommitReadOnly
 * @memberOf Client
 * @instance
 * @returns {boolean} True if a commit is selected
 */

/**
 * @description Returns true if a connection to the database/storage has been established and
 * is not in a disconnected state.
 * @function isConnected
 * @memberOf Client
 * @instance
 * @returns {boolean} True if connected to the database/storage.
 */

/**
 * @description Returns the current connection state or null if connectToDatabase was never invoked.
 * @function getNetworkStatus
 * @memberOf Client
 * @instance
 * @returns {string|null} One of client.CONSTANTS.STORAGE.
 * CONNECTED/DISCONNECTED/RECONNECTED/INCOMPATIBLE_CONNECTION/CONNECTION_ERROR
 */

/**
 * @description Returns the version (package.json version of webgme-engine) of the server the initial connection was
 * established to.
 * @function getConnectedStorageVersion
 * @memberOf Client
 * @instance
 * @returns {string|null} null if it was never connected.
 */

/**
 * @description Returns the current status of the opened branch. Returns null if no branch is opened.
 * @function getBranchStatus
 * @memberOf Client
 * @instance
 * @returns {string|null} One of client.CONSTANTS.BRANCH_STATUS. SYNC/AHEAD_SYNC/AHEAD_NOT_SYNC/PULLING/ERROR.
 */

/**
 * @description Returns the id of currently selected project. Returns null if no project is opened.
 * @function getActiveProjectId
 * @memberOf Client
 * @instance
 * @returns {string|null} The project-id of the selected project.
 */

/**
 * @description Returns the name of currently selected project. Returns null if no project is opened.
 * @function getActiveProjectName
 * @memberOf Client
 * @instance
 * @returns {string|null} The project-name of the selected project.
 */

/**
 * @description Returns the kind of currently selected project at the time it was opened.
 * Returns null if no project is opened and returns undefined if the field is not specified for the project.
 * (To get the latest info from the server use client.getProjectObject() followed by project.getProjectInfo.)
 * @function getActiveProjectKind
 * @memberOf Client
 * @instance
 * @returns {string|null|undefined} The project-kind of the selected project.
 */

/**
 * @description Returns the name of currently selected branch. Returns null if no branch is open.
 * @function getActiveBranchName
 * @memberOf Client
 * @instance
 * @returns {string|null} The name of the selected branch.
 */

/**
 * @description Returns the current commit-hash of either the opened branch or the selected commit. Return null if
 * none is selected.
 * @function getActiveCommitHash
 * @memberOf Client
 * @instance
 * @returns {string|null} The active commit-hash.
 */

/**
 * @description Returns the current root-hash the client is at. If there are changes inside a transaction the root-hash
 * will correspond to the state that is being updated. Returns null if no no branch or commit selected is selected.
 * @function getActiveRootHash
 * @memberOf Client
 * @instance
 * @returns {string|null} The active root-hash.
 */

/**
 * @description Returns the access the current user had to the selected project when it was opened. Returns null if no
 * project is open.
 * (To get the latest info from the server use [client.getProjectObject()]{@link Client#getProjectObject}
 * followed by [project.getProjectInfo]{@link Project#getProjectInfo}.)
 * @function getProjectAccess
 * @example
 * { read: true, write: false, delete: false }
 * @memberOf Client
 * @instance
 * @returns {object|null} The access levels to the project.
 */

/**
 * @description Returns the info of the selected project when it was opened. Returns null if no project is open.
 * (To get the latest info from the server use [client.getProjectObject()]{@link Client#getProjectObject}
 * followed by [project.getProjectInfo]{@link Project#getProjectInfo}.)
 * @function getProjectInfo
 * @memberOf Client
 * @instance
 * @returns {object|null} The project info - see [project.getProjectInfo]{@link Project#getProjectInfo}
 */

/**
 * @description Returns the project object of the selected project. Returns null if no project is open.
 * @function getProjectObject
 * @memberOf Client
 * @instance
 * @returns {ProjectInterface|null} The project instance.
 */

/**
 * @description Creates a new core instance using the state of the client and loads a new root node.
 * Resolves with error if no project or root-hash is active.
 * @function getCoreInstance
 * @memberOf Client
 * @param {object} [options]
 * @param {string} [options.commitHash=%state.commitHash%] - If a different commit-hash should be loaded.
 * @param {GmeLogger} [options.logger=%clientLogger%] - Logger passed to the core instance.
 * @param {function} callback
 * @param {Error|null} callback.err - Non-null if failed to retrieve result.
 * @param {object} callback.result - The result object
 * @param {Core} callback.result.core - Newly created core instance
 * @param {Core~Node} callback.result.rootNode - The root-node that was loaded.
 * @param {string} callback.result.commitHash - The commitHash used as basis for loading the root-node.
 * @param {Project} callback.result.project - A reference to the project.
 * @instance
 * @returns {Core|null} The core instance.
 */

/**
 * @description Undo the latest change/commit, i.e. sets the branch-hash to point to the previous commit.
 * Will immediately resolve with error if the provided branchName is not the
 * same as the selected or if the current user did not make the latest change (see [canRedo]{@link Client#canRedo}).
 * @function undo
 * @memberOf Client
 * @param {string} branchName - Must match the active branch.
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If the request failed.
 * @param {module:Storage~CommitResult} callback.commitResult - The status of the commit made.
 * @instance
 */

/**
 * @description Redo the latest undo. Will immediately resolve with error if the provided branchName is not the
 * same as the selected or if there were commits after the previous undo (see [canRedo]{@link Client#canRedo}).
 * @function redo
 * @memberOf Client
 * @param {string} branchName - Must match the active branch.
 * @param {function} callback - Invoked when request completed.
 * @param {null|Error} callback.err - If the request failed.
 * @param {module:Storage~CommitResult} callback.commitResult - The status of the commit made.
 * @instance
 */

/**
 * @description Returns true if the provided branchName matches the selected and if the current user did made the latest
 * change.
 * @function canUndo
 * @memberOf Client
 * @param {string} branchName - Must match the active branch.
 * @instance
 * @returns {boolean} True if it's fine to call client.undo()
 */

/**
 * @description Returns true if the provided branchName matches the selected and if there were no commits after the
 * previous undo.
 * @function canRedo
 * @memberOf Client
 * @param {string} branchName - Must match the active branch.
 * @instance
 * @returns {boolean} True if it's fine to call client.redo()
 */

/**
 * @description Initiates the abort of the given plugin execution.
 * @function abortPlugin
 * @memberOf Client
 * @param {string} executionId - unique identifier that identifies the plugin execution
 * @instance
 *
 */

/**
 * @description Sends a message to a running plugin.
 * @function sendMessageToPlugin
 * @memberOf Client
 * @param {string} executionId - unique identifier that identifies the plugin execution
 * @param {string} messageId - the identifier of the message which has been specified by the plugin
 * @param {any} content - the content of the message
 * @instance
 *
 */

/**
 * @description Gathers the list of running plugins and information about them.
 * @function getRunningPlugins
 * @memberOf Client
 * @instance
 *
 */

// EVENTS
/**
 * Fired when the network status changes.
 * The returned value is one of:
 *
 * - `'CONNECTED'` - The websocket connection has been established (a project can be selected)
 * - `'DISCONNECTED'` - The websocket connection is broken, the user can continue offline and any commits will be pushed
 *  automatically by the client when reconnected.
 * - `'RECONNECTED'` - After a disconnect, the connection has been established again.
 * - `'INCOMPATIBLE_CONNECTION'` - If the version of webgme-engine the server is different from the one loaded
 * in the client at this point the browser must be refreshed.
 * - `'CONNECTION_ERROR'` - Some unexpected error happened and the browser needs to be refreshed.
 *
 * @event Client#NETWORK_STATUS_CHANGED
 * @type {string}
 */

/**
 * Fired when a project is opened.
 *
 * @event Client#PROJECT_OPENED
 * @type {string}
 */

/**
 * Fired when the currently opened project is closed.
 *
 * @event Client#PROJECT_CLOSED
 * @type {string}
 */

/**
 * Fired when a branch is opened.
 *
 * @event Client#BRANCH_OPENED
 * @type {string}
 */

/**
 * Fired when the currently opened branch is closed.
 *
 * @event Client#BRANCH_CLOSED
 * @type {string}
 */

/**
 * Fired when the open branch changed. The event could either return the name of the newly opened branch
 * or null if there no longer is a branch opened.
 *
 * @event Client#BRANCH_CHANGED
 * @type {string|null}
 */

/**
 * Fired when the branch status changes.
 * The returned value is one of:
 *
 * - `'SYNC'` - The local branch is in sync with the server.
 * - `'AHEAD_SYNC'` - There are changes in the local branch that has not been sent to the server. The latest commit
 * was synchronized.
 * - `'AHEAD_NOT_SYNC'` - There are changes in the local branch that has not been sent to the server. The latest commit
 * did not update the branch head. An action is required.
 * - `'PULLING'` - External changes to the branch are being pulled into the branch.
 * - `'ERROR'` - Some unexpected error happened.
 * - (`'MERGING'` - a forked commit is attempted to be merged by the server (this is disabled by default))
 *
 * @event Client#BRANCH_STATUS_CHANGED
 * @type {object}
 */

/**
 * A notification with a message to the end-user. Could be generated by plugins or add-ons, but
 * also by GUI widgets.
 *
 * @event Client#NOTIFICATION
 * @type {object}
 * @property {string} message - The content of the message.
 * @property {string} severity - One of 'success', 'info', 'warn', 'error'
 */

/**
 * Fired when there are changes among the users connected to the same branch-room (have the same project
 * and branch opened).
 *
 * @example
 * {
  "type": "CLIENT_STATE_NOTIFICATION",
  "state": {
    "activeAspect": "All",
    "activeTab": 0,
    "layout": "DefaultLayout",
    "activeVisualizer": "ModelEditor",
    "activeProjectName": "demo+SignalFlowSystem",
    "activeBranchName": "master",
    "activeCommit": null,
    "_toBeActiveObject": "/682825457/607500954",
    "activeObject": "/682825457/607500954",
    "activeSelection": [
      "/682825457/607500954"
    ]
  },
  "projectId": "demo+SignalFlowSystem",
  "branchName": "master",
  "userId": "demo",
  "socketId": "nczll3cDYPfoK7IeAAAT"
}
 *
 * @example
 * {
  "projectId": "demo+SignalFlowSystem",
  "branchName": "master",
  "userId": "demo",
  "socketId": "nczll3cDYPfoK7IeAAAT",
  "type": "BRANCH_ROOM_SOCKETS",
  "join": true
}
 *
 * @event Client#CONNECTED_USERS_CHANGED
 * @type {object}
 * @property {string} type - 'BRANCH_ROOM_SOCKETS', 'CLIENT_STATE_NOTIFICATION'
 * @property {string} projectId - The id of the project
 * @property {string} branchName - The name of the branch
 * @property {string} userId - The user-id of the user who joined or left
 * @property {string} socketId - The unique socket-id of the user who joined or left (this can become hashed)
 * @property {boolean|undefined} [join] - Whether or not the user joined or left the room (undefined -> false) this only
 * applies to the 'BRANCH_ROOM_SOCKETS' event.
 * @property {object|null} [state] - This only applies to the
 * 'CLIENT_STATE_NOTIFICATION' event and is defined by the return value of the function passed in at
 * client.registerUIStateGetter. Behind the scenes this emitted by the client when it receives a
 * 'BRANCH_ROOM_SOCKETS' event in order to notify that new client that it has a user in the same room. But can also
 * be emitted from the GUI by invoking client.emitStateNotification() (which is invoked by the generic webgme UI
 * whenever its state changes). The state in the example below is specific for the generic webgme UI.
 */

/**
 * Fired when the client initiates a plugin execution.
 * The event data contains information about the executed plugin.
 *
 * @event Client#PLUGIN_INITIATED
 * @type {object}
 * @property {string} id - the id of the plugin
 * @property {string} name - the name of the plugin
 * @property {string} executionId -  unique identifier that can be used for managing the execution and communicating
 * with the running plugin
 * @property {object} metadata - the original metadata of the plugin
 * @property {object} context - the context of the plugin that has information about the project, active object,
 * and configuration settings for the run
 * @property {boolean} canBeAborted - flag that show if the plugin can be aborted
 * @property {string} start - the exact time of the initiation of the plugin
 * @property {boolean} clientSide - flag showing if the execution is done on the client or the server side
 * @property {object} result - the result of the plugin - once it became available
 */

/**
 * Fired when the plugin sends a notification to the initiating client.
 * The event data contains information about the executed plugin.
 *
 * @event Client#PLUGIN_NOTIFICATION
 * @type {object}
 * @property {string} pluginId - the id of the plugin
 * @property {string} pluginName - the name of the plugin
 * @property {string} pluginVersion - the version of the plugin normally in the form of x.y.z
 * @property {string} executionId -  unique identifier that can be used for managing the execution and communicating
 * with the running plugin
 * @property {string} projectId - the id of the project context the plugin uses
 * @property {string} [branchName] - the name of the branch the plugin runs in.
 * @property {string} [commitHash] - the hash of the commit that represent the version that the plugin runs at.
 * @property {object} notification - the content of the notification, as the plugin control the content
 * there are no mandatory fields
 * @property {string} [notification.message] - the text content of the notification
 * @property {string} [notification.severity] - the severity of the notification
 * ('debug', 'info' (default), 'warning', 'error').
 * @property {string} type - the exact type of the notification which should always be 'PLUGIN_NOTIFICATION'.
 */

/**
 * Fired when the execution of a plugin - initiated by this given client - finished.
 * The event data contains information about the executed plugin.
 *
 * @event Client#PLUGIN_FINISHED
 * @type {object}
 * @property {string} id - the id of the plugin
 * @property {string} name - the name of the plugin
 * @property {string} executionId -  unique identifier that can be used for managing the execution and communicating
 * with the running plugin
 * @property {object} metadata - the original metadata of the plugin
 * @property {object} context - the context of the plugin that has information about the project, active object,
 * and configuration settings for the run
 * @property {boolean} canBeAborted - flag that show if the plugin can be aborted
 * @property {string} start - the exact time of the initiation of the plugin
 * @property {boolean} clientSide - flag showing if the execution is done on the client or the server side
 * @property {object} result - the result of the plugin - once it became available
 */

/**
 [
 __"_eventList",
 "CONSTANTS",
 __"dispatchPluginNotification",

 "isTypeOf",
 "isValidTarget",
 "filterValidTarget",
 "getValidTargetTypes",
 "getOwnValidTargetTypes",
 "getValidTargetItems",
 "getOwnValidTargetItems",
 "getPointerMeta",
 "isValidChild",
 "getValidChildrenTypes",
 "getValidAttributeNames",
 "getOwnValidAttributeNames",
 "getAttributeSchema",
 "getMetaAspectNames",
 "getOwnMetaAspectNames",
 "getMetaAspect",
 "hasOwnMetaRules",
 "getChildrenMeta",
 "getChildrenMetaAttribute",
 "getValidChildrenItems",
 "getOwnValidChildrenTypes",
 "getAspectTerritoryPattern",

 "forkCurrentBranch",
 "getCommitQueue",
 "downloadCommitQueue",
 "downloadError",

 "applyCommitQueue",
 "getProjects",
 "getProjectsAndBranches",
 "getBranches",
 "getTags",
 "getCommits",
 "getHistory",
 "getLatestCommitData",
 "createProject",
 "deleteProject",
 "transferProject",
 "duplicateProject",
 "createBranch",
 "deleteBranch",
 "createTag",
 "deleteTag",
 "squashCommits",
 "watchDatabase",
 "unwatchDatabase",
 "watchProject",
 "unwatchProject",
 "checkMetaConsistency",

 "_removeAllUIs",

 "importProjectFromFile",
 "checkMetaRules",
 "checkCustomConstraints",
 "seedProject",
 "setConstraint",
 "delConstraint",
 "autoMerge",
 "resolve",
 "exportProjectToFile",
 "exportSelectionToFile",
 "importSelectionFromFile",

 "dispatchAddOnNotification",

 "emitStateNotification",
 "dispatchConnectedUsersChanged",
 "registerUIStateGetter",
 "gmeConfig",
 "uiStateGetter",
 "decoratorManager"
 ]
 */

/**
 * Node setters
 "setAttribute",
 "setAttributes",
 "delAttribute",
 "delAttributes",
 "setRegistry",
 "delRegistry",
 "moveNode",
 "moveMoreNodes",
 "deleteNode",
 "deleteNodes",
 "delMoreNodes",
 "createNode",
 "createChild",
 "createChildren",
 "setPointer",
 "makePointer",
 "delPointer",
 "deletePointer",
 "addMember",
 "removeMember",
 "setMemberAttribute",
 "delMemberAttribute",
 "setMemberRegistry",
 "delMemberRegistry",
 "setSetAttribute",
 "delSetAttribute",
 "setSetRegistry",
 "delSetRegistry",
 "createSet",
 "delSet",
 "deleteSet",
 "setBase",
 "delBase",
 "setMeta",
 "setChildrenMeta",
 "setChildrenMetaAttribute",
 "setChildMeta",
 "updateValidChildrenItem",
 "delChildMeta",
 "removeValidChildrenItem",
 "setAttributeMeta",
 "setAttributeSchema",
 "delAttributeMeta",
 "removeAttributeSchema",
 "setPointerMeta",
 "setPointerMetaTarget",
 "updateValidTargetItem",
 "delPointerMetaTarget",
 "removeValidTargetItem",
 "delPointerMeta",
 "deleteMetaPointer",
 "setAspectMetaTarget",
 "setAspectMetaTargets",
 "setMetaAspect",
 "delAspectMetaTarget",
 "delAspectMeta",
 "deleteMetaAspect",
 "addMixin",
 "delMixin",
 "getMeta",
 */
