/* globals define */
/**
 * @author pmeijer / https://github.com/pmeijer
 */

define([
    'common/core/constants',
    'common/util/guid',
    'common/core/CoreIllegalArgumentError',
], function (CORE_CONSTANTS, guid, CoreIllegalArgumentError) {
    'use strict';
    var CROSSCUT_REGISTRY_NAME = 'CrossCuts';
    var CROSSCUT_ID_PREFIX = 'Crosscut_';

    var _core = null;

    /**
     * Module for handling of crosscuts using the core. <br>
     * To include in your module (e.g. Plugin) require via 'common/core/users/crosscut' and invoke initialize
     * by passing a reference to a core instance.
     * <br>
     * @example
     * crosscuts.initialize(core);
     * crosscuts.getIds();
     * @module crosscuts
     */
    var exports = {};

    /**
     * Initializes the module with a core instance. This must be called before any other method.
     * @param {Core} core - An instance of a Core module.
     */
    exports.initialize = function (core) {
        _core = core;
    };

    /**
     *
     * @param node
     * @param crosscutId
     * @param [memberPath]
     * @private
     */
    function _ensureCrosscutExists(node, crosscutId, memberPath) {
        var exists = false;

        if (typeof memberPath === 'string') {
            // This ensure the crosscut exists.
            exports.getMemberPaths(node, crosscutId).forEach(function (mPath) {
                if (memberPath === mPath) {
                    exists = true;
                }
            });

            if (!exists) {
                throw new CoreIllegalArgumentError('Member [' + memberPath + '] does not exist in crosscut [' +
                    crosscutId + ']');
            }
        } else {
            exports.getIds(node).forEach(function (cId) {
                if (crosscutId === cId) {
                    exists = true;
                }
            });

            if (!exists) {
                throw new CoreIllegalArgumentError('Crosscut does not exist [' + crosscutId + ']');
            }
        }
    }

    function _ensureInitialized() {
        if (_core === null) {
            throw new Error('Crosscut module has not been initialized!');
        }
    }

    function _getPath(nodeOrPath) {
        return typeof nodeOrPath === 'string' ? nodeOrPath : _core.getPath(nodeOrPath);
    }

    /**
     * Returns the raw stored crosscut info at the provided node.
     * @param {module:Core~Node} node
     * @returns {object[]}
     */
    exports.getInfo = function (node) {
        _ensureInitialized();

        return _core.getRegistry(node, CROSSCUT_REGISTRY_NAME) || [];
    };

    /**
     * Returns all titles of the crosscuts at the provided node.
     * @param {module:Core~Node} node - Owner of the crosscuts.
     * @returns {string[]}
     */
    exports.getTitles = function (node) {
        return exports.getInfo(node).map(function (cInfo) {
            return cInfo.title;
        });
    };

    /**
     * Returns all the cross-cut ideas at the provided node.
     * @param {module:Core~Node} node - Owner of the crosscuts.
     * @returns {string[]} The crosscut ids.
     */
    exports.getIds = function (node) {
        return exports.getInfo(node).map(function (cInfo) {
            return cInfo.SetID;
        });
    };

    /**
     * If title exists and is unique will return the id of the crosscut. If not
     * it will throw an exception.
     * @param {module:Core~Node} node - Owner of the crosscut.
     * @param {string} title
     * @returns {string} The crosscut id.
     */
    exports.getIdFromTitle = function (node, title) {
        var id;

        exports.getInfo(node).forEach(function (cInfo) {
            if (cInfo.title === title) {
                if (typeof id === 'string') {
                    throw new CoreIllegalArgumentError('Title [' + title + '] appears in more than one crosscut!');
                } else {
                    id = cInfo.SetID;
                }
            }
        });

        if (typeof id !== 'string') {
            throw new CoreIllegalArgumentError('Title [' + title + '] does not exist among crosscuts!');
        }

        return id;
    };

    /**
     * Returns the paths to all members in the specified crosscut.
     * @param {module:Core~Node} node - Owner of the crosscut.
     * @param {string} crosscutId
     * @returns {string[]} Paths of members
     */
    exports.getMemberPaths = function (node, crosscutId) {
        _ensureCrosscutExists(node, crosscutId);
        return _core.getMemberPaths(node, crosscutId);
    };

    /**
     * Return the position at the cross-cuts for the member in the given crosscut at the provided node.
     * @param {module:Core~Node} node - Owner of the crosscut.
     * @param {string} crosscutId - Crosscut id to add member to.
     * @param {module:Core~Node|string} memberNodeOrPath - Node, or path of, member to get position of.
     * @returns {object} The position of the member inside the crosscut.
     */
    exports.getMemberPosition = function (node, crosscutId, memberNodeOrPath) {
        _ensureInitialized();
        var memberPath = _getPath(memberNodeOrPath);
        _ensureCrosscutExists(node, crosscutId, memberPath);
        return _core.getMemberRegistry(node, crosscutId, memberPath, 'position') || {x: 100, y: 100};
    };

    /**
     * Adds a new crosscut to the node.
     * @param {module:Core~Node} node - Owner of the new crosscut.
     * @param {string} title - Visible title of crosscut.
     * @param {number} [order] - Tab order starting from 0, if not given will be placed at end.
     * @returns {string} The id of the newly created crosscut.
     */
    exports.createCrosscut = function (node, title, order) {
        var id = CROSSCUT_ID_PREFIX + guid();
        var cInfo = exports.getInfo(node);

        if (typeof order === 'number') {
            if (order < 0) {
                throw new CoreIllegalArgumentError('Provided order must be >= 0');
            }

            if (cInfo.length < order) {
                throw new CoreIllegalArgumentError('Provided order is greater than the largest possible index ' +
                    cInfo.length + '.');
            }

            cInfo.forEach(function (entry) {
                if (entry.order >= order) {
                    entry.order += 1;
                }
            });
        } else {
            order = cInfo.length;
        }

        cInfo.push({
            SetID: id,
            order: order,
            title: title,
        });

        _core.createSet(node, id);

        cInfo.sort(function (a, b) {
            if (a.order < b.order) {
                return -1;
            } else {
                return 1;
            }
        });

        _core.setRegistry(node, CROSSCUT_REGISTRY_NAME, cInfo);

        return id;
    };

    /**
     * Updates the position of the member inside the specified crosscut.
     * @param {module:Core~Node} node - Owner of the crosscut.
     * @param {string} crosscutId - Id of crosscut.
     * @param {module:Core~Node|string} memberNodeOrPath - Node, or path of, member to update position for.
     * @param {object} newPosition - Position of the member inside the crosscut.
     */
    exports.setMemberPosition = function (node, crosscutId, memberNodeOrPath, newPosition) {
        _ensureInitialized();
        var memberPath = _getPath(memberNodeOrPath);
        _ensureCrosscutExists(node, crosscutId, memberPath);
        _core.setMemberRegistry(node, crosscutId, memberPath, 'position', newPosition);
    };

    /**
     * Adds a member to the crosscut at an optionally provided position.
     * @param {module:Core~Node} node - Owner of the crosscut.
     * @param {string} crosscutId - Crosscut id to add member to.
     * @param {module:Core~Node} memberNode - Node that should be added to crosscut.
     * @param {object} [position={x:100, y:100}] - Position of the member inside crosscut.
     */
    exports.addMember = function (node, crosscutId, memberNode, position) {
        _ensureCrosscutExists(node, crosscutId);
        position = position || {x: 100, y: 100};
        _core.addMember(node, crosscutId, memberNode);
        exports.setMemberPosition(node, crosscutId, memberNode, position);
    };

    /**
     * Deletes the crosscut from the node.
     * @param {module:Core~Node} node - Owner of the crosscut.
     * @param {string} crosscutId - Id of crosscut to delete.
     */
    exports.deleteCrosscut = function (node, crosscutId) {
        var cInfo = exports.getInfo(node);
        var entryOrder;
        _ensureCrosscutExists(node, crosscutId);

        cInfo = cInfo.filter(function (entry) {
            if (entry.SetID === crosscutId) {
                entryOrder = entry.order;
                return false;
            }

            return true;
        });

        cInfo.forEach(function (entry) {
            if (entry.order > entryOrder) {
                entry.order -= 1;
            }
        });

        cInfo.sort(function (a, b) {
            if (a.order < b.order) {
                return -1;
            } else {
                return 1;
            }
        });

        _core.delSet(node, crosscutId);
        _core.setRegistry(node, CROSSCUT_REGISTRY_NAME, cInfo);
    };

    /**
     * Removes the member from the specified crosscut.
     * @param {module:Core~Node} node - Owner of the crosscut.
     * @param {string} crosscutId - Id of crosscut.
     * @param {module:Core~Node|string} memberNodeOrPath - Node, or path of, member to delete from crosscut.
     */
    exports.delMember = function (node, crosscutId, memberNodeOrPath) {
        _ensureInitialized();
        var memberPath =  _getPath(memberNodeOrPath);
        _ensureCrosscutExists(node, crosscutId, memberPath);
        _core.delMember(node, crosscutId, memberPath);
    };

    return exports;
});
