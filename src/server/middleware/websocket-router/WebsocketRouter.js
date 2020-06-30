/*globals requireJS, module*/
'use strict';

const CONSTANTS = requireJS('common/storage/constants');

function __connectUserToRouter(router, socketId, handles) {
    router._handles[socketId] = handles;
}
/** Class for individual users connected via websocket to the websocket router. */
class WebsocketRouterUser {
    /**
     * Create a WebsocketRouterUser (normally called automatically as a response to a connect event).
     * @param {object} socket - The socket that just joined the router specific room (connected).
     * @param {object} router - The router where the user was connecting.
     */
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

        __connectUserToRouter(this._router, this._id, handleObject);
    }

    /**
     * Sends a message to the connected users.
     * @param {object} payload - The content object of the message (has to be stringifiable!).
     */
    send(payload) {
        this._socket.emit('websocketRouterMessage', {
            routerId: this._router.getRouterId(),
            messageType: CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE,
            payload: payload,
        });
    }

    /**
     * Forcefully disconnects the connected users (notification will be sent).
     * @param {Error} error - The error that describes the reason for disconnect.
     */
    disconnect(err) {
        this._socket.emit('websocketRouterMessage', {
            routerId: this._router.getRouterId(),
            messageType: CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT,
            payload: err.message,
        });
    }

    /**
     * Sets the message handle of the user.
     * @param {function} handleFn - The function that will be called once the user send a message.
     */
    onMessage(handleFn) {
        this._msgHandle = handleFn;
    }

    /**
     * Sets the disconnect handle of the user.
     * @param {function} handleFn - The function that will be called once the user disconnects from the service.
     */
    onDisconnect(handleFn) {
        this._discHandle = handleFn;
    }
}
/** Class for websocket funcionalities associated with routers. */
class WebsocketRouter {
    /**
     * Create a WebsocketRouter.
     * @param {object} websocket - The websocket server that the router will be attahced to.
     * @param {string} routerId - The id of the router 'usually its name'. 
     * Had to be known by the client user to be able to sucessfully connect.
     */
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

    /**
     * Sets the event handling function of user connect.
     * @param {function} handleFn - The function that needs to be called when a user connects.
     * The function should handle two arguments. The first will be a WebsocketRouterUser object,
     * while the second is a callback (highlighting with an error object if we accept the connection).
     */
    onConnect(handleFn) {
        this._onConnectHandle = handleFn;
    }

    /**
     * Broadcasts a message to all connected users.
     * @param {object} payload - The content object of the message (has to be stringifiable!).
     */
    send(payload) {
        this._ws.to(this._id).emit('websocketRouterMessage',  {
            routerId: this._routerId,
            messageType: CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE,
            payload: payload,
        });
    }

    /**
     * Forcefully disconnects all connected users (they got a notification).
     * @param {Error} error - The error that describes the reason for disconnect.
     */
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

    /**
     * Returns the websocket room id.
     * @return {string} The full id of the websocket room that is used 
     * to separate users of this router.
     */
    getRoomId() {
        return this._id;
    }

    /**
     * Returns the websocket router id.
     * @return {string} The router id of the router.
     */
    getRouterId() {
        return this._routerId;
    }
}

module.exports = WebsocketRouter;