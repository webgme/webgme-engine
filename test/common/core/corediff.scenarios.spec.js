/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../_globals.js');

describe('corediff scenarios', function () {
    'use strict';
    var gmeConfig = testFixture.getGmeConfig(),
        projectName = 'coreDiffScenarios',
        //projectId = testFixture.projectName2Id(projectName),
        Q = testFixture.Q,
        expect = testFixture.expect,
        logger = testFixture.logger.fork('corediff.scenarios'),
        context,
        core,
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
                    projectName: projectName,
                    logger: logger.fork('import'),
                    gmeConfig: gmeConfig,
                    projectSeed: 'seeds/EmptyProject.webgmex'
                });
            })
            .then(function (result) {
                context = result;
                core = context.core;
            })
            .nodeify(done);
    });

    after(function (done) {
        Q.allDone([
            storage.closeDatabase(),
            gmeAuth.unload()
        ]).nodeify(done);
    });

    function loadRootAndFCO(rootHash, paths) {
        var result = {
            root: null,
            fco: null
        };

        paths = paths || [];

        return core.loadRoot(rootHash)
            .then(function (root) {
                result.root = root;
                return core.loadByPath(root, '/1');
            })
            .then(function (fco) {
                result.fco = fco;
                return Q.all(paths.map(function (path) {
                    return core.loadByPath(result.root, path);
                }));
            })
            .then(function (nodes) {
                var i;
                for (i = 0; i < nodes.length; i += 1) {
                    result[paths[i]] = nodes[i];
                }

                return result;
            });
    }

    function save(rootNode) {
        var persisted = core.persist(rootNode);
        return context.project.makeCommit(null,
            [context.commitHash],
            persisted.rootHash,
            persisted.objects,
            'some message')
            .then(function () {
                return persisted.rootHash;
            });
    }

    // function logNodes(nodes) {
    //     nodes.forEach(function (node) {
    //         console.log(core.getPath(node), 'base', core.getBase(node) ? core.getPath(core.getBase(node)) : null);
    //     });
    // }

    // Children creation
    it('should assign a new relid when child created in both trees', function (done) {
        var originRoot,
            basePath,
            instancePath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco
                    }),
                    instance = core.createNode({
                        parent: r.root,
                        base: base
                    });

                basePath = core.getPath(base);
                instancePath = core.getPath(instance);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.createNode({
                    parent: trees[0][basePath],
                    base: trees[0].fco,
                    relid: 'conflictRelid'
                });

                core.createNode({
                    parent: trees[1][basePath],
                    base: trees[1].fco,
                    relid: 'conflictRelid'
                });

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var concatChanges = core.tryToConcatChanges(diffs[0], diffs[1]);

                expect(concatChanges.items.length).to.equal(0); // No conflicts detected

                return core.applyTreeDiff(originRoot, concatChanges.merge);
            })
            .then(function () {
                return core.loadSubTree(originRoot);
            })
            .then(function (st) {
                // Root, fco, base, instance, 2+2 children (the nodes are created under the base node)
                var numOfConflictPaths = 0,
                    i;

                expect(st.length).to.equal(8);

                for (i = 0; i < st.length; i += 1) {
                    if (core.getPath(st[i]).indexOf('/conflictRelid') !== -1) {
                        numOfConflictPaths += 1;
                    }
                }
                expect(numOfConflictPaths).to.eql(2);
            })
            .nodeify(done);
    });

    it('should assign a new relid when child created in one base and one instance', function (done) {
        var originRoot,
            basePath,
            instancePath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco
                    }),
                    instance = core.createNode({
                        parent: r.root,
                        base: base
                    });

                basePath = core.getPath(base);
                instancePath = core.getPath(instance);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.createNode({
                    parent: trees[0][basePath],
                    base: trees[0].fco,
                    relid: 'conflictRelid'
                });

                core.createNode({
                    parent: trees[1][instancePath],
                    base: trees[1].fco,
                    relid: 'conflictRelid'
                });

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var concatChanges = core.tryToConcatChanges(diffs[0], diffs[1]);

                expect(concatChanges.items.length).to.equal(0); // No conflicts detected
                return core.applyTreeDiff(originRoot, concatChanges.merge);
            })
            .then(function () {
                return core.loadSubTree(originRoot);
            })
            .then(function (st) {
                // Root, fco, base, instance, 3 children
                expect(st.length).to.equal(7);
            })
            .nodeify(done);
    });

    it('should assign a new relid when child moved into one base and created in one instance', function (done) {
        var originRoot,
            basePath,
            instancePath,
            moveSourcePath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco
                    }),
                    instance = core.createNode({
                        parent: r.root,
                        base: base
                    }),
                    moveNode = core.createNode({
                        parent: r.root,
                        base: r.fco,
                        relid: 'conflictRelid'
                    });

                moveSourcePath = core.getPath(moveNode);
                basePath = core.getPath(base);
                instancePath = core.getPath(instance);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, instancePath, moveSourcePath]),
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.moveNode(trees[0][moveSourcePath], trees[0][basePath]);

                core.createNode({
                    parent: trees[1][instancePath],
                    base: trees[1].fco,
                    relid: 'conflictRelid'
                });

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var concatChanges = core.tryToConcatChanges(diffs[0], diffs[1]);

                expect(concatChanges.items.length).to.equal(0); // No conflicts detected
                return core.applyTreeDiff(originRoot, concatChanges.merge);
            })
            .then(function () {
                return core.loadSubTree(originRoot);
            })
            .then(function (st) {
                // Root, fco, base, instance, 3 children
                expect(st.length).to.equal(7);
            })
            .nodeify(done);
    });

    it('should assign a new relids when child created in bases and modified in instances', function (done) {
        var originRoot,
            basePath,
            instancePath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco
                    }),
                    instance = core.createNode({
                        parent: r.root,
                        base: base
                    });

                basePath = core.getPath(base);
                instancePath = core.getPath(instance);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.createNode({
                    parent: trees[0][basePath],
                    base: trees[0].fco,
                    relid: 'conflictRelid'
                });

                core.createNode({
                    parent: trees[1][basePath],
                    base: trees[1].fco,
                    relid: 'conflictRelid'
                });

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    core.loadChildren(trees[0][instancePath]),
                    core.loadChildren(trees[1][instancePath]),
                ])
                    .then(function (children) {
                        expect(children[0].length).to.equal(1);
                        expect(children[1].length).to.equal(1);

                        core.setAttribute(children[0][0], 'name', 'instanceChildWithData0');
                        core.setAttribute(children[1][0], 'name', 'instanceChildWithData1');
                        return Q.all([
                            save(trees[0].root),
                            save(trees[1].root)
                        ]);
                    })
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var concatChanges = core.tryToConcatChanges(diffs[0], diffs[1]);

                expect(concatChanges.items.length).to.equal(0); // No conflicts detected
                return core.applyTreeDiff(originRoot, concatChanges.merge);
            })
            .then(function () {
                return core.loadSubTree(originRoot);
            })
            .then(function (st) {
                // Root, fco, base, instance, 4 children
                expect(st.length).to.equal(8);
            })
            .nodeify(done);
    });

    it('should assign a new relid when child created in base and what is to become instance', function (done) {
        var originRoot,
            basePath,
            toBecomeInstancePath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco,
                        relid: 'base'
                    }),
                    instance = core.createNode({
                        parent: r.root,
                        base: r.fco,
                        relid: 'instance'
                    });

                basePath = core.getPath(base);
                toBecomeInstancePath = core.getPath(instance);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, toBecomeInstancePath]),
                    loadRootAndFCO(rootHash, [basePath, toBecomeInstancePath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.createNode({
                    parent: trees[0][basePath],
                    base: trees[0].fco,
                    relid: 'conflictRelid'
                });

                core.setBase(trees[0][toBecomeInstancePath], trees[0][basePath]);

                core.createNode({
                    parent: trees[1][toBecomeInstancePath],
                    base: trees[1].fco,
                    relid: 'conflictRelid'
                });

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var concatChanges = core.tryToConcatChanges(diffs[0], diffs[1]);
                expect(concatChanges.items.length).to.equal(0); // No conflicts detected
                return core.applyTreeDiff(originRoot, concatChanges.merge);
            })
            .then(function () {
                // This use-case requires a persist and reload before actions to take place..
                //TODO: In general which kind of changes requires this? setBase and moveNode??
                return save(originRoot);
            })
            .then(function (newRootHash) {
                return loadRootAndFCO(newRootHash);
            })
            .then(function (r) {
                return core.loadSubTree(r.root);
            })
            .then(function (st) {
                // Root, fco, base, instance, 3 children
                // logNodes(st);
                expect(st.length).to.equal(7);
            })
            .nodeify(done);
    });

    it('should assign a new relid when child created in base and instance changes its base', function (done) {
        var originRoot,
            basePath,
            toBecomeInstancePath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco,
                        relid: 'base'
                    }),
                    instance = core.createNode({
                        parent: r.root,
                        base: r.fco,
                        relid: 'instance'
                    });

                core.createNode({
                    parent: base,
                    base: r.fco,
                    relid: 'conflictRelid'
                });

                basePath = core.getPath(base);
                toBecomeInstancePath = core.getPath(instance);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, toBecomeInstancePath]),
                    loadRootAndFCO(rootHash, [basePath, toBecomeInstancePath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.setBase(trees[0][toBecomeInstancePath], trees[0][basePath]);

                core.createNode({
                    parent: trees[1][toBecomeInstancePath],
                    base: trees[1].fco,
                    relid: 'conflictRelid'
                });

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var concatChanges = core.tryToConcatChanges(diffs[0], diffs[1]);
                expect(concatChanges.items.length).to.equal(0); // No conflicts detected
                return core.applyTreeDiff(originRoot, concatChanges.merge);
            })
            .then(function () {
                // This use-case requires a persist and reload before actions to take place..
                //TODO: In general which kind of changes requires this? setBase and moveNode??
                return save(originRoot);
            })
            .then(function (newRootHash) {
                return loadRootAndFCO(newRootHash);
            })
            .then(function (r) {
                return core.loadSubTree(r.root);
            })
            .then(function (st) {
                // Root, fco, base, instance, 3 children
                // logNodes(st);
                expect(st.length).to.equal(7);
            })
            .nodeify(done);
    });

    it('should give conflict when container is removed while other branch added children', function (done) {
        var originRoot,
            basePath,
            containerPath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco
                    }),
                    container = core.createNode({
                        parent: r.root,
                        base: r.fco
                    });

                basePath = core.getPath(base);
                containerPath = core.getPath(container);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, containerPath]),
                    loadRootAndFCO(rootHash, [basePath, containerPath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.createNode({
                    parent: trees[0][containerPath],
                    base: trees[0].fco,
                    relid: 'childOne'
                });
                core.createNode({
                    parent: trees[0][containerPath],
                    base: trees[0].fco,
                    relid: 'childTwo'
                });

                core.deleteNode(trees[1][containerPath]);

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var concatChanges01 = core.tryToConcatChanges(diffs[0], diffs[1]),
                    concatChanges10 = core.tryToConcatChanges(diffs[1], diffs[0]);

                expect(concatChanges01.items.length).to.equal(2);
                expect(concatChanges10.items.length).to.equal(2);

                expect(concatChanges01.items[0].theirs).to.eql(concatChanges10.items[0].mine);
                expect(concatChanges01.items[1].theirs).to.eql(concatChanges10.items[1].mine);
            })
            .nodeify(done);
    });

    it('should keep children created by the two branches', function (done) {
        var originRoot,
            basePath,
            containerPath,
            countRelid = function (nodes, relid) {
                var count = 0,
                    i;
                for (i = 0; i < nodes.length; i += 1) {
                    if (core.getRelid(nodes[i]) === relid) {
                        count += 1;
                    }
                }
                return count;
            };

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco
                    }),
                    container = core.createNode({
                        parent: r.root,
                        base: r.fco,
                        relid: 'containerNode'
                    });

                basePath = core.getPath(base);
                containerPath = core.getPath(container);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, containerPath]),
                    loadRootAndFCO(rootHash, [basePath, containerPath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.createNode({
                    parent: trees[0][containerPath],
                    base: trees[0].fco,
                    relid: 'childOne'
                });
                core.createNode({
                    parent: trees[0][containerPath],
                    base: trees[0].fco,
                    relid: 'childTwo'
                });

                core.createNode({
                    parent: trees[0][containerPath],
                    base: trees[0].fco,
                    relid: 'childThree'
                });
                core.copyNode(trees[1][basePath], trees[1][containerPath]);

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var concatChanges01 = core.tryToConcatChanges(diffs[0], diffs[1]),
                    concatChanges10 = core.tryToConcatChanges(diffs[1], diffs[0]);

                expect(concatChanges01.items.length).to.equal(0);
                expect(concatChanges10.items.length).to.equal(0);
                return core.applyTreeDiff(originRoot, concatChanges01.merge);
            })
            .then(function () {
                // This use-case requires a persist and reload before actions to take place..
                //TODO: In general which kind of changes requires this? setBase and moveNode??
                return save(originRoot);
            })
            .then(function (newRootHash) {
                return loadRootAndFCO(newRootHash);
            })
            .then(function (r) {
                return core.loadSubTree(r.root);
            })
            .then(function (st) {
                // Root, fco, base, container, 4 children
                // logNodes(st);
                expect(st.length).to.equal(8);
                expect(countRelid(st, 'childOne')).to.equal(1);
                expect(countRelid(st, 'childTwo')).to.equal(1);
                expect(countRelid(st, 'childThree')).to.equal(1);

                for (var i = 0; i < st.length; i += 1) {
                    if (core.getRelid(st[i]) === 'containerNode') {
                        expect(core.getChildrenRelids(st[i]).length).to.equal(4);
                    }
                }
            })
            .nodeify(done);
    });

    // Symmetry
    it('should give conflict when del base in one tree and mod instance in other', function (done) {
        var originRoot,
            basePath,
            instancePath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco
                    }),
                    instance = core.createNode({
                        parent: r.root,
                        base: base
                    });

                basePath = core.getPath(base);
                instancePath = core.getPath(instance);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.deleteNode(trees[0][basePath]);

                core.setAttribute(trees[1][instancePath], 'name', 'newName');

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var prevDiffs = JSON.parse(JSON.stringify(diffs));
                // console.log('before', JSON.stringify(diffs, null, 2));
                var concatChanges01 = core.tryToConcatChanges(diffs[0], diffs[1]);
                // console.log('after', JSON.stringify(diffs, null, 2));
                var concatChanges10 = core.tryToConcatChanges(diffs[1], diffs[0]);
                expect(prevDiffs).to.deep.equal(diffs);

                expect(concatChanges01.items.length).to.equal(1);
                expect(concatChanges10.items.length).to.equal(1);
            })
            .nodeify(done);
    });

    it('should give conflict when del base in one tree and mod instance in other (reverse)', function (done) {
        var originRoot,
            basePath,
            instancePath;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base = core.createNode({
                        parent: r.root,
                        base: r.fco
                    }),
                    instance = core.createNode({
                        parent: r.root,
                        base: base
                    });

                basePath = core.getPath(base);
                instancePath = core.getPath(instance);

                originRoot = r.root;
                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                    loadRootAndFCO(rootHash, [basePath, instancePath]),
                ]);
            })
            .then(function (trees) {
                // We've loaded two trees from the same rootHash
                // now let's make changes.

                core.deleteNode(trees[1][basePath]);

                core.setAttribute(trees[0][instancePath], 'name', 'newName');

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var prevDiffs = JSON.parse(JSON.stringify(diffs));
                // console.log('before', JSON.stringify(diffs, null, 2));
                var concatChanges01 = core.tryToConcatChanges(diffs[0], diffs[1]);
                // console.log('after', JSON.stringify(diffs, null, 2));
                var concatChanges10 = core.tryToConcatChanges(diffs[1], diffs[0]);
                expect(prevDiffs).to.deep.equal(diffs);

                expect(concatChanges01.items.length).to.equal(1);
                expect(concatChanges10.items.length).to.equal(1);
            })
            .nodeify(done);
    });

    // Multiple moving
    it('should be able to merge multiple not conflicting but cascading moves', function (done) {
        var originRoot,
            paths = [];

        loadRootAndFCO(context.rootHash)
            .then(function (r) {

                for (var i = 0; i < 4; i += 1) {
                    paths.push(core.getPath(core.createNode({parent: r.root, base: r.fco, relid: 'r' + i})));
                }
                originRoot = r.root;

                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, paths),
                    loadRootAndFCO(rootHash, paths),
                ]);
            })
            .then(function (trees) {

                //move 0 under 1
                core.moveNode(trees[0][paths[0]], trees[0][paths[1]]);
                //move 1 under 2
                core.moveNode(trees[1][paths[1]], trees[1][paths[2]]);

                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var merge = core.tryToConcatChanges(diffs[0], diffs[1]);

                expect(merge.items).to.have.length(0);
            })
            .nodeify(done);
    });

    // Complex inheritance collisions
    it('should be able to merge multiple colliding creations', function (done) {
        var originRoot;

        loadRootAndFCO(context.rootHash)
            .then(function (r) {
                var base;

                base = core.createNode({parent: r.root, base: r.fco, relid: 'b'});
                core.createNode({parent: r.root, base: base, relid: 'i'});

                originRoot = r.root;

                return save(r.root);
            })
            .then(function (rootHash) {
                return Q.all([
                    loadRootAndFCO(rootHash, ['/b']),
                    loadRootAndFCO(rootHash, ['/i']),
                ]);
            })
            .then(function (trees) {

                //create child for base
                core.createNode({parent: trees[0]['/b'], base: trees[0].fco, relid: 'c'});
                //create child for instance
                core.createNode({parent: trees[1]['/i'], base: trees[1].fco, relid: 'c'});
                // Save to ensure the added nodes are persisted.
                return Q.all([
                    save(trees[0].root),
                    save(trees[1].root)
                ])
                    .then(function () {
                        return Q.all([
                            core.generateTreeDiff(originRoot, trees[0].root),
                            core.generateTreeDiff(originRoot, trees[1].root),
                        ]);
                    });
            })
            .then(function (diffs) {
                var merge = core.tryToConcatChanges(diffs[0], diffs[1]);
                expect(merge.items).to.have.length(0);
            })
            .nodeify(done);
    });
});
