/*globals require*/
/*eslint-env node, mocha*/

/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../../_globals.js');


describe('USER REST API', function () {
    'use strict';

    var gmeConfig = testFixture.getGmeConfig(),
        WebGME = testFixture.WebGME,
        expect = testFixture.expect,
        Q = testFixture.Q,
        fs = require('fs'),
        jwt = require('jsonwebtoken'),
        privateKey,


        superagent = testFixture.superagent;
    const assert = require('assert').strict;


    describe('USER SPECIFIC API', function () {
        var gmeAuth;

        before(function (done) {
            this.timeout(4000);
            var gmeAuthConfig = JSON.parse(JSON.stringify(gmeConfig));
            gmeAuthConfig.authentication.enable = true;
            testFixture.clearDBAndGetGMEAuth(gmeAuthConfig)
                .then(function (gmeAuth_) {
                    gmeAuth = gmeAuth_;
                    return Q.allDone([
                        gmeAuth.addUser('guest', 'guest@example.com', 'guest', true, {overwrite: true, data: {d: 1}}),
                        gmeAuth.addUser('admin', 'admin@example.com', 'admin', true, {
                            overwrite: true,
                            siteAdmin: true
                        }),
                        gmeAuth.addUser('user', 'user@example.com', 'plaintext', true, {overwrite: true}),
                        gmeAuth.addUser('user2', 'user2@example.com', 'plaintext', true, {
                            overwrite: true,
                            data: {d: 1}
                        }),
                        gmeAuth.addUser('user_to_delete', 'user@example.com', 'plaintext', true, {overwrite: true}),
                        gmeAuth.addUser('self_delete_1', 'user@example.com', 'plaintext', true, {overwrite: true}),
                        gmeAuth.addUser('self_delete_2', 'user@example.com', 'plaintext', true, {overwrite: true}),
                        gmeAuth.addUser('user_to_modify', 'user@example.com', 'plaintext', true,
                            {overwrite: true, data: {d: 1}}),
                        gmeAuth.addUser('user_without_create', 'user@example.com', 'plaintext', false, {
                            overwrite: true
                        }),
                        gmeAuth.addUser('user_w_data', 'e@mail.com', 'plaintext', false, {overwrite: true}),
                        gmeAuth.addUser('user_w_data1', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: 1, array: [1, 2, 3]}
                        }),
                        gmeAuth.addUser('user_w_nesteddata1', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: {b: 1}, 'a/c': 1}
                        }),
                        gmeAuth.addUser('user_w_data2', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: 1}
                        }),
                        gmeAuth.addUser('user_w_data3', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: 1}
                        }),
                        gmeAuth.addUser('user_w_data4', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: 1}
                        }),
                        gmeAuth.addUser('user_w_data5', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: 1}
                        }),
                        gmeAuth.addUser('user_w_data6', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: 1}
                        }),
                        gmeAuth.addUser('user_w_data7', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: 1}
                        }),
                        gmeAuth.addUser('user_w_data8', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            data: {a: 1}
                        }),
                        gmeAuth.addUser('user_w_settings1', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_w_settings2', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_w_settings3', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_w_settings4', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_w_c_settings1', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_w_c_settings2', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_w_c_settings3', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_w_c_settings4', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_w_c_settings5', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_settings1', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_settings2', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_settings3', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_settings4', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_c_settings1', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_c_settings2', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_c_settings3', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_c_settings4', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('users_w_c_settings5', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}}
                        }),
                        gmeAuth.addUser('user_not_in_db', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1}}
                        }),
                        gmeAuth.addUser('user_not_in_db2', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            settings: {comp1: {a: 1}}
                        }),
                        gmeAuth.addUser('user_disabled_but_has_token', 'e@mail.com', 'plaintext', false, {
                            overwrite: true
                        }),
                        gmeAuth.addUser('disabled_user_at_start', 'e@mail.com', 'plaintext', false, {
                            overwrite: true,
                            disabled: true
                        })
                    ]);
                })
                .then(function () {
                    return Q.allDone([
                        gmeAuth.authorizeByUserId('user', 'project', 'create', {
                            read: true,
                            write: true,
                            delete: false
                        }),
                        gmeAuth.authorizeByUserId('user', 'unauthorized_project', 'create', {
                            read: false,
                            write: false,
                            delete: false
                        })
                    ]);
                })
                .nodeify(done);
        });

        after(function (done) {
            gmeAuth.unload()
                .nodeify(done);
        });

        describe('auth off, allowGuests false', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = false;
                gmeConfig.authentication.allowGuests = false;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            // NO AUTH methods
            it('should get api links /api', function (done) {
                agent.get(server.getUrl() + '/api').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    expect(res.body.hasOwnProperty('api_documentation_url')).true;
                    expect(res.body.hasOwnProperty('source_code_documentation_url')).true;
                    done();
                });
            });

            it('should get api documentation link', function (done) {
                agent.get(server.getUrl() + '/api').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    expect(res.body.hasOwnProperty('api_documentation_url')).true;
                    agent.get(res.body.api_documentation_url).end(function (err, res) {
                        expect(res.status).equal(200, err);
                        done();
                    });
                });
            });

            it('should get api v1 links /api/v1', function (done) {
                agent.get(server.getUrl() + '/api/v1').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    done();
                });
            });

            it('should return with 404 for any non resource that does not exist /api/does_not_exist', function (done) {
                agent.get(server.getUrl() + '/api/does_not_exist').end(function (err, res) {
                    expect(res.status).equal(404, err);
                    done();
                });
            });

            it('should get all users /api/v1/users', function (done) {
                agent.get(server.getUrl() + '/api/v1/users').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    //expect(res.body.length).equal(8);
                    // TODO: check all users are there

                    done();
                });
            });

            it('should get all organizations /api/v1/orgs', function (done) {
                agent.get(server.getUrl() + '/api/v1/orgs').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    //expect(res.body.length).equal(8);
                    // TODO: check all users are there

                    done();
                });
            });

            // AUTH METHODS
            it('should return with guest account and 200 GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    expect(res.body._id).equal(gmeConfig.authentication.guestAccount);
                    done();
                });
            });

            it('should support basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        done();
                    });
            });

            it('should return 404 for GET /api/v1/user/token', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/token').end(function (err, res) {
                    expect(res.status).equal(404, err);
                    done();
                });
            });

            it('should use guest account with no password and no username basic authentication GET /api/v1/user',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/user')
                        .set('Authorization', 'Basic ' + new Buffer('').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body._id).to.equal('guest');
                            done();
                        });
                }
            );

            it('should use guest account with wrong password basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:wrong_password').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.equal('guest');
                        done();
                    });
            });

            it('should use guest account wrong username basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('unknown_username:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.equal('guest');
                        done();
                    });
            });

            it('should GET /api/v1/users/guest', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/guest')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);

                        done();
                    });
            });

            it('should return with the same information GET /api/v1/user and /api/v1/users/guest', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        agent.get(server.getUrl() + '/api/v1/users/guest')
                            .end(function (err, res2) {
                                expect(res2.status).equal(200, err);
                                expect(res.body).deep.equal(res2.body);
                                done();
                            });
                    });
            });


            it('should fail to update user without authentication PATCH /api/v1/users/user_to_modify', function (done) {
                agent.patch(server.getUrl() + '/api/v1/users/user_to_modify')
                //.set('Authorization', 'Basic ' + new Buffer('unknown_username:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(403, err);
                        done();
                    });
            });

            it('should fail to update user without siteAdmin role PATCH /api/v1/users/user_to_modify', function (done) {
                agent.patch(server.getUrl() + '/api/v1/users/user_to_modify')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(403, err);
                        done();
                    });
            });

            it('should fail to update non existent user PATCH /api/v1/users/does_not_exist', function (done) {
                var updates = {
                    email: 'new_email_address',
                    canCreate: false
                };

                agent.get(server.getUrl() + '/api/v1/users/does_not_exist')
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);

                        agent.patch(server.getUrl() + '/api/v1/users/does_not_exist')
                        //.set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                            .send(updates)
                            .end(function (err, res2) {
                                expect(res2.status).equal(403, err);
                                done();
                            });
                    });
            });


            it('should fail to grant site admin access with no site admin roles PATCH /api/v1/user', function (done) {
                var updates = {
                    email: 'new_email_address',
                    siteAdmin: true
                };

                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body.email).not.equal(updates.email);
                        expect(res.body.siteAdmin).not.equal(updates.siteAdmin);

                        agent.patch(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                            .send(updates)
                            .end(function (err, res2) {
                                expect(res2.status).equal(403, err);

                                done();
                            });
                    });
            });

            it('should fail to set canCreate access with no site admin roles PATCH /api/v1/user', function (done) {
                var updates = {
                    email: 'new_email_address',
                    canCreate: false
                };

                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body.email).not.equal(updates.email);
                        expect(res.body.canCreate).not.equal(updates.canCreate);

                        agent.patch(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                            .send(updates)
                            .end(function (err, res2) {
                                expect(res2.status).equal(403, err);

                                done();
                            });
                    });
            });

            it('should fail to grant site admin acc with no site admin roles PATCH /api/v1/users/guest',
                function (done) {
                    var updates = {
                        email: 'new_email_address',
                        siteAdmin: true
                    };

                    agent.get(server.getUrl() + '/api/v1/user')
                        .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body.email).not.equal(updates.email);
                            expect(res.body.siteAdmin).not.equal(true);

                            agent.patch(server.getUrl() + '/api/v1/users/guest')
                                .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                                .send(updates)
                                .end(function (err, res2) {
                                    expect(res2.status).equal(403, err);

                                    done();
                                });
                        });
                });

            it('should fail to set canCreate access acc with no site admin roles PATCH /api/v1/users/guest',
                function (done) {
                    var updates = {
                        email: 'new_email_address',
                        canCreate: false
                    };

                    agent.get(server.getUrl() + '/api/v1/user')
                        .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body.email).not.equal(updates.email);
                            expect(res.body.canCreate).not.equal(updates.canCreate);

                            agent.patch(server.getUrl() + '/api/v1/users/guest')
                                .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                                .send(updates)
                                .end(function (err, res2) {
                                    expect(res2.status).equal(403, err);

                                    done();
                                });
                        });
                });

            it('should fail to create a new user if acting user is not a site admin PUT /api/v1/users',
                function (done) {
                    var newUser = {
                        userId: 'new_user2',
                        email: 'new_email_address2',
                        password: 'new_user_pass2',
                        canCreate: true
                    };

                    agent.get(server.getUrl() + '/api/v1/users/new_user2')
                        .end(function (err, res) {
                            expect(res.status).equal(404, err); // user should not exist at this point

                            agent.put(server.getUrl() + '/api/v1/users')
                            //.set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                                .send(newUser)
                                .end(function (err, res2) {
                                    expect(res2.status).equal(403, err);

                                    done();
                                });
                        });
                });

            it('should fail to create a new user if not authenticated PUT /api/v1/users', function (done) {
                var newUser = {
                    userId: 'new_user2',
                    email: 'new_email_address2',
                    password: 'new_user_pass2',
                    canCreate: true
                };

                agent.get(server.getUrl() + '/api/v1/users/new_user2')
                    .end(function (err, res) {
                        expect(res.status).equal(404, err); // user should not exist at this point

                        agent.put(server.getUrl() + '/api/v1/users')
                            .send(newUser)
                            .end(function (err, res2) {
                                expect(res2.status).equal(403, err);

                                done();
                            });
                    });
            });

            it('should fail to delete a non existent user as site admin DELETE /api/v1/users/does_not_exist',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/users/does_not_exist')
                        .end(function (err, res) {
                            expect(res.status).equal(404, err);
                            agent.del(server.getUrl() + '/api/v1/users/does_not_exist')
                            //.set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                .end(function (err, res2) {
                                    expect(res2.status).equal(403, err);

                                    done();
                                });
                        });
                });

            it('should return 404 when posting /api/v1/register', function (done) {
                var newUser = {
                    userId: 'new_user404',
                    email: 'new_email_address404',
                    password: 'new_user_pass',
                    canCreate: true
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });
        });

        describe('auth on, allowGuests false, allowUserRegistration=true, registerUsersCanCreate=true', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.allowGuests = false;
                gmeConfig.authentication.allowUserRegistration = true;
                gmeConfig.authentication.registeredUsersCanCreate = true;

                server = WebGME.standaloneServer(gmeConfig);
                privateKey = fs.readFileSync(gmeConfig.authentication.jwt.privateKey, 'utf8');

                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            // NO AUTH methods
            it('should get api documentation link', function (done) {
                agent.get(server.getUrl() + '/api').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    expect(res.body.hasOwnProperty('api_documentation_url')).true;
                    agent.get(res.body.api_documentation_url).end(function (err, res) {
                        expect(res.status).equal(200, err);
                        done();
                    });
                });
            });

            it('should get api v1 links /api/v1', function (done) {
                agent.get(server.getUrl() + '/api/v1').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    done();
                });
            });

            it('should return with 404 for any non resource that does not exist /api/does_not_exist', function (done) {
                agent.get(server.getUrl() + '/api/does_not_exist').end(function (err, res) {
                    expect(res.status).equal(404, err);
                    done();
                });
            });

            it('should 401 all users /api/v1/users', function (done) {
                agent.get(server.getUrl() + '/api/v1/users')
                    .end(function (err, res) {
                        expect(res.status).equal(401, err);

                        done();
                    });
            });

            it('should 401 all orgs /api/v1/orgs', function (done) {
                agent.get(server.getUrl() + '/api/v1/orgs')
                    .end(function (err, res) {
                        expect(res.status).equal(401, err);

                        done();
                    });
            });

            // AUTH METHODS
            it('should get all users /api/v1/users if authenticated and admin', function (done) {
                agent.get(server.getUrl() + '/api/v1/users')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        //expect(res.body.length).gt(2);
                        // TODO: check all users are there

                        done();
                    });
            });

            it('should return with 401 GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user').end(function (err, res) {
                    expect(res.status).equal(401, err);
                    done();
                });
            });

            it('should support basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        done();
                    });
            });

            it('should return 401 when no auth used for GET /api/v1/user/token', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/token').end(function (err, res) {
                    expect(res.status).equal(401, err);
                    done();
                });
            });

            it('should return an access_token when authed used for GET /api/v1/user/token', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/token')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body.webgmeToken.split('.').length).equal(3, 'Returned token not correct format');
                        done();
                    });
            });

            it('should create user when accessed in db and not existing for user', function (done) {
                var userId = 'user_not_in_db',
                    token;

                gmeAuth.generateJWTokenForAuthenticatedUser(userId)
                    .then(function (token_) {
                        token = token_;
                        return gmeAuth.deleteUser(userId, true);
                    })
                    .then(function () {
                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Bearer ' + token)
                            .end(function (err, res) {
                                try {
                                    expect(res.status).equal(200, err);
                                    expect(res.body._id).equal(userId);
                                    expect(res.body.settings).to.deep.equal({});
                                } catch (e) {
                                    err = e;
                                }

                                done(err);
                            });
                    })
                    .catch(done);
            });

            it('should create user when accessed in db and not existing for user when token in query', function (done) {
                var userId = 'user_not_in_db2',
                    token;

                gmeAuth.generateJWTokenForAuthenticatedUser(userId)
                    .then(function (token_) {
                        token = token_;
                        return gmeAuth.deleteUser(userId, true);
                    })
                    .then(function () {
                        agent.get(server.getUrl() + '/api/v1/user')
                            .query({token: token})
                            .end(function (err, res) {
                                try {
                                    expect(res.status).equal(200, err);
                                    expect(res.body._id).equal(userId);
                                    expect(res.body.canCreate).equal(false);
                                    expect(res.body.settings).to.deep.equal({});
                                } catch (e) {
                                    err = e;
                                }

                                done(err);
                            });
                    })
                    .catch(done);
            });

            it('should create user when token in query has displayName', function (done) {
                var userId = 'user_with_displayName',
                    dName = 'My Name';

                Q.ninvoke(jwt, 'sign', {userId: userId, displayName: dName}, privateKey, {
                    algorithm: gmeConfig.authentication.jwt.algorithm,
                    expiresIn: gmeConfig.authentication.jwt.expiresIn
                })
                    .then(function (token) {
                        agent.get(server.getUrl() + '/api/v1/user')
                            .query({token: token})
                            .end(function (err, res) {
                                try {
                                    expect(res.status).equal(200, err);
                                    expect(res.body._id).equal(userId);
                                    expect(res.body.displayName).equal(dName);
                                    expect(res.body.canCreate).equal(false);
                                    expect(res.body.settings).to.deep.equal({});
                                } catch (e) {
                                    err = e;
                                }

                                done(err);
                            });
                    });
            });

            it('should create user when token in bearer has displayName', function (done) {
                var userId = 'user_with_displayName',
                    dName = 'My Name';

                Q.ninvoke(jwt, 'sign', {userId: userId, displayName: dName}, privateKey, {
                    algorithm: gmeConfig.authentication.jwt.algorithm,
                    expiresIn: gmeConfig.authentication.jwt.expiresIn
                })
                    .then(function (token) {
                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Bearer ' + token)
                            .end(function (err, res) {
                                try {
                                    expect(res.status).equal(200, err);
                                    expect(res.body._id).equal(userId);
                                    expect(res.body.displayName).equal(dName);
                                    expect(res.body.canCreate).equal(false);
                                    expect(res.body.settings).to.deep.equal({});
                                } catch (e) {
                                    err = e;
                                }

                                done(err);
                            });
                    });
            });

            it('should 401 when user identified via token but user is disabled', function (done) {
                var userId = 'user_disabled_but_has_token',
                    token;

                gmeAuth.generateJWTokenForAuthenticatedUser(userId)
                    .then(function (token_) {
                        token = token_;
                        return gmeAuth.deleteUser(userId);
                    })
                    .then(function () {
                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Bearer ' + token)
                            .end(function (err, res) {
                                try {
                                    expect(res.status).to.equal(401);
                                    done();
                                } catch (e) {
                                    done(e);
                                }
                            });
                    })
                    .catch(done);
            });

            it('should fail with wrong password basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:wrong_password').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(401, err);
                        done();
                    });
            });

            it('should fail with wrong username basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('unknown_username:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(401, err);
                        done();
                    });
            });

            it('should update user with valid data PATCH /api/v1/users/user_to_modify', function (done) {
                var updates = {
                    email: 'new_email_address',
                    password: 'newPlainPassword',
                    canCreate: false
                };

                agent.get(server.getUrl() + '/api/v1/users/user_to_modify')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body.email).not.equal(updates.email);
                        expect(res.body.canCreate).not.equal(updates.canCreate);

                        agent.patch(server.getUrl() + '/api/v1/users/user_to_modify')
                            .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                            .send(updates)
                            .end(function (err, res2) {
                                expect(res2.status).equal(200, err);
                                // have not changed anything that we did not requested to change
                                expect(res2.body._id).equal(res.body._id);
                                expect(res2.body.siteAdmin).equal(res.body.siteAdmin);

                                // we have just changed these fields
                                expect(res2.body.email).equal(updates.email);
                                expect(res2.body.canCreate).equal(updates.canCreate);
                                done();
                            });
                    });
            });

            it('should give site admin access to user with valid data PATCH /api/v1/users/user_to_modify',
                function (done) {
                    var updates = {
                        siteAdmin: true
                    };

                    agent.get(server.getUrl() + '/api/v1/users/user_to_modify')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body.siteAdmin).not.equal(updates.siteAdmin);

                            agent.patch(server.getUrl() + '/api/v1/users/user_to_modify')
                                .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                .send(updates)
                                .end(function (err, res2) {
                                    expect(res2.status).equal(200, err);
                                    // have not changed anything that we did not requested to change
                                    expect(res2.body._id).equal(res.body._id);
                                    expect(res2.body.siteAdmin).equal(true);

                                    done();
                                });
                        });
                });

            it('should update user with no data PATCH /api/v1/users/user_to_modify', function (done) {
                agent.patch(server.getUrl() + '/api/v1/users/user_to_modify')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    // no data
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        done();
                    });
            });

            it('should update self user with valid data PATCH /api/v1/user', function (done) {
                var updates = {
                    email: 'new_email_address'
                };

                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('user:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body.email).not.equal(updates.email);

                        agent.patch(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Basic ' + new Buffer('user:plaintext').toString('base64'))
                            .send(updates)
                            .end(function (err, res2) {
                                expect(res2.status).equal(200, err);
                                // have not changed anything that we did not requested to change
                                expect(res2.body._id).equal(res.body._id);
                                expect(res2.body.siteAdmin).equal(res.body.siteAdmin);

                                // we have changed just these fields
                                expect(res2.body.email).equal(updates.email);
                                done();
                            });
                    });
            });

            it('should create a new user with valid data PUT /api/v1/users', function (done) {
                var newUser = {
                    userId: 'new_user',
                    email: 'new_email_address',
                    password: 'new_user_pass',
                    canCreate: true
                };

                agent.get(server.getUrl() + '/api/v1/users/new_user')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err); // user should not exist at this point

                        agent.put(server.getUrl() + '/api/v1/users')
                            .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                            .send(newUser)
                            .end(function (err, res2) {
                                expect(res2.status).equal(200, err);

                                expect(res2.body._id).equal(newUser.userId);
                                expect(res2.body.email).equal(newUser.email);
                                expect(res2.body.canCreate).equal(newUser.canCreate);

                                done();
                            });
                    });
            });

            it('should create a new user with valid data PUT /api/v1/users/new_user_param', function (done) {
                var newUser = {
                        email: 'new_email_address',
                        password: 'pass',
                        canCreate: true
                    },
                    userId = 'new_user_param';

                agent.get(server.getUrl() + '/api/v1/users/new_user_param')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err); // user should not exist at this point

                        agent.put(server.getUrl() + '/api/v1/users/' + userId)
                            .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                            .send(newUser)
                            .end(function (err, res2) {
                                expect(res2.status).equal(200, err);

                                expect(res2.body._id).equal(userId);
                                expect(res2.body.email).equal(newUser.email);
                                expect(res2.body.canCreate).equal(newUser.canCreate);

                                done();
                            });
                    });
            });

            it('should fail to create a new user with login name that exists PUT /api/v1/users/guest', function (done) {
                var newUser = {
                    userId: 'new_user',
                    email: 'new_email_address',
                    password: 'new_user_pass',
                    canCreate: true
                };

                agent.get(server.getUrl() + '/api/v1/users/guest')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err); // user should not exist at this point

                        agent.put(server.getUrl() + '/api/v1/users')
                            .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                            .send(newUser)
                            .end(function (err, res2) {
                                expect(res2.status).equal(400, err);

                                done();
                            });
                    });
            });

            it('should delete a specified user as site admin DELETE /api/v1/users/user_to_delete', function (done) {
                agent.get(server.getUrl() + '/api/v1/users')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        agent.del(server.getUrl() + '/api/v1/users/user_to_delete')
                            .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                            .end(function (err, res2) {
                                expect(res2.status).equal(204, err);

                                agent.get(server.getUrl() + '/api/v1/users')
                                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                    .end(function (err, res2) {
                                        expect(res2.status).equal(200, err);
                                        expect(res.body.length - 1).equal(res2.body.length);

                                        done();
                                    });
                            });
                    });
            });

            it('should delete a self user DELETE /api/v1/users/self_delete_2', function (done) {
                agent.get(server.getUrl() + '/api/v1/users')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        agent.del(server.getUrl() + '/api/v1/users/self_delete_2')
                            .set('Authorization', 'Basic ' + new Buffer('self_delete_2:plaintext').toString('base64'))
                            .end(function (err, res2) {
                                expect(res2.status).equal(204, err);

                                agent.get(server.getUrl() + '/api/v1/users')
                                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                    .end(function (err, res2) {
                                        expect(res2.status).equal(200, err);
                                        expect(res.body.length - 1).equal(res2.body.length);

                                        done();
                                    });
                            });
                    });
            });

            it('should delete a self user DELETE /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/users')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        agent.del(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Basic ' + new Buffer('self_delete_1:plaintext').toString('base64'))
                            .end(function (err, res2) {
                                expect(res2.status).equal(204, err);

                                agent.get(server.getUrl() + '/api/v1/users')
                                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                    .end(function (err, res2) {
                                        expect(res2.status).equal(200, err);
                                        expect(res.body.length - 1).equal(res2.body.length);

                                        done();
                                    });
                            });
                    });
            });

            it('should add user when posting /api/v1/register', function (done) {
                var newUser = {
                    userId: 'reg_user',
                    email: 'normal@mail.com',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);

                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Basic ' + new Buffer('reg_user:pass').toString('base64'))
                            .end(function (err, res) {
                                expect(res.status).equal(200, err);
                                expect(res.body._id).to.equal('reg_user');
                                expect(res.body.canCreate).to.equal(true);
                                done();
                            });
                    });
            });

            it('should fail with 400 to add user twice when posting /api/v1/register', function (done) {
                var newUser = {
                    userId: 'reg_user_twice',
                    email: 'orgEmail',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);

                        newUser.email = 'updateEmail';
                        agent.post(server.getUrl() + '/api/v1/register')
                            .send(newUser)
                            .end(function (err, res) {
                                expect(res.status).equal(400, err);

                                agent.get(server.getUrl() + '/api/v1/user')
                                    .set('Authorization',
                                        'Basic ' + new Buffer('reg_user_twice:pass').toString('base64'))
                                    .end(function (err, res) {
                                        expect(res.status).equal(200, err);
                                        expect(res.body._id).to.equal('reg_user_twice');
                                        expect(res.body.email).to.equal('orgEmail');
                                        done();
                                    });
                            });
                    });
            });

        });

        describe('auth on, allowGuests false, allowUserRegistration=true, registerUsersCanCreate=false', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.allowGuests = false;
                gmeConfig.authentication.allowUserRegistration = true;
                gmeConfig.authentication.registeredUsersCanCreate = false;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            it('should add user when posting /api/v1/register', function (done) {
                var newUser = {
                    userId: 'reg_user_no_create',
                    email: 'normal@mail.com',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);

                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Basic ' + new Buffer('reg_user_no_create:pass').toString('base64'))
                            .end(function (err, res) {
                                expect(res.status).equal(200, err);
                                expect(res.body._id).to.equal('reg_user_no_create');
                                expect(res.body.canCreate).to.equal(false);
                                done();
                            });
                    });
            });
        });

        describe('auth on, allowGuests true, allowUserRegistration=false, inferredUsersCanCreate=true', function () {
            var server,
                agent,
                guestAccount = 'guest';

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.allowGuests = true;
                gmeConfig.authentication.guestAccount = guestAccount;
                gmeConfig.authentication.allowUserRegistration = false;
                gmeConfig.authentication.inferredUsersCanCreate = true;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            // NO AUTH methods
            it('should get api documentation link', function (done) {
                agent.get(server.getUrl() + '/api').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    // TODO: redirects to login page
                    done();
                });
            });


            it('should get api v1 links /api/v1', function (done) {
                agent.get(server.getUrl() + '/api/v1').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    done();
                });
            });

            it('should return with 404 for any non resource that does not exist /api/does_not_exist', function (done) {
                agent.get(server.getUrl() + '/api/does_not_exist').end(function (err, res) {
                    expect(res.status).equal(404, err);
                    done();
                });
            });

            // AUTH
            it('should get users and filter depending on user-type /api/v1/users', function (done) {
                var numberOfUsers;

                agent.get(server.getUrl() + '/api/v1/users').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    // Guest can only see him/herself.
                    try {
                        expect(res.body.length).to.equal(1);
                        expect(res.body[0]._id).to.equal('guest');
                    } catch (e) {
                        return done(e);
                    }

                    agent.get(server.getUrl() + '/api/v1/users')
                        .set('Authorization', 'Basic ' + new Buffer('user2:plaintext').toString('base64'))
                        .end(function (err, res) {
                            // Regular user can only see details about him/herself.
                            try {
                                numberOfUsers = res.body.length;
                                expect(numberOfUsers > 1).to.equal(true);
                                res.body.forEach(function (uData) {
                                    if (uData._id !== 'user2') {
                                        expect(uData.email.length).to.equal(0);
                                        expect(Object.keys(uData.data).length).to.equal(0);
                                    } else {
                                        expect(uData.email.length > 1).to.equal(true);
                                    }
                                });
                            } catch (e) {
                                return done(e);
                            }

                            agent.get(server.getUrl() + '/api/v1/users')
                                .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                .end(function (err, res) {
                                    // Admin can see all details about everyone.
                                    var gotData = false;
                                    try {
                                        expect(res.body.length).to.equal(numberOfUsers);
                                        res.body.forEach(function (uData) {
                                            expect(uData.email.length > 1).to.equal(true);
                                            if (uData._id !== 'admin' && Object.keys(uData.data).length > 0) {
                                                gotData = true;
                                            }
                                        });

                                        expect(gotData).to.equal(true);
                                    } catch (e) {
                                        return done(e);
                                    }

                                    done();
                                });
                        });
                });
            });

            it('should 404 GET /api/v1/users/user if guest', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/user')
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);

                        done();
                    });
            });

            it('should GET /api/v1/users/user if non guest user but filter out email and projects', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/user')
                    .set('Authorization', 'Basic ' + new Buffer('user2:plaintext').toString('base64'))
                    .end(function (err, res) {
                        try {
                            expect(res.status).equal(200, err);
                            expect(res.body.email.length).to.equal(0);
                            expect(Object.keys(res.body.projects).length).to.equal(0);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
            });

            it('should GET /api/v1/users/user if admin and contain email', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/user')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(Object.keys(res.body.projects).length).to.equal(1);
                        expect(res.body.email.length > 1).to.equal(true);

                        done();
                    });
            });

            it('should GET /api/v1/users/guest if same user', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/guest')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);

                        done();
                    });
            });

            it('should get all users /api/v1/users', function (done) {
                agent.get(server.getUrl() + '/api/v1/users')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        //expect(res.body.length).equal(8);
                        // TODO: check all users are there

                        done();
                    });
            });

            it('should fail to delete a specified user if not authenticated DELETE /api/v1/users/admin',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/users/admin')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            agent.del(server.getUrl() + '/api/v1/users/admin')
                                .end(function (err, res2) {
                                    expect(res2.status).equal(403, err);

                                    agent.get(server.getUrl() + '/api/v1/users/admin')
                                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                        .end(function (err, res2) {
                                            expect(res.status).equal(200, err);

                                            // make sure we did not lose any users
                                            expect(res.body).deep.equal(res2.body);

                                            done();
                                        });
                                });
                        });
                });

            it('should fail to delete a specified user if acting user is not a site admin DELETE /api/v1/users/guest',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/users/user')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            agent.del(server.getUrl() + '/api/v1/users/user')
                            //.set('Authorization', 'Basic ' + new Buffer('user:plaintext').toString('base64'))
                                .end(function (err, res2) {
                                    expect(res2.status).equal(403, err);

                                    agent.get(server.getUrl() + '/api/v1/users/user')
                                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                        .end(function (err, res2) {
                                            expect(res.status).equal(200, err);

                                            // make sure we did not lose any users
                                            expect(res.body).deep.equal(res2.body);

                                            done();
                                        });
                                });
                        });
                });

            it('should get disabled user too if /api/v1/users?includeDisabled=true for site-admin', function (done) {
                var dUsers,
                    users;

                function report(err) {
                    if (err) {
                        done(err);
                    } else if (dUsers && users) {
                        var hadWhenShouldHave = false,
                            hadWhenShouldNotHave = false;

                        try {
                            expect(dUsers.length > users.length).to.equal(true);

                            dUsers.forEach(function (uData) {
                                if (uData.disabled) {
                                    hadWhenShouldHave = true;
                                }
                            });

                            users.forEach(function (uData) {
                                if (uData.disabled) {
                                    hadWhenShouldNotHave = true;
                                }
                            });

                            expect(hadWhenShouldHave).to.equal(true);
                            expect(hadWhenShouldNotHave).to.equal(false);

                            done();
                        } catch (e) {
                            done(e);
                        }
                    }
                }

                agent.get(server.getUrl() + '/api/v1/users')
                    .query({includeDisabled: true})
                    .end(function (err, res) {
                        users = res.body;
                        report(err);
                    });

                agent.get(server.getUrl() + '/api/v1/users')
                    .query({includeDisabled: true})
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        dUsers = res.body;
                        report(err);
                    });
            });

            it('should return with 204 and delete user from db if site-admin DEL /api/v1/users/:userId?force=true',
                function (done) {
                    var userId = 'to_be_force_deleted';

                    gmeAuth.addUser(userId, '@', 'p', true, {overwrite: true})
                        .then(function () {
                            var deferred = Q.defer();
                            agent.del(server.getUrl() + '/api/v1/users/' + userId)
                                .query({force: true})
                                .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                .end(function (err, res) {
                                    try {
                                        expect(res.status).equal(204, err);
                                        deferred.resolve();
                                    } catch (e) {
                                        deferred.reject(e);
                                    }
                                });

                            return deferred.promise;
                        })
                        .then(function () {
                            return gmeAuth.listUsers({disabled: undefined});
                        })
                        .then(function (users) {
                            users.forEach(function (userData) {
                                if (userData._id === userId) {
                                    throw new Error('User still exists');
                                }
                            });
                        })
                        .nodeify(done);
                }
            );

            it('should 204 but NOT delete user from db if not site-admin DEL /api/v1/users/:userId?force=true',
                function (done) {
                    var userId = 'to_be_attempted_force_deletion';

                    gmeAuth.addUser(userId, '@', 'p', true, {overwrite: true})
                        .then(function () {
                            var deferred = Q.defer();
                            agent.del(server.getUrl() + '/api/v1/users/' + userId)
                                .query({force: true})
                                .set('Authorization', 'Basic ' + new Buffer(userId + ':p').toString('base64'))
                                .end(function (err, res) {
                                    try {
                                        expect(res.status).equal(204, err);
                                        deferred.resolve();
                                    } catch (e) {
                                        deferred.reject(e);
                                    }
                                });

                            return deferred.promise;
                        })
                        .then(function () {
                            return gmeAuth.listUsers({disabled: undefined});
                        })
                        .then(function (users) {
                            var userExists = false;
                            users.forEach(function (userData) {
                                if (userData._id === userId) {
                                    userExists = true;
                                    expect(userData.disabled).to.equal(true);
                                }
                            });

                            expect(userExists).to.equal(true);
                        })
                        .nodeify(done);
                }
            );

            it('should re-enable user if site-admin patch /api/v1/users/:userId with body {disabled: true}',
                function (done) {
                    var userId = 'to_be_reEnabled_deleted';

                    gmeAuth.addUser(userId, '@', 'p', true, {overwrite: true, disabled: true})
                        .then(function () {
                            var deferred = Q.defer();
                            agent.patch(server.getUrl() + '/api/v1/users/' + userId)
                                .send({disabled: false})
                                .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                                .end(function (err, res) {
                                    try {
                                        expect(res.status).equal(200, err);
                                        expect(res.body.disabled).to.equal(false);
                                        deferred.resolve();
                                    } catch (e) {
                                        deferred.reject(e);
                                    }
                                });

                            return deferred.promise;
                        })
                        .then(function () {
                            return gmeAuth.getUser(userId);
                        })
                        .then(function (user) {
                            expect(user.disabled).to.equal(false);
                        })
                        .nodeify(done);
                }
            );

            it('should 403 if not site-admin patch /api/v1/users/:userId with body {disabled: true}',
                function (done) {
                    var userId = 'attempt_to_be_reEnabled_deleted';

                    gmeAuth.addUser(userId, '@', 'p', true, {overwrite: true})
                        .then(function () {
                            var deferred = Q.defer();
                            agent.patch(server.getUrl() + '/api/v1/users/' + userId)
                                .send({disabled: false})
                                .set('Authorization', 'Basic ' + new Buffer(userId + ':p').toString('base64'))
                                .end(function (err, res) {
                                    try {
                                        expect(res.status).equal(403, err);
                                        deferred.resolve();
                                    } catch (e) {
                                        deferred.reject(e);
                                    }
                                });

                            return deferred.promise;
                        })
                        .nodeify(done);
                }
            );

            it('should return with 200 and guest is logged in GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    expect(res.body._id).equal(guestAccount);
                    done();
                });
            });

            it('should support basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        done();
                    });
            });

            it('should return an access_token for guest for GET /api/v1/user/token', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/token')
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body.webgmeToken.split('.').length)
                            .equal(3, 'Returned token not correct format');
                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Bearer ' + res.body.webgmeToken)
                            .end(function (err, res) {
                                expect(res.status).equal(200, err);
                                expect(res.body._id).equal('guest', err);
                                done();
                            });
                    });
            });

            it('should return an access_token for admin for GET /api/v1/user/token', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/token')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body.webgmeToken.split('.').length).equal(3, 'Returned token not correct format');
                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Bearer ' + res.body.webgmeToken)
                            .end(function (err, res) {
                                expect(res.status).equal(200, err);
                                expect(res.body._id).equal('admin', err);
                                done();
                            });
                    });
            });

            it('should return 401 with invalid access_token for guest for GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Bearer ' + '42.mombo.jumbo')
                    .end(function (err, res) {
                        expect(res.status).equal(401, err);
                        done();
                    });
            });

            it('should not check password of guest basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:wrong_password').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        done();
                    });
            });

            it('should fail with wrong password basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('admin:wrong_password').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(401, err);
                        done();
                    });
            });

            it('should fail with wrong username basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('unknown_username:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(401, err);
                        done();
                    });
            });

            // User data methods /user/data
            it('should get empty user data basic authentication GET /api/v1/user/data', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/data')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({});
                        done();
                    });
            });

            it('should get user data basic authentication GET /api/v1/user/data/a', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/data/a')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data1:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal(1);
                        done();
                    });
            });

            it('should get user data array basic authentication GET /api/v1/user/data/array', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/data/array')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data1:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal([1, 2, 3]);
                        done();
                    });
            });

            it('should get nested user data values GET /api/v1/user/data/a/b', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/data/a/b')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_nesteddata1:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal(1);
                        done();
                    });
            });

            it('should get user data key with special chars GET /api/v1/user/data/a%2Fc', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/data/a/b')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_nesteddata1:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal(1);
                        done();
                    });
            });

            it('should set nested key PUT /api/v1/user/data/test/b/d', function (done) {
                const user = 'user_w_nesteddata1';
                const newData = {b: 1};
                agent.put(server.getUrl() + '/api/v1/user/data/b/d')
                    .send(newData)
                    .set('Authorization', 'Basic ' + new Buffer(`${user}:plaintext`).toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        gmeAuth.getUser(user)
                            .then(userData => {
                                expect(userData.data.b.d).to.deep.equal(newData);
                            })
                            .nodeify(done);
                    });
            });

            it('should set encrypted nested key PUT /api/v1/user/data/user/password', function (done) {
                const user = 'user_w_nesteddata1';
                const newData = 'IAmASecret';
                agent.put(server.getUrl() + '/api/v1/user/data/user/password')
                    .send(newData)
                    .set('Authorization', 'Basic ' + new Buffer(`${user}:plaintext`).toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        gmeAuth.getUser(user)
                            .then(userData => {
                                assert(userData.data.user.password);
                                assert.notEqual(userData.data.user.password, newData);
                            })
                            .nodeify(done);
                    });
            });

            it('should decrypt user data GET /api/v1/user/data/user/password', async function () {
                const user = 'user_w_nesteddata1';
                const newData = 'IAmASecret';
                const keys = ['user', 'password'];
                await gmeAuth.setUserDataField(user, keys, newData, {encrypt: true});
                const response = await new Promise((resolve, reject) => 
                    agent.get(server.getUrl() + '/api/v1/user/data/' + keys.join('/'))
                        .set('Authorization', 'Basic ' + new Buffer(`${user}:plaintext`).toString('base64'))
                        .end(function (err, res) {
                            if (err) {
                                return reject(err);
                            }
                            resolve(res);
                        })
                );
                assert.equal(response.status, 200);
                assert.equal(response.body, newData);
            });

            it('should get unencrypted user data GET /api/v1/user/data/user/test', async function () {
                const user = 'user_w_nesteddata1';
                const newData = 'IAmNotASecret';
                const keys = ['user', 'test'];
                await gmeAuth.setUserDataField(user, keys, newData);
                const response = await new Promise((resolve, reject) =>
                    agent.get(server.getUrl() + '/api/v1/user/data/' + keys.join('/'))
                        .set('Authorization', 'Basic ' + new Buffer(`${user}:plaintext`).toString('base64'))
                        .end(function (err, res) {
                            if (err) {
                                return reject(err);
                            }
                            resolve(res);
                        })
                );
                assert.equal(response.status, 200);
                assert.equal(response.body, newData);
            });

            // ISSUE
            it('should get unencrypted user data with null value GET /api/v1/user/data', async function () {
                const user = 'user_w_nesteddata1';
                const newData = null;
                const keys = ['user', 'test2'];
                await gmeAuth.setUserDataField(user, keys, newData);
                const response = await new Promise((resolve, reject) =>
                    agent.get(server.getUrl() + '/api/v1/user/data/' + keys.join('/'))
                        .set('Authorization', 'Basic ' + new Buffer(`${user}:plaintext`).toString('base64'))
                        .end(function (err, res) {
                            if (err) {
                                return reject(err);
                            }
                            resolve(res);
                        })
                );
                assert.equal(response.status, 200);
                assert.equal(response.body, newData);
            });

            it('should get user data basic authentication GET /api/v1/user/data', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/data')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data1:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({a: 1, array: [1, 2, 3]});
                        done();
                    });
            });

            it('should overwrite user data basic authentication PUT /api/v1/user/data', function (done) {
                agent.put(server.getUrl() + '/api/v1/user/data')
                    .send({b: 1})
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data2:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({b: 1});
                        gmeAuth.getUser('user_w_data2')
                            .then(function (userData) {
                                expect(userData.data).to.deep.equal({b: 1});
                            })
                            .nodeify(done);
                    });
            });

            it('should update user data basic authentication PATCH /api/v1/user/data', function (done) {
                agent.patch(server.getUrl() + '/api/v1/user/data')
                    .send({b: 1})
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data3:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({a: 1, b: 1});
                        gmeAuth.getUser('user_w_data3')
                            .then(function (userData) {
                                expect(userData.data).to.deep.equal({a: 1, b: 1});
                            })
                            .nodeify(done);
                    });
            });

            it('should delete user data basic authentication DELETE /api/v1/user/data', function (done) {
                agent.del(server.getUrl() + '/api/v1/user/data')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data4:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(204, err);
                        gmeAuth.getUser('user_w_data4')
                            .then(function (userData) {
                                expect(userData.data).to.deep.equal({});
                            })
                            .nodeify(done);
                    });
            });

            // User data methods /users/:username/data
            it('should get user data basic authentication "admin" GET /api/v1/users/:username/data', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/user_w_data5/data')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({a: 1});
                        done();
                    });
            });

            it('should overwrite user data basic authentication "admin" PUT /api/v1/users/:username/data',
                function (done) {
                    agent.put(server.getUrl() + '/api/v1/users/user_w_data6/data')
                        .send({b: 1})
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({b: 1});
                            gmeAuth.getUser('user_w_data6')
                                .then(function (userData) {
                                    expect(userData.data).to.deep.equal({b: 1});
                                })
                                .nodeify(done);
                        });
                }
            );

            it('should update user data basic authentication "admin" PATCH /api/v1/users/:username/data',
                function (done) {
                    agent.patch(server.getUrl() + '/api/v1/users/user_w_data7/data')
                        .send({b: 1})
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({a: 1, b: 1});
                            gmeAuth.getUser('user_w_data7')
                                .then(function (userData) {
                                    expect(userData.data).to.deep.equal({a: 1, b: 1});
                                })
                                .nodeify(done);
                        });
                }
            );

            it('should delete user data basic authentication "admin" DELETE /api/v1/users/:username/data',
                function (done) {
                    agent.del(server.getUrl() + '/api/v1/users/user_w_data8/data')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(204, err);
                            gmeAuth.getUser('user_w_data8')
                                .then(function (userData) {
                                    expect(userData.data).to.deep.equal({});
                                })
                                .nodeify(done);
                        });
                }
            );

            // Component Settings
            it('should get empty user settings basic authentication GET /api/v1/componentSettings', function (done) {
                agent.get(server.getUrl() + '/api/v1/componentSettings')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({});
                        done();
                    });
            });

            it('should get empty user settings basic authentication GET /api/v1/componentSettings/componentId',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/componentSettings/componentId')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({});
                            done();
                        });
                }
            );

            // User setting methods /user/settings
            it('should get empty user settings basic authentication GET /api/v1/user/settings', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/settings')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({});
                        done();
                    });
            });

            it('should get user settings basic authentication GET /api/v1/user/settings', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/settings')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_settings1:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}});
                        done();
                    });
            });

            it('should overwrite user settings basic authentication PUT /api/v1/user/settings', function (done) {
                agent.put(server.getUrl() + '/api/v1/user/settings')
                    .send({comp3: {a: 1, b: 1}})
                    .set('Authorization', 'Basic ' + new Buffer('user_w_settings2:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({comp3: {a: 1, b: 1}});
                        gmeAuth.getUser('user_w_settings2')
                            .then(function (userData) {
                                expect(userData.settings).to.deep.equal({comp3: {a: 1, b: 1}});
                            })
                            .nodeify(done);
                    });
            });

            it('should update user settings basic authentication PATCH /api/v1/user/settings', function (done) {
                agent.patch(server.getUrl() + '/api/v1/user/settings')
                    .send({comp2: {a: 1, b: 1}})
                    .set('Authorization', 'Basic ' + new Buffer('user_w_settings3:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({comp1: {a: 1, b: 1}, comp2: {a: 1, b: 1}});
                        gmeAuth.getUser('user_w_settings3')
                            .then(function (userData) {
                                expect(userData.settings).to.deep.equal({comp1: {a: 1, b: 1}, comp2: {a: 1, b: 1}});
                            })
                            .nodeify(done);
                    });
            });

            it('should delete user settings basic authentication DELETE /api/v1/user/settings', function (done) {
                agent.del(server.getUrl() + '/api/v1/user/settings')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_settings4:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(204, err);
                        gmeAuth.getUser('user_w_settings4')
                            .then(function (userData) {
                                expect(userData.settings).to.deep.equal({});
                            })
                            .nodeify(done);
                    });
            });

            // User setting methods /user/settings/:componentId
            it('should get empty user settings basic authentication GET /api/v1/user/settings/comp', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/settings/comp')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_data:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({});
                        done();
                    });
            });

            it('should get user settings basic authentication GET /api/v1/user/settings/comp1', function (done) {
                agent.get(server.getUrl() + '/api/v1/user/settings/comp1')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_c_settings1:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({a: 1, b: 1});
                        done();
                    });
            });

            it('should add user settings basic authentication PUT /api/v1/user/settings/comp3', function (done) {
                agent.put(server.getUrl() + '/api/v1/user/settings/comp3')
                    .send({a: 3, b: 3})
                    .set('Authorization', 'Basic ' + new Buffer('user_w_c_settings2:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({a: 3, b: 3});
                        gmeAuth.getUser('user_w_c_settings2')
                            .then(function (userData) {
                                expect(userData.settings).to.deep.equal({
                                    comp1: {a: 1, b: 1},
                                    comp2: {a: 2, b: 2},
                                    comp3: {a: 3, b: 3}
                                });
                            })
                            .nodeify(done);
                    });
            });

            it('should overwrite user settings basic authentication PUT /api/v1/user/settings/comp2', function (done) {
                agent.put(server.getUrl() + '/api/v1/user/settings/comp2')
                    .send({a: 3})
                    .set('Authorization', 'Basic ' + new Buffer('user_w_c_settings3:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({a: 3});
                        gmeAuth.getUser('user_w_c_settings3')
                            .then(function (userData) {
                                expect(userData.settings).to.deep.equal({
                                    comp1: {a: 1, b: 1},
                                    comp2: {a: 3}
                                });
                            })
                            .nodeify(done);
                    });
            });

            it('should update user settings basic authentication PATCH /api/v1/user/settings/comp2', function (done) {
                agent.patch(server.getUrl() + '/api/v1/user/settings/comp2')
                    .send({b: 1})
                    .set('Authorization', 'Basic ' + new Buffer('user_w_c_settings4:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({a: 2, b: 1});
                        gmeAuth.getUser('user_w_c_settings4')
                            .then(function (userData) {
                                expect(userData.settings).to.deep.equal({
                                    comp1: {a: 1, b: 1},
                                    comp2: {a: 2, b: 1}
                                });
                            })
                            .nodeify(done);
                    });
            });

            it('should delete user settings basic authentication DELETE /api/v1/user/settings/comp2', function (done) {
                agent.del(server.getUrl() + '/api/v1/user/settings/comp2')
                    .set('Authorization', 'Basic ' + new Buffer('user_w_c_settings5:plaintext').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(204, err);
                        gmeAuth.getUser('user_w_c_settings5')
                            .then(function (userData) {
                                expect(userData.settings.comp2).to.deep.equal({});
                            })
                            .nodeify(done);
                    });
            });

            // User settings methods /users/:username/settings
            it('should get empty user settings basic authentication GET /api/v1/user/:username/settings',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/users/user_w_data/settings')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({});
                            done();
                        });
                }
            );

            it('should get user settings basic authentication GET /api/v1/users/:username/settings', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/users_w_settings1/settings')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body).to.deep.equal({comp1: {a: 1, b: 1}, comp2: {a: 2, b: 2}});
                        done();
                    });
            });

            it('should overwrite user settings basic authentication PUT /api/v1/users/:username/settings',
                function (done) {
                    agent.put(server.getUrl() + '/api/v1/users/users_w_settings2/settings')
                        .send({comp3: {a: 1, b: 1}})
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({comp3: {a: 1, b: 1}});
                            gmeAuth.getUser('users_w_settings2')
                                .then(function (userData) {
                                    expect(userData.settings).to.deep.equal({comp3: {a: 1, b: 1}});
                                })
                                .nodeify(done);
                        });
                }
            );

            it('should update user settings basic authentication PATCH /api/v1/users/:username/settings',
                function (done) {
                    agent.patch(server.getUrl() + '/api/v1/users/users_w_settings3/settings')
                        .send({comp2: {a: 1, b: 1}})
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({comp1: {a: 1, b: 1}, comp2: {a: 1, b: 1}});
                            gmeAuth.getUser('users_w_settings3')
                                .then(function (userData) {
                                    expect(userData.settings).to.deep.equal({comp1: {a: 1, b: 1}, comp2: {a: 1, b: 1}});
                                })
                                .nodeify(done);
                        });
                }
            );

            it('should delete user settings basic authentication DELETE /api/v1/users/:username/settings',
                function (done) {
                    agent.del(server.getUrl() + '/api/v1/users/users_w_settings4/settings')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(204, err);
                            gmeAuth.getUser('users_w_settings4')
                                .then(function (userData) {
                                    expect(userData.settings).to.deep.equal({});
                                })
                                .nodeify(done);
                        });
                }
            );

            // User setting methods /users/:userId/settings/:componentId
            it('should get empty user settings basic authentication GET /api/v1/users/:username/settings/comp',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/users/user_w_data/settings/comp')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({});
                            done();
                        });
                }
            );

            it('should get user settings basic authentication GET /api/v1/users/:username/settings/comp1',
                function (done) {
                    agent.get(server.getUrl() + '/api/v1/users/users_w_c_settings1/settings/comp1')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({a: 1, b: 1});
                            done();
                        });
                }
            );

            it('should add user settings basic authentication PUT /api/v1/users/:username/settings/comp3',
                function (done) {
                    agent.put(server.getUrl() + '/api/v1/users/users_w_c_settings2/settings/comp3')
                        .send({a: 3, b: 3})
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({a: 3, b: 3});
                            gmeAuth.getUser('users_w_c_settings2')
                                .then(function (userData) {
                                    expect(userData.settings).to.deep.equal({
                                        comp1: {a: 1, b: 1},
                                        comp2: {a: 2, b: 2},
                                        comp3: {a: 3, b: 3}
                                    });
                                })
                                .nodeify(done);
                        });
                }
            );

            it('should overwrite user settings basic authentication PUT /api/v1/users/:username/settings/comp2',
                function (done) {
                    agent.put(server.getUrl() + '/api/v1/users/users_w_c_settings3/settings/comp2')
                        .send({a: 3})
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({a: 3});
                            gmeAuth.getUser('users_w_c_settings3')
                                .then(function (userData) {
                                    expect(userData.settings).to.deep.equal({
                                        comp1: {a: 1, b: 1},
                                        comp2: {a: 3}
                                    });
                                })
                                .nodeify(done);
                        });
                }
            );

            it('should update user settings basic authentication PATCH /api/v1/users/:username/settings/comp2',
                function (done) {
                    agent.patch(server.getUrl() + '/api/v1/users/users_w_c_settings4/settings/comp2')
                        .send({b: 1})
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.body).to.deep.equal({a: 2, b: 1});
                            gmeAuth.getUser('users_w_c_settings4')
                                .then(function (userData) {
                                    expect(userData.settings).to.deep.equal({
                                        comp1: {a: 1, b: 1},
                                        comp2: {a: 2, b: 1}
                                    });
                                })
                                .nodeify(done);
                        });
                }
            );

            it('should delete user settings basic authentication DELETE /api/v1/users/:username/settings/comp2',
                function (done) {
                    agent.del(server.getUrl() + '/api/v1/users/users_w_c_settings5/settings/comp2')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(204, err);
                            gmeAuth.getUser('users_w_c_settings5')
                                .then(function (userData) {
                                    expect(userData.settings.comp2).to.deep.equal({});
                                })
                                .nodeify(done);
                        });
                }
            );

            it('should create user when accessed in db and not existing for user when token in query', function (done) {
                var userId = 'user_not_in_db2',
                    token;

                gmeAuth.generateJWTokenForAuthenticatedUser(userId)
                    .then(function (token_) {
                        token = token_;
                        return gmeAuth.deleteUser(userId, true);
                    })
                    .then(function () {
                        agent.get(server.getUrl() + '/api/v1/user')
                            .query({token: token})
                            .end(function (err, res) {
                                try {
                                    expect(res.status).equal(200, err);
                                    expect(res.body._id).equal(userId);
                                    expect(res.body.canCreate).equal(true);
                                    expect(res.body.settings).to.deep.equal({});
                                } catch (e) {
                                    err = e;
                                }

                                done(err);
                            });
                    })
                    .catch(done);
            });
            // Fail cases

            it('should 404 basic authentication "admin" GET /api/v1/users/doesNotExist/data', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/doesNotExist/data')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" PUT /api/v1/users/doesNotExist/data', function (done) {
                agent.put(server.getUrl() + '/api/v1/users/doesNotExist/data')
                    .send({b: 1})
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" PATCH /api/v1/users/doesNotExist/data', function (done) {
                agent.patch(server.getUrl() + '/api/v1/users/doesNotExist/data')
                    .send({b: 1})
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" DELETE /api/v1/users/doesNotExist/data', function (done) {
                agent.del(server.getUrl() + '/api/v1/users/doesNotExist/data')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 403 ensureSameUserOrSiteAdmin "guest" PUT /api/v1/users/doesNotExist/data', function (done) {
                agent.put(server.getUrl() + '/api/v1/users/user_w_data/data')
                    .send({a: 1})
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(403, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" GET /api/v1/users/doesNotExist/settings', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/doesNotExist/settings')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" PUT /api/v1/users/doesNotExist/settings', function (done) {
                agent.put(server.getUrl() + '/api/v1/users/doesNotExist/settings')
                    .send({b: 1})
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" PATCH /api/v1/users/doesNotExist/settings', function (done) {
                agent.patch(server.getUrl() + '/api/v1/users/doesNotExist/settings')
                    .send({b: 1})
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" DELETE /api/v1/users/doesNotExist/settings', function (done) {
                agent.del(server.getUrl() + '/api/v1/users/doesNotExist/settings')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" GET /api/v1/users/doesNotExist/settings/comp', function (done) {
                agent.get(server.getUrl() + '/api/v1/users/doesNotExist/settings/comp')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" PUT /api/v1/users/doesNotExist/settings/comp', function (done) {
                agent.put(server.getUrl() + '/api/v1/users/doesNotExist/settings/comp')
                    .send({b: 1})
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });

            it('should 404 basic authentication "admin" PATCH /api/v1/users/doesNotExist/settings/comp',
                function (done) {
                    agent.patch(server.getUrl() + '/api/v1/users/doesNotExist/settings/comp')
                        .send({b: 1})
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(404, err);
                            done();
                        });
                }
            );

            it('should 404 basic authentication "admin" DELETE /api/v1/users/doesNotExist/settings/comp',
                function (done) {
                    agent.del(server.getUrl() + '/api/v1/users/doesNotExist/settings/comp')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            expect(res.status).equal(404, err);
                            done();
                        });
                }
            );

            it('should 401 basic authentication empty user and password /api/v1/user', function (done) {
                agent.del(server.getUrl() + '/api/v1/users/doesNotExist/settings/comp')
                    .set('Authorization', 'Basic ' + new Buffer('').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(401, err);
                        done();
                    });
            });

            it('should return 404 when posting /api/v1/register', function (done) {
                var newUser = {
                    userId: 'new_user404',
                    email: 'new_email_address404',
                    password: 'new_user_pass',
                    canCreate: true
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(404, err);
                        done();
                    });
            });
        });

        describe('auth on, allowGuests false, allowUserRegistration="./testRegisterEndPoint"', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.allowGuests = false;
                gmeConfig.authentication.allowUserRegistration =
                    testFixture.path.join(__dirname, 'testRegisterEndPoint');

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            it('should add user when posting /api/v1/register and user starts with an "a"', function (done) {
                var newUser = {
                    userId: 'a_new_user_starts_with_a',
                    email: 'normal@mail.com',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);

                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization',
                                'Basic ' + new Buffer('a_new_user_starts_with_a:pass').toString('base64'))
                            .end(function (err, res) {
                                expect(res.status).equal(200, err);
                                expect(res.body._id).to.equal('a_new_user_starts_with_a');
                                done();
                            });
                    });
            });

            it('should 400 when posting /api/v1/register if user does NOT starts with an "a"', function (done) {
                var newUser = {
                    userId: 'not_starting_with_a_new_user',
                    email: 'normal@mail.com',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        if (res.status === 400) {
                            done();
                        } else {
                            done(new Error('Did not 400, instead ' + res.status));
                        }
                    });
            });
        });

        describe('auth off, allowGuests true', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = false;
                gmeConfig.authentication.allowGuests = true;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            // NO AUTH methods
            it('should get api documentation link', function (done) {
                agent.get(server.getUrl() + '/api').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    expect(res.body.hasOwnProperty('api_documentation_url')).true;
                    agent.get(res.body.api_documentation_url).end(function (err, res) {
                        expect(res.status).equal(200, err);
                        done();
                    });
                });
            });

            it('should get api v1 links /api/v1', function (done) {
                agent.get(server.getUrl() + '/api/v1').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    done();
                });
            });

            it('should return with 404 for any non resource that does not exist /api/does_not_exist', function (done) {
                agent.get(server.getUrl() + '/api/does_not_exist').end(function (err, res) {
                    expect(res.status).equal(404, err);
                    done();
                });
            });


            // AUTH METHODS
            it('should get all users /api/v1/users', function (done) {
                agent.get(server.getUrl() + '/api/v1/users').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    //expect(res.body.length).equal(8);
                    // TODO: check all users are there

                    done();
                });
            });

            it('should return with guest user account and 200 GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user').end(function (err, res) {
                    expect(res.status).equal(200, err);
                    expect(res.body._id).equal(gmeConfig.authentication.guestAccount);
                    done();
                });
            });

            it('should use guest account GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.deep.equal('guest');
                        done();
                    });
            });

            it('should use guest account with wrong password basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('guest:wrong_password').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.deep.equal('guest');
                        done();
                    });
            });

            it('should use guest account with wrong username basic authentication GET /api/v1/user', function (done) {
                agent.get(server.getUrl() + '/api/v1/user')
                    .set('Authorization', 'Basic ' + new Buffer('unknown_username:guest').toString('base64'))
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.deep.equal('guest');
                        done();
                    });
            });
        });

        describe('Token renewal an expiration auth enabled, allowGuests true', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.jwt.expiresIn = 2;
                gmeConfig.authentication.jwt.renewBeforeExpires = 1;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            it('should return an access_token for admin for GET /api/v1/user/token and set a new in the header',
                function (done) {
                    this.timeout(5000);
                    agent.get(server.getUrl() + '/api/v1/user/token')
                        .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                        .end(function (err, res) {
                            var orginalToken = res.body.webgmeToken;
                            expect(res.status).equal(200, err);
                            expect(orginalToken.split('.').length).equal(3, 'Returned token not correct format');
                            setTimeout(function () {
                                agent.get(server.getUrl() + '/api/v1/user')
                                    .set('Authorization', 'Bearer ' + orginalToken)
                                    .end(function (err, res) {
                                        expect(res.status).equal(200, err);
                                        expect(res.body._id).equal('admin', err);
                                        expect(res.header.access_token.split('.').length)
                                            .to.equal(3, 'no token in header');
                                        expect(res.header.access_token)
                                            .to.not.equal(orginalToken, 'no token update');
                                        done();
                                    });
                            }, 1000);
                        });
                }
            );

            it('should return 401 when using expired token', function (done) {
                this.timeout(5000);
                agent.get(server.getUrl() + '/api/v1/user/token')
                    .set('Authorization', 'Basic ' + new Buffer('admin:admin').toString('base64'))
                    .end(function (err, res) {
                        var orginaltoken = res.body.webgmeToken;
                        expect(res.status).equal(200, err);
                        expect(orginaltoken.split('.').length).equal(3, 'Returned token not correct format');
                        setTimeout(function () {
                            agent.get(server.getUrl() + '/api/v1/user')
                                .set('Authorization', 'Bearer ' + orginaltoken)
                                .end(function (err, res) {
                                    expect(res.status).equal(401, err);
                                    done();
                                });
                        }, 2000);
                    });
            });
        });

        describe('Verification on', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.newUserNeedsVerification = true;

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            it('should add disabled user when posting /api/v1/register', function (done) {
                var newUser = {
                    userId: 'veri_reg_user_2',
                    email: 'normal@mail.com',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.equal('veri_reg_user_2');
                        
                        agent.get(server.getUrl() + '/api/v1/user')
                            .set('Authorization', 'Basic ' + new Buffer('veri_reg_user_2:pass').toString('base64'))
                            .end(function (err, res) {
                                expect(res.status).equal(401, err);
                                done();
                            });
                    });
            });

            it('should not allow disabled user to enable itself', function (done) {
                var newUser = {
                    userId: 'veri_reg_user',
                    email: 'normal@mail.com',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.equal('veri_reg_user');
                        
                        agent.patch(server.getUrl() + '/api/v1/user/data')
                            .set('Authorization', 'Basic ' + new Buffer('veri_reg_user:pass').toString('base64'))
                            .send({disabled: false})
                            .end(function (err, res) {
                                expect(res.status).equal(401, err);
                                
                                agent.patch(server.getUrl() + '/api/v1/user')
                                    .set('Authorization', 
                                        'Basic ' + new Buffer('veri_reg_user:pass').toString('base64'))
                                    .send({disabled: false})
                                    .end(function (err, res) {
                                        expect(res.status).equal(401, err);
                                        done();
                                    });
                            });
                    });
            });

        });

        describe('Reset enabled', function () {
            var server,
                agent;

            before(function (done) {
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.newUserNeedsVerification = false;
                gmeConfig.authentication.allowPasswordReset = true;
                gmeConfig.authentication.allowedResetInterval = 1;
                gmeConfig.authentication.resetTimeout = 10000;
                gmeConfig.authentication.resetUrl = '/profile/reset';

                server = WebGME.standaloneServer(gmeConfig);
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            beforeEach(function () {
                agent = superagent.agent();
            });

            it('should allow complete password change', function (done) {
                var newUser = {
                    userId: 'reset_pwd_user',
                    email: 'normal@mail.com',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.equal('reset_pwd_user');
                        
                        agent.post(server.getUrl() + '/api/v1/reset')
                            .send({userId: 'reset_pwd_user'})
                            .end(function (err, res) {
                                expect(res.status).equal(200);
                                agent.patch(server.getUrl() + '/api/v1/reset')
                                    .send({
                                        userId: 'reset_pwd_user', 
                                        resetHash: res.body.resetHash, 
                                        newPassword: 'newpass'})
                                    .end(function (err, res) {
                                        expect(err).to.eql(null);
                                        expect(res.status).equal(200);
                                        agent.get(server.getUrl() + '/api/v1/user')
                                            .set('Authorization', 'Basic ' + 
                                                new Buffer('reset_pwd_user:newpass').toString('base64'))
                                            .end(function (err, res) {
                                                expect(res.status).equal(200);
                                                expect(res.body._id).equal('reset_pwd_user');
                                                done();
                                            });
                                    });
                            });
                    });
            });

            it('should allow checking of password reset request', function (done) {
                var newUser = {
                    userId: 'reset_pwd_user2',
                    email: 'normal@mail.com',
                    password: 'pass'
                };

                agent.post(server.getUrl() + '/api/v1/register')
                    .send(newUser)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.body._id).to.equal('reset_pwd_user2');
                        
                        agent.post(server.getUrl() + '/api/v1/reset')
                            .send({userId: 'reset_pwd_user2'})
                            .end(function (err, res) {
                                expect(res.status).equal(200);
                                expect(res.body.resetHash).not.to.eql(undefined);
                                agent.get(server.getUrl() + 
                                    '/api/v1/reset?userId=reset_pwd_user2&resetHash=' + 
                                    res.body.resetHash)
                                    .end(function (err, res) {
                                        expect(err).to.eql(null);
                                        expect(res.status).equal(200);
                                        done();
                                    });
                            });
                    });
            });
                    
        });
    });
});
