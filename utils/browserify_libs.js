/*globals*/
/**
 *
 *
 *
 * @author pmeijer / https://github.com/pmeijer
 */

var LIB_DIR = './src/common/lib/',
    fs = require('fs'),
    browserify = require('browserify');


function getLibraryDescriptions(callback) {


    callback([{
        entries: LIB_DIR + 'superagent'
    }])
}
