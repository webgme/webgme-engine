/*globals requirejs, expect */
/*eslint-env browser, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var WebGMEGlobal = {}; //eslint-disable-line

describe('Client Core Call Sequence', function () {
    'use strict';

    var Client,
        gmeConfig,
        client,
        currentTestId,
        projectId,
        projectName = 'CoreCallSequence',
        eventHandler,
        baseCommitHash;

    function projectName2Id(projectName, gmeConfig, client) {
        return gmeConfig.authentication.guestAccount + client.CONSTANTS.STORAGE.PROJECT_ID_SEP +
            projectName;
    }

    before(function (done) {
        this.timeout(10000);
        requirejs(['client/client', 'text!gmeConfig.json'], function (Client_, gmeConfigJSON) {
            Client = Client_;
            gmeConfig = JSON.parse(gmeConfigJSON);
            client = new Client(gmeConfig);
            projectId = projectName2Id(projectName, gmeConfig, client);

            client.connectToDatabase(function (err) {
                if (err) {
                    done(err);
                    return;
                }
                client.selectProject(projectId, null, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }

                    baseCommitHash = client.getActiveCommitHash();
                    done();
                });
            });
        });
    });

    after(function (done) {
        client.disconnectFromDatabase(done);
    });

    afterEach(function (done) {
        var branchHash = client.getActiveCommitHash();
        client.removeUI(currentTestId);
        client.removeEventListener(client.CONSTANTS.CORE_CALL_SEQUENCE, eventHandler);
        client.selectBranch('master', null, function (err) {
            if (err) {
                done(err);
                return;
            }
            client.deleteBranch(projectId, currentTestId, branchHash, done);
        });
    });

    function setUpForTest(testId, patternObject, onCoreCallSequence, eventCallback) {
        var branchName = testId;
        client.addEventListener(client.CONSTANTS.CORE_CALL_SEQUENCE, onCoreCallSequence);
        eventHandler = onCoreCallSequence;

        client.createBranch(projectId, branchName, baseCommitHash, function (err) {
            expect(err).to.equal(null);
            client.selectBranch(branchName, null, function () {
                var user = {},
                    userId = testId;
                client.addUI(user, eventCallback, userId);
                client.updateTerritory(userId, patternObject);
            });
        });
    }


    it('dispatched event should contain all metadata', function (done) {
        var testState = 'init',
            testId = 'eventDataCheck';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, eventData) {
                try {
                    expect(eventData.projectId).to.equal('guest+CoreCallSequence');
                    expect(eventData.branchName).to.equal(testId);
                    expect(eventData.prevRootHash.startsWith('#')).to.equal(true);
                    expect(eventData.prevCommitHash.startsWith('#')).to.equal(true);
                    expect(eventData.commitObject._id.startsWith('#')).to.equal(true);
                    expect(eventData.commitObject.root.startsWith('#')).to.equal(true);

                    expect(eventData.prevRootHash === eventData.commitObject.root).to.equal(false);
                    expect(eventData.prevCommitHash === eventData.commitObject._id).to.equal(false);

                    expect(eventData.commitStatus).to.equal('SYNCED');
                    expect(eventData.callSequence instanceof Array).to.equal(true);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.setAttribute('/960660211', 'name', 'checkModified', 'set attribute test');
                    return;
                }
            });
    });


    it('setAttribute should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'setAttributeLone';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('setAttribute');
                    expect(c.args[0]).to.equal('/960660211');
                    expect(c.args[1]).to.equal('name');
                    expect(c.args[2]).to.equal('checkModified');
                    expect(c.args[3]).to.equal('set attribute test');
                    expect(c.return).to.equal(undefined);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.setAttribute('/960660211', 'name', 'checkModified', 'set attribute test');
                    return;
                }
            });
    });

    it('setAttribute followed by setRegistry should dispatch two separate times', function (done) {
        var testState = 'init',
            testId = 'setAttributeAndSetRegistry',
            cnt = 0;

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, eventData) {
                try {
                    // console.log(JSON.stringify(eventData, null, 2));
                    const callSequence = eventData.callSequence;
                    expect(callSequence.length).to.equal(1);
                    cnt += 1;
                    if (cnt === 1) {
                        expect(callSequence[0].name).to.equal('setAttribute');
                    } else {
                        expect(callSequence[0].name).to.equal('setRegistry');
                        done();
                    }
                } catch (err) {
                    done(err);
                }
            },
            function () {
                // console.log(testState);
                if (testState === 'init') {
                    testState = 'checking';
                    client.setAttribute('/960660211', 'name', 'checkModified', 'basic set attribute test');
                } else if (testState === 'checking') {
                    testState = 'done';
                    setTimeout(() => {
                        client.setRegistry('/960660211', 'someReg', 'bah', 'basic set attribute test');
                    });
                }
            });
    });

    it('setAttribute and setRegistry within transaction should dispatch once', function (done) {
        var testState = 'init',
            testId = 'setAttributeAndSetRegistry';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(2);
                    expect(callSequence[0].name).to.equal('setAttribute');
                    expect(callSequence[1].name).to.equal('setRegistry');
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.startTransaction();
                    client.setAttribute('/960660211', 'name', 'checkModified', 'basic set attribute test');
                    client.setRegistry('/960660211', 'someReg', 'bah', 'basic set attribute test');
                    client.completeTransaction();
                    return;
                }
            });
    });

    it('delAttribute should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'delAttribute';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('delAttribute');
                    expect(c.args[0]).to.equal('/960660211');
                    expect(c.args[1]).to.equal('name');
                    expect(c.return).to.equal(undefined);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.delAttribute('/960660211', 'name');
                    return;
                }
            });
    });

    it('delRegistry should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'delRegistry';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('delRegistry');
                    expect(c.args[0]).to.equal('/960660211');
                    expect(c.args[1]).to.equal('pos');
                    expect(c.return).to.equal(undefined);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.delRegistry('/960660211', 'pos');
                    return;
                }
            });
    });

    it('delRegistry should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'delRegistry';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('delRegistry');
                    expect(c.args[0]).to.equal('/960660211');
                    expect(c.args[1]).to.equal('pos');
                    expect(c.return).to.equal(undefined);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.delRegistry('/960660211', 'pos');
                    return;
                }
            });
    });

    it('copyNode should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'copyNode';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('copyNode');
                    expect(c.args[0]).to.equal('/960660211/1365653822');
                    expect(c.args[1]).to.equal('');
                    expect(typeof c.return).to.equal('string');
                    expect(c.return.length >= 2).to.equal(true);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.copyNode('/960660211/1365653822', '');
                    return;
                }
            });
    });

    it('copyMoreNodes should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'copyMoreNodes';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('copyMoreNodes');
                    expect(c.args[0]).to.deep.equal({
                        parentId: '',
                        '/960660211/1365653822': {},
                        '/960660211/2141283821': {}
                    });
                    expect(c.args[1]).to.equal('herro');
                    // c.return, e.g. {"/960660211/1365653822":"/U","/960660211/2141283821":"/2"}
                    expect(typeof c.return).to.equal('object');
                    expect(Object.keys(c.return).sort())
                        .to.deep.equal(['/960660211/1365653822', '/960660211/2141283821']);
                    expect(c.return['/960660211/1365653822'].split('/').length).to.equal(2);
                    expect(c.return['/960660211/2141283821'].split('/').length).to.equal(2);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.copyMoreNodes({
                        parentId: '',
                        '/960660211/1365653822': {},
                        '/960660211/2141283821': {}
                    }, 'herro');
                    return;
                }
            });
    });

    it('moveMoreNodes should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'moveMoreNodes';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('moveMoreNodes');
                    expect(c.args[0]).to.deep.equal({
                        parentId: '',
                        '/960660211/1365653822': {},
                        '/960660211/2141283821': {}
                    });
                    expect(c.args[1]).to.equal('herro there');
                    // In this case we know there's no conflict among relative-ids in the parent
                    // and we can assume the results are the same.
                    expect(c.return).to.deep.equal({
                        '/960660211/1365653822': '/1365653822',
                        '/960660211/2141283821': '/2141283821'
                    });
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.moveMoreNodes({
                        parentId: '',
                        '/960660211/1365653822': {},
                        '/960660211/2141283821': {}
                    }, 'herro there');
                    return;
                }
            });
    });

    it('createChildren should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'createChildren';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('createChildren');
                    expect(c.args[0]).to.deep.equal({
                        parentId: '',
                        '/960660211/1365653822': {},
                        '/960660211/2141283821': {}
                    });
                    expect(c.args[1]).to.equal('why herro there');
                    expect(typeof c.return).to.equal('object');
                    expect(Object.keys(c.return).sort())
                        .to.deep.equal(['/960660211/1365653822', '/960660211/2141283821']);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.createChildren({
                        parentId: '',
                        '/960660211/1365653822': {},
                        '/960660211/2141283821': {}
                    }, 'why herro there');
                    return;
                }
            });
    });

    it('deleteNode should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'deleteNode';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('deleteNode');
                    expect(c.args[0]).to.equal('/960660211/1365653822');
                    expect(c.args[1]).to.equal('why herro there sir');
                    expect(typeof c.return).to.equal('undefined');
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.deleteNode('/960660211/1365653822', 'why herro there sir');
                    return;
                }
            });
    });

    it('deleteNodes should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'deleteNodes';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('deleteNodes');
                    expect(c.args[0]).to.deep.equal(['/960660211/1365653822', '/960660211/2141283821']);
                    expect(c.args[1]).to.equal('why herro there sirs');
                    expect(typeof c.return).to.equal('undefined');
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.deleteNodes(['/960660211/1365653822', '/960660211/2141283821'], 'why herro there sirs');
                    return;
                }
            });
    });

    it('createNode should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'createNode';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('createNode');
                    expect(c.args[0]).to.deep.equal({
                        parentId: '',
                        baseId: '/960660211/1365653822',
                        relid: 'zzz'
                    });
                    expect(c.args[1]).to.deep.equal({ registry: { position: { x: 100, y: 100 } } });
                    expect(c.args[2]).to.equal('msg');
                    expect(c.return).to.equal('/zzz');
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.createNode({
                        parentId: '',
                        baseId: '/960660211/1365653822',
                        relid: 'zzz'
                    }, {}, 'msg');
                    return;
                }
            });
    });

    it('moveNode should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'moveNode';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('moveNode');
                    expect(c.args[0]).to.equal('/960660211/1365653822');
                    expect(c.args[1]).to.equal('');
                    expect(c.args[2]).to.equal('msg commit');
                    expect(typeof c.return).to.equal('string');
                    // No collision so we can assume same relative id.
                    expect(c.return).to.equal('/1365653822');
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.moveNode('/960660211/1365653822', '', 'msg commit');
                    return;
                }
            });
    });

    it('copyNodes should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'copyNodes';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, { callSequence }) {
                try {
                    expect(callSequence.length).to.equal(1);
                    const c = callSequence[0];
                    expect(c.name).to.equal('copyNodes');
                    expect(c.args[0]).to.deep.equal(['/960660211/1365653822', '/960660211/2141283821']);
                    expect(c.args[1]).to.deep.equal('');
                    expect(c.args[2]).to.equal('commie msg');
                    // c.return, e.g. ['/5', '/8'] 
                    expect(c.return instanceof Array).to.equal(true);
                    expect(c.return.length).to.equal(2);
                    expect(c.return[0].split('/').length).to.equal(2);
                    expect(c.return[1].split('/').length).to.equal(2);
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.copyNodes(['/960660211/1365653822', '/960660211/2141283821'], '', 'commie msg');
                    return;
                }
            });
    });

    // TODO: Finish up more tests as needed
});