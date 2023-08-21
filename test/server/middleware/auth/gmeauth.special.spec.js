/*globals*/
/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */

// const { CONSOLE_APPENDER } = require('karma/lib/constants');
var testFixture = require('../../../_globals.js');


describe('GME authentication special tests', function () {
    'use strict';
    var baseConfig = testFixture.getGmeConfig(),
        GMEAuth = testFixture.GMEAuth,
        expect = testFixture.expect,
        Q = testFixture.Q,
        jwt = require('jsonwebtoken'),
        fs = require('fs'),
        privateKey = null,
        jwtOptions = {
            algorithm: baseConfig.authentication.jwt.algorithm,
            expiresIn: baseConfig.authentication.jwt.expiresIn,
            allowInsecureKeySizes: true,
        },
        getToken = tokenData => {
            return Q.ninvoke(jwt, 'sign', tokenData, privateKey, jwtOptions);
        };

    describe('unique email', function () {
        let gmeConfig = baseConfig;
        let auth = null;

        before(done => {
            gmeConfig.authentication.useEmailForId = true;
            auth = new GMEAuth(null, gmeConfig);
            testFixture.clearDatabase(gmeConfig)
                .then(() => {
                    return auth.connect();
                })
                .nodeify(done);
        });
        beforeEach(function () {
            auth.clearAllEvents();
        });
        after(function (done) {
            auth.unload()
                .nodeify(done);
        });

        it('should add user with unique email just fine', done => {
            auth.addUser('user', 'user@myemail.just', 'password', true, {})
                .then(user => {
                    expect(user._id).to.eql('user');
                })
                .nodeify(done);
        });

        it('should be fine to overwrite if both id and email matches', done => {
            let oldPwdHash = null;
            auth.addUser('user2', 'user2@myemail.just', 'password', true, {})
                .then(user => {
                    expect(user._id).to.eql('user2');
                    oldPwdHash = user.passwordHash;
                    return auth.addUser('user2', 'user2@myemail.just', 'newpassword', false, { overwrite: true });
                })
                .then(user => {
                    expect(user._id).to.eql('user2');
                    expect(user.canCreate).to.eql(false);
                    expect(user.passwordHash).not.to.eql(oldPwdHash);
                })
                .nodeify(done);
        });

        it('should fail to add user with occupied email', done => {
            auth.addUser('user3', 'user2@myemail.just', 'password', true, {})
                .then(() => {
                    done(new Error('should have failed!!!'));
                })
                .catch(err => {
                    if (err.message.indexOf('email address already in use') === -1) {
                        done(new Error('wrong error received'));
                    } else {
                        done();
                    }
                });
        });

        it('should be fine to update email if the new one is unique as well', done => {
            let oldPwdHash = null;
            auth.addUser('user4', 'user4@myemail.just', 'password', true, {})
                .then(user => {
                    expect(user._id).to.eql('user4');
                    expect(user.email).to.eql('user4@myemail.just');
                    oldPwdHash = user.passwordHash;
                    return auth.addUser('user4', 'user4new@myemail.just', 'newpassword', false, { overwrite: true });
                })
                .then(user => {
                    expect(user._id).to.eql('user4');
                    expect(user.canCreate).to.eql(false);
                    expect(user.email).to.eql('user4new@myemail.just');
                    expect(user.passwordHash).not.to.eql(oldPwdHash);
                })
                .nodeify(done);
        });
    });

    describe('inferred user with email id feature', function () {
        let gmeConfig = baseConfig;
        let auth = null;

        before(done => {
            gmeConfig.authentication.enable = true;
            gmeConfig.authentication.useEmailForId = true;
            gmeConfig.authentication.inferredUserCanCreate = true;
            privateKey = fs.readFileSync(gmeConfig.authentication.jwt.privateKey, 'utf8');
            auth = new GMEAuth(null, gmeConfig);
            testFixture.clearDatabase(gmeConfig)
                .then(() => {
                    return auth.connect();
                })
                .nodeify(done);
        });
        beforeEach(function () {
            auth.clearAllEvents();
        });
        after(function (done) {
            auth.unload()
                .nodeify(done);
        });


        it('should create inferred user as before if no email arrives', done => {
            getToken(
                {
                    userId: 'user1',
                    displayName: 'I am a user',
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user1');
                    return auth.getUser(result.content.userId);
                })
                .then(userData => {
                    expect(userData._id).to.eql('user1');
                    expect(userData.email).to.eql('em@il');
                })
                .nodeify(done);
        });

        it('should create inferred user as before even if email arrives', done => {
            getToken(
                {
                    userId: 'user2',
                    displayName: 'I am a user',
                    email: 'user2@myemail.com'
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user2');
                    return auth.getUser(result.content.userId);
                })
                .then(userData => {
                    expect(userData._id).to.eql('user2');
                    expect(userData.email).to.eql('user2@myemail.com');
                })
                .nodeify(done);
        });

        it('should create inferred user if only email arrives', done => {
            getToken(
                {
                    displayName: 'I am a user',
                    email: 'user3@myemail.com'
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).have.string('_iuid_');
                    return auth.getUser(result.content.userId);
                })
                .then(userData => {
                    expect(userData._id).to.eql('_iuid_user3_at_myemail_p_com');
                    expect(userData.email).to.eql('user3@myemail.com');
                })
                .nodeify(done);
        });

        it('should use original userId when email identifies', done => {
            getToken(
                {
                    userId: 'user4_a',
                    displayName: 'I am a user',
                    email: 'user4@myemail.com'
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user4_a');
                    return getToken({
                        userId: 'user4_b',
                        displayName: 'I am a user',
                        email: 'user4@myemail.com'
                    });
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user4_a');
                    return getToken({
                        displayName: 'I am a user',
                        email: 'user4@myemail.com'
                    });
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user4_a');
                })
                .nodeify(done);
        });

        it('should set email when initially inferred with userId', done => {
            getToken(
                {
                    userId: 'user5',
                    displayName: 'I am a user',
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user5');
                    return auth.getUser(result.content.userId);
                })
                .then(userData => {
                    expect(userData._id).to.eql('user5');
                    expect(userData.email).to.eql('em@il');
                    return getToken(
                        {
                            userId: 'user5',
                            email: 'user5@myemail.com',
                        }
                    );
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user5');
                    return auth.getUser(result.content.userId);
                })
                .then(userData => {
                    expect(userData._id).to.eql('user5');
                    expect(userData.email).to.eql('user5@myemail.com');
                })
                .nodeify(done);
        });

        it('should fail if no id nor email given', done => {
            getToken(
                {
                    displayName: 'I am a user',
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(() => {
                    done(new Error('should have failed'));
                })
                .catch(err => {
                    if (err.message.indexOf('no such user') === -1) {
                        done(new Error('bad error received'));
                    } else {
                        done(null);
                    }
                });
        });
    });

    describe('inferred user without email id feature', function () {
        let gmeConfig = baseConfig;
        let auth = null;

        before(done => {
            gmeConfig.authentication.enable = true;
            gmeConfig.authentication.useEmailForId = false;
            gmeConfig.authentication.inferredUserCanCreate = true;
            privateKey = fs.readFileSync(gmeConfig.authentication.jwt.privateKey, 'utf8');
            auth = new GMEAuth(null, gmeConfig);
            testFixture.clearDatabase(gmeConfig)
                .then(() => {
                    return auth.connect();
                })
                .nodeify(done);
        });
        beforeEach(function () {
            auth.clearAllEvents();
        });
        after(function (done) {
            auth.unload()
                .nodeify(done);
        });


        it('should create inferred user as before if no email arrives', done => {
            getToken(
                {
                    userId: 'user1',
                    displayName: 'I am a user',
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user1');
                    return auth.getUser(result.content.userId);
                })
                .then(userData => {
                    expect(userData._id).to.eql('user1');
                    expect(userData.email).to.eql('em@il');
                })
                .nodeify(done);
        });

        it('should create inferred user as before even if email arrives', done => {
            getToken(
                {
                    userId: 'user2',
                    displayName: 'I am a user',
                    email: 'user2@myemail.com'
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user2');
                    return auth.getUser(result.content.userId);
                })
                .then(userData => {
                    expect(userData._id).to.eql('user2');
                    expect(userData.email).to.eql('user2@myemail.com');
                })
                .nodeify(done);
        });

        it('should fail if only email arrives', done => {
            getToken(
                {
                    displayName: 'I am a user',
                    email: 'user3@myemail.com'
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(() => {
                    done(new Error('should have failed'));
                })
                .catch(err => {
                    if (err.message.indexOf('no such user') === -1) {
                        done(new Error('bad error received'));
                    } else {
                        done(null);
                    }
                });
        });

        it('should be able to create new user with same email', done => {
            getToken(
                {
                    userId: 'user4_a',
                    displayName: 'I am a user',
                    email: 'user4@myemail.com'
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user4_a');
                    return getToken({
                        userId: 'user4_b',
                        displayName: 'I am a user',
                        email: 'user4@myemail.com'
                    });
                })
                .then(token => {
                    return auth.verifyJWToken(token);
                })
                .then(result => {
                    expect(result.content.userId).to.eql('user4_b');
                })
                .nodeify(done);
        });
    });
});
