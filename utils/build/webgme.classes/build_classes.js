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
            q: './common/lib/q/q',
            chance: './common/lib/chance/chance'
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

function doBuild(callback) {
    requirejs.optimize(config, function (data) {
        callback(null, data);
    }, function (err) {
        callback(err);
    });
}

if (require.main === module) {
    doBuild(function (err, data) {
        if (err) {
            console.error(err);
        } else {
            console.log(data);
        }
    });
}

module.exports = doBuild;
