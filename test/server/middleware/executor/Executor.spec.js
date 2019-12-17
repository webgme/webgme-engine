/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../../_globals.js');

describe('ExecutorServer', function () {
    'use strict';

    var gmeConfig,
        agent = testFixture.superagent.agent(),
        should = testFixture.should,
        expect = testFixture.expect,
        Q = testFixture.Q,
        server;

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
                should.equal(res.status, 200, err);
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
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 200 GET rest/executor?status=SUCCESS', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.get(serverBaseUrl + '/rest/executor?status=SUCCESS').end(function (err, res) {
                should.equal(res.status, 200, err);
                expect(res.body).to.deep.equal({});
                done();
            });
        });
    });

    it('should return 404 POST rest/executor/info', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/info').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 404 GET rest/executor/info/', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.get(serverBaseUrl + '/rest/executor/info/').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 404 GET rest/executor/info/does_not_exist', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.get(serverBaseUrl + '/rest/executor/info/does_not_exist').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });


    it('should return 404 GET rest/executor/unknown_command', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.get(serverBaseUrl + '/rest/executor/unknown_command').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });


    it('should return 404 PUT rest/executor/worker', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.put(serverBaseUrl + '/rest/executor/worker').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 404 PUT rest/executor/update', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.put(serverBaseUrl + '/rest/executor/update').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 404 POST rest/executor/update/does_not_exist', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/update/does_not_exist').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 404 PUT rest/executor/create', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.put(serverBaseUrl + '/rest/executor/create').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 404 POST rest/executor/create', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/create').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 200 POST rest/executor/create/some_hash', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                should.equal(res.status, 200, err);
                should.equal(typeof res.body.secret, 'string', res.body);
                done();
            });
        });
    });

    it('should set userId in created job rest/executor/create/some_hash', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                should.equal(res.body.userId.length, 1);
                done();
            });
        });
    });

    it('should return 200 POST rest/executor/create/some_hash but no secret on second create', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                should.equal(res.status, 200, err);
                should.equal(typeof res.body.secret, 'string', res.body);
                agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                    should.equal(res.status, 200, err);
                    should.equal(typeof res.body.secret, 'undefined', res.body.secret);
                    done();
                });
            });
        });
    });

    it('should return 404 POST rest/executor/cancel/hashDoesNotExist', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/cancel/hashDoesNotExist').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });
    });

    it('should return 403 POST rest/executor/cancel/existingHash with no body', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/create/existingHash').end(function (err, res) {
                should.equal(res.status, 200, err);
                agent.post(serverBaseUrl + '/rest/executor/cancel/existingHash').end(function (err, res) {
                    should.equal(res.status, 403, err);
                    done();
                });
            });
        });
    });

    it('should return 403 POST rest/executor/cancel/existingHash with wrong secret', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/create/existingHash').end(function (err, res) {
                should.equal(res.status, 200, err);
                agent.post(serverBaseUrl + '/rest/executor/cancel/existingHash')
                    .send({secret: 'bla_bla'})
                    .end(function (err, res) {
                        should.equal(res.status, 403, err);
                        done();
                    });
            });
        });
    });

    it('should return 200 POST rest/executor/cancel/existingHash with correct secret', function (done) {
        server.start(function () {
            var serverBaseUrl = server.getUrl();
            agent.post(serverBaseUrl + '/rest/executor/create/existingHash').end(function (err, res) {
                should.equal(res.status, 200, err);
                agent.post(serverBaseUrl + '/rest/executor/cancel/existingHash')
                    .send({secret: res.body.secret})
                    .end(function (err, res) {
                        should.equal(res.status, 200, err);
                        agent.get(serverBaseUrl + '/rest/executor/info/existingHash')
                            .end(function (err, res) {
                                should.equal(res.status, 200, err);
                                done();
                            });
                    });
            });
        });
    });

    describe('auth', function () {
        beforeEach(() => {
            gmeConfig.executor.authentication.enable = true;
            gmeConfig.executor.authentication.allowGuests = true;
            server = testFixture.WebGME.standaloneServer(gmeConfig);
        });

        it('should list jobs for the given user', function (done) {
            // TODO: How can I add access tokens?
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/rest/executor?status=SUCCESS').end(function (err, res) {
                    should.equal(res.status, 200, err);
                    expect(res.body).to.deep.equal({});
                    done();
                });
            });
        });

        it.skip('should not list jobs for other users', function (done) {
        });

        it.skip('should return 200 if on post output w/ permissions', function (done) {
        });

        it.skip('should return 403 if on post output w/o permissions', function (done) {
        });

        it.skip('should return job info for user jobs', function (done) {
        });

        it.skip('should return 404 for job info w/o permissions', function (done) {
        });

        it.skip('should create jobs with userId', function (done) {
        });

        it.skip('should return 404 when canceling w/o permissions', function (done) {
        });

        it.skip('should list workers for the given user', function (done) {
        });

        it.skip('should not list workers for other users', function (done) {
        });

        // If guest accounts not allowed:
        it.skip('should return 403 for job creation w/o token', function (done) {
        });

        it('should return 200 POST rest/executor/create/some_hash', function (done) {
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/rest/executor/create/some_hash').end(function (err, res) {
                    should.equal(res.status, 200, err);
                    should.equal(typeof res.body.secret, 'string', res.body);
                    done();
                });
            });
        });
    });
});
