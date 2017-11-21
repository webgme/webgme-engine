/*eslint-env node*/

/**
 * This serves the login.html in src/client/app without authentication at profile/login
 *
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var express = require('express'),
    router = express.Router(),
    path = require('path'),
    LOGIN_HTML = path.join(__dirname, '../../../app/login.html');

function initialize(middlewareOpts) {
    var logger = middlewareOpts.logger.fork('ExampleRestRouter');

    logger.info('initializing login router login-html:', LOGIN_HTML);

    router.get('/login', function (req, res) {
        res.contentType('text/html');
        res.sendFile(LOGIN_HTML);
    });
}

/**
 * Called before the server starts listening.
 * @param {function} callback
 */
function start(callback) {
    callback();
}

/**
 * Called after the server stopped listening.
 * @param {function} callback
 */
function stop(callback) {
    callback();
}


module.exports = {
    initialize: initialize,
    router: router,
    start: start,
    stop: stop
};