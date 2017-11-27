/*globals define*/
/*eslint-env node, browser*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */
define([], function () {
    function DocumentClient(socket) {
        this.socket = socket;

        var self = this;
        socket
            .on('client_left', function (clientId) {
                self.trigger('client_left', clientId);
            })
            .on('set_name', function (clientId, name) {
                self.trigger('set_name', clientId, name);
            })
            .on('ack', function () { self.trigger('ack'); })
            .on('operation', function (data) {
                //console.log('Incoming operation', data.clientId, data.operation, data.selection);
                self.trigger('operation', data);
                self.trigger('selection', data);
            })
            .on('selection', function (clientId, selection) {
                self.trigger('selection', clientId, selection);
            })
            .on('reconnect', function () {
                self.trigger('reconnect');
            });
    }

    DocumentClient.prototype.registerCallbacks = function (cb) {
        this.callbacks = cb;
    };

    DocumentClient.prototype.trigger = function (event) {
        var args = Array.prototype.slice.call(arguments, 1);
        var action = this.callbacks && this.callbacks[event];
        if (action) { action.apply(this, args); }
    };


    return DocumentClient;
});


