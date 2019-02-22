/*globals require*/
/*eslint-env node, mocha*/

/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../../_globals.js');


describe('PLUGIN REST API', function () {
    'use strict';

    var gmeConfig = testFixture.getGmeConfig(),
        logger = testFixture.logger.fork('plugin.index.spec'),
        WebGME = testFixture.WebGME,
        expect = testFixture.expect,
        superagent = testFixture.superagent;


    describe('PLUGIN SPECIFIC API', function () {
        var gmeAuth,
            safeStorage,
            importResult;

        before(function (done) {
            testFixture.clearDBAndGetGMEAuth(gmeConfig)
                .then(function (gmeAuth_) {
                    gmeAuth = gmeAuth_;
                    safeStorage = testFixture.getMongoStorage(logger, gmeConfig, gmeAuth);
                    return safeStorage.openDatabase();
                })
                .then(function () {
                    return testFixture.importProject(safeStorage, {
                        projectSeed: 'seeds/EmptyProject.webgmex',
                        projectName: 'PluginAPI_Test',
                        gmeConfig: gmeConfig,
                        logger: logger
                    });
                })
                .then(function (res) {
                    importResult = res;
                    return safeStorage.closeDatabase();
                })
                .nodeify(done);
        });

        after(function (done) {
            gmeAuth.unload()
                .nodeify(done);
        });

        describe('allowServerExecution=true, serverResultTimeout=10000', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.plugin.allowServerExecution = true;
                gmeConfig.plugin.serverResultTimeout = 10000;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            it('should list all available plugins /api/plugins', function (done) {
                agent.get(server.getUrl() + '/api/v1/plugins/')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body instanceof Array).to.equal(true);
                        expect(res.body).to.include('ImportV1', 'PluginGenerator');
                        done();
                    });
            });

            it('should list all available metadata for plugins and null where none exist /api/plugins/metadata',
                function (done) {
                    var testPlugins = [],
                        pluginNames;

                    agent.get(server.getUrl() + '/api/v1/plugins')
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body instanceof Array).to.equal(true);
                            pluginNames = res.body;
                            agent.get(server.getUrl() + '/api/v1/plugins/metadata')
                                .end(function (err, res) {
                                    var metadata;
                                    expect(res.status).equal(200, err);
                                    expect(typeof res.body === 'object').to.equal(true);
                                    metadata = res.body;
                                    expect(Object.keys(metadata)).to.deep.equal(pluginNames);
                                    pluginNames.forEach(function (name) {
                                        if (testPlugins.indexOf(name) === -1) {
                                            expect(Object.keys(metadata[name])).to.include.members([
                                                'id',
                                                'name',
                                                'version',
                                                'description',
                                                'icon',
                                                'disableServerSideExecution',
                                                'disableBrowserSideExecution',
                                                'configStructure'
                                            ]);
                                        } else {
                                            expect(metadata[name]).to.equal(null);
                                        }
                                    });

                                    done();
                                });
                        });
                }
            );

            function getMetadata(route, done) {
                agent.get(server.getUrl() + '/api/v1/' + route + '/AddOnGenerator/metadata')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(typeof res.body === 'object').to.equal(true);
                        expect(Object.keys(res.body)).to.include.members([
                            'id',
                            'name',
                            'version',
                            'description',
                            'icon',
                            'disableServerSideExecution',
                            'disableBrowserSideExecution',
                            'configStructure'
                        ]);

                        done();
                    });
            }

            it('should get metadata for /api/plugins/AddOnGenerator/metadata', function (done) {
                getMetadata('plugins', done);
            });

            it('should get metadata for /api/plugin/AddOnGenerator/metadata', function (done) {
                getMetadata('plugin', done);
            });

            it('should 404 for non-existing plugin /api/plugin/DoesNotExist/metadata', function (done) {
                agent.get(server.getUrl() + '/api/v1/plugin/DoesNotExist/metadata')
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it.skip('should 404 for plugin with no metadata /api/plugin/PluginForked/metadata', function (done) {
                agent.get(server.getUrl() + '/api/v1/plugin/PluginForked/metadata')
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            function getConfig(route, done) {
                agent.get(server.getUrl() + '/api/v1/' + route + '/ImportV1/config')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({
                            type: 'ImportProject',
                            file: ''
                        });
                        done();
                    });
            }

            it('should get config via /api/plugins/ImportV1/config', function (done) {
                getConfig('plugins', done);
            });

            it('should get config via /api/plugin/ImportV1/config', function (done) {
                getConfig('plugin', done);
            });

            function getConfigStructure(route, done) {
                agent.get(server.getUrl() + '/api/v1/' + route + '/ImportV1/configStructure')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body instanceof Array).to.equal(true);
                        expect(res.body.length).to.equal(2);
                        expect(res.body[0]).to.include.keys('name', 'value', 'description', 'valueType', 'displayName');
                        expect(res.body[1]).to.include.keys('name', 'value', 'description', 'valueType', 'displayName');
                        done();
                    });
            }

            it('should get configStructure via /api/plugins/ImportV1/configStructure', function (done) {
                getConfigStructure('plugins', done);
            });


            it('should get configStructure via /api/plugin/ImportV1/configStructure', function (done) {
                getConfigStructure('plugin', done);
            });

            it('should 404 when getting config for non-existing plugin /api/plugin/EE/config', function (done) {
                agent.get(server.getUrl() + '/api/v1/plugin/EE/config')
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 when getting configStructure for non-existing plugin /api/plugin/EE/configStructure',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/plugin/EE/configStructure')
                        .end(function (err, res) {
                            expect(res.status).equal(404, err);
                            done();
                        });
                }
            );

            it('should 404 when for non-existing result /api/plugin/SOME_PLUGIN/results/BOGUS',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/plugin/SOME_PLUGIN/results/BOGUS')
                        .end(function (err, res) {
                            expect(res.status).equal(404, err);
                            done();
                        });
                }
            );

            function executePlugin(route, done) {
                var requestBody = {
                    pluginId: 'ConfigurationArtifact',
                    projectId: importResult.project.projectId,
                    branchName: 'master'
                };

                agent.post(server.getUrl() + '/api/v1/' + route + '/ConfigurationArtifact/execute')
                    .send(requestBody)
                    .end(function (err, res) {
                        var resultId = res.body.resultId;
                        expect(res.status).equal(200, err);
                        expect(typeof resultId).to.equal('string');

                        agent.get(server.getUrl() + '/api/v1/' + route + '/ConfigurationArtifact/results/' + resultId)
                            .end(function (err, res) {
                                var cnt = 0,
                                    intervalId;
                                expect(res.status).equal(200, err);
                                expect(res.body).to.deep.equal({status: 'RUNNING'});

                                intervalId = setInterval(function () {
                                    agent.get(server.getUrl() +
                                        '/api/v1/' + route + '/ConfigurationArtifact/results/' + resultId)
                                        .end(function (err, res) {
                                            expect(res.status).equal(200, err);
                                            if (res.body.status === 'FINISHED') {
                                                clearInterval(intervalId);
                                                expect(res.body.result).to.include.keys('commits', 'messages',
                                                    'success'); //etc.
                                                expect(res.body.result.success).to.equal(true);
                                                agent.get(server.getUrl() +
                                                    '/api/v1/' + route + '/ExportImport/results/' + resultId)
                                                    .end(function (err, res) {
                                                        expect(res.status).equal(404, err);
                                                        done();
                                                    });
                                            } else if (res.body.status === 'RUNNING') {
                                                cnt += 1;
                                                if (cnt === 30) {
                                                    clearInterval(intervalId);
                                                    done(new Error('Plugin did not finish in time, ' +
                                                        'increase limit'));
                                                }
                                            } else {
                                                clearInterval(intervalId);
                                                done(new Error('Unexpected status', res.body.status));
                                            }
                                        });
                                }, 200);
                            });
                    });
            }

            it('should execute ConfigurationArtifact [pluginId, projectId, branchName]' +
                ' /api/plugins/ConfigurationArtifact/execute', function (done) {
                this.timeout(4000);
                executePlugin('plugins', done);
            });

            it('should execute ConfigurationArtifact [pluginId, projectId, branchName]' +
                ' /api/plugin/ConfigurationArtifact/execute', function (done) {
                this.timeout(4000);
                executePlugin('plugin', done);
            });

            it('should execute with ERROR status ConfigurationArtifact [pluginId] ' +
                '/api/plugin/ConfigurationArtifact/execute', function (done) {
                var requestBody = {
                    pluginId: 'ConfigurationArtifact'
                };
                agent.post(server.getUrl() + '/api/v1/plugin/ConfigurationArtifact/execute')
                    .send(requestBody)
                    .end(function (err, res) {
                        var resultId = res.body.resultId;
                        expect(res.status).equal(200, err);
                        expect(typeof resultId).to.equal('string');

                        agent.get(server.getUrl() + '/api/v1/plugin/ConfigurationArtifact/results/' + resultId)
                            .end(function (err, res) {
                                expect(res.status).equal(200, err);
                                expect(res.body).to.deep.equal({status: 'RUNNING'});
                                setTimeout(function () {
                                    agent.get(server.getUrl() +
                                        '/api/v1/plugin/ConfigurationArtifact/results/' + resultId)
                                        .end(function (err, res) {
                                            expect(res.status).equal(200, err);
                                            expect(res.body.status).to.equal('ERROR');
                                            expect(res.body.result).to.include.keys('commits', 'messages', 'success');
                                            expect(res.body.err).to.equal('Invalid argument, data.projectId is ' +
                                                'not a string.');
                                            expect(res.body.result.success).to.equal(false);
                                            agent.get(server.getUrl() +
                                                '/api/v1/plugin/ConfigurationArtifact/results/' + resultId)
                                                .end(function (err, res) {
                                                    expect(res.status).equal(404, err);
                                                    done();
                                                });
                                        });
                                }, 1000); // Wait 1 second.
                            });
                    });
            });
        });

        describe('allowServerExecution=true, serverResultTimeout=10000, auth enabled', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.plugin.allowServerExecution = true;
                gmeConfig.plugin.serverResultTimeout = 10000;
                gmeConfig.authentication.enable = true;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            it('should list all available plugins /api/plugins', function (done) {
                agent.get(server.getUrl() + '/api/v1/plugins/')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body instanceof Array).to.equal(true);
                        expect(res.body).to.include('ImportV1', 'PluginGenerator');
                        done();
                    });
            });

            it('should get config via /api/plugin/ImportV1/config', function (done) {
                agent.get(server.getUrl() + '/api/v1/plugin/ImportV1/config')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({
                            type: 'ImportProject',
                            file: ''
                        });
                        done();
                    });
            });

            it('should get configStructure via /api/plugin/ImportV1/configStructure', function (done) {
                agent.get(server.getUrl() + '/api/v1/plugin/ImportV1/configStructure')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body instanceof Array).to.equal(true);
                        expect(res.body.length).to.equal(2);
                        expect(res.body[0]).to.include.keys('name', 'value', 'description', 'valueType', 'displayName');
                        expect(res.body[1]).to.include.keys('name', 'value', 'description', 'valueType', 'displayName');
                        done();
                    });
            });

            it('should 404 when getting config for non-existing plugin /api/plugin/EE/config', function (done) {
                agent.get(server.getUrl() + '/api/v1/plugin/EE/config')
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 when getting configStructure for non-existing plugin /api/plugin/EE/configStructure',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/plugin/EE/configStructure')
                        .end(function (err, res) {
                            expect(res.status).equal(404, err);
                            done();
                        });
                }
            );

            it('should 404 when for non-existing result /api/plugin/SOME_PLUGIN/results/BOGUS',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/plugin/SOME_PLUGIN/results/BOGUS')
                        .end(function (err, res) {
                            expect(res.status).equal(404, err);
                            done();
                        });
                }
            );

            it('should execute ExportImport [pluginId, projectId, branchName]' +
                ' /api/plugin/ConfigurationArtifact/execute', function (done) {
                var requestBody = {
                    projectId: importResult.project.projectId,
                    branchName: 'master'
                };
                this.timeout(4000);
                agent.post(server.getUrl() + '/api/v1/plugin/ConfigurationArtifact/execute')
                    .send(requestBody)
                    .end(function (err, res) {
                        var resultId = res.body.resultId;
                        expect(res.status).equal(200, err);
                        expect(typeof resultId).to.equal('string');

                        agent.get(server.getUrl() + '/api/v1/plugin/ConfigurationArtifact/results/' + resultId)
                            .end(function (err, res) {
                                var cnt = 0,
                                    intervalId;
                                expect(res.status).equal(200, err);
                                expect(res.body).to.deep.equal({status: 'RUNNING'});

                                intervalId = setInterval(function () {
                                    agent.get(server.getUrl() +
                                        '/api/v1/plugin/ConfigurationArtifact/results/' + resultId)
                                        .end(function (err, res) {
                                            expect(res.status).equal(200, err);
                                            if (res.body.status === 'FINISHED') {
                                                clearInterval(intervalId);
                                                expect(res.body.result).to.include.keys('commits', 'messages',
                                                    'success'); //etc.
                                                expect(res.body.result.success).to.equal(true);
                                                agent.get(server.getUrl() +
                                                    '/api/v1/plugin/ConfigurationArtifact/results/' + resultId)
                                                    .end(function (err, res) {
                                                        expect(res.status).equal(404, err);
                                                        done();
                                                    });
                                            } else if (res.body.status === 'RUNNING') {
                                                cnt += 1;
                                                if (cnt === 30) {
                                                    clearInterval(intervalId);
                                                    done(new Error('Plugin did not finish in time, ' +
                                                        'increase limit'));
                                                }
                                            } else {
                                                clearInterval(intervalId);
                                                done(new Error('Unexpected status', res.body.status));
                                            }
                                        });
                                }, 200);
                            });
                    });
            });

            it('should execute with ERROR status ExportImport [pluginId] /api/plugin/ExportImport/execute',
                function (done) {
                    var requestBody = {
                        pluginId: 'ExportImport'
                    };
                    agent.post(server.getUrl() + '/api/v1/plugin/ExportImport/execute')
                        .send(requestBody)
                        .end(function (err, res) {
                            var resultId = res.body.resultId;
                            expect(res.status).equal(200, err);
                            expect(typeof resultId).to.equal('string');

                            agent.get(server.getUrl() + '/api/v1/plugin/ExportImport/results/' + resultId)
                                .end(function (err, res) {
                                    expect(res.status).equal(200, err);
                                    expect(res.body).to.deep.equal({status: 'RUNNING'});
                                    setTimeout(function () {
                                        agent.get(server.getUrl() + '/api/v1/plugin/ExportImport/results/' + resultId)
                                            .end(function (err, res) {
                                                expect(res.status).equal(200, err);
                                                expect(res.body.status).to.equal('ERROR');
                                                expect(res.body.result).to.include.keys('commits', 'messages',
                                                    'success'); //etc.
                                                expect(res.body.err).to.equal('Invalid argument, data.projectId is ' +
                                                    'not a string.');
                                                expect(res.body.result.success).to.equal(false);
                                                agent.get(server.getUrl() +
                                                    '/api/v1/plugin/ExportImport/results/' + resultId)
                                                    .end(function (err, res) {
                                                        expect(res.status).equal(404, err);
                                                        done();
                                                    });
                                            });
                                    }, 1000); // Wait 1 second.
                                });
                        });
                }
            );
        });

        describe('allowServerExecution=true, serverResultTimeout=200', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.plugin.allowServerExecution = true;
                gmeConfig.plugin.serverResultTimeout = 200;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            it('should 404 when ExportImport [pluginId, projectId, branchName] /api/plugin/ExportImport/execute ' +
                'and timeout passed /api/v1/plugin/ExportImport/results/%RESULT_ID%', function (done) {
                var requestBody = {
                    //pluginId: 'ExportImport',
                    projectId: importResult.project.projectId,
                    branchName: 'master',
                    pluginConfig: {
                        type: 'Import'
                    }
                };
                this.timeout(5000);
                agent.post(server.getUrl() + '/api/v1/plugin/ExportImport/execute')
                    .send(requestBody)
                    .end(function (err, res) {
                        var resultId = res.body.resultId,
                            cnt = 0,
                            intervalId;

                        expect(res.status).equal(200, err);
                        expect(typeof resultId).to.equal('string');

                        intervalId = setInterval(function () {
                            agent.get(server.getUrl() + '/api/v1/plugin/ExportImport/results/' + resultId)
                                .end(function (err, res) {
                                    expect(res.status).equal(200, err);

                                    if (res.status === 200) {
                                        if (res.body.status === 'RUNNING') {
                                            cnt += 1;
                                            if (cnt === 30) {
                                                clearInterval(intervalId);
                                                done(new Error('Plugin did not finish in time, ' +
                                                    'increase limit'));
                                            }
                                        } else {
                                            clearInterval(intervalId);
                                            setTimeout(function () {
                                                agent.get(server.getUrl() + '/api/v1/plugin/ExportImport/results/' +
                                                    resultId)
                                                    .end(function (err, res) {
                                                        expect(res.status).equal(404, err);
                                                        done();
                                                    });
                                            }, 1000);
                                        }
                                    } else {
                                        clearInterval(intervalId);
                                        done(new Error('404 before finished'));
                                    }
                                });
                        }, 100);
                    });
            });

            it('should 200 at /api/plugin/MinimalWorkingExample/run and return results', function (done) {
                agent.post(server.getUrl() + '/api/v1/plugin/MinimalWorkingExample/run')
                    .send({
                        projectId: importResult.project.projectId,
                        branchName: 'master',
                        pluginConfig: {
                            save: false,
                        }
                    })
                    .end(function (err, res) {
                        try {
                            expect(err).to.equal(null);
                            expect(res.status).to.equal(200);
                            expect(res.body.success).to.equal(true);
                            expect(res.body.pluginId).to.equal('MinimalWorkingExample');
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
            });

            it('should 200 at /api/plugin/MinimalWorkingExample/run and return results (success=false)',
                function (done) {
                    agent.post(server.getUrl() + '/api/v1/plugin/MinimalWorkingExample/run')
                        .send({
                            projectId: importResult.project.projectId,
                            branchName: 'master',
                            pluginConfig: {
                                shouldFail: true,
                            }
                        })
                        .end(function (err, res) {
                            try {
                                expect(err).to.equal(null);
                                expect(res.status).to.equal(200);
                                expect(res.body.success).to.equal(false);
                                expect(res.body.pluginId).to.equal('MinimalWorkingExample');
                                done();
                            } catch (e) {
                                done(e);
                            }
                        });
                }
            );
        });
    });
});
