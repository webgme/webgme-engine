/*eslint-env node, mocha*/

/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../_globals.js'),
    AdmZip = require('adm-zip');

describe('Serialization history io', function () {
    'use strict';

    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        logger = testFixture.logger.fork('SerializationHistoryIO'),
        projectName = 'serializationHistoryIO',
        serialization = testFixture.requirejs('common/util/serialization'),
        CONSTANTS = testFixture.requirejs('common/storage/constants'),
        project,
        gmeAuth,
        storage,
        blobClient,
        masterCommitHash,
        featureCommitHash,
        rootHash,
        setupFailed = false;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                return testFixture.importProject(storage, {
                    projectSeed: './seeds/EmptyProject.webgmex',
                    projectName: projectName,
                    branchName: 'master',
                    logger: logger,
                    gmeConfig: gmeConfig,
                    kind: 'serializationKind'
                });
            })
            .then(function (importResult) {
                project = importResult.project;
                blobClient = importResult.blobClient;
                rootHash = importResult.rootHash;

                return project.makeCommit('master', [importResult.commitHash], rootHash,
                    {}, 'second commit on master');
            })
            .then(function (masterCommit) {
                masterCommitHash = masterCommit.hash;
                return project.createBranch('feature', masterCommitHash);
            })
            .then(function () {
                return project.makeCommit('feature', [masterCommitHash], rootHash, {}, 'commit on feature');
            })
            .then(function (featureCommit) {
                featureCommitHash = featureCommit.hash;
            })
            .nodeify(function (err) {
                if (err) {
                    setupFailed = true;
                }
                done(err);
            });
    });

    after(function (done) {
        if (!storage) {
            done();
            return;
        }

        storage.closeDatabase()
            .then(function () {
                if (gmeAuth) {
                    return gmeAuth.unload();
                }
            })
            .nodeify(done);
    });

    beforeEach(function () {
        if (setupFailed) {
            throw new Error('Skipping tests because project setup failed (is MongoDB running?)');
        }
    });

    it('should reject export with history when withAssets is false', function (done) {
        serialization.exportProjectToFile(project, blobClient, {
            branchName: 'master',
            withHistory: true,
            withAssets: false
        })
            .then(function () {
                throw new Error('should have failed');
            })
            .catch(function (err) {
                expect(err.message).to.contain('Export with history requires withAssets');
            })
            .nodeify(done);
    });

    it('should export v2 repository json when withHistory and withAssets are true', function (done) {
        serialization.exportProjectToFile(project, blobClient, {
            branchName: 'master',
            withHistory: true,
            withAssets: true
        })
            .then(function (result) {
                expect(result.hash).to.be.a('string');
                return blobClient.getObject(result.hash);
            })
            .then(function (buffer) {
                var zip = new AdmZip(buffer),
                    projectJson = JSON.parse(zip.readAsText('project.json', 'utf8'));

                expect(projectJson.formatVersion).to.equal(CONSTANTS.PROJECT_JSON_FORMAT_VERSION);
                expect(projectJson.exportMode).to.equal(CONSTANTS.REPOSITORY_EXPORT_MODE);
                expect(projectJson.branches).to.deep.equal({
                    master: masterCommitHash,
                    feature: featureCommitHash
                });
                expect(projectJson.commits.length).to.be.at.least(2);
            })
            .nodeify(done);
    });

    it('should export v1 snapshot when withHistory is false', function (done) {
        serialization.exportProjectToFile(project, blobClient, {
            branchName: 'master',
            withAssets: true
        })
            .then(function (result) {
                return blobClient.getObject(result.hash);
            })
            .then(function (buffer) {
                var zip = new AdmZip(buffer),
                    projectJson = JSON.parse(zip.readAsText('project.json', 'utf8'));

                expect(projectJson.formatVersion).to.equal(undefined);
                expect(projectJson.exportMode).to.equal(undefined);
                expect(Object.hasOwn(projectJson, 'commits')).to.equal(false);
            })
            .nodeify(done);
    });
});
