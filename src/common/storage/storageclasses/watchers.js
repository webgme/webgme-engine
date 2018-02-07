/*globals define*/
/*eslint-env node, browser*/
/**
 * Provides watching-functionality of the database and specific projects.
 * Keeps a state of the registered watchers.
 *
 * @author pmeijer / https://github.com/pmeijer
 */

define([
    'q',
    'webgme-ot',
    'common/storage/constants',
    'common/util/guid',
    'common/EventDispatcher'
], function (Q, ot, CONSTANTS, GUID, EventDispatcher) {
    'use strict';

    function StorageWatcher(webSocket, logger, gmeConfig) {
        EventDispatcher.call(this);
        // watcher counters determining when to join/leave a room on the sever
        this.watchers = {
            sessionId: GUID(), // Need at reconnect since socket.id changes.
            database: 0,
            projects: {},
            documents: {}
        };
        this.webSocket = webSocket;
        this.logger = this.logger || logger.fork('storage');
        this.gmeConfig = gmeConfig;
        this.logger.debug('StorageWatcher ctor');
        this.connected = false;
    }

    // Inherit from the EventDispatcher
    StorageWatcher.prototype = Object.create(EventDispatcher.prototype);
    StorageWatcher.prototype.constructor = StorageWatcher;

    function _splitDocId(docId) {
        var pieces = docId.split(CONSTANTS.ROOM_DIVIDER);

        return {
            projectId: pieces[0],
            branchName: pieces[1],
            nodeId: pieces[2],
            attrName: pieces[3]
        };
    }

    StorageWatcher.prototype.watchDatabase = function (eventHandler, callback) {
        this.logger.debug('watchDatabase - handler added');
        this.webSocket.addEventListener(CONSTANTS.PROJECT_DELETED, eventHandler);
        this.webSocket.addEventListener(CONSTANTS.PROJECT_CREATED, eventHandler);
        this.watchers.database += 1;
        this.logger.debug('Nbr of database watchers:', this.watchers.database);

        if (this.watchers.database === 1) {
            this.logger.debug('First watcher will enter database room.');
            return this.webSocket.watchDatabase({join: true}).nodeify(callback);
        } else {
            return Q().nodeify(callback);
        }
    };

    StorageWatcher.prototype.unwatchDatabase = function (eventHandler, callback) {
        var deferred = Q.defer();

        this.logger.debug('unwatchDatabase - handler will be removed');
        this.logger.debug('Nbr of database watchers (before removal):', this.watchers.database);
        this.webSocket.removeEventListener(CONSTANTS.PROJECT_DELETED, eventHandler);
        this.webSocket.removeEventListener(CONSTANTS.PROJECT_CREATED, eventHandler);
        this.watchers.database -= 1;

        if (this.watchers.database === 0) {
            this.logger.debug('No more watchers will exit database room.');
            if (this.connected) {
                this.webSocket.watchDatabase({join: false})
                    .then(deferred.resolve)
                    .catch(deferred.reject);
            } else {
                deferred.resolve();
            }
        } else if (this.watchers.database < 0) {
            this.logger.error('Number of database watchers became negative!');
            deferred.reject(new Error('Number of database watchers became negative!'));
        } else {
            deferred.resolve();
        }

        return deferred.promise.nodeify(callback);
    };

    StorageWatcher.prototype.watchProject = function (projectId, eventHandler, callback) {
        this.logger.debug('watchProject - handler added for project', projectId);
        this.webSocket.addEventListener(CONSTANTS.BRANCH_DELETED + projectId, eventHandler);
        this.webSocket.addEventListener(CONSTANTS.BRANCH_CREATED + projectId, eventHandler);
        this.webSocket.addEventListener(CONSTANTS.BRANCH_HASH_UPDATED + projectId, eventHandler);

        this.watchers.projects[projectId] = this.watchers.projects.hasOwnProperty(projectId) ?
            this.watchers.projects[projectId] + 1 : 1;
        this.logger.debug('Nbr of watchers for project:', projectId, this.watchers.projects[projectId]);
        if (this.watchers.projects[projectId] === 1) {
            this.logger.debug('First watcher will enter project room:', projectId);
            this.webSocket.watchProject({projectId: projectId, join: true})
                .nodeify(callback);
        } else {
            return Q().nodeify(callback);
        }
    };

    StorageWatcher.prototype.unwatchProject = function (projectId, eventHandler, callback) {
        var deferred = Q.defer();

        this.logger.debug('unwatchProject - handler will be removed', projectId);
        this.logger.debug('Nbr of database watchers (before removal):', projectId,
            this.watchers.projects[projectId]);
        this.webSocket.removeEventListener(CONSTANTS.BRANCH_DELETED + projectId, eventHandler);
        this.webSocket.removeEventListener(CONSTANTS.BRANCH_CREATED + projectId, eventHandler);
        this.webSocket.removeEventListener(CONSTANTS.BRANCH_HASH_UPDATED + projectId, eventHandler);

        this.watchers.projects[projectId] = this.watchers.projects.hasOwnProperty(projectId) ?
            this.watchers.projects[projectId] - 1 : -1;
        if (this.watchers.projects[projectId] === 0) {
            this.logger.debug('No more watchers will exit project room:', projectId);
            delete this.watchers.projects[projectId];
            if (this.connected) {
                this.webSocket.watchProject({projectId: projectId, join: false})
                    .then(deferred.resolve)
                    .catch(deferred.reject);
            } else {
                deferred.resolve();
            }
        } else if (this.watchers.projects[projectId] < 0) {
            this.logger.error('Number of project watchers became negative!:', projectId);
            deferred.reject(new Error('Number of project watchers became negative!'));
        } else {
            deferred.resolve();
        }

        return deferred.promise.nodeify(callback);
    };

    /**
     * Start watching the document at the provided context.
     * @param {object} data
     * @param {string} data.projectId
     * @param {string} data.branchName
     * @param {string} data.nodeId
     * @param {string} data.attrName
     * @param {string} data.attrValue - If the first client entering the document the value will be used
     * @param {function} atOperation - Triggered when other clients made changes
     * @param {ot.Operation} atOperation.operation - Triggered when other clients' operations were applied
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
    StorageWatcher.prototype.watchDocument = function (data, atOperation, atSelection, callback) {
        var self = this,
            docUpdateEventName = this.webSocket.getDocumentUpdatedEventName(data),
            docSelectionEventName = this.webSocket.getDocumentSelectionEventName(data),
            docId = docUpdateEventName.substring(CONSTANTS.DOCUMENT_OPERATION.length),
            watcherId = GUID();

        data = JSON.parse(JSON.stringify(data));
        this.logger.debug('watchDocument - handler added for project', data);
        this.watchers.documents[docId] = this.watchers.documents[docId] || {};
        this.watchers.documents[docId][watcherId] = {
            eventHandler: function (_ws, eData) {
                var otClient = self.watchers.documents[eData.docId][watcherId].otClient;
                self.logger.debug('eventHandler for document', {metadata: eData});

                if (eData.watcherId === watcherId) {
                    self.logger.info('event from same watcher, skipping...');
                    return;
                }

                if (eData.operation) {
                    if (self.reconnecting) {
                        // We are reconnecting.. Put these on the queue.
                        self.watchers.documents[docId][watcherId].applyBuffer.push(eData);
                    } else {
                        otClient.applyServer(ot.TextOperation.fromJSON(eData.operation));
                    }
                }

                if (eData.hasOwnProperty('selection') && !self.reconnecting) {
                    atSelection({
                        selection: eData.selection ?
                            otClient.transformSelection(ot.Selection.fromJSON(eData.selection)) : null,
                        socketId: eData.socketId,
                        userId: eData.userId
                    });
                }
            },
            applyBuffer: [],
            awaitingAck: null
        };

        this.webSocket.addEventListener(docUpdateEventName, this.watchers.documents[docId][watcherId].eventHandler);
        this.webSocket.addEventListener(docSelectionEventName, this.watchers.documents[docId][watcherId].eventHandler);

        data.join = true;
        data.sessionId = this.watchers.sessionId;
        data.watcherId = watcherId;

        return this.webSocket.watchDocument(data)
            .then(function (initData) {
                self.watchers.documents[initData.docId][watcherId].otClient = new ot.Client(initData.revision);

                self.watchers.documents[initData.docId][watcherId].otClient.sendOperation =
                    function (revision, operation) {
                        var sendData = {
                            docId: initData.docId,
                            projectId: initData.projectId,
                            branchName: initData.branchName,
                            revision: revision,
                            operation: operation,
                            selection: self.watchers.documents[initData.docId][watcherId].selection,
                            sessionId: self.watchers.sessionId,
                            watcherId: watcherId
                        };

                        self.watchers.documents[initData.docId][watcherId].awaitingAck = {
                            revision: revision,
                            operation: operation
                        };

                        self.webSocket.sendDocumentOperation(sendData, function (err) {
                            if (err) {
                                self.logger.error('Failed to sendDocument', err);
                                return;
                            }

                            if (self.watchers.documents.hasOwnProperty(initData.docId) &&
                                self.watchers.documents[initData.docId].hasOwnProperty(watcherId)) {
                                self.watchers.documents[initData.docId][watcherId].awaitingAck = null;
                                self.watchers.documents[initData.docId][watcherId].otClient.serverAck(revision);
                            } else {
                                self.logger.error(new Error('Received document acknowledgement ' +
                                    'after watcher left document ' + initData.docId));
                            }
                        });
                    };

                self.watchers.documents[initData.docId][watcherId].otClient.applyOperation = atOperation;

                return initData;
            })
            .nodeify(callback);
    };

    /**
     * Stop watching the document.
     * @param {object} data
     * @param {string} data.docId - document id, if not provided projectId, branchName, nodeId, attrName must be.
     * @param {string} data.watcherId
     * @param {string} [data.projectId]
     * @param {string} [data.branchName]
     * @param {string} [data.nodeId]
     * @param {string} [data.attrName]
     * @param {function} [callback]
     * @param {Error | null} callback.err - If failed to unwatch the document
     * @returns {Promise}
     */
    StorageWatcher.prototype.unwatchDocument = function (data, callback) {
        var deferred = Q.defer(),
            docUpdateEventName = this.webSocket.getDocumentUpdatedEventName(data),
            docSelectionEventName = this.webSocket.getDocumentSelectionEventName(data),
            pieces;

        if (typeof data.docId === 'string') {
            pieces = _splitDocId(data.docId);
            Object.keys(pieces)
                .forEach(function (key) {
                    data[key] = pieces[key];
                });
        } else {
            data.docId = docUpdateEventName.substring(CONSTANTS.DOCUMENT_OPERATION.length);
        }

        if (typeof data.watcherId !== 'string') {
            deferred.reject(new Error('data.watcherId not provided - use the one given at watchDocument.'));
        } else if (this.watchers.documents.hasOwnProperty(data.docId) === false ||
            this.watchers.documents[data.docId].hasOwnProperty(data.watcherId) === false) {
            deferred.reject(new Error('Document is not being watched ' + data.docId +
                ' by watcherId [' + data.watcherId + ']'));
        } else {
            // Remove handler from web-socket module.
            this.webSocket.removeEventListener(docUpdateEventName,
                this.watchers.documents[data.docId][data.watcherId].eventHandler);
            this.webSocket.removeEventListener(docSelectionEventName,
                this.watchers.documents[data.docId][data.watcherId].eventHandler);

            // "Remove" handlers attached to the otClient.
            this.watchers.documents[data.docId][data.watcherId].otClient.sendOperation =
                this.watchers.documents[data.docId][data.watcherId].otClient.applyOperation = function () {
                };

            delete this.watchers.documents[data.docId][data.watcherId];

            if (Object.keys(this.watchers.documents[data.docId]).length === 0) {
                delete this.watchers.documents[data.docId];
            }

            // Finally exit socket.io room on server if connected.
            if (this.connected) {
                data.join = false;
                this.webSocket.watchDocument(data)
                    .then(deferred.resolve)
                    .catch(deferred.reject);
            } else {
                deferred.resolve();
            }
        }

        return deferred.promise.nodeify(callback);
    };

    /**
     * Send operation made, and optionally selection, on document at docId.
     * @param {object} data
     * @param {string} data.docId
     * @param {string} data.watcherId
     * @param {ot.TextOperation} data.operation
     * @param {ot.Selection} [data.selection]
     */
    StorageWatcher.prototype.sendDocumentOperation = function (data) {
        // TODO: Do we need to add a callback for confirmation here?
        if (typeof data.watcherId !== 'string') {
            throw new Error('data.watcherId not provided - use the one given at watchDocument.');
        } else if (this.watchers.documents.hasOwnProperty(data.docId) &&
            this.watchers.documents[data.docId].hasOwnProperty(data.watcherId) &&
            this.watchers.documents[data.docId][data.watcherId].otClient instanceof ot.Client) {

            this.watchers.documents[data.docId][data.watcherId].selection = data.selection;
            this.watchers.documents[data.docId][data.watcherId].otClient.applyClient(data.operation);
        } else {
            throw new Error('Document not being watched ' + data.docId +
                '. (If "watchDocument" was initiated make sure to wait for the callback.)');
        }
    };

    /**
     * Send selection on document at docId. (Will only be transmitted if client is Synchronized.)
     * @param {object} data
     * @param {string} data.docId
     * @param {string} data.watcherId
     * @param {ot.Selection} data.selection
     */
    StorageWatcher.prototype.sendDocumentSelection = function (data) {
        var self = this,
            otClient;

        if (typeof data.watcherId !== 'string') {
            throw new Error('data.watcherId not provided - use the one given at watchDocument.');
        } else if (this.watchers.documents.hasOwnProperty(data.docId) &&
            this.watchers.documents[data.docId].hasOwnProperty(data.watcherId) &&
            this.watchers.documents[data.docId][data.watcherId].otClient instanceof ot.Client) {

            otClient = this.watchers.documents[data.docId][data.watcherId].otClient;

            if (otClient.state instanceof ot.Client.Synchronized) {
                // Only broadcast the selection when synchronized
                this.webSocket.sendDocumentSelection({
                    docId: data.docId,
                    watcherId: data.watcherId,
                    revision: otClient.revision,
                    selection: data.selection
                }, function (err) {
                    if (err) {
                        self.logger.error(err);
                    }
                });
            }

        } else {
            throw new Error('Document not being watched ' + data.docId +
                '. (If "watchDocument" was initiated make sure to wait for the callback.)');
        }
    };

    StorageWatcher.prototype._rejoinWatcherRooms = function (callback) {
        var self = this,
            promises = [],
            projectId;

        // When this is called were are in the self.reconnecting === true state until callback resolved.

        this.logger.debug('rejoinWatcherRooms');
        if (this.watchers.database > 0) {
            this.logger.debug('Rejoining database room.');
            promises.push(Q.ninvoke(this.webSocket, 'watchDatabase', {join: true}));
        }

        for (projectId in this.watchers.projects) {
            if (this.watchers.projects.hasOwnProperty(projectId) && this.watchers.projects[projectId] > 0) {
                this.logger.debug('Rejoining project room', projectId, this.watchers.projects[projectId]);
                promises.push(this.webSocket.watchProject({projectId: projectId, join: true}));
            }
        }

        function rejoinWatchers(docId, watcherIds) {
            var rejoinData = _splitDocId(docId),
                watcherId = watcherIds.pop();

            rejoinData.docId = docId;
            rejoinData.rejoin = true;
            rejoinData.revision = self.watchers.documents[docId][watcherId].otClient.revision;
            rejoinData.sessionId = self.watchers.sessionId;
            rejoinData.watcherId = watcherId;

            return self.webSocket.watchDocument(rejoinData)
                .then(function (joinData) {
                    var deferred = Q.defer(),
                        awaiting = self.watchers.documents[docId][watcherId].awaitingAck,
                        sendData;

                    function applyFromServer() {
                        joinData.operations.forEach(function (op) {
                            self.watchers.documents[docId][watcherId].otClient.applyServer(op.wrapped);
                        });

                        self.watchers.documents[docId][watcherId].applyBuffer.forEach(function (op) {
                            self.watchers.documents[docId][watcherId].otClient.applyServer(op);
                        });

                        self.watchers.documents[docId][watcherId].applyBuffer = [];
                    }

                    if (awaiting === null) {
                        // We had no outstanding operations - apply all from the server.
                        applyFromServer();
                        deferred.resolve();
                    } else {
                        // We were awaiting an acknowledgement, did it make it to the server?
                        if (joinData.operations.length > 0 &&
                            joinData.operations[0].metadata.sessionId === self.watchers.sessionId &&
                            joinData.operations[0].metadata.watcherId === watcherId) {
                            // It made it to the server - so send the acknowledgement to the otClient.
                            self.watchers.documents[docId][watcherId].awaitingAck = null;
                            self.watchers.documents[docId][watcherId].otClient.serverAck(awaiting.revision);

                            // Remove it from the operations and apply the other
                            joinData.operations.shift();
                            applyFromServer();
                            deferred.resolve();
                        } else {
                            applyFromServer();
                            sendData = {
                                docId: docId,
                                projectId: rejoinData.projectId,
                                branchName: rejoinData.branchName,
                                revision: awaiting.revision,
                                operation: awaiting.operation,
                                sessionId: self.watchers.sessionId,
                                watcherId: watcherId
                            };

                            self.webSocket.sendDocumentOperation(sendData, function (err) {
                                if (err) {
                                    deferred.reject(err);
                                    return;
                                }

                                if (self.watchers.documents.hasOwnProperty(docId) &&
                                    self.watchers.documents[docId].hasOwnProperty(watcherId)) {
                                    self.watchers.documents[docId][watcherId].awaitingAck = null;
                                    self.watchers.documents[docId][watcherId].otClient.serverAck(sendData.revision);
                                } else {
                                    self.logger.error(new Error('Received document acknowledgement ' +
                                        'after leaving document ' + docId));
                                }

                                deferred.resolve();
                            });
                        }
                    }

                    return deferred.promise;
                })
                .then(function () {
                    if (watcherIds.length > 0) {
                        rejoinWatchers(docId, watcherIds);
                    }
                });
        }

        Object.keys(this.watchers.documents).forEach(function (docId) {
            promises.push(rejoinWatchers(docId, Object.keys(self.watchers.documents[docId])));
        });

        return Q.all(promises).nodeify(callback);
    };

    return StorageWatcher;
});