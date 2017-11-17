/*globals define*/
/*eslint-env node, browser*/

/**
* Generated by PluginGenerator from webgme on Fri Apr 17 2015 11:49:47 GMT-0500 (Central Daylight Time).
*/
if (typeof define === 'undefined') {

} else {
    define([
        'plugin/PluginConfig',
        'plugin/PluginBase',
        'text!./metadata.json',
        'common/storage/constants'
    ], function (PluginConfig, PluginBase, pluginMetadata, STORAGE_CONSTANTS) {
        'use strict';

        pluginMetadata = JSON.parse(pluginMetadata);

        /**
         * Initializes a new instance of PluginForked.
         * @class
         * @augments {PluginBase}
         * @classdesc This class represents the plugin PluginForked.
         * @constructor
         */
        var PluginForked = function () {
            // Call base class' constructor.
            PluginBase.call(this);
            this.pluginMetadata = pluginMetadata;
        };

        PluginForked.metadata = pluginMetadata;

        PluginForked.prototype = Object.create(PluginBase.prototype);
        PluginForked.prototype.constructor = PluginForked;

        /**
         * Main function for the plugin to execute. This will perform the execution.
         * Notes:
         * - Always log with the provided logger.[error,warning,info,debug].
         * - Do NOT put any user interaction logic UI, etc. inside this method.
         * - callback always has to be called even if error happened.
         *
         * @param {function(string, plugin.PluginResult)} callback - the result callback
         */
        PluginForked.prototype.main = function (callback) {
            var self = this,
                persisted,
                config = self.getCurrentConfig();

            function makeAndSaveChanges() {
                self.core.setAttribute(self.activeNode, 'name', 'FCO_Own_Name');
                self.save('saving when config.forked = ' + config.fork.toString(), function (err, status) {
                    if (err) {
                        self.result.setSuccess(false);
                        callback(err, self.result);
                        return;
                    }
                    self.logger.debug('saved returned with status', status);
                    self.result.setSuccess(true);
                    callback(null, self.result);
                });
            }

            if (config.forkName) {
                self.forkName = config.forkName;
            }

            if (config.fork === true) {
                self.core.setAttribute(self.activeNode, 'name', 'FCO_Fork_Name');
                persisted = self.core.persist(self.rootNode);
                self.project.makeCommit(self.branchName,
                    [self.currentHash],
                    persisted.rootHash,
                    persisted.objects,
                    'Injected fork commit',
                    function (err, commitResult) {
                        if (err) {
                            self.logger.error('project.makeCommit failed.');
                            callback(err);
                            return;
                        }
                        if (commitResult.status === STORAGE_CONSTANTS.SYNCED) {
                            makeAndSaveChanges();
                        } else {
                            callback('Injected commit was not in sync, ' + commitResult.status);
                        }
                    }
                );
            } else {
                setTimeout(makeAndSaveChanges, config.timeout);
            }
        };

        return PluginForked;
    });
}