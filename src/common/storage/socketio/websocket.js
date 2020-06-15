/*globals define*/
/*eslint-env node, browser*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

// socket.io-client
//
define([
    'common/EventDispatcher',
    'common/storage/constants',
    'q'
], function (EventDispatcher, CONSTANTS, Q) {

    'use strict';

    function WebSocket(ioClient, mainLogger, gmeConfig) {
        var self = this,
            logger = mainLogger.fork('WebSocket'),
            forcedDisconnect,
            beenConnected = false;

        self.socket = null;
        self.userId = null;
        self.serverVersion = null;
        self.ioClient = ioClient;
        self._handleWebsocketRouterMessage = () => {};

        logger.debug('ctor');
        EventDispatcher.call(this);

        function emitWithToken(data, eventName, callback) {
            logger.debug('emitting event', eventName, {metadata: data});
            data.webgmeToken = ioClient.getToken();
            if (callback) {
                self.socket.emit(eventName, data, callback);
            } else {
                return Q.ninvoke(self.socket, 'emit', eventName, data);
            }
        }

        this.connect = function (networkHandler) {

            logger.debug('Connecting via ioClient.');
            forcedDisconnect = false;

            ioClient.connect(function (err, socket_) {
                if (err) {
                    networkHandler(err);
                    return;
                }

                self.socket = socket_;

                self.socket.on('connect', function () {
                    var i,
                        sendBufferSave = [];
                    if (beenConnected) {
                        logger.debug('Socket got reconnected.');
                        networkHandler(null, CONSTANTS.RECONNECTING);

                        // #368
                        for (i = 0; i < self.socket.sendBuffer.length; i += 1) {
                            // Clear all makeCommit and document operations.
                            // If pushed - they would be emitted back to the socket!
                            if (self.socket.sendBuffer[i].data[0] === 'makeCommit' ||
                                self.socket.sendBuffer[i].data[0] === CONSTANTS.DOCUMENT_OPERATION) {
                                logger.debug('Removed makeCommit from sendBuffer...');
                            } else {
                                sendBufferSave.push(self.socket.sendBuffer[i]);
                            }
                        }
                        if (self.socket.receiveBuffer.length > 0) {
                            // TODO: In which cases is this applicable??
                            logger.debug('receiveBuffer not empty after reconnect');
                        }
                        self.socket.sendBuffer = sendBufferSave;
                        self.socket.emit('getConnectionInfo', {webgmeToken: ioClient.getToken()}, function (err, info) {
                            if (err) {
                                networkHandler(new Error('Could not get info on reconnect'));
                            } else {
                                if (self.serverVersion === info.serverVersion) {
                                    networkHandler(null, CONSTANTS.RECONNECTED);
                                } else {
                                    logger.error('Got reconnected to different webgme version (old !== new)',
                                        self.serverVersion, '!==', info.serverVersion);
                                    networkHandler(null, CONSTANTS.INCOMPATIBLE_CONNECTION);
                                }
                            }
                        });
                    } else {
                        logger.debug('Socket got connected for the first time.');
                        beenConnected = true;
                        self.socket.emit('getConnectionInfo', {webgmeToken: ioClient.getToken()}, function (err, info) {
                            if (err) {
                                networkHandler(new Error('Could not get info on connect'));
                            } else {
                                self.userId = info.userId || gmeConfig.authentication.guestAccount;
                                self.serverVersion = info.serverVersion;
                                networkHandler(null, CONSTANTS.CONNECTED);
                            }
                        });
                    }
                });

                self.socket.on('disconnect', function () {
                    logger.debug('Socket got disconnected!');
                    networkHandler(null, CONSTANTS.DISCONNECTED);

                    // When the server is shut-down the skipReconnect is set to false
                    // create a new socket connect.
                    if (self.socket.io.skipReconnect === true && forcedDisconnect === false) {
                        self.connect(networkHandler);
                    }
                });

                self.socket.on(CONSTANTS.JWT_ABOUT_TO_EXPIRE, function (data) {
                    data.etype = CONSTANTS.JWT_ABOUT_TO_EXPIRE;
                    logger.debug('JWT_ABOUT_TO_EXPIRE event', {metadata: data});
                    networkHandler(null, CONSTANTS.JWT_ABOUT_TO_EXPIRE);
                });

                self.socket.on(CONSTANTS.JWT_EXPIRED, function (data) {
                    data.etype = CONSTANTS.JWT_EXPIRED;
                    logger.debug('JWT_EXPIRED event', {metadata: data});
                    networkHandler(null, CONSTANTS.JWT_EXPIRED);
                });

                self.socket.on(CONSTANTS.PROJECT_DELETED, function (data) {
                    data.etype = CONSTANTS.PROJECT_DELETED;
                    logger.debug('PROJECT_DELETED event', {metadata: data});
                    self.dispatchEvent(CONSTANTS.PROJECT_DELETED, data);
                });

                self.socket.on(CONSTANTS.PROJECT_CREATED, function (data) {
                    data.etype = CONSTANTS.PROJECT_CREATED;
                    logger.debug('PROJECT_CREATED event', {metadata: data});
                    self.dispatchEvent(CONSTANTS.PROJECT_CREATED, data);
                });

                self.socket.on(CONSTANTS.BRANCH_CREATED, function (data) {
                    data.etype = CONSTANTS.BRANCH_CREATED;
                    logger.debug('BRANCH_CREATED event', {metadata: data});
                    self.dispatchEvent(CONSTANTS.BRANCH_CREATED + data.projectId, data);
                });

                self.socket.on(CONSTANTS.BRANCH_DELETED, function (data) {
                    data.etype = CONSTANTS.BRANCH_DELETED;
                    logger.debug('BRANCH_DELETED event', {metadata: data});
                    self.dispatchEvent(CONSTANTS.BRANCH_DELETED + data.projectId, data);
                });

                self.socket.on(CONSTANTS.BRANCH_HASH_UPDATED, function (data) {
                    data.etype = CONSTANTS.BRANCH_HASH_UPDATED;
                    logger.debug('BRANCH_HASH_UPDATED event', {metadata: data});
                    self.dispatchEvent(CONSTANTS.BRANCH_HASH_UPDATED + data.projectId, data);
                });

                self.socket.on(CONSTANTS.TAG_CREATED, function (data) {
                    data.etype = CONSTANTS.TAG_CREATED;
                    logger.debug('TAG_CREATED event', {metadata: data});
                    self.dispatchEvent(CONSTANTS.TAG_CREATED + data.projectId, data);
                });

                self.socket.on(CONSTANTS.TAG_DELETED, function (data) {
                    data.etype = CONSTANTS.TAG_DELETED;
                    logger.debug('TAG_DELETED event', {metadata: data});
                    self.dispatchEvent(CONSTANTS.TAG_DELETED + data.projectId, data);
                });

                self.socket.on(CONSTANTS.BRANCH_UPDATED, function (data) {
                    logger.debug('BRANCH_UPDATED event', {metadata: data});
                    self.dispatchEvent(self.getBranchUpdateEventName(data.projectId, data.branchName), data);
                });

                self.socket.on(CONSTANTS.NOTIFICATION, function (data) {
                    logger.debug('NOTIFICATION event', {metadata: data});
                    self.dispatchEvent(CONSTANTS.NOTIFICATION, data);
                });

                self.socket.on(CONSTANTS.DOCUMENT_OPERATION, function (data) {
                    logger.debug('DOCUMENT_OPERATION event', {metadata: data});
                    self.dispatchEvent(self.getDocumentUpdatedEventName(data), data);
                });

                self.socket.on(CONSTANTS.DOCUMENT_SELECTION, function (data) {
                    logger.debug('DOCUMENT_SELECTION event', {metadata: data});
                    self.dispatchEvent(self.getDocumentSelectionEventName(data), data);
                });

                self.socket.on('websocketRouterMessage', function (data) {
                    logger.debug('websocketRouterMessage', {metadata: data});
                    self._handleWebsocketRouterMessage(data.routerId, data.messageType, data.payload);
                });
            });
        };

        this.disconnect = function () {
            forcedDisconnect = true;
            self.socket.disconnect();
            beenConnected = false; //This is a forced disconnect from the storage and all listeners are removed
        };

        // watcher functions
        this.watchDatabase = function (data, callback) {
            return emitWithToken(data, 'watchDatabase')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.watchProject = function (data, callback) {
            return emitWithToken(data, 'watchProject')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.watchBranch = function (data, callback) {
            return emitWithToken(data, 'watchBranch')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        // model editing functions
        this.openProject = function (data, callback) {
            return emitWithToken(data, 'openProject')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.closeProject = function (data, callback) {
            return emitWithToken(data, 'closeProject')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.openBranch = function (data, callback) {
            return emitWithToken(data, 'openBranch')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.closeBranch = function (data, callback) {
            return emitWithToken(data, 'closeBranch')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.makeCommit = function (data, callback) {
            return emitWithToken(data, 'makeCommit')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.loadObjects = function (data, callback) {
            return emitWithToken(data, 'loadObjects')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.loadPaths = function (data, callback) {
            return emitWithToken(data, 'loadPaths')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.setBranchHash = function (data, callback) {
            return emitWithToken(data, 'setBranchHash')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.getBranchHash = function (data, callback) {
            return emitWithToken(data, 'getBranchHash')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.squashCommits = function (data, callback) {
            return emitWithToken(data, 'squashCommits')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        // REST like functions
        this.getProjects = function (data, callback) {
            return emitWithToken(data, 'getProjects')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.deleteProject = function (data, callback) {
            return emitWithToken(data, 'deleteProject')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.createProject = function (data, callback) {
            return emitWithToken(data, 'createProject')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.transferProject = function (data, callback) {
            return emitWithToken(data, 'transferProject')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.duplicateProject = function (data, callback) {
            return emitWithToken(data, 'duplicateProject')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.getBranches = function (data, callback) {
            return emitWithToken(data, 'getBranches')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.createTag = function (data, callback) {
            return emitWithToken(data, 'createTag')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.deleteTag = function (data, callback) {
            return emitWithToken(data, 'deleteTag')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.getTags = function (data, callback) {
            return emitWithToken(data, 'getTags')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.getCommits = function (data, callback) {
            return emitWithToken(data, 'getCommits')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.getHistory = function (data, callback) {
            return emitWithToken(data, 'getHistory')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.getLatestCommitData = function (data, callback) {
            return emitWithToken(data, 'getLatestCommitData')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.getCommonAncestorCommit = function (data, callback) {
            return emitWithToken(data, 'getCommonAncestorCommit')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        //temporary simple request / result functions
        this.simpleRequest = function (data, callback) {
            var deferred = Q.defer();
            emitWithToken(data, 'simpleRequest', function (errStr, result) {
                var err;
                if (errStr) {
                    err = new Error(errStr);
                    if (result) {
                        // webgme #1570 For failed plugin executions we need the result details
                        err.result = result;
                    }

                    deferred.reject(err);
                } else {
                    deferred.resolve(result);
                }
            });

            return deferred.promise.nodeify(callback);
        };

        this.simpleQuery = function (workerId, data, callback) {
            return Q.reject(new Error('Not implemented!')).nodeify(callback);
        };

        this.sendNotification = function (data, callback) {
            return emitWithToken(data, 'notification')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        // OT handling
        this.watchDocument = function (data, callback) {
            return emitWithToken(data, 'watchDocument')
                .catch(function (err) {
                    return Q.reject(new Error(err));
                })
                .nodeify(callback);
        };

        this.sendDocumentOperation = function (data, callback) {
            emitWithToken(data, CONSTANTS.DOCUMENT_OPERATION, function (err, res) {
                if (err) {
                    callback(new Error(err));
                } else {
                    callback(null, res);
                }
            });
        };

        this.sendDocumentSelection = function (data, callback) {
            emitWithToken(data, CONSTANTS.DOCUMENT_SELECTION, function (err, res) {
                if (err) {
                    callback(new Error(err));
                } else {
                    callback(null, res);
                }
            });
        };

        // Helper functions
        this.getBranchUpdateEventName = function (projectId, branchName) {
            return CONSTANTS.BRANCH_UPDATED + projectId + CONSTANTS.ROOM_DIVIDER + branchName;
        };

        this.getDocumentUpdatedEventName = function (data) {
            if (typeof data.docId === 'string') {
                return CONSTANTS.DOCUMENT_OPERATION + data.docId;
            } else {
                return [CONSTANTS.DOCUMENT_OPERATION + data.projectId, data.branchName, data.nodeId, data.attrName]
                    .join(CONSTANTS.ROOM_DIVIDER);
            }
        };

        this.getDocumentSelectionEventName = function (data) {
            if (typeof data.docId === 'string') {
                return CONSTANTS.DOCUMENT_SELECTION + data.docId;
            } else {
                return [CONSTANTS.DOCUMENT_SELECTION + data.projectId, data.branchName, data.nodeId, data.attrName]
                    .join(CONSTANTS.ROOM_DIVIDER);
            }
        };

        // Router websocket relay messaging
        this.sendWsRouterMessage = function (routerId, messageType, payload, callback) {
            const data = {
                routerId: routerId,
                messageType: messageType,
                payload: payload,
            };

            return emitWithToken(data, 'websocketRouterMessage', (err, result) => {
                if (err) {
                    callback(new Error(err), result);
                } else {
                    callback(err, result);
                }
            });
                
        };

        this.onWebsocketRouterMessage = function (handleFn) {
            self._handleWebsocketRouterMessage = handleFn;
        };
    }

    WebSocket.prototype = Object.create(EventDispatcher.prototype);
    WebSocket.prototype.constructor = WebSocket;

    return WebSocket;
});