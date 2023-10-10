/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../_globals.js');

describe('UserProject_Auth', function () {
    'use strict';
    const gmeConfig = testFixture.getGmeConfig();
    gmeConfig.authentication.enable = true;
    const logger = testFixture.logger.fork('core.intrapersist');
    const expect = testFixture.expect;
    const projectName = 'UserProject_Auth';
    let gmeAuth;
    let projectId;
    let storage;

    before(async function () {
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, null);
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const { project, commitHash, projectId: projectId_ } = await testFixture.importProject(storage, {
            projectSeed: './seeds/EmptyProject.webgmex',
            username: 'admin',
            ownerId: 'admin',
            projectName: projectName,
            gmeConfig: gmeConfig,
            logger: logger
        });

        projectId = projectId_;

        project.createTag('tag', commitHash);
    });

    after(async function () {
        gmeAuth && await gmeAuth.unload();
        storage && await storage.closeDatabase();
    });

    it('should pass on username at OpenProject', async function () {
        const project = await storage.openProject({ username: 'admin', projectId });
        const tags = await project.getTags();
        expect(Object.keys(tags)).to.deep.equal(['tag']);
    });

    it('should pass on username at CreateProject', async function () {
        const project = await storage.createProject({ username: 'admin', projectName: 'newProject' });
        const tags = await project.getTags();
        expect(Object.keys(tags)).to.deep.equal([]);
    });

    it('should pass on username at DuplicateProject', async function () {
        const project = await storage.duplicateProject({ username: 'admin', projectName: 'newProjectDup', projectId });
        const tags = await project.getTags();
        expect(Object.keys(tags)).to.deep.equal(['tag']);
    });
});