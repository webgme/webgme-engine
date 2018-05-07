/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('./../_globals.js');

describe('issue110 testing', function () {
    'use strict';
    var gmeConfig = testFixture.getGmeConfig(),
        Q = testFixture.Q,
        expect = testFixture.expect,
        logger = testFixture.logger.fork('issue110.spec'),
        fs = require('fs'),
        storage = null,
        storageUtils = testFixture.requirejs('common/storage/util'),
        projectNames = {rosmod: 'i86rosmod', hfsm: 'i86hfsm'},
        cores = {rosmod: null, hfsm: null},
        roots = {rosmod: null, hfsm: null},
        projects = {rosmod: null, hfsm: null},
        gmeAuth;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, [projectNames.rosmod, projectNames.hfsm])
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                return testFixture.importProject(storage,
                    {
                        projectSeed: 'test/issue/86/rosmod.webgmex',
                        projectName: projectNames.rosmod,
                        gmeConfig: gmeConfig,
                        logger: logger
                    });
            })
            .then(function (importResult) {
                cores.rosmod = importResult.core;
                roots.rosmod = importResult.rootNode;
                projects.rosmod = importResult.project;

                return testFixture.importProject(storage,
                    {
                        projectSeed: 'test/issue/86/hfsm.webgmex',
                        projectName: projectNames.hfsm,
                        gmeConfig: gmeConfig,
                        logger: logger
                    });
            })
            .then(function (importResult) {
                cores.hfsm = importResult.core;
                roots.hfsm = importResult.rootNode;
                projects.hfsm = importResult.project;
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

    it('should import an HFSM based model into Rosmod', function (done) {
        var modelJson = JSON.parse(fs.readFileSync('./test/issue/86/fromHfsm.json', 'utf8')),
            contentJson = {
                rootHash: null,
                objects: modelJson.objects
            };

        storageUtils.insertProjectJson(projects.rosmod,
            contentJson,
            {commitMessage: 'commit that represents the selection content'})
            .then(function (/*commitResult*/) {
                var closureInfo = cores.rosmod.importClosure(roots.rosmod, modelJson.selectionInfo);

                if (closureInfo instanceof Error) {
                    throw closureInfo;
                }

                var baseRelations = closureInfo.relations.preserved;

                expect(Object.keys(baseRelations)).to.have.length(9);
                for (var path in baseRelations) {
                    expect(baseRelations[path]).to.have.keys(['base']);
                    if (path.indexOf('/p') > 0 || path.indexOf('/8') > 0) {
                        expect(baseRelations[path].base).to.equal('/s/e/615025579/1416392928');
                    }
                    if (path.indexOf('/K') > 0 || path.indexOf('/L') > 0 || path.indexOf('/M') > 0) {
                        expect(baseRelations[path].base).to.equal('/s/e/615025579/318746662');
                    }
                    if (path.indexOf('/P') > 0) {
                        expect(baseRelations[path].base).to.equal('/s/e/615025579/1242097160');
                    }
                    if (path.indexOf('/R') > 0) {
                        expect(baseRelations[path].base).to.equal('/s/e/615025579/n');
                    }
                    if (path.indexOf('/O') > 0) {
                        expect(baseRelations[path].base).to.equal('/s/e/615025579/A');
                    }
                }
            })
            .nodeify(done);
    });

    it('should import a Rosmod based model into HFSM', function (done) {
        var modelJson = JSON.parse(fs.readFileSync('./test/issue/86/fromRosmod.json', 'utf8')),
            contentJson = {
                rootHash: null,
                objects: modelJson.objects
            };

        storageUtils.insertProjectJson(projects.hfsm,
            contentJson,
            {commitMessage: 'commit that represents the selection content'})
            .then(function (/*commitResult*/) {
                var closureInfo = cores.rosmod.importClosure(roots.hfsm, modelJson.selectionInfo);

                if (closureInfo instanceof Error) {
                    throw closureInfo;
                }

                var baseRelations = closureInfo.relations.preserved;

                expect(Object.keys(baseRelations)).to.have.length(6);
                for (var path in baseRelations) {
                    expect(baseRelations[path]).to.have.keys(['base']);
                    if (path.indexOf('/h') > 0 || path.indexOf('/a') > 0) {
                        expect(baseRelations[path].base).to.equal('/Z/615025579/318746662');
                    }
                    if (path.indexOf('/p') > 0) {
                        expect(baseRelations[path].base).to.equal('/Z/615025579/1242097160');
                    }
                    if (path.indexOf('/q') > 0) {
                        expect(baseRelations[path].base).to.equal('/Z/615025579/1416392928');
                    }
                    if (path.indexOf('/P') > 0) {
                        expect(baseRelations[path].base).to.equal('/Z/615025579/A');
                    }
                }
            })
            .nodeify(done);
    });
});