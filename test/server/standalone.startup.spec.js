/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

describe.only('standalone startup with authentication turned on', function () {
    'use strict';
    var testFixture = require('../_globals.js'),
        WebGME = testFixture.WebGME,
        safeStorage,
        webgmeToken,
        gmeAuth,
        expect = testFixture.expect,
        should = testFixture.should,
        superagent = testFixture.superagent,
        Q = testFixture.Q,
        logger,
        agent,
        server,
        gmeConfig,
        authorizer,
        projectAuthParams,
        logIn = function (callback) {
            testFixture.logIn(server, agent, 'user', 'plaintext').nodeify(callback);
        },
        openSocketIo = function (callback) {
            return testFixture.openSocketIo(server, agent, 'user', 'plaintext')
                .then(function (result) {
                    webgmeToken = result.webgmeToken;
                    return result.socket;
                })
                .nodeify(callback);
        };

    beforeEach(function (done) {
        agent = superagent.agent();
        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                authorizer = gmeAuth.authorizer;
                projectAuthParams = {
                    entityType: authorizer.ENTITY_TYPES.PROJECT,
                };

                safeStorage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return safeStorage.openDatabase();
            })
            .then(function () {
                return gmeAuth.addUser('admin', 'admin@example.com', 'plaintext', true,
                    {overwrite: true, siteAdmin: true});
            })
            .nodeify(done);
    });

    before(function () {
        // we have to set the config here
        gmeConfig = testFixture.getGmeConfig();

        logger = testFixture.logger.fork('standalone.startup.spec');
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowGuests = false;
    });

    afterEach(function (done) {
        server.stop(function () {
            gmeAuth.unload()
                .nodeify(done);
        });

    });

    it('should create startup projects as directed by the config', function (done) {
        var _gmeConfig = JSON.parse(JSON.stringify(gmeConfig)),
            serverBaseUrl;

        _gmeConfig.seedProjects.createAtStartup = [
            {
                seedId: 'EmptyProject',
                projectName: 'DefaultOne',
                creatorId: 'admin',
                ownerId: 'admin',
                rights: {
                    admin: {read: true, write: true}
                }
            }
        ];

        server = WebGME.standaloneServer(_gmeConfig);
        serverBaseUrl = server.getUrl();

        Q.ninvoke(server, 'start')
            .then(function () {
                return testFixture.logIn(server, agent, 'admin', 'plaintext');
            })
            .then(function () {
                var deferred = Q.defer();
                agent.get(serverBaseUrl + '/api/projects')
                    .end(function (err, res) {
                        should.equal(res.status, 200);
                        expect(res.body).to.have.length(1);
                        expect(res.body[0].owner).to.equal(_gmeConfig.seedProjects.createAtStartup[0].ownerId);
                        expect(res.body[0].info.kind).to.equal(_gmeConfig.seedProjects.createAtStartup[0].seedId);
                        deferred.resolve();
                    });

                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should not create startup projects that has bad creator assigned to it', function (done) {
        var _gmeConfig = JSON.parse(JSON.stringify(gmeConfig)),
            serverBaseUrl;

        _gmeConfig.seedProjects.createAtStartup = [
            {
                seedId: 'EmptyProject',
                projectName: 'DefaultOne',
                creatorId: 'bad',
                ownerId: 'admin',
                rights: {
                    admin: {read: true, write: true}
                }
            }
        ];

        server = WebGME.standaloneServer(_gmeConfig);
        serverBaseUrl = server.getUrl();

        Q.ninvoke(server, 'start')
            .then(function () {
                return testFixture.logIn(server, agent, 'admin', 'plaintext');
            })
            .then(function () {
                var deferred = Q.defer();
                agent.get(serverBaseUrl + '/api/projects')
                    .end(function (err, res) {
                        should.equal(res.status, 200);
                        expect(res.body).to.have.length(0);
                        deferred.resolve();
                    });

                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should create startup projects and fallback owner to creator', function (done) {
        var _gmeConfig = JSON.parse(JSON.stringify(gmeConfig)),
            serverBaseUrl;

        _gmeConfig.seedProjects.createAtStartup = [
            {
                seedId: 'EmptyProject',
                projectName: 'DefaultOne',
                creatorId: 'admin',
                rights: {
                    admin: {read: true, write: true}
                }
            }
        ];

        server = WebGME.standaloneServer(_gmeConfig);
        serverBaseUrl = server.getUrl();

        Q.ninvoke(server, 'start')
            .then(function () {
                return testFixture.logIn(server, agent, 'admin', 'plaintext');
            })
            .then(function () {
                var deferred = Q.defer();
                agent.get(serverBaseUrl + '/api/projects')
                    .end(function (err, res) {
                        should.equal(res.status, 200);
                        expect(res.body).to.have.length(1);
                        expect(res.body[0].owner).to.equal(_gmeConfig.seedProjects.createAtStartup[0].creatorId);
                        expect(res.body[0].info.kind).to.equal(_gmeConfig.seedProjects.createAtStartup[0].seedId);
                        deferred.resolve();
                    });

                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should create startup projects and fallback owner to admin', function (done) {
        var _gmeConfig = JSON.parse(JSON.stringify(gmeConfig)),
            serverBaseUrl;

        _gmeConfig.authentication.admin = 'admin';
        _gmeConfig.seedProjects.createAtStartup = [
            {
                seedId: 'EmptyProject',
                projectName: 'DefaultOne',
                rights: {
                    admin: {read: true, write: true}
                }
            }
        ];

        server = WebGME.standaloneServer(_gmeConfig);
        serverBaseUrl = server.getUrl();

        Q.ninvoke(server, 'start')
            .then(function () {
                return testFixture.logIn(server, agent, 'admin', 'plaintext');
            })
            .then(function () {
                var deferred = Q.defer();
                agent.get(serverBaseUrl + '/api/projects')
                    .end(function (err, res) {
                        should.equal(res.status, 200);
                        expect(res.body).to.have.length(1);
                        expect(res.body[0].owner).to.equal(_gmeConfig.authentication.admin);
                        expect(res.body[0].info.kind).to.equal(_gmeConfig.seedProjects.createAtStartup[0].seedId);
                        deferred.resolve();
                    });

                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should fail to create startup projects with bad owner', function (done) {
        var _gmeConfig = JSON.parse(JSON.stringify(gmeConfig));

        _gmeConfig.seedProjects.createAtStartup = [
            {
                seedId: 'EmptyProject',
                projectName: 'DefaultOne',
                creatorId: 'admin',
                ownerId: 'bad',
                rights: {
                    admin: {read: true, write: true}
                }
            }
        ];

        server = WebGME.standaloneServer(_gmeConfig);

        Q.ninvoke(server, 'start')
            .then(function () {
                return testFixture.logIn(server, agent, 'admin', 'plaintext');
            })
            .then(function () {
                done(new Error('shoud have failed'));
            })
            .catch(function (err) {
                done();
            })
            .finally(function () {

            });
    });
});