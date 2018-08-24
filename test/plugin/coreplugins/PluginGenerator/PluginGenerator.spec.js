/*eslint-env node, mocha*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../../_globals.js');

describe('PluginGenerator', function () {
    'use strict';

    var logger = testFixture.logger.fork('PluginGeneratorTest'),
        requirejs = testFixture.requirejs,
        expect = testFixture.expect,
        esprima = require('esprima'),
        ejs = require('ejs'),
        pluginConfig = {
            pluginID: 'NewPlugin',
            pluginName: 'New Plugin',
            description: '',
            language: 'JavaScript',
            configStructure: false
        };

    function isValidJs(testString, logError) {
        var err = null;

        try {
            esprima.parse(testString);
        } catch (e) {
            err = e;
            if (logError) {
                logger.error(err.toString());
                logger.error(testString);
            }
        }
        return err;
    }

    function runPlugin(pluginName, configuration, callback) {
        var pluginBasePaths = 'plugin/coreplugins/',
            Plugin = requirejs(pluginBasePaths + pluginName + '/' + pluginName),
            plugin = new Plugin(),
            artifact = {
                addedFiles: {},
                addFile: function (fname, fstr, callback) {
                    this.addedFiles[fname] = fstr;
                    callback(null, 'hash');
                }
            };

        plugin.getCurrentConfig = function () {
            return configuration;
        };

        plugin.createMessage = function (/*node, message, severity*/) {

        };

        plugin.result = {
            success: false,
            artifact: artifact,
            setSuccess: function (value) {
                this.success = value;
            },
            addArtifact: function () {
            }
        };

        plugin.META = {
            FCO: '/1',
            FCOInstance: '/2'
        };

        plugin.core = {
            getPath: function () {
                return '/1';
            }
        };

        plugin.logger = {
            info: function (msg) {
                logger.info(msg);
            },
            debug: function (msg) {
                logger.debug(msg);
            },
            warning: function (msg) {
                logger.warn(msg);
            },
            error: function (msg) {
                logger.error(msg);
            }
        };

        plugin.blobClient = {
            createArtifact: function () {
                return artifact;
            },
            saveAllArtifacts: function (callback) {
                callback(null, ['aHash']);
            }
        };

        plugin.main(callback);
    }


    it('test esprima', function () {
        expect(isValidJs('var a = {x: 1, y: 2};')).to.equal(null);
        expect(isValidJs('var a = [{x: 1, x: 2};')).to.not.equal(null);
    });

    it('test getName and version', function () {
        var Plugin = requirejs('plugin/coreplugins/PluginGenerator/PluginGenerator'),
            plugin = new Plugin();
        expect(plugin.getName()).to.equal('Plugin Generator');
        expect(typeof plugin.getVersion()).to.equal('string');
    });

    it('pluginConfig up to date', function () {
        var Plugin = requirejs('plugin/coreplugins/PluginGenerator/PluginGenerator'),
            plugin = new Plugin(),
            pluginStructure = plugin.getConfigStructure(),
            i;
        expect(Object.keys(pluginConfig).length).to.equal(pluginStructure.length);

        for (i = 0; i < pluginStructure.length; i += 1) {
            expect(pluginConfig.hasOwnProperty(pluginStructure[i].name)).to.equal(true);
            expect(pluginConfig[pluginStructure[i].name]).to.equal(pluginStructure[i].value);
        }
    });

    it('space in pluginID should generate invalid files', function (done) {
        var config = Object.create(pluginConfig);
        config.pluginID = 'I have a space';
        runPlugin('PluginGenerator', config, function (err, result) {
            var files = result.artifact.addedFiles,
                keys = Object.keys(files),
                i;

            expect(keys.length).to.equal(3);
            for (i = 0; i < keys.length; i += 1) {
                logger.debug(files[keys[i]]);
                if (keys[i] === 'src/plugins/null/I have a space/meta.js' ||
                    keys[i] === 'test/plugins/null/I have a space/I have a space.spec.js') {

                    expect(isValidJs(files[keys[i]])).to.equal(null);
                } else {
                    expect(isValidJs(files[keys[i]])).not.to.equal(null);
                }
            }
            done();
        });
    });

    it('default settings should generate two valid js files', function (done) {
        runPlugin('PluginGenerator', pluginConfig, function (err, result) {
            var files = result.artifact.addedFiles,
                keys = Object.keys(files),
                i;

            expect(err).to.equal(null);
            expect(keys.length).to.equal(3);
            for (i = 0; i < keys.length; i += 1) {
                if (keys[i].indexOf('.json') > -1) {
                    JSON.parse(files[keys[i]]);
                } else {
                    logger.debug(files[keys[i]]);
                    expect(isValidJs(files[keys[i]])).to.equal(null);
                }
            }

            expect(JSON.parse(files['src/plugins/null/NewPlugin/metadata.json']).disableBrowserSideExecution)
                .to.equal(false);
            done();
        });
    });

    it('configStructure = true should generate two valid js files', function (done) {
        var config = Object.create(pluginConfig);
        config.configStructure = true;
        runPlugin('PluginGenerator', config, function (err, result) {
            var files = result.artifact.addedFiles,
                keys = Object.keys(files),
                i;

            expect(err).to.equal(null);
            expect(keys.length).to.equal(3);
            for (i = 0; i < keys.length; i += 1) {
                if (keys[i].indexOf('.json') > -1) {
                    JSON.parse(files[keys[i]]);
                } else {
                    logger.debug(files[keys[i]]);
                    expect(isValidJs(files[keys[i]])).to.equal(null);
                }
            }
            done();
        });
    });

    it('configStructure = true should generate two valid js files', function (done) {
        var config = Object.create(pluginConfig);
        config.meta = false;
        config.configStructure = true;
        runPlugin('PluginGenerator', config, function (err, result) {
            var files = result.artifact.addedFiles,
                keys = Object.keys(files),
                i;

            expect(err).to.equal(null);
            expect(keys.length).to.equal(3);
            for (i = 0; i < keys.length; i += 1) {
                if (keys[i].indexOf('.json') > -1) {
                    JSON.parse(files[keys[i]]);
                } else {
                    logger.debug(files[keys[i]]);
                    expect(isValidJs(files[keys[i]])).to.equal(null);
                }
            }
            done();
        });
    });

    it('language = Python should generate 2 valid js files and three py-files', function (done) {
        var config = Object.create(pluginConfig);
        config.language = 'Python';
        runPlugin('PluginGenerator', config, function (err, result) {
            var files = result.artifact.addedFiles,
                keys = Object.keys(files);

            expect(err).to.equal(null);
            expect(keys.length).to.equal(6);
            expect(keys).to.have.members([
                'test/plugins/null/NewPlugin/NewPlugin.spec.js',
                'src/plugins/null/NewPlugin/metadata.json',
                'src/plugins/null/NewPlugin/run_debug.py',
                'src/plugins/null/NewPlugin/run_plugin.py',
                'src/plugins/null/NewPlugin/NewPlugin/__init__.py',
                'src/plugins/null/NewPlugin/NewPlugin.js'
            ]);

            try {
                expect(isValidJs(files['src/plugins/null/NewPlugin/NewPlugin.js'])).to.equal(null);
                expect(JSON.parse(files['src/plugins/null/NewPlugin/metadata.json']).disableBrowserSideExecution)
                    .to.equal(true);
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('passing classImpl to __init___py.ejs should add the class', function () {
        var template = testFixture.fs.readFileSync('./src/plugin/coreplugins/PluginGenerator/__init___py.ejs', 'utf8');
        var classImpl = 'class NewPlugin(PluginBase):\n    def main(self):\n        core = self.core\n';
        var res = ejs.render(template, {
            pluginID: 'NewPlugin',
            classImpl: classImpl
        });

        expect(res).to.include(classImpl);
    });
});
