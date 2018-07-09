/*eslint-env node*/
/*eslint no-console: 0*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

function prepublish(jsdocConfigPath) {
    var raml2html = require('raml2html'),
        path = require('path'),
        fs = require('fs'),
        childProcess = require('child_process'),
        configWithDefaultTemplates = raml2html.getDefaultConfig();

    if (process.env.TRAVIS_LINT_TEST) {
        console.warn('LINT_TEST defined - skipping build completely');
        return;
    }

    console.log('Generating REST API docs ...');

    raml2html.render(path.join(__dirname, '..', 'src', 'server', 'api', 'webgme-api.raml'), configWithDefaultTemplates)
        .then(function (indexHtml) {
            fs.writeFileSync(path.join(__dirname, '..', 'docs', 'REST', 'index.html'), indexHtml);
            console.log('Done with REST API docs!');
        }, function (err) {
            console.error('Failed generating REST API docs!', err);
            process.exit(1);
        });


    if (process.env.TEST_FOLDER && process.env.TEST_FOLDER !== 'test/server') {
        console.warn('TEST_FOLDER environment variable is set and not to test/server, skipping distribution scripts.');
    } else {
        var webgmeBuild = require('./build/webgme.classes/build_classes.js');

        console.log('Generating webgme.classes.build.js ...');
        webgmeBuild(function (err/*, data*/) {
            if (err) {
                console.error('Failed generating webgme.classes.build.js!', err);
                process.exit(1);
            } else {
                console.log('Done with webgme.classes.build.js!');
            }
        });
    }

    if (jsdocConfigPath !== false) {
        console.log('Generating webgme source code documentation ...');
        childProcess.execFile(process.execPath,
            [path.join(__dirname, './jsdoc_build.js'), '-c', jsdocConfigPath || './jsdoc_conf.json'],
            null,
            function (err) {
                if (err) {
                    console.error('Failed generating source code documentation!', err);
                    process.exit(1);
                } else {
                    console.log('Done with source code documentation!');
                }
            });
    }
}

if (require.main === module) {
    prepublish();
}

module.exports = prepublish;
