/*eslint-env node, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */


var testFixture = require('../_globals');

describe('Run plugin CLI', function () {
    'use strict';

    var gmeConfig = testFixture.getGmeConfig(),
        logger = testFixture.logger.fork('run_plugin.spec'),
        spawn = testFixture.childProcess.spawn,
        storage,
        expect = testFixture.expect,
        filename = require('path').normalize('src/bin/run_plugin.js'),
        projectName = 'runPluginCLI',
        gmeAuth,
        commitHash,
        Q = testFixture.Q;

    before(function (done) {
        //adding some project to the database
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMongoStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                return testFixture.importProject(storage, {
                    projectSeed: './test/bin/run_plugin/project.webgmex',
                    projectName: projectName,
                    branchName: 'master',
                    gmeConfig: gmeConfig,
                    logger: logger
                });
            })
            .then(function (ir) {
                commitHash = ir.commitHash;
                return ir.project.createBranch('b1', commitHash);
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

    describe('as a child process', function () {
        it('should run the Minimal Working Example plugin', function (done) {
            var runpluginProcess = spawn('node', [filename, 'MinimalWorkingExample', projectName]),
                stdout,
                stderr;

            runpluginProcess.stdout.on('data', function (data) {
                stdout = stdout || '';
                stdout += data.toString();
                //console.log(data.toString());
            });

            runpluginProcess.stderr.on('data', function (data) {
                stderr = stderr || '';
                stderr += data.toString();
                //console.log(data.toString());
            });

            runpluginProcess.on('close', function (code) {
                //expect(stdout).to.contain('execution was successful');
                try {
                    expect(stderr).to.contain('This is an error message');
                    expect(code).to.equal(0);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('as a library', function () {
        var runPlugin = require('../../src/bin/run_plugin');

        it('should run the Minimal Working Example plugin', function (done) {
            runPlugin.main(['node', filename, 'MinimalWorkingExample', projectName],
                function (err, result) {
                    if (err) {
                        done(new Error(err));
                        return;
                    }
                    expect(result.success).to.equal(true);
                    expect(result.error).to.equal(null);
                    done();
                }
            );
        });

        it('should run the Minimal Working Example plugin from commitHash', function (done) {
            runPlugin.main(['node', filename, 'MinimalWorkingExample', projectName, '-c', commitHash, '-b', 'b1'],
                function (err, result) {
                    if (err) {
                        done(new Error(err));
                        return;
                    }
                    expect(result.success).to.equal(true);
                    expect(result.error).to.equal(null);
                    done();
                }
            );
        });

        it('should run the Minimal Working Example plugin and return with error in plugin-result', function (done) {
            runPlugin.main(['node', filename, 'MinimalWorkingExample', projectName,
                '-j', './test/bin/run_plugin/MinimalWorkingExample.config.json'],
            function (err, pluginResult) {
                if (err) {
                    done(err);
                    return;
                }

                if (pluginResult.success === true) {
                    done(new Error('should have failed to run plugin'));
                } else {
                    expect(pluginResult.error).to.include('Failed on purpose');
                    done();
                }
            }
            );
        });

        it('should run the Minimal Working Example plugin if owner is specified', function (done) {
            runPlugin.main(['node', filename, 'MinimalWorkingExample', projectName,
                '-o', gmeConfig.authentication.guestAccount],
            function (err, result) {
                if (err) {
                    done(new Error(err));
                    return;
                }
                expect(result.success).to.equal(true);
                expect(result.error).to.equal(null);
                done();
            }
            );
        });

        it('should fail to run the Minimal Working Example plugin if does not have access to project', function (done) {
            runPlugin.main(['node', filename, 'MinimalWorkingExample', 'not_authorized_project'],
                function (err) {
                    if (err) {
                        expect(err).to.match(/Not authorized to read project/);
                        done();
                        return;
                    }
                    done(new Error('should have failed to run plugin'));
                }
            );
        });

        it('should fail to run plugin if no plugin name and no project name is not given', function (done) {
            try {
                runPlugin.main(['node', filename],
                    function (err/*, result*/) {
                        if (err) {
                            try {
                                expect(err).to.match(/must be specified/);
                                done();
                            } catch (e) {
                                done(err);
                            }
                            return;
                        }

                        done(new Error('should have failed to run plugin'));
                    }
                );
            } catch (err) {
                done(err);
            }
        });

        it('should fail to run plugin if no project name is given', function (done) {
            runPlugin.main(['node', filename, projectName],
                function (err) {
                    if (err) {
                        try {
                            expect(err).to.match(/must be specified/);
                            done();
                        } catch (e) {
                            done(err);
                        }
                        return;
                    }
                    
                    done(new Error('should have failed to run plugin'));
                }
            );
        });

        it('should run Minimal Working Example on a project where only the user has access', function (done) {
            gmeAuth.addUser('specialUser', 'special@access.com', 'specialUser', true, {overwrite: true})
                .then(function () {
                    return testFixture.importProject(storage, {
                        projectSeed: './test/bin/run_plugin/project.webgmex',
                        projectName: 'specialProject',
                        branchName: 'master',
                        gmeConfig: gmeConfig,
                        username: 'specialUser',
                        logger: logger
                    });
                })
                .then(function () {
                    return Q.nfcall(runPlugin.main, ['node', filename,
                        'MinimalWorkingExample', 'specialProject',
                        '-u', 'specialUser']);
                })
                .nodeify(done);
        });

        it('should run the AddOnGenerator and put files in plugin-blobs if -w specified', function (done) {
            testFixture.rimraf(testFixture.path.join(process.cwd(), 'test-tmp/plugin-blobs'))
                .then(function () {
                    runPlugin.main(['node', filename, 'AddOnGenerator', projectName, '-w', 'test-tmp/plugin-blobs'],
                        function (err, result) {
                            if (err) {
                                done(new Error(err));
                                return;
                            }
                            expect(result.success).to.equal(true);
                            expect(result.error).to.equal(null);

                            expect(testFixture.fs.existsSync(
                                testFixture.path.join(process.cwd(), 'test-tmp/plugin-blobs/NewAddOn.js'))
                            ).to.equal(true);
                            done();
                        }
                    );
                })
                .catch(done);
        });

        it('should run and connect to server when serverUrl specified', function (done) {
            var webGME = testFixture.WebGME,
                gmeConfig = testFixture.getGmeConfig(),
                error,
                server;

            server = webGME.standaloneServer(gmeConfig);

            Q.ninvoke(server, 'start')
                .then(function () {
                    return runPlugin.main([
                        'node', filename, 'MinimalWorkingExample', projectName, '-l',
                        'http://127.0.0.1:' + gmeConfig.server.port]);
                })
                .then(function (result) {
                    expect(result.success).to.equal(true);
                    expect(result.error).to.equal(null);
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    server.stop(function (err2) {
                        done(error || err2);
                    });
                });
        });
    });
});
