/*globals requirejs, expect, console, before*/
/*eslint-env browser, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author kesco / https://github.com/kesco
 * @author pmeijer / https://github.com/pmeijer
 */

var WebGMEGlobal = {}; //eslint-disable-line

describe.only('Client Core Call Sequence', function () {
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
            //console.log('##### created', branchName);
            client.selectBranch(branchName, null, function () {
                var user = {},
                    userId = testId;
                client.addUI(user, eventCallback, userId);
                client.updateTerritory(userId, patternObject);
            });
        });
    }

    it('setAttribute should dispatch one call', function (done) {
        var testState = 'init',
            testId = 'setAttributeLone';

        currentTestId = testId;

        setUpForTest(
            testId,
            { '/960660211': { children: 1 } },
            function (_client, callSequence) {
                try {
                    expect(callSequence.length).to.equal(1);
                    expect(callSequence[0].name).to.equal('setAttribute');
                    done();
                } catch (err) {
                    done(err);
                }
            },
            function () {
                if (testState === 'init') {
                    testState = 'checking';
                    client.setAttribute('/960660211', 'name', 'checkModified', 'basic set attribute test');
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
            function (_client, callSequence) {
                try {
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
                if (testState === 'init') {
                    testState = 'checking';
                    client.setAttribute('/960660211', 'name', 'checkModified', 'basic set attribute test');
                    client.setRegistry('/960660211', 'someReg', 'bah', 'basic set attribute test');
                    return;
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
            function (_client, callSequence) {
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
});