/*globals*/
/*eslint-env node*/
/**
 * @author kecso / https://github.com/kecso
 */
'use strict';

var Q = require('q'),
    nodemailer = require('nodemailer');


/**
 *
 * @param {GmeLogger} mainLogger
 * @param {GmeConfig} gmeConfig
 * @constructor
 */
function Mailer(mainLogger, gmeConfig, gmeAuth) {

    /**
     * @type {GmeLogger}
     */
    this.logger = mainLogger;

    /**
     * @type {GmeConfig}
     */
    this.gmeConfig = gmeConfig;

    /**
     * @type {transporter}
     */
    this.transporter = null;

    this.auth = gmeAuth;

    this.init = (callback) => {
        const deferred = Q.defer();
        const self = this;
        let {logger, gmeConfig} = this;
        if (gmeConfig.mailer.enable) {
            if (gmeConfig.mailer.service && gmeConfig.mailer.service === 'gmail') {
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: gmeConfig.mailer.user,
                        pass: gmeConfig.mailer.pwd,
                    },
                });
            } else {
                this.transporter = nodemailer.createTransport({
                    pool: true, // to setup SMTP connection once and not for every message
                    host: gmeConfig.mailer.host,
                    port: gmeConfig.mailer.port,
                    secure: gmeConfig.mailer.secure,
                    auth: {
                        user: gmeConfig.mailer.user,
                        pass: gmeConfig.mailer.pwd,
                    },
                });
            }
            this.transporter.verify((error /* , success */) => {
                if (error) {
                    logger.error('Configured server is not functioning!');
                    logger.error(error);
                    self.transporter = null;
                    deferred.reject(error);
                } else {
                    deferred.resolve();
                }
            });
        } else {
            deferred.reject(new Error('Function is not enabled in the configuration!'));
        }
    
        return deferred.promise.nodeify(callback);
    };

    /**
    *
    * @param {object} params
    * @param {string} params.message - The content of the message.
    * @param {string} params.subject - The subject of the message.
    * @param {string} params.to - The address of the recipient.
    * @param {function} [callback] - if provided no promise will be returned.
    *
    * @return {external:Promise}  On finishing the promise will be resolved.
    * On error the promise will be rejected with {@link Error} <b>error</b>.
    */
    this.send = (params, callback) => {
        const deferred = Q.defer();
        const {logger, transporter, gmeConfig} = this;

        if (transporter) {
            transporter.sendMail({
                from: params.from || gmeConfig.mailer.from,
                to: params.to,
                subject: params.subject,
                text: params.message, // TODO we might want  to consider nicer, HTML bodied e-mails
            }, (error, info) => {
                if (error) {
                    logger.error('Unable to send e-mail: ' + error);
                    deferred.reject(error);
                } else {
                    logger.info('Email sent: ' + JSON.stringify(info, null, 2));
                    deferred.resolve(info);
                }
            });
        } else {
            deferred.reject(new Error('No server connection!'));
        }
        return deferred.promise.nodeify(callback);
    };

    /**
     *
     * @param {object} params
     * @param {string} params.userId - The userId of the recipient.
     * @param {string} params.hostUrlPrefix - The main Url address of the server
     * @param {function} [callback] - if provided no promise will be returned.
     *
     * @return {external:Promise}  On finishing the promise will be resolved.
     * On error the promise will be rejected with {@link Error} <b>error</b>.
     */
    this.passwordReset = (params, callback) => {
        const self = this;
        const deferred = Q.defer();
        const {transporter, gmeConfig, auth} = this;
        let resetId;
    
        if (transporter && gmeConfig.authentication.enable && gmeConfig.authentication.allowPasswordReset) {
            auth.resetPassword(params.userId)
                .then(resetId_ => {
                    resetId = resetId_;
                    return auth.getUser(params.userId);
                })
                .then(userData => {
                    return self.send({
                        subject: 'WebGME information',
                        to: userData.email,
                        message: 'Dear ' + params.userId + 
                        ',\n Password reset was requested for you account.\n' + 
                        ' If you have not made this request, please disregard this email.\n' +
                        ' Otherwise, please follow the link to complete the reset:\n' +
                        params.hostUrlPrefix + gmeConfig.authentication.resetUrl + 
                        '/' + params.userId + '/' + resetId + '\n\n' +
                        ' Stay safe, secure, and keep on modeling!\n The WebGME team -(]:)'
                    });
                })
                .then(deferred.resolve)
                .catch(deferred.reject);
        } else {
            deferred.reject(new Error('Cannot complete password reset!'));
        }
        return deferred.promise.nodeify(callback);
    };
}

module.exports = Mailer;

