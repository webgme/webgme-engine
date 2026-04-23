/*eslint-env node, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../_globals.js');

describe('standalone server', function () {
    'use strict';

    var WebGME = testFixture.WebGME,
        logger = testFixture.logger,

        should = testFixture.should,
        expect = testFixture.expect,
        Q = testFixture.Q,

        serverBaseUrl,

        scenarios,
        i,
        j;

    function buildUrl(path, query) {
        var url = new URL(path || '/', serverBaseUrl);

        if (query) {
            Object.keys(query).forEach(function (key) {
                url.searchParams.set(key, query[key]);
            });
        }

        return url.toString();
    }

    async function fetchGet(path, options) {
        options = options || {};
        return fetch(buildUrl(path, options.query), {
            method: 'GET',
            redirect: options.redirect || 'follow'
        });
    }

    scenarios = [{
        type: 'http',
        authentication: false,
        port: 9008,
        requests: [
            {code: 200, url: '/'},
            {code: 404, url: '/login'},
            //{code: 200, url: '/login/google/return', redirectUrl: '/'},
            {code: 404, url: '/logout'},
            {code: 200, url: '/bin/getconfig.js'},
            {code: 200, url: '/gmeConfig.json'},
            {code: 200, url: '/package.json'},
            {code: 200, url: '/index.html'},
            //{code: 200, url: '/docs/tutorial.html'},
            {code: 200, url: '/plugin/PluginBase.js'},
            {code: 200, url: '/plugin/PluginGenerator/PluginGenerator/PluginGenerator'},
            {code: 404, url: '/plugin/PluginGenerator/PluginGenerator'},
            {code: 200, url: '/plugin/PluginGenerator/PluginGenerator/PluginGenerator.js'},
            {code: 200, url: '/plugin/PluginGenerator/PluginGenerator/plugin_js.ejs'},
            {code: 200, url: '/assets/decoratorSVGList.json'},
            {code: 200, url: '/api/decorators'},
            {code: 200, url: '/api/plugins'},
            {code: 200, url: '/api/visualizers'},
            {code: 200, url: '/api/seeds'},

            //{code: 401, url: '/login/client/fail'},

            {code: 404, url: '/login/forge'},
            {code: 404, url: '/extlib/does_not_exist'}, // ending without a forward slash
            {code: 404, url: '/extlib/does_not_exist/'}, // ending with a forward slash
            //{code: 404, url: '/pluginoutput/does_not_exist'},
            {code: 404, url: '/plugin'},
            {code: 404, url: '/plugin/'},
            {code: 404, url: '/plugin/PluginGenerator'},
            {code: 404, url: '/plugin/PluginGenerator/PluginGenerator'},
            {code: 404, url: '/plugin/does_not_exist'},
            {code: 404, url: '/decorators/'},
            {code: 404, url: '/decorators/DefaultDecorator'},
            {code: 404, url: '/decorators/DefaultDecorator/does_not_exist'},
            {code: 404, url: '/rest'},
            {code: 404, url: '/rest/etf'},
            {code: 404, url: '/worker/simpleResult'},
            {code: 404, url: '/docs/'},
            {code: 404, url: '/index2.html'},
            {code: 404, url: '/does_not_exist'},
            {code: 404, url: '/does_not_exist.js'},
            {code: 404, url: '/asdf'},

            {code: 200, url: '/extlib/config/index.js'},
            {code: 404, url: '/extlib/src'},
            //excluded extlib paths.
            {code: 403, url: '/extlib/config/config.default.js'},
            {code: 200, url: '/gme-dist/webgme.classes.build.js'},
            {code: 200, url: '/gme-dist/webgme.classes.build.min.js'},

            //{code: 410, url: '/getToken'},
            //{code: 410, url: '/checktoken/does_not_exist'},

            {code: 404, url: '/worker/simpleResult/bad_parameter'}
        ]
    }, {
        type: 'http',
        authentication: true,
        port: 9009,
        requests: [
            // should not allow access without auth
            {code: 200, url: '/', redirectUrl: '/login'},
            {code: 200, url: '/file._js', redirectUrl: '/login'},
            {code: 200, url: '/file.html', redirectUrl: '/login'},
            {code: 200, url: '/file.gif', redirectUrl: '/login'},
            {code: 200, url: '/file.png', redirectUrl: '/login'},
            {code: 200, url: '/file.bmp', redirectUrl: '/login'},
            {code: 200, url: '/file.svg', redirectUrl: '/login'},
            {code: 200, url: '/file.json', redirectUrl: '/login'},
            {code: 200, url: '/file.map', redirectUrl: '/login'},

            // should allow access without auth
            //{code: 200, url: '/lib/require/require.min.js'},
            {code: 200, url: '/plugin/PluginResult.js'},
            {code: 200, url: '/common/storage/browserstorage.js'},
            {code: 200, url: '/common/storage/constants.js'},
            {code: 200, url: '/common/blob/BlobClient.js'},
            {code: 200, url: '/gmeConfig.json'},
            {code: 200, url: '/package.json'},

            {code: 401, url: '/api/plugins'},
            {code: 401, url: '/api/decorators'},
            {code: 401, url: '/api/visualizers'}
        ]
    }];

    function addScenario(scenario) {

        describe(scenario.type + ' server ' + (scenario.authentication ? 'with' : 'without') + ' auth', function () {
            var gmeAuth,
                server,
                gmeConfig = testFixture.getGmeConfig();

            before(function (done) {
                gmeConfig.server.port = scenario.port;
                gmeConfig.authentication.enable = scenario.authentication;
                gmeConfig.authentication.allowGuests = false;
                gmeConfig.authentication.guestAccount = 'guestUserName';
                server = WebGME.standaloneServer(gmeConfig);
                serverBaseUrl = server.getUrl();

                testFixture.clearDBAndGetGMEAuth(gmeConfig)
                    .then(function (gmeAuth_) {
                        gmeAuth = gmeAuth_;
                        var account = gmeConfig.authentication.guestAccount;

                        return Q.allDone([
                            gmeAuth.addUser(account, account + '@example.com', account, true, {overwrite: true}),
                            gmeAuth.addUser('user', 'user@example.com', 'plaintext', true, {overwrite: true})
                        ]);
                    })
                    .then(function () {
                        return gmeAuth.authorizeByUserId('user', 'project', 'create', {
                            read: true,
                            write: true,
                            delete: false
                        });
                    })
                    .then(function () {
                        return gmeAuth.authorizeByUserId('user', 'unauthorized_project', 'create', {
                            read: false,
                            write: false,
                            delete: false
                        });
                    })
                    .then(function () {
                        return gmeAuth.unload();
                    })
                    .then(function () {
                        return Q.ninvoke(server, 'start');
                    })
                    .nodeify(done);
            });

            after(function (done) {
                setTimeout(() => {
                    server.stop(done);
                }, 1000);
            });

            function addTest(requestTest) {
                var url = requestTest.url || '/',
                    redirectText = requestTest.redirectUrl ? ' redirects to ' + requestTest.redirectUrl : ' ';
                it('returns ' + requestTest.code + ' for ' + url + redirectText, async function () {
                    // TODO: add POST/DELETE etc support
                    var res,
                        location;

                    res = await fetchGet(url, {
                        redirect: 'manual'
                    });

                    if (requestTest.redirectUrl) {
                        // redirected response (do not follow redirects)
                        should.equal(res.status, 302);
                        location = res.headers.get('location');
                        should.equal(location && location.indexOf(requestTest.redirectUrl) > -1, true);
                        should.not.equal(location, url);
                        logger.debug(location, url, requestTest.redirectUrl);
                    } else {
                        // was not redirected
                        should.equal(res.status, requestTest.code);
                        location = res.headers.get('location');
                        if (location) {
                            should.equal(location, url);
                        }
                    }
                });
            }

            // add all tests for this scenario
            for (j = 0; j < scenario.requests.length; j += 1) {
                addTest(scenario.requests[j]);
            }

        });
    }

    // create all scenarios
    for (i = 0; i < scenarios.length; i += 1) {
        addScenario(scenarios[i]);
    }

    describe('http server decorators and svgs', function () {
        var server;

        before(function (done) {
            // we have to set the config here
            var gmeConfig = testFixture.getGmeConfig();
            gmeConfig.visualization.decoratorPaths = [];
            gmeConfig.visualization.svgDirs.push(testFixture.path.join(__dirname, 'default-svgs'));
            gmeConfig.visualization.svgDirs.push(testFixture.path.join(__dirname, 'extra-svgs'));

            server = WebGME.standaloneServer(gmeConfig);
            serverBaseUrl = server.getUrl();
            server.start(done);
        });

        after(function (done) {
            server.stop(done);
        });

        it('should return 404 /decorators/DefaultDecorator/DefaultDecorator.js', async function () {
            var res = await fetchGet('/decorators/DefaultDecorator/DefaultDecorator.js');
            should.equal(res.status, 404);
        });

        it('should list svgs at /assets/decoratorSVGList.json', async function () {
            var res = await fetchGet('/assets/decoratorSVGList.json'),
                body = await res.json();

            expect(res.status).to.equal(200);
            expect(body).to.include.members([
                'default.svg',
                'extra-svgs/level1.svg',
                'extra-svgs/nested/level2.svg',
                'extra-svgs/nested/nested/level3.svg'
            ]);

            expect(Object.keys(body).length).to.equal(4);
        });

        it('should return svg file if exists /assets/DecoratorSVG/Attribute.svg', async function () {
            var res = await fetchGet('/assets/DecoratorSVG/default.svg'),
                body = await res.text();

            expect(res.status).to.equal(200);
            expect(body).to.contain('</svg>');
        });

        it('should return svg file if exists /assets/DecoratorSVG/extra-svgs/level1.svg', async function () {
            var res = await fetchGet('/assets/DecoratorSVG/extra-svgs/level1.svg'),
                body = await res.text();

            expect(res.status).to.equal(200);
            expect(body).to.contain('</svg>');
        });

        it('should return svg file if exists /assets/DecoratorSVG/extra-svgs/nested/nested/level3.svg',
            async function () {
                var res = await fetchGet('/assets/DecoratorSVG/extra-svgs/nested/nested/level3.svg'),
                    body = await res.text();

                expect(res.status).to.equal(200);
                expect(body).to.contain('</svg>');
            }
        );

        it('should return 404 if svg file does not exist /assets/DecoratorSVG/NoSuchSvg.svg', async function () {
            var res = await fetchGet('/assets/DecoratorSVG/NoSuchSvg.sv');
            expect(res.status).to.equal(404);
        });
    });

    describe('http server svgs with relative paths', function () {
        var server;

        before(function (done) {
            // we have to set the config here
            var gmeConfig = testFixture.getGmeConfig();
            gmeConfig.visualization.svgDirs.push(testFixture.path.join('./test', 'server', 'default-svgs'));
            gmeConfig.visualization.svgDirs.push(testFixture.path.join('./test', 'server', 'extra-svgs'));
            // Make sure we clear standalone and utlis from the cache so we get a new svgMap.
            delete require.cache[require.resolve('../../src/server/standalone')];
            delete require.cache[require.resolve('../../src/utils')];
            server = WebGME.standaloneServer(gmeConfig);
            serverBaseUrl = server.getUrl();
            server.start(done);
        });

        after(function (done) {
            server.stop(done);
        });

        it('should return default svg file if exists and relative path given /assets/DecoratorSVG/default.svg',
            async function () {
                var res = await fetchGet('/assets/DecoratorSVG/extra-svgs/level1.svg'),
                    body = await res.text();

                expect(res.status).to.equal(200);
                expect(body).to.contain('</svg>');
            }
        );

        it('should return svg file if exists and relative path given /assets/DecoratorSVG/extra-svgs/level1.svg',
            async function () {
                var res = await fetchGet('/assets/DecoratorSVG/extra-svgs/level1.svg'),
                    body = await res.text();

                expect(res.status).to.equal(200);
                expect(body).to.contain('</svg>');
            }
        );
    });

    describe('http server with authentication', function () {
        describe('logOutUrl set', function () {
            var server;

            before(function (done) {
                // we have to set the config here
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.logOutUrl = '/profile/login';

                server = WebGME.standaloneServer(gmeConfig);
                serverBaseUrl = server.getUrl();
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            it('should redirect to given logOutUrl when no referrer set', async function () {
                var res = await fetchGet('/logout', {redirect: 'manual'});
                expect(res.status).to.equal(302);
                expect(res.headers.get('location')).to.equal('/profile/login');
            });

            it('should redirect to logOutUrl even when redirectUrl set', async function () {
                var res = await fetchGet('/logout', {
                    redirect: 'manual',
                    query: {
                        redirectUrl: '/gmeConfig.json'
                    }
                });

                expect(res.status).to.equal(302);
                expect(res.headers.get('location')).to.equal('/profile/login');
            });
        });

        describe('logOutUrl not set', function () {
            var server;

            before(function (done) {
                // we have to set the config here
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.logOutUrl = '';
                gmeConfig.authentication.logInUrl = '/profile/login';

                server = WebGME.standaloneServer(gmeConfig);
                serverBaseUrl = server.getUrl();
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            it('should redirect to given logInUrl when no referrer set', async function () {
                var res = await fetchGet('/logout', {redirect: 'manual'});
                expect(res.status).to.equal(302);
                expect(res.headers.get('location')).to.equal('/profile/login');
            });

            it('should redirect to redirectUrl when query set', async function () {
                var res = await fetchGet('/logout', {
                    redirect: 'manual',
                    query: {
                        redirectUrl: '/gmeConfig.json'
                    }
                });

                expect(res.status).to.equal(302);
                expect(res.headers.get('location')).to.equal('/gmeConfig.json');
            });
        });

        describe('logOutUrl set to absolute', function () {
            var server,
                logOutUrl = 'https://google.com/';

            before(function (done) {
                // we have to set the config here
                var gmeConfig = testFixture.getGmeConfig();
                gmeConfig.authentication.enable = true;
                gmeConfig.authentication.logOutUrl = logOutUrl;

                server = WebGME.standaloneServer(gmeConfig);
                serverBaseUrl = server.getUrl();
                server.start(done);
            });

            after(function (done) {
                server.stop(done);
            });

            it('should redirect to given logOutUrl when no referrer set', async function () {
                var res = await fetchGet('/logout', {redirect: 'manual'});
                expect(res.status).to.equal(302);
                expect(res.headers.get('location')).to.equal(logOutUrl);
            });

            it('should redirect to logOutUrl even when redirectUrl set', async function () {
                var res = await fetchGet('/logout', {
                    redirect: 'manual',
                    query: {
                        redirectUrl: '/gmeConfig.json'
                    }
                });

                expect(res.status).to.equal(302);
                expect(res.headers.get('location')).to.equal(logOutUrl);
            });
        });
    });
});
