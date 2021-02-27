/*globals define*/
/*eslint-env node, browser*/

/**
 * Plugin illustrating how to merge branches/commits.
 *
 * @author kecso / https://github.com/kecso
 * @module CorePlugins:SpecialMerge
 */

define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'text!./metadata.json',
    'common/core/users/merge',
    'q',
    'common/regexp'
], function (PluginConfig, PluginBase, pluginMetadata, merge, Q, REGEXP) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of SpecialMerge.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin SpecialMerge.
     * @constructor
     */
    function SpecialMerge() {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    }

    SpecialMerge.metadata = pluginMetadata;

    // Prototypal inheritance from PluginBase.
    SpecialMerge.prototype = Object.create(PluginBase.prototype);
    SpecialMerge.prototype.constructor = SpecialMerge;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    SpecialMerge.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this;
        // Obtain the current user configuration.
        var currentConfig = self.getCurrentConfig();
        self.logger.info('Current configuration ' + JSON.stringify(currentConfig, null, 4));

        function resolutionStrategy(result) {
            // set the resolution as needed, then return with the object.
            return result;
        }

        self.logger.error(self.branchName);
        self.merge(currentConfig.commitToMerge, 'master')
            .then(function (result) {
                self.logger.info(result);

                self.result.setSuccess(true);
                callback(null, self.result);
            })
            .catch(function (err) {
                self.result.setSuccess(false);
                self.result.setError(err.message);
                callback(err, self.result);
            });
    };

    /**
     * Merges two branches or commits. If the newBranchName is given it creates a new branch for the result.
     *
     * @param mergeFrom {string}
     * @param mergeTo {string}
     * @param newBranchName [string|null]
     * @param resolutionStrategy [Function|null] - defines how the conflicts should be resolved, by default 'mine'
     *                                             is chosen for all conflicts.
     * @returns {*}
     */
    SpecialMerge.prototype.merge = function (mergeFrom, mergeTo) {
        var self = this;

        // default values
        mergeTo = mergeTo || 'master';
        

        return merge.merge({
            project: self.project,
            logger: self.logger,
            gmeConfig: self.gmeConfig,
            myBranchOrCommit: mergeFrom,
            theirBranchOrCommit: mergeTo,
            auto: true
        })
        .then(function (result) {
            if (!result.conflict || result.conflict.items.length === 0) {
                return result;
            } else {
                // there was a conflict
                result.conflict.items = result.conflict.items.map(item => {
                    return self.handleConflict(item);
                });
                // resolve
                return merge.resolve({
                    partial: result,
                    project: self.project,
                    logger: self.logger,
                    gmeConfig: self.gmeConfig,
                    myBranchOrCommit: mergeFrom,
                    theirBranchOrCommit: mergeTo,
                    auto: true
                });
            }

        });
    };

    /**
     * This process handles the conflicts. In its default form, if there is an attribute value conflict
     *
     * @param conflictItem {object}
     * 
     * @returns {*}
     */
    SpecialMerge.prototype.handleConflict = function(conflictItem) {
        //this.logger.error(JSON.stringify(conflictItem, null, 2));
        if(conflictItem.mine.path.indexOf('/attr/') !== -1) {
            if(conflictItem.mine.value !== '*to*delete*' && conflictItem.theirs.value !== '*to*delete*') {
                //it is an attribute conflict and purely because the two branches set different values
                conflictItem.selected = 'other'; // we need to change this so the resolution will overwrite the original value
                conflictItem.other.value = conflictItem.theirs.value + conflictItem.mine.value;
            }
        }
        return conflictItem;
    };

    return SpecialMerge;
});