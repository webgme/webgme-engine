/*globals requirejs, expect*/
/*eslint-env browser, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var WebGMEGlobal = {}; // eslint-disable-line

describe('Server worker requests', function () {
    'use strict';

    var projectName2Id = function (projectName, gmeConfig, client) {
            return gmeConfig.authentication.guestAccount + client.CONSTANTS.STORAGE.PROJECT_ID_SEP +
                projectName;
        },
        Q,
        client,
        superagent,
        gmeConfig;

    before(function (done) {
        this.timeout(10000);
        requirejs(['q', 'client/client', 'text!gmeConfig.json', 'superagent'],
            function (Q_, Client,
                      gmeConfigJSON,
                      superagent_) {
                Q = Q_;
                gmeConfig = JSON.parse(gmeConfigJSON);
                client = new Client(gmeConfig);
                superagent = superagent_;

                Q.ninvoke(client, 'connectToDatabase')
                    .then(function () {
                        return Q.ninvoke(client, 'selectProject',
                            projectName2Id('ServerWorkerRequests', gmeConfig, client));
                    })
                    .nodeify(done);
            });
    });

    it('should checkMetaRules starting from the rootNode', function (done) {
        Q.ninvoke(client.workerRequests, 'checkMetaRules', [''], true)
            .then(function (result) {
                expect(result.length).to.equal(1);
                expect(result[0].hasViolation).to.equal(false);
            })
            .nodeify(done);
    });

    it('should not checkCustomConstraints when it is disabled', function (done) {
        Q.ninvoke(client.workerRequests, 'checkCustomConstraints', [''], true)
            .then(function () {
                done(new Error('Should have failed!'));
            })
            .catch(function (err) {
                expect(err.message).to.include('Custom constraints is not enabled');
                done();
            })
            .done();
    });

    it('should addLibrary from seed', function (done) {
        Q.ninvoke(client.workerRequests, 'addLibrary', 'myLib', 'EmptyProject')
            .then(function (result) {
                expect(result.status).to.equal('SYNCED');
            })
            .nodeify(done);
    });

    it('should addLibrary from blob-hash', function (done) {
        superagent.get('/api/seeds/EmptyProject', function (err, res) {
            if (err) {
                done(err);
                return;
            }

            Q.ninvoke(client.workerRequests, 'addLibrary', 'myLib2', res.body.blobHash)
                .then(function (result) {
                    expect(result.status).to.equal('SYNCED');
                })
                .nodeify(done);
        });
    });

    it('should updateLibrary from seed', function (done) {
        Q.ninvoke(client.workerRequests, 'updateLibrary', 'myLib', 'ActivePanels')
            .then(function (result) {
                expect(result.status).to.equal('SYNCED');
            })
            .nodeify(done);
    });

    it('should updateProject from seed', function (done) {
        Q.ninvoke(client.workerRequests, 'updateProjectFromFile',
            projectName2Id('ServerWorkerRequests', gmeConfig, client),
            'updateProjectFromFile',
            'ActivePanels'
        )
            .then(function (result) {
                expect(result.status).to.equal('SYNCED');
            })
            .nodeify(done);
    });
});