/*globals define*/
/*eslint-env node, browser*/
/**
 * Helper functions used by plugins and plugin-managers.
 * @author pmeijer / https://github.com/pmeijer
 */

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['q'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('q'));
    }
}(function (Q) {
    'use strict';

    /**
     *
     * @param {object} core
     * @param {GmeNode} rootNode
     * @param {GmeLogger} logger
     * @param {string} [namespace='']
     * @param namespace
     */
    function getMetaNodesMap(core, rootNode, logger, namespace) {
        var paths2MetaNodes = core.getAllMetaNodes(rootNode),
            libraryNames = core.getLibraryNames(rootNode),
            result = {},
            metaNodeName,
            nodeNamespace,
            fullName,
            path;

        // Gather the META nodes and "sort" based on given namespace.
        function startsWith(str, pattern) {
            return str.indexOf(pattern) === 0;
        }

        if (namespace) {
            if (libraryNames.indexOf(namespace) === -1) {
                throw new Error('Given namespace "' + namespace + '" does not exist among the available: [' +
                    libraryNames + '].');
            }

            for (path in paths2MetaNodes) {
                nodeNamespace = core.getNamespace(paths2MetaNodes[path]);
                metaNodeName = core.getAttribute(paths2MetaNodes[path], 'name');

                if (startsWith(nodeNamespace, namespace)) {
                    // Trim the based on the chosen namespace (+1 is to remove any dot).
                    nodeNamespace = nodeNamespace.substring(namespace.length + 1);
                    if (nodeNamespace) {
                        result[nodeNamespace + '.' + metaNodeName] = paths2MetaNodes[path];
                    } else {
                        result[metaNodeName] = paths2MetaNodes[path];
                    }
                } else {
                    // Meta node is not within the given namespace and will not be added to META.
                }
            }
        } else {
            for (path in paths2MetaNodes) {
                fullName = core.getFullyQualifiedName(paths2MetaNodes[path]);
                if (result[fullName]) {
                    logger.error('Meta-nodes share the same full name. Will still proceed..', fullName);
                }

                result[fullName] = paths2MetaNodes[path];
            }
        }

        return result;
    }

    /**
     *
     * @param {object} project
     * @param {object} core
     * @param {string} commitHash
     * @param {GmeLogger} logger
     * @param {object} options
     * @param {string} [options.activeNode=''] - path to active node
     * @param {string[]} [options.activeSelection=[]] - paths to selected nodes.
     * @param {string} [options.namespace=''] - used namespace during execution ('' represents all namespaces).
     * @param callback
     * @returns {*}
     */
    function loadNodesAtCommitHash(project, core, commitHash, logger, options, callback) {
        var result = {
            commitHash: commitHash,
            rootHash: null,
            rootNode: null,
            activeNode: null,
            activeSelection: null,
            META: {}
        };

        return Q.ninvoke(project, 'loadObject', commitHash)
            .then(function (commitObject) {
                result.rootHash = commitObject.root;
                logger.debug('commitObject loaded');

                // Load root node.
                return core.loadRoot(result.rootHash);
            })
            .then(function (rootNode) {
                result.rootNode = rootNode;
                logger.debug('rootNode loaded');

                // Load active node.
                return core.loadByPath(result.rootNode, options.activeNode || '');
            })
            .then(function (activeNode) {
                result.activeNode = activeNode;
                logger.debug('activeNode loaded');

                // Load active selection.
                options.activeSelection = options.activeSelection || [];

                return Q.all(options.activeSelection.map(function (nodePath) {
                    return core.loadByPath(result.rootNode, nodePath);
                }));
            })
            .then(function (activeSelection) {
                result.activeSelection = activeSelection;
                logger.debug('activeSelection loaded');
                result.META = getMetaNodesMap(core, result.rootNode, logger, options.namespace);

                return result;
            })
            .nodeify(callback);
    }

    return {
        loadNodesAtCommitHash: loadNodesAtCommitHash,
        getMetaNodesMap: getMetaNodesMap,
    };
}));