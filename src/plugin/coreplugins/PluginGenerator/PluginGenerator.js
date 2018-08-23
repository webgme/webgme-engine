/*globals define*/
/*eslint-env node, browser*/
/**
 * Plugin for generating other plugins.
 *
 * @author pmeijer / https://github.com/pmeijer
 * @author lattmann / https://github.com/lattmann
 * @module CorePlugins:PluginGenerator
 */

define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'text!./metadata.json',
    'ejs',
    'text!./metadata_json.ejs',
    'text!./plugin_js.ejs',
    'text!./plugin_bindings_js.ejs',
    'text!./__init___py.ejs',
    'text!./run_debug_py.ejs',
    'text!./run_plugin_py.ejs',
    'text!./unit_test_js.ejs',
], function (PluginConfig,
             PluginBase,
             pluginMetadata,
             ejs,
             METADATA_JSON,
             PLUGIN_JS,
             PLUGIN_BINDINGS_JS,
             INIT_PY,
             RUN_DEBUG_PY,
             RUN_PLUGIN_PY,
             UNIT_TEST_JS) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    function PluginGenerator() {
        // Call base class's constructor
        PluginBase.call(this);

        this.pluginMetadata = pluginMetadata;

        this.currentConfig = null;
        this.pluginDir = '';
        this.testDir = '';
        this.filesToAdd = {};
    }

    PluginGenerator.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    PluginGenerator.prototype = Object.create(PluginBase.prototype);
    PluginGenerator.prototype.constructor = PluginGenerator;

    PluginGenerator.prototype.main = function (callback) {
        var self = this,
            pluginFileContent,
            pluginFileName,
            metadataFileContent,
            dirCommon,
            i,
            nbrOfFiles,
            fileKeys,
            error = '',
            artifact;

        // Get and log the configuration which will be appended to and used in the templates.
        self.currentConfig = self.getCurrentConfig();

        self.logger.info('Current configuration');
        self.logger.info(JSON.stringify(self.currentConfig, null, 4));

        // Update date, projectName and paths
        self.currentConfig.date = new Date();
        self.currentConfig.projectName = self.projectName;
        self.currentConfig.version = self.getVersion();
        dirCommon = '/plugins/' + self.projectName + '/' + self.currentConfig.pluginID + '/';
        self.pluginDir = 'src' + dirCommon;
        self.testDir = 'test' + dirCommon;

        // Add test file
        self.filesToAdd[self.testDir + self.currentConfig.pluginID + '.spec.js'] =
                ejs.render(UNIT_TEST_JS, self.currentConfig);
        // Add the metadata.json
        metadataFileContent = ejs.render(METADATA_JSON, self.currentConfig);
        self.filesToAdd[self.pluginDir + 'metadata.json'] = metadataFileContent;

        // Add the plugin file.
        if (self.currentConfig.language === 'JavaScript') {
            pluginFileContent = ejs.render(PLUGIN_JS, self.currentConfig);
        } else if (self.currentConfig.language.toLowerCase() === 'python') {
            self.currentConfig.command = 'python';
            self.currentConfig.scriptFile = 'run_plugin.py';
            pluginFileContent = ejs.render(PLUGIN_BINDINGS_JS, self.currentConfig);
            self.filesToAdd[self.pluginDir + 'run_debug.py'] = ejs.render(RUN_DEBUG_PY, self.currentConfig);
            self.filesToAdd[self.pluginDir + 'run_plugin.py'] = ejs.render(RUN_PLUGIN_PY, self.currentConfig);
            self.filesToAdd[self.pluginDir + self.currentConfig.pluginID + '/__init__.py'] = ejs.render(INIT_PY,
                self.currentConfig);
        } else {
            callback(new Error('Unexpected language type [' + self.currentConfig.language + ']'), self.result);
            return;
        }

        pluginFileName = self.pluginDir + self.currentConfig.pluginID + '.js';
        self.filesToAdd[pluginFileName] = pluginFileContent;

        // Add the file at the end.
        self.logger.info(JSON.stringify(self.filesToAdd, null, 4));
        fileKeys = Object.keys(self.filesToAdd);
        nbrOfFiles = fileKeys.length;
        artifact = self.blobClient.createArtifact('pluginFiles');

        function addFileByFile(fileKey, fileToAdd) {
            artifact.addFile(fileKey, fileToAdd, function (err, hash) {
                error = err ? error + err : error;
                nbrOfFiles -= 1;
                self.logger.debug(fileKey, hash);
                if (nbrOfFiles === 0) {
                    if (error) {
                        callback('Something went wrong when adding files: ' + error, self.result);
                        return;
                    }
                    self.blobClient.saveAllArtifacts(function (err, hashes) {
                        if (err) {
                            callback(err, self.result);
                            return;
                        }
                        self.result.addArtifact(hashes[0]);
                        self.createMessage(null, 'Extract the pluginFiles.zip in your repository.');
                        self.createMessage(null, 'Append "' + './src/plugins/' + self.projectName +
                            '" to "pluginBasePaths" in config.js.');

                        self.createMessage(self.rootNode, 'Select the root-node and add ' +
                            self.currentConfig.pluginID + ' to the validPlugins under the META tab ' +
                            '(separate with spaces).');

                        if (self.currentConfig.test) {
                            self.createMessage(null, 'For the necessary test setup and more examples of how ' +
                                'to write tests see https://github.com/webgme/webgme-boilerplate.');
                        }

                        self.logger.info('Artifacts are saved here: ' + hashes.toString());

                        self.result.setSuccess(true);
                        callback(null, self.result);
                    });
                }
            });
        }

        for (i = 0; i < fileKeys.length; i += 1) {
            addFileByFile(fileKeys[i], self.filesToAdd[fileKeys[i]]);
        }
    };

    return PluginGenerator;
});