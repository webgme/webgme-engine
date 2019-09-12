/*globals define*/
/*eslint-env node, browser*/

/**
 * @author kecso / https://github.com/kecso
 */

define([
    'common/util/sha1',
    'common/util/assert',
    'common/util/canon'
], function (generateSHA1, ASSERT, CANON) {
    'use strict';

    function run() {
        requirejs(['common/util/rust/sha1/web/wasm-sha1'], function () {
            wasm_bindgen('common/util/rust/sha1/web/wasm-sha1_bg.wasm')
                .then(function () {
                    //nothing to do as wasm_bindgen holds the key
                });
        });
    }

    if (typeof window !== 'undefined') {
        run();
    }

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
        const keyType = gmeConfig.storage.keyType;
        ASSERT(typeof keyType === 'string');

        switch (keyType) {
            case 'rand160Bits':
                return rand160Bits();
            case 'rustSHA1':
                return wasm_bindgen.hash(CANON.stringify(object));
            default: //plainSHA1
                return generateSHA1(CANON.stringify(object));
        }
    };
});
