/*eslint-env node*/
/*eslint no-console: 0*/
/**
 * @author kecso / https://github.com/kecso
 */

'use strict';

var requirejs = require('requirejs'),
    fs = require('fs'),
    requireJsPath = (fs.existsSync('./node_modules') && fs.readdirSync('./node_modules').indexOf('requirejs') !== -1) ?
        '../node_modules/requirejs/require' : '../../requirejs/require',
    config = {
        name: 'webgme.classes',
        out: './dist/webgme.classes.build.js',
        baseUrl: './src',
        paths: {
            'webgme.classes': '../utils/build/webgme.classes/webgme.classes',
            blob: './common/blob',
            executor: './common/executor',
            superagent: './common/lib/superagent/superagent',
            debug: './common/lib/debug/debug',
            ejs: './common/lib/ejs/ejs',
            q: './common/lib/q/q',
            chance: './common/lib/chance/chance',
            'webgme-ot': './common/lib/webgme-ot/webgme-ot'
        },
        optimize: 'none',
        generateSourceMaps: true,
        insertRequire: ['webgme.classes'],
        wrap: {
            startFile: './utils/build/webgme.classes/start.frag',
            endFile: './utils/build/webgme.classes/end.frag'
        },
        include: [requireJsPath]
    };

function doBuilds(callback) {
    var minConfig = JSON.parse(JSON.stringify(config));
    minConfig.out = './dist/webgme.classes.build.min.js';
    minConfig.optimize = 'uglify2';

    requirejs.optimize(minConfig, function (res1) {
        requirejs.optimize(config, function (res2) {
            callback(null, [res1, res2]);
        }, function (err2) {
            callback(err2);
        });
    }, function (err) {
        callback(err);
    });
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
