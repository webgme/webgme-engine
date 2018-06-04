/*globals requireJS*/
/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('../../../_globals');

describe('Meta change propagation', function () {
    var logger = testFixture.logger.fork('MetaRename'),
        gmeConfig = testFixture.getGmeConfig(),
        storage,
        expect = testFixture.expect,
        Q = testFixture.Q,
        renames = requireJS('common/core/users/metarename'),
        propagateMetaDefinitionRename = renames.propagateMetaDefinitionRename,
        metaConceptRename = renames.metaConceptRename,
        metaConceptRenameInMeta = renames.metaConceptRenameInMeta,
        propagateMetaDefinitionRemove = renames.propagateMetaDefinitionRemove,
        renameProjectName = 'renameRules',
        renameRootHash,
        renameCore,
        renameIR,
        removeProjectName = 'removeRules',
        removeRootHash,
        removeIR,
        removeCore,
        gmeAuth;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, [renameProjectName, removeProjectName])
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: './test/common/core/users/rename/propagate.webgmex',
                    projectName: renameProjectName,
                    branchName: 'master',
                    logger: logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult) {
                renameIR = importResult;
                renameRootHash = importResult.core.getHash(importResult.rootNode);
                renameCore = importResult.core;

                var importParam = {
                    projectSeed: './test/common/core/users/rename/propRemove.webgmex',
                    projectName: removeProjectName,
                    branchName: 'master',
                    logger: logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult) {
                removeIR = importResult;
                removeRootHash = importResult.core.getHash(importResult.rootNode);
                removeCore = importResult.core;
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

    describe('Rename', function () {
        'use strict';

        var rootNode,
            core,
            allMetaNodes;

        beforeEach(function (done) {
            core = renameCore;
            core.loadRoot(renameRootHash)
                .then(function (root) {
                    rootNode = root;
                    allMetaNodes = core.getAllMetaNodes(root);
                })
                .nodeify(done);
        });

        it('should change attribute definition in the meta only', function (done) {
            metaConceptRenameInMeta(core, allMetaNodes['/X/7'], 'attribute', 'some', 'something');

            expect(core.getValidAttributeNames(allMetaNodes['/X/7'])).to.have.members(['name', 'something']);
            core.loadByPath(rootNode, '/i/k')
                .then(function (node) {
                    expect(core.getValidAttributeNames(node)).to.have.members(['name', 'something', 'one']);
                    expect(core.getOwnAttributeNames(node)).to.have.members(['name', 'some', 'one']);
                })
                .nodeify(done);
        });

        it('should change pointer definition in the meta only', function (done) {
            metaConceptRenameInMeta(core, allMetaNodes['/X/I'], 'pointer', 'ptrOne', 'pOne');

            expect(core.getValidPointerNames(allMetaNodes['/X/I'])).to.have.members(['pOne']);
            core.loadByPath(rootNode, '/i/k')
                .then(function (node) {
                    expect(core.getValidPointerNames(node)).to.have.members(['pOne']);
                    expect(core.getOwnPointerNames(node)).to.have.members(['base', 'ptrOne']);
                    expect(core.getPointerPath(node, 'pOne')).to.eql(undefined);
                })
                .nodeify(done);
        });

        it('should change set definition in the meta only', function (done) {
            metaConceptRenameInMeta(core, allMetaNodes['/X/I'], 'set', 'ones', 'onesYeah');

            expect(core.getValidSetNames(allMetaNodes['/X/I'])).to.have.members(['onesYeah']);
            core.loadByPath(rootNode, '/i/k')
                .then(function (node) {
                    expect(core.getValidSetNames(node)).to.have.members(['onesYeah']);
                    expect(core.getOwnSetNames(node)).to.have.members(['ones']);
                    expect(core.getMemberPaths(node, 'onesYeah')).to.eql([]);
                })
                .nodeify(done);
        });

        it('should change aspect definition in the meta only', function (done) {
            metaConceptRenameInMeta(core, allMetaNodes['/X/w'], 'aspect', 'onsies', 'oneSet');

            expect(core.getValidAspectNames(allMetaNodes['/X/w'])).to.have.members(['duetts', 'others', 'oneSet']);
            core.loadByPath(rootNode, '/i')
                .then(function (node) {
                    expect(core.getValidAspectNames(node)).to.have.members(['duetts', 'others', 'oneSet']);
                    expect(core.getMemberPaths(node, 'onsies')).to.have.length(2);
                    try {
                        expect(core.getMemberPaths(node, 'oneSet')).to.eql([]);
                        return new Error('shoud have thrown');
                    } catch (e) {
                        return null;
                    }
                })
                .nodeify(done);
        });

        it('should change attribute concept throughout the project', function (done) {
            metaConceptRename(core, allMetaNodes['/X/7'], 'attribute', 'some', 'something')
                .then(function () {
                    expect(core.getValidAttributeNames(allMetaNodes['/X/7'])).to.have.members(['name', 'something']);
                    return core.loadByPath(rootNode, '/i/k');
                })
                .then(function (node) {
                    expect(core.getValidAttributeNames(node)).to.have.members(['name', 'something', 'one']);
                    expect(core.getOwnAttributeNames(node)).to.have.members(['name', 'something', 'one']);
                    expect(core.getAttribute(node, 'some')).to.eql(undefined);
                })
                .nodeify(done);
        });

        it('should change pointer concept throughout the project', function (done) {
            metaConceptRename(core, allMetaNodes['/X/I'], 'pointer', 'ptrOne', 'pOne')
                .then(function () {
                    expect(core.getValidPointerNames(allMetaNodes['/X/I'])).to.have.members(['pOne']);
                    return core.loadByPath(rootNode, '/i/k');
                })
                .then(function (node) {
                    expect(core.getValidPointerNames(node)).to.have.members(['pOne']);
                    expect(core.getOwnPointerNames(node)).to.have.members(['base', 'pOne']);
                    expect(core.getPointerPath(node, 'pOne')).not.to.eql(undefined);
                })
                .nodeify(done);
        });

        it('should change set concept throughout the project', function (done) {
            metaConceptRename(core, allMetaNodes['/X/I'], 'set', 'ones', 'onesYeah')
                .then(function () {
                    expect(core.getValidSetNames(allMetaNodes['/X/I'])).to.have.members(['onesYeah']);
                    return core.loadByPath(rootNode, '/i/k');
                })
                .then(function (node) {
                    expect(core.getValidSetNames(node)).to.have.members(['onesYeah']);
                    expect(core.getOwnSetNames(node)).to.have.members(['onesYeah']);
                    expect(core.getMemberPaths(node, 'onesYeah')).to.have.members(['/i/m']);
                })
                .nodeify(done);
        });

        it('should change aspect concept throughout the project', function (done) {
            metaConceptRename(core, allMetaNodes['/X/w'], 'aspect', 'onsies', 'oneSet')
                .then(function () {
                    expect(core.getValidAspectNames(allMetaNodes['/X/w'])).to.have.members(['duetts', 'others', 'oneSet']);
                    return core.loadByPath(rootNode, '/i');
                })
                .then(function (node) {
                    expect(core.getValidAspectNames(node)).to.have.members(['duetts', 'others', 'oneSet']);
                    expect(core.getMemberPaths(node, 'oneSet')).to.have.length(2);

                })
                .nodeify(done);
        });

        it('should change attribute definition data throughout the project', function (done) {
            core.renameAttributeMeta(allMetaNodes['/X/7'], 'some', 'something');
            propagateMetaDefinitionRename(core, allMetaNodes['/X/7'], {
                type: 'attribute', oldName: 'some', newName: 'something'
            })
                .then(function () {
                    expect(core.getValidAttributeNames(allMetaNodes['/X/7'])).to.have.members(['name', 'something']);
                    return core.loadByPath(rootNode, '/i/k');
                })
                .then(function (node) {
                    expect(core.getValidAttributeNames(node)).to.have.members(['name', 'something', 'one']);
                    expect(core.getOwnAttributeNames(node)).to.have.members(['name', 'something', 'one']);
                    expect(core.getAttribute(node, 'some')).to.eql(undefined);
                })
                .nodeify(done);
        });

        it('should change pointer definition throughout the project', function (done) {
            core.movePointerMetaTarget(allMetaNodes['/X/I'], allMetaNodes['/X/a'], 'ptrOne', 'pOne');
            propagateMetaDefinitionRename(core, allMetaNodes['/X/I'], {
                type: 'pointer', oldName: 'ptrOne', newName: 'pOne', targetPath: '/X/a'
            })
                .then(function () {
                    expect(core.getValidPointerNames(allMetaNodes['/X/I'])).to.have.members(['pOne']);
                    return core.loadByPath(rootNode, '/i/k');
                })
                .then(function (node) {
                    expect(core.getValidPointerNames(node)).to.have.members(['pOne']);
                    expect(core.getOwnPointerNames(node)).to.have.members(['base', 'pOne']);
                    expect(core.getPointerPath(node, 'pOne')).not.to.eql(undefined);
                })
                .nodeify(done);
        });

        it('should change set definition throughout the project', function (done) {
            core.movePointerMetaTarget(allMetaNodes['/X/I'], allMetaNodes['/X/a'], 'ones', 'onesYeah');
            propagateMetaDefinitionRename(core, allMetaNodes['/X/I'], {
                type: 'set', oldName: 'ones', newName: 'onesYeah', targetPath: '/X/a'
            })
                .then(function () {
                    expect(core.getValidSetNames(allMetaNodes['/X/I'])).to.have.members(['onesYeah']);
                    return core.loadByPath(rootNode, '/i/k');
                })
                .then(function (node) {
                    expect(core.getValidSetNames(node)).to.have.members(['onesYeah']);
                    expect(core.getOwnSetNames(node)).to.have.members(['onesYeah']);
                    expect(core.getMemberPaths(node, 'onesYeah')).to.have.members(['/i/m']);
                })
                .nodeify(done);
        });

        it('should change aspect definition throughout the project', function (done) {
            core.moveAspectMetaTarget(allMetaNodes['/X/w'], allMetaNodes['/X/m'], 'onsies', 'oneSet');
            propagateMetaDefinitionRename(core, allMetaNodes['/X/w'], {
                type: 'aspect', oldName: 'onsies', newName: 'oneSet', targetPath: '/X/m'
            })
                .then(function () {
                    expect(core.getValidAspectNames(allMetaNodes['/X/w'])).to.have.members(['duetts', 'others', 'oneSet']);
                    return core.loadByPath(rootNode, '/i');
                })
                .then(function (node) {
                    expect(core.getValidAspectNames(node)).to.have.members(['duetts', 'others', 'oneSet']);
                    expect(core.getMemberPaths(node, 'oneSet')).to.have.length(2);

                })
                .nodeify(done);
        });
    });
    describe('Remove', function () {
        'use strict';

        var core,
            rootNode,
            allMetaNodes,
            one, two, mixin, container;

        beforeEach(function (done) {
            core = removeCore;
            core.loadRoot(removeRootHash)
                .then(function (root) {
                    rootNode = root;
                    allMetaNodes = core.getAllMetaNodes(root);

                    return Q.all([
                        core.loadByPath(root, '/t'),
                        core.loadByPath(root, '/H'),
                        core.loadByPath(root, '/F'),
                        core.loadByPath(root, '/z'),
                    ]);
                })
                .then(function (nodes) {
                    one = nodes[0];
                    two = nodes[1];
                    mixin = nodes[2];
                    container = nodes[3];
                })
                .nodeify(done);
        });

        it('should take care of attribute removal', function (done) {
            core.delAttributeMeta(allMetaNodes['/e'], 'value');
            propagateMetaDefinitionRemove(core, allMetaNodes['/e'], {type: 'attribute', name: 'value'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidAttributeNames(allMetaNodes['/e'])).to.have.members(['name', 'value']);
                expect(core.getAttribute(two, 'value')).eql('has');
                done();
            });
        });

        it('should take care of attribute removal of mixin', function (done) {
            core.setAttribute(mixin, 'value', 'something');
            core.delAttributeMeta(allMetaNodes['/L'], 'value');
            propagateMetaDefinitionRemove(core, allMetaNodes['/L'], {type: 'attribute', name: 'value'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidAttributeNames(allMetaNodes['/L'])).to.have.members(['name']);
                expect(core.getAttribute(two, 'value')).eql('has');
                expect(core.getAttribute(mixin, 'value')).eql(undefined);
                done();
            });
        });

        it('should take care of pointer removal from the item', function (done) {
            core.delPointerMetaTarget(allMetaNodes['/e'], 'ref', '/e');
            propagateMetaDefinitionRemove(core, allMetaNodes['/e'], {type: 'pointer', name: 'ref'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidPointerNames(allMetaNodes['/e'])).to.have.members(['ref']);
                expect(core.getPointerPath(one, 'ref')).eql(core.getPath(mixin));
                expect(core.getPointerPath(two, 'ref')).eql(core.getPath(one));
                done();
            });
        });

        it('should take care of pointer removal from the mixin', function (done) {
            core.delPointerMetaTarget(allMetaNodes['/L'], 'ref', '/1');
            propagateMetaDefinitionRemove(core, allMetaNodes['/L'], {type: 'pointer', name: 'ref'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidPointerNames(allMetaNodes['/e'])).to.have.members(['ref']);
                expect(core.getPointerPath(one, 'ref')).eql(null);
                expect(core.getPointerPath(two, 'ref')).eql(core.getPath(one));
                done();
            });
        });

        it('should take care of set removal from the item', function (done) {
            core.delPointerMetaTarget(allMetaNodes['/e'], 'coll', '/e');
            propagateMetaDefinitionRemove(core, allMetaNodes['/e'], {type: 'set', name: 'coll'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidSetNames(allMetaNodes['/e'])).to.have.members(['coll']);
                expect(core.getMemberPaths(one, 'coll')).to.have.members([core.getPath(mixin)]);
                expect(core.getMemberPaths(two, 'coll')).to.have.members([core.getPath(one)]);
                done();
            });
        });

        it('should take care of set removal from the mixin', function (done) {
            core.delPointerMetaTarget(allMetaNodes['/L'], 'coll', '/1');
            propagateMetaDefinitionRemove(core, allMetaNodes['/L'], {type: 'set', name: 'coll'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidSetNames(allMetaNodes['/e'])).to.have.members(['coll']);
                expect(core.getMemberPaths(one, 'coll')).to.have.members([]);
                expect(core.getMemberPaths(two, 'coll')).to.have.members([core.getPath(one)]);
                done();
            });
        });

        it('should take care of containment removal from item', function (done) {
            core.delChildMeta(allMetaNodes['/e'], '/e');
            propagateMetaDefinitionRemove(core, allMetaNodes['/e'], {type: 'containment'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getChildrenPaths(container)).to.have.length(2);
                done();
            });
        });

        it('should take care of containment removal from mixin', function (done) {
            core.delChildMeta(allMetaNodes['/L'], '/1');
            propagateMetaDefinitionRemove(core, allMetaNodes['/L'], {type: 'containment'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getChildrenPaths(container)).to.have.length(2);
                done();
            });
        });

        it('should take care of containment removal from both', function (done) {
            core.delChildMeta(allMetaNodes['/e'], '/e');
            propagateMetaDefinitionRemove(core, allMetaNodes['/e'], {type: 'containment'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getChildrenPaths(container)).to.have.length(2);
                core.delChildMeta(allMetaNodes['/L'], '/1');
                propagateMetaDefinitionRemove(core, allMetaNodes['/L'], {type: 'containment'}, function (err) {
                    expect(err).to.eql(null);
                    expect(core.getChildrenPaths(container)).to.have.length(2);
                    core.delChildMeta(allMetaNodes['/1'], '/L');
                    propagateMetaDefinitionRemove(core, allMetaNodes['/1'], {type: 'containment'}, function (err) {
                        expect(err).to.eql(null);
                        expect(core.getChildrenPaths(container)).to.have.length(0);
                        done();
                    });
                });
            });
        });

        it('should take care of aspect removal from item', function (done) {
            core.delAspectMeta(allMetaNodes['/e'], 'one');
            propagateMetaDefinitionRemove(core, allMetaNodes['/e'], {type: 'aspect', name: 'one'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidAspectNames(one)).to.have.members(['one']);
                done();
            });
        });

        it('should take care of aspect removal from mixin', function (done) {
            core.delAspectMeta(allMetaNodes['/L'], 'one');
            propagateMetaDefinitionRemove(core, allMetaNodes['/L'], {type: 'aspect', name:'one'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidAspectNames(one)).to.have.members(['one']);
                done();
            });
        });

        it('should take care of aspect removal from both', function (done) {
            core.delAspectMeta(allMetaNodes['/L'], 'one');
            propagateMetaDefinitionRemove(core, allMetaNodes['/L'], {type: 'aspect', name:'one'}, function (err) {
                expect(err).to.eql(null);
                expect(core.getValidAspectNames(one)).to.have.members(['one']);
                core.delAspectMeta(allMetaNodes['/e'], 'one');
                propagateMetaDefinitionRemove(core, allMetaNodes['/e'], {type: 'aspect', name: 'one'}, function (err) {
                    expect(err).to.eql(null);
                    expect(core.getValidAspectNames(one)).to.have.members([]);
                    done();
                });
            });
        });
    });
});