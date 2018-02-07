/*globals define*/
/*eslint-env node, browser*/

/**
 *
 */

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'webgme-ot',
    'q'
], function (PluginConfig,
             pluginMetadata,
             PluginBase,
             ot,
             Q) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of OTAttributeEditing.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin OTAttributeEditing.
     * @constructor
     */
    var OTAttributeEditing = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    OTAttributeEditing.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    OTAttributeEditing.prototype = Object.create(PluginBase.prototype);
    OTAttributeEditing.prototype.constructor = OTAttributeEditing;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(Error|null, plugin.PluginResult)} callback - the result callback
     */
    OTAttributeEditing.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            cfg = self.getCurrentConfig(),
            n = cfg.cycles,
            interval = cfg.interval,
            fco = self.core.getFCO(self.rootNode),
            watcherId,
            document;

        function atOperation(operation) {
            // Someone else is sending operations to the document,
            // these must be applied to our copy.

            document = operation.apply(document);
        }

        function atSelection(data) {
            // Someone else is sending selections to the document.
            self.logger.info(data);
        }

        if (!this.branchName) {
            callback(new Error('Plugin must be invoked from a branch!'), this.result);
            return;
        } else if (typeof self.project.watchDocument !== 'function') {
            callback(new Error('Plugin cannot run from bin script. A webgme server must be running!'), this.result);
            return;
        }

        self.project.watchDocument({
            branchName: self.branchName,
            nodeId: self.core.getPath(fco),
            attrName: 'otAttr',
            attrValue: ''
        }, atOperation, atSelection)
            .then(function (initData) {
                var deferred = Q.defer(),
                    cnt = 1;

                document = initData.document;
                watcherId = initData.watcherId;

                function addOutput() {
                    try {
                        var newText = '\nThis is output nr ' + cnt,
                            newOperation;

                        if (cnt > n) {
                            // All cycles have passed - it's important to unwatch the document.
                            self.project.unwatchDocument({docId: initData.docId, watcherId: watcherId})
                                .then(deferred.resolve)
                                .catch(deferred.reject);
                        } else {
                            cnt += 1;

                            // Create the operation that appends the newText to the document.
                            newOperation = new ot.TextOperation()
                                .retain(document.length) // At the end of document -
                                .insert(newText);        // insert the newText.

                            document += newText;

                            self.project.sendDocumentOperation({
                                docId: initData.docId,
                                watcherId: watcherId,
                                operation: newOperation,
                                selection: new ot.Selection({
                                    anchor: document.length - 1, // Selection starts at the end of the new document
                                    head: document.length - 1    // and ends there too.
                                })
                            });

                            setTimeout(addOutput, interval);
                        }
                    } catch (e) {
                        deferred.reject(e);
                    }
                }

                setTimeout(addOutput, interval);

                return deferred.promise;
            })
            .then(function () {
                self.logger.info('Persisting current document to attribute in model:\n"""\n', document, '\n"""');
                self.core.setAttribute(fco, 'otAttr', document);
                return self.save('OT Attribute Editing updated attribute otAttr at FCO');
            })
            .then(function () {
                self.result.setSuccess(true);
                callback(null, self.result);
            })
            .catch(function (err) {
                // Result success is false at invocation.
                self.logger.error(err.stack);
                callback(err, self.result);
            });

    };

    return OTAttributeEditing;
});
