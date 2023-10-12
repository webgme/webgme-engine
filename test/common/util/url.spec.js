/*eslint-env node, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 *
 */

var testFixture = require('../../_globals.js');

describe('url', function () {
    'use strict';
    var URL = testFixture.requirejs('common/util/url'),
        expect = testFixture.expect;

    it('should create ref object', function () {
        var result,
            url = 'some/url+is#here&';

        expect(Object.hasOwn(URL, 'urlToRefObject'), true);

        result = URL.urlToRefObject(url);
        expect(Object.hasOwn(result, '$ref'), true);
        expect(result.$ref).to.equal(url);
    });

    it('should parse cookies', function () {
        var result,
            cookie = 'username=John Doe; expires=Thu, 18 Dec 2013 12:00:00 UTC; path=/';

        expect(Object.hasOwn(URL, 'parseCookie'), true);

        result = URL.parseCookie(cookie);

        expect(Object.hasOwn(result, 'username'), true);
        expect(result.username).to.equal('John Doe');
        expect(Object.hasOwn(result, 'expires'), true);
        expect(result.expires).to.equal('Thu, 18 Dec 2013 12:00:00 UTC');
        expect(Object.hasOwn(result, 'path'), true);
        expect(result.path).to.equal('/');
    });
});