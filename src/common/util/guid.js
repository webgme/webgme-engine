/*globals define*/
/*eslint-env node, browser*/
/*eslint no-bitwise: 0*/

/**
 * @author kecso / https://github.com/kecso
 */

define(function () {
    'use strict';

    var guid = function () {
        var s4 = function () {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };

        //return GUID
        return s4() + [s4(), s4(), s4(), s4(), s4()].join('-') + s4() + s4();
    };

    return guid;
});