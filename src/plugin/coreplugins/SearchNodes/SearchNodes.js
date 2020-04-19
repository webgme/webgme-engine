/*globals define*/
/*eslint-env node, browser*/

/**
 * Plugin mainly used for testing.
 * @author kecso / https://github.com/kecso
 */


(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            'plugin/PluginConfig',
            'plugin/PluginBase',
            'plugin/PluginMessage',
            'text!./metadata.json'
        ], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../PluginConfig'),
            require('../../PluginBase'),
            require('../../PluginMessage'),
            require('./metadata.json')
        );
    }
}(function (PluginConfig, PluginBase, PluginMessage, pluginMetadata) {
    'use strict';

    pluginMetadata = typeof pluginMetadata === 'string' ? JSON.parse(pluginMetadata) : pluginMetadata;

    /**
     * Initializes a new instance of MinimalWorkingExample.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin MinimalWorkingExample.
     * @constructor
     */
    function SearchNodes() {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    }

    SearchNodes.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    SearchNodes.prototype = Object.create(PluginBase.prototype);
    SearchNodes.prototype.constructor = SearchNodes;

    SearchNodes.prototype.main = function (callback) {
        const self = this;
        const config = self.getCurrentConfig();
        const activeNode = self.activeNode;
        const core = self.core;

        core.traverse(activeNode, {}, (node, next) => {
            let value = core.getAttribute(node, config.attributeName);
            let match = false;
            // eslint-disable-next-line no-empty
            if (value === undefined) {
            } else if (config.searchPattern === 'null' && value === null) {
                match = true;
            } else {
                if (typeof value !== 'string') {
                    value = JSON.stringify(value);
                }

                match = new RegExp(config.searchPattern, config.matchCase ? '' : 'i').test(value);
            }

            if (match) {
                self.result.addMessage(new PluginMessage({
                    activeNode: {
                        id: core.getPath(node),
                        name: core.getAttribute(node, 'name')
                    },
                    message: 'Node [' + self.getFullNamePathString(node) + 
                    '] matched search with attribute value:[ ' + value + ' ]',
                    severity: 'info'
                }));
            }
            next(null);
        })
            .then(()=> {
                self.result.setSuccess(true);
                callback(null, self.result);
            })
            .catch((err) => {
                self.logger.error(err);
                self.result.setSuccess(false);
                callback(null, self.result);
            });
    };

    SearchNodes.prototype.getFullNamePathString = function (node) {
        let name = '';

        while (node) {
            name = this.core.getAttribute(node, 'name') + name;
            node = this.core.getParent(node);
            if (node) {
                name = '/' + name;
            }
        }
        return name;
    };

    return SearchNodes;
}));
