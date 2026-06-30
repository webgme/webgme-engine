/*eslint-env node, mocha*/
/**
 * @author webgme-engine contributors
 */

var path = require('path'),
    testFixture = require('../../../_globals.js');

describe('MemoryGMEAuth', function () {
    'use strict';

    var expect = testFixture.expect,
        Q = testFixture.Q,
        gmeConfig = testFixture.getGmeConfig(),
        MemoryGMEAuth = require('../../../../src/server/middleware/auth/memorygmeauth'),
        memoryAuthPath = path.join(__dirname, '../../../../src/server/middleware/auth/memorygmeauth'),
        defaultGmeAuthPath = path.join(__dirname, '../../../../src/server/middleware/auth/gmeauth'),
        auth;

    beforeEach(function () {
        gmeConfig.authentication.enable = false;
        gmeConfig.authentication.gmeAuth.path = memoryAuthPath;
    });

    afterEach(function (done) {
        if (auth) {
            auth.unload()
                .then(function () {
                    auth = null;
                })
                .nodeify(done);
        } else {
            done();
        }
    });

    it('should default gmeAuth.path to the MongoDB-backed gmeauth module', function () {
        var configDefault = require('../../../../config/config.default.js');
        expect(configDefault.authentication.gmeAuth.path).to.equal(defaultGmeAuthPath);
        expect(function () {
            require(configDefault.authentication.gmeAuth.path);
        }).to.not.throw();
    });

    it('should throw if authentication is enabled', function () {
        gmeConfig.authentication.enable = true;
        expect(function () {
            return new MemoryGMEAuth(null, gmeConfig);
        }).to.throw(/only for auth-disabled local deployments/);
    });

    it('should connect and unload without calling MongoClient.connect', function (done) {
        var mongodb = require('mongodb'),
            originalConnect = mongodb.MongoClient.connect,
            mongoConnectCalled = false;

        mongodb.MongoClient.connect = function () {
            mongoConnectCalled = true;
            return originalConnect.apply(this, arguments);
        };

        auth = new MemoryGMEAuth(null, gmeConfig);

        auth.connect()
            .then(function () {
                expect(mongoConnectCalled).to.equal(false);
                return auth.unload();
            })
            .then(function () {
                mongodb.MongoClient.connect = originalConnect;
            })
            .nodeify(done);
    });

    it('should create guest user on connect', function (done) {
        auth = new MemoryGMEAuth(null, gmeConfig);

        auth.connect()
            .then(function () {
                return auth.getUser(gmeConfig.authentication.guestAccount);
            })
            .then(function (user) {
                expect(user._id).to.equal(gmeConfig.authentication.guestAccount);
                expect(user.canCreate).to.equal(gmeConfig.authentication.guestCanCreate);
            })
            .nodeify(done);
    });

    it('should add, list and get project metadata in memory', function (done) {
        var ownerName = 'guest',
            projectName = 'memory_meta_project',
            projectId = testFixture.storageUtil.getProjectIdFromOwnerIdAndProjectName(ownerName, projectName);

        auth = new MemoryGMEAuth(null, gmeConfig);

        auth.connect()
            .then(function () {
                return auth.metadataStorage.addProject(ownerName, projectName, { createdAt: 'now' });
            })
            .then(function (id) {
                expect(id).to.equal(projectId);
                return auth.metadataStorage.getProjects();
            })
            .then(function (projects) {
                expect(projects.length).to.equal(1);
                expect(projects[0]._id).to.equal(projectId);
                return auth.metadataStorage.getProject(projectId);
            })
            .then(function (project) {
                expect(project).to.deep.equal({
                    _id: projectId,
                    owner: ownerName,
                    name: projectName,
                    info: { createdAt: 'now' },
                    hooks: {}
                });
            })
            .nodeify(done);
    });

    it('should grant full access rights via memory authorizer', function (done) {
        var projectAuthParams;

        auth = new MemoryGMEAuth(null, gmeConfig);
        projectAuthParams = { entityType: auth.authorizer.ENTITY_TYPES.PROJECT };

        auth.connect()
            .then(function () {
                return auth.authorizer.getAccessRights('guest', 'guest+someProject', projectAuthParams);
            })
            .then(function (rights) {
                expect(rights).to.deep.equal({ read: true, write: true, delete: true });
            })
            .nodeify(done);
    });

    describe('standalone server with memory auth', function () {
        var WebGME = testFixture.WebGME,
            server;

        afterEach(function (done) {
            if (server && server.isRunning()) {
                server.stop(done);
            } else {
                done();
            }
        });

        it('should start without MongoDB when using memory storage and memorygmeauth', function (done) {
            var mongodb = require('mongodb'),
                originalConnect = mongodb.MongoClient.connect,
                mongoConnectCalled = false,
                standaloneConfig = testFixture.getGmeConfig();

            mongodb.MongoClient.connect = function () {
                mongoConnectCalled = true;
                return originalConnect.apply(this, arguments);
            };

            standaloneConfig.server.port = 14242;
            standaloneConfig.storage.database.type = 'memory';
            standaloneConfig.authentication.enable = false;
            standaloneConfig.authentication.gmeAuth.path = memoryAuthPath;

            server = WebGME.standaloneServer(standaloneConfig);

            Q.ninvoke(server, 'start')
                .then(function () {
                    expect(server.isRunning()).to.equal(true);
                    expect(mongoConnectCalled).to.equal(false);
                    mongodb.MongoClient.connect = originalConnect;
                })
                .nodeify(done);
        });
    });
});
