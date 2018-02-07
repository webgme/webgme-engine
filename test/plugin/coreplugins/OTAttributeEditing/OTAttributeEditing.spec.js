/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */


describe('OTAttributeEditing Plugin', function () {
    'use strict';

    var testFixture = require('../../../_globals');

    var WorkerRequests = require('../../../../src/server/worker/workerrequests'),
        gmeConfig = testFixture.getGmeConfig(),
        Q = testFixture.Q,
        WebGME = testFixture.WebGME,
        expect = testFixture.expect,
        logger = testFixture.logger.fork('watchers.spec'),
        projectName = 'OTAttributeEditingPlugin',
        ot = require('webgme-ot'),
        server,
        wr,
        ir,
        gmeAuth,
        safeStorage;

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
                ir = result[0];
                return Q.allDone([
                    ir.project.createBranch('b1', ir.commitHash),
                    ir.project.createBranch('b2', ir.commitHash),
                    ir.project.createBranch('b3', ir.commitHash)
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
            Q.ninvoke(server, 'stop')
        ]).nodeify(done);
    });

    it('should run the plugin and succeed', function (done) {
        var context = {
            managerConfig: {
                project: ir.project.projectId,
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

    it('should run the plugin and send operations to other watcher', function (done) {
        var context = {
                managerConfig: {
                    project: ir.project.projectId,
                    branchName: 'b2'
                },
                pluginConfig: {
                    interval: 20,
                    cycles: 10
                }
            },
            storage = testFixture.getConnectedStorage(gmeConfig, logger),
            connProject,
            docId,
            watcherId,
            doc;

        function atOperation(op) {
            doc = op.apply(doc);
        }

        function atSelection() {

        }

        Q.ninvoke(storage, 'openProject', ir.project.projectId)
            .then(function (res) {
                connProject = res[0];

                return connProject.watchDocument({
                    branchName: 'b2',
                    nodeId: '/1',
                    attrName: 'otAttr',
                    attrValue: ''
                }, atOperation, atSelection);

            })
            .then(function (res) {
                doc = res.document;
                docId = res.docId;
                watcherId = res.watcherId;
                return Q.ninvoke(wr, 'executePlugin', null, null, 'OTAttributeEditing', context);
            })
            .then(function (res) {
                expect(res.success).to.equal(true);
                expect(res.commits.length).to.equal(2);

                return testFixture.loadRootNodeFromCommit(ir.project, ir.core, res.commits[1].commitHash);
            })
            .then(function (newRoot) {
                var fco = ir.core.getFCO(newRoot),
                    attr = ir.core.getAttribute(fco, 'otAttr');

                expect(attr).to.equal(doc);
                expect((attr.match(/This is output nr/g) || []).length).to.equal(context.pluginConfig.cycles);

                return connProject.unwatchDocument({docId: docId, watcherId: watcherId});
            })
            .then(function () {
                return Q.ninvoke(storage, 'close');
            })
            .nodeify(done);
    });

    it('should run the plugin and accept operations from other watcher', function (done) {
        var context = {
                managerConfig: {
                    project: ir.project.projectId,
                    branchName: 'b3'
                },
                pluginConfig: {
                    interval: 20,
                    cycles: 10
                }
            },
            storage = testFixture.getConnectedStorage(gmeConfig, logger),
            cnt = 0,
            connProject,
            docId,
            watcherId,
            doc;

        function atOperation(op) {
            var newText = '\nAdded by test watcher ' + cnt,
                newOperation;
            cnt += 1;
            doc = op.apply(doc);
            // Add some text at the start
            // we need a counter since operations can come batched from the plugin.
            // Create the operation that appends the newText to the document.
            newOperation = new ot.TextOperation()
                .insert(newText)         //  Insert newText at the beginning
                .retain(doc.length);     //  and retain the current length.

            doc = newText + doc;

            setTimeout(function () {
                connProject.sendDocumentOperation({
                    docId: docId,
                    watcherId: watcherId,
                    operation: newOperation
                });
            });
        }

        function atSelection() {

        }

        Q.ninvoke(storage, 'openProject', ir.project.projectId)
            .then(function (res) {
                connProject = res[0];

                return connProject.watchDocument({
                    branchName: 'b3',
                    nodeId: '/1',
                    attrName: 'otAttr',
                    attrValue: ''
                }, atOperation, atSelection);

            })
            .then(function (res) {
                doc = res.document;
                docId = res.docId;
                watcherId = res.watcherId;
                return Q.ninvoke(wr, 'executePlugin', null, null, 'OTAttributeEditing', context);
            })
            .then(function (res) {
                expect(res.success).to.equal(true);
                expect(res.commits.length).to.equal(2);

                return testFixture.loadRootNodeFromCommit(ir.project, ir.core, res.commits[1].commitHash);
            })
            .then(function (newRoot) {
                var fco = ir.core.getFCO(newRoot),
                    attr = ir.core.getAttribute(fco, 'otAttr');

                expect(attr).to.equal(doc);
                expect((attr.match(/This is output nr/g) || []).length).to.equal(context.pluginConfig.cycles);
                expect((attr.match(/Added by test watcher/g) || []).length).to.equal(cnt);

                return connProject.unwatchDocument({docId: docId, watcherId: watcherId});
            })
            .then(function () {
                return Q.ninvoke(storage, 'close');
            })
            .nodeify(done);
    });
});