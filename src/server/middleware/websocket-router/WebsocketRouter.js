class WebsocketRouter {
    constructor(websocket, routerId) {
        this._ws = websocket;
        this._id = routerId;
        this._sockets = {};
        this._socket2user = {};
        this._onConnectHandle = () => {};
        
        this._userConnected = this._userConnected.bind(this);
        this._userDisconnected = this._userDisconnected.bind(this);
        this.send = this.send.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.onConnect = this.onConnect.bind(this);
        this.onMessage = this.onMessage.bind(this);
        
        this._ws.handleWebsocketRouterUsers(routerId, this._userConnected);
    }

    _userConnected(socket) {
        this._sockets[socket.id] = socket;
        this._socket2user[socket.id] = new WebsocketRouterUser(socket, this._id, this);
        socket.join(this._id);
    }

    _userDisconnected(socketId) {
        delete this._socket2user[socket.id];
        delete this._sockets[socket.id];
    }

    onConnect(handleFn) {
        this._onConnectHandle = handleFn;
    }

    onMessage(handleFn) {
        if(this._messageListeners.indexOf(handleFn) === -1) {
            this._messageListeners.push(handleFn);
        }
    }

    send(payload) {
        this._ws.in(this._routerId).emit('websocketRouterMessage',  {
            routerId: this._routerId,
            payload: payload,
        });
    }

    disconnect(error) {
        Object.keys(this._socket2user).forEach(socketId => {
            this._socket2user[socketId].disconnect(error);
        });
    }
}

class WebsocketRouterUser {
    constructor(socket, routerId, router) {
        this._routerId = routerId;
        this._socket = socket;
        this._router = router;

        this.send = this.send.bind(this);
        this.error = this.error.bind(this);
        this.disconnect = this.disconnect.bind(this);

        const handleMessage = (data, callback) => {
            this._messageListeners.forEach(listenerFn => {
                listenerFn(data.payload);
            });
            callback(null);
        };

        this._disconnect = () => {
            socket.removeListener('websocketRouterMessage', handleMessage);
            socket.removeListener('disconnectFromWebsocketRouter', handleDisconnect);
            router._userDisconnected(socket.id);
        };

        const handleDisconnect = (data, callback) => {
            // TODO: is there something we need to do other than removing listeners?
            // or we even have to keep the listeners and respond with error for all the followup messages?
            // probably not as connect-disconnect-connect would screw up everything
            this._disconnect();
            callback(null);
        };

        socket.on('websocketRouterMessage',handleMessage);
        socket.on('disconnectFromWebsocketRouter', handleDisconnect);
    }

    send(payload) {
        this._socket.emit('websocketRouterMessage', {
            routerId: this._routerId,
            payload: payload,
        });
    }

    error(err) {
        this._socket.emit('websocketRouterError', {
            routerId: this._routerId,
            error: err.message,
        });
    }

    disconnect(err) {
        this._socket.emit('websocketRouterDisconnected', {
            routerId: this._routerId,
            error: err.message,
        });
        
        this._disconnect();
    }
}

// module.exports = {
    // WebsocketRouter: WebsocketRouter
// }
export {WebsocketRouter}