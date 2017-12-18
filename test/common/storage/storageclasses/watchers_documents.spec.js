/*eslint-env node, mocha*/
/*eslint no-unused-vars: 0*/

// TODO: Remove no-unused-vars before merge
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../../_globals.js');

describe('storage document editing', function () {
    'use strict';
    var gmeConfig = testFixture.getGmeConfig(),
        CONSTANTS = testFixture.requirejs('common/storage/constants'),
        WebGME = testFixture.WebGME,
        Q = testFixture.Q,
        expect = testFixture.expect,
        logger = testFixture.logger.fork('watchers.spec'),
        users = {},
        userTokens = {},
        projectName = 'DocumentEditingProject',
        ot = require('webgme-ot'),
        noop = testFixture.noop,
        server,
        gmeAuth,
        safeStorage,
        projectId;

    before(function (done) {
        gmeConfig.authentication.enable = true;
        gmeConfig.socketIO.clientOptions.transports = ['websocket'];

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
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
                    }),
                    gmeAuth.addUser('user1', 'em@il', 'pass', true, {overwrite: true}),
                    gmeAuth.addUser('user2', 'em@il', 'pass', true, {overwrite: true}),
                    gmeAuth.addUser('userRead', 'em@il', 'pass', true, {overwrite: true}),
                    gmeAuth.addUser('userNoAccess', 'em@il', 'pass', true, {overwrite: true})
                ]);
            })
            .then(function (result) {
                projectId = result[0].project.projectId;
                return Q.allDone([
                    gmeAuth.generateJWTokenForAuthenticatedUser('user1'),
                    gmeAuth.generateJWTokenForAuthenticatedUser('user2'),
                    gmeAuth.generateJWTokenForAuthenticatedUser('userNoAccess'),
                    gmeAuth.generateJWTokenForAuthenticatedUser('userRead'),
                    gmeAuth.authorizeByUserId('user1', projectId, null, {read: true, write: true, delete: true}),
                    gmeAuth.authorizeByUserId('user2', projectId, null, {read: true, write: true, delete: true}),
                    gmeAuth.authorizeByUserId('userRead', projectId, null, {read: true, write: false, delete: false})
                ]);
            })
            .then(function (res) {
                userTokens.user1 = res[0];
                userTokens.user2 = res[1];
                userTokens.userNoAccess = res[2];
                userTokens.userRead = res[3];

                server = WebGME.standaloneServer(gmeConfig);
                return Q.allDone([
                    Q.ninvoke(server, 'start'),
                    // Close connections since we don't need these anymore..
                    gmeAuth.unload(),
                    safeStorage.closeDatabase()
                ]);
            })
            .nodeify(done);
    });

    after(function (done) {
        server.stop(done);
    });

    function getNewStorage(userId) {
        return testFixture.getConnectedStorage(gmeConfig, logger, userTokens[userId])
            .then(function (storage) {
                users[userId] = {
                    storage: storage,
                };

                return storage;
            });
    }

    afterEach(function (done) {
        Q.allDone(Object.keys(users).map(function (userId) {
            var uData = users[userId],
                unwatchDeferred = Q.defer();

            if (uData.docId) {
                unwatchDeferred.promise = uData.storage.unwatchDocument({docId: uData.docId});
            } else {
                unwatchDeferred.resolve();
            }

            return unwatchDeferred.promise
                .then(function () {
                    return Q.ninvoke(uData.storage, 'close');
                });

        }))
            .then(function () {
                users = {};
            })
            .nodeify(done);
    });

    it('should get new connected storages for two users', function (done) {
        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('user2', 'pass')
        ])
            .then(function (res) {
                expect(res[0].userId).to.equal('user1');
                expect(res[1].userId).to.equal('user2');
                return Q.allDone([
                    Q.ninvoke(res[0], 'getProjectInfo', projectId),
                    Q.ninvoke(res[1], 'getProjectInfo', projectId)
                ]);
            })
            .then(function (res) {
                expect(res[0].rights).to.deep.equal({read: true, write: true, delete: true});
                expect(res[1].rights).to.deep.equal({read: true, write: true, delete: true});
            })
            .nodeify(done);
    });

    // Operations
    it('operation onto document should be broadcast to other user', function (done) {
        var user1,
            user2,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            };

        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('user2', 'pass')
        ])
            .then(function (res) {
                user1 = res[0];
                user2 = res[1];

                return Q.allDone([
                    user1.watchDocument(testFixture.copy(initParams), noop, noop),
                    user2.watchDocument(testFixture.copy(initParams),
                        function atOp2(op) {
                            try {
                                expect(op.apply(initParams.attrValue)).to.equal('hello there');
                                done();
                            } catch (e) {
                                done(e);
                            }
                        }, noop)
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;
                expect(res[0].document).to.equal(res[1].document);
                expect(res[0].document).to.equal('hello');
                expect(res[0].revision).to.equal(res[1].revision);
                expect(res[0].revision).to.equal(0);
                // user ends up with "hello there"
                user1.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hello'.length).insert(' there')
                });
            })
            .catch(done);
    });

    it('two consecutive operations onto document should trigger two broadcast to other user', function (done) {
        var user1,
            user2,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            },
            cnt = 0;

        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('user2', 'pass')
        ])
            .then(function (res) {
                user1 = res[0];
                user2 = res[1];

                return Q.allDone([
                    user1.watchDocument(testFixture.copy(initParams), noop, noop),
                    user2.watchDocument(testFixture.copy(initParams),
                        function atOp2(op) {
                            cnt += 1;
                            try {
                                if (cnt === 1) {
                                    expect(op.apply(initParams.attrValue)).to.equal('hello there');
                                } else if (cnt === 2) {
                                    expect(op.apply('hello there')).to.equal('hello there!');
                                    done();
                                }
                            } catch (e) {
                                done(e);
                            }
                        }, noop
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;

                // user ends up with "hello there!"
                user1.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hello'.length).insert(' there')
                });

                user1.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hello there'.length).insert('!')
                });
            })
            .catch(done);
    });

    it('three consecutive operations onto document should trigger two broadcast to other user', function (done) {
        var user1,
            user2,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            },
            cnt = 0;

        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('user2', 'pass')
        ])
            .then(function (res) {
                user1 = res[0];
                user2 = res[1];

                return Q.allDone([
                    user1.watchDocument(testFixture.copy(initParams), noop, noop),
                    user2.watchDocument(testFixture.copy(initParams),
                        function atOp2(op) {
                            cnt += 1;
                            try {
                                if (cnt === 1) {
                                    expect(op.apply(initParams.attrValue)).to.equal('hello there');
                                } else if (cnt === 2) {
                                    expect(op.apply('hello there')).to.equal('well, hello there!');
                                    done();
                                }
                            } catch (e) {
                                done(e);
                            }
                        }, noop
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;

                // user ends up with "hello there!"
                user1.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hello'.length).insert(' there')
                });

                user1.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hello there'.length).insert('!')
                });

                user1.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().insert('well, ').retain('hello there!'.length)
                });
            })
            .catch(done);
    });

    it('three concurrent operations onto document should end up with same result', function (done) {
        var user1,
            user2,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            },
            cnt = 0;

        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('user2', 'pass')
        ])
            .then(function (res) {
                user1 = res[0];
                user2 = res[1];

                return Q.allDone([
                    user1.watchDocument(testFixture.copy(initParams),
                        function atOp1(op) {
                            cnt += 1;
                            try {
                                expect(op.apply('hello there')).to.equal('well, hello there');
                                if (cnt === 2) {
                                    done();
                                }
                            } catch (e) {
                                done(e);
                            }
                        }, noop
                    ),
                    user2.watchDocument(testFixture.copy(initParams),
                        function atOp2(op) {
                            cnt += 1;
                            try {
                                expect(op.apply('well, hello')).to.equal('well, hello there');
                                if (cnt === 2) {
                                    done();
                                }
                            } catch (e) {
                                done(e);
                            }
                        }, noop
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;

                // user ends up with "hello there!"
                user1.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hello'.length).insert(' there')
                });

                user2.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().insert('well, ').retain('hello'.length)
                });
            })
            .catch(done);
    });

    // Selections
    it('should send selection when synchronized and it should be transformed for other client', function (done) {
        var user1,
            user2,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            },
            cnt = 0;

        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('user2', 'pass')
        ])
            .then(function (res) {
                user1 = res[0];
                user2 = res[1];

                return Q.allDone([
                    user1.watchDocument(testFixture.copy(initParams), noop, noop),
                    user2.watchDocument(testFixture.copy(initParams), noop,
                        function atSel2(data) {
                            cnt += 1;
                            if (cnt > 1) {
                                return;
                            }
                            try {
                                expect(data.selection.ranges[0].anchor).to.equal(data.selection.ranges[0].head);
                                expect(data.selection.ranges[0].anchor).to.equal(1 + 'well, '.length);
                                expect(data.userId).to.equal('user1');
                                done();
                            } catch (e) {
                                done(e);
                            }
                        }
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;

                // user ends up with "hello there!"
                user2.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().insert('well, ').retain('hello'.length)
                });

                user1.sendDocumentSelection({
                    docId: docId,
                    selection: new ot.Selection({anchor: 1, head: 1})
                });
            })
            .catch(done);
    });

    it('should send wide selection when synchronized and expand it with changes', function (done) {
        var user1,
            user2,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            },
            cnt = 0;

        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('user2', 'pass')
        ])
            .then(function (res) {
                user1 = res[0];
                user2 = res[1];

                return Q.allDone([
                    user1.watchDocument(testFixture.copy(initParams),
                        function atOp1(op) {
                            cnt += 1;
                            try {
                                expect(op.apply(initParams.attrValue)).to.equal('hel there lo');
                                if (cnt === 2) {
                                    done();
                                }
                            } catch (e) {
                                done(e);
                            }
                        }, noop
                    ),
                    user2.watchDocument(testFixture.copy(initParams), noop,
                        function atSel2(data) {
                            cnt += 1;
                            if (cnt > 2) {
                                return;
                            }
                            try {
                                expect(data.selection.ranges[0].anchor).to.equal(0);
                                expect(data.selection.ranges[0].head).to.equal('hel there lo'.length - 1);
                                if (cnt === 2) {
                                    done();
                                }
                            } catch (e) {
                                done(e);
                            }
                        }
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;
                // user ends up with "hel there lo"
                user2.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hel'.length).insert(' there ').retain('lo'.length)
                });

                user1.sendDocumentSelection({
                    docId: docId,
                    selection: new ot.Selection({anchor: 0, head: 'hello'.length - 1})
                });
            })
            .catch(done);
    });

    it('should send empty selection when unwatching document', function (done) {
        var user1,
            user2,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            },
            cnt = 0;

        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('user2', 'pass')
        ])
            .then(function (res) {
                user1 = res[0];
                user2 = res[1];

                return Q.allDone([
                    user1.watchDocument(testFixture.copy(initParams), noop, function atSel2(data) {
                        cnt += 1;
                        if (cnt > 2) {
                            return;
                        }
                        try {
                            expect(data.selection).to.equal(null);
                            expect(data.userId).to.equal('user2');
                            if (cnt === 2) {
                                done();
                            }
                        } catch (e) {
                            done(e);
                        }
                    }),
                    user2.watchDocument(testFixture.copy(initParams), noop, noop)
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;

                return user2.unwatchDocument({docId: docId});
            })
            .then(function () {
                cnt += 1;
                if (cnt === 2) {
                    done();
                }
            })
            .catch(done);
    });

    // Read/write access...
    it('should only allow user with read access to receive operations', function (done) {
        var user1,
            userRead,
            docId,
            tId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            };

        Q.allDone([
            getNewStorage('user1', 'pass'),
            getNewStorage('userRead', 'pass')
        ])
            .then(function (res) {
                user1 = res[0];
                userRead = res[1];

                return Q.allDone([
                    user1.watchDocument(testFixture.copy(initParams), function () {
                        clearTimeout(tId);
                        done(new Error('should not receive any operations'));
                    }, noop),
                    userRead.watchDocument(testFixture.copy(initParams),
                        function atOp2(op) {
                            try {
                                expect(op.apply(initParams.attrValue)).to.equal('hello there');
                                userRead.sendDocumentOperation({
                                    docId: docId,
                                    operation: new ot.TextOperation()
                                        .retain('hello there'.length)
                                        .insert(' never makes it!')
                                });

                                tId = setTimeout(function () {
                                    done();
                                }, 100);
                            } catch (e) {
                                done(e);
                            }
                        }, noop)
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['userRead'].docId = docId;

                // user ends up with "hello there"
                user1.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hello'.length).insert(' there')
                });
            })
            .catch(done);
    });

    it('should not allow user without read access to watch document', function (done) {
        var userNoAccess,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            };

        getNewStorage('userNoAccess', 'pass')
            .then(function (res) {
                userNoAccess = res;

                return userNoAccess.watchDocument(testFixture.copy(initParams), noop, noop);
            })
            .then(function (res) {
                throw new Error('Should not succeed!');
            })
            .catch(function (err) {
                expect(err.message).to.include('No read access for guest+DocumentEditingProject');
            })
            .nodeify(done);
    });

    // Error handling
    it('should throw error at DOCUMENT_OPERATION if not watching doc', function (done) {
        var storage,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            };

        getNewStorage('user1', 'pass')
            .then(function (res) {
                storage = res;
                docId = storage.webSocket.getDocumentUpdatedEventName(initParams)
                    .substring(CONSTANTS.DOCUMENT_OPERATION.length);

                storage.sendDocumentOperation({
                    docId: docId,
                    operation: new ot.TextOperation().retain('hel'.length).insert(' there ').retain('lo'.length)
                });
            })
            .then(function (res) {
                throw new Error('Should not succeed!');
            })
            .catch(function (err) {
                expect(err.message).to.include('Document not being watched ' + docId);
            })
            .nodeify(done);
    });

    it('should throw error at DOCUMENT_SELECTION if not watching doc', function (done) {
        var storage,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            };

        getNewStorage('user1', 'pass')
            .then(function (res) {
                storage = res;
                docId = storage.webSocket.getDocumentUpdatedEventName(initParams)
                    .substring(CONSTANTS.DOCUMENT_OPERATION.length);

                storage.sendDocumentSelection({
                    docId: docId,
                    selection: new ot.Selection({anchor: 0, head: 'hello'.length - 1})
                });
            })
            .then(function (res) {
                throw new Error('Should not succeed!');
            })
            .catch(function (err) {
                expect(err.message).to.include('Document not being watched ' + docId);
            })
            .nodeify(done);
    });

    it('should resolve with error when trying to watch same document twice', function (done) {
        var storage,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            };

        getNewStorage('user1', 'pass')
            .then(function (res) {
                storage = res;
                docId = storage.webSocket.getDocumentUpdatedEventName(initParams)
                    .substring(CONSTANTS.DOCUMENT_OPERATION.length);

                return storage.watchDocument(testFixture.copy(initParams), noop, noop);
            })
            .then(function (res) {
                users['user1'].docId = res.docId;
                return storage.watchDocument(testFixture.copy(initParams), noop, noop);
            })
            .then(function (res) {
                throw new Error('Should not succeed!');
            })
            .catch(function (err) {
                expect(err.message).to.include('Document is already being watched ' + docId);
            })
            .nodeify(done);
    });

    it('should resolve with error when unwatching unwatched document', function (done) {
        var storage,
            docId,
            initParams = {
                projectId: projectId,
                branchName: 'master',
                nodeId: '/1',
                attrName: 'doc',
                attrValue: 'hello'
            };

        getNewStorage('user1', 'pass')
            .then(function (res) {
                storage = res;
                docId = storage.webSocket.getDocumentUpdatedEventName(initParams)
                    .substring(CONSTANTS.DOCUMENT_OPERATION.length);

                return storage.unwatchDocument(testFixture.copy(initParams));
            })
            .then(function (res) {
                throw new Error('Should not succeed!');
            })
            .catch(function (err) {
                expect(err.message).to.include('Document is not being watched ' + docId);
            })
            .nodeify(done);
    });
});