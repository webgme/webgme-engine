/*globals define, console*/
/*eslint-env browser*/

/**
 * @author kecso / https://github.com/kecso
 * @author pmeijer / https://github.com/pmeijer
 */

define(['common/storage/constants'], function (CONSTANTS) {
    'use strict';

    class WebsocketRouterAccessClient {
        constructor(routerId, send, connectReceiveFunctions) {
            this._id = routerId;
            this._send = send;
            this._isConnected = false;
            const handleObject = {};
            handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE] = (payload, callback) => {
                this._onDisconnectHandle(payload, callback);
            };
            handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT] = (payload, callback) => {
                this._onDisconnectHandle(payload, callback);
            }; 

            connectReceiveFunctions(this._id, handleObject);
        }

        connect(callback) {
            this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.CONNECT, null, (err, data) => {
                if (!err) {
                    this._isConnected = true;
                }
                callback(err, data);
            });
        }

        send(payload, callback) {
            this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE, payload, callback);
        }

        disconnect(reason, callback) {
            this._isConnected = false;
            this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT, reason, callback);
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
            storage.sendWsRouterMessage(routerId, messageType, payload, callback);
        }

        function connectHandles(routerId, handles) {
            handles[routerId] = handles;
        }

        function processMessage(routerId, messageType, payload) {

        }

        function getWebsocketRouterAccess(routerId) {
            if (routers[routerId]) {
                return routers[routerId];
            } 
            
            routers[routerId] = new WebsocketRouterAccessClient(routerId, send, connectHandles);
            return routers[routerId];
        }


        storage.onWebsocketRouterMessage(processMessage);
        
        return {
            getWebsocketRouterAccess: getWebsocketRouterAccess
        };
    }

    return WebsocketRouterAccess;
});
