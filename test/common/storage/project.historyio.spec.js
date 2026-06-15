/*eslint-env node, mocha*/

/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../_globals.js');

describe('Storage project history io', function () {
    'use strict';

    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        logger = testFixture.logger.fork('ProjectHistoryIO'),
        projectName = 'projectHistoryIO',
        storageUtil = testFixture.requirejs('common/storage/util'),
        CONSTANTS = testFixture.requirejs('common/storage/constants'),
        project,
        gmeAuth,
        storage,
        rootHash,
        initialCommitHash,
        masterCommitHash,
        featureCommitHash,
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
                    kind: 'historyKind'
                });
            })
            .then(function (importResult) {
                project = importResult.project;
                rootHash = importResult.rootHash;
                initialCommitHash = importResult.commitHash;

                return project.makeCommit('master', [initialCommitHash], rootHash, {}, 'second commit on master');
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
                return project.createTag('release-1', masterCommitHash);
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

    it('should export full repository metadata with v1 compatible fields', function (done) {
        storageUtil.getProjectWithHistory(project, {defaultBranchName: 'master'})
            .then(function (projectJson) {
                expect(projectJson.formatVersion).to.equal(CONSTANTS.PROJECT_JSON_FORMAT_VERSION);
                expect(projectJson.exportMode).to.equal(CONSTANTS.REPOSITORY_EXPORT_MODE);
                expect(projectJson.projectId).to.equal(project.projectId);
                expect(projectJson.kind).to.equal('historyKind');
                expect(projectJson.branchName).to.equal('master');
                expect(projectJson.commitHash).to.equal(masterCommitHash);
                expect(projectJson.rootHash).to.equal(rootHash);
                expect(projectJson.branches).to.deep.equal({
                    master: masterCommitHash,
                    feature: featureCommitHash
                });
                expect(projectJson.tags).to.deep.equal({
                    'release-1': masterCommitHash
                });
                expect(projectJson.commits.length).to.be.at.least(2);
                expect(projectJson.objects.length).to.be.at.least(projectJson.commits.length);
                expect(projectJson.hashes.objects.length).to.equal(projectJson.objects.length);
            })
            .nodeify(done);
    });

    it('should list all commits in chronological order', function (done) {
        storageUtil.getProjectWithHistory(project)
            .then(function (projectJson) {
                var commitIds = projectJson.commits.map(function (commit) {
                        return commit._id;
                    }),
                    i;

                expect(commitIds.indexOf(initialCommitHash)).to.be.at.least(0);
                expect(commitIds.indexOf(masterCommitHash)).to.be.at.least(0);
                expect(commitIds.indexOf(featureCommitHash)).to.be.at.least(0);

                for (i = 1; i < projectJson.commits.length; i += 1) {
                    expect(projectJson.commits[i].time).to.be.at.least(projectJson.commits[i - 1].time);
                }
            })
            .nodeify(done);
    });

    it('should roundtrip repository export into a new project', function (done) {
        var exportedJson,
            importProjectName = projectName + 'Import';

        storageUtil.getProjectWithHistory(project)
            .then(function (projectJson) {
                exportedJson = projectJson;
                return storage.createProject({
                    projectName: importProjectName,
                    username: gmeConfig.authentication.guestAccount
                });
            })
            .then(function (newProject) {
                return storageUtil.insertProjectWithHistory(newProject, exportedJson)
                    .then(function () {
                        return storageUtil.getProjectWithHistory(newProject);
                    });
            })
            .then(function (reloadedJson) {
                expect(reloadedJson.branches).to.deep.equal(exportedJson.branches);
                expect(reloadedJson.tags).to.deep.equal(exportedJson.tags);
                expect(reloadedJson.commits.map(function (commit) {
                    return commit._id;
                })).to.deep.equal(exportedJson.commits.map(function (commit) {
                    return commit._id;
                }));
                expect(reloadedJson.objects.length).to.equal(exportedJson.objects.length);
            })
            .nodeify(done);
    });

    it('should reject v1 project json in insertProjectWithHistory', function (done) {
        storageUtil.getProjectJson(project, {commitHash: masterCommitHash})
            .then(function (projectJson) {
                return storageUtil.insertProjectWithHistory(project, projectJson);
            })
            .then(function () {
                throw new Error('should have failed');
            })
            .catch(function (err) {
                expect(err.message).to.contain('Unsupported project json formatVersion');
            })
            .nodeify(done);
    });
});
