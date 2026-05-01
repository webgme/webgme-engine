/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */


// Testfixture from when webhooks were in a its own repo.

var exports = {},
    EXPRESS_SERVER_PORT = 42025,
    gmeFixture = require('../../_globals.js'),
    redis = require('redis'),
    Q = require('q'),
    expect = require('chai').expect,
    express = require('express'),
    bodyParser = require('body-parser'),
    mongodb = require('mongodb'),
    MessageSender = require('../../../src/server/webhooks/hookMessenger'),
    MSG = require('msgpack-js'),
    EventHandler = require('../../../src/server/webhooks/redisSocketIoEventHandler');

function EventGenerator() {

    var pub = redis.createClient({url: 'redis://127.0.0.1:6379'}),
        readyPromise = typeof pub.connect === 'function' ? pub.connect() : Promise.resolve();

    function stop() {
        readyPromise
            .then(function () {
                return pub.quit();
            })
            .catch(function () {
                // ignore teardown errors in tests
            });
    }

    function send(channel, eventType, eventData) {
        var msg = MSG.encode(['uid', {data: [eventType, eventData]}, {}]);
        readyPromise
            .then(function () {
                return pub.publish(channel, msg);
            })
            .catch(function (err) {
                // eslint-disable-next-line no-console
                console.error('failed to publish redis message in test fixture', err);
            });
    }

    return {
        send: send,
        stop: stop
    };
}

exports.EventGenerator = EventGenerator;
exports.MessageSender = MessageSender;
exports.EventHandler = EventHandler;
exports.expect = expect;
exports.Q = Q;
exports.express = express;
exports.bodyParser = bodyParser;
exports.mongodb = mongodb;
exports.gmeFixture = gmeFixture;
exports.EXPRESS_SERVER_PORT = EXPRESS_SERVER_PORT;

module.exports = exports;