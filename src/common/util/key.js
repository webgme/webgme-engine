/*globals define*/
/*eslint-env node, browser*/

/**
 * @author kecso / https://github.com/kecso
 */

define([
    'common/util/sha1',
    'common/util/assert',
    'common/util/canon',
    'webgme-rust'
], function (generateSHA1, ASSERT, CANON, rust) {
    'use strict';

    var keyType = null;

    function rand160Bits() {
        var result = '',
            i, code;
        for (i = 0; i < 40; i++) {
            code = Math.floor(Math.random() * 16);
            code = code > 9 ? code + 87 : code + 48;
            result += String.fromCharCode(code);
        }
        return result;
    }

    return function KeyGenerator(object, gmeConfig) {
        keyType = gmeConfig.storage.keyType;
        ASSERT(typeof keyType === 'string');

        switch (keyType) {
            case 'rand160Bits':
                return rand160Bits();
            case 'rustSHA1':
                return rust.gen_sha1_key(CANON.stringify(object));
            default: //plainSHA1
                return generateSHA1(CANON.stringify(object));
        }
    };
});
