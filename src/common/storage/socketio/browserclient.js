/*globals define, require, document*/
/*eslint-env browser*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

define(['common/util/url'], function (URL) {
    'use strict';

    function IoClient(mainLogger, gmeConfig) {
        var logger = mainLogger.fork('socketio-browserclient');

        this.connect = function (callback) {
            var hostAddress = window.location.protocol + '//' + window.location.host,
                socketIoUrl;

            if (window.__karma__) {
                // TRICKY: karma uses web sockets too, we need to use the gme server's port
                hostAddress = window.location.protocol + '//localhost:' + gmeConfig.server.port;
            }

            socketIoUrl = hostAddress + gmeConfig.client.mountedPath + '/socket.io/socket.io.js';
            logger.debug('Will require socketIO from', socketIoUrl);

            require([socketIoUrl], function (io_) {
                var io = io_ || window.io,
                    socketOptions = gmeConfig.socketIO.clientOptions,
                    socket;

                if (gmeConfig.client.mountedPath && gmeConfig.socketIO.clientOptions.path === undefined) {
                    socketOptions.path = gmeConfig.client.mountedPath + '/socket.io';
                }
                logger.debug('Connecting to "' + hostAddress + '" with options', socketOptions);
                socket = io(hostAddress, socketOptions);
                callback(null, socket);
            });
        };

        this.getToken = function () {
            var cookies = URL.parseCookie(document.cookie);
            if (cookies[gmeConfig.authentication.jwt.cookieId]) {
                return cookies[gmeConfig.authentication.jwt.cookieId];
            }
        };

        this.setToken = function (newToken) {
            document.cookie = gmeConfig.authentication.jwt.cookieId + '=' + newToken;
        };
    }

    return IoClient;
});