/*globals requireJS, module*/
'use strict';

const CONSTANTS = requireJS('common/storage/constants');

class WebsocketRouterUser {
    constructor(socket, router) {
        this._socket = socket;
        this._id = socket.id;
        this.userId = socket.userId;
        this._router = router;

        const handleObject = {};
        handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE] = (payload, callback) => {
            this._msgHandle(payload, callback);
        };
        handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT] = (payload, callback) => {
            this._discHandle(payload, callback);
        }; 

        this._router.connectUser(this._id, handleObject);
    }

    send(payload) {
        this._socket.emit('websocketRouterMessage', {
            routerId: this._router.getRouterId(),
            messageType: CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE,
            payload: payload,
        });
    }

    disconnect(err) {
        this._socket.emit('websocketRouterMessage', {
            routerId: this._routerId,
            messageType: CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT,
            error: err.message,
        });
    }

    onMessage(handleFn) {
        this._msgHandle = handleFn;
    }

    onDisconnect(handleFn) {
        this._discHandle = handleFn;
    }
}
class WebsocketRouter {
    constructor(websocket, routerId) {
        this._id = CONSTANTS.WEBSOCKET_ROUTER_ROOM_ID_PREFIX + routerId;
        this._routerId = routerId;
        this._sockets = {};
        this._handles = {};
        this._onConnectHandle = (user, callback) => {callback(null);};
        
        const handleObject = {};
        handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.CONNECT] = (socket, callback) => {
            this._sockets[socket.id] = socket;
            socket.join(this._id);
            const user = new WebsocketRouterUser(socket, this);
            this._onConnectHandle(user, callback);
        };

        handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT] = (socketId, payload, callback) => {
            // user initiated disconnect
            this._handles[socketId][CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT](payload, callback);
            this._sockets[socketId].leave(this._id);
            delete this._handles[socketId];
            delete this._sockets[socketId];
        };
        handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE] = (socketId, payload, callback) => {
            this._handles[socketId][CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE](payload, callback);
        };

        this._ws = websocket.handleWebsocketRouterMessages(routerId, handleObject);
    }

    
    onConnect(handleFn) {
        this._onConnectHandle = handleFn;
    }

    send(payload) {
        this._ws.to(this._id).emit('websocketRouterMessage',  {
            routerId: this._routerId,
            messageType: CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE,
            payload: payload,
        });
    }

    disconnect(error) {
        this._ws.to(this._id).emit('websocketRouterMessage',  {
            routerId: this._routerId,
            messageType: CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT,
            payload: error.message,
        });
        Object.keys(this._sockets).forEach(socketId => {
            this._sockets[socketId].leave(this._id);
        });
        this._sockets = {};
        this._handles = {};
    }

    connectUser(socketId, handles) {
        this._handles[socketId] = handles;
    }

    getRoomId() {
        return this._id;
    }

    getRouterId() {
        return this._routerId;
    }
}

module.exports = WebsocketRouter;