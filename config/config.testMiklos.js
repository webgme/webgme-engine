/**
 * @author kecso / https://github.com/kecso
 */
/*jshint node: true*/

var config = require('./config.test');

config.server.port = 9001;

config.mongo.uri = 'mongodb://129.59.105.197:27017/miklos';

module.exports = config;
