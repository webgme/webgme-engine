/*globals*/
/*eslint-env node*/
/**
 * @author kecso / https://github.com/kecso
 */
'use strict';

var Q = require('q'),
    ENTITY_TYPES = {
        PROJECT: 'PROJECT',
        USER: 'USER'
    },
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
    this.logger = mainLogger.fork('Mailer');

    /**
     * @type {GmeConfig}
     */
    this.gmeConfig = gmeConfig;

    /**
     * @type {transporter}
     */
    this.transporter = null;

    this.auth = gmeAuth;

    let {transporter, logger} = this;
    if (this.gmeConfig.mailer.enabled) {
        transporter = nodemailer.createTransport({
            pool: true, // to setup SMTP connection once and not for every message
            host: this.gmeConfig.mailer.host,
            port: this.gmeConfig.mailer.port,
            secure: this.gmeConfig.mailer.secure,
            auth: {
                user: this.gmeConfig.mailer.user,
                pass: this.gmeConfig.mailer.pwd,
            }
        });
        transporter.verify((error /* , success */) => {
            if (error) {
                logger.error('Configured server is not functioning!');
                logger.error(error);
                transporter = null;
            }
        });
    }
}

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
Mailer.prototype.send = (params, callback) => {
    const deferred = Q.defer();
    const {logger, transporter, gmeConfig} = this;

    if (transporter) {
        transporter.sendMail({
            from: gmeConfig.mailer.from,
            to: params.to,
            subject: params.subject,
            text: params.message, // TODO we might want  to consider nicer, HTML bodied e-mails
        }, (error, info) => {
            if (error) {
                logger.error('Unable to sedn e-mail: ' + error);
                deferred.reject(error);
            } else {
                logger.info('Email sent: ' + info.response);
                deferred.resolve();
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
 * @param {function} [callback] - if provided no promise will be returned.
 *
 * @return {external:Promise}  On finishing the promise will be resolved.
 * On error the promise will be rejected with {@link Error} <b>error</b>.
 */
Mailer.prototype.passwordReset = (params, callback) => {
    const deferred = Q.defer();
    const {logger, transporter, gmeConfig} = this;

    if (transporter) {
        transporter.sendMail({
            from: gmeConfig.mailer.from,
            to: params.to,
            subject: params.subject,
            text: params.message, // TODO we might want  to consider nicer, HTML bodied e-mails
        }, (error, info) => {
            if (error) {
                logger.error('Unable to sedn e-mail: ' + error);
                deferred.reject(error);
            } else {
                logger.info('Email sent: ' + info.response);
                deferred.resolve();
            }
        });
    } else {
        deferred.reject(new Error('No server connection!'));
    }
    return deferred.promise.nodeify(callback);
};

module.exports = Mailer;

