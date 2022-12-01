/*eslint-env node*/
/**
 * @author kecso / https://github.com/kecso
 */
var redis = require('redis'),
    MSG = require('msgpack-js'),
    Q = require('q');

function redisSocketIoEventHandler(options) {
    var client = redis.createClient(options.uri || 'redis://127.0.0.1:6379', { return_buffers: true }),
        eventFn = options.eventFn || function (eventType, eventData) {
            console.log('event: ', eventType, ' : ', eventData);
        },
        channelPattern = 'socket.io#/#*', // TODO find a pattern to exclude something
        excludedEvents = options.exclude || ['BRANCH_UPDATED'],
        startDeferred = Q.defer();

    client.on('pmessage', function (pattern, channel, buffer) {
        console.log('got message:', channel.toString('utf-8'));
        var messageObject;
        try {
            messageObject = MSG.decode(buffer);
        } catch (e) {
            console.error('error during message decoding: ', e);
            return;
        }

        //we only interested in the actual data of the event
        messageObject = messageObject[1].data;
        if (excludedEvents.indexOf(messageObject[0]) === -1) {
            eventFn(messageObject[0], messageObject[1]);
        }
    });

    client.on('psubscribe', function (channel) {
        console.log('subscribed ', channel.toString('utf-8'));
        startDeferred.resolve();
    });

    function start(callback) {
        client.psubscribe(channelPattern);
        return startDeferred.promise.nodeify(callback);
    }

    function stop() {
        client.punsubscribe();
        client.quit();
    }

    return {
        start: start,
        stop: stop
    };
}

module.exports = redisSocketIoEventHandler;
