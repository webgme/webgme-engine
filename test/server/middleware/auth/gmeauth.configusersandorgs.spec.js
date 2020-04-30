/*globals require*/
/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

describe('GME authentication config users and orgs', function () {
    'use strict';

    var testFixture = require('../../../_globals.js'),
        expect = testFixture.expect,
        Q = testFixture.Q,
        gmeAuth;

    afterEach(function (done) {
        if (gmeAuth) {
            gmeAuth.unload()
                .then(function () {
                    gmeAuth = null;
                })
                .nodeify(done);
        } else {
            done();
        }
    });

    // Admin account
    it('Should create admin user with random password', function (done) {
        var gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.adminAccount = 'siteAdmin';

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.getUser('siteAdmin');
            })
            .then(function (user) {
                expect(user.siteAdmin).to.equal(true);
            })
            .nodeify(done);
    });

    it('Should create admin with specified password', function (done) {
        var gmeConfig = testFixture.getGmeConfig(),
            gmeAuth;

        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.adminAccount = 'siteAdmin:pass';

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.getUser('siteAdmin');
            })
            .then(function (user) {
                expect(user.siteAdmin).to.equal(true);
                return gmeAuth.authenticateUser('siteAdmin', 'pass');
            })
            .then(function (user) {
                expect(user._id).to.equal('siteAdmin');
            })
            .nodeify(done);
    });

    it('Should not create admin when auth disabled', function (done) {
        var gmeConfig = testFixture.getGmeConfig(),
            gmeAuth;
        gmeConfig.authentication.enable = false;
        gmeConfig.authentication.adminAccount = 'siteAdmin:pass';

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.getUser('siteAdmin');
            })
            .then(function () {
                throw new Error('Should have failed!');
            })
            .catch(function (err) {
                expect(err.message).to.include('no such user [siteAdmin]');
            })
            .nodeify(done);
    });

    // Public organizations
    it('Should create public organization and not add admin or guest', function (done) {
        var gmeConfig = testFixture.getGmeConfig(),
            gmeAuth;

        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.adminAccount = 'siteAdmin:pass';
        gmeConfig.authentication.publicOrganizations = ['public'];

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.getUser('siteAdmin');
            })
            .then(function (user) {
                expect(user.orgs.length).to.equal(0);
                return gmeAuth.getOrganization('public');
            })
            .then(function (org) {
                expect(org._id).to.equal('public');
            })
            .nodeify(done);
    });

    it('Should create public organizations and new user should be added to all of them', function (done) {
        var gmeConfig = testFixture.getGmeConfig(),
            gmeAuth;

        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.adminAccount = 'siteAdmin:pass';
        gmeConfig.authentication.publicOrganizations = ['public', 'public1', 'public2'];

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.getUser('siteAdmin');
            })
            .then(function (user) {
                expect(user.orgs.length).to.equal(0);
                return gmeAuth.listOrganizations();
            })
            .then(function (orgs) {
                expect(
                    orgs.map(function (org) {
                        return org._id;
                    }).sort())
                    .to.deep.equal(['public', 'public1', 'public2']);

                return gmeAuth.addUser('newUser', 'normal@mail.com', 'pass', true, {});
            })
            .then(function (user) {
                expect(user.orgs.sort()).to.deep.equal(['public', 'public1', 'public2']);
            })
            .nodeify(done);
    });

    it('Should not create public organizations when auth disabled', function (done) {
        var gmeConfig = testFixture.getGmeConfig(),
            gmeAuth;
        gmeConfig.authentication.enable = false;
        gmeConfig.authentication.publicOrganizations = ['public'];

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.getOrganization('public');
            })
            .then(function () {
                throw new Error('Should have failed!');
            })
            .catch(function (err) {
                expect(err.message).to.include('no such organization [public]');
            })
            .nodeify(done);
    });

    it('Should not fail at user creation with public organizations when auth disabled', function (done) {
        var gmeConfig = testFixture.getGmeConfig(),
            gmeAuth;
        gmeConfig.authentication.enable = false;
        gmeConfig.authentication.publicOrganizations = ['public'];

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.addUser('newUser', 'normal@mail.com', 'pass', true, {});
            })
            .then(function (user) {
                expect(user.orgs).to.deep.equal([]);
            })
            .nodeify(done);
    });

    it('Should not fail after restart if admin and public org already created', function (done) {
        var gmeConfig = testFixture.getGmeConfig(),
            gmeAuth;

        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.adminAccount = 'siteAdmin:pass';
        gmeConfig.authentication.publicOrganizations = ['public'];

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.getUser('siteAdmin');
            })
            .then(function (user) {
                expect(user.orgs.length).to.equal(0);
                return gmeAuth.getOrganization('public');
            })
            .then(function (org) {
                expect(org._id).to.equal('public');
                return gmeAuth.unload();
            })
            .then(function () {
                return gmeAuth.connect();
            })
            .then(function () {
                return gmeAuth.getUser('siteAdmin');
            })
            .then(function (user) {
                expect(user.orgs.length).to.equal(0);
                return gmeAuth.getOrganization('public');
            })
            .then(function (org) {
                expect(org._id).to.equal('public');
            })
            .nodeify(done);
    });

    //Password reset processes
    function _preCreateResetUser(gmeConfig) {
        const deferred = Q.defer();

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.addUser('resetUser', 'reset@gmail.com', 'doesitmatter?', true, {});
            })
            .then(function (user) {
                deferred.resolve(user);
            })
            .catch(err => {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    it('should be able to reset password', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(resetHash => {
                expect(resetHash).not.to.equal(null);
                expect(resetHash).not.to.equal(undefined);
                expect(typeof resetHash).to.equal('string');
            })
            .nodeify(done);
    });

    it('should fail to reset password when password reset is disabled', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = false;
        gmeConfig.authentication.allowedResetInterval = 1000;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Password reset is not allowed!') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to reset password for guest account', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.guestAccount = 'resetUser';
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.resetPassword('resetUser');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Password reset is not allowed for GUEST account!') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to reset password for inferred account', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.guestAccount = 'resetUser';
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.addUser('inferredUser', 'normal@mail.com', 'doesitmatter?', true, {});
            })
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'cannot change inferred user data!') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to reset password for unknown account', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.guestAccount = 'resetUser';
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.resetPassword('unknown');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Cannot find user: unknown') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to reset password twice within interval', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(() => {
                done(new Error('should have failed to reset the password for a second time!'));
            })
            .catch(err => {
                if (err.message === 'cannot reset password just yet!') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should allow two resets if enough time passes', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1;
        let oldHash = null;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(hash_ => {
                oldHash = hash_;
                return gmeAuth.resetPassword('resetUser');
            })
            .then(hash_ => {
                expect(oldHash).not.to.equal(hash_);
                done(null);
            })
            .catch(done);
    });

    it('should allow complete password change', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(hash_ => {
                return gmeAuth.changePassword('resetUser', hash_, 'newPassword');
            })
            .then(() => {
                return gmeAuth.authenticateUser('resetUser', 'newPassword');
            })
            .then(()=> {
                done(null);
            })
            .catch(done);
    });

    it('should fail to change password when password reset is disabled', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = false;
        gmeConfig.authentication.allowedResetInterval = 1000;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.changePassword('resetUser', 'dontMatter', 'newPassword');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Password reset is not allowed!') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to change password for guest account', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.guestAccount = 'resetUser';
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.changePassword('resetUser', 'whatever', 'andthis');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Password reset is not allowed for GUEST account!') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to change password for unknown account', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.guestAccount = 'resetUser';
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.changePassword('unknown', 'whatever');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Cannot find user: unknown') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to change password when reset expires', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1;
        gmeConfig.authentication.resetTimeout = 0;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(hash_ => {
                return gmeAuth.changePassword('resetUser', hash_, 'newPassword');
            })
            .then(user => {
                expect(user.resetHash).to.equal(null);
                return gmeAuth.authenticateUser('resetUser', 'newPassword');
            })
            .then(()=> {
                done(new Error('should have failed to change password after reset expires!'));
            })
            .catch(err => {
                if (err.message === 'Your reset token has expired!') {
                    done(null);
                } else {
                    done(err);
                }
            });
    });

    it('should validate reset request', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(hash_ => {
                return gmeAuth.isValidReset('resetUser', hash_);
            })
            .then(()=> {
                done(null);
            })
            .catch(done);
    });

    it('should fail to validate reset request when password reset is disabled', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = false;
        gmeConfig.authentication.allowedResetInterval = 1000;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.isValidReset('resetUser', 'dontMatter');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Password reset is not allowed!') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to validate reset for guest account', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.guestAccount = 'resetUser';
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.isValidReset('resetUser', 'whatever');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Password reset is not allowed for GUEST account!') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should fail to validate reset for unknown account', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.guestAccount = 'resetUser';
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1000;

        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return gmeAuth.isValidReset('unknown', 'whatever');
            })
            .then(() => {
                done(new Error('should have failed to reset the password!'));
            })
            .catch(err => {
                if (err.message === 'Cannot find user: unknown') {
                    done(null);
                } else {
                    done(err);
                }
                
            });
    });

    it('should respond false to reset inquiry if request expires', function (done) {
        const gmeConfig = testFixture.getGmeConfig();
        gmeConfig.authentication.enable = true;
        gmeConfig.authentication.allowPasswordReset = true;
        gmeConfig.authentication.allowedResetInterval = 1;
        gmeConfig.authentication.resetTimeout = 0;

        _preCreateResetUser(gmeConfig)
            .then(() => {
                return gmeAuth.resetPassword('resetUser');
            })
            .then(hash_ => {
                return gmeAuth.isValidReset('resetUser', hash_);
            })
            .then(()=> {
                done(new Error('should have failed to change password after reset expires!'));
            })
            .catch(err => {
                if (err.message === 'Your reset token has expired!') {
                    done(null);
                } else {
                    done(err);
                }
            });
    });
});