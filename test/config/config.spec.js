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

        should.equal(clientConfig.hasOwnProperty('mongo'), false);
    });

    it('clientconfig should not expose executor.nonce', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        should.equal(clientConfig.executor.hasOwnProperty('nonce'), false);
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

        should.equal(clientConfig.authentication.jwt.hasOwnProperty('privateKey'), false);
        should.equal(clientConfig.authentication.jwt.hasOwnProperty('publicKey'), false);
    });

    it('clientconfig should not expose storage.database', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        should.equal(clientConfig.storage.hasOwnProperty('database'), false);
    });

    it('clientconfig should not expose socketIO.serverOptions nor socketIO.adapter', function () {
        var config,
            clientConfig;
        process.env.NODE_ENV = '';
        config = require('../../config');
        clientConfig = getClientConfig(config);

        should.equal(clientConfig.socketIO.hasOwnProperty('serverOptions'), false);
        should.equal(clientConfig.socketIO.hasOwnProperty('adapter'), false);
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
