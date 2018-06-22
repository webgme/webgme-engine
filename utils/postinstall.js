/*eslint-env node*/
/*eslint no-console: 0*/
/**
 * 1. Browserifies the common-libs
 * 2. Copies over requirejs and requirejs/text bundles to common-libs
 * 2. Optionally runs the prepublish script if distribution file does not exist.
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var path = require('path'),
    fs = require('fs'),
    Q = require('q'),
    browserify = require('browserify'),
    ensureDir = require('../src/server/util/ensureDir'),
    copyFile = require('../src/server/util/copyFile'),
    prepublish = require('./prepublish'),
    LIB_ROOT_DIR = path.join(__dirname, '../src/common/lib'),
    COMMON_LIBS = require(path.join(LIB_ROOT_DIR, 'COMMON_LIBS.json'));

function browserifyModule(info) {
    var b = browserify({
            standalone: info.name
        }),
        result = {
            outDir: path.join(LIB_ROOT_DIR, info.name),
            outFile: path.join(LIB_ROOT_DIR, info.name, info.name + '.js'),
        };

    console.log('Browserifying ' + info.name + ' into ' + LIB_ROOT_DIR + '');
    b.require(info.name);

    return ensureDir(result.outDir)
        .then(function () {
            return Q.ninvoke(b, 'bundle');
        })
        .then(function (buf) {
            return Q.nfcall(fs.writeFile, result.outFile, buf);
        });
}

/**
 * The path to the template in the jsdoc.json does not match for npm > 3 when webgme
 * is installed in another repo. I these cases we need to generate an alternative config
 * with the resolved path to the template.
 * @return {string} Path to jsdoc that should be used.
 */
function resolveJSDocConfigPath() {
    var jsdocConfJson = require('../jsdoc_conf.json'),
        jsdocConfPath;

    try {
        fs.statSync(jsdocConfJson.opts.template);
        console.log('jsdoc template from default config exists');
    } catch (err) {
        if (err.code === 'ENOENT') {
            jsdocConfJson.opts.template = path.join(process.cwd(), '../ink-docstrap/template');
            console.log('jsdoc template from default config did NOT exist! Testing alternative location',
                jsdocConfJson.opts.template);

            try {
                fs.statSync(jsdocConfJson.opts.template);
                jsdocConfPath = path.join(process.cwd(), 'jsdoc_alt_conf.json');
                console.log('alternative location existed, generating alternative configuration', jsdocConfPath);
                fs.writeFileSync(jsdocConfPath, JSON.stringify(jsdocConfJson), 'utf8');

            } catch (err2) {
                if (err.code === 'ENOENT') {
                    console.error('Will not generate source code documentation files!');
                    jsdocConfPath = false;
                } else {
                    console.error(err);
                }
            }
        } else {
            console.error(err);
        }
    }

    return jsdocConfPath;
}

function hasDistFiles() {
    var fName = path.join(__dirname, '../dist/webgme.classes.build.js'),
        result = true;

    try {
        fs.statSync(fName);
    } catch (err) {
        if (err.code === 'ENOENT') {
            result = false;
        } else {
            console.error(err);
        }
    }

    return result;
}

Q.all(COMMON_LIBS.map(browserifyModule))
    .then(function () {
        //Special handling for requirejs and requirejs/text
        var outDir = path.join(LIB_ROOT_DIR, 'requirejs');
        return ensureDir(outDir)
            .then(function () {
                return Q.all([
                    copyFile(require.resolve('requirejs-text'), path.join(outDir, 'text.js')),
                    copyFile(path.join(path.dirname(require.resolve('requirejs')), '..', 'require.js'),
                        path.join(outDir, 'require.js'))
                ]);
            });
    })
    .then(function () {
        if (hasDistFiles() === false) {
            console.log('dist files did not exist, will call prepublish');
            prepublish(resolveJSDocConfigPath());
        } else {
            console.log('dist files existed, will not build from postinstall');
        }
    })
    .catch(function (err) {
        console.error(err);
        process.exit(1);
    });


