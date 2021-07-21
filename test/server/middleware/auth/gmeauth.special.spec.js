/*globals require*/
/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */

 var testFixture = require('../../../_globals.js');


 describe.only('GME authentication special tests', function () {
     'use strict';
     var baseConfig = testFixture.getGmeConfig(),
         GMEAuth = testFixture.GMEAuth,
         expect = testFixture.expect,
         Q = testFixture.Q;
    describe('unique email', function() {
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
                return auth.addUser('user2', 'user2@myemail.just', 'newpassword', false, {overwrite:true});
            })
            .then(user => {
                expect(user._id).to.eql('user2');
                expect(user.canCreate).to.eql(false);
                expect(user.passwordHash).not.to.eql(oldPwdHash);
            })
            .nodeify(done);
        });
        it('should fail to add user with occupied email', done => {
            let oldPwdHash = null;
            auth.addUser('user3', 'user2@myemail.just', 'password', true, {})
            .then(user => {
                done(new Error('should have failed!!!'));
            })
            .catch(err => {
                if(err.message.indexOf('email address already in use') === -1) {
                    done(new Error('wrong error received'));
                } else {
                    done();
                }
            });
        });
    });
 });
 