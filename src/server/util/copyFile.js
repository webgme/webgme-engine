/*eslint-env node*/

// TODO: Remove me when webgme requires node >= v8.5.0
/**
 * Falls back on fs.copyFile if node >= v8.5.0.
 * This method returns a promise.
 *
 * @author pmeijer / https://github.com/pmeijer
 */
var fs = require('fs'),
    Q = require('q');

// https://stackoverflow.com/questions/11293857/fastest-way-to-copy-file-in-node-js
/**
 *
 * @param {string} source
 * @param {string} target - target file
 */
function copyFile(source, target) {
    var deferred,
        rd,
        wr;

    if (typeof fs.copyFile === 'function') {
        return Q.ninvoke(fs, 'copyFile', source, target);
    }

    deferred = Q.defer();

    rd = fs.createReadStream(source);
    wr = fs.createWriteStream(target);

    rd.on('error', function (err) {
        deferred.reject(err);
    });

    wr.on('error', function (err) {
        deferred.reject(err);
    });
    wr.on('close', function () {
        deferred.resolve();
    });

    rd.pipe(wr);

    return deferred.promise;
}

module.exports = copyFile;