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

    const getExecutorUrl = (path) => `${server.getUrl()}/rest/executor/${path}`;
    const assertCode = (done, statusCode) => (err, res) => {
        try {
            assert.equal(res.status, statusCode, err);
            done();
        } catch (e) {
            done(e);
        }
    };

    const assert404 = (done) => assertCode(done, 404);

    describe('REST API', function () {
        before(async function () {
            await Q.allDone([
                Q.ninvoke(testFixture, 'rimraf', './test-tmp/executor'),
                Q.ninvoke(testFixture, 'rimraf', './test-tmp/executor-tmp')
            ]);
            gmeConfig = testFixture.getGmeConfig();
            gmeConfig.executor.enable = true;
            await testFixture.clearDatabase(gmeConfig);
            server = testFixture.WebGME.standaloneServer(gmeConfig);
            await server.start();
        });

        after(async function () {
            if (server) {
                await server.stop();
            }
        });

        it('should return 200 at rest/executor/worker/ with enableExecutor=true', function (done) {
            agent.get(getExecutorUrl('worker/')).end(function (err, res) {
                try {
                    assert.equal(res.status, 200, err);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it('should return 200 GET rest/executor?status=SUCCESS', function (done) {
            agent.get(getExecutorUrl('?status=SUCCESS')).end(function (err, res) {
                try {
                    assert.equal(res.status, 200, err);
                    expect(res.body).to.deep.equal({});
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it('should return 404 POST rest/executor/info', function (done) {
            agent.post(getExecutorUrl('info')).end(assert404(done));
        });

        it('should return 404 GET rest/executor/info/', function (done) {
            agent.get(getExecutorUrl('info/')).end(assert404(done));
        });

        it('should return 404 GET rest/executor/info/does_not_exist', function (done) {
            agent.get(getExecutorUrl('info/does_not_exist')).end(assert404(done));
        });

        it('should return 404 GET rest/executor/unknown_command', function (done) {
            agent.get(getExecutorUrl('unknown_command')).end(assert404(done));
        });


        it('should return 404 PUT rest/executor/worker', function (done) {
            agent.put(getExecutorUrl('worker')).end(assert404(done));
        });

        it('should return 404 PUT rest/executor/update', function (done) {
            agent.put(getExecutorUrl('update')).end(assert404(done));
        });

        it('should return 404 POST rest/executor/update/does_not_exist', function (done) {
            agent.post(getExecutorUrl('update/does_not_exist')).end(assert404(done));
        });

        it('should return 404 PUT rest/executor/create', function (done) {
            agent.put(getExecutorUrl('create')).end(assert404(done));
        });

        it('should return 404 POST rest/executor/create', function (done) {
            agent.post(getExecutorUrl('create')).end(assert404(done));
        });

        it('should return 200 POST rest/executor/create/some_hash', function (done) {
            agent.post(getExecutorUrl('create/some_hash0')).end(function (err, res) {
                try {
                    assert.equal(res.status, 200, err);
                    assert.equal(typeof res.body.secret, 'string', res.body);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it('should set userId in created job rest/executor/create/some_hash', function (done) {
            agent.post(getExecutorUrl('create/some_hash1')).end(function (err, res) {
                try {
                    assert.equal(err, null);
                    assert.equal(res.body.userId.length, 1);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it('should return 200 POST rest/executor/create/some_hash but no secret on second create', function (done) {

            agent.post(getExecutorUrl('create/some_hash2')).end(function (err, res) {
                try {
                    assert.equal(res.status, 200, err);
                    assert.equal(typeof res.body.secret, 'string', res.body);
                } catch (e) {
                    done(e);
                    return;
                }
                agent.post(getExecutorUrl('create/some_hash2')).end(function (err, res) {
                    try {
                        assert.equal(res.status, 200, err);
                        assert.equal(
                            typeof res.body.secret,
                            'undefined',
                            `Expected no secret. Found "${res.body.secret}"`
                        );
                        done();
                    } catch (err) {
                        done(err);
                    }
                });
            });
        });

        it('should return 404 POST rest/executor/cancel/hashDoesNotExist', function (done) {
            agent.post(getExecutorUrl('cancel/hashDoesNotExist')).end(assert404(done));
        });

        it('should return 403 POST rest/executor/cancel/existingHash with no body', function (done) {

            agent.post(getExecutorUrl('create/existingHash1')).end(function (err, res) {
                try {
                    assert.equal(res.status, 200, err);
                } catch (e) {
                    done(e);
                    return;
                }
                agent.post(getExecutorUrl('cancel/existingHash1')).end(assertCode(done, 403));
            });

        });

        it('should return 403 POST rest/executor/cancel/existingHash with wrong secret', function (done) {
            agent.post(getExecutorUrl('create/existingHash2')).end(function (err, res) {
                try {
                    assert.equal(res.status, 200, err);
                } catch (e) {
                    done(e);
                    return;
                }
                agent.post(getExecutorUrl('cancel/existingHash2'))
                    .send({secret: 'bla_bla'})
                    .end(assertCode(done, 403));
            });
        });

        it('should return 200 POST rest/executor/cancel/existingHash with correct secret', function (done) {

            agent.post(getExecutorUrl('create/existingHash3')).end(function (err, res) {
                try {
                    assert.equal(err, null);
                    assert.equal(res.status, 200, err);
                } catch (e) {
                    done(e);
                    return;
                }
                agent.post(getExecutorUrl('cancel/existingHash3'))
                    .send({secret: res.body.secret})
                    .end(function (err, res) {
                        try {
                            assert.equal(err, null);
                            assert.equal(res.status, 200, err);
                        } catch (e) {
                            done(e);
                            return;
                        }

                        agent.get(getExecutorUrl('info/existingHash3')).end(assertCode(done, 200));
                    });
            });
        });
    });

    describe('REST API - different server settings', function () {
        beforeEach(async function () {
            await Q.allDone([
                Q.ninvoke(testFixture, 'rimraf', './test-tmp/executor'),
                Q.ninvoke(testFixture, 'rimraf', './test-tmp/executor-tmp')
            ]);
            gmeConfig = testFixture.getGmeConfig();
            gmeConfig.executor.enable = true;
            await testFixture.clearDatabase(gmeConfig);
        });

        afterEach(async function () {
            if (server) {
                await server.stop();
            }
        });

        it('should return 403 for job creation w/o token (if no guests)', function (done) {
            gmeConfig.executor.authentication.allowGuests = false;
            server = testFixture.WebGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor/create/').end(assertCode(done, 403));
            });
        });


        it('should return 404 at rest/executor/worker/ with enableExecutor=false', function (done) {
            gmeConfig.executor.enable = false;
            server = testFixture.WebGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor/worker/').end(assert404(done));
            });
        });
    });

    describe('ExecutorMaster', function () {
        const reqSrc = p => require('../../../../src/' + p);
        const Express = require('express');
        const ExecutorServer = reqSrc('server/middleware/executor/ExecutorServer');
        const Logger = reqSrc('server/logger');
        let app;

        before(async () => {
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

        after(async () => {
            if (server) {
                await server.stop();
            }
            if (app) {
                app.close();
            }
        });

        it('should get userId in job info', async function () {
            const hash = 'some_hash1';
            await server.master.createJob('brian', {hash});
            const jobInfo = await server.master.getJobInfo('brian', hash);
            assert(jobInfo.userId.includes('brian'));
        });

        it('should list jobs for the given user', async function () {
            const hash = 'some_hash2';
            await server.master.createJob('brian', {hash});
            const jobs = await server.master.getJobList('brian');
            assert.notEqual(jobs[hash], undefined);
        });

        it('should not list jobs for other users', async function () {
            const hash = 'some_hash3';
            await server.master.createJob('brian', {hash});
            await server.master.createJob('bob', {hash: 'def'});
            const jobs = await server.master.getJobList('brian');
            assert.equal(jobs.def, undefined);
        });

        it('should not allow user to access other jobs', async function () {
            const hash = 'some_hash4';
            await server.master.createJob('brian', {hash});
            const canAccess = await server.master.canUserAccessJob('bob', hash);
            assert.equal(canAccess, false);
        });

        it('should allow user to access own jobs', async function () {
            const hash = 'some_hash5';
            await server.master.createJob('brian', {hash});
            const canAccess = await server.master.canUserAccessJob('brian', hash);
            assert.equal(canAccess, true);
        });

        it('should require correct secret when canceling jobs', async function () {
            const hash = 'some_hash6';
            const {secret} = (await server.master.createJob('brian', {hash}));
            await server.master.cancelJob('brian', hash, secret);
        });

        it('should not cancel job w/ invalid secret', async function () {
            const hash = 'some_hash7';
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
            const hash = 'some_hash8';
            const {secret} = (await server.master.createJob('brian', {hash}));
            await server.master.cancelJob('brian', hash, secret);
            const jobs = await server.master.getCanceledJobs([hash]);
            assert.equal(jobs[0], hash, 'Did not find canceled job');
            assert.equal(jobs.length, 1, 'Found extra canceled jobs');
        });

        describe('startQueuedJobs', function () {
            let userId = 'some_user__';
            let otherUserId = 'other_user__';
            let hash = 'some_hash__';
            let clientId = 'some_client_id__';
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
            const hash = 'some_hash9';
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
            const hash = 'some_hash10';
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
            const hash = 'some_hash11';
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
