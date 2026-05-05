/*eslint-env node*/
/*eslint no-console: 0*/
/**
 * Build static REST API HTML from RAML 1.0 via OpenAPI 3 (webapi-parser) and Redocly CLI.
 *
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var path = require('path');
var fs = require('fs');
var os = require('os');
var childProcess = require('child_process');
var url = require('url');
var util = require('util');

var execFileAsync = util.promisify(childProcess.execFile);

/**
 * @param {string} ramlPath Absolute path to the main .raml file
 * @param {string} indexHtmlPath Absolute path for the generated index.html
 * @returns {Promise<void>}
 */
function buildRestApiDocs(ramlPath, indexHtmlPath) {
    var wap = require('webapi-parser').WebApiParser;
    var redoclyCli = path.join(
        path.dirname(require.resolve('@redocly/cli/package.json')),
        'bin',
        'cli.js'
    );
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webgme-rest-docs-'));
    var oasPath = path.join(tmpDir, 'openapi.json');

    return wap.raml10
        .parse(url.pathToFileURL(ramlPath).href)
        .then(function (model) {
            return wap.oas30.generateString(model);
        })
        .then(function (oas30Json) {
            fs.writeFileSync(oasPath, oas30Json, 'utf8');
            return execFileAsync(process.execPath, [redoclyCli, 'build-docs', oasPath, '-o', indexHtmlPath], {
                maxBuffer: 10 * 1024 * 1024
            });
        })
        .finally(function () {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (ignore) {
                // ignore cleanup errors
            }
        });
}

module.exports = buildRestApiDocs;
