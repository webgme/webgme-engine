/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('../../../_globals.js');


describe('GME mailing services', function () {
    'use strict';

    var gmeConfig = testFixture.getGmeConfig(),
        GMEAuth = testFixture.GMEAuth,
        expect = testFixture.expect,
        Q = testFixture.Q,
        mailer = null,
        logger = testFixture.logger.fork('MailerTest'),
        auth;

    const nodemailer = require('nodemailer');
    const Mailer = require('./../../../../src/server/middleware/mailer/mailer');

    before(function (done) {
        this.timeout(20000);
        nodemailer.createTestAccount((err, account) => {
            if (err) {
                throw err;
            }

            gmeConfig.mailer = {}; //FIXME
            gmeConfig.mailer.enable = true;
            gmeConfig.mailer.host = 'smtp.ethereal.email';
            gmeConfig.mailer.port = 587;
            gmeConfig.mailer.secure = false;
            gmeConfig.mailer.user = account.user;
            gmeConfig.mailer.pwd = account.pass;
            gmeConfig.authentication.allowPasswordReset = true;
            gmeConfig.authentication.enable = true;

            auth = new GMEAuth(null, gmeConfig);
            testFixture.clearDatabase(gmeConfig)
                .then(function () {
                    return auth.connect();
                })
                .then(function () {
                    return Q.allDone([
                        auth.addUser('OneUser', 'user@webgme.org', 'passone', true, {overwrite: true}),
                        auth.addUser('OneUser2', 'user2@webgme.org', 'passtwo', true, {overwrite: true})
                    ]);
                })
                .then(function () {
                    return auth.authorizeByUserId('OneUser', 'project', 'create', {
                        read: true,
                        write: true,
                        delete: false
                    });
                })
                .then(function () {
                    return auth.authorizeByUserId('OneUser2', 'unauthorized_project', 'create', {
                        read: false,
                        write: false,
                        delete: false
                    });
                })
                .then(() => {
                    mailer = new Mailer(logger, gmeConfig, auth);
                    return mailer.init();
                })
                .nodeify(done);
        });
    });

    after(function (done) {
        auth.unload()
            .nodeify(done);
    });

    it('should send basic email', function (done) {
        this.timeout(20000);
        mailer.send({ from: 'me@mail.from',
            to: 'some@mail.to',
            subject: 'i need some',
            text: 'and this as well'})
            .then(info => {
                expect(info.accepted).to.have.length(1);
                expect(info.accepted[0]).to.equal('some@mail.to');
            })
            .nodeify(done);
    });
 
    it('should send reset email', function (done) {
        this.timeout(20000);
        mailer.passwordReset({userId: 'OneUser', hostUrlPrefix: 'https://editor.webgme.org'})
            .then(info => {
                expect(info.accepted).to.have.length(1);
                expect(info.accepted[0]).to.equal('user@webgme.org');
            })
            .nodeify(done);
    });

});