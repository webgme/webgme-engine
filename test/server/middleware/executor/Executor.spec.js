/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

const testFixture = require('../../../_globals.js');

describe('ExecutorServer', function () {
    'use strict';

    const assert = require('assert').strict;
    const agent = testFixture.superagent.agent();
    const {expect, Q} = testFixture;
    let gmeConfig,
        server;

    describe('REST API', function () {
        beforeEach(async function () {
            await Q.allDone([
                Q.ninvoke(testFixture, 'rimraf', './test-tmp/executor'),
                Q.ninvoke(testFixture, 'rimraf', './test-tmp/executor-tmp')
            ]);
            gmeConfig = testFixture.getGmeConfig();
            gmeConfig.executor.enable = true;
            await testFixture.clearDatabase(gmeConfig);
            server = testFixture.WebGME.standaloneServer(gmeConfig);
        });

        afterEach(function (done) {
            if (server) {
                server.stop(done);
            } else {
                done();
            }
        });

        it('should return 200 at rest/executor/worker/ with enableExecutor=true', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor/worker/').end(function (err, res) {
                    assert.equal(res.status, 200, err);
                    done();
                });
            });
        });

        it('should return 404 at rest/executor/worker/ with enableExecutor=false', function (done) {
            gmeConfig.executor.enable = false;
            server = testFixture.WebGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor/worker/').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 200 GET rest/executor?status=SUCCESS', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor?status=SUCCESS').end(function (err, res) {
                    assert.equal(res.status, 200, err);
                    expect(res.body).to.deep.equal({});
                    done();
                });
            });
        });

        it('should return 404 POST rest/executor/info', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/info').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 404 GET rest/executor/info/', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor/info/').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 404 GET rest/executor/info/does_not_exist', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor/info/does_not_exist').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });


        it('should return 404 GET rest/executor/unknown_command', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor/unknown_command').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });


        it('should return 404 PUT rest/executor/worker', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.put(serverBaseUrl + '/rest/executor/worker').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 404 PUT rest/executor/update', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.put(serverBaseUrl + '/rest/executor/update').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 404 POST rest/executor/update/does_not_exist', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/update/does_not_exist').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 404 PUT rest/executor/create', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.put(serverBaseUrl + '/rest/executor/create').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 404 POST rest/executor/create', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/create').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 200 POST rest/executor/create/some_hash', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                    assert.equal(res.status, 200, err);
                    assert.equal(typeof res.body.secret, 'string', res.body);
                    done();
                });
            });
        });

        it('should set userId in created job rest/executor/create/some_hash', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                    assert.equal(res.body.userId.length, 1);
                    done();
                });
            });
        });

        it('should return 200 POST rest/executor/create/some_hash but no secret on second create', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                    assert.equal(res.status, 200, err);
                    assert.equal(typeof res.body.secret, 'string', res.body);
                    agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                        assert.equal(res.status, 200, err);
                        assert.equal(
                            typeof res.body.secret,
                            'undefined',
                            `Expected no secret. Found "${res.body.secret}"`
                        );
                        done();
                    });
                });
            });
        });

        it('should return 404 POST rest/executor/cancel/hashDoesNotExist', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/cancel/hashDoesNotExist').end(function (err, res) {
                    assert.equal(res.status, 404, err);
                    done();
                });
            });
        });

        it('should return 403 POST rest/executor/cancel/existingHash with no body', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/create/existingHash').end(function (err, res) {
                    assert.equal(res.status, 200, err);
                    agent.post(serverBaseUrl + '/rest/executor/cancel/existingHash').end(function (err, res) {
                        assert.equal(res.status, 403, err);
                        done();
                    });
                });
            });
        });

        it('should return 403 POST rest/executor/cancel/existingHash with wrong secret', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/create/existingHash').end(function (err, res) {
                    assert.equal(res.status, 200, err);
                    agent.post(serverBaseUrl + '/rest/executor/cancel/existingHash')
                        .send({secret: 'bla_bla'})
                        .end(function (err, res) {
                            assert.equal(res.status, 403, err);
                            done();
                        });
                });
            });
        });

        it('should return 200 POST rest/executor/cancel/existingHash with correct secret', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/create/existingHash').end(function (err, res) {
                    assert.equal(err, null);
                    assert.equal(res.status, 200, err);
                    agent.post(serverBaseUrl + '/rest/executor/cancel/existingHash')
                        .send({secret: res.body.secret})
                        .end(function (err, res) {
                            assert.equal(err, null, err);
                            assert.equal(res.status, 200, err);
                            agent.get(serverBaseUrl + '/rest/executor/info/existingHash')
                                .end(function (err, res) {
                                    assert.equal(res.status, 200, err);
                                    done();
                                });
                        });
                });
            });
        });

        it('should return 403 for job creation w/o token (if no guests)', function (done) {
            gmeConfig.executor.authentication.allowGuests = false;
            server = testFixture.WebGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor/create/').end(function (err, res) {
                    assert.equal(res.status, 403, err);
                    done();
                });
            });
        });
    });

    describe('ExecutorMaster', function () {
        const reqSrc = p => require('../../../../src/' + p);
        const Express = require('express');
        const ExecutorServer = reqSrc('server/middleware/executor/ExecutorServer');
        const Logger = reqSrc('server/logger');
        let app;

        beforeEach(async () => {
            gmeConfig = testFixture.getGmeConfig();
            gmeConfig.executor.authentication.enable = true;
            gmeConfig.executor.authentication.allowGuests = true;
            const logger = Logger.createWithGmeConfig('gme', gmeConfig, true);
            const middlewareOpts = {
                gmeConfig,
                logger,
                ensureAuthenticated: (req, res, next) => next(),
                getUserId: req => req.userData.userId,
            };

            const gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig);
            //const safeStorage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
            //const db = await safeStorage.openDatabase();
            const db = await gmeAuth.connect();
            server = new ExecutorServer(middlewareOpts);
            app = new Express();
            app.use(server.router);
            await server.start({mongoClient: db});
            app = await app.listen(gmeConfig.server.port);
        });

        afterEach(() => {
            if (server) {
                server.stop();
            }
            if (app) {
                app.close();
            }
        });

        it('should get userId in job info', async function () {
            const hash = 'some_hash';
            await server.master.createJob('brian', {hash});
            const jobInfo = await server.master.getJobInfo('brian', hash);
            assert(jobInfo.userId.includes('brian'));
        });

        it('should list jobs for the given user', async function () {
            const hash = 'some_hash';
            await server.master.createJob('brian', {hash});
            const jobs = await server.master.getJobList('brian');
            assert.notEqual(jobs[hash], undefined);
        });

        it('should not list jobs for other users', async function () {
            const hash = 'some_hash';
            await server.master.createJob('brian', {hash});
            await server.master.createJob('bob', {hash: 'def'});
            const jobs = await server.master.getJobList('brian');
            assert.equal(jobs.def, undefined);
        });

        it('should not allow user to access other jobs', async function () {
            const hash = 'some_hash';
            await server.master.createJob('brian', {hash});
            const canAccess = await server.master.canUserAccessJob('bob', hash);
            assert.equal(canAccess, false);
        });

        it('should allow user to access own jobs', async function () {
            const hash = 'some_hash';
            await server.master.createJob('brian', {hash});
            const canAccess = await server.master.canUserAccessJob('brian', hash);
            assert.equal(canAccess, true);
        });

        it('should require correct secret when canceling jobs', async function () {
            const hash = 'some_hash';
            const {secret} = (await server.master.createJob('brian', {hash}));
            await server.master.cancelJob('brian', hash, secret);
        });

        it('should not cancel job w/ invalid secret', async function () {
            const hash = 'some_hash';
            const secret = 'someSecret';
            await server.master.createJob('brian', {hash, secret});
            await assert.rejects(
                () => server.master.cancelJob('brian', hash, 'hi'),
                {message: 'Unauthorized'}
            );
        });

        it('should list user workers', async function () {
            const clientId = 'some_client_id';
            await server.master.updateWorker('brian', clientId);
            const workers = await server.master.getWorkerDict('brian');
            assert(workers[clientId]);
        });

        it('should not list workers for other users', async function () {
            const clientId = 'some_client_id';
            await server.master.updateWorker('brian', clientId);
            const workers = await server.master.getWorkerDict('bob');
            assert(!workers[clientId]);
        });

        it('should get canceled jobs', async function () {
            const hash = 'some_hash';
            const {secret} = (await server.master.createJob('brian', {hash}));
            await server.master.cancelJob('brian', hash, secret);
            const jobs = await server.master.getCanceledJobs([hash]);
            assert.equal(jobs[0], hash, 'Did not find canceled job');
            assert.equal(jobs.length, 1, 'Found extra canceled jobs');
        });

        describe('startQueuedJobs', function () {
            const userId = 'some_user';
            const otherUserId = 'other_user';
            const hash = 'some_hash';
            const clientId = 'some_client_id';
            let jobs;

            beforeEach(async () => {
                await server.master.updateWorker(userId, clientId);
                await server.master.createJob(userId, {hash});
                jobs = await server.master.startQueuedJobs(userId, clientId);
            });

            it('should start queued jobs', function () {
                assert.equal(jobs[0], hash, 'Did not start job');
            });

            it('should update job info', async function () {
                const jobInfo = await server.master.getJobInfo(userId, hash);
                assert.equal(jobInfo.status, 'RUNNING');
            });

            it('should not run job on other user\'s workers', async function () {
                await server.master.createJob(otherUserId, {hash: 'another_hash'});
                jobs = await server.master.startQueuedJobs(clientId);
                assert.equal(jobs.length, 0, 'Started job on another user\'s worker');
            });
        });

        it('should update job output for user job', async function () {
            const userId = 'some_user';
            const hash = 'some_hash';
            const outputInfo = {
                hash,
                outputNumber: 10,
                data: 'hello'
            };
            await server.master.createJob(userId, {hash});
            const count = await server.master.updateJobOutput(userId, hash, outputInfo);
            assert.equal(count, 1);
        });

        it('should not update job output for other user\'s job', async function () {
            const userId = 'some_user';
            const otherUserId = 'other_user';
            const hash = 'some_hash';
            const outputInfo = {
                hash,
                outputNumber: 10,
                data: 'hello'
            };
            await server.master.createJob(otherUserId, {hash});
            const count = await server.master.updateJobOutput(userId, hash, outputInfo);
            assert.equal(count, 0);
        });

        it('should get job output for user job', async function () {
            const userId = 'some_user';
            const hash = 'some_hash';
            const outputInfo = {
                hash,
                outputNumber: 10,
                data: 'hello'
            };
            await server.master.createJob(userId, {hash});
            await server.master.updateJobOutput(userId, hash, outputInfo);
            const outputs = await server.master.getJobOutput(userId, hash);
            assert.equal(outputs.length, 1);
        });
    });
});
