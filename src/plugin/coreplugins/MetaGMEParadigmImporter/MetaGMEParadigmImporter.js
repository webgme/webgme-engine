/*globals define*/
/*jshint node:true, browser:true*/

/**
* Generated by PluginGenerator from webgme on Thu Jun 11 2015 09:00:58 GMT-0500 (Central Daylight Time).
*/

define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'common/util/xmljsonconverter'
], function (PluginConfig, PluginBase, Converters) {
    'use strict';

    /**
    * Initializes a new instance of MetaGMEParadigmImporter.
    * @class
    * @augments {PluginBase}
    * @classdesc This class represents the plugin MetaGMEParadigmImporter.
    * @constructor
    */
    var MetaGMEParadigmImporter = function () {
        // Call base class' constructor.
        PluginBase.call(this);
    };

    // Prototypal inheritance from PluginBase.
    MetaGMEParadigmImporter.prototype = Object.create(PluginBase.prototype);
    MetaGMEParadigmImporter.prototype.constructor = MetaGMEParadigmImporter;

    /**
    * Gets the name of the MetaGMEParadigmImporter.
    * @returns {string} The name of the plugin.
    * @public
    */
    MetaGMEParadigmImporter.prototype.getName = function () {
        return 'MetaGME Paradigm Importer';
    };

    /**
    * Gets the semantic version (semver.org) of the MetaGMEParadigmImporter.
    * @returns {string} The version of the plugin.
    * @public
    */
    MetaGMEParadigmImporter.prototype.getVersion = function () {
        return '0.1.0';
    };

    /**
    * Gets the description of the MetaGMEParadigmImporter.
    * @returns {string} The description of the plugin.
    * @public
    */
    MetaGMEParadigmImporter.prototype.getDescription = function () {
        return 'Imports a desktop GME XMP file into the meta sheet.';
    };

    /**
    * Gets the configuration structure for the MetaGMEParadigmImporter.
    * The ConfigurationStructure defines the configuration for the plugin
    * and will be used to populate the GUI when invoking the plugin from webGME.
    * @returns {object} The version of the plugin.
    * @public
    */
    MetaGMEParadigmImporter.prototype.getConfigStructure = function () {
        return [
            //{
            //    'name': 'species',
            //    'displayName': 'Animal Species',
            //    'regex': '^[a-zA-Z]+$',
            //    'regexMessage': 'Name can only contain English characters!',
            //    'description': 'Which species does the animal belong to.',
            //    'value': 'Horse',
            //    'valueType': 'string',
            //    'readOnly': false
            //},
            //{
            //    'name': 'age',
            //    'displayName': 'Age',
            //    'description': 'How old is the animal.',
            //    'value': 3,
            //    'valueType': 'number',
            //    'minValue': 0,
            //    'maxValue': 10000,
            //    'readOnly': false
            //},
            //{
            //    'name': 'carnivor',
            //    'displayName': 'Carnivor',
            //    'description': 'Does the animal eat other animals?',
            //    'value': false,
            //    'valueType': 'boolean',
            //    'readOnly': false
            //},
            //{
            //    'name': 'classification',
            //    'displayName': 'Classification',
            //    'description': '',
            //    'value': 'Vertebrates',
            //    'valueType': 'string',
            //    'valueItems': [
            //        'Vertebrates',
            //        'Invertebrates',
            //        'Unknown'
            //    ]
            //},
            //{
            //    'name': 'color',
            //    'displayName': 'Color',
            //    'description': 'The hex color code for the animal.',
            //    'readOnly': false,
            //    'value': '#FF0000',
            //    'regex': '^#([A-Fa-f0-9]{6})$',
            //    'valueType': 'string'
            //},
            {
                name: 'xmpFile',
                displayName: 'XMP file',
                description: 'Flat desktop GME meta model',
                value: '',
                valueType: 'asset',
                readOnly: false
            }
        ];
    };


    /**
    * Main function for the plugin to execute. This will perform the execution.
    * Notes:
    * - Always log with the provided logger.[error,warning,info,debug].
    * - Do NOT put any user interaction logic UI, etc. inside this method.
    * - callback always has to be called even if error happened.
    *
    * @param {function(string, plugin.PluginResult)} callback - the result callback
    */
    MetaGMEParadigmImporter.prototype.main = function (callback) {
        var self = this,
            config = self.getCurrentConfig(),
            xml2json = new Converters.Xml2json( {
                skipWSText: true,
                arrayElements: {
                    attrdef: true,
                    folder: true,
                    atom: true,
                    connection: true,
                    model: true,
                    aspect: true,
                    role: true,
                    constraint: true,
                    pointerspec: true,
                    regnode: true,
                    enumitem: true
                    //TODO: Complete this list
                }
            }),
            xmpData;

        if (!config.xmpFile) {
            self.createMessage(null, 'An XMP file must be provided.');
            callback(null, self.result);
            return;
        }

        self.blobClient.getObject(config.xmpFile, function (err, xmlArrayBuffer) {
            if (err) {
                callback(err, self.result);
                return;
            }
            if (typeof xmlArrayBuffer === 'string') {
                xmpData = xml2json.convertFromString(xmlArrayBuffer);
            } else {
                xmpData = xml2json.convertFromBuffer(xmlArrayBuffer);
            }

            console.log('xmpData', xmpData);
            self.result.setSuccess(true);
            callback(null, self.result);
        });
    };

    return MetaGMEParadigmImporter;
});