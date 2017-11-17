/*globals define*/
/*eslint-env node, browser, no-bitwise: 0*/

/**
 * @author kecso / https://github.com/kecso
 */

define(function () {
    'use strict';

    var guid = function () {
        var S4 = function () {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };

        //return GUID
        return (S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4());
    };

    return guid;
});