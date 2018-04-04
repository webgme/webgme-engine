/*globals require*/
/*eslint-env node, mocha*/

/**
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('../../../_globals.js');


describe.only('USERS REST API', function () {
    'use strict';

    var gmeConfig = testFixture.getGmeConfig(),
        WebGME = testFixture.WebGME,
        expect = testFixture.expect,
        Q = testFixture.Q,
        gmeAuth,
        server,
        agent,
        superagent = testFixture.superagent;


    before(function (done) {
        gmeConfig.authentication.enable = true;

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return Q.allDone([
                    gmeAuth.addUser('guest', 'guest@example.com', 'guest', true, {overwrite: true, data: {d: 1}}),
                    gmeAuth.addUser('admin', 'admin@example.com', 'admin', true, {
                        overwrite: true,
                        siteAdmin: true
                    }),
                    gmeAuth.addUser('disp_user_1', 'd1@mail.com', 'plaintext', false, {
                        overwrite: true,
                        displayName: 'Display One',
                        data: {a: 1}
                    }),
                    gmeAuth.addUser('disp_user_2', 'd1@mail.com', 'plaintext', false, {
                        overwrite: true,
                        displayName: 'Display Two',
                        data: {a: 2}
                    }),
                    gmeAuth.addUser('no_disp_user_1', 'd1@mail.com', 'plaintext', false, {
                        overwrite: true,
                        data: {a: 3}
                    }),
                    gmeAuth.addUser('no_disp_user_2', 'd1@mail.com', 'plaintext', false, {
                        overwrite: true,
                        data: {a: 4}
                    })
                ]);
            })
            .then(function () {
                return Q.allDone([
                    gmeAuth.authorizeByUserId('disp_user_1', 'project', 'create', {
                        read: true,
                        write: true,
                        delete: false
                    }),
                    gmeAuth.authorizeByUserId('disp_user_1', 'unauthorized_project', 'create', {
                        read: false,
                        write: false,
                        delete: false
                    })
                ]);
            })
            .then(function () {
                server = WebGME.standaloneServer(gmeConfig);
                return Q.ninvoke(server, 'start');
            })
            .nodeify(done);
    });

    beforeEach(function () {
        agent = superagent.agent();
    });

    after(function (done) {
        server.stop(function () {
            gmeAuth.unload()
                .nodeify(done);
        });
    });

    it('should let admin to list everyone with full data', function (done) {
        testFixture.logIn(server, agent, 'admin', 'admin')
            .then(function () {
                var deferred = Q.defer();
                agent.get(server.getUrl() + '/api/users')
                    .end(function (err, res) {
                        try {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.have.length(6);
                            res.body.forEach(function (user) {
                                expect(user).to.include.keys(['projects']);
                            });
                        } catch (e) {
                            deferred.reject(e);
                            return;
                        }
                        deferred.resolve();
                    });
                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should let guest to list only itself', function (done) {
        testFixture.logIn(server, agent, 'guest', 'guest')
            .then(function () {
                var deferred = Q.defer();
                agent.get(server.getUrl() + '/api/users')
                    .end(function (err, res) {
                        try {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.have.length(1);
                        } catch (e) {
                            deferred.reject(e);
                            return;
                        }
                        deferred.resolve();
                    });
                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should let regular user to list everyone without project data', function (done) {
        testFixture.logIn(server, agent, 'disp_user_1', 'plaintext')
            .then(function () {
                var deferred = Q.defer();
                agent.get(server.getUrl() + '/api/users')
                    .end(function (err, res) {
                        try {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.have.length(6);
                            res.body.forEach(function (user) {
                                if (user._id === 'disp_user_1') {
                                    expect(user.projects).not.to.eql({});
                                    expect(user.email).not.to.eql('');
                                } else {
                                    expect(user.projects).to.eql({});
                                    expect(user.email).to.eql('');
                                }
                            });
                        } catch (e) {
                            deferred.reject(e);
                            return;
                        }
                        deferred.resolve();
                    });
                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should list only users with displayName', function (done) {
        testFixture.logIn(server, agent, 'admin', 'admin')
            .then(function () {
                var deferred = Q.defer();
                agent.get(server.getUrl() + '/api/users').query({displayName: true})
                    .end(function (err, res) {
                        try {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.have.length(2);
                            res.body.forEach(function (user) {
                                expect(user).to.include.keys(['displayName']);
                            });
                        } catch (e) {
                            deferred.reject(e);
                            return;
                        }
                        deferred.resolve();
                    });
                return deferred.promise;
            })
            .nodeify(done);
    });

    it('should list users with displayName for guest as well', function (done) {
        testFixture.logIn(server, agent, 'guest', 'guest')
            .then(function () {
                var deferred = Q.defer();
                agent.get(server.getUrl() + '/api/users').query({displayName: true})
                    .end(function (err, res) {
                        try {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.have.length(2);
                            res.body.forEach(function (user) {
                                expect(user).to.include.keys(['displayName']);
                            });
                        } catch (e) {
                            deferred.reject(e);
                            return;
                        }
                        deferred.resolve();
                    });
                return deferred.promise;
            })
            .nodeify(done);
    });
});
