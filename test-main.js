/*globals requirejs*/
/*eslint-env browser*/
/*eslint no-console: 0*/

'use strict';

var allTestFiles = [],
    TEST_REGEXP = /(spec|test)\.js$/i,

    pathToModule = function (path) {
        return path.replace(/^\/base\//, '').replace(/\.js$/, '');
    };

Object.keys(window.__karma__.files).forEach(function (file) {
    if (TEST_REGEXP.test(file)) {
        // Normalize paths to RequireJS module names.
        allTestFiles.push(pathToModule(file));
    }
});

requirejs.config({
    // Karma serves files under /base, which is the basePath from your config file
    baseUrl: '/base',

    paths: {
        client: './src/client',
        plugin: './src/plugin',
        text: './src/common/lib/requirejs/text',

        // plugins
        // TODO: populate plugin list dynamically based on config.json
        'plugin/MinimalWorkingExample': './src/plugin/coreplugins',
        'plugin/PluginForked': './test/plugin/scenarios/plugins',
        'plugin/AbortPlugin': './test-karma/assets/plugins',
        'plugin/WaitPlugin': './test-karma/assets/plugins',

        executor: './src/common/executor',
        blob: './src/common/blob',
        common: './src/common',

        superagent: './src/common/lib/superagent/superagent',
        debug: './src/common/lib/debug/debug',
        chance: './src/common/lib/chance/chance',
        q: './src/common/lib/q/q',
        'webgme-ot': './src/common/lib/webgme-ot/webgme-ot',

        karmatest: './test-karma'
    },


    // dynamically load all test files
    deps: allTestFiles,

    // we have to kickoff jasmine, as it is asynchronous
    callback: testServerConnection
});

function done(err) {
    if (err) {
        console.error(err);
    }
    window.__karma__.start();
}

function testServerConnection() {
    requirejs(['superagent'], function (superagent) {

        var maxTries = 20,
            i = 0,
            timeout = 300;

        function tryToGetGmeConfig() {
            console.log('Trying to get gmeConfig.json ... ', i, i * timeout / 1000);
            superagent.get('/base/gmeConfig.json')
                .end(function (err, res) {
                    if (res && res.status === 200) {
                        console.log('Got gmeConfig.json');
                        done();
                    } else {
                        i += 1;
                        if (i < maxTries) {
                            setTimeout(tryToGetGmeConfig, timeout);
                        } else {
                            done(err, res);
                        }
                    }
                });
        }

        tryToGetGmeConfig();
    });
}
