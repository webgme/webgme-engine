/*eslint-env node*/
/*eslint no-console: 0*/

/**
 * @module Bin:StartServer
 * @author kecso / https://github.com/kecso
 */

'use strict';

var path = require('path'),
    gmeConfig = require(path.join(process.cwd(), 'config')),
    webgme = require('../../index'),
    myServer;

webgme.addToRequireJsPaths(gmeConfig);

myServer = webgme.standaloneServer(gmeConfig);
myServer.start(function (err) {
    if (err) {
        console.error(err);
        process.exit(1);
    }
});