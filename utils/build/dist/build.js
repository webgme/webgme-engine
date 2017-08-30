/*globals*/
/*jshint node:true, camelcase:false*/
/**
 *
 *
 * node ./node_modules/requirejs/bin/r.js -o ./utils/build/dist/build.js
 *
 * nodemon -i dist ./node_modules/requirejs/bin/r.js -o ./utils/build/dist/build.js
 *
 * @author pmeijer / https://github.com/pmeijer
 */
'use strict';

var requirejs = require('requirejs'),
    path = require('path'),
    fs = require('fs'),
    Q = require('q'),
    config = {
        baseUrl: path.join(__dirname, '../../../src'),
        paths: {
            blob: 'common/blob',
            executor: 'common/executor',

            q: 'empty:',
            superagent: 'empty:',
            debug: 'empty:',
            chance: 'empty:'
        },
        shim: {},
        exclude: [],
        include: [
            'client/client'
        ],
        out: path.join(__dirname, '../../../dist/webgme.client.build.js'),
        // optimize: 'uglify2',
        optimize: 'none',
        // generateSourceMaps: true,
        // preserveLicenseComments: false,
        // inlineText: true,
        // wrap: {
        //     startFile: path.join(__dirname, '../../../src/client/js/start.js')
        // }
    };

function doBuilds(callback) {
    var start = Date.now();

    function callOptimizer(theConfig) {
        var deferred = Q.defer();
        requirejs.optimize(theConfig, deferred.resolve, deferred.reject);
        return deferred.promise;
    }

    return Q.all([
        callOptimizer(config)
    ])
        .then(function (result) {
            console.log('Build time', (Date.now() - start) / 1000, 's');
            return result;
        })
        .nodeify(callback);
}

if (require.main === module) {
    doBuilds(function (err, data) {
        if (err) {
            console.error(err);
        } else {
            console.log(data);
        }
    });
}

module.exports = doBuilds;