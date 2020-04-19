/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */


var testFixture = require('../../../_globals');

describe('Plugin SearchNodes', function () {
    'use strict';

    var pluginName = 'SearchNodes',
        PluginBase,
        logger,
        gmeConfig,
        storage,
        expect,
        Q = testFixture.Q,
        PluginCliManager,
        project,
        projectName = 'Plugin_SearchNodes',
        commitHash,
        gmeAuth,
        importResult,
        pluginManager;

    before(function (done) {
        PluginBase = testFixture.requirejs('plugin/PluginBase');
        logger = testFixture.logger.fork(pluginName);
        gmeConfig = testFixture.getGmeConfig();
        PluginCliManager = require('../../../../src/plugin/climanager');
        expect = testFixture.expect;

        var importParam = {
            projectSeed: './seeds/EmptyProject.webgmex',
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
            })
            .nodeify(done);
    });

    after(function (done) {
        Q.allDone([
            storage.closeDatabase(),
            gmeAuth.unload()
        ])
            .nodeify(done);
    });

    it('should initialize plugin and get name, version and description', function (done) {
        pluginManager.initializePlugin(pluginName)
            .then(function (plugin) {
                expect(plugin instanceof PluginBase).to.equal(true);
                expect(plugin.getName()).to.equal('Search Nodes');
                expect(typeof plugin.getDescription ()).to.equal('string');
                expect(plugin.getConfigStructure() instanceof Array).to.equal(true);
                expect(plugin.getConfigStructure().length).to.equal(3);
            })
            .nodeify(done);
    });

    it('should find ROOT and FCO with "O" lookup', function (done) {
        var pluginContext = {
                commitHash: commitHash,
                activeNode: '',
                branchName: 'master'
            },
            pluginConfig = {
                searchPattern: 'O',
                matchCase: true,
            };

        pluginManager.executePlugin(pluginName, pluginConfig, pluginContext, function (err, result) {
            expect(err).to.eql(null);
            expect(result.messages).to.have.length(2);
            expect(result.messages[0].message).to.contain('ROOT');
            expect(result.messages[1].message).to.contain('FCO');
            done();
        });
    });

    it('should find ROOT with "OO" lookup', function (done) {
        var pluginContext = {
                commitHash: commitHash,
                activeNode: '',
                branchName: 'master'
            },
            pluginConfig = {
                searchPattern: 'OO',
                matchCase: true,
            };

        pluginManager.executePlugin(pluginName, pluginConfig, pluginContext, function (err, result) {
            expect(err).to.eql(null);
            expect(result.messages).to.have.length(1);
            expect(result.messages[0].message).to.contain('ROOT');
            done();
        });
    });

    it('should find ROOT with "oo" lookup and case insensitivity', function (done) {
        var pluginContext = {
                commitHash: commitHash,
                activeNode: '',
                branchName: 'master'
            },
            pluginConfig = {
                searchPattern: 'oo',
                matchCase: false,
            };

        pluginManager.executePlugin(pluginName, pluginConfig, pluginContext, function (err, result) {
            expect(err).to.eql(null);
            expect(result.messages).to.have.length(1);
            expect(result.messages[0].message).to.contain('ROOT');
            done();
        });
    });

    it('should find ROOT and FCO with ".o" lookup and case insensitivity', function (done) {
        var pluginContext = {
                commitHash: commitHash,
                activeNode: '',
                branchName: 'master'
            },
            pluginConfig = {
                attributeName: 'name',
                searchPattern: '.o',
                matchCase: false,
            };

        pluginManager.executePlugin(pluginName, pluginConfig, pluginContext, function (err, result) {
            expect(err).to.eql(null);
            expect(result.messages).to.have.length(2);
            expect(result.messages[0].message).to.contain('ROOT');
            expect(result.messages[1].message).to.contain('FCO');
            done();
        });
    });

    it('should not find a node with ".o" lookup', function (done) {
        var pluginContext = {
                commitHash: commitHash,
                activeNode: '',
                branchName: 'master'
            },
            pluginConfig = {
                attributeName: 'name',
                searchPattern: '.o',
                matchCase: true,
            };

        pluginManager.executePlugin(pluginName, pluginConfig, pluginContext, function (err, result) {
            expect(err).to.eql(null);
            expect(result.messages).to.have.length(0);
            done();
        });
    });

    it('should find every node by default', function (done) {
        var pluginContext = {
                commitHash: commitHash,
                activeNode: '',
                branchName: 'master'
            },
            pluginConfig = {
            };

        pluginManager.executePlugin(pluginName, pluginConfig, pluginContext, function (err, result) {
            expect(err).to.eql(null);
            expect(result.messages).to.have.length(2);
            done();
        });
    });
});