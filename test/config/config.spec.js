/*eslint-env node, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

describe('configuration and components', function () {
    'use strict';

    var should = require('chai').should(),
        expect = require('chai').expect,
        oldNodeEnv = process.env.NODE_ENV || '',
        oldCwd = process.cwd(),
        path = require('path'),
        webgme = require('../../index'),
        getClientConfig = require('../../config/getclientconfig'),
        configPath = path.join(__dirname, '..', '..', 'config'),
        validateConfig,
        unloadConfigs = function () {
            // clear the cached files
            var key,
                i,
                modulesToUnload = [];

            for (key in require.cache) {
                if (key.indexOf(configPath) > -1) {
                    modulesToUnload.push(key);
                }
            }

            for (i = 0; i < modulesToUnload.length; i += 1) {
                delete require.cache[modulesToUnload[i]];
            }
        };

    before(function () {

    });

    beforeEach(function () {
        process.chdir(oldCwd);
        unloadConfigs();
    });

    afterEach(function () {
        Object.keys(process.env).forEach(function (key) {
            if (key.indexOf('WEBGME_') === 0) {
                delete process.env[key];
            }
        });
    });

    after(function () {
        process.chdir(oldCwd);
        unloadConfigs();
        process.env.NODE_ENV = oldNodeEnv;
        // restore config
        require('../../config');
    });

    it('should load global as a default config', function () {
        var config,
            configDefault = require('../../config/config.default.js');
        process.env.NODE_ENV = '';
        config = require('../../config');

        config.should.deep.equal(configDefault);
    });

    it('should load test config', function () {
        var config,
            configTest = require('../../config/config.test.js');
        process.env.NODE_ENV = 'test';
        config = require('../../config');

        config.should.deep.equal(configTest);
    });

    it('should be serializable', function () {
        var config;
        process.env.NODE_ENV = 'test';
        config = require('../../config');

        config.should.deep.equal(JSON.parse(JSON.stringify(config)));
    });

    it('should throw if configuration is malformed', function () {
        process.env.NODE_ENV = 'malformed';

        (function () {
            require('../../config');
        }).should.throw(Error);
    });

    it('should throw if configuration has extra key', function () {
        var config;
        process.env.NODE_ENV = 'test';
        config = require('../../config');
        unloadConfigs();
        validateConfig = require('../../config/validator').validateConfig;

        (function () {
            config.extraKey = 'something';
            validateConfig(config);
        }).should.throw(Error);
    });

    it('should throw if plugin.basePaths is not an array', function () {
        var config;
        process.env.NODE_ENV = 'test';
        config = require('../../config');
        unloadConfigs();
        validateConfig = require('../../config/validator').validateConfig;

        (function () {
            config.plugin.basePaths = 'something';
            validateConfig(config);
        }).should.throw(Error);
    });

    it('should throw if storage.disableHashChecks = true and storage.requireHashesToMatch', function () {
        var config;
        process.env.NODE_ENV = 'test';
        config = require('../../config');
        unloadConfigs();
        validateConfig = require('../../config/validator').validateConfig;

        try {
            config.storage.disableHashChecks = true;
            config.storage.requireHashesToMatch = true;
            validateConfig(config);
            throw new Error('Did not throw');
        } catch (err) {
            expect(err.message).to.equal('Cannot set config.storage.disableHashChecks and requireHashesToMatch ' +
                'to true at the same time!');
        }
    });

    it('should throw if projectSeeds.createAtStartup is malformed',
        function () {
            var config;
            process.env.NODE_ENV = 'test';
            config = require('../../config');
            unloadConfigs();
            validateConfig = require('../../config/validator').validateConfig;

            (function () {
                var myConf = JSON.parse(JSON.stringify(config));
                myConf.seedProjects.createAtStartup = [{seedId: 'EmptyProjecct', projectName: 'One', rights: {}}];
                validateConfig(myConf);
            }).should.throw(Error);
            (function () {
                var myConf = JSON.parse(JSON.stringify(config));
                myConf.seedProjects.createAtStartup = 'fault';
                validateConfig(myConf);
            }).should.throw(Error);

            (function () {
                var myConf = JSON.parse(JSON.stringify(config));
                myConf.seedProjects.createAtStartup = [{projectName: 'One', ownerId: 'admin', rights: {}}];
                validateConfig(myConf);
            }).should.throw(Error);

            (function () {
                var myConf = JSON.parse(JSON.stringify(config));
                myConf.seedProjects.createAtStartup = [{
                    seedId: 'EmptyProjecct',
                    projectName: 'One',
                    creatorId: 'admin',
                    rights: {}
                }];
                validateConfig(myConf);
            }).should.not.throw(Error);

            (function () {
                var myConf = JSON.parse(JSON.stringify(config));
                myConf.authentication.adminAccount = 'admin';
                myConf.seedProjects.createAtStartup = [{
                    seedId: 'EmptyProjecct',
                    projectName: 'One',
                    rights: {}
                }];
                validateConfig(myConf);
            }).should.not.throw(Error);
        }
    );

    it('clientconfig should not expose mongo', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        should.equal(Object.hasOwn(clientConfig, 'mongo'), false);
    });

    it('clientconfig should not expose executor.nonce', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        should.equal(Object.hasOwn(clientConfig.executor, 'nonce'), false);
    });

    it('clientconfig should only expose the port of the server', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        expect(clientConfig.server).to.deep.equal({port: config.server.port});
    });

    it('clientconfig should not expose authentication.jwt.private/publicKey', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        should.equal(Object.hasOwn(clientConfig.authentication.jwt, 'privateKey'), false);
        should.equal(Object.hasOwn(clientConfig.authentication.jwt, 'publicKey'), false);
    });

    it('clientconfig should not expose storage.database', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        should.equal(Object.hasOwn(clientConfig.storage, 'database'), false);
    });

    it('clientconfig should not expose socketIO.serverOptions nor socketIO.adapter', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        should.equal(Object.hasOwn(clientConfig.socketIO, 'serverOptions'), false);
        should.equal(Object.hasOwn(clientConfig.socketIO, 'adapter'), false);
    });

    // These really only show up in the coverage..
    it('getComponentsJson should fallback to default when NODE_ENV is empty', function (done) {
        process.env.NODE_ENV = '';

        webgme.getComponentsJson()
            .then(function (json) {
                expect(json).to.deep.equal({});
            })
            .nodeify(done);
    });

    it('getComponentsJson should fallback to components when NODE_ENV set to non-existing', function (done) {
        process.env.NODE_ENV = 'noComponentsJsonWithThisNameExists';

        webgme.getComponentsJson()
            .then(function (json) {
                expect(json).to.deep.equal({});
            })
            .nodeify(done);
    });

    it('getComponentsJson should fallback to empty object when components.json non-existing', function (done) {
        process.chdir('./test-tmp');

        webgme.getComponentsJson()
            .then(function (json) {
                expect(json).to.deep.equal({});
            })
            .nodeify(done);
    });

    // Using WEBGME_* environment variables.

    it('should change server port and it should be an integer when passed via WEBGME_env', function () {
        process.env.NODE_ENV = 'default';
        var configOrg = require('../../config');
        unloadConfigs();
        process.env['WEBGME_server_port'] = '8008';
        var configEnv = require('../../config');

        expect(configEnv.server.port).to.not.equal(configOrg.server.port);
        expect(configEnv.server.port).to.equal(8008);
    });

    it('should change authentication enable and it should be a boolean when passed via WEBGME_env', function () {
        process.env.NODE_ENV = 'default';
        var configOrg = require('../../config');
        unloadConfigs();
        process.env['WEBGME_authentication_enable'] = 'true';
        var configEnv = require('../../config');

        expect(configEnv.authentication.enable).to.not.equal(configOrg.authentication.enable);
        expect(configEnv.authentication.enable).to.equal(true);
    });

    it('should change defaultSeed and it should be a string when passed via WEBGME_env', function () {
        process.env.NODE_ENV = 'default';
        var configOrg = require('../../config');
        unloadConfigs();
        process.env['WEBGME_seedProjects_defaultProject'] = 'MyLittleSeed';
        var configEnv = require('../../config');

        expect(configEnv.seedProjects.defaultProject).to.not.equal(configOrg.seedProjects.defaultProject);
        expect(configEnv.seedProjects.defaultProject).to.equal('MyLittleSeed');
    });

    it('should throw if encountering non-object (bool) in config path passed via WEBGME_env', function () {
        process.env.NODE_ENV = 'default';
        unloadConfigs();
        process.env['WEBGME_authentication_enable_doIt'] = 'true';
        try {
            require('../../config');
            throw new Error('Should have failed!');
        } catch (e) {
            if (e.message.indexOf('WEBGME_authentication_enable_doIt would override non-object config at') === -1) {
                throw e;
            }
        }
    });

    it('should throw if encountering non-object (array) in config path passed via WEBGME_env', function () {
        process.env.NODE_ENV = 'default';
        unloadConfigs();
        process.env['WEBGME_addOn_basePaths_12'] = './attempt/to/mess/up/array';
        try {
            require('../../config');
            throw new Error('Should have failed!');
        } catch (e) {
            if (e.message.indexOf('WEBGME_addOn_basePaths_12 would override non-object config at') === -1) {
                throw e;
            }
        }
    });

    it('should create sub-configs when passed via WEBGME_env and not colliding with non object.', function () {
        process.env.NODE_ENV = 'default';
        var configOrg = require('../../config');
        unloadConfigs();
        process.env['WEBGME_rest_components_myRouter_mount'] = 'myRoute';
        process.env['WEBGME_rest_components_myRouter_src'] = 'my-route-module';
        process.env['WEBGME_rest_components_myRouter_options_subOptions_someCfg1'] = true;
        process.env['WEBGME_rest_components_myRouter_options_subOptions_someCfg2'] = true;
        var configEnv = require('../../config');

        expect(typeof configOrg.rest.components.myRouter).to.equal('undefined');
        expect(configEnv.rest.components.myRouter).to.deep.equal({
            mount: 'myRoute',
            src: 'my-route-module',
            options: {
                subOptions: {
                    someCfg1: true,
                    someCfg2: true,
                }
            }
        });
    });
});

describe('authentication.oauth and capability flags', function () {
    const {expect} = require('chai');
    const path = require('path');
    const {validateConfig} = require('../../config/validator');
    const getClientConfig = require('../../config/getclientconfig');

    function freshDefaultConfig() {
        const resolved = require.resolve('../../config/config.default.js');
        delete require.cache[resolved];
        return require('../../config/config.default.js');
    }

    function validOidcOAuthConfig() {
        return {
            enable: true,
            providerName: 'keycloak',
            discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
            authorizationUrl: null,
            tokenUrl: null,
            userInfoUrl: null,
            endSessionUrl: null,
            clientId: 'webgme-client',
            clientSecret: null,
            redirectUri: 'https://webgme.example.com/oauth/callback',
            scopes: ['openid', 'profile', 'email'],
            usePKCE: true,
            loginRoute: '/oauth/login',
            callbackRoute: '/oauth/callback',
            tokenRoute: '/oauth/token',
            jwksUri: null,
            issuer: null,
            audience: null,
            algorithms: ['RS256'],
            acceptExternalBearerJwt: false,
            claims: {
                subject: 'sub',
                username: 'preferred_username',
                email: 'email',
                displayName: 'name',
            },
            userIdPrefix: 'oauth_',
            autoCreateUser: true,
            usersCanCreate: null,
            stateCookieId: 'webgme_oauth_state',
            stateTtlSec: 600,
            extraAuthorizeParams: {},
        };
    }

    it('should validate a minimal OIDC discovery OAuth config with PKCE', function () {
        const cfg = freshDefaultConfig();
        cfg.authentication.enable = true;
        cfg.authentication.oauth = validOidcOAuthConfig();
        expect(() => validateConfig(cfg)).to.not.throw();
    });

    it('should validate plain OAuth 2.0 endpoints without discoveryUrl when clientSecret is set', function () {
        const cfg = freshDefaultConfig();
        cfg.authentication.enable = true;
        cfg.authentication.oauth = validOidcOAuthConfig();
        cfg.authentication.oauth.discoveryUrl = null;
        cfg.authentication.oauth.usePKCE = false;
        cfg.authentication.oauth.clientSecret = 'super-secret';
        cfg.authentication.oauth.authorizationUrl = 'https://idp.example.com/authorize';
        cfg.authentication.oauth.tokenUrl = 'https://idp.example.com/token';
        cfg.authentication.oauth.userInfoUrl = 'https://idp.example.com/userinfo';
        expect(() => validateConfig(cfg)).to.not.throw();
    });

    it('should allow oauth.tokenRoute = null when oauth is enabled', function () {
        const cfg = freshDefaultConfig();
        cfg.authentication.oauth = validOidcOAuthConfig();
        cfg.authentication.oauth.tokenRoute = null;
        expect(() => validateConfig(cfg)).to.not.throw();
    });

    it('should reject invalid oauth.providerName characters', function () {
        ['bad.name', 'bad$name', 'bad name'].forEach((badName) => {
            const cfg = freshDefaultConfig();
            cfg.authentication.oauth = validOidcOAuthConfig();
            cfg.authentication.oauth.providerName = badName;
            expect(() => validateConfig(cfg)).to.throw(/providerName/);
        });
    });

    it('should throw when oauth.enable = true and clientId or redirectUri is missing', function () {
        const cfgMissingClient = freshDefaultConfig();
        cfgMissingClient.authentication.oauth = validOidcOAuthConfig();
        cfgMissingClient.authentication.oauth.clientId = null;
        expect(() => validateConfig(cfgMissingClient)).to.throw(/clientId/);

        const cfgMissingRedirect = freshDefaultConfig();
        cfgMissingRedirect.authentication.oauth = validOidcOAuthConfig();
        cfgMissingRedirect.authentication.oauth.redirectUri = '';
        expect(() => validateConfig(cfgMissingRedirect)).to.throw(/redirectUri/);
    });

    it('should throw when discoveryUrl is unset and endpoints are missing', function () {
        const cfgNoAuth = freshDefaultConfig();
        cfgNoAuth.authentication.oauth = validOidcOAuthConfig();
        cfgNoAuth.authentication.oauth.discoveryUrl = null;
        cfgNoAuth.authentication.oauth.tokenUrl = 'https://idp.example.com/token';
        cfgNoAuth.authentication.oauth.userInfoUrl = 'https://idp.example.com/userinfo';
        expect(() => validateConfig(cfgNoAuth)).to.throw(/authorizationUrl/);

        const cfgNoUserInfoOrJwks = freshDefaultConfig();
        cfgNoUserInfoOrJwks.authentication.oauth = validOidcOAuthConfig();
        cfgNoUserInfoOrJwks.authentication.oauth.discoveryUrl = null;
        cfgNoUserInfoOrJwks.authentication.oauth.authorizationUrl = 'https://idp.example.com/authorize';
        cfgNoUserInfoOrJwks.authentication.oauth.tokenUrl = 'https://idp.example.com/token';
        expect(() => validateConfig(cfgNoUserInfoOrJwks)).to.throw(/userInfoUrl or jwksUri/);
    });

    it('should throw when usePKCE is false and clientSecret is missing', function () {
        const cfg = freshDefaultConfig();
        cfg.authentication.oauth = validOidcOAuthConfig();
        cfg.authentication.oauth.usePKCE = false;
        cfg.authentication.oauth.clientSecret = null;
        expect(() => validateConfig(cfg)).to.throw(/clientSecret/);
    });

    it('should throw when acceptExternalBearerJwt = true without discoveryUrl and jwksUri/issuer', function () {
        const cfg = freshDefaultConfig();
        cfg.authentication.oauth = validOidcOAuthConfig();
        cfg.authentication.oauth.discoveryUrl = null;
        cfg.authentication.oauth.authorizationUrl = 'https://idp.example.com/authorize';
        cfg.authentication.oauth.tokenUrl = 'https://idp.example.com/token';
        cfg.authentication.oauth.userInfoUrl = 'https://idp.example.com/userinfo';
        cfg.authentication.oauth.acceptExternalBearerJwt = true;
        expect(() => validateConfig(cfg)).to.throw(/jwksUri/);

        cfg.authentication.oauth.jwksUri = 'https://idp.example.com/jwks';
        expect(() => validateConfig(cfg)).to.throw(/issuer/);
    });

    it('should reject non-leading-slash or duplicate OAuth routes', function () {
        const cfgBadSlash = freshDefaultConfig();
        cfgBadSlash.authentication.oauth = validOidcOAuthConfig();
        cfgBadSlash.authentication.oauth.loginRoute = 'oauth/login';
        expect(() => validateConfig(cfgBadSlash)).to.throw(/start with "\/"/);

        const cfgDupLoginCallback = freshDefaultConfig();
        cfgDupLoginCallback.authentication.oauth = validOidcOAuthConfig();
        cfgDupLoginCallback.authentication.oauth.callbackRoute = '/oauth/login';
        expect(() => validateConfig(cfgDupLoginCallback)).to.throw(/distinct/);

        const cfgDupToken = freshDefaultConfig();
        cfgDupToken.authentication.oauth = validOidcOAuthConfig();
        cfgDupToken.authentication.oauth.tokenRoute = '/oauth/login';
        expect(() => validateConfig(cfgDupToken)).to.throw(/distinct/);
    });

    it('should reject invalid stateTtlSec and capability flag types', function () {
        const cfgTtl = freshDefaultConfig();
        cfgTtl.authentication.oauth = validOidcOAuthConfig();
        cfgTtl.authentication.oauth.stateTtlSec = 0;
        expect(() => validateConfig(cfgTtl)).to.throw(/stateTtlSec/);

        const cfgPwLogin = freshDefaultConfig();
        cfgPwLogin.authentication.allowPasswordLogin = 'no';
        expect(() => validateConfig(cfgPwLogin)).to.throw(/allowPasswordLogin/);

        const cfgTokens = freshDefaultConfig();
        cfgTokens.authentication.enableAccessTokens = 'yes';
        expect(() => validateConfig(cfgTokens)).to.throw(/enableAccessTokens/);

        ['invalid', null, []].forEach((badVal) => {
            const cfgPageOpts = freshDefaultConfig();
            cfgPageOpts.authentication.userManagementPageOptions = badVal;
            expect(() => validateConfig(cfgPageOpts)).to.throw(/userManagementPageOptions/);
        });
    });

    it('should sanitize OAuth secrets and userManagementPageOptions in getClientConfig', function () {
        const cfg = freshDefaultConfig();
        cfg.authentication.oauth = validOidcOAuthConfig();
        cfg.authentication.oauth.clientSecret = 'top-secret-value';
        cfg.authentication.oauth.tokenUrl = 'https://idp.example.com/token';
        cfg.authentication.oauth.userInfoUrl = 'https://idp.example.com/userinfo';
        cfg.authentication.oauth.jwksUri = 'https://idp.example.com/jwks';
        cfg.authentication.userManagementPage = path.join(__dirname, 'dummy');
        cfg.authentication.userManagementPageOptions = {secretToken: 'should-not-leak'};

        const clientCfg = getClientConfig(cfg);
        expect(clientCfg.authentication.userManagementPageOptions).to.equal(undefined);
        expect(clientCfg.authentication.oauth).to.deep.equal({
            enable: true,
            providerName: 'keycloak',
            loginRoute: '/oauth/login',
        });
        expect(clientCfg.authentication.oauth.clientSecret).to.equal(undefined);
        expect(clientCfg.authentication.oauth.tokenUrl).to.equal(undefined);
        expect(clientCfg.authentication.oauth.userInfoUrl).to.equal(undefined);
        expect(clientCfg.authentication.oauth.jwksUri).to.equal(undefined);
    });
});
