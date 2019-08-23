/*eslint-env node, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 */


var testFixture = require('../../_globals.js');


describe.only('key generator', function () {
    'use strict';
    var keyGenerator = testFixture.requirejs('common/util/key'),
        expect = testFixture.expect,
        KEY_REGEXP = /^[a-f0-9]{40}$/;

    it('should generate SHA1 hash based on object\'s content', function () {
        var obj = {
                z: 42,
                b: 'test string',
                a: [0, 1, 2],
                c: {
                    h: 'sample'
                }
            },
            key = keyGenerator(obj, {storage: {keyType: ''}});

        expect(key).to.match(KEY_REGEXP);
        expect(key).to.equal('b516a33d63e8e5317c296efa31942fe75611040b');

    });

    it('should generate matching SHA1 hash based on object\'s content', function () {
        var obj1 = {
                z: 42,
                b: 'test string',
                a: [0, 1, 2],
                c: {
                    h: 'sample'
                }
            },
            obj2 = {
                a: [0, 1, 2],
                b: 'test string',
                c: {
                    h: 'sample'
                },
                z: 42
            },
            key1 = keyGenerator(obj1, {storage: {keyType: ''}}),
            key2 = keyGenerator(obj2, {storage: {keyType: ''}});

        expect(key1).to.match(KEY_REGEXP);
        expect(key2).to.match(KEY_REGEXP);
        expect(key1).to.equal(key2);
    });

    it('should generate random 160 bits hash', function () {
        var obj = {
                z: 42,
                b: 'test string',
                a: [0, 1, 2],
                c: {
                    h: 'sample'
                }
            },
            key = keyGenerator(obj, {storage: {keyType: 'rand160Bits'}});

        expect(typeof key).to.equal('string');
        expect(key).to.match(KEY_REGEXP);
    });

    it('should generate matching SHA1 hash from rust and javascript as well', function () {
        var obj1 = {
                z: 42,
                b: 'test string',
                a: [0, 1, 2],
                c: {
                    h: 'sample'
                }
            },
            obj2 = {
                a: [0, 1, 2],
                b: 'test string',
                c: {
                    h: 'sample'
                },
                z: 42
            },
            key1 = keyGenerator(obj1, {storage: {keyType: ''}}),
            key2 = keyGenerator(obj2, {storage: {keyType: 'rustSHA1'}});

        expect(key1).to.match(KEY_REGEXP);
        expect(key2).to.match(KEY_REGEXP);
        expect(key1).to.equal(key2);
    });

    it('should generate rust SHA1 hash based on object\'s content', function () {
        var obj = {
                z: 42,
                b: 'test string',
                a: [0, 1, 2],
                c: {
                    h: 'sample'
                }
            },
            key = keyGenerator(obj, {storage: {keyType: 'rustSHA1'}});

        expect(key).to.match(KEY_REGEXP);
        expect(key).to.equal('b516a33d63e8e5317c296efa31942fe75611040b');

    });

    function generateRandomObject(size) {
        const chars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k', 'l', 'e', 'q', 'e', 'r', 't', 'y', 'u',
            'i', 'o', 'p', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
        let object = {value: ''};
        for (let i = 0; i < size; i += 1) {
            object.value += chars[Math.floor(Math.random() * chars.length)];
        }

        return object;
    }

    it('it should be faster to use rust SHA1 than regular for large objects', function () {
        const size = 100000;
        const iterations = 100;
        let start = new Date().getTime();
        for (let i = 0; i < iterations; i += 1) {
            keyGenerator(generateRandomObject(size), {storage: {keyType: 'rustSHA1'}});
        }
        let end = new Date().getTime();

        const rustTime = end - start;

        start = new Date().getTime();
        for (let i = 0; i < iterations; i += 1) {
            keyGenerator(generateRandomObject(size), {storage: {keyType: 'plainSHA1'}});
        }
        end = new Date().getTime();

        const plainTime = end - start;

        // console.log(plainTime, rustTime);
        expect(plainTime).to.be.above(rustTime);
    });

    it('it should be faster to use rust SHA1 than regular small objects', function () {
        const size = 100;
        const iterations = 100000;
        let start = new Date().getTime();
        for (let i = 0; i < iterations; i += 1) {
            keyGenerator(generateRandomObject(size), {storage: {keyType: 'rustSHA1'}});
        }
        let end = new Date().getTime();

        const rustTime = end - start;

        start = new Date().getTime();
        for (let i = 0; i < iterations; i += 1) {
            keyGenerator(generateRandomObject(size), {storage: {keyType: 'plainSHA1'}});
        }
        end = new Date().getTime();

        const plainTime = end - start;

        // console.log(plainTime, rustTime);
        expect(plainTime).to.be.above(rustTime);
    });

    it.skip('it should be faster to use rust SHA1 than regular huge objects', function () {
        const size = 10000000;
        const iterations = 10;
        let start = new Date().getTime();
        for (let i = 0; i < iterations; i += 1) {
            keyGenerator(generateRandomObject(size), {storage: {keyType: 'rustSHA1'}});
        }
        let end = new Date().getTime();

        const rustTime = end - start;

        start = new Date().getTime();
        for (let i = 0; i < iterations; i += 1) {
            keyGenerator(generateRandomObject(size), {storage: {keyType: 'plainSHA1'}});
        }
        end = new Date().getTime();

        const plainTime = end - start;

        console.log(plainTime, rustTime);
        expect(plainTime).to.be.above(rustTime);
    });
});
