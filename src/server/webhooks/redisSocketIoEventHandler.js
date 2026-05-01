/*eslint-env node*/
/**
 * @author kecso / https://github.com/kecso
 */
var redis = require('redis'),
    MSG = require('msgpack-js'),
    Q = require('q');

function redisSocketIoEventHandler(options) {
    var redisUrl = options.uri || 'redis://127.0.0.1:6379',
        client = redis.createClient({url: redisUrl}),
        eventFn = options.eventFn || function (eventType, eventData) {
            // eslint-disable-next-line no-console
            console.log('event: ', eventType, ' : ', eventData);
        },
        channelPattern = 'socket.io#/#*', // TODO find a pattern to exclude something
        excludedEvents = options.exclude || ['BRANCH_UPDATED'],
        startDeferred = Q.defer(),
        started = false;

    function handleMessage(channel, rawMessage) {
        // eslint-disable-next-line no-console
        console.log('got message:', channel.toString('utf-8'));
        var messageObject,
            buffer = Buffer.isBuffer(rawMessage) ? rawMessage : Buffer.from(rawMessage);
        try {
            messageObject = MSG.decode(buffer);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('error during message decoding: ', e);
            return;
        }

        //we only interested in the actual data of the event
        messageObject = messageObject[1].data;
        if (excludedEvents.indexOf(messageObject[0]) === -1) {
            eventFn(messageObject[0], messageObject[1]);
        }
    }

    if (typeof client.on === 'function' && typeof client.pSubscribe !== 'function') {
        // Compatibility with redis v3 legacy API.
        client.on('pmessage', function (pattern, channel, buffer) {
            handleMessage(channel, buffer);
        });

        client.on('psubscribe', function (channel) {
            // eslint-disable-next-line no-console
            console.log('subscribed ', channel.toString('utf-8'));
            startDeferred.resolve();
        });
    }

    function start(callback) {
        if (started) {
            return startDeferred.promise.nodeify(callback);
        }

        started = true;
        if (typeof client.pSubscribe === 'function') {
            client.connect()
                .then(function () {
                    return client.pSubscribe(channelPattern, function (message, channel) {
                        handleMessage(channel, message);
                    }, true);
                })
                .then(function () {
                    // eslint-disable-next-line no-console
                    console.log('subscribed ', channelPattern);
                    startDeferred.resolve();
                })
                .catch(function (err) {
                    startDeferred.reject(err);
                });
        } else {
            client.psubscribe(channelPattern);
        }

        return startDeferred.promise.nodeify(callback);
    }

    function stop() {
        if (typeof client.pUnsubscribe === 'function') {
            client.pUnsubscribe(channelPattern)
                .then(function () {
                    return client.quit();
                })
                .catch(function () {
                    return client.disconnect();
                });
        } else {
            client.punsubscribe();
            client.quit();
        }
    }

    return {
        start: start,
        stop: stop
    };
}

module.exports = redisSocketIoEventHandler;
