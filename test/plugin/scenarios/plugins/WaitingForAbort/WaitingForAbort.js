/*globals define*/
/*eslint-env node, browser*/

/**
 * Generated by PluginGenerator 2.16.0 from webgme on Mon Oct 22 2018 16:02:07 GMT-0500 (Central Daylight Time).
 * A plugin that inherits from the PluginBase. To see source code documentation about available
 * properties and methods visit %host%/docs/source/PluginBase.html.
 */
if (typeof define !== 'undefined') {
    define([
        'plugin/PluginConfig',
        'text!./metadata.json',
        'plugin/PluginBase'
    ], function (
        PluginConfig,
        pluginMetadata,
        PluginBase) {
        'use strict';

        pluginMetadata = JSON.parse(pluginMetadata);

        /**
         * Initializes a new instance of WaitForAbort.
         * @class
         * @augments {PluginBase}
         * @classdesc This class represents the plugin WaitForAbort.
         * @constructor
         */
        function WaitForAbort() {
            // Call base class' constructor.
            PluginBase.call(this);
            this.pluginMetadata = pluginMetadata;
        }

        /**
         * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructure etc.
         * This is also available at the instance at this.pluginMetadata.
         * @type {object}
         */
        WaitForAbort.metadata = pluginMetadata;

        // Prototypical inheritance from PluginBase.
        WaitForAbort.prototype = Object.create(PluginBase.prototype);
        WaitForAbort.prototype.constructor = WaitForAbort;

        /**
         * Main function for the plugin to execute. This will perform the execution.
         * Notes:
         * - Always log with the provided logger.[error,warning,info,debug].
         * - Do NOT put any user interaction logic UI, etc. inside this method.
         * - callback always has to be called even if error happened.
         *
         * @param {function(Error|null, plugin.PluginResult)} callback - the result callback
         */
        WaitForAbort.prototype.main = function (callback) {
            var self = this,
                config = this.getCurrentConfig(),
                aborted = false;


            self.onAbort = function () {
                aborted = true;
                self.invokedPlugins.forEach(function (pluginInstance) {
                    pluginInstance.onAbort();
                });
                self.result.setSuccess(false);
                callback(new Error('Plugin was aborted.'), self.result);
            };

            setTimeout(function () {
                if (config.invoke) {
                    self.invokePlugin('WaitForAbort', {pluginConfig: {invoke: false, waitTime: 5000}})
                        .then(function (/*result*/) {
                            if (!aborted) {
                                self.result.addArtifact('1');
                                self.result.setSuccess(true);
                                callback(null, self.result);
                            }
                        });
                } else {
                    self.result.setSuccess(true);
                    callback(null, self.result);
                }
            }, config.waitTime);
        };

        return WaitForAbort;
    });
}