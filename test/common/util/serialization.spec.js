/*eslint-env node, mocha*/
/*eslint no-bitwise: 0, max-len: 0*/
/**
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('../../_globals.js');

describe('Serialization', function () {
    'use strict';
    var exports = testFixture.requirejs('common/util/serialization'),
        gmeConfig = testFixture.getGmeConfig(),
        projectName = 'SerializationSpec',
        projectId = testFixture.projectName2Id(projectName),
        fs = require('fs'),
        AdmZip = require('adm-zip'),
        project,
        core,
        rootNode,
        logger = testFixture.logger.fork('serialization.spec'),
        BlobClient = testFixture.getBlobTestClient(),
        bc = new BlobClient(gmeConfig, logger, {}),
        superagent = testFixture.superagent,
        Q = testFixture.Q,
        expect = testFixture.expect,
        storage,
        gmeAuth;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                return testFixture.importProject(storage, {
                    projectSeed: 'seeds/ActivePanels.webgmex',
                    projectName: projectName,
                    branchName: 'base',
                    gmeConfig: gmeConfig,
                    logger: logger
                });
            })
            .then(function (result) {
                project = result.project;
                core = result.core;
                rootNode = result.rootNode;
            })
            .nodeify(done);
    });

    it('should export a single data object by default', function (done) {
        exports.exportProjectToFile(project, bc, {rootHash: core.getHash(rootNode)})
            .then(function (result) {
                expect(result).not.to.eql(null);
                console.log(result);

                return bc.getObject(result.hash);
            })
            .then(function (zipObj) {
                fs.writeFileSync('test-tmp/ser_tc_001.zip', zipObj);
                var zip = new AdmZip('test-tmp/ser_tc_001.zip'),
                    projectJson = JSON.parse(zip.readAsText('project.json'));

                expect(projectJson).to.include.keys(['objects', 'projectId']);
                expect(projectJson.projectId).to.equal(projectId);
                expect(projectJson.objects).to.have.length(17);

                fs.unlinkSync('test-tmp/ser_tc_001.zip');
            })
            .nodeify(done);
    });

    it('should export multiple data chunks according to parameters', function (done) {
        exports.exportProjectToFile(project, bc, {rootHash: core.getHash(rootNode), chunkSize: 10})
            .then(function (result) {
                expect(result).not.to.eql(null);
                console.log(result);

                return bc.getObject(result.hash);
            })
            .then(function (zipObj) {
                fs.writeFileSync('test-tmp/ser_tc_002.zip', zipObj);
                var zip = new AdmZip('test-tmp/ser_tc_002.zip'),
                    projectJson = JSON.parse(zip.readAsText('project.json'));

                expect(projectJson).to.include.keys(['objects', 'projectId']);
                expect(projectJson.projectId).to.equal(projectId);
                expect(projectJson.objects).to.have.length(10);

                projectJson = JSON.parse(zip.readAsText('data_1.json'));
                expect(projectJson).to.have.length(7);

                fs.unlinkSync('test-tmp/ser_tc_002.zip');
            })
            .nodeify(done);
    });

    it('should export single data  if chunk size is big enough', function (done) {
        exports.exportProjectToFile(project, bc, {rootHash: core.getHash(rootNode), chunkSize: 17})
            .then(function (result) {
                expect(result).not.to.eql(null);
                console.log(result);

                return bc.getObject(result.hash);
            })
            .then(function (zipObj) {
                fs.writeFileSync('test-tmp/ser_tc_003.zip', zipObj);
                var zip = new AdmZip('test-tmp/ser_tc_003.zip'),
                    projectJson = JSON.parse(zip.readAsText('project.json'));

                expect(projectJson).to.include.keys(['objects', 'projectId']);
                expect(projectJson.projectId).to.equal(projectId);
                expect(projectJson.objects).to.have.length(17);

                fs.unlinkSync('test-tmp/ser_tc_003.zip');
            })
            .nodeify(done);
    });

    it('should export multiple data chunks for extra small chunk size', function (done) {
        exports.exportProjectToFile(project, bc, {rootHash: core.getHash(rootNode), chunkSize: 1})
            .then(function (result) {
                expect(result).not.to.eql(null);
                console.log(result);

                return bc.getObject(result.hash);
            })
            .then(function (zipObj) {
                fs.writeFileSync('test-tmp/ser_tc_004.zip', zipObj);
                var zip = new AdmZip('test-tmp/ser_tc_004.zip'),
                    projectJson = JSON.parse(zip.readAsText('project.json')),
                    i;

                expect(projectJson).to.include.keys(['objects', 'projectId']);
                expect(projectJson.projectId).to.equal(projectId);
                expect(projectJson.objects).to.have.length(1);

                for (i = 1; i < 17; i += 1) {
                    projectJson = JSON.parse(zip.readAsText('data_' + i + '.json'));
                    expect(projectJson).to.have.length(1);
                }

                fs.unlinkSync('test-tmp/ser_tc_004.zip');
            })
            .nodeify(done);
    });

});
