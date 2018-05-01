/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

describe('standalone startup with authentication turned on', function () {
    'use strict';
    var testFixture = require('../_globals.js'),
        WebGME = testFixture.WebGME,
        safeStorage,
        gmeAuth,
        expect = testFixture.expect,
        superagent = testFixture.superagent,
        Q = testFixture.Q,
        logger,
        agent,
        server,
        gmeConfig;

    beforeEach(function (done) {
        agent = superagent.agent();
        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;

                safeStorage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return safeStorage.openDatabase();
            })
            .then(function () {
                return gmeAuth.addUser('admin', 'admin@example.com', 'plaintext', true,
                    {overwrite: true, siteAdmin: true});
            })
            .then(function () {
                return gmeAuth.addUser('other', 'other@example.com', 'plaintext', false,
                    {overwrite: true});
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
                    admin: {read: true, write: true},
                    other: {read: true}
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
                agent.get(serverBaseUrl + '/api/users')
                    .end(function (err, res) {
                        expect(res.status).to.equal(200);
                        var matches = 0;
                        for (var i = 0; i < res.body.length; i += 1) {
                            if (res.body[i]._id === 'admin') {
                                matches += 1;
                                expect(res.body[i].projects['admin+DefaultOne'].write).to.equal(true);
                            } else if (res.body[i]._id === 'other') {
                                matches += 1;
                                expect(res.body[i].projects['admin+DefaultOne'].read).to.equal(true);
                                expect(res.body[i].projects['admin+DefaultOne'].write).not.to.equal(true);
                            }
                        }
                        expect(matches >= 2).to.equal(true);
                        deferred.resolve();
                    });

                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should create startup projects once', function (done) {
        var _gmeConfig = JSON.parse(JSON.stringify(gmeConfig)),
            serverBaseUrl;

        _gmeConfig.seedProjects.createAtStartup = [
            {
                seedId: 'EmptyProject',
                projectName: 'DefaultOne',
                creatorId: 'admin',
                ownerId: 'admin',
                rights: {}
            }
        ];

        server = WebGME.standaloneServer(_gmeConfig);
        serverBaseUrl = server.getUrl();

        Q.ninvoke(server, 'start')
            .then(function () {
                return Q.ninvoke(server, 'stop');
            })
            .then(function () {
                return Q.ninvoke(server, 'start');
            })
            .then(function () {
                return testFixture.logIn(server, agent, 'admin', 'plaintext');
            })
            .then(function () {
                var deferred = Q.defer();
                agent.get(serverBaseUrl + '/api/users')
                    .end(function (err, res) {
                        expect(res.status).to.equal(200);
                        var matches = 0;
                        for (var i = 0; i < res.body.length; i += 1) {
                            if (res.body[i]._id === 'admin') {
                                matches += 1;
                                expect(res.body[i].projects['admin+DefaultOne'].write).to.equal(true);
                            }
                        }
                        expect(matches === 1).to.equal(true);
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
                        expect(res.status).to.equal(200);
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

        _gmeConfig.authentication.adminAccount = 'admin';
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
                        expect(res.status).to.equal(200);
                        expect(res.body).to.have.length(1);
                        expect(res.body[0].owner).to.equal(_gmeConfig.authentication.admin);
                        expect(res.body[0].info.kind).to.equal(_gmeConfig.seedProjects.createAtStartup[0].seedId);
                        deferred.resolve();
                    });

                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should fail to create startup projects if creator is bad', function (done) {
        var _gmeConfig = JSON.parse(JSON.stringify(gmeConfig));

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

        Q.ninvoke(server, 'start')
            .then(function () {
                done(new Error('shoud have failed'));
            })
            .catch(function (err) {
                expect(err).not.to.equal(null);
                expect(err.message).to.contain('bad');
                done();
            })
            .finally(function () {

            });
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
                expect(err).not.to.equal(null);
                expect(err.message).to.contain('bad');
                done();
            })
            .finally(function () {

            });
    });

    it('should fail to create startup projects with bad rights', function (done) {
        var _gmeConfig = JSON.parse(JSON.stringify(gmeConfig));

        _gmeConfig.seedProjects.createAtStartup = [
            {
                seedId: 'EmptyProject',
                projectName: 'DefaultOne',
                creatorId: 'admin',
                ownerId: 'admin',
                rights: {
                    nouser: {read: true, write: true}
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
                expect(err).not.to.equal(null);
                expect(err.message).to.contain('nouser');
                done();
            })
            .finally(function () {

            });
    });
});
