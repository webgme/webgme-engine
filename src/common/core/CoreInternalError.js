/*globals define*/
/*eslint-env node, browser*/

/**
 * CoreInternalError should be thrown if some internal ASSERTION fails, it triggers some fault inside the core
 * and should typically be checked by the developer team, not the one who uses it.
 * @author kecso / https://github.com/kecso
 */

define([], function () {
    'use strict';
    function CoreInternalError() {
        var error = Error.apply(this, arguments);
        error.name = this.name = 'CoreInternalError';
        this.message = error.message;
        this.stack = error.stack;

        return error;
    }

    CoreInternalError.prototype = Object.create(Error.prototype);
    CoreInternalError.prototype.constructor = CoreInternalError;

    return CoreInternalError;
});