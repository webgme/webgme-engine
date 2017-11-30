/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */


describe('OTAttributeEditing Plugin', function () {
    'use strict';

    var testFixture = require('../../../_globals');

    var WorkerRequests = require('../../../../src/server/worker/workerrequests'),
        STORAGE_CONSTANTS = testFixture.requirejs('common/storage/constants'),
        gmeConfig = testFixture.getGmeConfig(),
        Q = testFixture.Q,
        WebGME = testFixture.WebGME,
        expect = testFixture.expect,
        logger = testFixture.logger.fork('watchers.spec'),
        projectName = 'OTAttributeEditingPlugin',
        server,
        wr,
        gmeAuth,
        safeStorage,
        project;

    before(function (done) {
        gmeConfig.socketIO.clientOptions.transports = ['websocket'];
        wr = new WorkerRequests(logger, gmeConfig);

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                safeStorage = testFixture.getMongoStorage(logger, gmeConfig, gmeAuth);
                return safeStorage.openDatabase();
            })
            .then(function () {
                return Q.allDone([
                    testFixture.importProject(safeStorage, {
                        projectSeed: 'seeds/EmptyProject.webgmex',
                        projectName: projectName,
                        gmeConfig: gmeConfig,
                        logger: logger
                    })
                ]);
            })
            .then(function (result) {
                project = result[0].project;
                return Q.allDone([
                    project.createBranch('b1', result[0].commitHash),
                    project.createBranch('b2', result[0].commitHash)
                ]);
            })
            .then(function () {
                server = WebGME.standaloneServer(gmeConfig);
                return Q.allDone([
                    Q.ninvoke(server, 'start')
                ]);
            })
            .nodeify(done);
    });

    after(function (done) {
        Q.allDone([
            safeStorage.closeDatabase(),
            gmeAuth.unload(),
            server.stop()
        ]).nodeify(done);
    });

    it('should run the plugin and succeed', function (done) {
        var context = {
            managerConfig: {
                project: project.projectId,
                branchName: 'b1'
            },
            pluginConfig: {
                interval: 20,
                cycles: 10
            }
        };

        Q.ninvoke(wr, 'executePlugin', null, null, 'OTAttributeEditing', context)
            .then(function (res) {
                expect(res.success).to.equal(true);
                expect(res.commits.length).to.equal(2);
            })
            .nodeify(done);
    });

    // it('should run the plugin and send messages to other watcher', function (done) {
    //     var context = {
    //             managerConfig: {
    //                 project: project.projectId,
    //                 branchName: 'b2'
    //             },
    //             pluginConfig: {
    //                 interval: 20,
    //                 cycles: 10
    //             }
    //         },
    //         storage = testFixture.getConnectedStorage(gmeConfig, logger),
    //         project,
    //         doc;
    //
    //     function atOperation(op) {
    //
    //     }
    //
    //     function atSelection() {
    //
    //     }
    //
    //     Q.ninvoke(storage, 'openProject', project.projectId)
    //         .then(function (project_) {
    //             project = project_;
    //
    //             return project.watchDocument({
    //                 branchName: 'b2',
    //                 nodeId: '/1',
    //                 attrName: 'otAttr',
    //                 attrValue: ''
    //             }, atOperation, atSelection);
    //
    //         })
    //         .then(function (res) {
    //             doc = res.
    //             return Q.ninvoke(wr, 'executePlugin', null, null, 'OTAttributeEditing', context);
    //         })
    //         .then(function (res) {
    //             expect(res.success).to.equal(true);
    //             expect(res.commits.length).to.equal(2);
    //
    //             return project.unwatchDocument();
    //         })
    //         .nodeify(done);
    // });
});