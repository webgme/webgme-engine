/*globals define, console*/
/*eslint-env browser*/

/**
 * @author kecso / https://github.com/kecso
 * @author pmeijer / https://github.com/pmeijer
 */
define([], function () {
    'use strict';

    function gmeNodeSetter(logger, state, saveRoot, storeNode, printCoreError) {

        function _logDeprecated(oldFn, newFn, isGetter, comment) {
            var typeToUse = isGetter ? 'gmeNode.' : 'gmeClient.',
                commentStr = comment ? comment : '';

            //eslint-disable-next-line no-console
            console.warn('"gmeClient.' + oldFn + '" is deprecated and will eventually be removed, use "' +
                typeToUse + newFn + '" instead.' + commentStr);
        }

        function _getNode(path) {
            if (state.core && state.nodes[path] && typeof state.nodes[path].node === 'object') {
                return state.nodes[path].node;
            }
        }

        function _setAttrAndRegistry(node, desc) {
            var name;
            desc = desc || {};

            if (desc.attributes) {
                for (name in desc.attributes) {
                    if (desc.attributes.hasOwnProperty(name)) {
                        state.core.setAttribute(node, name, desc.attributes[name]);
                    }
                }
            }

            if (desc.registry) {
                for (name in desc.registry) {
                    if (desc.registry.hasOwnProperty(name)) {
                        state.core.setRegistry(node, name, desc.registry[name]);
                    }
                }
            }
        }

        function _copyMultipleNodes(paths, parentNode, resultAsArray) {
            var copiedNodes, result = {},
                resultArray = [],
                i, originalNodes = [],
                checkPaths = function () {
                    var i,
                        result = true;

                    for (i = 0; i < paths.length; i += 1) {
                        result = result && (state.nodes[paths[i]] &&
                            typeof state.nodes[paths[i]].node === 'object');
                    }

                    return result;
                };

            if (parentNode && checkPaths()) {
                for (i = 0; i < paths.length; i += 1) {
                    originalNodes.push(state.nodes[paths[i]].node);
                }

                copiedNodes = state.core.copyNodes(originalNodes, parentNode);

                if (copiedNodes instanceof Error) {
                    return copiedNodes;
                }

                for (i = 0; i < paths.length; i += 1) {
                    result[paths[i]] = copiedNodes[i];
                    resultArray.push(storeNode(copiedNodes[i]));
                }
            }

            return resultAsArray ? resultArray : result;
        }

        /**
         * @description Method to set an attribute of a given node.
         * @memberOf Client
         * @instance
         * @param {string} path - The path of the node in question.
         * @param {string} name - The name of the attribute.
         * @param {any} value - The value of the attribute to be set.
         * @param {string} msg - The message that should be attached to the commit that covers this update.
         */
        function setAttribute(path, name, value, msg) {
            var error,
                node = _getNode(path);

            if (node) {
                error = state.core.setAttribute(node, name, value);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ?
                    msg : 'setAttribute(' + path + ',' + name + ',' + JSON.stringify(value) + ')');
            }
        }

        /**
         * @description Method to remove an attribute from a given node.
         * @memberOf Client
         * @instance
         * @param {string} path - The path of the node in question.
         * @param {string} name - The name of the attribute.
         * @param {string} msg - The message that should be attached to the commit that covers this update.
         */
        function delAttribute(path, name, msg) {
            var error,
                node = _getNode(path);

            if (node) {
                error = state.core.delAttribute(node, name);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delAttribute(' + path + ',' + name + ')');
            }
        }

        /**
         * @description Method to set a registry entry of a given node.
         * @memberOf Client
         * @instance
         * @param {string} path - The path of the node in question.
         * @param {string} name - The name of the registry.
         * @param {any} value - The value of the registry to be set.
         * @param {string} msg - The message that should be attached to the commit that covers this update.
         */
        function setRegistry(path, name, value, msg) {
            var error,
                node = _getNode(path);

            if (node) {
                error = state.core.setRegistry(node, name, value);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ?
                    msg : 'setRegistry(' + path + ',' + name + ',' + JSON.stringify(value) + ')');
            }
        }

        /**
         * @description Method to remove a registry entry of a given node.
         * @memberOf Client
         * @instance
         * @param {string} path - The path of the node in question.
         * @param {string} name - The name of the registry.
         * @param {string} msg - The message that should be attached to the commit that covers this update.
         */
        function delRegistry(path, name, msg) {
            var error,
                node = _getNode(path);

            if (node) {
                error = state.core.delRegistry(node, name);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delRegistry(' + path + ',' + name + ')');
            }
        }

        /**
         * @example
         *
         * var nodeCopy1 = client.copyNode('/4', '');
         * var nodeCopy2 = client.copyNode('/4', '', {
         *   attributes: {
         *     name: 'CopiedNode'
         *   },
         *   registry: {
         *     position: {x: 100, y: 100}
         *   }
         * }, 'Created node with specific name and position.');
         *
         * @description Copies the given node into parent 
         * (does not enforce meta-rules and requires all participating nodes to be loaded in the client)
         * @function copyNode
         * @memberOf Client
         * @param {string} path - the id/path of the node to copy
         * @param {string} parentId - the id/path of the parent where the new copy should be created
         * @param {object} [desc={}] - named attributes and/or registries to set for the new node (see example)
         * @param {object} [desc.attributes={}] - named attributes to set for the new node
         * @param {object} [desc.registry={}] - named registries to set for the new node
         * @param {string} [msg] - optional commit message, if not supplied a default one 
         * with the function name and input parameters will be used
         * @returns {GMENode|undefined} - the newly created node if it could be copied
         * @instance
         */
        function copyNode(path, parentPath, desc, msg) {
            var node = _getNode(path),
                parentNode = _getNode(parentPath),
                newNode, newPath;

            if (node && parentNode) {
                newNode = state.core.copyNode(node, parentNode);

                if (newNode instanceof Error) {
                    printCoreError(newNode);
                    return;
                }

                _setAttrAndRegistry(newNode, desc);
                newPath = storeNode(newNode);

                saveRoot(typeof msg === 'string' ?
                    msg : 'copyNode(' + path + ', ' + parentPath + ', ' + JSON.stringify(desc) + ')');
                return newPath;
            }
        }

        /**
         * @example
         *
         * client.copyMoreNodes({
         *    parentId: '',
         *    '/4': {},
         *    '/5': {
         *      attributes: {
         *        name: 'MyNamedCopy'
         *      },
         *      registry: {
         *        position: {x: 100, y:100}
         *      }
         *    }
         * }, 'Copied two nodes with some additional init data.');
         *
         * @description Copies the given nodes into the parent (does not enforce meta-rules 
         * and requires all participating nodes to be loaded in the client)
         * @function copyMoreNodes
         * @memberOf Client
         * @param {object} parameters - the parameters holding parentId and nodes to be copied
         * indexed by their ids/paths (see example)
         * @param {string} parameters.parentId - the id/path of the parent where the new copies should be created
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function copyMoreNodes(parameters, msg) {
            var pathsToCopy = [],
                parentNode = _getNode(parameters.parentId),
                nodePath,
                newNodes;

            if (parentNode) {
                for (nodePath in parameters) {
                    if (parameters.hasOwnProperty(nodePath) && nodePath !== 'parentId') {
                        pathsToCopy.push(nodePath);
                    }
                }

                msg = typeof msg === 'string' ?
                    msg : 'copyMoreNodes(' + JSON.stringify(pathsToCopy) + ',' + parameters.parentId + ')';

                if (pathsToCopy.length < 1) {
                    // empty on purpose
                } else if (pathsToCopy.length === 1) {
                    copyNode(pathsToCopy[0], parameters.parentId, parameters[pathsToCopy[0]], msg);
                } else {
                    newNodes = _copyMultipleNodes(pathsToCopy, parentNode);

                    if (newNodes instanceof Error) {
                        printCoreError(newNodes);
                        return;
                    }

                    for (nodePath in newNodes) {
                        if (newNodes.hasOwnProperty(nodePath) && parameters[nodePath]) {
                            _setAttrAndRegistry(newNodes[nodePath], parameters[nodePath]);
                        }
                    }

                    saveRoot(msg);
                }
            } else {
                state.logger.error('wrong parameters for copy operation - denied -');
            }
        }

        /**
         * @example
         *
         * client.moveMoreNodes({
         *    parentId: '',
         *    '/4': {},
         *    '/5': {
         *      attributes: {
         *        name: 'MyNamedCopy'
         *      },
         *      registry: {
         *        position: {x: 100, y:100}
         *      }
         *    }
         * }, 'Copied two nodes with some additional init data.');
         *
         * @description Moves the given nodes into the parent (does not enforce meta-rules 
         * and requires all participating nodes to be loaded in the client)
         * @function moveMoreNodes
         * @memberOf Client
         * @param {object} parameters - the parameters holding parentId and nodes to be copied
         * indexed by their ids/paths (see example)
         * @param {string} parameters.parentId - the id/path of the parent where the new copies should be created
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function moveMoreNodes(parameters, msg) {
            var pathsToMove = [],
                returnParams = {},
                i,
                newNode;

            for (i in parameters) {
                if (parameters.hasOwnProperty(i)) {
                    if (i !== 'parentId') {
                        pathsToMove.push(i);
                    }
                }
            }

            if (pathsToMove.length > 0 &&
                typeof parameters.parentId === 'string' &&
                state.nodes[parameters.parentId] &&
                typeof state.nodes[parameters.parentId].node === 'object') {
                for (i = 0; i < pathsToMove.length; i += 1) {
                    if (state.nodes[pathsToMove[i]] &&
                        typeof state.nodes[pathsToMove[i]].node === 'object') {

                        newNode = state.core.moveNode(state.nodes[pathsToMove[i]].node,
                            state.nodes[parameters.parentId].node);
                        returnParams[pathsToMove[i]] = state.core.getPath(newNode);
                        _setAttrAndRegistry(newNode, parameters[pathsToMove[i]]);
                        delete state.nodes[pathsToMove[i]];
                        storeNode(newNode, true);
                    }
                }
            }

            saveRoot(typeof msg === 'string' ? msg : 'moveMoreNodes(' + JSON.stringify(returnParams) + ')');
            return returnParams;
        }

        /**
         * @example
         *
         * client.createChildren({
         *    parentId: '',
         *    '/4': {},
         *    '/5': {
         *      attributes: {
         *        name: 'MyVeryOwnName'
         *      },
         *      registry: {
         *        position: {x: 100, y:100}
         *      }
         *    }
         * }, 'Created new children of the root based on the list of existing nodes.');
         *
         * @description Creates instances as children of the parent node based on the list 
         * of nodes among the parameters (does not enforce meta-rules 
         * and requires all participating nodes to be loaded in the client).
         * @function createChildren
         * @memberOf Client
         * @param {object} parameters - the parameters holding parentId and nodes to be instantiated
         * indexed by their ids/paths (see example)
         * @param {string} parameters.parentId - the id/path of the parent where the new nodes should be created
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function createChildren(parameters, msg) {
            //TODO we also have to check out what is happening with the sets!!!
            var result = {},
                paths = [],
                nodes = [],
                node,
                parent = state.nodes[parameters.parentId].node,
                names, i, j, index, pointer,
                newChildren = [],
                relations = [];

            //to allow 'meaningfull' instantiation of multiple objects
            // we have to recreate the internal relations - except the base
            paths = Object.keys(parameters);
            paths.splice(paths.indexOf('parentId'), 1);
            for (i = 0; i < paths.length; i++) {
                node = state.nodes[paths[i]].node;
                nodes.push(node);
                pointer = {};
                names = state.core.getPointerNames(node);
                index = names.indexOf('base');
                if (index !== -1) {
                    names.splice(index, 1);
                }

                for (j = 0; j < names.length; j++) {
                    index = paths.indexOf(state.core.getPointerPath(node, names[j]));
                    if (index !== -1) {
                        pointer[names[j]] = index;
                    }
                }
                relations.push(pointer);
            }

            //now the instantiation
            for (i = 0; i < nodes.length; i++) {
                newChildren.push(state.core.createNode({parent: parent, base: nodes[i]}));
            }

            //now for the storage and relation setting
            for (i = 0; i < paths.length; i++) {
                _setAttrAndRegistry(newChildren[i], parameters[paths[i]]);

                //relations
                names = Object.keys(relations[i]);
                for (j = 0; j < names.length; j++) {
                    state.core.setPointer(newChildren[i], names[j], newChildren[relations[i][names[j]]]);
                }

                //store
                result[paths[i]] = storeNode(newChildren[i]);

            }

            msg = typeof msg === 'string' ? msg : 'createChildren(' + JSON.stringify(result) + ')';
            saveRoot(msg);
            return result;
        }

        /**
         * @description Delete the given node.
         * @function deleteNode
         * @memberOf Client
         * @param {string} path - the path/id of the node to be deleted from the model.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function deleteNode(path, msg) {
            var node = _getNode(path);

            if (node) {
                state.core.deleteNode(node);
                saveRoot(typeof msg === 'string' ? msg : 'deleteNode(' + path + ')');
            }
        }

        /**
         * @description Delete the given node.
         * @function deleteNodes
         * @memberOf Client
         * @param {string[]} paths - the path/id list of the nodes to be deleted from the model.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function deleteNodes(paths, msg) {
            var didDelete = false,
                i,
                node;

            for (i = 0; i < paths.length; i++) {
                node = _getNode(paths[i]);
                if (node) {
                    state.core.deleteNode(node);
                    didDelete = true;
                }
            }

            if (didDelete) {
                saveRoot(typeof msg === 'string' ? msg : 'deleteNodes(' + paths + ')');
            }
        }

        /**
         * @example
         *
         * client.createNode({
         *    parentId: '',
         *    baseId:'/1',
         *    guid:,
         *    relid:'/aaa'
         *   },
         *   {
         *     attributes: {
         *        name: 'MyVeryOwnName'
         *      },
         *      registry: {
         *        position: {x: 100, y:100}
         *      }
         *   },
         *   'Created new node as the child of the root and instance of the FCO.');
         *
         * @description Creates a new node based on the given parameters.
         * @function createNode
         * @memberOf Client
         * @param {object} parameters - the parameters holding necessary information for the creation.
         * @param {string} parameters.parentId - the path/id of the container of the new node.
         * @param {string} parameters.baseId - the path/id of the prototype of the new node.
         * @param {string} parameters.parentId - the id/path of the parent where the new nodes should be created
         * @param {string} [parameters.guid] - the unique identifier of the node we will create.
         * @param {string} [parameters.relid] - the relative id of the node we will create.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function createNode(parameters, desc, msg) {
            var parentNode = _getNode(parameters.parentId),
                baseNode = _getNode(parameters.baseId),
                newNode,
                newID;

            if (parentNode) {
                newNode = state.core.createNode({
                    parent: parentNode,
                    base: baseNode,
                    guid: parameters.guid,
                    relid: parameters.relid
                });

                if (newNode instanceof Error) {
                    printCoreError(newNode);
                    return;
                }

                // By default the position will be {100, 100}

                desc = desc || {};
                desc.registry = desc.registry || {};
                desc.registry.position = desc.registry.position || {};
                desc.registry.position.x = (typeof desc.registry.position.x === 'number' ||
                    Number(desc.registry.position.x) + '' === desc.registry.position.x) ?
                    Number(desc.registry.position.x) : 100;
                desc.registry.position.y = (typeof desc.registry.position.y === 'number' ||
                    Number(desc.registry.position.y) + '' === desc.registry.position.y) ?
                    Number(desc.registry.position.y) : 100;

                _setAttrAndRegistry(newNode, desc);

                storeNode(newNode);
                newID = state.core.getPath(newNode);
                saveRoot(typeof msg === 'string' ? msg :
                    'createNode(' + parameters.parentId + ',' + parameters.baseId + ',' + newID + ')');
            }

            return newID;
        }

        /**
         * @description Sets the value of the pointer of the given node.
         * @function setPointer
         * @memberOf Client
         * @param {string} path - the path/id of the node that we will modify.
         * @param {string} name - the name of the pointer to set.
         * @param {string|null} target - the id/path of the target node of the pointer. If
         * the value is null, there will be no target for the pointer.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setPointer(path, name, target, msg) {
            var node = _getNode(path),
                targetNode;

            if (node) {
                if (target === null) {
                    state.core.setPointer(node, name, target);
                } else {
                    targetNode = _getNode(target);
                    state.core.setPointer(node, name, targetNode);
                }

                saveRoot(typeof msg === 'string' ? msg : 'setPointer(' + path + ',' + name + ',' + target + ')');
            }
        }

        /**
         * @description Removes the pointer of the given node.
         * Setting a pointer to null and deleting it is different! 
         * (one is a value, the other means the absence of value)
         * @function delPointer
         * @memberOf Client
         * @param {string} path - the path/id of the node that we will modify.
         * @param {string} name - the name of the pointer to set.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delPointer(path, name, msg) {
            var node = _getNode(path);

            if (node) {
                state.core.delPointer(node, name);
                saveRoot(typeof msg === 'string' ? msg : 'delPointer(' + path + ',' + name + ')');
            }
        }

        // Mixed argument methods - START
        /**
         * @description Add a new member node to the given set of the
         * specified node.
         * @function addMember
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} memberPath - the path/id of the member node.
         * @param {string} setId - the name of the set to expand.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function addMember(path, memberPath, setId, msg) {
            // FIXME: This will have to break due to switched arguments
            var node = _getNode(path),
                memberNode = _getNode(memberPath);

            if (node && memberNode) {
                state.core.addMember(node, setId, memberNode);
                saveRoot(typeof msg === 'string' ? msg : 'addMember(' + path + ',' + memberPath + ',' + setId + ')');
            }
        }

        /**
         * @description Removes a member node from the given set of the
         * specified node.
         * @function removeMember
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} memberPath - the path/id of the member node.
         * @param {string} setId - the name of the set to expand.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function removeMember(path, memberPath, setId, msg) {
            // FIXME: This will have to break due to switched arguments (sort of)
            var node = _getNode(path);

            if (node) {
                state.core.delMember(node, setId, memberPath);
                saveRoot(typeof msg === 'string' ? msg : 'removeMember(' + path + ',' + memberPath + ',' + setId + ')');
            }
        }

        /**
         * @description Set the given attribute value that is connected to the membership 
         * (not the member node, so it only has a meaning in the context of the membership).
         * @function setMemberAttribute
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} memberPath - the path/id of the member node.
         * @param {string} setId - the name of the set where the member exists.
         * @param {string} name - the name of the attribute.
         * @param {object|string|null} value - the value of the attribute.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setMemberAttribute(path, memberPath, setId, name, value, msg) {
            // FIXME: This will have to break due to switched arguments
            var node = _getNode(path);

            if (node) {
                state.core.setMemberAttribute(node, setId, memberPath, name, value);
                saveRoot(typeof msg === 'string' ?
                    msg : 'setMemberAttribute(' + [path, memberPath, setId, name, value].join(',') + ')');
            }
        }

        /**
         * @description Removes the given attribute that is connected to the membership 
         * from the node.
         * @function delMemberAttribute
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} memberPath - the path/id of the member node.
         * @param {string} setId - the name of the set to expand.
         * @param {string} name - the name of the attribute.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delMemberAttribute(path, memberPath, setId, name, msg) {
            // FIXME: This will have to break due to switched arguments
            var node = _getNode(path);

            if (node) {
                state.core.delMemberAttribute(node, setId, memberPath, name);
                saveRoot(typeof msg === 'string' ?
                    msg : 'delMemberAttribute(' + [path, memberPath, setId, name].join(',') + ')');
            }
        }

        /**
         * @description Set the given registry value that is connected to the membership 
         * (not the member node, so it only has a meaning in the context of the membership).
         * @function setMemberRegistry
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} memberPath - the path/id of the member node.
         * @param {string} setId - the name of the set to expand.
         * @param {string} name - the name of the registry.
         * @param {object|string|null} value - the value of the registry.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setMemberRegistry(path, memberPath, setId, name, value, msg) {
            // FIXME: This will have to break due to switched arguments
            var node = _getNode(path);

            if (node) {
                state.core.setMemberRegistry(node, setId, memberPath, name, value);
                saveRoot(typeof msg === 'string' ?
                    msg : 'setMemberRegistry(' + path + ',' + memberPath + ',' + setId + ',' + name + ',' +
                    JSON.stringify(value) + ')');
            }
        }

        /**
         * @description Removes the given registry that is connected to the membership 
         * from the node.
         * @function delMemberRegistry
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} memberPath - the path/id of the member node.
         * @param {string} setId - the name of the set to expand.
         * @param {string} name - the name of the registry.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delMemberRegistry(path, memberPath, setId, name, msg) {
            // FIXME: This will have to break due to switched arguments
            var node = _getNode(path);

            if (node) {
                state.core.delMemberRegistry(node, setId, memberPath, name);
                saveRoot(typeof msg === 'string' ?
                    msg : 'delMemberRegistry(' + path + ',' + memberPath + ',' + setId + ',' + name + ')');
            }
        }

        // Mixed argument methods - END
        /**
         * @description Set the given attribute value of the set of the node 
         * (the value is connected to the node, but only in the context of the set).
         * @function setSetAttribute
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} setName - the name of the set where the member exists.
         * @param {string} attrName - the name of the attribute.
         * @param {object|string|null} attrValue - the value of the attribute.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setSetAttribute(path, setName, attrName, attrValue, msg) {
            var node = _getNode(path);

            if (node) {
                state.core.setSetAttribute(node, setName, attrName, attrValue);
                saveRoot(typeof msg === 'string' ?
                    msg : 'setSetAttribute(' + path + ',' + setName + ',' + attrName + ',' +
                    JSON.stringify(attrValue) + ')');
            }
        }

        /**
         * @description Removes the given attribute that is connected to set of the node.
         * @function delSetAttribute
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} setName - the name of the set to change.
         * @param {string} attrName - the name of the attribute.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delSetAttribute(path, setName, attrName, msg) {
            var node = _getNode(path);

            if (node) {
                state.core.delSetAttribute(node, setName, attrName);
                saveRoot(typeof msg === 'string' ?
                    msg : 'delSetAttribute(' + path + ',' + setName + ',' + attrName + ')');
            }
        }

        /**
         * @description Set the given registry value of the set of the node 
         * (the value is connected to the node, but only in the context of the set).
         * @function setSetRegistry
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} setName - the name of the set where the member exists.
         * @param {string} regName - the name of the registry.
         * @param {object|string|null} regValue - the value of the registry.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setSetRegistry(path, setName, regName, regValue, msg) {
            var node = _getNode(path);

            if (node) {
                state.core.setSetRegistry(node, setName, regName, regValue);
                saveRoot(typeof msg === 'string' ?
                    msg : 'setSetRegistry(' + [path, setName, regName, JSON.stringify(regValue)].join(',') + ')');
            }
        }

        /**
         * @description Removes the given registry that is connected to set of the node.
         * @function delSetRegistry
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} setName - the name of the set to change.
         * @param {string} attrName - the name of the registry.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delSetRegistry(path, setName, regName, msg) {
            var node = _getNode(path);

            if (node) {
                state.core.delSetRegistry(node, setName, regName);
                saveRoot(typeof msg === 'string' ?
                    msg : 'delSetRegistry(' + path + ',' + setName + ',' + regName + ')');
            }
        }

        /**
         * @description Creates a set that belongs to the node.
         * @function createSet
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} setId - the name of the set.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function createSet(path, setId, msg) {
            var node = _getNode(path);

            if (node) {
                state.core.createSet(node, setId);
                saveRoot(typeof msg === 'string' ? msg : 'createSet(' + path + ',' + setId + ')');
            }
        }

        /**
         * @description Removes a set that belongs to the node.
         * @function delSet
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} setId - the name of the set.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delSet(path, setId, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.delSet(node, setId);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delSet(' + path + ',' + setId + ')');
            }
        }

        /**
         * @description Changes the prototype node of the node.
         * This function should only be used with care!
         * @function setBase
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} basePath - the path/id of the new prototype node.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setBase(path, basePath, msg) {
            var node = _getNode(path),
                baseNode = _getNode(basePath),
                error;

            if (node && baseNode) {
                error = state.core.setBase(node, baseNode);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'setBase(' + path + ',' + basePath + ')');
            }
        }

        /**
         * @description Moves a node into a new container.
         * @function moveNode
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} parentPath - the path/id of the new container node.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function moveNode(path, parentPath, msg) {
            var node = _getNode(path),
                parentNode = _getNode(parentPath),
                movedPath;

            if (node && parentNode) {
                movedPath = storeNode(state.core.moveNode(node, parentNode));
                saveRoot(typeof msg === 'string' ? msg : 'moveNode(' + path + ',' + parentPath + ')');
            }

            return movedPath;
        }

        /**
         * @description Removes teh prototype ofd the node. Do not use this function
         * as it is very dangerous!
         * @function delBase
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delBase(path, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.setBase(node, null);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delBase(' + path + ')');
            }
        }

        // META functions
        /**
         * @description Returns the JSON based meta description of the node.
         * @function getMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function getMeta(path) {
            var node = _getNode(path),
                meta = {children: {}, attributes: {}, pointers: {}, aspects: {}};

            if (!node) {
                return null;
            }

            meta = state.core.getJsonMeta(node);

            return meta;
        }

        /**
         * @description Set all the meta rules of a node based on a JSON.
         * It has no effect on the inherited rules!
         * @function setMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {object} meta - the directory of rules to be set.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setMeta(path, meta, msg) {
            var node = _getNode(path),
                otherNode,
                name,
                i,
                error;

            if (node) {
                state.core.clearMetaRules(node);

                //children
                if (meta.children && meta.children.items && meta.children.items.length > 0) {
                    error = state.core.setChildrenMetaLimits(node, meta.children.min, meta.children.max);
                    if (error instanceof Error) {
                        printCoreError(error);
                        return;
                    }

                    for (i = 0; i < meta.children.items.length; i += 1) {
                        otherNode = _getNode(meta.children.items[i]);
                        if (otherNode) {
                            error = state.core.setChildMeta(node,
                                otherNode,
                                meta.children.minItems[i],
                                meta.children.maxItems[i]);

                            if (error instanceof Error) {
                                printCoreError(error);
                                return;
                            }
                        }
                    }
                }

                //attributes
                if (meta.attributes) {
                    for (i in meta.attributes) {
                        error = state.core.setAttributeMeta(node, i, meta.attributes[i]);
                        if (error instanceof Error) {
                            printCoreError(error);
                            return;
                        }
                    }
                }

                //pointers and sets
                if (meta.pointers) {
                    for (name in meta.pointers) {
                        if (meta.pointers[name].items && meta.pointers[name].items.length > 0) {
                            error = state.core.setPointerMetaLimits(node,
                                name,
                                meta.pointers[name].min,
                                meta.pointers[name].max);

                            if (error instanceof Error) {
                                printCoreError(error);
                                return;
                            }

                            for (i = 0; i < meta.pointers[name].items.length; i += 1) {
                                otherNode = _getNode(meta.pointers[name].items[i]);
                                if (otherNode) {
                                    error = state.core.setPointerMetaTarget(node,
                                        name,
                                        otherNode,
                                        meta.pointers[name].minItems[i],
                                        meta.pointers[name].maxItems[i]);
                                    if (error instanceof Error) {
                                        printCoreError(error);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }

                //aspects
                if (meta.aspects) {
                    for (name in meta.aspects) {
                        for (i = 0; i < meta.aspects[name].length; i += 1) {
                            otherNode = _getNode(meta.aspects[name][i]);
                            if (otherNode) {
                                error = state.core.setAspectMetaTarget(node, name, otherNode);
                                if (error instanceof Error) {
                                    printCoreError(error);
                                    return;
                                }
                            }
                        }
                    }
                }

                //constraints
                if (meta.constraints) {
                    for (name in meta.constraints) {
                        if (typeof meta.constraints[name] === 'object') {
                            error = state.core.setConstraint(node, name, meta.constraints[name]);
                            if (error instanceof Error) {
                                printCoreError(error);
                                return;
                            }
                        }
                    }
                }

                saveRoot(typeof msg === 'string' ? msg : 'setMeta(' + path + ')');
            }
        }

        /**
         * @description Removes all Meta rules from the node (does not have effect on the inherited rules).
         * @function clearMetaRules
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function clearMetaRules(path, msg) {
            var node = _getNode(path);

            if (node) {
                state.core.clearMetaRules(node);

                saveRoot(typeof msg === 'string' ? msg : 'clearMetaRules(' + path + ')');
            }
        }

        /**
         * @description Creates a mixin connection to the node.
         * @function addMixin
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} addMixin - the path/id of the mixin node.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function addMixin(path, mixinPath, msg) {
            var error,
                node = _getNode(path);

            if (node) {
                error = state.core.addMixin(node, mixinPath);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'addMixin(' + path + ',' + mixinPath + ')');
            }
        }

        /**
         * @description Removes a mixin connection from the node.
         * @function delMixin
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} addMixin - the path/id of the mixin node.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delMixin(path, mixinPath, msg) {
            var error,
                node = _getNode(path);

            if (node) {
                error = state.core.delMixin(node, mixinPath);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delMixin(' + path + ',' + mixinPath + ')');
            }
        }

        //TODO add function description
        function setChildrenMetaAttribute(path, attrName, value, msg) {
            if (attrName !== 'items') {
                var rawMeta = getMeta(path);
                rawMeta.children[attrName] = value;
                setMeta(path, rawMeta, msg);
            }
        }

        /**
         * @description Creates a containment rule for the node.
         * @function setChildMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} childPath - the path/id of the child node.
         * @param {number} min - the minimum allowed number of children of this type.
         * -1 means that there is no lower limit.
         * @param {number} max - the maximum allowed number of children of this type.
         * -1 ,eams there is no upper limit.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setChildMeta(path, childPath, min, max, msg) {
            var node = _getNode(path),
                childNode = _getNode(childPath),
                error;

            if (childNode && node) {
                error = state.core.setChildMeta(node, childNode, min, max);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'setChildMeta(' + path + ',' + childPath + ',' +
                    (min || -1) + ',' + (max || -1) + ')');
            }
        }

        /**
         * @example
         *
         * client.setChildMeta(
         *   '/a/b/c',
         *   {
         *     min: 0,
         *     max: 10,
         *     items:[
         *       { id: 'a/b/dd',
         *       min: 0,
         *       max: 1 },
         *       { id: 'a/b/ee',
         *       min: 4,
         *       max: 10 },
         *     ]
         *   },
         *   'Adding containment rules to the node and setting global cardinality.');
         *
         * @description Creates multiple containment rules for the node.
         * @function setChildMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {object} meta - the collection of containment rules.
         * @param {object[]} meta.items - array of containment rules with child 
         * type identification and cardinality rules.
         * @param {string} meta.items[i].id - the path/id of the child.
         * @param {string} meta.items[i].min - the lower bound of the cardinality for the given child type.
         * @param {string} meta.items[i].max - the upper bound of the cardinality for the given child type.
         * @param {number} [meta.min] - global lower limit on the number of children of the node.
         * @param {number} [meta.min] - global lower limit on the number of children of the node.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setChildrenMeta(path, meta, msg) {
            var node = _getNode(path),
                target,
                error,
                i;

            if (meta && meta.items && node) {
                for (i = 0; i < meta.items.length; i += 1) {
                    target = _getNode(meta.items[i].id);
                    if (target) {
                        error = state.core.setChildMeta(node, target, meta.items[i].min, meta.items[i].max);
                        if (error instanceof Error) {
                            printCoreError(error);
                            return;
                        }
                    }
                }

                error = state.core.setChildrenMetaLimits(node, meta.min, meta.max);

                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'Meta.setChildrenMeta(' + path + ')');
            }
        }

        /**
         * @description Removes a containment rule from the node.
         * @function delChildMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} typeId - the path/id of the child node.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delChildMeta(path, typeId, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.delChildMeta(node, typeId);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delChildMeta(' + path + ', ' + typeId + ')');
            }
        }

        /**
         * @description Creates an attribute meta rule for the node.
         * @function setAttributeMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the attribute.
         * @param {object} schema - the description of the attribute rule.
         * @param {'string'|'integer'|'float'|'boolean'|'asset'} schema.type - 
         * the type of the attribute.
         * @param {string[]} [enum] - valid choices if the attrubite is an enumeration.
         * @param {string|number|boolean} [default] - the default value of the attribute.
         * @param {boolean} multiline - shows if the string attribute is a multiline one
         * and should be edited in a code-editor style.
         * @param {string} multilineType - show the style of the multiline 
         * (c, js, java, ...). helps in functions like syntax highlighting.
         * @param {boolean} isPassword - shows if the attribute should be handled
         * sensitively on the UI.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setAttributeMeta(path, name, schema, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.setAttributeMeta(node, name, schema);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'setAttributeMeta(' + path + ', ' + name + ')');
            }
        }

        /**
         * @description Removes an attribute rule from the node.
         * @function delAttributeMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the attribute.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delAttributeMeta(path, name, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.delAttributeMeta(node, name);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delAttributeMeta(' + path + ', ' + name + ')');
            }
        }

        /**
         * @description Add a potential target/member to a pointer/set rule.
         * @function setPointerMetaTarget
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the pointer/set.
         * @param {string} targetPath - the path/id of the new pointer target/member.
         * @param {integer} min - the lower bound of the cardinality of the rule 
         * (for pointer it should be always 0).
         * @param {integer} max - the upper bound of the cardinality of the rule 
         * (for pointer it should be always 1).
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setPointerMetaTarget(path, name, targetPath, min, max, msg) {
            var node = _getNode(path),
                targetNode = _getNode(targetPath),
                error;

            if (node && targetNode) {
                error = state.core.setPointerMetaTarget(node, name, targetNode, min, max);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'setPointerMetaTarget(' +
                    [path, name, targetPath, min || -1, max || -1].join(',') + ')');
            }
        }

        /**
         * @description Moves a potential target/member to a pointer/set rule from another.
         * @function movePointerMetaTarget
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the pointer/set.
         * @param {string} targetPath - the path/id of the pointer target/member.
         * @param {string} oldName - the name of the current pointer rule.
         * @param {integer} newName - the name of the new pointer/set rule.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function movePointerMetaTarget(path, targetPath, oldName, newName, msg) {
            var node = _getNode(path),
                targetNode = _getNode(targetPath);

            if (node && targetNode) {
                try {
                    state.core.movePointerMetaTarget(node, targetNode, oldName, newName);
                } catch (err) {
                    printCoreError(err);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'movePointerMetaTarget(' + path + ', ' + targetPath + ',' +
                    oldName + ',' + newName);
            }
        }

        /**
         * @description Removes a target/member from a pointer/set rule.
         * @function delPointerMetaTarget
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the pointer/set.
         * @param {string} targetPath - the path/id of the pointer target/member.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delPointerMetaTarget(path, name, targetPath, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.delPointerMetaTarget(node, name, targetPath);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg :
                    'delPointerMetaTarget(' + path + ', ' + name + ', ' + targetPath + ')');
            }
        }

        /**
         * @description Removes a complete pointer/set rule including all target/member rules.
         * @function delPointerMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the pointer/set.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delPointerMeta(path, name, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.delPointerMeta(node, name);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delPointerMeta(' + path + ', ' + name + ')');
            }
        }

        /**
         * @example
         *
         * client.setPointerMeta(
         *   '/a/b/c',
         *   'myPointer',
         *   {
         *     min: 0,
         *     max: 1,
         *     items:[
         *       { id: 'a/b/dd',
         *       min: 0,
         *       max: 1 },
         *       { id: 'a/b/ee',
         *       min: 0,
         *       max: 1 },
         *     ]
         *   },
         *   'Adding pointer rules to the node.');
         * @example
         * * client.setPointerMeta(
         *   '/a/b/c',
         *   'mySet',
         *   {
         *     items:[
         *       { id: 'a/b/dd'},
         *       { id: 'a/b/ee'},
         *     ]
         *   },
         *   'Adding set rules to the node.');
         *
         * @description Creates a pointer/set meta rule with multiple potential target/member.
         * @function setPointerMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {object} meta - the collection of pointer/set rules.
         * @param {object[]} meta.items - array of target/member rules.
         * @param {string} meta.items[i].id - the path/id of the target/member.
         * @param {string} meta.items[i].min - the lower bound of the cardinality for the given target/member.
         * @param {string} meta.items[i].max - the upper bound of the cardinality for the given target/member.
         * @param {number} [meta.min] - global lower limit on the number of target/member of the node.
         * should be 0 for pointer!
         * @param {number} [meta.max] - global upper limit on the number of target/member of the node.
         * should be 1 for pointer!
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setPointerMeta(path, name, meta, msg) {
            var node = _getNode(path),
                target,
                error,
                i;

            if (meta && meta.items && node) {
                for (i = 0; i < meta.items.length; i += 1) {
                    target = _getNode(meta.items[i].id);
                    if (target) {
                        error = state.core.setPointerMetaTarget(node,
                            name,
                            target,
                            meta.items[i].min,
                            meta.items[i].max);

                        if (error instanceof Error) {
                            printCoreError(error);
                            return;
                        }
                    }
                }

                error = state.core.setPointerMetaLimits(node, name, meta.min, meta.max);

                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'setPointerMeta(' + path + ', ' + name + ')');
            }
        }

        /**
         * @description Creates/extends an aspect rule set (filtered contaiment).
         * @function setAspectMetaTarget
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the aspect.
         * @param {string} targetPath - the path/id of the new member.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setAspectMetaTarget(path, name, targetPath, msg) {
            var node = _getNode(path),
                targetNode = _getNode(targetPath),
                error;

            if (node && targetNode) {
                error = state.core.setAspectMetaTarget(node, name, targetNode);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ?
                    msg : 'setAspectMetaTarget(' + path + ', ' + name + ',' + targetPath + ')');
            }
        }

        /**
         * @description Removes an element from an aspect rule set (filtered contaiment).
         * @function delAspectMetaTarget
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the aspect.
         * @param {string} targetPath - the path/id of the member.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delAspectMetaTarget(path, name, targetPath, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.delAspectMetaTarget(node, name, targetPath);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delAspectMeta(' + path + ', ' + name + ')');
            }
        }

        /**
         * @description Creates/extends an aspect rule set (filtered contaiment) 
         * with multiple new targets.
         * @function setAspectMetaTargets
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the aspect.
         * @param {string[]} targetPaths - array of path/id of the new members.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function setAspectMetaTargets(path, name, targetPaths, msg) {
            var node = _getNode(path),
                i,
                target,
                error;

            if (node) {
                error = state.core.delAspectMeta(node, name);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                for (i = 0; i < targetPaths.length; i += 1) {
                    target = _getNode(targetPaths[i]);
                    if (target) {
                        error = state.core.setAspectMetaTarget(node, name, target);
                        if (error instanceof Error) {
                            printCoreError(error);
                            return;
                        }
                    }
                }

                saveRoot(typeof msg === 'string' ? msg :
                    'setAspectMetaTargets(' + path + ', ' + name + ',' + JSON.stringify(targetPaths) + ')');
            }
        }

        /**
         * @description Removes a complete aspect rule set (filtered contaiment).
         * @function delAspectMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node that will be modified.
         * @param {string} name - the name of the aspect.
         * @param {string} [msg] - optional commit message, if not supplied a default one with the 
         * function name and input parameters will be used
         * @instance
         */
        function delAspectMeta(path, name, msg) {
            var node = _getNode(path),
                error;

            if (node) {
                error = state.core.delAspectMeta(node, name);
                if (error instanceof Error) {
                    printCoreError(error);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'delAspectMeta(' + path + ', ' + name + ')');
            }
        }

        /**
         * @description Check if the given node is an instance of the type node.
         * All participant nodes have to be loaded to the client
         * @function isTypeOf
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @param {string} typePath - the path/id of the type node.
         * @returns {boolean} - true if the node inherits from the type node, false otherwise 
         * (or if one of the nodes is not accessible).
         * @instance
         */
        function isTypeOf(path, typePath) {
            var node = _getNode(path);

            if (node) {
                return state.core.isTypeOf(node, typePath);
            }

            return false;
        }

        /**
         * @description Check if the given node is valid target for the pointer of the other node.
         * All participant nodes have to be loaded to the client
         * @function isValidTarget
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node that hold the pointer rule 
         * (the source of the pointer).
         * @param {string} name - the name of the pointer to check.
         * @param {string} targetPath - the path/id of the target node.
         * @returns {boolean} - true if the target node is a valid target for 
         * the pointer of the node, false otherwise 
         * (or if one of the nodes is not accessible).
         * @instance
         */
        function isValidTarget(path, name, targetPath) {
            var node = _getNode(path),
                target = _getNode(targetPath);

            if (node && target) {
                return state.core.isValidTargetOf(target, node, name);
            }

            return false;
        }

        /**
         * @description Filters out potential pointer targets based on wether they 
         * would be valid targets.
         * All participant nodes have to be loaded to the client
         * @function filterValidTarget
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node that hold the pointer rule 
         * (the source of the pointer).
         * @param {string} name - the name of the pointer to check.
         * @param {string[]} paths - the path/id of the target nodes.
         * @returns {string[]} - list of path/id of valid target nodes.
         * @instance
         */
        function filterValidTarget(path, name, paths) {
            var targets = [];

            for (var i = 0; i < paths.length; i++) {
                if (isValidTarget(path, name, paths[i])) {
                    targets.push(paths[i]);
                }
            }

            return targets;
        }

        /**
         * @description Collects the meta node ids, that can be instantiated for a 
         * valid target of the given pointer of the node.
         * All participant nodes have to be loaded to the client
         * @function getValidTargetTypes
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node that hold the pointer rule 
         * (the source of the pointer).
         * @param {string} name - the name of the pointer to check.
         * @returns {string[]} - list of path/id of valid target meta-nodes.
         * @instance
         */
        function getValidTargetTypes(path, name) {
            var node = _getNode(path),
                meta, i,
                targets = [];

            if (node) {
                meta = state.core.getPointerMeta(node, name);

                for (i in meta) {
                    if (i !== 'min' && i !== 'max') {
                        targets.push(i);
                    }
                }
            }

            return targets;
        }

        /**
         * @description Collects the meta node ids, that can be instantiated for a 
         * valid target of the given pointer of the node. Additionaly it filters out those
         * that only valid due to inherioted rules.
         * All participant nodes have to be loaded to the client
         * @function getOwnValidTargetTypes
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node that hold the pointer rule 
         * (the source of the pointer).
         * @param {string} name - the name of the pointer to check.
         * @returns {string[]} - list of path/id of valid target meta-nodes.
         * @instance
         */
        function getOwnValidTargetTypes(path, name) {
            var node = _getNode(path),
                ownMeta;

            if (node) {
                ownMeta = state.core.getOwnJsonMeta(node);
                ownMeta.pointers = ownMeta.pointers || {};
                ownMeta.pointers[name] = ownMeta.pointers[name] || {};

                return ownMeta.pointers[name].items || [];
            }

            return [];
        }

        function _getValidTargetItems(path, name, ownOnly) {
            var node = _getNode(path),
                meta,
                paths,
                items = [],
                i;

            if (node) {
                meta = state.core.getPointerMeta(node, name);
                paths = ownOnly ? state.core.getOwnJsonMeta(node) : state.core.getJsonMeta(node);
                if (paths && paths.pointers && paths.pointers[name]) {
                    paths = paths.pointers[name].items || [];
                } else {
                    paths = [];
                }

                if (meta && paths.length > 0) {
                    delete meta.min;
                    delete meta.max;
                    for (i in meta) {
                        if (paths.indexOf(i) !== -1) {
                            items.push({
                                id: i,
                                min: meta[i].min === -1 ? undefined : meta[i].min,
                                max: meta[i].max === -1 ? undefined : meta[i].max
                            });
                        }
                    }

                    return items;
                }
            }

            return null;
        }

        /**
         * @description Identical to [getValidTargetTypes]{@link Client#getValidTargetTypes}.
         * @function getValidTargetItems
         * @memberOf Client
         * @instance
         */
        function getValidTargetItems(path, name) {
            return _getValidTargetItems(path, name, false);
        }

        /**
         * @description Identical to [getOwnValidTargetTypes]{@link Client#getOwnValidTargetTypes}.
         * @function getOwnValidTargetItems
         * @memberOf Client
         * @instance
         */
        function getOwnValidTargetItems(path, name) {
            return _getValidTargetItems(path, name, true);
        }

        /**
         * @description Checks if the node would be a valid child of the given parent.
         * All participant nodes have to be loaded to the client
         * @function getValidChildrenTypes
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} parentPath - the path/id of the parent node.
         * @param {string} path - the path/id of the node.
         * @returns {boolean} - true if the node would be a valid child of the parent, 
         * false otherwise (or if any of the nodes is missing).
         * @instance
         */
        function isValidChild(parentPath, path) {
            var node = _getNode(path),
                parentNode = _getNode(parentPath);

            if (node && parentNode) {
                return state.core.isValidChildOf(node, parentNode);
            }

            return false;
        }

        /**
         * @description Collects the meta node ids, that can be instantiated for a 
         * valid child of the given node.
         * All participant nodes have to be loaded to the client
         * @function getValidChildrenTypes
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @returns {string[]} - list of path/id of valid target meta-nodes.
         * @instance
         */
        function getValidChildrenTypes(path) {
            var node = _getNode(path);

            if (node) {
                return state.core.getValidChildrenPaths(node);
            }

            return [];
        }

        /**
         * @description Collects the names of the valid attributes of the node.
         * All participant nodes have to be loaded to the client
         * @function getValidAttributeNames
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @returns {string[]} - list of valid attribute names.
         * @instance
         */
        function getValidAttributeNames(path) {
            var node = _getNode(path);

            if (node) {
                return state.core.getValidAttributeNames(node);
            }

            return [];
        }

        /**
         * @description Collects the names of the valid attributes of the node.
         * Additionally, it filters out those names that are inherited for the node.
         * All participant nodes have to be loaded to the client
         * @function getOwnValidAttributeNames
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @returns {string[]} - list of valid attribute names.
         * @instance
         */
        function getOwnValidAttributeNames(path) {
            var node = _getNode(path);

            if (node) {
                return state.core.getOwnValidAttributeNames(node);
            }

            return [];
        }

        /**
         * @description Collects and returns the meta rules related to a pointer/set of the node.
         * All participant nodes have to be loaded to the client
         * @function getPointerMeta
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node that hold the pointer rule 
         * (the source of the pointer).
         * @param {string} name - the name of the pointer/set.
         * @returns {object} - structured object of the rules related to the pointer/set.
         * @instance
         */
        function getPointerMeta(path, name) {
            var node = _getNode(path),
                meta,
                i,
                pointerMeta;

            if (node) {
                meta = state.core.getPointerMeta(node, name);

                if (meta) {
                    pointerMeta = {min: meta.min, max: meta.max, items: []};

                    for (i in meta) {
                        if (i !== 'min' && i !== 'max') {
                            pointerMeta.items.push({
                                id: i,
                                min: meta[i].min === -1 ? undefined : meta[i].min,
                                max: meta[i].max === -1 ? undefined : meta[i].max
                            });
                        }
                    }

                    return pointerMeta;
                }
            }

            return null;
        }

        /**
         * @description Collects and returns the meta rules related to an attribute of the node.
         * All participant nodes have to be loaded to the client
         * @function getAttributeSchema
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @param {string} name - the name of the attribute.
         * @returns {object} - structured collection of the rules of the attribute.
         * @instance
         */
        function getAttributeSchema(path, name) {
            var node = _getNode(path);

            if (node) {
                return state.core.getAttributeMeta(node, name);
            }

            return;
        }

        /**
         * @description Collect and returns a list of aspects defined for the node.
         * All participant nodes have to be loaded to the client
         * @function getMetaAspectNames
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @returns {string[]} - list of valid aspect names.
         * @instance
         */
        function getMetaAspectNames(path) {
            var node = _getNode(path);

            if (node) {
                return state.core.getValidAspectNames(node);
            }

            return [];
        }

        /**
         * @description Collect and returns a list of aspects defined for the node.
         * Additionally, it filters out those aspects that are inherited for the node.
         * All participant nodes have to be loaded to the client
         * @function getOwnMetaAspectNames
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @returns {string[]} - list of valid aspect names.
         * @instance
         */
        function getOwnMetaAspectNames(path) {
            var node = _getNode(path);

            if (node) {
                return state.core.getOwnValidAspectNames(node);
            }

            return [];
        }

        /**
         * @description Collects and returns the meta rules related to an aspect of the node.
         * All participant nodes have to be loaded to the client
         * @function getMetaAspect
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @param {string} name - the name of the aspect.
         * @returns {object} - structured collection of the rules of the aspect.
         * @instance
         */
        function getMetaAspect(path, name) {
            var node = _getNode(path),
                meta;

            if (node) {
                meta = state.core.getAspectMeta(node, name);

                if (meta) {
                    return {items: meta};
                }
            }

            return null;
        }

        /**
         * @description Checks if the node has meta rules of its own (not inherited).
         * All participant nodes have to be loaded to the client
         * @function hasOwnMetaRules
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @param {string} name - the name of the aspect.
         * @returns {boolean} - true if the node has some rule of its own, 
         * false if it only has inherited rules.
         * @instance
         */
        function hasOwnMetaRules(path) {
            var node = _getNode(path),
                ownMeta, key;

            if (node) {
                ownMeta = state.core.getOwnJsonMeta(node);

                //children
                if (ownMeta.children && ownMeta.children.items && ownMeta.children.items.length > 0) {
                    return true;
                }

                //pointers
                for (key in ownMeta.pointers || {}) {
                    return true;
                }

                //attributes
                for (key in ownMeta.attributes || {}) {
                    return true;
                }
                //aspects
                for (key in ownMeta.aspects || {}) {
                    return true;
                }

                //mixins
                if (ownMeta.mixins && ownMeta.mixins.length > 0) {
                    return true;
                }
            }

            return false;
        }

        /**
         * @description Collects and returns the meta rules related to containment of the node.
         * All participant nodes have to be loaded to the client
         * @see For reference check the correspondent 
         * Core function [getChildrenMeta]{@link Core#getChildrenMeta}
         * @function getChildrenMeta
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @returns {object} - structured collection of the rules of the containment.
         * @instance
         */
        function getChildrenMeta(path) {
            //the returned object structure is : {'min':0,'max':0,'items':[{'id':path,'min':0,'max':0},...]}
            var node = _getNode(path),
                meta, i,
                childrenMeta = {items: []};

            if (node) {
                meta = state.core.getChildrenMeta(node);
                if (meta) {
                    childrenMeta = {min: meta.min, max: meta.max, items: []};
                    for (i in meta) {
                        if (i !== 'min' && i !== 'max') {
                            childrenMeta.items.push({
                                id: i,
                                min: meta[i].min === -1 ? undefined : meta[i].min,
                                max: meta[i].max === -1 ? undefined : meta[i].max
                            });
                        }
                    }
                }

                return childrenMeta;
            }

            return null;
        }

        //FIXME: what is this?
        function getChildrenMetaAttribute(path/*, attrName*/) {
            var childrenMeta = getChildrenMeta(path);
            if (childrenMeta) {
                return childrenMeta.attrName;
            }
            return null;
        }

        /**
         * @description Collects and returns the list of containment rules of the node.
         * All participant nodes have to be loaded to the client
         * @function getValidChildrenItems
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @returns {object} - structured collection of children types of the 
         * containment with cardinality information.
         * @instance
         */
        function getValidChildrenItems(path) {
            var childrenMeta = getChildrenMeta(path);
            if (childrenMeta) {
                return childrenMeta.items;
            }
            return null;
        }

        /**
         * @description Collects and returns the list of containment rules of the node.
         * Additionally the list filters out elements that are inherited.
         * All participant nodes have to be loaded to the client
         * @function getOwnValidChildrenTypes
         * @memberOf Client
         * @deprecated The function provided in GMENode class should be used! 
         * (this one will be removed at the next major release)
         * @param {string} path - the path/id of the node.
         * @returns {object} - structured collection of children types of the 
         * containment with cardinality information.
         * @instance
         */
        function getOwnValidChildrenTypes(path) {
            var node = _getNode(path),
                ownMeta;

            if (node) {
                ownMeta = state.core.getOwnJsonMeta(node);

                if (ownMeta && ownMeta.children && ownMeta.children.items) {
                    return ownMeta.children.items;
                }
            }

            return [];
        }

        /**
         * @description Returns a client pattern that covers the given aspect of the node.
         * All participant nodes have to be loaded to the client
         * @function getAspectTerritoryPattern
         * @memberOf Client
         * @param {string} path - the path/id of the node.
         * @param {string} name - the name of the aspect.
         * @returns {object} - object representing the client territory
         * @instance
         */
        function getAspectTerritoryPattern(path, name) {
            var aspect = getMetaAspect(path, name);

            if (aspect !== null) {
                aspect.children = 1; //TODO now it is fixed, maybe we can change that in the future
                return aspect;
            }
            return null;
        }

        /**
         * @example
         *
         * var nodeCopies1 = client.copyNodes(['/4', '/3'], '');
         * var nodeCopies2 = client.copyNodes('/4', '/3'], '', 'Copied two nodes');
         *
         * @description Copies the given nodes into the parent 
         * (does not enforce meta-rules and requires all participating nodes
         * to be loaded in the client)
         * @see For reference check the correspondent 
         * Core function [copyNodes]{@link Core#copyNodes}
         * @function copyNodes
         * @memberOf Client
         * @param {string[]} paths - array of the ids/paths of the nodes to copy
         * @param {string} parentId - the id/path of the parent where the new copies should be created
         * @param {string} [msg] - optional commit message, if not supplied a default one with 
         * the function name and input
         * parameters will be used
         * @returns {GMENode[]|undefined} - the newly created nodes if all could be copied
         * @instance
         */
        function copyNodes(pathsToCopy, parentPath, msg) {
            var parentNode = _getNode(parentPath),
                copyResult;

            if (parentNode) {
                copyResult = _copyMultipleNodes(pathsToCopy, parentNode, true);

                if (copyResult instanceof Error) {
                    printCoreError(copyResult);
                    return;
                }

                if ((copyResult || []).length !== pathsToCopy.length) {
                    state.logger.error('not all nodes were available - denied -');
                    return;
                }

                saveRoot(msg);
                return copyResult;
            } else {
                state.logger.error('parent cannot be found - denied -');
            }
        }

        /**
         * @description Renames a pointer of the node.
         * Effectively, it moves the target of one pointer to another.
         * All participant nodes have to be loaded to the client
         * @see For reference check the correspondent 
         * Core function [renamePointer]{@link Core#renamePointer}
         * @function renamePointer
         * @memberOf Client
         * @param {string} path - the path/id of the node.
         * @param {string} oldName - the name of the current pointer.
         * @param {string} newName - the name of the new pointer.
         * @param {string} [msg] - optional commit message, if not supplied a default one with 
         * the function name and input
         * parameters will be used
         * @instance
         */
        function renamePointer(path, oldName, newName, msg) {
            var node = _getNode(path);

            if (node) {
                try {
                    state.core.renamePointer(node, oldName, newName);
                } catch (e) {
                    printCoreError(e);
                    return;
                }
                saveRoot(typeof msg === 'string' ? msg : 'renamePointer(' + path + ',' +
                    oldName + ',' + newName);
            }
        }

        /**
         * @description Renames an attribute of the node.
         * Effectively, it moves the value of one attribute to another.
         * All participant nodes have to be loaded to the client
         * @see For reference check the correspondent 
         * Core function [renameAttribute]{@link Core#renameAttribute}
         * @function renameAttribute
         * @memberOf Client
         * @param {string} path - the path/id of the node.
         * @param {string} oldName - the name of the current attribute.
         * @param {string} newName - the name of the new attribute.
         * @param {string} [msg] - optional commit message, if not supplied a default one with 
         * the function name and input
         * parameters will be used
         * @instance
         */
        function renameAttribute(path, oldName, newName, msg) {
            var node = _getNode(path);

            if (node) {
                try {
                    state.core.renameAttribute(node, oldName, newName);
                } catch (e) {
                    printCoreError(e);
                    return;
                }
                saveRoot(typeof msg === 'string' ? msg : 'renameAttribute(' + path + ',' +
                    oldName + ',' + newName);
            }
        }

        /**
         * @description Renames an registry of the node.
         * Effectively, it moves the value of one registry to another.
         * All participant nodes have to be loaded to the client
         * @see For reference check the correspondent 
         * Core function [renameRegistry]{@link Core#renameRegistry}
         * @function renameRegistry
         * @memberOf Client
         * @param {string} path - the path/id of the node.
         * @param {string} oldName - the name of the current registry.
         * @param {string} newName - the name of the new registry.
         * @param {string} [msg] - optional commit message, if not supplied a default one with 
         * the function name and input
         * parameters will be used
         * @instance
         */
        function renameRegistry(path, oldName, newName, msg) {
            var node = _getNode(path);

            if (node) {
                try {
                    state.core.renameRegistry(node, oldName, newName);
                } catch (e) {
                    printCoreError(e);
                    return;
                }
                saveRoot(typeof msg === 'string' ? msg : 'renameRegistry(' + path + ',' +
                    oldName + ',' + newName);
            }
        }

        /**
         * @description Renames a set of the node.
         * Effectively, it moves the members of one set to another.
         * All participant nodes have to be loaded to the client
         * @see For reference check the correspondent 
         * Core function [renameSet]{@link Core#renameSet}
         * @function renameSet
         * @memberOf Client
         * @param {string} path - the path/id of the node.
         * @param {string} oldName - the name of the current set.
         * @param {string} newName - the name of the new set.
         * @param {string} [msg] - optional commit message, if not supplied a default one with 
         * the function name and input
         * parameters will be used
         * @instance
         */
        function renameSet(path, oldName, newName, msg) {
            var node = _getNode(path);

            if (node) {
                try {
                    state.core.renameSet(node, oldName, newName);
                } catch (e) {
                    printCoreError(e);
                    return;
                }
                saveRoot(typeof msg === 'string' ? msg : 'renameSet(' + path + ',' +
                    oldName + ',' + newName);
            }
        }

        /**
         * @description Moves an aspect target rule to a new aspect.
         * All participant nodes have to be loaded to the client
         * @see For reference check the correspondent 
         * Core function [moveAspectMetaTarget]{@link Core#moveAspectMetaTarget}
         * @function moveAspectMetaTarget
         * @memberOf Client
         * @param {string} path - the path/id of the node.
         * @param {string} targetPath - the path/id of the target to be moved.
         * @param {string} oldName - the name of the current aspect.
         * @param {string} newName - the name of the new aspect.
         * @param {string} [msg] - optional commit message, if not supplied a default one with 
         * the function name and input
         * parameters will be used
         * @instance
         */
        function moveAspectMetaTarget(path, targetPath, oldName, newName, msg) {
            var node = _getNode(path),
                targetNode = _getNode(targetPath);

            if (node && targetNode) {
                try {
                    state.core.moveAspectMetaTarget(node, targetNode, oldName, newName);
                } catch (err) {
                    printCoreError(err);
                    return;
                }

                saveRoot(typeof msg === 'string' ? msg : 'moveAspectMetaTarget(' + path + ', ' + targetPath + ',' +
                    oldName + ',' + newName);
            }
        }

        /**
         * @description Moves a set member to a new set.
         * All participant nodes have to be loaded to the client
         * @see For reference check the correspondent 
         * Core function [moveMember]{@link Core#moveMember}
         * @function moveMember
         * @memberOf Client
         * @param {string} path - the path/id of the node.
         * @param {string} memberPath - the path/id of the member to be moved.
         * @param {string} oldSetName - the name of the current set.
         * @param {string} newSetName - the name of the new set.
         * @param {string} [msg] - optional commit message, if not supplied a default one with 
         * the function name and input
         * parameters will be used
         * @instance
         */
        function moveMember(path, memberPath, oldSetName, newSetName, msg) {
            var node = _getNode(path);

            if (node) {
                try {
                    state.core.moveMember(node, memberPath, oldSetName, newSetName);
                } catch (e) {
                    printCoreError(e);
                    return;
                }
                saveRoot(typeof msg === 'string' ? msg : 'moveMember(' + path + ', ' + memberPath + ',' +
                    oldSetName + ',' + newSetName);
            }
        }

        /**
         * @description Renames an attribute meta rule.
         * All participant nodes have to be loaded to the client
         * @see For reference check the correspondent 
         * Core function [renameAttributeMeta]{@link Core#renameAttributeMeta}
         * @function renameAttributeMeta
         * @memberOf Client
         * @param {string} path - the path/id of the node.
         * @param {string} oldName - the name of the current attribute.
         * @param {string} newName - the name of the new attribute.
         * @param {string} [msg] - optional commit message, if not supplied a default one with 
         * the function name and input
         * parameters will be used
         * @instance
         */
        function renameAttributeMeta(path, oldName, newName, msg) {
            var node = _getNode(path);

            if (node) {
                try {
                    state.core.renameAttributeMeta(node, oldName, newName);
                } catch (e) {
                    printCoreError(e);
                    return;
                }
                saveRoot(typeof msg === 'string' ? msg : 'renameAttributeMeta(' + path + ', ' + oldName + ',' +
                    newName + ')');
            }
        }

        return {
            setAttribute: setAttribute,
            setAttributes: function () {
                _logDeprecated('setAttributes', 'setAttribute');
                setAttribute.apply(null, arguments);
            },

            delAttribute: delAttribute,
            delAttributes: function () {
                _logDeprecated('delAttributes', 'delAttribute');
                delAttribute.apply(null, arguments);
            },
            setRegistry: setRegistry,
            delRegistry: delRegistry,

            copyNode: copyNode,
            copyNodes: copyNodes,
            copyMoreNodes: copyMoreNodes,
            moveNode: moveNode,
            moveMoreNodes: moveMoreNodes,
            deleteNode: deleteNode,
            deleteNodes: deleteNodes,
            delMoreNodes: function () {
                _logDeprecated('delMoreNodes', 'deleteNodes');
                deleteNodes.apply(null, arguments);
            },
            createNode: createNode,
            createChild: function (parameters, msg) {
                return createNode(parameters, {
                    registry: {
                        position: parameters.position
                    }
                }, msg);
            },
            createChildren: createChildren,

            setPointer: setPointer,
            makePointer: function () {
                _logDeprecated('makePointer', 'setPointer');
                setPointer.apply(null, arguments);
            },
            delPointer: delPointer,
            deletePointer: delPointer,

            addMember: addMember,
            removeMember: removeMember,
            moveMember: moveMember,
            setMemberAttribute: setMemberAttribute,
            delMemberAttribute: delMemberAttribute,
            setMemberRegistry: setMemberRegistry,
            delMemberRegistry: delMemberRegistry,
            setSetAttribute: setSetAttribute,
            delSetAttribute: delSetAttribute,
            setSetRegistry: setSetRegistry,
            delSetRegistry: delSetRegistry,
            createSet: createSet,
            delSet: delSet,
            deleteSet: delSet,

            setBase: setBase,
            delBase: delBase,

            // --- Meta ---
            setMeta: setMeta,
            clearMetaRules: clearMetaRules,

            // containment
            setChildrenMeta: setChildrenMeta,
            setChildrenMetaAttribute: setChildrenMetaAttribute,
            setChildMeta: setChildMeta,
            updateValidChildrenItem: function (path, newTypeObj, msg) {
                _logDeprecated('updateValidChildrenItem(path, newTypeObj, msg)',
                    'setChildMeta(path, childPath, min, max, msg)');
                newTypeObj = newTypeObj || {};
                setChildMeta(path, newTypeObj.id, newTypeObj.min, newTypeObj.max, msg);
            },

            delChildMeta: delChildMeta,
            removeValidChildrenItem: function () {
                _logDeprecated('removeValidChildrenItem', 'delChildMeta');
                delChildMeta.apply(null, arguments);
            },

            // attribute
            setAttributeMeta: setAttributeMeta,
            setAttributeSchema: function () {
                _logDeprecated('setAttributeSchema', 'setAttributeMeta');
                setAttributeMeta.apply(null, arguments);
            },
            delAttributeMeta: delAttributeMeta,
            removeAttributeSchema: function () {
                _logDeprecated('removeAttributeSchema', 'delAttributeMeta');
                delAttributeMeta.apply(null, arguments);
            },
            renameAttributeMeta: renameAttributeMeta,

            // pointer
            setPointerMeta: setPointerMeta,
            setPointerMetaTarget: setPointerMetaTarget,
            movePointerMetaTarget: movePointerMetaTarget,
            updateValidTargetItem: function (path, name, targetObj, msg) {
                _logDeprecated('updateValidTargetItem(path, name, targetObj, msg)',
                    'setPointerMetaTarget(path, name, targetPath, childPath, min, max, msg)');
                targetObj = targetObj || {};
                setPointerMetaTarget(path, name, targetObj.id, targetObj.min, targetObj.max, msg);
            },

            delPointerMetaTarget: delPointerMetaTarget,
            removeValidTargetItem: function () {
                _logDeprecated('removeValidTargetItem', 'delPointerMetaTarget');
                delPointerMetaTarget.apply(null, arguments);
            },
            delPointerMeta: delPointerMeta,
            deleteMetaPointer: function () {
                _logDeprecated('deleteMetaPointer', 'delPointerMeta');
                delPointerMeta.apply(null, arguments);
            },

            // aspect
            setAspectMetaTarget: setAspectMetaTarget,
            setAspectMetaTargets: setAspectMetaTargets,
            moveAspectMetaTarget: moveAspectMetaTarget,
            setMetaAspect: function () {
                _logDeprecated('setMetaAspect', 'setAspectMetaTargets');
                setAspectMetaTargets.apply(null, arguments);
            },
            delAspectMetaTarget: delAspectMetaTarget,
            delAspectMeta: delAspectMeta,
            deleteMetaAspect: function () {
                _logDeprecated('deleteMetaAspect', 'delAspectMeta');
                delAspectMeta.apply(null, arguments);
            },

            // mixin
            addMixin: addMixin,
            delMixin: delMixin,

            // renames
            renamePointer: renamePointer,
            renameAttribute: renameAttribute,
            renameRegistry: renameRegistry,
            renameSet: renameSet,

            // Deprecated meta-getters
            // TODO: These should be moved to Util/GMEConcepts or removed.
            getMeta: function () {
                _logDeprecated('getMeta(path)', 'getJsonMeta()', true);
                return getMeta.apply(null, arguments);
            },
            isTypeOf: function () {
                //_logDeprecated('isTypeOf(path, typePath)', 'isTypeOf(typePath)', true);
                return isTypeOf.apply(null, arguments);
            },
            isValidTarget: function () {
                _logDeprecated('isValidTarget(path, name, targetPath)', 'isValidTargetOf(sourcePath, name)', true);
                return isValidTarget.apply(null, arguments);
            },
            filterValidTarget: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return filterValidTarget.apply(null, arguments);
            },
            getValidTargetTypes: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getValidTargetTypes.apply(null, arguments);
            },
            getOwnValidTargetTypes: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getOwnValidTargetTypes.apply(null, arguments);
            },
            getValidTargetItems: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getValidTargetItems.apply(null, arguments);
            },
            getOwnValidTargetItems: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getOwnValidTargetItems.apply(null, arguments);
            },
            getPointerMeta: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getPointerMeta.apply(null, arguments);
            },
            isValidChild: function () {
                _logDeprecated('isValidChild(path, childPath)', 'isValidChildOf(parentPath)', true);
                return isValidChild.apply(null, arguments);
            },
            getValidChildrenTypes: function () {
                _logDeprecated('getValidChildrenTypes(path)', 'getValidChildrenIds()', true);
                return getValidChildrenTypes.apply(null, arguments);
            },
            getValidAttributeNames: function () {
                _logDeprecated('getValidAttributeNames(path)', 'getValidAttributeNames()', true);
                return getValidAttributeNames.apply(null, arguments);
            },
            getOwnValidAttributeNames: function () {
                _logDeprecated('getOwnValidAttributeNames(path)', 'getOwnValidAttributeNames()', true);
                return getOwnValidAttributeNames.apply(null, arguments);
            },
            getAttributeSchema: function () {
                _logDeprecated('getAttributeSchema(path, name)', 'getAttributeMeta(name)', true);
                return getAttributeSchema.apply(null, arguments);
            },
            getMetaAspectNames: function () {
                _logDeprecated('getMetaAspectNames(path)', 'getValidAspectNames()', true);
                return getMetaAspectNames.apply(null, arguments);
            },
            getOwnMetaAspectNames: function () {
                _logDeprecated('getOwnMetaAspectNames(path)', 'getOwnValidAspectNames()', true);
                return getOwnMetaAspectNames.apply(null, arguments);
            },
            getMetaAspect: function () {
                _logDeprecated('getMetaAspect(path, name)', 'getAspectMeta(name)', true,
                    ' Returned value is of different structure! {items: meta} vs meta');
                return getMetaAspect.apply(null, arguments);
            },
            hasOwnMetaRules: function () {
                // TODO: Should we add a method on the core??
                return hasOwnMetaRules.apply(null, arguments);
            },
            getChildrenMeta: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getChildrenMeta.apply(null, arguments);
            },
            getChildrenMetaAttribute: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getChildrenMetaAttribute.apply(null, arguments);
            },
            getValidChildrenItems: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getValidChildrenItems.apply(null, arguments);
            },
            getOwnValidChildrenTypes: function () {
                // TODO: Should we add a method on the core similar to getValidChildrenTypes?
                return getOwnValidChildrenTypes.apply(null, arguments);
            },
            getAspectTerritoryPattern: function () {
                // TODO: Should we add a method in GMEConcepts or remove this guy?
                return getAspectTerritoryPattern.apply(null, arguments);
            }
        };
    }

    return gmeNodeSetter;
});
