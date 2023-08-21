/*eslint-env node, mocha*/
/**
 * This file tests the ServerWorkerManager w.r.t. simple-workers.
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('../../_globals.js');

describe('ServerWorkerManager - SimpleWorkers', function () {
    'use strict';

    var logger = testFixture.logger.fork('workermanager.spec'),
        expect = testFixture.expect,
        Q = testFixture.Q,
        gmeConfig = testFixture.getGmeConfig(),
        agent = testFixture.superagent.agent(),
        guestAccount = gmeConfig.authentication.guestAccount,
        storage,
        server,
        ir,
        workerConstants = require('../../../src/server/worker/constants'),
        ServerWorkerManager = require('../../../src/server/worker/serverworkermanager'),
        workerManagerParameters = {
            gmeConfig: gmeConfig,
            logger: logger
        },
        projectName = 'SWMProject',
        projectId = testFixture.projectName2Id(projectName),
        gmeAuth;

    function exportLibrary(swm, next) {
        var deferred = Q.defer();
        swm.request({
            command: workerConstants.workerCommands.exportProjectToFile,
            branchName: 'master',
            projectId: projectId,
            commitHash: ir.commitHash
        }, function (err, result) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(result);
            }
        });

        return deferred.promise.nodeify(next);
    }

    gmeConfig.server.maxWorkers = 3;

    before(function (done) {
        //adding some project to the database
        server = testFixture.WebGME.standaloneServer(gmeConfig);

        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMongoStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                return testFixture.importProject(storage, {
                    projectSeed: 'seeds/EmptyProject.webgmex',
                    projectName: projectName,
                    branchName: 'master',
                    gmeConfig: gmeConfig,
                    logger: logger
                });
            })
            .then(function (ir_) {
                ir = ir_;
                return Q.ninvoke(server, 'start');
            })
            .then(function (/*result*/) {
                return testFixture.openSocketIo(server, agent, guestAccount, guestAccount);
            })
            .nodeify(done);
    });

    after(function (done) {
        server.stop(function (err) {
            if (err) {
                logger.error(err);
            }
            return Q.allDone([
                storage.closeDatabase(),
                gmeAuth.unload()
            ])
                .nodeify(done);
        });
    });

    describe('open-close handling', function () {

        var swm;

        before(function () {
            swm = new ServerWorkerManager(workerManagerParameters);
        });

        it.skip('should reserve a worker when starts', function (/*done*/) {

        });

        it('should handle multiple stop gracefully', function (done) {
            swm.start()
                .then(function () {
                    return swm.stop();
                })
                .then(function () {
                    return swm.stop();
                })
                .nodeify(done);
        });

        it('should handle multiple start gracefully', function (done) {
            swm.start()
                .then(function () {
                    return swm.start();
                })
                .then(function () {
                    return swm.start();
                })
                .then(function () {
                    return swm.start();
                })
                .then(function () {
                    return swm.stop();
                })
                .nodeify(done);
        });

        it('should handle start stop start stop', function (done) {
            swm.start()
                .then(function () {
                    return swm.stop();
                })
                .then(function () {
                    return swm.start();
                })
                .then(function () {
                    return swm.stop();
                })
                .nodeify(done);
        });
    });

    describe('bad request handling', function () {

        var swm,
            ownGmeConfig = JSON.parse(JSON.stringify(gmeConfig)),
            managerParameters = {
                gmeConfig: ownGmeConfig,
                logger: logger
            };

        ownGmeConfig.addOn.enable = false;

        before(function (done) {
            swm = new ServerWorkerManager(managerParameters);
            swm.start(done);
        });

        after(function (done) {
            swm.stop(done);
        });

        it('should respond with error to unknown request', function (done) {
            swm.request({command: 'unknown command'}, function (err/*, resultId*/) {
                expect(err).not.to.equal(null);
                done();
            });
        });

    });

    describe('simple request-result handling', function () {
        var swm;

        before(function (done) {
            swm = new ServerWorkerManager(workerManagerParameters);
            swm.start(done);
        });

        after(function (done) {
            swm.stop(done);
        });

        it('should handle a single request', function (done) {
            exportLibrary(swm, done);
        });

        it('should handle multiple requests', function (done) {
            var needed = 3,
                i,
                error,
                requestHandled = function (err) {
                    needed -= 1;
                    error = error || err;
                    if (needed === 0) {
                        done(error);
                    }
                };

            for (i = 0; i < needed; i += 1) {
                exportLibrary(swm, requestHandled);
            }
        });

        it('should handle more requests simultaneously than workers allowed', function (done) {
            this.timeout(5000);
            var needed = gmeConfig.server.maxWorkers + 1,
                i,
                error,
                requestHandled = function (err) {
                    needed -= 1;
                    error = error || err;
                    if (needed === 0) {
                        done(error);
                    }
                };

            for (i = 0; i < needed; i += 1) {
                exportLibrary(swm, requestHandled);
            }
        });
    });

    describe('maximum queued requests', function () {
        var swm;

        afterEach(function (done) {
            swm.stop(done);
        });

        it('should return error when all workers are busy and queue set to 0', function (done) {
            var parameters = {
                gmeConfig: JSON.parse(JSON.stringify(gmeConfig)),
                logger: logger
            };

            parameters.gmeConfig.server.maxQueuedWorkerRequests = 0;
            parameters.gmeConfig.server.maxWorkers = 1; // There is always one spare ( 1 + 1 = 2 workers)
            parameters.gmeConfig.addOn.enable = false;

            swm = new ServerWorkerManager(parameters);
            swm.start()
                .then(function () {
                    return Q.allSettled([
                        exportLibrary(swm),
                        exportLibrary(swm),
                        exportLibrary(swm)
                    ]);
                })
                .then(function (res) {
                    var rejected = res.filter(function (r) {
                        return r.state === 'rejected';
                    });

                    expect(rejected.length).to.equal(1);
                    expect(rejected[0].reason.message).to.include('Server currently has too many jobs queued');
                })
                .nodeify(done);
        });

        it('should return error when all workers are busy and queue set to 1', function (done) {
            var parameters = {
                gmeConfig: JSON.parse(JSON.stringify(gmeConfig)),
                logger: logger
            };

            parameters.gmeConfig.server.maxQueuedWorkerRequests = 1;
            parameters.gmeConfig.server.maxWorkers = 1; // There is always one spare ( 1 + 1 = 2 workers)
            parameters.gmeConfig.addOn.enable = false;

            swm = new ServerWorkerManager(parameters);
            swm.start()
                .then(function () {
                    return Q.allSettled([
                        exportLibrary(swm),
                        exportLibrary(swm),
                        exportLibrary(swm),
                        exportLibrary(swm)
                    ]);
                })
                .then(function (res) {
                    //expect(res).to.deep.equal([]);
                    var rejected = res.filter(function (r) {
                        return r.state === 'rejected';
                    });

                    expect(rejected.length).to.deep.equal(1);
                    expect(rejected[0].reason.message).to.include('Server currently has too many jobs queued');
                })
                .nodeify(done);
        });

        it('should queue all when queue set to -1', function (done) {
            var parameters = {
                gmeConfig: JSON.parse(JSON.stringify(gmeConfig)),
                logger: logger
            };

            parameters.gmeConfig.server.maxQueuedWorkerRequests = -1;
            parameters.gmeConfig.server.maxWorkers = 1; // There is always one spare ( 1 + 1 = 2 workers)
            parameters.gmeConfig.addOn.enable = false;

            swm = new ServerWorkerManager(parameters);
            swm.start()
                .then(function () {
                    return Q.allDone([
                        exportLibrary(swm),
                        exportLibrary(swm),
                        exportLibrary(swm),
                        exportLibrary(swm)
                    ]);
                })
                .nodeify(done);
        });
    });
});