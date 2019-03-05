/*globals requirejs, expect, before, WebGMEGlobal*/
/*eslint-env browser, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

describe('Plugin', function () {
    'use strict';
    var Client,
        allPlugins = [],
        gmeConfig,
        client,
        projectName = 'pluginProject',
        projectId,
        InterpreterManager,
        currentBranchName,
        currentBranchHash,
        originalCommitHash;

    before(function (done) {
        requirejs([
            'client/client',
            'text!gmeConfig.json',
            'superagent',
            'plugin/MinimalWorkingExample/MinimalWorkingExample/MinimalWorkingExample',
            'plugin/PluginForked/PluginForked/PluginForked',
            'plugin/AbortPlugin/AbortPlugin/AbortPlugin',
            'plugin/WaitPlugin/WaitPlugin/WaitPlugin'
        ], function (Client_, gmeConfigJSON, superagent, MinimalWorkingExample, PluginForked, AbortPlugin, WaitPlugin) {
            Client = Client_;
            gmeConfig = JSON.parse(gmeConfigJSON);
            client = new Client(gmeConfig);
            projectId = gmeConfig.authentication.guestAccount + client.CONSTANTS.STORAGE.PROJECT_ID_SEP +
                projectName;
            window.WebGMEGlobal = {};
            window.WebGMEGlobal.plugins = {};
            window.WebGMEGlobal.plugins.MinimalWorkingExample = MinimalWorkingExample;
            window.WebGMEGlobal.plugins.PluginForked = PluginForked;
            window.WebGMEGlobal.plugins.AbortPlugin = AbortPlugin;
            window.WebGMEGlobal.plugins.WaitPlugin = WaitPlugin;
            superagent.get('/api/plugins')
                .end(function (err, res) {
                    if (res.status === 200) {
                        allPlugins = res.body;
                        client.connectToDatabase(function (err) {
                            expect(err).to.equal(null);
                            client.selectProject(projectId, null, function (err) {
                                expect(err).to.equal(null);

                                originalCommitHash = client.getActiveCommitHash();
                                done();
                            });
                        });
                    } else {
                        done(new Error('/api/plugins failed'));
                    }
                });
        });
    });

    afterEach(function (done) {
        if (currentBranchName) {
            client.selectBranch('master', null, function (err) {
                client.deleteBranch(projectId, currentBranchName, currentBranchHash, function (err2) {
                    currentBranchName = null;
                    done(err || err2);
                });
            });
        } else {
            done();
        }
    });

    after(function (done) {
        client.disconnectFromDatabase(done);
    });

    function createSelectBranch(branchName, callback) {
        client.createBranch(projectId, branchName, originalCommitHash, function (err) {
            expect(err).to.equal(null);
            client.selectBranch(branchName, null, callback);
        });
    }

    it('MinimalWorkingExample, PluginGenerator and ExecutorPlugin should be avaliable in allPlugins', function () {
        expect(allPlugins).to.include('MinimalWorkingExample', 'PluginGenerator', 'ExecutorPlugin');
    });

    it('filterPlugins - should read from root-node when no nodePath given.', function () {
        var filtered = client.filterPlugins(allPlugins);
        expect(filtered.length).to.equal(2);
        expect(filtered).to.include('MinimalWorkingExample', 'PluginGenerator');
    });

    it('filterPlugins - should not return a plugin that is not in allPlugins.', function () {
        var filtered = client.filterPlugins(['MinimalWorkingExample']);
        expect(filtered.length).to.equal(1);
        expect(filtered).to.include('MinimalWorkingExample');
    });

    it('filterPlugins - should read from root-node when given nodePath not loaded.', function () {
        var filtered = client.filterPlugins(allPlugins, '/i');
        expect(filtered.length).to.equal(2);
        expect(filtered).to.include('MinimalWorkingExample', 'PluginGenerator');
    });

    it('filterPlugins - should read from given nodePath when node loaded.', function (done) {
        var loaded = false,
            userGuid;

        function eventHandler(events) {
            var filtered;
            if (loaded) {
                done(new Error('More than one event'));
            } else {
                loaded = true;
                expect(events.length).to.equal(2);

                filtered = client.filterPlugins(allPlugins, '/1');
                expect(filtered.length).to.equal(1);
                expect(filtered).to.include('ExecutorPlugin');
                client.removeUI(userGuid);
                done();
            }
        }

        userGuid = client.addUI({}, eventHandler);
        client.updateTerritory(userGuid, {'/1': {children: 0}});
    });

    it('should run PluginGenerator on the server and return a valid result using default settings', function (done) {
        var pluginId = 'PluginGenerator',
            context = {
                managerConfig: {
                    project: projectId,
                    activeNode: '',
                    commit: originalCommitHash,
                    branchName: 'master'
                }
            };
        //* @param {string} name - name of plugin.
        //* @param {object} context
        //* @param {object} context.managerConfig - where the plugin should execute.
        //* @param {string} context.managerConfig.project - name of project.
        //* @param {string} context.managerConfig.activeNode - path to activeNode.
        //* @param {string} [context.managerConfig.activeSelection=[]] - paths to selected nodes.
        //* @param {string} context.managerConfig.commit - commit hash to start the plugin from.
        //* @param {string} context.managerConfig.branchName - branch which to save to.
        //* @param {object} [context.pluginConfig=%defaultForPlugin%] - specific configuration for the plugin.
        //* @param {function} callback
        client.runServerPlugin(pluginId, context, function (err, pluginResult) {
            expect(err).to.equal(null);
            expect(pluginResult).not.to.equal(null);
            expect(pluginResult.success).to.equal(true, 'PluginGenerator did not succeed on server!');
            expect(pluginResult.commits.length).to.equal(1);
            expect(pluginResult.commits[0].branchName).to.equal('master');
            expect(pluginResult.commits[0].status).to.equal(client.CONSTANTS.STORAGE.SYNCED);
            done();
        });
    });

    it('should run MinimalWorkingExample in client and update the client', function (done) {
        var pluginId = 'MinimalWorkingExample',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'MinimalWorkingExample1',
                },
                pluginConfig: {}
            },
            prevStatus,
            eventHandler,
            wasNotified = false,
            removeHandler = function () {
                client.removeEventListener(client.CONSTANTS.BRANCH_STATUS_CHANGED, eventHandler);
            };

        function notificationHandler(_client, data) {
            wasNotified = true;
            client.removeEventListener(client.CONSTANTS.PLUGIN_NOTIFICATION, notificationHandler);

            try {
                expect(data.type).to.equal(client.CONSTANTS.PLUGIN_NOTIFICATION);
                expect(data.pluginId).to.equal(pluginId);
                expect(data.notification.message).to.include('A plugin notification');
                expect(data.notification.severity).to.equal('info');
            } catch (e) {
                done(e);
            }
        }

        client.addEventListener(client.CONSTANTS.PLUGIN_NOTIFICATION, notificationHandler);

        currentBranchName = 'MinimalWorkingExample1';

        eventHandler = function (__client, eventData) {
            try {
                if (prevStatus === client.CONSTANTS.BRANCH_STATUS.SYNC) {
                    expect(eventData.status).to.equal(client.CONSTANTS.BRANCH_STATUS.AHEAD_SYNC);
                    prevStatus = eventData.status;
                } else if (prevStatus === client.CONSTANTS.BRANCH_STATUS.AHEAD_SYNC) {
                    expect(eventData.status).to.equal(client.CONSTANTS.BRANCH_STATUS.SYNC);
                    removeHandler();
                    currentBranchHash = client.getActiveCommitHash();
                    //done();
                } else {
                    throw new Error('Unexpected BranchStatus ' + eventData.status);
                }
            } catch (e) {
                removeHandler();
                done(e);
            }
        };

        createSelectBranch(currentBranchName, function (err) {
            try {
                expect(err).to.equal(null);

                prevStatus = client.getBranchStatus();
                expect(prevStatus).to.equal(client.CONSTANTS.BRANCH_STATUS.SYNC);
                client.addEventListener(client.CONSTANTS.BRANCH_STATUS_CHANGED, eventHandler);

                context.managerConfig.commitHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runBrowserPlugin(pluginId, context, function (err, pluginResult) {
                try {
                    expect(err).to.equal(null);
                    expect(pluginResult).not.to.equal(null);
                    expect(pluginResult.success).to.equal(true, 'MinimalWorkingExample did not succeed');
                    expect(pluginResult.commits.length).to.equal(2);
                    expect(pluginResult.commits[0].branchName).to.equal('MinimalWorkingExample1');
                    expect(pluginResult.commits[0].status).to.equal(client.CONSTANTS.STORAGE.SYNCED);
                    expect(pluginResult.commits[1].branchName).to.include('MinimalWorkingExample1');
                    expect(pluginResult.commits[1].status).to.equal(client.CONSTANTS.STORAGE.SYNCED);
                } catch (e) {
                    return done(e);
                }

                client.getBranches(projectId, function (err, branches) {
                    try {
                        expect(err).to.equal(null);
                        // console.log(branches);
                        // expect(Object.keys(branches).length).to.equal(2);
                        expect(branches).to.include.keys(['master', 'MinimalWorkingExample1']);
                        if (!wasNotified) {
                            throw new Error('Was never notified from plugin.');
                        }
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it('should run MinimalWorkingExample on the server and return results even though it failed', function (done) {
        var pluginId = 'MinimalWorkingExample',
            wasNotified = false,
            context = {
                managerConfig: {
                    project: client.getActiveProjectId(),
                    activeNode: '',
                    activeSelection: [],
                    commit: client.getActiveCommitHash(),
                    branchName: 'master'
                },
                pluginConfig: {
                    save: false,
                    shouldFail: true
                }
            };

        function notificationHandler(_client, data) {
            wasNotified = true;
            client.removeEventListener(client.CONSTANTS.PLUGIN_NOTIFICATION, notificationHandler);

            try {
                expect(data.type).to.equal(client.CONSTANTS.PLUGIN_NOTIFICATION);
                expect(data.pluginId).to.equal(pluginId);
                expect(data.notification.message).to.include('A plugin notification');
            } catch (e) {
                done(e);
            }
        }

        client.addEventListener(client.CONSTANTS.PLUGIN_NOTIFICATION, notificationHandler);

        client.runServerPlugin(pluginId, context, function (err, pluginResult) {
            try {
                expect(err instanceof Error).to.equal(true);
                expect(err.message).to.include('Failed on purpose');
                expect(pluginResult).to.have.keys(['artifacts', 'commits', 'error', 'finishTime', 'messages',
                    'pluginName', 'pluginId', 'projectId', 'startTime', 'success']);
                expect(pluginResult.success).to.equal(false);
                if (!wasNotified) {
                    throw new Error('Was never notified from plugin.');
                }
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('should fork when client made changes after invocation', function (done) {
        var pluginId = 'PluginForked',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'PluginForked1'
                },
                pluginConfig: {
                    timeout: 200,
                    forkName: 'PluginForked1Fork'
                }
            },
            branchName = 'PluginForked1';

        createSelectBranch(branchName, function (err) {
            expect(err).to.equal(null);

            var loaded = false,
                userGuid;

            function nodeEventHandler(events) {
                if (loaded) {
                    done(new Error('More than one event'));
                } else {
                    loaded = true;
                    expect(events.length).to.equal(2);
                    client.removeUI(userGuid);
                    client.setAttribute('', 'name', 'PluginForkedNameFromClient', 'conflicting change');

                    setTimeout(function () {
                        // console.log('ACH', client.getActiveCommitHash());
                        // console.log('context hash', context.managerConfig.commit);
                        client.runBrowserPlugin(pluginId, context, function (err, pluginResult) {
                            expect(pluginResult).not.to.equal(null);
                            expect(pluginResult.success).to.equal(true, 'PluginForked did not succeed.');
                            // console.log(JSON.stringify(pluginResult.commits, null, 2));
                            expect(pluginResult.commits.length).to.equal(2);
                            expect(pluginResult.commits[0].status).to.equal(client.CONSTANTS.STORAGE.SYNCED);
                            expect(pluginResult.commits[0].branchName).to.equal(branchName);
                            expect(pluginResult.commits[1].status).to.equal(client.CONSTANTS.STORAGE.FORKED);
                            expect(pluginResult.commits[1].branchName).to.equal('PluginForked1Fork');
                            client.getBranches(projectId, function (err, branches) {
                                expect(err).to.equal(null);

                                expect(Object.keys(branches).length).to.equal(3);
                                expect(branches).to.include.keys('master', branchName, 'PluginForked1Fork');
                                client.deleteBranch(projectId, 'PluginForked1Fork',
                                    branches.PluginForked1Fork, function (err) {
                                        expect(err).to.equal(null);

                                        client.selectBranch('master', null, function (err) {
                                            expect(err).to.equal(null);

                                            client.deleteBranch(projectId, branchName, branches[branchName],
                                                function (err) {
                                                    expect(err).to.equal(null);

                                                    done();
                                                }
                                            );
                                        });
                                    }
                                );
                            });
                        });
                    });
                }
            }

            context.managerConfig.commitHash = client.getActiveCommitHash();
            userGuid = client.addUI({}, nodeEventHandler);
            client.updateTerritory(userGuid, {'': {children: 0}});
        });
    });

    // TODO: setBranchHash called with an open branch does no longer count as an external change..
    it.skip('should fork with client when external changes are made', function (done) {
        var name = 'PluginForked',
            interpreterManager = new InterpreterManager(client, gmeConfig),
            silentPluginCfg = {
                activeNode: '',
                activeSelection: [],
                runOnServer: false,
                pluginConfig: {
                    fork: true, // This will inject changes to the branch
                    forkName: 'PluginForked2Fork'
                }
            },
            branchName = 'PluginForked2';

        createSelectBranch(branchName, function (err) {
            expect(err).to.equal(null);

            //* @param {string} name - name of plugin to be executed.
            //* @param {object} silentPluginCfg - if falsy dialog window will be shown.
            //* @param {object.string} silentPluginCfg.activeNode - Path to activeNode.
            //* @param {object.Array.<string>} silentPluginCfg.activeSelection - Paths to nodes in activeSelection.
            //* @param {object.boolean} silentPluginCfg.runOnServer - Whether to run the plugin on the server or not.
            //* @param {object.object} silentPluginCfg.pluginConfig - Plugin specific options.
            client.startTransaction('starting');
            interpreterManager.run(name, silentPluginCfg, function (pluginResult) {
                expect(pluginResult).not.to.equal(null);

                expect(pluginResult.success).to.equal(true, 'PluginForked did not succeed.');
                expect(pluginResult.commits.length).to.equal(2);
                expect(pluginResult.commits[0].branchName).to.equal('PluginForked2');
                expect(pluginResult.commits[0].status).to.equal(client.CONSTANTS.STORAGE.SYNCED);
                expect(pluginResult.commits[1].branchName).to.equal('PluginForked2Fork');
                expect(pluginResult.commits[1].status).to.equal(client.CONSTANTS.STORAGE.FORKED);
                client.completeTransaction('stopping');
                client.getBranches(projectId, function (err, branches) {
                    expect(err).to.equal(null);

                    expect(Object.keys(branches).length).to.equal(3);
                    expect(branches).to.include.keys('master', branchName, 'PluginForked2Fork');
                    client.deleteBranch(projectId, 'PluginForked2Fork', branches.PluginForked2Fork, function (err) {
                        expect(err).to.equal(null);

                        client.selectBranch('master', null, function (err) {
                            expect(err).to.equal(null);

                            client.deleteBranch(projectId, branchName, branches[branchName], function (err) {
                                expect(err).to.equal(null);

                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    it('should abort the plugin execution', function (done) {
        var pluginId = 'AbortPlugin',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'master',
                },
                pluginConfig: {
                    shouldAbort: true
                }
            },
            prevStatus;


        WebGMEGlobal.Client = client;

        createSelectBranch('master', function (err) {
            try {
                expect(err).to.equal(null);

                prevStatus = client.getBranchStatus();
                expect(prevStatus).to.equal(client.CONSTANTS.BRANCH_STATUS.SYNC);

                context.managerConfig.commitHash = client.getActiveCommitHash();
                currentBranchHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runBrowserPlugin(pluginId, context, function (err, pluginResult) {
                try {
                    expect(err).not.to.equal(null);
                    expect(err).to.contains('Execution was aborted');
                    expect(pluginResult).not.to.equal(null);
                } catch (e) {
                    return done(e);
                }

                return done();
            });
        });
    });

    it('should abort the plugin execution when listening to client events', function (done) {
        var pluginId = 'WaitPlugin',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'master',
                },
                pluginConfig: {
                    shouldAbort: true
                }
            },
            initiatedEvent = function (emitter, event) {
                client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
                var plugins = client.getRunningPlugins(),
                    executionIds = Object.keys(plugins);

                expect(executionIds).to.have.length(1);
                expect(emitter).not.to.eql(null);
                expect(event.context.managerConfig.project).to.eql(projectId);
                expect(plugins[executionIds[0]]).to.eql(event);
                client.abortPlugin(executionIds[0]);
            };


        WebGMEGlobal.Client = client;

        client.addEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
        createSelectBranch('master', function (err) {
            try {
                expect(err).to.equal(null);

                context.managerConfig.commitHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runBrowserPlugin(pluginId, context, function (err, pluginResult) {
                try {
                    expect(err).not.to.equal(null);
                    expect(pluginResult).not.to.equal(null);
                } catch (e) {
                    return done(e);
                }

                return done();
            });
        });
    });

    it('should abort be possible with multiple plugins running', function (done) {
        var pluginId = 'WaitPlugin',
            abortedId,
            returnProcessed = 2,
            numOfPlugins = 2,
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'master',
                },
                pluginConfig: {
                    shouldAbort: true
                }
            },
            initiatedEvent = function (emitter, event) {
                if (--numOfPlugins === 0) {
                    client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
                    client.abortPlugin(event.executionId);
                } else {
                    var plugins = client.getRunningPlugins(),
                        executionIds = Object.keys(plugins);

                    expect(executionIds).to.have.length(2);
                    expect(emitter).not.to.eql(null);
                    expect(event.context.managerConfig.project).to.eql(projectId);
                    expect(plugins[event.executionId]).to.eql(event);
                }

            };


        WebGMEGlobal.Client = client;

        client.addEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
        createSelectBranch('master', function (err) {
            try {
                expect(err).to.equal(null);

                context.managerConfig.commitHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runBrowserPlugin(pluginId, context, function (err, pluginResult) {
                try {
                    expect(err).to.equal(null);
                    expect(pluginResult).not.to.equal(null);
                } catch (e) {
                    return done(e);
                }

                if (--returnProcessed == 0) {
                    return done();
                }
            });

            client.runBrowserPlugin(pluginId, context, function (err, pluginResult) {
                try {
                    expect(err).not.to.equal(null);
                    expect(pluginResult).not.to.equal(null);
                } catch (e) {
                    return done(e);
                }

                if (--returnProcessed == 0) {
                    return done();
                }
            });
        });
    });

    it('should abort the server plugin execution', function (done) {
        var pluginId = 'WaitPlugin',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'master',
                },
                pluginConfig: {
                    shouldAbort: true
                }
            },
            initiatedEvent = function (emitter, event) {
                client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
                var plugins = client.getRunningPlugins(),
                    executionIds = Object.keys(plugins);

                expect(executionIds).to.have.length(1);
                expect(emitter).not.to.eql(null);
                expect(event.context.managerConfig.project).to.eql(projectId);
                client.abortPlugin(executionIds[0]);
            };


        WebGMEGlobal.Client = client;

        client.addEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
        createSelectBranch('master', function (err) {
            try {
                expect(err).to.equal(null);

                context.managerConfig.commitHash = client.getActiveCommitHash();
                // currentBranchHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runServerPlugin(pluginId, context, function (err, pluginResult) {
                try {
                    expect(err).not.to.equal(null);
                    // expect(err.message).to.contains('Execution was aborted');
                    // console.log(err);
                    expect(pluginResult).not.to.equal(null);
                } catch (e) {
                    return done(e);
                }

                return done();
            });
        });
    });

    it('should be able to send message to a plugin', function (done) {
        var pluginId = 'WaitPlugin',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'master',
                },
                pluginConfig: {}
            },
            messageReceived = false,
            prevStatus,
            notificationHandler = function (sender, event) {
                client.removeEventListener(client.CONSTANTS.PLUGIN_NOTIFICATION, notificationHandler);
                expect(event).not.to.eql(null);
                expect(event.type).to.equal(client.CONSTANTS.PLUGIN_NOTIFICATION);
                expect(event.notification).to.eql({msgType: 'what', msgData: 'not'});
                messageReceived = true;
            },
            initiatedHandler = function (sender, event) {
                expect(sender).not.to.eql(null);
                expect(event.context.managerConfig.project).to.eql(projectId);
                client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedHandler);
                client.sendMessageToPlugin(event.executionId, 'what', 'not');
            };


        // WebGMEGlobal.Client = client;

        client.addEventListener(client.CONSTANTS.PLUGIN_NOTIFICATION, notificationHandler);
        client.addEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedHandler);
        createSelectBranch('master', function (err) {
            try {
                expect(err).to.equal(null);

                prevStatus = client.getBranchStatus();
                expect(prevStatus).to.equal(client.CONSTANTS.BRANCH_STATUS.SYNC);

                context.managerConfig.commitHash = client.getActiveCommitHash();
                currentBranchHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runBrowserPlugin(pluginId, context, function (err/*, pluginResult*/) {
                try {
                    expect(err).to.equal(null);
                    expect(messageReceived).to.equal(true);
                } catch (e) {
                    return done(e);
                }

                return done();
            });
        });
    });

    it('should be able to send message to a server plugin', function (done) {
        var pluginId = 'WaitPlugin',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'master',
                },
                pluginConfig: {}
            },
            messageReceived = false,
            prevStatus,
            notificationHandler = function (sender, event) {
                client.removeEventListener(client.CONSTANTS.PLUGIN_NOTIFICATION, notificationHandler);
                expect(event).not.to.eql(null);
                expect(event.type).to.equal(client.CONSTANTS.PLUGIN_NOTIFICATION);
                expect(event.notification).to.eql({msgType: 'what', msgData: 'not'});
                messageReceived = true;
            },
            initiatedHandler = function (sender, event) {
                client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedHandler);
                client.sendMessageToPlugin(event.executionId, 'what', 'not');
            };


        // WebGMEGlobal.Client = client;

        client.addEventListener(client.CONSTANTS.PLUGIN_NOTIFICATION, notificationHandler);
        client.addEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedHandler);
        createSelectBranch('master', function (err) {
            try {
                expect(err).to.equal(null);

                prevStatus = client.getBranchStatus();
                expect(prevStatus).to.equal(client.CONSTANTS.BRANCH_STATUS.SYNC);

                context.managerConfig.commitHash = client.getActiveCommitHash();
                currentBranchHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runServerPlugin(pluginId, context, function (err/*, pluginResult*/) {
                try {
                    expect(err).to.equal(null);
                    expect(messageReceived).to.equal(true);
                } catch (e) {
                    return done(e);
                }

                return done();
            });
        });
    });

    it('should receive all plugin events in order when executing plugin on the client side', function (done) {
        var pluginId = 'WaitPlugin',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'master',
                },
                pluginConfig: {
                    shouldAbort: true
                }
            },
            events = [],
            initiatedEvent = function (/*emitter, event*/) {
                // client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
                // console.log('emitter:', emitter);
                events.push(client.CONSTANTS.PLUGIN_INITIATED);
            },
            finishedEvent = function (/*emitter, event*/) {
                // client.removeEventListener(client.CONSTANTS.PLUGIN_FINISHED, finishedEvent);
                events.push(client.CONSTANTS.PLUGIN_FINISHED);

            };


        WebGMEGlobal.Client = client;

        client.addEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
        client.addEventListener(client.CONSTANTS.PLUGIN_FINISHED, finishedEvent);
        createSelectBranch('master', function (err) {
            try {
                expect(err).to.equal(null);

                context.managerConfig.commitHash = client.getActiveCommitHash();
                // currentBranchHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runBrowserPlugin(pluginId, context, function (err, pluginResult) {
                try {
                    client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
                    client.removeEventListener(client.CONSTANTS.PLUGIN_FINISHED, finishedEvent);
                    expect(err).to.equal(null);
                    expect(pluginResult).not.to.equal(null);
                    expect(events).to.eql([client.CONSTANTS.PLUGIN_INITIATED, client.CONSTANTS.PLUGIN_FINISHED]);
                } catch (e) {
                    return done(e);
                }

                return done();
            });
        });
    });

    it('should receive all plugin events in order when executing plugin on the server side', function (done) {
        var pluginId = 'WaitPlugin',
            context = {
                managerConfig: {
                    project: client.getProjectObject(),
                    activeNode: '',
                    activeSelection: [],
                    commit: null,
                    branchName: 'master',
                },
                pluginConfig: {
                    shouldAbort: true
                }
            },
            events = [],
            initiatedEvent = function (/*emitter, event*/) {
                // client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
                // console.log('emitter:', emitter);
                events.push(client.CONSTANTS.PLUGIN_INITIATED);
            },
            finishedEvent = function (/*emitter, event*/) {
                // client.removeEventListener(client.CONSTANTS.PLUGIN_FINISHED, finishedEvent);
                events.push(client.CONSTANTS.PLUGIN_FINISHED);

            };


        WebGMEGlobal.Client = client;

        client.addEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
        client.addEventListener(client.CONSTANTS.PLUGIN_FINISHED, finishedEvent);
        createSelectBranch('master', function (err) {
            try {
                expect(err).to.equal(null);

                context.managerConfig.commitHash = client.getActiveCommitHash();
                // currentBranchHash = client.getActiveCommitHash();
            } catch (e) {
                done(e);
                return;
            }

            client.runServerPlugin(pluginId, context, function (err, pluginResult) {
                try {
                    client.removeEventListener(client.CONSTANTS.PLUGIN_INITIATED, initiatedEvent);
                    client.removeEventListener(client.CONSTANTS.PLUGIN_FINISHED, finishedEvent);
                    expect(err).to.equal(null);
                    expect(pluginResult).not.to.equal(null);
                    expect(events).to.eql([client.CONSTANTS.PLUGIN_INITIATED, client.CONSTANTS.PLUGIN_FINISHED]);
                } catch (e) {
                    return done(e);
                }

                return done();
            });
        });
    });
});
