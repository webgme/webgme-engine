/*globals define, requirejs, wasm_bindgen*/
/*eslint-env node, browser*/
/*eslint camelcase: 0*/

/**
 * @author kecso / https://github.com/kecso
 */

define([
    'common/util/sha1',
    'common/util/assert',
    'common/util/canon'
], function (generateSHA1, ASSERT, CANON) {
    'use strict';

    var wasm_node = null;
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
    } else {
        //TODO why does it have to be static full path???
        const path = require('path');
        wasm_node = require(
            path.join(requirejs.s.contexts._.config.baseUrl, 'common/util/rust/sha1/node/wasm-sha1-node')
        );
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
                if (wasm_node) {
                    return wasm_node.hash(CANON.stringify(object));
                } else {
                    return wasm_bindgen.hash(CANON.stringify(object));
                }
            default: //plainSHA1
                return generateSHA1(CANON.stringify(object));
        }
    };
});
