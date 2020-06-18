/*globals define, console*/
/*eslint-env browser*/

/**
 * @author kecso / https://github.com/kecso
 * @author pmeijer / https://github.com/pmeijer
 */

define(['common/storage/constants', 'q'], function (CONSTANTS, Q) {
    'use strict';
    class WebsocketRouterAccessClient {
        constructor(routerId, logger, send, connectReceiveFunctions) {
            this._id = routerId;
            this._logger = logger;
            this._send = send;
            this._isConnected = false;
            const handleObject = {};
            handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE] = (payload) => {
                if (typeof this._onMessageHandle === 'function') {
                    this._onMessageHandle(payload);
                } else {
                    logger.warn('Receiving message without handle [' + routerId + ']');
                }
            };
            handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT] = (payload) => {
                if (typeof this._onDisconnectHandle === 'function') {
                    this._onDisconnectHandle(payload);
                } else {
                    logger.warn('Receiving disconnect without handle [' + routerId + ']');
                }
            }; 

            connectReceiveFunctions(this._id, handleObject);
        }

        connect(callback) {
            const deferred = Q.defer();

            this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.CONNECT, null, (err, data) => {
                if (!err) {
                    this._isConnected = true;
                    deferred.resolve(data);
                } else {
                    deferred.reject(err);
                }
            });

            return deferred.promise.nodeify(callback);
        }

        send(payload, callback) {
            return this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE, payload).nodeify(callback);
        }

        disconnect(reason, callback) {
            this._isConnected = false;
            return this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT, reason).nodeify(callback);
        }

        onMessage(handleFn) {
            this._onMessageHandle = handleFn;
        }

        onDisconnect(handleFn) {
            this._onDisconnectHandle = handleFn;
        }

        isConnected() {
            return this._isConnected;
        }
    }

    /**
     * @param {string} _id - Path of node.
     * @param {GmeLogger} logger - logger.
     * @param {object} state - state of the client.
     * @param {function} storeNode - invoked when storing new nodes.
     * @constructor
     */
    function WebsocketRouterAccess(logger, client, storage) {
        const routers = {};
        const handles = {};

        function send(routerId, messageType, payload, callback) {
            const deferred = Q.defer();
            logger.debug('outgoing message to websocket router',
                {metadata: {routerId: routerId, messageType: messageType, payload: payload}});
            storage.sendWsRouterMessage(routerId, messageType, payload, (err, result) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(result);
                }
            });

            return deferred.promise.nodeify(callback);
        }

        function connectHandles(routerId, clientHandles) {
            logger.debug('access binding [' +  routerId + ']');
            handles[routerId] = clientHandles;
        }

        function processMessage(routerId, messageType, payload) {
            if (handles[routerId] && routers[routerId]) {
                switch (messageType) {
                    case CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE:
                    case CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT:
                        logger.debug('incoming message from websocket router',
                            {metadata: {routerId: routerId, messageType: messageType, payload: payload}});
                        handles[routerId][messageType](payload);
                        return;
                }
            }
            logger.debug('bad incoming message from websocket router',
                {metadata: {routerId: routerId, messageType: messageType, payload: payload}});
        }

        function getWebsocketRouterAccess(routerId) {
            logger.debug('getting websocket router access [' + routerId + ']');
            if (routers[routerId]) {
                return routers[routerId];
            } 
            
            routers[routerId] = new WebsocketRouterAccessClient(routerId, logger.fork(routerId), send, connectHandles);
            return routers[routerId];
        }


        storage.onWebsocketRouterMessage(processMessage);
        
        return {
            getWebsocketRouterAccess: getWebsocketRouterAccess
        };
    }

    return WebsocketRouterAccess;
});
