/*jshint node:true, mocha:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../../_globals.js');

describe('storage document editing', function () {
    'use strict';
    var NodeStorage = testFixture.requirejs('common/storage/nodestorage'),
        STORAGE_CONSTANTS = testFixture.requirejs('common/storage/constants'),
        gmeConfig = testFixture.getGmeConfig(),
        WebGME = testFixture.WebGME,
        superagent = testFixture.superagent,
        Q = testFixture.Q,
        expect = testFixture.expect,
        logger = testFixture.logger.fork('watchers.spec'),
        users = {},
        projectName = 'DocumentEditingProject',
        ot = require('ot'),
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
                    gmeAuth.addUser('user3', 'em@il', 'pass', true, {overwrite: true}),
                    gmeAuth.addUser('userRead', 'em@il', 'pass', true, {overwrite: true})
                ]);
            })
            .then(function (result) {
                projectId = result[0].project.projectId;
                return Q.allDone([
                    gmeAuth.authorizeByUserId('user1', projectId, null, {read: true, write: true, delete: true}),
                    gmeAuth.authorizeByUserId('user2', projectId, null, {read: true, write: true, delete: true}),
                    gmeAuth.authorizeByUserId('user3', projectId, null, {read: true, write: true, delete: true}),
                    gmeAuth.authorizeByUserId('userRead', projectId, null, {read: true, write: false, delete: false})
                ]);
            })
            .then(function () {
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

    function getNewStorage(userId, password, callback) {
        var deferred = Q.defer();
        
        testFixture.openSocketIo(server, superagent.agent(), userId, password)
            .then(function (result) {
                var storage;
                storage = NodeStorage.createStorage(null, result.webgmeToken, logger, gmeConfig);

                storage.open(function (networkState) {
                    var err;
                    
                    if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                        users[userId] = {
                            storage: storage,
                            socket: result.socket
                        };

                        deferred.resolve(storage);
                    } else {
                        err = new Error('Unexpected network state: ' + networkState);
                        // Log it since promise may already have been resolved..
                        logger.error(err);
                        deferred.reject(err)
                    }
                });
            })
            .catch(deferred.reject);

        return deferred.promise.nodeify(callback);
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
                })
                .then(function () {
                    uData.socket.disconnect();
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
                    user1.watchDocument(initParams,
                        function atOp1(op) {
                            //console.log('atOp1', op);
                        },
                        function atSel1(data) {
                            //console.log('atSel1', JSON.stringify(data, null, 2));
                        }
                    ),
                    user2.watchDocument(initParams,
                        function atOp2(op) {
                            try {
                                expect(op.apply(initParams.attrValue)).to.equal('hello there');
                                done();
                            } catch (e) {
                                done(e);
                            }
                        },
                        function atSel2(data) {
                            //console.log('atSel2', JSON.stringify(data, null, 2));
                        }
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;

                expect(res[0].str).to.equal(res[1].str);
                expect(res[0].str).to.equal('hello');

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
                    user1.watchDocument(initParams,
                        function atOp1(op) {
                            //console.log('atOp1', op);
                        },
                        function atSel1(data) {
                            //console.log('atSel1', JSON.stringify(data, null, 2));
                        }
                    ),
                    user2.watchDocument(initParams,
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
                        },
                        function atSel2(data) {
                            //console.log('atSel2', JSON.stringify(data, null, 2));
                        }
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;

                expect(res[0].str).to.equal(res[1].str);
                expect(res[0].str).to.equal('hello');

                expect(res[0].revision).to.equal(res[1].revision);
                expect(res[0].revision).to.equal(0);

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
                    user1.watchDocument(initParams,
                        function atOp1(op) {
                            //console.log('atOp1', op);
                        },
                        function atSel1(data) {
                            //console.log('atSel1', JSON.stringify(data, null, 2));
                        }
                    ),
                    user2.watchDocument(initParams,
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
                        },
                        function atSel2(data) {
                            //console.log('atSel2', JSON.stringify(data, null, 2));
                        }
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;

                expect(res[0].str).to.equal(res[1].str);
                expect(res[0].str).to.equal('hello');

                expect(res[0].revision).to.equal(res[1].revision);
                expect(res[0].revision).to.equal(0);

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
                    user1.watchDocument(initParams,
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
                        },
                        function atSel1(data) {
                            //console.log('atSel1', JSON.stringify(data, null, 2));
                        }
                    ),
                    user2.watchDocument(initParams,
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
                        },
                        function atSel2(data) {
                            //console.log('atSel2', JSON.stringify(data, null, 2));
                        }
                    )
                ]);
            })
            .then(function (res) {
                docId = res[0].docId;
                users['user1'].docId = docId;
                users['user2'].docId = docId;

                expect(res[0].str).to.equal(res[1].str);
                expect(res[0].str).to.equal('hello');

                expect(res[0].revision).to.equal(res[1].revision);
                expect(res[0].revision).to.equal(0);

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
});