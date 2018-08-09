/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../_globals.js');

describe('UserProject', function () {
    'use strict';
    var gmeConfig = testFixture.getGmeConfig(),
        logger = testFixture.logger.fork('core.intrapersist'),
        ProjectInterface = testFixture.requirejs('common/storage/project/interface'),
        Q = testFixture.Q,
        storage,
        gmeAuth,
        expect = testFixture.expect,
        projectName = 'UserProject_test',
        //projectId = testFixture.projectName2Id(projectName),
        importResult,
        project;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, null)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth_);
                return storage.openDatabase();
            })
            .then(function () {
                return testFixture.importProject(storage, {
                    projectSeed: './seeds/EmptyProject.webgmex',
                    projectName: projectName,
                    gmeConfig: gmeConfig,
                    logger: logger
                });
            })
            .then(function (result) {
                importResult = result;
                project = result.project;
                return Q.allDone([
                    project.createBranch('b1', result.commitHash),
                    project.createTag('tag', result.commitHash),
                ]);
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

    it('should be instance of ProjectInterface', function () {
        expect(project instanceof ProjectInterface).to.equal(true);
    });

    it('should getProjectInfo', function (done) {
        project.getProjectInfo()
            .then(function (projectInfo) {
                expect(Object.keys(projectInfo)).to.have.members([
                    '_id', 'branches', 'hooks', 'info', 'name', 'owner', 'rights'
                ]);
            })
            .nodeify(done);
    });

    it('should getBranches', function (done) {
        project.getBranches()
            .then(function (branches_) {
                expect(branches_.hasOwnProperty('master')).to.equal(true);
            })
            .nodeify(done);
    });

    it('should getTags', function (done) {
        project.getTags()
            .then(function (tags) {
                expect(tags).to.deep.equal({tag: importResult.commitHash});
            })
            .nodeify(done);
    });

    it('should getCommitObject from branch-name and commit-hash', function (done) {
        var returned;

        project.getCommitObject('master')
            .then(function (commitObj) {
                returned = commitObj;
                expect(typeof commitObj).to.equal('object');
                expect(typeof commitObj._id).to.equal('string');
                return project.getCommitObject(commitObj._id);
            })
            .then(function (commitObj) {
                expect(commitObj).to.deep.equal(returned);
            })
            .nodeify(done);
    });

    it('should getRootHash from branch-name and commit-hash', function (done) {
        var rootHash;

        project.getCommitObject('master')
            .then(function (commitObj) {
                rootHash = commitObj.root;
                expect(typeof rootHash).to.equal('string');
                expect(rootHash).to.not.equal('');
                expect(rootHash[0]).to.equal('#');

                return Q.allDone([
                    project.getRootHash(commitObj._id),
                    project.getRootHash('master')
                ]);
            })
            .then(function (res) {
                expect(res[0]).to.equal(rootHash);
                expect(res[1]).to.equal(rootHash);
            })
            .nodeify(done);
    });

    it('should getCommits', function (done) {
        project.getCommits((new Date()).getTime() + 100, 1)
            .then(function (commits) {
                expect(commits.length).to.equal(1);
                expect(commits[0]).to.have.property('message');
            })
            .nodeify(done);
    });

    it('should getHistory from branch', function (done) {
        project.getHistory('master', 1)
            .then(function (commits) {
                expect(commits.length).to.equal(1);
                expect(commits[0]).to.have.property('message');
            })
            .nodeify(done);
    });

    it('should getHistory from array of branches', function (done) {
        project.getHistory(['master'], 1)
            .then(function (commits) {
                expect(commits.length).to.equal(1);
                expect(commits[0]).to.have.property('message');
            })
            .nodeify(done);
    });

    it('should makeCommit', function (done) {
        var numCommitsBefore;

        project.getCommits(Date.now(), 100)
            .then(function (commits) {
                numCommitsBefore = commits.length;
                return project.createBranch('makeCommit_name', importResult.commitHash);
            })
            .then(function (result) {
                expect(result.status).to.equal('SYNCED');
                return project.makeCommit('makeCommit_name', [importResult.commitHash],
                    importResult.rootHash, [], 'new commit');
            })
            .then(function () {
                return project.getCommits(Date.now() + 100, 100);
            })
            .then(function (commits) {
                expect(numCommitsBefore).to.equal(commits.length - 1);
            })
            .nodeify(done);
    });

    it('should getCommonAncestorCommit', function (done) {
        project.makeCommit(null, [importResult.commitHash], importResult.rootHash, {}, 'commonAns')
            .then(function (result) {
                expect(result.hash).to.include('#');
                return project.getCommonAncestorCommit(result.hash, importResult.commitHash);
            })
            .then(function (commitHash) {
                expect(commitHash).to.equal(importResult.commitHash);
            })
            .nodeify(done);
    });

    it('should setBranchHash', function (done) {
        project.setBranchHash('master', importResult.commitHash, importResult.commitHash)
            .then(function (result) {
                expect(result.status).to.equal('SYNCED');
                expect(result.hash).to.equal(importResult.commitHash);
            })
            .nodeify(done);
    });

    it('should getBranchHash', function (done) {
        project.getBranchHash('b1')
            .then(function (hash) {
                expect(hash).to.equal(importResult.commitHash);
            })
            .nodeify(done);
    });

    it('should create and deleteBranch', function (done) {
        project.getBranchHash('master')
            .then(function (hash) {
                return project.createBranch('toBeDeletedBranch', hash);
            })
            .then(function () {
                return project.getBranches();
            })
            .then(function (branches) {
                expect(branches).to.have.property('master');
                expect(branches).to.have.property('toBeDeletedBranch');
                return project.deleteBranch('toBeDeletedBranch', branches.toBeDeletedBranch);
            })
            .then(function () {
                return project.getBranches();
            })
            .then(function (branches) {
                expect(branches).to.have.property('master');
                expect(branches).to.not.have.property('toBeDeletedBranch');
                done();
            })
            .catch(done);
    });

    it('should create and deleteTag', function (done) {
        project.createTag('newTag', importResult.commitHash)
            .then(function () {
                return project.getTags();
            })
            .then(function (tags) {

                expect(tags).to.deep.equal({
                    tag: importResult.commitHash,
                    newTag: importResult.commitHash
                });

                return project.deleteTag('newTag');
            })
            .then(function () {
                return project.getTags();
            })
            .then(function (tags) {
                expect(tags).to.deep.equal({tag: importResult.commitHash});
            })
            .nodeify(done);
    });

    it('should squashCommits', function (done) {
        project.squashCommits(importResult.commitHash, importResult.commitHash, 'testing squash')
            .nodeify(done);
    });

    it('should fail to squash commits that are not connected', function (done) {
        project.makeCommit(null, [], importResult.rootHash, {}, 'new disconnected commit')
            .then(function (result) {
                expect(result.hash).to.include('#');
                return project.squashCommits(importResult.commitHash, result.hash, 'testing squash to fail');
            })
            .then(function () {
                throw new Error('missing error handling during squash');
            })
            .catch(function (err) {
                expect(err.message).to.contains('unable to find common ancestor commit');
            })
            .nodeify(done);
    });

    it('should fail to squash commits if the start is not an ancestor of the end', function (done) {
        var oneCommit, twoCommit;
        project.makeCommit(null, [importResult.commitHash], importResult.rootHash, {}, 'new commit')
            .then(function (result) {
                expect(result.hash).to.include('#');
                oneCommit = result.hash;
                return project.makeCommit(
                    null, [importResult.commitHash], importResult.rootHash, {}, 'other new commit');
            })
            .then(function (result) {
                expect(result.hash).to.include('#');
                twoCommit = result.hash;
                return project.squashCommits(oneCommit, twoCommit, 'testing squash to fail');
            })
            .then(function () {
                throw new Error('missing error handling during squash');
            })
            .catch(function (err) {
                expect(err.message).to.contains('is not a descendant of the start-point');
            })
            .nodeify(done);
    });

    it('should fail to squash commits of unknown branch', function (done) {
        project.squashCommits(importResult.commitHash, 'unknown branch', 'testing squash to fail')
            .then(function () {
                throw new Error('missing error handling during squash');
            })
            .catch(function (err) {
                expect(err.message).to.contains('Commit object does not exist');
            })
            .nodeify(done);
    });

    it('should getUserId and return guestAccount by default', function () {
        expect(project.getUserId()).to.equal(gmeConfig.authentication.guestAccount);
    });

    it('should setUserId and return it a getUserId', function () {
        project.setUser('someUser');
        expect(project.getUserId()).to.equal('someUser');
        project.setUser(gmeConfig.authentication.guestAccount);
        expect(project.getUserId()).to.equal(gmeConfig.authentication.guestAccount);
    });
});