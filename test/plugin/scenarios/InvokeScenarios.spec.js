/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('../../_globals');

describe('Invoke scenarios', function () {
    'use strict';

    var pluginName = 'InvokerPlugin',
        projectName = 'InvokePluginScenariosProject',
        Q = testFixture.Q,
        gmeConfig,
        storage,
        expect,
        project,
        commitHash,
        gmeAuth,
        importResult,
        pluginManager;

    before(function (done) {
        var logger = testFixture.logger.fork(pluginName),
            PluginCliManager = require('../../../src/plugin/climanager');

        gmeConfig = testFixture.getGmeConfig();

        expect = testFixture.expect;

        var importParam = {
            projectSeed: './test/plugin/scenarios/seeds/namespaces.webgmex',
            projectName: projectName,
            logger: logger,
            gmeConfig: gmeConfig
        };

        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult_) {
                importResult = importResult_;
                project = importResult.project;
                commitHash = importResult.commitHash;

                pluginManager = new PluginCliManager(project, logger, gmeConfig);

                return Q.allDone([
                    project.createBranch('t1', commitHash),
                    project.createBranch('t2', commitHash)
                ]);
            })
            .nodeify(done);
    });

    beforeEach(function (done) {
        testFixture.rimraf('./test-tmp/blob-local-storage', done);
    });

    after(function (done) {
        Q.allDone([
            storage.closeDatabase(),
            gmeAuth.unload()
        ])
            .nodeify(done);
    });

    it('initiator and initiated should have the same META by default', function (done) {
        var pluginContext = {
                branchName: 't1'
            },
            pluginConfig = {};

        Q.ninvoke(pluginManager, 'executePlugin', pluginName, pluginConfig, pluginContext)
            .then(function (result) {
                expect(result.success).to.equal(true);
                expect(result.messages.length).to.equal(2);
                expect(JSON.parse(result.messages[0].message)).to.have.members(JSON.parse(result.messages[1].message));
            })
            .nodeify(done);
    });

    it('initiated should have the limited META object if called with namespace sm', function (done) {
        var pluginContext = {
                branchName: 't2'
            },
            pluginConfig = {
                useNamespace: 'sm'
            };

        Q.ninvoke(pluginManager, 'executePlugin', pluginName, pluginConfig, pluginContext)
            .then(function (result) {
                expect(result.success).to.equal(true);
                expect(result.messages.length).to.equal(2);
                expect(JSON.parse(result.messages[0].message)).to.include
                    .members(['sm.sm.SM', 'sm.sm.FCO', 'sm.sm.state', 'sm.sm.transition']);
                expect(JSON.parse(result.messages[1].message))
                    .to.include.members(['sm.SM', 'sm.FCO', 'sm.state', 'sm.transition']);
            })
            .nodeify(done);
    });

    it('initiator and initiated recursively should have the same META by default', function (done) {
        var pluginContext = {
                branchName: 't1'
            },
            pluginConfig = {callSelf: true};

        Q.ninvoke(pluginManager, 'executePlugin', pluginName, pluginConfig, pluginContext)
            .then(function (result) {
                expect(result.success).to.equal(true);
                expect(result.messages.length).to.equal(3);
                expect(JSON.parse(result.messages[0].message)).to.have.members(JSON.parse(result.messages[1].message));
                expect(JSON.parse(result.messages[0].message)).to.have.members(JSON.parse(result.messages[2].message));
            })
            .nodeify(done);
    });

    it('initiated should have the limited META object recursively if called with namespace sm', function (done) {
        var pluginContext = {
                branchName: 't2'
            },
            pluginConfig = {
                useNamespace: 'sm',
                callSelf: true
            };

        Q.ninvoke(pluginManager, 'executePlugin', pluginName, pluginConfig, pluginContext)
            .then(function (result) {
                expect(result.success).to.equal(true);
                expect(result.messages.length).to.equal(3);
                expect(JSON.parse(result.messages[0].message)).to.include
                    .members(['sm.sm.SM', 'sm.sm.FCO', 'sm.sm.state', 'sm.sm.transition']);
                expect(JSON.parse(result.messages[1].message))
                    .to.include.members(['sm.SM', 'sm.FCO', 'sm.state', 'sm.transition']);
                expect(JSON.parse(result.messages[2].message))
                    .to.have.members(['SM', 'FCO', 'state', 'transition']);
            })
            .nodeify(done);
    });

    it('initiated should have the limited META object when initiator called with sm.sm', function (done) {
        var pluginContext = {
                branchName: 't2'
            },
            pluginConfig = {
                useNamespace: 'sm.sm'
            };

        Q.ninvoke(pluginManager, 'executePlugin', pluginName, pluginConfig, pluginContext)
            .then(function (result) {
                expect(result.success).to.equal(true);
                expect(result.messages.length).to.equal(2);
                expect(JSON.parse(result.messages[1].message)).to.have
                    .members(['SM', 'FCO', 'state', 'transition']);
            })
            .nodeify(done);
    });
});
