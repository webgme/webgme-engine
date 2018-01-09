/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../../_globals.js');

describe('storage-connection', function () {
    'use strict';
    var EditorStorage = testFixture.requirejs('common/storage/storageclasses/editorstorage'),
        WebSocket = testFixture.requirejs('common/storage/socketio/websocket'),
        expect = testFixture.expect,
        ot = require('webgme-ot'),
        socketIO = require('socket.io-client'),
        STORAGE_CONSTANTS = testFixture.requirejs('common/storage/constants'),
        gmeConfig = testFixture.getGmeConfig(),
        WebGME = testFixture.WebGME,
        Q = testFixture.Q,
        projectName2Id = testFixture.projectName2Id,
        logger = testFixture.logger.fork('connection.spec'),
        server,
        gmeAuth,
        safeStorage,
        ir,

        projectName = 'ConnectionProject';

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, [projectName])
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                safeStorage = testFixture.getMongoStorage(logger, gmeConfig, gmeAuth);
                return safeStorage.openDatabase();
            })
            .then(function () {
                return Q.allDone([
                    testFixture.importProject(safeStorage, {
                        projectSeed: 'seeds/EmptyProject.webgmex',
                        projectName: projectName,
                        gmeConfig: gmeConfig,
                        logger: logger
                    })
                ]);
            })
            .then(function (res) {
                ir = res[0];
                return Q.allDone([
                    ir.project.createBranch('b1', ir.commitHash),
                    ir.project.createBranch('b2', ir.commitHash),
                    ir.project.createBranch('b3', ir.commitHash),
                    ir.project.createBranch('b4', ir.commitHash),
                    ir.project.createBranch('b5', ir.commitHash),
                    ir.project.createBranch('b6', ir.commitHash)
                ]);
            })
            .nodeify(done);
    });

    after(function (done) {
        Q.allDone([
            gmeAuth.unload(),
            safeStorage.closeDatabase()
        ])
            .nodeify(done);
    });

    function createStorage(hostUrl, webgmeToken, logger, gmeConfig, timeout) {
        var ioClient,
            webSocket,
            result = {
                socket: null,
                storage: null,
                webSocket: null
            };

        hostUrl = hostUrl || 'http://127.0.0.1:' + gmeConfig.server.port;


        function IoClient(host, webgmeToken, mainLogger, gmeConfig) {
            var logger = mainLogger.fork('socketio-nodeclient');

            this.connect = function (callback) {
                var socketIoOptions = JSON.parse(JSON.stringify(gmeConfig.socketIO.clientOptions));
                if (webgmeToken) {
                    socketIoOptions.extraHeaders = {
                        Cookies: 'access_token=' + webgmeToken
                    };
                }

                logger.debug('Connecting to "' + host + '" with options', {metadata: socketIoOptions});

                result.socket = socketIO.connect(host, socketIoOptions);
                if (socketIoOptions.autoConnect === false) {
                    setTimeout(function () {
                        result.socket.open();
                    }, timeout || 0);
                }

                callback(null, result.socket);
            };

            this.getToken = function () {
                return webgmeToken;
            };
        }

        ioClient = new IoClient(hostUrl, webgmeToken, logger, gmeConfig);
        webSocket = new WebSocket(ioClient, logger, gmeConfig);
        result.storage = new EditorStorage(webSocket, logger, gmeConfig);
        result.webSocket = webSocket;

        return result;
    }

    it('should disconnect when server stops', function (done) {
        var connected = false,
            res,
            storage;

        server = WebGME.standaloneServer(gmeConfig);
        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();
                res = createStorage(null, null, logger, gmeConfig);

                storage = res.storage;

                storage.open(function (networkState) {
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        connected = true;
                        server.stop(function () {

                        });

                    } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                        if (connected === true) {
                            deferred.resolve();
                        } else {
                            deferred.reject(new Error('Was never connected'));
                        }
                    } else {
                        deferred.reject(new Error('Unexpected network state: ' + networkState));
                    }
                });

                return deferred.promise;
            })
            .nodeify(function (err) {
                Q.ninvoke(storage, 'close')
                    .finally(function (err2) {
                        // Make sure server has been closed.
                        Q.ninvoke(server, 'stop')
                            .finally(function (err3) {
                                done(err || err2 || err3);
                            });
                    });
            });
    });

    it('should disconnect and reconnect when disconnect on actual socket', function (done) {
        var connected = false,
            disconnected = false,
            res,
            storage;

        server = WebGME.standaloneServer(gmeConfig);
        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();

                res = createStorage(null, null, logger, gmeConfig);

                storage = res.storage;

                storage.open(function (networkState) {
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        connected = true;
                        res.socket.disconnect();
                    } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                        if (connected === true) {
                            disconnected = true;
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                        if (disconnected === true) {
                            deferred.resolve();
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else {
                        deferred.reject(new Error('Unexpected network state: ' + networkState));
                    }
                });

                return deferred.promise;
            })
            .nodeify(function (err) {
                Q.ninvoke(storage, 'close')
                    .finally(function (err2) {
                        Q.ninvoke(server, 'stop')
                            .finally(function (err3) {
                                done(err || err2 || err3);
                            });
                    });
            });
    });

    it('should reconnect with branch open', function (done) {
        var connected = false,
            disconnected = false,
            res,
            storage;

        server = WebGME.standaloneServer(gmeConfig);
        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();
                res = createStorage(null, null, logger, gmeConfig);

                storage = res.storage;

                storage.open(function (networkState) {
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        connected = true;
                        Q.nfcall(storage.openProject, projectName2Id(projectName))
                            .then(function () {

                                function hashUpdateHandler(data, commitQueue, updateQueue, callback) {
                                    callback(null, true);
                                }

                                function branchStatusHandler(/*branchStatus, commitQueue, updateQueue*/) {

                                }

                                return Q.nfcall(storage.openBranch, projectName2Id(projectName), 'master',
                                    hashUpdateHandler, branchStatusHandler);
                            })
                            .then(function () {
                                res.socket.disconnect();
                            });
                    } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                        if (connected === true) {
                            disconnected = true;
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                        if (disconnected === true) {
                            deferred.resolve();
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else {
                        deferred.reject(new Error('Unexpected network state: ' + networkState));
                    }
                });

                return deferred.promise;
            })
            .nodeify(function (err) {
                Q.ninvoke(storage, 'close')
                    .finally(function (err2) {
                        Q.ninvoke(server, 'stop')
                            .finally(function (err3) {
                                done(err || err2 || err3);
                            });
                    });
            });
    });

    it('should reconnect and commit uncommitted commit', function (done) {
        var connected = false,
            disconnected = false,
            res,
            storage,
            project;

        server = WebGME.standaloneServer(gmeConfig);
        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();

                res = createStorage(null, null, logger, gmeConfig);

                storage = res.storage;

                storage.open(function (networkState) {
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        connected = true;

                        Q.nfcall(storage.openProject, projectName2Id(projectName))
                            .then(function (result) {
                                var branchOpened = false;

                                project = result[0];

                                function hashUpdateHandler(data, commitQueue, updateQueue, callback) {
                                    if (branchOpened) {
                                        res.socket.disconnect();
                                    }
                                    branchOpened = true;
                                    callback(null, true);
                                }

                                function branchStatusHandler(/*branchStatus, commitQueue, updateQueue*/) {

                                }

                                return Q.nfcall(storage.openBranch, projectName2Id(projectName), 'b2',
                                    hashUpdateHandler, branchStatusHandler);
                            })
                            .then(function () {
                                return project.makeCommit('b2', [ir.commitHash], ir.rootHash, {}, 'new committt');
                            })
                            .then(function (commitStatus) {
                                if (disconnected && commitStatus.status === STORAGE_CONSTANTS.SYNCED) {
                                    deferred.resolve();
                                } else {
                                    deferred.reject('Not synced after commit ' + commitStatus.status);
                                }
                            })
                            .catch(deferred.reject);
                    } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                        if (connected === true) {
                            disconnected = true;
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                        if (disconnected === true) {
                            // All is fine. Wait for the branch status SYNC (could come before this event too).
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else {
                        deferred.reject(new Error('Unexpected network state: ' + networkState));
                    }
                });

                return deferred.promise;
            })
            .nodeify(function (err) {
                Q.ninvoke(storage, 'close')
                    .finally(function (err2) {
                        Q.ninvoke(server, 'stop')
                            .finally(function (err3) {
                                done(err || err2 || err3);
                            });
                    });
            });
    });

    it('should reconnect get into sync with commit send to server but acknowledge did not return', function (done) {
        //  Hc
        //  |
        var connected = false,
            disconnected = false,
            res,
            storage,
            project;

        server = WebGME.standaloneServer(gmeConfig);
        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();
                res = createStorage(null, null, logger, gmeConfig);

                storage = res.storage;

                storage.open(function (networkState) {
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        connected = true;
                        Q.nfcall(storage.openProject, projectName2Id(projectName))
                            .then(function (result) {
                                project = result[0];

                                function hashUpdateHandler(data, commitQueue, updateQueue, callback) {
                                    callback(null, true);
                                }

                                function branchStatusHandler(/*branchStatus, commitQueue, updateQueue*/) {
                                }

                                return Q.nfcall(storage.openBranch, projectName2Id(projectName), 'b3',
                                    hashUpdateHandler, branchStatusHandler);
                            })
                            .then(function () {
                                // Overwrite makeCommit function to block acknowledgement.
                                res.webSocket.makeCommit = function (data/*, callback*/) {
                                    res.webSocket.socket.emit('makeCommit', data, function (err /*, commitStatus*/) {
                                        if (err) {
                                            done(new Error(err));
                                        }
                                        res.socket.disconnect();
                                    });
                                };

                                return project.makeCommit('b3', [ir.commitHash], ir.rootHash, {}, 'new commie');
                            })
                            .then(function (commitStatus) {
                                if (disconnected && commitStatus.status === STORAGE_CONSTANTS.SYNCED) {
                                    deferred.resolve();
                                } else {
                                    deferred.reject('Not synced after commit ' + commitStatus.status);
                                }
                            })
                            .catch(function (err) {
                                done(err);
                            });
                    } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                        if (connected === true) {
                            disconnected = true;
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                        if (disconnected === true) {
                            // All is fine. Wait for the branch status SYNC (could come before this event too).
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else {
                        deferred.reject(new Error('Unexpected network state: ' + networkState));
                    }
                });

                return deferred.promise;
            })
            .nodeify(function (err) {
                Q.ninvoke(storage, 'close')
                    .finally(function (err2) {
                        Q.ninvoke(server, 'stop')
                            .finally(function (err3) {
                                done(err || err2 || err3);
                            });
                    });
            });
    });

    it('should reconnect get into forked with commit send to server but acknowledge did not return', function (done) {
        // This test sets the branch hash using the safe-storage after the first commit.
        //  c
        //  H
        var connected = false,
            disconnected = false,
            res,
            storage,
            project;

        server = WebGME.standaloneServer(gmeConfig);
        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();
                res = createStorage(null, null, logger, gmeConfig);

                storage = res.storage;

                storage.open(function (networkState) {
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        connected = true;
                        Q.nfcall(storage.openProject, projectName2Id(projectName))
                            .then(function (result) {
                                project = result[0];

                                function hashUpdateHandler(data, commitQueue, updateQueue, callback) {
                                    callback(null, true);
                                }

                                function branchStatusHandler(/*branchStatus, commitQueue, updateQueue*/) {
                                }

                                return Q.nfcall(storage.openBranch, projectName2Id(projectName), 'b4',
                                    hashUpdateHandler, branchStatusHandler);
                            })
                            .then(function () {
                                // Overwrite makeCommit function to block acknowledgement.
                                res.webSocket.makeCommit = function (data/*, callback*/) {
                                    res.webSocket.socket.emit('makeCommit', data, function (err, commitStatus) {
                                        if (err) {
                                            done(new Error(err));
                                        }
                                        ir.project.setBranchHash('b4', ir.commitHash, commitStatus.hash)
                                            .then(function (commitStatus) {
                                                if (commitStatus.status === STORAGE_CONSTANTS.SYNCED) {
                                                    res.socket.disconnect();
                                                } else {
                                                    deferred.reject('Server setBranchHash not synced ' +
                                                        commitStatus.status);
                                                }
                                            })
                                            .catch(deferred.reject);
                                    });
                                };

                                return project.makeCommit('b4', [ir.commitHash], ir.rootHash, {}, 'new commie');
                            })
                            .then(function (commitStatus) {
                                if (disconnected && commitStatus.status === STORAGE_CONSTANTS.FORKED) {
                                    deferred.resolve();
                                } else {
                                    deferred.reject('Not FORKED after commit ' + commitStatus.status);
                                }
                            })
                            .catch(function (err) {
                                done(err);
                            });
                    } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                        if (connected === true) {
                            disconnected = true;
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                        if (disconnected === true) {
                            // All is fine. Wait for the branch status SYNC (could come before this event too).
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else {
                        deferred.reject(new Error('Unexpected network state: ' + networkState));
                    }
                });

                return deferred.promise;
            })
            .nodeify(function (err) {
                Q.ninvoke(storage, 'close')
                    .finally(function (err2) {
                        Q.ninvoke(server, 'stop')
                            .finally(function (err3) {
                                done(err || err2 || err3);
                            });
                    });
            });
    });

    it('should reconnect get into forked with commit send to server but acknowledge did not return 2', function (done) {
        // This test sets the branch hash and makes a commit using the safe-storage after the first commit.
        var connected = false,
            disconnected = false,
            res,
            storage,
            project;

        server = WebGME.standaloneServer(gmeConfig);
        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();

                res = createStorage(null, null, logger, gmeConfig);

                storage = res.storage;

                storage.open(function (networkState) {
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        connected = true;
                        Q.nfcall(storage.openProject, projectName2Id(projectName))
                            .then(function (result) {
                                project = result[0];

                                function hashUpdateHandler(data, commitQueue, updateQueue, callback) {
                                    callback(null, true);
                                }

                                function branchStatusHandler(/*branchStatus, commitQueue, updateQueue*/) {
                                }

                                return Q.nfcall(storage.openBranch, projectName2Id(projectName), 'b5',
                                    hashUpdateHandler, branchStatusHandler);
                            })
                            .then(function () {
                                // Overwrite makeCommit function to block acknowledgement.
                                res.webSocket.makeCommit = function (data/*, callback*/) {
                                    res.webSocket.socket.emit('makeCommit', data, function (err, commitStatus) {
                                        if (err) {
                                            done(new Error(err));
                                        }
                                        ir.project.setBranchHash('b5', ir.commitHash, commitStatus.hash)
                                            .then(function (commitStatus) {
                                                if (commitStatus.status === STORAGE_CONSTANTS.SYNCED) {
                                                    ir.project.makeCommit('b5', [ir.commitHash], ir.rootHash, {}, 's')
                                                        .then(function (commitStatus) {
                                                            if (commitStatus.status === STORAGE_CONSTANTS.SYNCED) {
                                                                res.socket.disconnect();
                                                            } else {
                                                                deferred.reject('Server commit not synced ' +
                                                                    commitStatus.status);
                                                            }
                                                        });
                                                } else {
                                                    deferred.reject('Server setBranchHash not synced ' +
                                                        commitStatus.status);
                                                }
                                            })
                                            .catch(deferred.reject);
                                    });
                                };

                                return project.makeCommit('b5', [ir.commitHash], ir.rootHash, {}, 'new commie');
                            })
                            .then(function (commitStatus) {
                                if (disconnected && commitStatus.status === STORAGE_CONSTANTS.FORKED) {
                                    deferred.resolve();
                                } else {
                                    deferred.reject('Not FORKED after commit ' + commitStatus.status);
                                }
                            })
                            .catch(function (err) {
                                done(err);
                            });
                    } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                        if (connected === true) {
                            disconnected = true;
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                        if (disconnected === true) {
                            // All is fine. Wait for the branch status SYNC (could come before this event too).
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else {
                        deferred.reject(new Error('Unexpected network state: ' + networkState));
                    }
                });

                return deferred.promise;
            })
            .nodeify(function (err) {
                Q.ninvoke(storage, 'close')
                    .finally(function (err2) {
                        Q.ninvoke(server, 'stop')
                            .finally(function (err3) {
                                done(err || err2 || err3);
                            });
                    });
            });
    });

    it('should reconnect and commit uncommitted commits', function (done) {
        var connected = false,
            disconnected = false,
            res,
            storage,
            project;

        server = WebGME.standaloneServer(gmeConfig);
        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();
                res = createStorage(null, null, logger, gmeConfig);

                storage = res.storage;

                storage.open(function (networkState) {
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        connected = true;

                        Q.nfcall(storage.openProject, projectName2Id(projectName))
                            .then(function (result) {
                                var branchOpened;

                                project = result[0];

                                function hashUpdateHandler(data, commitQueue, updateQueue, callback) {
                                    if (branchOpened === true) {
                                        res.socket.disconnect();
                                        branchOpened = false; // Only trigger disconnect once.
                                        project.makeCommit('b6', [data.commitData.commitObject._id],
                                            ir.rootHash, {}, 'new com')
                                            .then(function (commitStatus) {
                                                if (disconnected && commitStatus.status === STORAGE_CONSTANTS.SYNCED) {
                                                    deferred.resolve();
                                                } else {
                                                    deferred.reject('Not synced after 2nd commit ' +
                                                        commitStatus.status);
                                                }
                                            })
                                            .catch(deferred.reject);
                                    } else if (typeof branchOpened === 'undefined') {
                                        branchOpened = true;
                                    }

                                    callback(null, true);
                                }

                                function branchStatusHandler(/*branchStatus, commitQueue, updateQueue*/) {

                                }

                                return Q.nfcall(storage.openBranch, projectName2Id(projectName), 'b6',
                                    hashUpdateHandler, branchStatusHandler);
                            })
                            .then(function () {
                                return project.makeCommit('b6', [ir.commitHash], ir.rootHash, {}, 'new commit');
                            })
                            .catch(deferred.reject);
                    } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                        if (connected === true) {
                            disconnected = true;
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                        if (disconnected === true) {
                            // All is fine. Wait for the branch status SYNC (could come before this event too).
                        } else {
                            deferred.reject(new Error('Was not connected before reconnected'));
                        }
                    } else {
                        deferred.reject(new Error('Unexpected network state: ' + networkState));
                    }
                });

                return deferred.promise;
            })
            .nodeify(function (err) {
                Q.ninvoke(storage, 'close')
                    .finally(function (err2) {
                        Q.ninvoke(server, 'stop')
                            .finally(function (err3) {
                                done(err || err2 || err3);
                            });
                    });
            });
    });

    // Document handling
    describe('document handling', function () {
        it('should reconnect to same room and send to server if disconnected before send', function (done) {
            var connected = false,
                disconnected = false,
                docData = {
                    projectId: ir.project.projectId,
                    branchName: 'master',
                    nodeId: '/1',
                    attrName: 'name',
                    attrValue: ''
                },
                docId,
                res,
                storage;

            server = WebGME.standaloneServer(gmeConfig);
            Q.ninvoke(server, 'start')
                .then(function () {
                    var deferred = Q.defer();
                    res = createStorage(null, null, logger, gmeConfig);

                    storage = res.storage;

                    storage.open(function (networkState) {
                        if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                            connected = true;

                            storage.watchDocument(docData, testFixture.noop, testFixture.noop)
                                .then(function (result) {
                                    docId = result.docId;
                                    res.socket.disconnect();

                                    storage.sendDocumentOperation({
                                        docId: docId,
                                        operation: new ot.TextOperation().insert('yello')
                                    });

                                    expect(storage.watchers.documents[docId].otClient.state instanceof
                                        ot.Client.AwaitingConfirm).to.equal(true);
                                })
                                .catch(deferred.reject);
                        } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                            if (connected === true) {
                                disconnected = true;
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                            if (disconnected === true) {
                                try {
                                    // Reconnected should come before the ack of the sent documentation
                                    // (the document never reached the server since we disconnected before
                                    // sending it)
                                    expect(storage.watchers.documents[docId].otClient.state instanceof
                                        ot.Client.AwaitingConfirm).to.equal(true);
                                    storage.unwatchDocument({docId: docId})
                                        .then(function () {
                                            deferred.resolve();
                                        })
                                        .catch(deferred.reject);

                                } catch (e) {
                                    deferred.reject(e);
                                }
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else {
                            deferred.reject(new Error('Unexpected network state: ' + networkState));
                        }
                    });

                    return deferred.promise;
                })
                .nodeify(function (err) {
                    Q.ninvoke(storage, 'close')
                        .finally(function (err2) {
                            Q.ninvoke(server, 'stop')
                                .finally(function (err3) {
                                    done(err || err2 || err3);
                                });
                        });
                });
        });

        it('should reconnect to same doc enter synchronized if disconnected after send', function (done) {
            var connected = false,
                disconnected = false,
                docData = {
                    projectId: ir.project.projectId,
                    branchName: 'master',
                    nodeId: '/1',
                    attrName: 'name',
                    attrValue: ''
                },
                docId,
                res,
                storage;

            server = WebGME.standaloneServer(gmeConfig);
            Q.ninvoke(server, 'start')
                .then(function () {
                    var deferred = Q.defer();
                    res = createStorage(null, null, logger, gmeConfig);

                    storage = res.storage;

                    storage.open(function (networkState) {
                        if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                            connected = true;

                            storage.watchDocument(docData, testFixture.noop, testFixture.noop)
                                .then(function (result) {
                                    docId = result.docId;

                                    storage.sendDocumentOperation({
                                        docId: docId,
                                        operation: new ot.TextOperation().insert('yello')
                                    });

                                    expect(Object.keys(res.socket.acks).length).to.equal(1);
                                    // Inject ack function and disconnect when operation made it to the server.
                                    res.socket.acks[Object.keys(res.socket.acks)[0]] = function () {
                                        res.socket.disconnect();
                                    };

                                    expect(storage.watchers.documents[docId].otClient.state instanceof
                                        ot.Client.AwaitingConfirm).to.equal(true);
                                })
                                .catch(deferred.reject);
                        } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                            if (connected === true) {
                                disconnected = true;
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                            if (disconnected === true) {
                                try {
                                    // In should be synchronized since the sent document did indeed reach the server.
                                    expect(storage.watchers.documents[docId].otClient.state instanceof
                                        ot.Client.Synchronized).to.equal(true);
                                    storage.unwatchDocument({docId: docId})
                                        .then(function () {
                                            deferred.resolve();
                                        })
                                        .catch(deferred.reject);

                                } catch (e) {
                                    deferred.reject(e);
                                }
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else {
                            deferred.reject(new Error('Unexpected network state: ' + networkState));
                        }
                    });

                    return deferred.promise;
                })
                .nodeify(function (err) {
                    Q.ninvoke(storage, 'close')
                        .finally(function (err2) {
                            Q.ninvoke(server, 'stop')
                                .finally(function (err3) {
                                    done(err || err2 || err3);
                                });
                        });
                });
        });

        it('should reconnect to same room and apply changes made by other client', function (done) {
            var connected = false,
                disconnected = false,
                docData = {
                    projectId: ir.project.projectId,
                    branchName: 'master',
                    nodeId: '/1',
                    attrName: 'name',
                    attrValue: ''
                },
                opHandlerCalled = false,
                docId,
                res,
                res2,
                storage,
                storage2,
                revision,
                server = WebGME.standaloneServer(gmeConfig);

            Q.ninvoke(server, 'start')
                .then(function () {
                    var deferred = Q.defer();
                    res = createStorage(null, null, logger, gmeConfig);
                    res2 = createStorage(null, null, logger, gmeConfig);

                    storage = res.storage;
                    storage2 = res2.storage;

                    storage.open(function (networkState) {
                        if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                            connected = true;

                            storage2.open(function (networkState2) {
                                if (networkState2 === STORAGE_CONSTANTS.CONNECTED) {
                                    Q.allDone([
                                        storage.watchDocument(testFixture.copy(docData), function atOperation() {
                                            opHandlerCalled = true;
                                        }, testFixture.noop),
                                        storage2.watchDocument(testFixture.copy(docData), testFixture.noop,
                                            testFixture.noop)
                                    ])
                                        .then(function (result) {
                                            docId = result[0].docId;
                                            storage2.sendDocumentOperation({
                                                docId: docId,
                                                operation: new ot.TextOperation().insert('yello')
                                            });

                                            revision = storage.watchers.documents[docId].otClient.revision;

                                            res.socket.disconnect();
                                        })
                                        .catch(deferred.reject);
                                }
                            });
                        } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                            if (connected === true) {
                                disconnected = true;
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else if (networkState === STORAGE_CONSTANTS.RECONNECTED) {
                            if (disconnected === true) {
                                try {
                                    // In should be synchronized since the operation from the other client
                                    // should be retrieved at rejoin.
                                    expect(storage.watchers.documents[docId].otClient.state instanceof
                                        ot.Client.Synchronized).to.equal(true);

                                    expect(storage.watchers.documents[docId].otClient.revision).to.equal(revision + 1,
                                        'Other clients change was not retrieved after rejoin.');
                                    Q.allDone([
                                        storage.unwatchDocument({docId: docId}),
                                        storage2.unwatchDocument({docId: docId})
                                    ])
                                        .then(function () {
                                            if (opHandlerCalled) {
                                                deferred.resolve();
                                            } else {
                                                throw new Error('Operation handler was never called!');
                                            }
                                        })
                                        .catch(deferred.reject);

                                } catch (e) {
                                    deferred.reject(e);
                                }
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else {
                            deferred.reject(new Error('Unexpected network state: ' + networkState));
                        }
                    });

                    return deferred.promise;
                })
                .nodeify(function (err) {
                    Q.allDone([
                        Q.ninvoke(storage, 'close'),
                        Q.ninvoke(storage2, 'close')
                    ])
                        .finally(function (err2) {
                            Q.ninvoke(server, 'stop')
                                .finally(function (err3) {
                                    done(err || err2 || err3);
                                });
                        });
                });
        });

        it('should fail to reconnect after disconnectTimeout and trigger CONNECTION_ERROR', function (done) {
            var connected = false,
                disconnected = false,
                docData = {
                    projectId: ir.project.projectId,
                    branchName: 'master',
                    nodeId: '/1',
                    attrName: 'name',
                    attrValue: ''
                },
                docId,
                res,
                storage,
                modifiedConfig = JSON.parse(JSON.stringify(gmeConfig));

            modifiedConfig.socketIO.clientOptions.autoConnect = false;
            modifiedConfig.documentEditing.disconnectTimeout = 10;

            server = WebGME.standaloneServer(modifiedConfig);
            Q.ninvoke(server, 'start')
                .then(function () {
                    var deferred = Q.defer();
                    res = createStorage(null, null, logger, modifiedConfig, 100);

                    storage = res.storage;

                    storage.open(function (networkState) {
                        if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                            connected = true;

                            storage.watchDocument(docData, testFixture.noop, testFixture.noop)
                                .then(function (result) {
                                    docId = result.docId;

                                    res.socket.disconnect();

                                    storage.sendDocumentOperation({
                                        docId: docId,
                                        operation: new ot.TextOperation().insert('yello')
                                    });

                                    expect(storage.watchers.documents[docId].otClient.state instanceof
                                        ot.Client.AwaitingConfirm).to.equal(true);
                                })
                                .catch(deferred.reject);
                        } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                            if (connected === true) {
                                disconnected = true;
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else if (networkState === STORAGE_CONSTANTS.CONNECTION_ERROR) {
                            if (disconnected === true) {
                                deferred.resolve();
                            } else {
                                deferred.reject(new Error('Was not connected before CONNECTION_ERROR'));
                            }
                        } else {
                            deferred.reject(new Error('Unexpected network state: ' + networkState));
                        }
                    });

                    return deferred.promise;
                })
                .nodeify(function (err) {
                    Q.ninvoke(storage, 'close')
                        .finally(function (err2) {
                            Q.ninvoke(server, 'stop')
                                .finally(function (err3) {
                                    done(err || err2 || err3);
                                });
                        });
                });
        });

        // Consider skipping this test on travis/appveyor as it depends on timeouts..
        it('should fail to reconnect same room if closed and opened by other client', function (done) {
            var connected = false,
                disconnected = false,
                docData = {
                    projectId: ir.project.projectId,
                    branchName: 'master',
                    nodeId: '/1',
                    attrName: 'name',
                    attrValue: ''
                },
                docId,
                res,
                res2,
                storage,
                storage2,
                server,
                modifiedConfig = JSON.parse(JSON.stringify(gmeConfig));

            this.timeout(5000);

            modifiedConfig.socketIO.clientOptions.autoConnect = false;
            modifiedConfig.documentEditing.disconnectTimeout = 10;

            server = WebGME.standaloneServer(modifiedConfig);

            Q.ninvoke(server, 'start')
                .then(function () {
                    var deferred = Q.defer();
                    res = createStorage(null, null, logger, modifiedConfig, 300);
                    res2 = createStorage(null, null, logger, modifiedConfig, 10);

                    storage = res.storage;
                    storage2 = res2.storage;

                    storage.open(function (networkState) {
                        if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                            connected = true;

                            storage2.open(function (networkState2) {
                                if (networkState2 === STORAGE_CONSTANTS.CONNECTED) {
                                    // 1. Client 1 opens the document.
                                    storage.watchDocument(docData, testFixture.noop, testFixture.noop)
                                        .then(function (result) {
                                            docId = result.docId;
                                            // 2. Client 1 gets disconnected and removal triggered on server.
                                            res.socket.disconnect();
                                        })
                                        .catch(deferred.reject);
                                } else {
                                    deferred.reject(new Error('Unexpected network state: ' + networkState2));
                                }
                            });
                        } else if (networkState === STORAGE_CONSTANTS.DISCONNECTED) {
                            if (connected === true) {
                                disconnected = true;
                                // 3. Wait till the document has been closed (100 > 10 ms)
                                // and open it with Client 2
                                setTimeout(function () {
                                    storage2.watchDocument(docData, testFixture.noop, testFixture.noop);
                                }, 100);
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else if (networkState === STORAGE_CONSTANTS.CONNECTION_ERROR) {
                            // 4. Client 1 should get an error at reconnect.
                            if (disconnected === true) {
                                storage2.unwatchDocument({docId: docId})
                                    .then(deferred.resolve)
                                    .catch(deferred.reject);
                            } else {
                                deferred.reject(new Error('Was not connected before reconnected'));
                            }
                        } else {
                            deferred.reject(new Error('Unexpected network state: ' + networkState));
                        }
                    });

                    return deferred.promise;
                })
                .nodeify(function (err) {
                    Q.allDone([
                        Q.ninvoke(storage, 'close'),
                        Q.ninvoke(storage2, 'close')
                    ])
                        .finally(function (err2) {
                            Q.ninvoke(server, 'stop')
                                .finally(function (err3) {
                                    done(err || err2 || err3);
                                });
                        });
                });
        });

        it('should fail to watch document when disabled', function (done) {
            var docData = {
                    projectId: ir.project.projectId,
                    branchName: 'master',
                    nodeId: '/1',
                    attrName: 'name',
                    attrValue: ''
                },
                res,
                storage,
                modifiedConfig = JSON.parse(JSON.stringify(gmeConfig));

            modifiedConfig.documentEditing.enable = false;

            server = WebGME.standaloneServer(modifiedConfig);
            Q.ninvoke(server, 'start')
                .then(function () {
                    var deferred = Q.defer();
                    res = createStorage(null, null, logger, modifiedConfig);

                    storage = res.storage;

                    storage.open(function (networkState) {
                        if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                            storage.watchDocument(docData, testFixture.noop, testFixture.noop)
                                .then(function () {
                                    throw new Error('Should have failed!');
                                })
                                .catch(function (err) {
                                    expect(err.message).to.include('Document editing is disabled from gmeConfig');
                                })
                                .then(deferred.resolve)
                                .catch(deferred.reject);
                        } else {
                            deferred.reject(new Error('Unexpected network state: ' + networkState));
                        }
                    });

                    return deferred.promise;
                })
                .nodeify(function (err) {
                    Q.ninvoke(storage, 'close')
                        .finally(function (err2) {
                            Q.ninvoke(server, 'stop')
                                .finally(function (err3) {
                                    done(err || err2 || err3);
                                });
                        });
                });
        });
    });
});