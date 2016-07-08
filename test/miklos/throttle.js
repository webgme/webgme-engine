/* jshint node:true, mocha: true, expr:true*/

/**
 * @author kecso / https://github.com/kecso
 */
var testFixture = require('../_globals.js');

describe.only('MiklosTests', function () {
    'use strict';
    this.timeout(120000);
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
        setupForTest = function (projectName) {
            var deferred = Q.defer(),
                context = {};

            storage.openProject({projectId: testFixture.projectName2Id(projectName)})
                .then(function (project) {
                    context.project = project;
                    context.core = new Core(project, {
                        globConf: gmeConfig,
                        logger: testFixture.logger.fork(projectName)
                    });
                    return project.getBranches();
                })
                .then(function (branches) {
                    expect(typeof branches.master).to.equal('string');

                    return Q.ninvoke(context.project,'loadObject',branches.master);
                })
                .then(function (commitObject) {
                    expect(typeof commitObject.root).to.equal('string');
                    TASYNC.call(function (root) {
                        expect(root).not.to.equal(null);
                        context.root = root;
                        deferred.resolve(context);
                    }, context.core.loadRoot(commitObject.root));
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

    it('should traverse small project', function (done) {
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
});