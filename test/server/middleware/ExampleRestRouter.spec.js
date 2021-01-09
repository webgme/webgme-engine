/*eslint-env node, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 */


const testFixture = require('../../_globals.js');
const Q = testFixture.Q;

describe('ExampleRestRouter', function () {
    'use strict';

    var webGME = testFixture.WebGME,
        agent = testFixture.superagent.agent(),
        expect = testFixture.expect;

    describe('handles project', function () {
        // FIXME: somehow the ordering of the test in this file matters...

        let server = null;
        let storage = null;
        let gmeAuth = null;
        let serverBaseUrl = '';
        const logger = testFixture.logger.fork('ExampleRestRouter');
        const projectName = 'RouterProject';
        const gmeConfig = testFixture.getGmeConfig();


        before(function (done) {
            //adding some project to the database
            this.timeout(10000);
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
                .then(function () {
                    return Q.ninvoke(server, 'start');
                })
                .then(function () {
                    serverBaseUrl = server.getUrl();
                })
                .nodeify(done);
        });

        after(function (done) {
            if (server) {
                server.stop(done);
            } else {
                done();
            }
        });

        it('should return 404 for ExampleRestRouter/updateExample/unknownProjectId', function (done) {
            agent.get(serverBaseUrl + '/ExampleRestRouter/updateExample/unknownProjectId').end(function (err, res) {
                expect(err).not.equal(null);
                expect(res.status).equal(404);
                done(null);
            });
        });

        it('should update project for ExampleRestRouter/updateExample/guest+RouterProject', function (done) {
            agent.get(serverBaseUrl + '/ExampleRestRouter/updateExample/guest+RouterProject').end(function (err, res) {
                expect(err).equal(null);
                expect(res.status).equal(200);
                done(null);
            });
        });
    });

    describe('uses server', function () {
        var server;
        afterEach(function (done) {
            if (server) {
                server.stop(done);
            } else {
                done();
            }
        });

        it('/ExampleRestRouter/getExample should return 200', function (done) {
            var gmeConfig = testFixture.getGmeConfig();
            server = null;
            // gmeConfig.rest.components.ExampleRestRouter = './middleware/ExampleRestRouter';
            server = webGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/ExampleRestRouter/getExample').end(function (err, res) {
                    expect(err).equal(null);
                    expect(res.status).equal(200);
                    server.stop(function (err) {
                        server = null;
                        done(err);
                    });
                });
            });
        });

        it('/ExampleRestRouter/getExample should return 200 with new config structure', function (done) {
            var gmeConfig = testFixture.getGmeConfig();
            server = null;
            gmeConfig.rest.components.ExampleRestRouter = {
                src: './middleware/ExampleRestRouter',
                mount: 'ExampleRestRouter',
                options: {
                    hello: 'there'
                }
            };
            server = webGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/ExampleRestRouter/getExample').end(function (err, res) {
                    expect(err).equal(null);
                    expect(res.status).equal(200);

                    // Make sure options are preserved
                    expect(gmeConfig.rest.components.ExampleRestRouter.options.hello).to.equal('there');

                    server.stop(function (err) {
                        server = null;
                        done(err);
                    });
                });
            });
        });

        it.skip('/ExampleRestRouter/getExample should return 302 with auth and no guests', function (done) {
            var gmeConfig = testFixture.getGmeConfig();
            server = null;
            gmeConfig.authentication.enable = true;
            gmeConfig.authentication.allowGuests = false;
            // gmeConfig.rest.components.ExampleRestRouter = './middleware/ExampleRestRouter';
            server = webGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/ExampleRestRouter/getExample').end(function (err, res) {
                    expect(err).equal(null);
                    expect(res.status).equal(401);
                    server.stop(function (err) {
                        server = null;
                        done(err);
                    });
                });
            });
        });

        it('/ExampleRestRouter should return 200 with auth and guests', function (done) {
            var gmeConfig = testFixture.getGmeConfig();
            server = null;
            gmeConfig.authentication.enable = true;
            gmeConfig.authentication.allowGuests = true;
            // gmeConfig.rest.components.ExampleRestRouter = './middleware/ExampleRestRouter';
            server = webGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/ExampleRestRouter/getExample').end(function (err, res) {
                    var error;
                    try {
                        expect(err).equal(null);
                        expect(res.status).equal(200);
                    } catch (e) {
                        error = e;
                    }

                    server.stop(function (err) {
                        server = null;
                        done(error || err);
                    });
                });
            });
        });


        it('PATCH /ExampleRestRouter/patchExample should return 200', function (done) {
            var gmeConfig = testFixture.getGmeConfig();
            server = null;
            // gmeConfig.rest.components.ExampleRestRouter = './middleware/ExampleRestRouter';
            server = webGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.patch(serverBaseUrl + '/ExampleRestRouter/patchExample').end(function (err, res) {
                    var error;
                    try {
                        expect(err).equal(null);
                        expect(res.status).equal(200);
                    } catch (e) {
                        error = e;
                    }

                    server.stop(function (err) {
                        server = null;
                        done(error || err);
                    });
                });
            });
        });

        it('POST /ExampleRestRouter/postExample should return 204', function (done) {
            var gmeConfig = testFixture.getGmeConfig();
            server = null;
            // gmeConfig.rest.components.ExampleRestRouter = './middleware/ExampleRestRouter';
            server = webGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.post(serverBaseUrl + '/ExampleRestRouter/postExample')
                    .send({data: 42})
                    .end(function (err, res) {
                        expect(err).equal(null);
                        expect(res.status).equal(201);
                        server.stop(function (err) {
                            server = null;
                            done(err);
                        });
                    });
            });
        });

        it('DELETE /ExampleRestRouter/deleteExample should return 200', function (done) {
            var gmeConfig = testFixture.getGmeConfig();
            server = null;
            // gmeConfig.rest.components.ExampleRestRouter = './middleware/ExampleRestRouter';
            server = webGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.del(serverBaseUrl + '/ExampleRestRouter/deleteExample').end(function (err, res) {
                    expect(err).equal(null);
                    expect(res.status).equal(204);
                    server.stop(function (err) {
                        server = null;
                        done(err);
                    });
                });
            });
        });

        it('should return 500 /ExampleRestRouter/error', function (done) {
            var gmeConfig = testFixture.getGmeConfig();
            server = null;
            // gmeConfig.rest.components.ExampleRestRouter = './middleware/ExampleRestRouter';
            server = webGME.standaloneServer(gmeConfig);
            server.start(function () {
                var serverBaseUrl = server.getUrl();
                agent.get(serverBaseUrl + '/ExampleRestRouter/error').end(function (err, res) {
                    expect(res.status).equal(500);
                    server.stop(function (err) {
                        server = null;
                        done(err);
                    });
                });
            });
        });
    });
});