/*globals define, WebGMEGlobal*/
/*eslint-env node, browser*/

/**
 * @author kecso / https://github.com/kecso
 */


(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            'plugin/PluginConfig',
            'plugin/PluginBase',
            'text!./metadata.json'
        ], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../PluginConfig'),
            require('../../PluginBase'),
            require('./metadata.json')
        );
    }
}(function (PluginConfig, PluginBase, pluginMetadata) {
    'use strict';

    pluginMetadata = typeof pluginMetadata === 'string' ? JSON.parse(pluginMetadata) : pluginMetadata;

    /**
     * Initializes a new instance of AbortPlugin.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin AbortPlugin.
     * @constructor
     */
    function AbortPlugin() {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    }

    AbortPlugin.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    AbortPlugin.prototype = Object.create(PluginBase.prototype);
    AbortPlugin.prototype.constructor = AbortPlugin;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warn,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(Error, plugin.PluginResult)} callback - the result callback
     */
    AbortPlugin.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            currentConfiguration = self.getCurrentConfig(),
            aborted = false;

        self.onAbort = function () {
            self.logger.warn('Aborting execution');
            aborted = true;
            callback(new Error('Execution was aborted'));
        };

        // Using the coreAPI to create an object.
        if (currentConfiguration.shouldAbort === true) {
            setTimeout(function () {
                var plugins = WebGMEGlobal.Client.getRunningPlugins(),
                    keys = Object.keys(plugins);
                keys.forEach(function (key) {
                    WebGMEGlobal.Client.abortPlugin(key);
                });
            }, 2000);
        }
        setTimeout(function () {
            if (aborted) {
                return;
            }
            self.result.setSuccess(true);
            callback(null, self.result);
        }, 5000);

    };

    return AbortPlugin;
}));
