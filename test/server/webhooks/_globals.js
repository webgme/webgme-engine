/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */


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

    var pub = redis.createClient('redis://' + gmeFixture.getGmeConfig().socketIO.adapter.options.uri);

    function stop() {
        pub.quit();
    }

    function send(channel, eventType, eventData) {
        var msg = MSG.encode(['uid', {data: [eventType, eventData]}, {}]);
        pub.publish(channel, msg);
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