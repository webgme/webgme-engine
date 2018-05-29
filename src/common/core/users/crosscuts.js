/* globals define */
/**
 * @author pmeijer / https://github.com/pmeijer
 */

define(['common/core/constants', 'common/util/guid'], function (CORE_CONSTANTS, guid) {
    'use strict';
    var CROSSCUT_REGISTRY_NAME = 'CrossCuts';
    var CROSSCUT_ID_PREFIX = 'Crosscut_';

    var core = null;

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
            getMemberPaths(node, crosscutId).forEach(function (cId) {
                if (crosscutId === cId) {
                    exists = true;
                }
            });

            if (!exists) {
                throw new Error('Member [' + memberPath + '] does not exist in crosscut [' + crosscutId + ']');
            }
        } else {
            getIds(node).forEach(function (cId) {
                if (crosscutId === cId) {
                    exists = true;
                }
            });

            if (!exists) {
                throw new Error('Crosscut does not exist [' + crosscutId + ']');
            }
        }
    }

    /**
     * Returns the raw stored crosscut info at the provided node.
     * @param {CoreNode} node
     * @returns {object[]}
     */
    function getInfo(node) {
        if (core === null) {
            throw new Error('Crosscut module has not been initialized!');
        }

        return core.getRegistry(node, CROSSCUT_REGISTRY_NAME) || [];
    }

    /**
     * Returns all titles of the crosscuts at the provided node.
     * @param {CoreNode} node
     * @returns {string[]}
     */
    function getTitles(node) {
        return getInfo(node).map(function (cInfo) {
            return cInfo.title;
        });
    }

    /**
     * Returns all the cross-cut ideas at the provided node.
     * @param {CoreNode} node
     * @returns {string[]} The crosscut ids.
     */
    function getIds(node) {
        return getInfo(node).map(function (cInfo) {
            return cInfo.SetID;
        });
    }

    /**
     * If title exists and is unique will return the id of the crosscut. If not
     * it will throw an exception.
     * @param {CoreNode} node
     * @param {string} title
     * @returns {string} The crosscut id.
     */
    function getIdFromTitle(node, title) {
        var id;

        getInfo(node).forEach(function (cInfo) {
            if (cInfo.title === title) {
                if (typeof id === 'string') {
                    throw new Error('Title [' + title + '] appears in more than one crosscut!');
                } else {
                    id = cInfo.SetID;
                }
            }
        });

        if (typeof id !== 'string') {
            throw new Error('Title [' + title + '] does not exist among crosscuts!');
        }

        return id;
    }

    /**
     * Returns the paths to all members in the specified crosscut.
     * @param {CoreNode} node
     * @param {string} crosscutId
     * @returns {string[]} Paths of members
     */
    function getMemberPaths(node, crosscutId) {
        if (core === null) {
            throw new Error('Crosscut module has not been initialized!');
        }

        _ensureCrosscutExists(node, crosscutId);

        return core.getMemberPaths(node, crosscutId);
    }

    /**
     * Return the position at the cross-cuts for the member in the given crosscut at the provided node.
     * @param {CoreNode} node - Owner of the crosscut.
     * @param {string} crosscutId - Crosscut id to add member to.
     * @param {string} memberPath - The member of which to get the position.
     * @returns {object} The position of the member inside the crosscut.
     */
    function getMemberPosition(node, crosscutId, memberPath) {
        _ensureCrosscutExists(node, crosscutId, memberPath);
        return core.getMemberRegistry(node, crosscutId, memberPath, 'position') || {x: 100, y: 100};
    }

    /**
     * Adds a new crosscut to the node.
     * @param {CoreNode} node - Owner of the new crosscut.
     * @param {string} title - Visible title of crosscut.
     * @param {number} [order] - Tab order starting from 0, if not given will be placed at end.
     * @returns {string} The id of the newly created crosscut.
     */
    function createCrosscut(node, title, order) {
        var id = CROSSCUT_ID_PREFIX + guid();
        var cInfo = getInfo(node);

        if (typeof order === 'number') {
            if (order < 0) {
                throw new Error('Provided order must be >= 0');
            }

            if (cInfo.length < order) {
                throw new Error('Provided order is greater than the largest possible index ' + cInfo.length + '.');
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

        core.createSet(node, id);
        core.setRegistry(node, CROSSCUT_REGISTRY_NAME, cInfo);

        return id;
    }

    /**
     * Adds a member to the crosscut at an optionally provided position.
     * @param {CoreNode} node - Owner of the crosscut.
     * @param {string} crosscutId - Crosscut id to add member to.
     * @param {CoreNode} memberNode - Node that should be added to crosscut.
     * @param {object} [position={x:100, y:100}] - Position of the member inside crosscut.
     */
    function addMember(node, crosscutId, memberNode, position) {
        _ensureCrosscutExists(node, crosscutId);
        position = position || {x: 100, y: 100};
        core.addMember(node, crosscutId, memberNode);
        core.setMemberRegistry(node, crosscutId, core.getPath(memberNode), 'position', position);
    }

    function deleteCrosscut(node, crosscutId) {
        throw new Error('Not implemented!');
    }

    function delMember(node, crosscutId, memberPath) {
        throw new Error('Not implemented!');
        // const cInfo = getCrosscutsInfo(node);
        // for (var i = 0; i < cInfo.length; i += 1) {
        //
        // }
    }

    function setMemberPosition(node, crosscutId, memberPath, newPosition) {
        throw new Error('Not implemented!');
    }

    return {
        initialize: function (core_) {
            core = core_;
        },
        getInfo: getInfo,
        getTitles: getTitles,
        getIds: getIds,
        getIdFromTitle: getIdFromTitle,
        getMemberPaths: getMemberPaths,
        getMemberPosition: getMemberPosition,

        createCrosscut: createCrosscut,
        addMember: addMember,
    };
});
