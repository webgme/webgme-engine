/* jshint node:true, mocha: true, expr:true*/

/**
 * @author kecso / https://github.com/kecso
 */
var testFixture = require('../_globals.js');

describe.only('MiklosTests', function () {
    'use strict';
    this.timeout(1200000);
    var gmeConfig = testFixture.getGmeConfig(),
        logger = testFixture.logger.fork('MiklosTest'),
        Q = testFixture.Q,
        storage,
        expect = testFixture.expect,
        Rel = testFixture.requirejs('common/core/corerel'),
        Tree = testFixture.requirejs('common/core/coretree'),
        TASYNC = testFixture.requirejs('common/core/tasync'),
        Core = function (s, options) {
            return new Rel(new Tree(s, options), options);
        },
        FullCore = testFixture.requirejs('common/core/coreQ'),
        traverse = function (core, root, visitFn, callback) {
            visitFn = TASYNC.wrap(visitFn);

            var loadChildren = function (node) {
                var children = core.loadChildren(node),
                    visitRes = visitFn(node);

                return TASYNC.call(procChildren, node, children, visitRes);
            };

            var procChildren = function (node, children, visitRes) {
                var res = [];
                for (var i = 0; i < children.length; i++) {
                    res[i] = loadChildren(children[i]);
                }
                return TASYNC.lift(res);
            };

            TASYNC.unwrap(loadChildren)(root, callback);
        },
        setupForTest = function (projectName, needFullCore) {
            var deferred = Q.defer(),
                context = {};

            storage.openProject({projectId: testFixture.projectName2Id(projectName)})
                .then(function (project) {
                    context.project = project;
                    if (needFullCore === true) {
                        context.core = new FullCore(project, {
                            globConf: gmeConfig,
                            logger: testFixture.logger.fork(projectName)
                        });
                    } else {
                        context.core = new Core(project, {
                            globConf: gmeConfig,
                            logger: testFixture.logger.fork(projectName)
                        });
                    }
                    return project.getBranches();
                })
                .then(function (branches) {
                    expect(typeof branches.master).to.equal('string');

                    context.commitHash = branches.master;
                    return Q.ninvoke(context.project, 'loadObject', branches.master);
                })
                .then(function (commitObject) {
                    expect(typeof commitObject.root).to.equal('string');
                    if (needFullCore) {
                        context.core.loadRoot(commitObject.root, function (err, root) {
                            expect(err).to.eql(null);
                            expect(root).not.to.equal(null);
                            context.root = root;
                            deferred.resolve(context);
                        });
                    } else {
                        TASYNC.call(function (root) {
                            expect(root).not.to.equal(null);
                            context.root = root;
                            deferred.resolve(context);
                        }, context.core.loadRoot(commitObject.root));
                    }
                })
                .catch(deferred.reject);

            return deferred.promise;
        },
        gmeAuth;

    before(function (done) {
        testFixture.getGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMongoStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                return storage.getProjects({});
            })
            .then(function (result) {
                // console.log(result);
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

    it.skip('should traverse small project', function (done) {
        var context,
            counter = 0;
        console.time('test');
        setupForTest('small')
            .then(function (context_) {
                context = context_;
                return Q.nfcall(traverse, context.core, context.root, function (node, next) {
                    counter += 1;
                    next();
                });
            })
            .then(function () {
                console.log('numOfNodes:', counter);
                console.timeEnd('test');
            })
            .nodeify(done);
    });

    it('should traverse midsize project', function (done) {
        var context,
            counter = 0;
        console.time('test');
        setupForTest('midsize')
            .then(function (context_) {
                context = context_;
                return Q.nfcall(traverse, context.core, context.root, function (node, next) {
                    counter += 1;
                    next();
                });
            })
            .then(function () {
                console.log('numOfNodes:', counter);
                console.timeEnd('test');
            })
            .nodeify(done);
    });

    it.skip('should traverse midsize project with full core stack', function (done) {
        var context,
            counter = 0;
        console.time('test');
        setupForTest('midsize', true)
            .then(function (context_) {
                context = context_;
                return context.core.traverse(context.root, {}, function (node, next) {
                    console.log(context.core.getPath(node));
                    counter += 1;
                    next();
                });
            })
            .then(function () {
                console.log('numOfNodes:', counter);
                console.timeEnd('test');
            })
            .nodeify(done);
    });

    it.skip('should copy a huge object', function (done) {
        var context,
            parent,
            prototype;

        console.time('test');
        setupForTest('large', true)
            .then(function (context_) {
                context = context_;
                return context.core.loadChild(context.root, 'G');
            })
            .then(function (parent_) {
                expect(parent_).not.to.eql(null);

                parent = parent_;
                return context.core.loadChild(parent, 'e');
            })
            .then(function (prototype_) {
                expect(prototype_).not.to.equal(null);

                prototype = prototype_;

                console.log('loading done - start copy');
                console.time('copy');
                context.core.copyNode(prototype, parent);
                console.timeEnd('copy');

                console.time('persist');
                var persisted = context.core.persist(context.root);
                console.timeEnd('persist');

                console.time('commit');
                return context.project.makeCommit(
                    'master',
                    [context.commitHash],
                    context.core.getHash(context.root),
                    persisted.objects,
                    'copyTest'
                );
            })
            .then(function (commitResult) {
                console.timeEnd('commit');
                console.log(commitResult);
                console.timeEnd('test');
            })
            .nodeify(done);
    });
});