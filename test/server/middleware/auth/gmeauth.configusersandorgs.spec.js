/*globals require*/
/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

describe('GME authentication config users and orgs', function () {
    'use strict';

    var testFixture = require('../../../_globals.js'),
        expect = testFixture.expect,
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
        gmeConfig.authentication.admin = 'siteAdmin';

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
        gmeConfig.authentication.admin = 'siteAdmin:pass';

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
        gmeConfig.authentication.admin = 'siteAdmin:pass';

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
        gmeConfig.authentication.admin = 'siteAdmin:pass';
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
        gmeConfig.authentication.admin = 'siteAdmin:pass';
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

                return gmeAuth.addUser('newUser', 'em@il', 'pass', true, {});
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
                return gmeAuth.addUser('newUser', 'em@il', 'pass', true, {});
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
        gmeConfig.authentication.admin = 'siteAdmin:pass';
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
});