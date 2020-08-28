/*globals define*/
/*eslint-env node, browser*/
/**
 * @author kecso / https://github.com/kecso
 */
define([], function () {
    'use strict';

    // As the earlier used escape function is outdated and crashed in some scenarios, we replaced with this approach
    var decoder = null;
    if (typeof window === 'undefined') {
        var util = require('util');
        decoder = new util.TextDecoder();
    } else {
        decoder = new TextDecoder();
    }
    //this helper function is necessary as in case of large json objects,
    // the library standard function causes stack overflow
    function uint8ArrayToString(uintArray) {
        return decoder.decode(uintArray);
    }

    return {
        uint8ArrayToString: uint8ArrayToString
    };
});