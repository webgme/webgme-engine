/*eslint-env node, mocha*/

/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../_globals.js');

describe.only('Worker Requests', function () {
    'use strict';

    var gmeConfig = testFixture.getGmeConfig(),
        WebGME = testFixture.WebGME,
        Q = testFixture.Q,
        expect = testFixture.expect,
        BlobClient = require('./../../../src/server/middleware/blob/BlobClientWithFSBackend'),
        logger,
        WorkerRequests = require('./../../../src/server/worker/workerrequests'),
        wr,
        blobClient,
        ir,
        gmeAuth,
        safeStorage;


    before(function (done) {
        logger = testFixture.logger.fork('Worker_Requests');
        blobClient = new BlobClient(gmeConfig, logger.fork('BlobClient'));
        //gmeConfig.socketIO.clientOptions.transports = ['websocket'];


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
                        projectName: 'Test__WorkerRequests',
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
                return safeStorage.closeDatabase();
            })
            .then(function () {
                return gmeAuth.unload();
            })
            .nodeify(done);
    });

    beforeEach(function (done) {
        testFixture.rimraf(gmeConfig.blob.fsDir, done);
    });

    it('should _addZippedExportToBlob when using compressed DEFLATE', function (done) {
        var metaHash = 'b1f1f11201951f23b0d0c86d6c298389b3f8f0c0',
            wr = new WorkerRequests(logger, gmeConfig);
        wr._addZippedExportToBlob('./test/server/worker/workerrequests/exported.zip', blobClient)
            .then(function (/*projectStr*/) {
                return Q.ninvoke(blobClient, 'getMetadata', metaHash);
            })
            .then(function (metadata) {
                expect(metadata.name).to.equal('a.txt');
            })
            .nodeify(done);
    });

    it('should _addZippedExportToBlob when using no compression (as exported)', function (done) {
        var metaHash = 'b1f1f11201951f23b0d0c86d6c298389b3f8f0c0',
            wr = new WorkerRequests(logger, gmeConfig);
        wr._addZippedExportToBlob('./test/server/worker/workerrequests/asExported.zip', blobClient)
            .then(function (/*projectStr*/) {
                return Q.ninvoke(blobClient, 'getMetadata', metaHash);
            })
            .then(function (metadata) {
                expect(metadata.name).to.equal('a.txt');
            })
            .nodeify(done);
    });

    // Disconnections

    it('should run plugin execution connecting to server', function (done) {
        var server = WebGME.standaloneServer(gmeConfig),
            wr = new WorkerRequests(logger, gmeConfig);

        Q.ninvoke(server, 'start')
            .then(function () {
                var deferred = Q.defer();

                wr.executePlugin(null, null, 'PluginForked', {
                    managerConfig: {
                        project: ir.project.projectId,
                        activeNode: '',
                        branchName: 'b1'
                    }
                }, function (err/*, result*/) {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve();
                    }
                });

                return deferred.promise;
            })
            .finally(function (err) {
                server.stop(function () {
                    done(err);
                });
            });
    });
});