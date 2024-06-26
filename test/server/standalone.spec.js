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
        superagent = testFixture.superagent,
        Q = testFixture.Q,

        agent = superagent.agent(),

        http = require('http'),
        fs = require('fs'),

        serverBaseUrl,

        scenarios,
        i,
        j;

    it.skip('should start and stop and start and stop', function (done) {
        this.timeout(5000);
        // we have to set the config here
        var gmeConfig = testFixture.getGmeConfig(),
            server;

        server = WebGME.standaloneServer(gmeConfig);
        server.start(function (err) {
            if (err) {
                done(err);
                return;
            }
            server.stop(function (err) {
                if (err) {
                    done(err);
                    return;
                }
                server.start(function (err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    server.stop(done);
                });
            });
        });
    });


    it.skip('should fail to start http server if port is in use', function (done) {
        this.timeout(5000);
        // we have to set the config here
        var gmeConfig = testFixture.getGmeConfig(),
            httpServer = http.createServer(),
            server;

        gmeConfig.server.port = gmeConfig.server.port + 1;

        httpServer.listen(gmeConfig.server.port, function (err) {
            if (err) {
                done(err);
                return;
            }

            server = WebGME.standaloneServer(gmeConfig);
            server.start(function (err) {
                var err0;
                try {
                    expect(err.code).to.equal('EADDRINUSE');
                } catch (e) {
                    err0 = e;
                }

                httpServer.close(function (err1) {
                    server._setIsRunning(true); //This ensures stopping modules.
                    server.stop(function (err2) {
                        done(err0 || err1 || err2 || null);
                    });
                });
            });
        });
    });

    describe('[https]', function () {
        var nodeTLSRejectUnauthorized;

        before(function () {
            nodeTLSRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        });

        after(function () {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = nodeTLSRejectUnauthorized;
        });

        it('should get main page with an https reverse proxy', function (done) {
            var gmeConfig = testFixture.getGmeConfig(),
                httpProxy = require('http-proxy'),
                path = require('path'),
                proxyServerPort = gmeConfig.server.port - 1,
                server,
                proxy;

            server = WebGME.standaloneServer(gmeConfig);
            //
            // Create the HTTPS proxy server in front of a HTTP server
            //
            proxy = httpProxy.createServer({
                target: {
                    host: 'localhost',
                    port: gmeConfig.server.port
                },
                ssl: {
                    key: fs.readFileSync(path.join(__dirname, '..', 'certificates', 'sample-key.pem'), 'utf8'),
                    cert: fs.readFileSync(path.join(__dirname, '..', 'certificates', 'sample-cert.pem'), 'utf8')
                }
            });

            server.start(function (err) {
                if (err) {
                    done(err);
                    return;
                }
                proxy.listen(proxyServerPort, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }

                    agent.get('https://localhost:' + proxyServerPort + '/index.html').end(function (err, res) {
                        var err0;
                        if (err) {
                            done(err);
                            return;
                        }

                        try {
                            should.equal(res.status, 200, err);
                            should.equal(/WebGME/.test(res.text), true, 'Index page response must contain WebGME');
                        } catch (e) {
                            err0 = e;
                        }

                        server.stop(function (err) {
                            proxy.close(function (err1) {
                                done(err0 || err || err1);
                            });
                        });
                    });
                });
            });
        });
    });


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

            beforeEach(function () {
                agent = superagent.agent();
            });

            after(function (done) {
                setTimeout(() => {
                    server.stop(done);
                }, 1000);
            });

            function addTest(requestTest) {
                var url = requestTest.url || '/',
                    redirectText = requestTest.redirectUrl ? ' redirects to ' + requestTest.redirectUrl : ' ';
                it('returns ' + requestTest.code + ' for ' + url + redirectText, function (done) {
                    // TODO: add POST/DELETE etc support
                    agent.get(serverBaseUrl + url).end(function (err, res) {
                        if (err && err.message.indexOf('connect ECONNREFUSED') > -1) {
                            //console.log('Is server running?', server.isRunning());
                            done(err);
                            return;
                        }

                        try {
                            should.equal(res.status, requestTest.code, err);

                            if (requestTest.redirectUrl) {
                                // redirectedagent
                                should.equal(res.status, 200);
                                if (res.headers.location) {
                                    should.equal(res.headers.location, requestTest.redirectUrl);
                                }
                                should.not.equal(res.headers.location, url);
                                logger.debug(res.headers.location, url, requestTest.redirectUrl);
                                should.equal(res.redirects.length, 1);
                            } else {
                                // was not redirected
                                //should.equal(res.res.url, url); // FIXME: should server response set the url?
                                if (res.headers.location) {
                                    should.equal(res.headers.location, url);
                                }
                                if (res.res.url) {
                                    should.equal(res.res.url, url);
                                }

                                should.equal(res.redirects.length, 0);
                            }

                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
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

        it('should return 404 /decorators/DefaultDecorator/DefaultDecorator.js', function (done) {
            agent.get(serverBaseUrl + '/decorators/DefaultDecorator/DefaultDecorator.js').end(function (err, res) {
                should.equal(res.status, 404, err);
                done();
            });
        });

        it('should list svgs at /assets/decoratorSVGList.json', function (done) {
            agent.get(serverBaseUrl + '/assets/decoratorSVGList.json').end(function (err, res) {
                expect(res.status).to.equal(200);
                expect(res.body).to.include.members([
                    'default.svg',
                    'extra-svgs/level1.svg',
                    'extra-svgs/nested/level2.svg',
                    'extra-svgs/nested/nested/level3.svg'
                ]);

                expect(Object.keys(res.body).length).to.equal(4);
                done();
            });
        });

        it('should return svg file if exists /assets/DecoratorSVG/Attribute.svg', function (done) {
            agent.get(serverBaseUrl + '/assets/DecoratorSVG/default.svg').end(function (err, res) {
                expect(res.status).to.equal(200);
                expect(res.body.toString('utf8')).to.contain('</svg>');
                done();
            });
        });

        it('should return svg file if exists /assets/DecoratorSVG/extra-svgs/level1.svg', function (done) {
            agent.get(serverBaseUrl + '/assets/DecoratorSVG/extra-svgs/level1.svg').end(function (err, res) {
                expect(res.status).to.equal(200);
                expect(res.body.toString('utf8')).to.contain('</svg>');
                done();
            });
        });

        it('should return svg file if exists /assets/DecoratorSVG/extra-svgs/nested/nested/level3.svg',
            function (done) {
                agent.get(serverBaseUrl + '/assets/DecoratorSVG/extra-svgs/nested/nested/level3.svg')
                    .end(function (err, res) {
                        expect(res.status).to.equal(200);
                        expect(res.body.toString('utf8')).to.contain('</svg>');
                        done();
                    });
            }
        );

        it('should return 404 if svg file does not exist /assets/DecoratorSVG/NoSuchSvg.svg', function (done) {
            agent.get(serverBaseUrl + '/assets/DecoratorSVG/NoSuchSvg.sv').end(function (err, res) {
                expect(res.status).to.equal(404);
                done();
            });
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
            function (done) {
                agent.get(serverBaseUrl + '/assets/DecoratorSVG/extra-svgs/level1.svg').end(function (err, res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.toString('utf8')).to.contain('</svg>');
                    done();
                });
            }
        );

        it('should return svg file if exists and relative path given /assets/DecoratorSVG/extra-svgs/level1.svg',
            function (done) {
                agent.get(serverBaseUrl + '/assets/DecoratorSVG/extra-svgs/level1.svg').end(function (err, res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.toString('utf8')).to.contain('</svg>');
                    done();
                });
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

            it('should redirect to given logOutUrl when no referrer set', function (done) {
                agent.get(serverBaseUrl + '/logout').end(function (err, res) {
                    try {
                        expect(err).to.equal(null);
                        expect(res.status).to.equal(200);
                        expect(res.redirects.length).to.equal(1);
                        expect(res.redirects[0]).to.equal(serverBaseUrl + '/profile/login');
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });

            it('should redirect to logOutUrl even when redirectUrl set', function (done) {
                agent.get(serverBaseUrl + '/logout')
                    .query({
                        redirectUrl: '/gmeConfig.json'
                    })
                    .end(function (err, res) {
                        try {
                            expect(err).to.equal(null);
                            expect(res.status).to.equal(200);
                            expect(res.redirects.length).to.equal(1);
                            expect(res.redirects[0]).to.equal(serverBaseUrl + '/profile/login');
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
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

            it('should redirect to given logInUrl when no referrer set', function (done) {
                agent.get(serverBaseUrl + '/logout').end(function (err, res) {
                    try {
                        expect(err).to.equal(null);
                        expect(res.status).to.equal(200);
                        expect(res.redirects.length).to.equal(1);
                        expect(res.redirects[0]).to.equal(serverBaseUrl + '/profile/login');
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });

            it('should redirect to redirectUrl when query set', function (done) {
                agent.get(serverBaseUrl + '/logout')
                    .query({
                        redirectUrl: '/gmeConfig.json'
                    })
                    .end(function (err, res) {
                        try {
                            expect(err).to.equal(null);
                            expect(res.status).to.equal(200);
                            expect(res.redirects.length).to.equal(1);
                            expect(res.redirects[0]).to.equal(serverBaseUrl + '/gmeConfig.json');
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
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

            it('should redirect to given logOutUrl when no referrer set', function (done) {
                agent.get(serverBaseUrl + '/logout').end(function (err, res) {
                    try {
                        expect(err).to.equal(null);
                        expect(res.status).to.equal(200);
                        expect(res.redirects[0]).to.equal(logOutUrl);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });

            it('should redirect to logOutUrl even when redirectUrl set', function (done) {
                agent.get(serverBaseUrl + '/logout')
                    .query({
                        redirectUrl: '/gmeConfig.json'
                    })
                    .end(function (err, res) {
                        try {
                            expect(err).to.equal(null);
                            expect(res.status).to.equal(200);
                            expect(res.redirects[0]).to.equal(logOutUrl);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
            });
        });
    });
});
