/*globals requireJS*/
/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../../_globals');

describe('crosscuts', function () {
    'use strict';

    var logger = testFixture.logger.fork('crosscuts'),
        gmeConfig = testFixture.getGmeConfig(),
        storage,
        expect = testFixture.expect,
        Q = testFixture.Q,
        crosscuts = requireJS('common/core/users/crosscuts'),
        projectName = 'CoreCrosscuts',
        ir,
        gmeAuth;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: 'seeds/SignalFlowSystem.webgmex',
                    projectName: projectName,
                    logger: logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult) {
                ir = importResult;
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

    it('should throw for all methods if not initialized', function () {
        var cc =  requireJS('common/core/users/crosscuts');
        Object.keys(cc).forEach(function (methodName) {
            var threw;
            if (methodName === 'initialize') {
                return;
            }

            try {
                cc[methodName](ir.rootNode, ir.rootNode, ir.rootNode, ir.rootNode);
            } catch (err) {
                threw = err;
            }

            if (threw) {
                expect(threw.message).to.equal('Crosscut module has not been initialized!');
            } else {
                throw new Error('Method ' + methodName + ' did not throw');
            }
        });
    });

    it('getInfo should return array at rootNode', function () {
        crosscuts.initialize(ir.core);
        var res = crosscuts.getInfo(ir.rootNode);
        expect(res instanceof Array).to.equal(true);
        expect(res.length).to.equal(2);
    });

    it('getIds should return two ids at rootNode', function () {
        crosscuts.initialize(ir.core);
        var res = crosscuts.getIds(ir.rootNode);
        expect(res instanceof Array).to.equal(true);
        expect(res.length).to.equal(2);
    });

    it('getTitles should return two titles at rootNode', function () {
        crosscuts.initialize(ir.core);
        var res = crosscuts.getTitles(ir.rootNode);
        expect(res instanceof Array).to.equal(true);
        expect(res.length).to.equal(2);
    });

    it('getInfo/Ids/Titles should return empty array if none defined', function () {
        crosscuts.initialize(ir.core);
        var res = crosscuts.getInfo(ir.core.getFCO(ir.rootNode));
        expect(res instanceof Array).to.equal(true);
        expect(res.length).to.equal(0);

        res = crosscuts.getIds(ir.core.getFCO(ir.rootNode));
        expect(res instanceof Array).to.equal(true);
        expect(res.length).to.equal(0);

        res = crosscuts.getTitles(ir.core.getFCO(ir.rootNode));
        expect(res instanceof Array).to.equal(true);
        expect(res.length).to.equal(0);
    });

    it('getIdFromTitle should return id', function () {
        crosscuts.initialize(ir.core);
        var res = crosscuts.getInfo(ir.rootNode);
        expect(res instanceof Array).to.equal(true);
        expect(res.length).to.equal(2);

        expect(crosscuts.getIdFromTitle(ir.rootNode, res[0].title)).to.equal(res[0].SetID);
    });

    it('getIdFromTitle should throw CoreIllegalArgumentError if title does not exist', function () {
        crosscuts.initialize(ir.core);
        var threw = false;

        try {
            crosscuts.getIdFromTitle(ir.rootNode, 'Does Not Exist');
        } catch (e) {
            threw = e;
        }

        if (threw) {
            expect(threw.name).to.equal('CoreIllegalArgumentError');
            expect(threw.message).to.include('does not exist among crosscuts');
        } else {
            throw new Error('Did not throw');
        }
    });

    it('getMemberPaths should return array of node paths', function () {
        crosscuts.initialize(ir.core);
        var ids = crosscuts.getIds(ir.rootNode);

        var res = crosscuts.getMemberPaths(ir.rootNode, ids[0]);

        expect(res instanceof Array).to.equal(true);
        expect(res.length).to.equal(12);
    });

    it('getMemberPosition should return position', function () {
        crosscuts.initialize(ir.core);
        var ids = crosscuts.getIds(ir.rootNode);

        var memberPaths = crosscuts.getMemberPaths(ir.rootNode, ids[0]);

        var res = crosscuts.getMemberPosition(ir.rootNode, ids[0], memberPaths[0]);
        expect(typeof res.x).to.equal('number');
        expect(typeof res.y).to.equal('number');
    });

    it('getMemberPosition should throw CoreIllegalArgumentError if crosscut does not exist', function () {
        crosscuts.initialize(ir.core);
        var threw = false;

        try {
            crosscuts.getMemberPosition(ir.rootNode, 'Does Not Exist', '/some/Path');
        } catch (e) {
            threw = e;
        }

        if (threw) {
            expect(threw.name).to.equal('CoreIllegalArgumentError');
            expect(threw.message).to.include('Crosscut does not exist');
        } else {
            throw new Error('Did not throw');
        }
    });

    it('getMemberPosition should throw CoreIllegalArgumentError if memberPath not a member', function () {
        crosscuts.initialize(ir.core);
        var threw = false;
        var ids = crosscuts.getIds(ir.rootNode);

        try {
            crosscuts.getMemberPosition(ir.rootNode, ids[0], '/some/Path');
        } catch (e) {
            threw = e;
        }

        if (threw) {
            expect(threw.name).to.equal('CoreIllegalArgumentError');
            expect(threw.message).to.include('does not exist in crosscut');
        } else {
            throw new Error('Did not throw');
        }
    });

    // Setters
    it('createCrosscut should create new crosscut at the end', function (done) {
        crosscuts.initialize(ir.core);

        testFixture.loadRootNodeFromCommit(ir.project, ir.core, ir.commitHash)
            .then(function (root) {
                var id = crosscuts.createCrosscut(root, 'New CC');
                var ccs = crosscuts.getInfo(root);

                expect(ccs.length).to.equal(3);
                expect(ccs[2]).to.deep.equal({
                    SetID: id,
                    title: 'New CC',
                    order: 2
                });
            })
            .nodeify(done);
    });

    it('createCrosscut should create new crosscut at 1', function (done) {
        crosscuts.initialize(ir.core);

        testFixture.loadRootNodeFromCommit(ir.project, ir.core, ir.commitHash)
            .then(function (root) {
                var id = crosscuts.createCrosscut(root, 'New CC', 1);
                var ccs = crosscuts.getInfo(root);

                expect(ccs.length).to.equal(3);
                expect(ccs[1]).to.deep.equal({
                    SetID: id,
                    title: 'New CC',
                    order: 1
                });

                expect(ccs.map(function (c) {
                    return c.order;
                })).to.deep.equal([0, 1, 2]);

                // Just to add some coverage...
                crosscuts.deleteCrosscut(root, crosscuts.createCrosscut(root, 'a', 0));
            })
            .nodeify(done);
    });

    it('deleteCrosscut should remove and reset order correctly', function (done) {
        crosscuts.initialize(ir.core);

        testFixture.loadRootNodeFromCommit(ir.project, ir.core, ir.commitHash)
            .then(function (root) {
                var ids = crosscuts.getIds(root);

                crosscuts.deleteCrosscut(root, ids[0]);

                var res = crosscuts.getInfo(root);

                expect(res.length).to.equal(1);
                expect(res[0].order).to.equal(0);
            })
            .nodeify(done);
    });

    it('add and delMember', function (done) {
        crosscuts.initialize(ir.core);

        testFixture.loadRootNodeFromCommit(ir.project, ir.core, ir.commitHash)
            .then(function (root) {
                var ids = crosscuts.getIds(root);
                var initMembers = crosscuts.getMemberPaths(root, ids[0]);

                crosscuts.addMember(root, ids[0], ir.core.getFCO(root), {x: 10, y: 10});

                var res = crosscuts.getMemberPaths(root, ids[0]);

                expect(res.length).to.equal(initMembers.length + 1);

                expect(crosscuts.getMemberPosition(root, ids[0], ir.core.getFCO(root))).to.deep.equal({x: 10, y: 10});

                crosscuts.delMember(root, ids[0], ir.core.getFCO(root));

                res = crosscuts.getMemberPaths(root, ids[0]);

                expect(res.length).to.equal(initMembers.length);
            })
            .nodeify(done);
    });

    it('addMember and fall back on default pos', function (done) {
        crosscuts.initialize(ir.core);

        testFixture.loadRootNodeFromCommit(ir.project, ir.core, ir.commitHash)
            .then(function (root) {
                var ids = crosscuts.getIds(root);
                crosscuts.addMember(root, ids[0], ir.core.getFCO(root));
                expect(crosscuts.getMemberPosition(root, ids[0], ir.core.getFCO(root))).to.deep.equal({x: 100, y: 100});
            })
            .nodeify(done);
    });

    it('createCrosscut should throw at invalid order', function (done) {
        crosscuts.initialize(ir.core);

        testFixture.loadRootNodeFromCommit(ir.project, ir.core, ir.commitHash)
            .then(function (root) {
                var threw;

                try {
                    crosscuts.createCrosscut(root, 'New CC', -1);
                } catch (e) {
                    threw = e;
                }

                expect(!!threw).to.equal(true);
                expect(threw.message).to.include('Provided order must be >= 0');

                threw = null;

                try {
                    crosscuts.createCrosscut(root, 'New CC', 10);
                } catch (e) {
                    threw = e;
                }

                expect(!!threw).to.equal(true);
                expect(threw.message).to.include('Provided order is greater than the largest possible index');
            })
            .nodeify(done);
    });

    it('getIdFromTitle should throw if title is shared', function (done) {
        crosscuts.initialize(ir.core);

        testFixture.loadRootNodeFromCommit(ir.project, ir.core, ir.commitHash)
            .then(function (root) {
                var threw;
                crosscuts.createCrosscut(root, 'Crosscut 1');

                try {
                    crosscuts.getIdFromTitle(root, 'Crosscut 1');
                } catch (e) {
                    threw = e;
                }

                expect(!!threw).to.equal(true);
                expect(threw.message).to.include('appears in more than one crosscut');
            })
            .nodeify(done);
    });
});