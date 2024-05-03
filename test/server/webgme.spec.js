/*globals requireJS*/
/*eslint-env node, mocha*/

/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../_globals.js');


describe('webgme', function () {
    'use strict';

    var expect = testFixture.expect,
        Q = testFixture.Q,
        logger = testFixture.logger.fork('webgme.spec');

    it('should export public API functions and classes', function () {
        var webGME = testFixture.WebGME;

        expect(webGME).to.have.property('standaloneServer');
        expect(webGME).to.have.property('addToRequireJsPaths');
        expect(webGME).to.have.property('getStorage');
        expect(webGME).to.have.property('getGmeAuth');
        expect(webGME).to.have.property('core');
        expect(webGME).to.have.property('Logger');
        expect(webGME).to.have.property('REGEXP');

        expect(typeof webGME.WorkerManagerBase.prototype.request).to.equal('function');
        expect(typeof webGME.ServerWorkerManager).to.equal('function');
        expect(typeof webGME.AuthorizerBase.prototype.getAccessRights).to.equal('function');
        expect(typeof webGME.WorkerRequests).to.equal('function');
    });

    it('should addToRequireJsPaths', function () {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig();

        // this should not happen because the validator checks it, unless user messes it up from code after
        // the configuration is validated
        gmeConfig.addOn.basePaths = null;
        // has two files with same name and different extension
        gmeConfig.plugin.basePaths.push('./test/server');
        // we have added the same good plugin path multiple times
        gmeConfig.plugin.basePaths.push('./src/plugin/coreplugins');
        gmeConfig.plugin.basePaths.push('./src/plugin/coreplugins');

        gmeConfig.requirejsPaths.myModule2 = './src/plugin';
        webGME.addToRequireJsPaths(gmeConfig);

    });

    it('should throw if path does not exist addToRequireJsPaths', function () {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig();

        function fn() {
            gmeConfig.plugin.basePaths.push('./does_not_exist');
            webGME.addToRequireJsPaths(gmeConfig);
        }

        expect(fn).to.throw(Error, /ENOENT[,:] no such file or directory/);
    });

    it('addToRequireJsPaths should add a path using requirejsPaths', function () {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig();

        gmeConfig.requirejsPaths.mySingleBlob = './src/blob';

        webGME.addToRequireJsPaths(gmeConfig);
        expect(requireJS.s.contexts._.config.paths.mySingleBlob).to.equal('blob');
    });

    it('addToRequireJsPaths should add an array of paths using requirejsPaths', function () {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig();

        gmeConfig.requirejsPaths.myDoubleBlob = ['./src/plugin', './src/blob'];
        webGME.addToRequireJsPaths(gmeConfig);
        expect(requireJS.s.contexts._.config.paths.myDoubleBlob).to.contain('blob', 'plugin');
    });

    it('addToRequireJsPaths should throw a readable exception if requirejsPaths is not an array or string',
        function () {
            var webGME = testFixture.WebGME,
                gmeConfig = testFixture.getGmeConfig();

            gmeConfig.requirejsPaths.myDoubleBlob = {a: 'b'};

            try {
                webGME.addToRequireJsPaths(gmeConfig);
                throw new Error('Should have failed!');
            } catch (e) {
                expect(e.message).to.include('Given requirejsPaths value is not a string nor array');
            }
        }
    );

    it('should getGmeAuth', function (done) {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig();

        webGME.getGmeAuth(gmeConfig)
            .then(function (/*gmeAuth*/) {

            })
            .nodeify(done);
    });

    it('should fail to getGmeAuth if mongo is not running', function (done) {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig();

        this.timeout(5000);

        gmeConfig.mongo.uri = 'mongodb://127.0.0.1:27000/webgme_tests';

        webGME.getGmeAuth(gmeConfig)
            .then(function () {
                done(new Error('should have failed to connect to mongo'));
            })
            .catch(function (err) {
                expect(err.message).to.include('failed to connect to server [127.0.0.1:27000]');
                done();
            })
            .done();
    });

    it('should getStorage', function (done) {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig();

        webGME.getGmeAuth(gmeConfig)
            .then(function (gmeAuth) {
                return webGME.getStorage(logger, gmeConfig, gmeAuth);
            })
            .then(function (/*storage*/) {

            })
            .nodeify(done);
    });

    it('should requestWebGMEToken with auth turned off', function (done) {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig(),
            error,
            server;

        server = webGME.standaloneServer(gmeConfig);

        Q.ninvoke(server, 'start')
            .then(function () {
                return Q.allDone([
                    webGME.utils.requestWebGMEToken(gmeConfig, 'guest', null, null),
                    webGME.utils.requestWebGMEToken(gmeConfig, 'someone', null, null),
                    webGME.utils.requestWebGMEToken(gmeConfig, 'guest', null,
                        'http://localhost:' + gmeConfig.server.port),
                ]);
            })
            .then(function (tokens) {
                expect(tokens).to.deep.equal([undefined, undefined, undefined]);
            })
            .catch(function (err) {
                error = err;
            })
            .finally(function () {
                server.stop(function (err2) {
                    done(error || err2);
                });
            });
    });

    it('should requestWebGMEToken with auth turned on', function (done) {
        var webGME = testFixture.WebGME,
            gmeConfig = testFixture.getGmeConfig(),
            error,
            gmeAuth,
            server;

        gmeConfig.authentication.enable = true;

        server = webGME.standaloneServer(gmeConfig);
        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
            })
            .then(function () {
                return Q.ninvoke(server, 'start');
            })
            .then(function () {
                return Q.allDone([
                    webGME.utils.requestWebGMEToken(gmeConfig, 'guest', null, null),
                    webGME.utils.requestWebGMEToken(gmeConfig, 'guest', null,
                        'http://localhost:' + gmeConfig.server.port),
                    webGME.utils.requestWebGMEToken(gmeConfig, 'admin', 'admin',
                        'http://localhost:' + gmeConfig.server.port),
                ]);
            })
            .then(function (tokens) {
                expect(typeof tokens[0]).to.equal('string');
                expect(typeof tokens[1]).to.equal('string');
                expect(typeof tokens[2]).to.equal('string');

                return webGME.utils.requestWebGMEToken(gmeConfig, 'otherUser')
                    .then(function () {
                        throw new Error('Should have failed!');
                    })
                    .catch(function (err) {
                        try {
                            expect(err.message).to.include('password was not provided');
                        } catch (e) {
                            error = e;
                        }
                    });
            })
            .then(function () {
                return webGME.utils.requestWebGMEToken(gmeConfig, 'admin', 'wrongPass')
                    .then(function () {
                        throw new Error('Should have failed!');
                    })
                    .catch(function (err) {
                        try {
                            expect(err.message).to.include('Unauthorized');
                        } catch (e) {
                            error = e;
                        }
                    });
            })
            .then(function () {
                return webGME.utils.requestWebGMEToken(gmeConfig, 'admin', 'admin', 'http://localhost:9999')
                    .then(function () {
                        throw new Error('Should have failed!');
                    })
                    .catch(function (err) {
                        try {
                            expect(err.message).to.include('ECONNREFUSED');
                        } catch (e) {
                            error = e;
                        }
                    });
            })
            .catch(function (err) {
                error = err;
            })
            .finally(function () {
                server.stop(function (err2) {
                    gmeAuth.unload(function (err3) {
                        done(error || err2 || err3);
                    });
                });
            });
    });
});
