/*eslint-env node, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 */

'use strict';

describe('CorePlugins', function () {

    var testFixture = require('../../_globals.js'),
        gmeConfig = testFixture.getGmeConfig(),
        Q = testFixture.Q,
        expect = testFixture.expect,
        superagent = testFixture.superagent,

        WebGME = testFixture.WebGME,

        logger = testFixture.logger.fork('coreplugins.spec'),

        pluginNames = [
            'AddOnGenerator',
            'ConfigurationArtifact',
            'DecoratorGenerator',
            'ExecutorPlugin',
            'ImportV1',
            'MergeExample',
            'MetaGMEParadigmImporter',
            'MinimalWorkingExample',
            'PluginGenerator',
            'VisualizerGenerator',
            'LayoutGenerator',
            'MultipleMainCallbackCalls',
            'PluginForked',
            'InvalidActiveNode',
            'ConstraintEvaluator',
            'FastForward',
            'RestRouterGenerator',
            'CustomPluginConfig',
            'GuidCollider',
            'GenerateAll',
            'SavingDependency',
            'OTAttributeEditing',
            'InvokerPlugin',
            'InvokedPlugin',
            'WaitingForAbort',
            'AbortPlugin',
            'WaitPlugin',
            'SearchNodes'
        ],

        pluginsShouldFail = [
            'ExecutorPlugin',
            'MergeExample',
            'MetaGMEParadigmImporter',
            'MultipleMainCallbackCalls',
            'InvalidActiveNode',
            'ConstraintEvaluator',
            'ImportV1',
            'OTAttributeEditing'
        ],
        importResult,
        gmeAuth,
        safeStorage,

        //guestAccount = testFixture.getGmeConfig().authentication.guestAccount,
        serverBaseUrl,
        server,

        PluginCliManager = require('../../../src/plugin/climanager');

    before(function (done) {
        var gmeConfigWithAuth = testFixture.getGmeConfig();
        gmeConfigWithAuth.authentication.enable = true;
        gmeConfigWithAuth.authentication.allowGuests = true;

        server = WebGME.standaloneServer(gmeConfigWithAuth);
        serverBaseUrl = server.getUrl();
        server.start(function (err) {
            if (err) {
                done(new Error(err));
                return;
            }

            testFixture.clearDBAndGetGMEAuth(gmeConfigWithAuth)
                .then(function (gmeAuth_) {
                    gmeAuth = gmeAuth_;
                    safeStorage = testFixture.getMongoStorage(logger, gmeConfigWithAuth, gmeAuth);

                    return Q.allDone([
                        safeStorage.openDatabase()
                    ]);
                })
                .then(function () {
                    return testFixture.importProject(safeStorage, {
                        projectSeed: './seeds/EmptyProject.webgmex',
                        projectName: 'CorePluginsTestAll',
                        branchName: 'master',
                        gmeConfig: gmeConfig,
                        logger: logger
                    });
                })
                .then(function (result) {
                    importResult = result;

                    return Q.allDone(pluginNames
                        .map(function (name) {
                            return importResult.project.createBranch(name, importResult.commitHash);
                        })
                    );
                })
                .nodeify(done);
        });
    });

    after(function (done) {
        server.stop(function (err) {
            if (err) {
                done(new Error(err));
                return;
            }

            Q.allDone([
                gmeAuth.unload(),
                safeStorage.closeDatabase()
            ])
                .nodeify(done);
        });
    });

    // get seed designs 'files' and make sure all of them are getting tested
    it('should get all core plugins', function (done) {
        var agent = superagent.agent();

        agent.get(serverBaseUrl + '/api/plugins', function (err, res) {
            expect(err).to.equal(null, err && err.message);
            // As pluginNames contains unique names, we can check that each is
            // in the response and the response is the proper length
            expect(res.body.length).to.equal(pluginNames.length);  // ensures that we test all available core plugins
            expect(res.body).to.have.members(pluginNames);
            done();
        });
    });

    function createTests() {
        var i;

        function createPluginTest(name, cnt) {
            // import seed designs
            it('should run plugin ' + name, function (done) {
                var pluginManager = new PluginCliManager(importResult.project, logger, gmeConfig),
                    pluginContext = {
                        activeNode: '/1',
                        branchName: pluginNames[cnt]
                    },
                    callbackCnt = 0;

                pluginManager.executePlugin(name, null, pluginContext, function (err, result) {
                    callbackCnt += 1;
                    try {
                        if (name === 'MultipleMainCallbackCalls') {
                            if (callbackCnt === 1) {
                                expect(result.success).to.equal(true);
                            } else {
                                expect(result.success).to.equal(false);
                                done();
                            }
                        } else if (pluginsShouldFail.indexOf(name) > -1) {
                            expect(result.success).to.equal(false);
                            done();
                        } else {
                            expect(result.success).to.equal(true);
                            expect(result.error).to.equal(null);
                            done();
                        }
                    } catch (err) {
                        done(err);
                    }
                });
            });
        }

        for (i = 0; i < pluginNames.length; i += 1) {
            createPluginTest(pluginNames[i], i);
        }
    }

    createTests();
});
