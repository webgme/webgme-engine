/*globals requireJS*/
/*eslint-env node*/

/**
 * @module Server:WebSockets
 * @author pmeijer / https://github.com/pmeijer
 */
'use strict';

var io = require('socket.io'),
    redis = require('socket.io-redis'),
    Q = require('q'),
    UTIL = require('../../utils'),
    DocumentServer = require('./documentserver'),    URL = requireJS('common/util/url'),
    CONSTANTS = requireJS('common/storage/constants'),
    PACKAGE_JSON;

PACKAGE_JSON = UTIL.getPackageJsonSync();

function WebSocket(storage, mainLogger, gmeConfig, gmeAuth, workerManager) {
    var logger = mainLogger.fork('WebSocket'),
        metadataStorage = gmeAuth.metadataStorage,
        authorizer = gmeAuth.authorizer,
        projectAuthParams = {
            entityType: authorizer.ENTITY_TYPES.PROJECT
        },
        documents = {
            //<docId> : { otServer: DocumentServer, users: {}, disconnectedUsers: {} }
        }, // TODO: This is a single state on one server!
        webSocket;

    logger.debug('ctor');

    function getTokenFromHandshake(socket) {
        var token,
            handshakeData = socket.handshake;

        if (handshakeData && handshakeData.headers.cookie) {
            // We try to dig it from the cookie.
            token = URL.parseCookie(handshakeData.headers.cookie)[gmeConfig.authentication.jwt.cookieId];
        }

        return token;
    }

    function getUserIdFromToken(socket, token, callback) {
        var deferred = Q.defer();

        if (gmeConfig.authentication.enable === true) {
            gmeAuth.verifyJWToken(token)
                .then(function (result) {
                    // Check if token is about to expire
                    if (result.renew === true) {
                        logger.debug('JWT_ABOUT_TO_EXPIRE for user', result.content.userId, socket.id);
                        socket.emit(CONSTANTS.JWT_ABOUT_TO_EXPIRE, {
                            exp: result.content.exp,
                            iat: result.content.iat
                        });
                    }

                    deferred.resolve(result.content.userId);
                })
                .catch(function (err) {
                    if (err.name === 'TokenExpiredError') {
                        logger.debug('JWT_EXPIRED for socket', socket.id);
                        socket.emit(CONSTANTS.JWT_EXPIRED, {});
                        deferred.reject(new Error('TokenExpired'));
                    } else {
                        deferred.reject(err);
                    }
                });
        } else {
            deferred.resolve(gmeConfig.authentication.guestAccount);
        }

        return deferred.promise.nodeify(callback);
    }

    function projectAccess(socket, token, projectId, callback) {
        return getUserIdFromToken(socket, token)
            .then(function (userId) {
                return authorizer.getAccessRights(userId, projectId, projectAuthParams);
            })
            .nodeify(callback);
    }

    function getEmitter(data) {
        var emitter;
        delete data.webgmeToken;

        if (data.socket) {
            logger.debug('socket provided - will broadcast from ', data.socket.id);
            emitter = data.socket.broadcast;
            delete data.socket;
        } else {
            // Changes from the server itself needs to emit to all sockets.
            logger.debug('socket NOT provided - will emit to everybody.');
            emitter = webSocket;
        }
        return emitter;
    }

    function joinBranchRoom(socket, token, projectId, branchName) {
        var deferred = Q.defer(),
            roomName = projectId + CONSTANTS.ROOM_DIVIDER + branchName,
            userId = socket.userId,
            notificationData = {
                projectId: projectId,
                branchName: branchName,
                userId: userId,
                socketId: socket.id,
                join: true
            };

        if (socket.rooms.hasOwnProperty(roomName) === true) {
            // Socket is already in given room - no need to account for it.
            logger.debug('socket already in room', socket.id, roomName);
            deferred.resolve();
        } else {
            Q.ninvoke(socket, 'join', roomName)
                .then(function () {
                    var eventData = {
                        projectId: projectId,
                        branchName: branchName,
                        userId: userId,
                        webgmeToken: token
                    };

                    logger.debug('socket joined room', socket.id, notificationData.userId, roomName);

                    notificationData.type = CONSTANTS.BRANCH_ROOM_SOCKETS;

                    socket.broadcast.to(roomName).emit(CONSTANTS.NOTIFICATION, notificationData);

                    storage.dispatchEvent(CONSTANTS.BRANCH_JOINED, eventData);
                    deferred.resolve();
                })
                .catch(function (err) {
                    deferred.reject(err instanceof Error ? err : new Error(err));
                });
        }

        return deferred.promise;
    }

    function leaveBranchRoom(socket, projectId, branchName/*, disconnected*/) {
        var deferred = Q.defer(),
            roomName = projectId + CONSTANTS.ROOM_DIVIDER + branchName,
            userId = socket.userId,
            notificationData = {
                projectId: projectId,
                branchName: branchName,
                userId: userId,
                socketId: socket.id
            };

        if (socket.rooms.hasOwnProperty(roomName) === false) {
            // Socket was never in or had already left given room - no need to account for it.
            logger.debug('socket already left room', socket.id, roomName);
            deferred.resolve();
        } else {
            notificationData.type = CONSTANTS.BRANCH_ROOM_SOCKETS;
            socket.broadcast.to(roomName).emit(CONSTANTS.NOTIFICATION, notificationData);
            Q.ninvoke(socket, 'leave', roomName)
                .then(function () {
                    var eventData = {
                        projectId: projectId,
                        branchName: branchName,
                        userId: userId
                    };

                    logger.debug('socket left room', socket.id, notificationData.userId, roomName);

                    storage.dispatchEvent(CONSTANTS.BRANCH_LEFT, eventData);
                    deferred.resolve();
                })
                .catch(function (err) {
                    deferred.reject(err instanceof Error ? err : new Error(err));
                });
        }

        return deferred.promise;
    }

    storage.addEventListener(CONSTANTS.PROJECT_DELETED, function (_s, data) {
        getEmitter(data).to(CONSTANTS.DATABASE_ROOM).emit(CONSTANTS.PROJECT_DELETED, data);
    });

    storage.addEventListener(CONSTANTS.PROJECT_CREATED, function (_s, data) {
        getEmitter(data).to(CONSTANTS.DATABASE_ROOM).emit(CONSTANTS.PROJECT_CREATED, data);
    });

    storage.addEventListener(CONSTANTS.BRANCH_DELETED, function (_s, data) {
        getEmitter(data).to(data.projectId).emit(CONSTANTS.BRANCH_DELETED, data);
    });

    storage.addEventListener(CONSTANTS.BRANCH_CREATED, function (_s, data) {
        getEmitter(data).to(data.projectId).emit(CONSTANTS.BRANCH_CREATED, data);
    });

    storage.addEventListener(CONSTANTS.BRANCH_HASH_UPDATED, function (_s, data) {
        getEmitter(data).to(data.projectId).emit(CONSTANTS.BRANCH_HASH_UPDATED, data);
    });

    storage.addEventListener(CONSTANTS.COMMIT, function (_s, data) {
        getEmitter(data).to(data.projectId).emit(CONSTANTS.COMMIT, data);
    });

    storage.addEventListener(CONSTANTS.TAG_CREATED, function (_s, data) {
        getEmitter(data).to(data.projectId).emit(CONSTANTS.TAG_CREATED, data);
    });

    storage.addEventListener(CONSTANTS.TAG_DELETED, function (_s, data) {
        getEmitter(data).to(data.projectId).emit(CONSTANTS.TAG_DELETED, data);
    });

    storage.addEventListener(CONSTANTS.BRANCH_UPDATED, function (_s, data) {
        getEmitter(data)
            .to(data.projectId + CONSTANTS.ROOM_DIVIDER + data.branchName)
            .emit(CONSTANTS.BRANCH_UPDATED, data);
    });

    this.start = function (server) {
        logger.debug('start');

        webSocket = io.listen(server || gmeConfig.server.port, gmeConfig.socketIO.serverOptions);

        if (gmeConfig.socketIO.adapter.type.toLowerCase() === 'redis') {
            logger.info('redis adapter:', JSON.stringify(gmeConfig.socketIO.adapter.options));
            webSocket.adapter(redis(gmeConfig.socketIO.adapter.options.uri));
        }

        logger.debug('listening');

        webSocket.use(function (socket, next) {
            getUserIdFromToken(socket, getTokenFromHandshake(socket))
                .then(function (userId) {
                    logger.debug('User connected and authenticated', userId);
                    socket.userId = userId;
                    next();
                })
                .catch(next);
        });

        webSocket.on('connection', function (socket) {
            logger.debug('New socket connected', socket.id);

            // Inject into socket.onclose in order to see which rooms socket was in.
            var originalOnClose = socket.onclose;
            socket.onclose = function () {
                var i,
                    roomIds,
                    projectIdBranchName,
                    userInfo,
                    roomDividerCnt;

                if (webSocket) {
                    roomIds = Object.keys(socket.rooms);
                    for (i = 0; i < roomIds.length; i += 1) {
                        // This is not the prettiest, but we know that branchRooms
                        // are divided by one ROOM_DIVIDER (projectId % branchName),
                        // whereas document rooms are divided by 3 ROOM_DIVIDER
                        // (projectId % branchName % nodeId % attrName).
                        roomDividerCnt = roomIds[i].split(CONSTANTS.ROOM_DIVIDER).length;

                        if (roomDividerCnt === 2) {
                            logger.debug('Disconnected was in branchRoom', roomIds[i]);
                            projectIdBranchName = roomIds[i].split(CONSTANTS.ROOM_DIVIDER);
                            // We cannot wait for this since socket.onclose is synchronous.
                            leaveBranchRoom(socket, projectIdBranchName[0], projectIdBranchName[1])
                                .fail(function (err) {
                                    logger.error(err);
                                });
                        } else if (roomDividerCnt === 4) {
                            logger.info('Disconnected socket was in document room', roomIds[i]);
                            if (documents.hasOwnProperty(roomIds[i])) {
                                userInfo = documents[roomIds[i]].users[socket.id];
                                documents[roomIds[i]].disconnectedUsers[userInfo.sessionId] = true;
                                delete documents[roomIds[i]].users[socket.id];

                                socket.leave(roomIds[i]);
                                logger.info('socket left document room.');

                                if (Object.keys(documents[roomIds[i]].users).length === 0) {
                                    logger.info('No more connected sockets in document  - setting timeout to remove',
                                        gmeConfig.documentEditing.disconnectTimeout);

                                    documents[roomIds[i]].timeoutId = setTimeout(function () {
                                        delete documents[roomIds[i]];
                                    }, gmeConfig.documentEditing.disconnectTimeout);
                                }
                            } else {
                                logger.error('No document server object for active room');
                            }
                        }
                    }
                }

                originalOnClose.apply(socket, arguments);
            };

            socket.on('disconnect', function () {
                // When this event is triggered, the disconnect socket has already left all rooms.
                logger.debug('disconnect socket is in rooms: ', socket.id, Object.keys(socket.rooms));
            });

            socket.on('getConnectionInfo', function (data, callback) {
                var info = {
                    userId: null,
                    serverVersion: PACKAGE_JSON.version
                };
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        info.userId = userId;
                        callback(null, info);
                    })
                    .catch(function (err) {
                        callback(err.message);
                    });
            });

            // Watchers
            socket.on('watchDatabase', function (data, callback) {
                logger.debug('watchDatabase', {metadata: data});
                if (data && data.join) {
                    socket.join(CONSTANTS.DATABASE_ROOM);
                } else {
                    socket.leave(CONSTANTS.DATABASE_ROOM);
                }
                callback(null);
            });

            socket.on('watchProject', function (data, callback) {
                logger.debug('watchProject', {metadata: data});
                data = data || {};
                projectAccess(socket, data.webgmeToken, data.projectId)
                    .then(function (access) {
                        if (data.join) {
                            if (access.read) {
                                socket.join(data.projectId);
                                logger.debug('socket joined room', data.projectId);
                                callback(null);
                            } else {
                                logger.warn('socket not authorized to join room', data.projectId);
                                callback('No read access for ' + data.projectId);
                            }
                        } else {
                            socket.leave(data.projectId);
                            logger.debug('socket left room', data.projectId);
                            callback(null);
                        }
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('watchBranch', function (data, callback) {
                // This is emitted from clients that got disconnected while having branches open.
                logger.debug('watchBranch', {metadata: data});
                data = data || {};
                projectAccess(socket, data.webgmeToken, data.projectId)
                    .then(function (access) {
                        if (data.join) {
                            if (access.read) {
                                joinBranchRoom(socket, data.webgmeToken, data.projectId, data.branchName)
                                    .fail(function (err) {
                                        logger.error(err);
                                    });
                            } else {
                                logger.warn('socket not authorized to join room', data.projectId);
                                throw new Error('No read access for ' + data.projectId);
                            }
                        } else {
                            leaveBranchRoom(socket, data.projectId, data.branchName)
                                .fail(function (err) {
                                    logger.error(err);
                                });
                        }
                    })
                    .then(function () {
                        callback(null);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            // Model editing
            socket.on('openProject', function (data, callback) {
                var branches,
                    access;
                logger.debug('openProject', {metadata: data});
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getBranches(data);
                    })
                    .then(function (branches_) {
                        branches = branches_;
                        return projectAccess(socket, data.webgmeToken, data.projectId);
                    })
                    .then(function (access_) {
                        var username = data.username || this.gmeConfig.authentication.guestAccount;
                        access = access_;
                        return metadataStorage.updateProjectInfo(data.projectId, {
                            viewedAt: (new Date()).toISOString(),
                            viewer: username
                        });
                    })
                    .then(function () {
                        callback(null, branches, access);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('closeProject', function (data, callback) {
                logger.debug('closeProject', {metadata: data});
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        return metadataStorage.updateProjectInfo(data.projectId, {
                            viewedAt: (new Date()).toISOString(),
                            viewer: userId || this.gmeConfig.authentication.guestAccount
                        });
                    })
                    .then(function () {
                        callback();
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('openBranch', function (data, callback) {
                var latestCommitData;
                logger.debug('openBranch', {metadata: data});
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        // This ensures read access.
                        return storage.getLatestCommitData(data);
                    })
                    .then(function (commitData) {
                        latestCommitData = commitData;
                        joinBranchRoom(socket, data.webgmeToken, data.projectId, data.branchName)
                            .fail(function (err) {
                                logger.error(err);
                            });
                    })
                    .then(function () {
                        callback(null, latestCommitData);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('closeBranch', function (data, callback) {
                logger.debug('closeBranch', {metadata: data});
                data = data || {};
                leaveBranchRoom(socket, data.projectId, data.branchName)
                    .fail(function (err) {
                        logger.error(err);
                    });

                callback(null);
            });

            socket.on('makeCommit', function (data, callback) {
                var commitStatus;
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        var roomName;
                        if (data.branchName) {
                            roomName = data.projectId + CONSTANTS.ROOM_DIVIDER + data.branchName;
                            if (socket.rooms.hasOwnProperty(roomName)) {
                                logger.debug('Committer is in the branch-room', userId, roomName);
                                data.socket = socket;
                            }
                        }

                        data.username = userId;
                        return storage.makeCommit(data);
                    })
                    .then(function (status) {
                        var now = (new Date()).toISOString();

                        commitStatus = status;
                        return metadataStorage.updateProjectInfo(data.projectId, {
                            modifiedAt: now,
                            viewedAt: now,
                            viewer: data.username,
                            modifier: data.username
                        });
                    })
                    .then(function () {
                        var tokenPromise;
                        if (commitStatus.status === CONSTANTS.FORKED && gmeConfig.storage.autoMerge.enable) {
                            // Commit was forked and auto-merge is enabled. First get a new token for the worker.
                            if (gmeConfig.authentication.enable === true) {
                                tokenPromise = gmeAuth.regenerateJWToken(data.webgmeToken);
                            } else {
                                tokenPromise = Q();
                            }

                            tokenPromise
                                .then(function (token) {
                                    var workerParameters = {
                                        command: 'autoMerge',
                                        projectId: data.projectId,
                                        mine: commitStatus.hash,
                                        theirs: data.branchName,
                                        webgmeToken: token
                                    };

                                    workerManager.request(workerParameters, function (err, result) {
                                        if (err) {
                                            logger.error('Merging failed', err);
                                        } else if (result.conflict && result.conflict.items.length > 0) {
                                            logger.info('Merge resulted in conflict', commitStatus);
                                        } else if (result.updatedBranch) {
                                            logger.info('Merge successful', commitStatus);
                                            callback(null, {
                                                status: CONSTANTS.MERGED,
                                                hash: commitStatus.hash,
                                                theirHash: result.theirCommitHash,
                                                mergeHash: result.finalCommitHash
                                            });
                                            return;
                                        } else {
                                            logger.error('No conflict nor an updateBranch, this should not happen.');
                                        }

                                        // In the cases where the merged failed or resulted in conflicts we just return
                                        // the original FORKED commit-status.
                                        callback(null, commitStatus);
                                    });
                                })
                                .catch(function (err) {
                                    callback(err.message);
                                });
                        } else {
                            callback(null, commitStatus);
                        }
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('loadObjects', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.loadObjects(data);
                    })
                    .then(function (loadedObjects) {
                        callback(null, loadedObjects); //Single load-fails are reported in this object.
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('loadPaths', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.loadPaths(data);
                    })
                    .then(function (hashDictionary) {
                        callback(null, hashDictionary);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('setBranchHash', function (data, callback) {
                var status;
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        if (socket.rooms.hasOwnProperty(data.projectId)) {
                            data.socket = socket;
                        }

                        data.username = userId;
                        return storage.setBranchHash(data);
                    })
                    .then(function (result) {
                        var now = (new Date()).toISOString(),
                            username = data.username || this.gmeConfig.authentication.guestAccount;
                        status = result;

                        return metadataStorage.updateProjectInfo(data.projectId, {
                            modifiedAt: now,
                            viewedAt: now,
                            viewer: username,
                            modifier: username
                        });
                    })
                    .then(function () {
                        callback(null, status);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('getBranchHash', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getBranchHash(data);
                    })
                    .then(function (result) {
                        callback(null, result);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            // Project operations and getters
            socket.on('getProjects', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getProjects(data);
                    })
                    .then(function (projects) {
                        callback(null, projects);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('deleteProject', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        if (socket.rooms.hasOwnProperty(CONSTANTS.DATABASE_ROOM)) {
                            data.socket = socket;
                        }

                        data.username = userId;
                        return storage.deleteProject(data);
                    })
                    .then(function (didExist) {
                        callback(null, didExist);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('createProject', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        if (socket.rooms.hasOwnProperty(CONSTANTS.DATABASE_ROOM)) {
                            data.socket = socket;
                        }

                        data.username = userId;
                        return storage.createProject(data);
                    })
                    .then(function (project) {
                        callback(null, project.projectId);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('transferProject', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        if (socket.rooms.hasOwnProperty(CONSTANTS.DATABASE_ROOM)) {
                            data.socket = socket;
                        }

                        data.username = userId;
                        return storage.transferProject(data);
                    })
                    .then(function (newProjectId) {
                        callback(null, newProjectId);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('duplicateProject', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        if (socket.rooms.hasOwnProperty(CONSTANTS.DATABASE_ROOM)) {
                            data.socket = socket;
                        }

                        data.username = userId;
                        return storage.duplicateProject(data);
                    })
                    .then(function (newProject) {
                        callback(null, newProject.projectId);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            // Tags, commits and branches
            socket.on('getBranches', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getBranches(data);
                    })
                    .then(function (branches) {
                        callback(null, branches);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('createTag', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.createTag(data);
                    })
                    .then(function () {
                        callback(null);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('deleteTag', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.deleteTag(data);
                    })
                    .then(function () {
                        callback(null);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('getTags', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getTags(data);
                    })
                    .then(function (tags) {
                        callback(null, tags);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('getCommits', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getCommits(data);
                    })
                    .then(function (commits) {
                        callback(null, commits);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('getHistory', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getHistory(data);
                    })
                    .then(function (commits) {
                        callback(null, commits);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('getLatestCommitData', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getLatestCommitData(data);
                    })
                    .then(function (commitData) {
                        callback(null, commitData);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('getCommonAncestorCommit', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.getCommonAncestorCommit(data);
                    })
                    .then(function (commonCommitHash) {
                        callback(null, commonCommitHash);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('squashCommits', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.username = userId;
                        return storage.squashCommits(data);
                    })
                    .then(function (commitResult) {
                        callback(null, commitResult);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            // Worker commands
            socket.on('simpleRequest', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        data.userId = userId;
                        data.socketId = socket.id;

                        if (gmeConfig.authentication.enable === true) {
                            return gmeAuth.regenerateJWToken(data.webgmeToken);
                        }
                    })
                    .then(function (newToken) {
                        data.webgmeToken = newToken;
                        workerManager.request(data, function (err, result) {
                            if (err) {
                                callback(err.message, result);
                            } else {
                                callback(null, result);
                            }
                        });
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on('simpleQuery', function (workerId, data, callback) {
                callback('simpleQuery is not implemented!');
            });

            // Notification handling
            socket.on('notification', function (data, callback) {
                getUserIdFromToken(socket, data && data.webgmeToken)
                    .then(function (userId) {
                        logger.debug('Incoming notification from', userId, {metadata: data});
                        data.userId = userId;
                        data.socketId = socket.id;
                        delete data.webgmeToken;

                        if (data.type === CONSTANTS.PLUGIN_NOTIFICATION) {
                            if (data.notification.toBranch &&
                                typeof data.projectId === 'string' && typeof data.branchName === 'string') {
                                webSocket.to(data.projectId + CONSTANTS.ROOM_DIVIDER + data.branchName)
                                    .emit(CONSTANTS.NOTIFICATION, data);
                            } else if (data.originalSocketId) {
                                webSocket.to(data.originalSocketId).emit(CONSTANTS.NOTIFICATION, data);
                            } else {
                                throw new Error('PLUGIN_NOTIFICATION requires provided originalSocketId to emit to.');
                            }
                        } else if (data.type === CONSTANTS.ADD_ON_NOTIFICATION) {
                            socket.broadcast.to(data.projectId + CONSTANTS.ROOM_DIVIDER + data.branchName)
                                .emit(CONSTANTS.NOTIFICATION, data);
                        } else if (data.type === CONSTANTS.CLIENT_STATE_NOTIFICATION) {
                            socket.broadcast.to(data.projectId + CONSTANTS.ROOM_DIVIDER + data.branchName)
                                .emit(CONSTANTS.NOTIFICATION, data);
                        } else {
                            throw new Error('Unknown notification type: "' + data.type + '"');
                        }
                    })
                    .then(function () {
                        callback(null);
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            // OT handling
            socket.on('watchDocument', function (data, callback) {
                var docId = data.join ? [
                    data.projectId,
                    data.branchName,
                    data.nodeId,
                    data.attrName].join(CONSTANTS.ROOM_DIVIDER) : data.docId;

                logger.info('watchDocument', docId, 'join?', data.join, 'rejoin?', data.rejoin);

                projectAccess(socket, data.webgmeToken, data.projectId)
                    .then(function (access) {
                        if (data.join === true) {
                            if (!access.read) {
                                logger.warn('socket not authorized to join document room', docId);
                                throw new Error('No read access for ' + data.projectId);
                            }

                            if (documents.hasOwnProperty(docId) === false) {
                                logger.info('First user joining document, will create it..');
                                documents[docId] = {
                                    otServer: new DocumentServer(logger, data.attrValue, docId, gmeConfig),
                                    users: {},
                                    disconnectedUsers: {},
                                    timeoutId: null
                                };
                            } else {
                                clearTimeout(documents[docId].timeoutId);
                            }

                            documents[docId].users[socket.id] = {
                                socketId: socket.id,
                                sessionId: data.sessionId,
                                userId: socket.userId,
                                access: access
                            };

                            socket.join(docId);

                            callback(null, {
                                docId: docId,
                                str: documents[docId].otServer.document,
                                revision: documents[docId].otServer.operations.length,
                                clients: documents[docId].users
                            });
                        } else if (data.rejoin === true) {
                            if (!access.read) {
                                logger.warn('socket not authorized to join document room', docId);
                                throw new Error('No longer has read access to ' + data.projectId);
                            }

                            if (documents.hasOwnProperty(docId) === false) {
                                throw new Error('Document room was closed ' + docId);
                            } else if (documents[docId].disconnectedUsers.hasOwnProperty(data.sessionId) === false) {
                                throw new Error('Document room was closed ' + docId + ' and then reopened.');
                            }

                            documents[docId].otServer.getOperationsSince(data.revision);

                            delete documents[docId].disconnectedUsers[data.sessionId];
                            clearTimeout(documents[docId].timeoutId);

                            documents[docId].users[socket.id] = {
                                socketId: socket.id,
                                userId: socket.userId,
                                sessionId: data.sessionId,
                                access: access
                            };

                            socket.join(docId);

                            callback(null, {
                                docId: docId,
                                str: documents[docId].otServer.document,
                                revision: documents[docId].otServer.operations.length,
                                operations: documents[docId].otServer.getOperationsSince(data.revision),
                                clients: documents[docId].users
                            });
                        } else {
                            if (documents.hasOwnProperty(docId) && documents[docId].users.hasOwnProperty(socket.id)) {
                                delete documents[docId].users[socket.id];
                                // FIXME: Introduce a special event for this?
                                socket.broadcast.to(data.docId).emit(CONSTANTS.DOCUMENT_SELECTION, {
                                    docId: data.docId,
                                    clientId: socket.id,
                                    userId: socket.userId,
                                    selection: undefined
                                });
                                socket.leave(docId);
                                logger.info('Client left document', docId);
                                if (Object.keys(documents[docId].users).length === 0) {
                                    logger.info('No more connected sockets in document ...');
                                    if (Object.keys(documents[docId].disconnectedUsers).length === 0) {
                                        logger.info('... no disconnectedUsers either will close the document.');
                                        delete documents[docId];
                                    } else {
                                        logger.info('.. there are disconnected users - setting timeout to close doc',
                                            gmeConfig.documentEditing.disconnectTimeout);
                                        documents[docId].timeoutId = setTimeout(function () {
                                            delete documents[docId];
                                        }, gmeConfig.documentEditing.disconnectTimeout);
                                    }
                                }
                                callback();
                            } else {
                                logger.warn('Client was never watching document', docId);
                                callback();
                            }
                        }
                    })
                    .catch(function (err) {
                        if (gmeConfig.debug) {
                            callback(err.stack);
                        } else {
                            callback(err.message);
                        }
                    });
            });

            socket.on(CONSTANTS.DOCUMENT_OPERATION, function (data, callback) {

                if (documents.hasOwnProperty(data.docId) && documents[data.docId].users.hasOwnProperty(socket.id)) {

                    if (documents[data.docId].users[socket.id].access.write === true) {
                        data.userId = documents[data.docId].users[socket.id].userId;
                        documents[data.docId].otServer.onOperation(data, function (err, wrappedOperation) {
                            if (err) {
                                callback(err.message);
                            } else {
                                // Acknowledge the operation.
                                callback();

                                socket.broadcast.to(data.docId).emit(CONSTANTS.DOCUMENT_OPERATION, {
                                    docId: data.docId,
                                    clientId: socket.id,
                                    userId: socket.userId,
                                    operation: wrappedOperation.wrapped.toJSON(),
                                    selection: wrappedOperation.selection
                                });
                            }
                        });
                    } else {
                        callback('Does not have write access to', data.docId);
                    }
                } else {
                    logger.error('Client not watching current document', data.docId);
                    callback('Cannot send operation to document not being watched');
                }
            });

            socket.on(CONSTANTS.DOCUMENT_SELECTION, function (data) {
                var transformedSelection;

                if (documents.hasOwnProperty(data.docId) && documents[data.docId].users.hasOwnProperty(socket.id)) {
                    try {
                        transformedSelection = documents[data.docId].otServer.onSelection(
                            data.revision, data.selection);

                        socket.broadcast.to(data.docId).emit(CONSTANTS.DOCUMENT_SELECTION, {
                            docId: data.docId,
                            clientId: socket.id,
                            userId: socket.userId,
                            selection: transformedSelection
                        });
                    } catch (err) {
                        logger.error(err);
                    }
                } else {
                    logger.error('Client not watching current document', data.docId);
                }
            });
        });
    };

    this.stop = function () {
        //disconnect clients
        var socketIds;
        if (webSocket) {
            socketIds = Object.keys(webSocket.sockets.connected);
            socketIds.forEach(function (socketId) {
                webSocket.sockets.connected[socketId].disconnect();
            });
            webSocket = null;
        }
    };
}

module.exports = WebSocket;