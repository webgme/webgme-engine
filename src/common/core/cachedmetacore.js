/*globals define*/
/*jshint node: true, browser: true*/

/**
 * @author kecso / https://github.com/kecso
 */

define(['common/util/assert', 'common/core/core', 'common/core/tasync'], function (ASSERT, Core, TASYNC) {
        'use strict';

        var MetaCacheCore = function (oldcore, options) {
            ASSERT(typeof options === 'object');
            ASSERT(typeof options.globConf === 'object');
            ASSERT(typeof options.logger !== 'undefined');
            // copy all operations
            var core = {},
                META_SET_NAME = 'MetaAspectSet',
                logger = options.logger.fork('meta');
            for (var key in oldcore) {
                core[key] = oldcore[key];
            }
            logger.debug('initialized');

            function loadMetaSet(root) {
                var paths = oldcore.getMemberPaths(root, META_SET_NAME),
                    i,
                    metaElements = [];

                for (i = 0; i < paths.length; i += 1) {
                    metaElements.push(oldcore.loadByPath(root, paths[i]));
                }

                return TASYNC.lift(metaElements);
            }

            core.loadRoot = function (hash) {
                return TASYNC.call(function (root) {
                    return TASYNC.call(function (elements) {
                        var i = 0;
                        root.metaElements = {};
                        for (i = 0; i < elements.length; i += 1) {
                            root.metaElements[oldcore.getPath(elements[i])] = elements[i];
                        }
                        return root;
                    }, loadMetaSet(root));
                }, oldcore.loadRoot(hash));
            };

            //functions where the cache may needs to be updated
            core.createNode = function (parameters) {
                var node = oldcore.createNode(parameters);

                if (!parameters || !parameters.parent) {
                    //a root just have been created
                    node.metaElements = {};
                }

                return node;
            };

            core.addMember = function (node, setName, member) {
                var root = core.getRoot(node);
                oldcore.addMember(node, setName, member);

                //check if our cache needs to be updated
                if (setName === META_SET_NAME && core.getPath(node) === core.getPath(root)) {
                    root.metaElements[core.getPath(member)] = member;
                }
            };

            core.delMember = function (node, setName, memberPath) {
                var root = core.getRoot(node);
                oldcore.delMember(node, setName, memberPath);

                //check if our cache needs to be updated
                if (setName === META_SET_NAME && core.getPath(node) === core.getPath(root)) {
                    delete root.metaElements[memberPath];
                }
            };

            core.deleteNode = function (node, technical) {
                var root = core.getRoot(node);
                if (root.metaElements[core.getPath(node)]) {
                    delete root.metaElements[core.getPath(node)];
                }
                oldcore.deleteNode(node, technical);
            };

            core.moveNode = function (node, parent) {
                var root = core.getRoot(node),
                    oldpath = core.getPath(node),
                    moved = oldcore.moveNode(node, parent);

                if (root.metaElements[oldpath]) {
                    delete root.metaElements[oldpath];
                    root.metaElements[core.getPath(moved)] = moved;
                }

                return moved;
            };

            //additional inquiry functions
            core.isMetaNode = function (node) {
                var root = core.getRoot(node);
                if (root.metaElements && root.metaElemens[core.getPath(node)]) {
                    return true;
                }

                return false;
            };

            core.getAllMetaNodes = function (node) {
                var root = core.getRoot(node);

                if (root.metaElements) {
                    return root.metaElements;
                }

                return [];
            };

            core.isAbstract = function (node) {
                return core.getRegistry(node, 'isAbstract') === true;
            };

            core.isConnection = function (node) {
                var validPtrNames = oldcore.getValidPointerNames(node);

                return validPtrNames.indexOf('dst') !== -1 && validPtrNames.indexOf('src') !== -1;
            };

            function sensitiveFilter(validNodes) {
                var i;

                i = validNodes.length;
                while (i--) {
                    if (core.isConnection(validNodes[i]) || core.isAbstract(validNodes[i])) {
                        validNodes.splice(i, 1);
                    }
                }
            }

            //parameters
            // node - the node in question
            // children - the current children of the node, so that multiplicity can be checked
            // sensitive - if true the function do not return the connection and abstract types
            // multiplicity - if true the function filters out possibilities that fail multiplicity check
            // aspect - if given the function also filters out valid children type meta nodes based on aspect rule
            core.getValidChildrenMetaNodes = function (parameters) {
                console.time('GVCMN');
                console.time('GVCMN-0');
                var validNodes = [],
                    node = parameters.node,
                    metaNodes = core.getRoot(node).metaElements,
                    keys = Object.keys(metaNodes || {}),
                    i, j,
                    typeCounters = {},
                    children = parameters.children || [],
                    rules,
                    inAspect,
                    temp;

                console.timeEnd('GVCMN-0');


                console.time('GVCMN-R');
                rules = oldcore.getChildrenMeta(node) || {};
                console.timeEnd('GVCMN-R');
                console.time('GVCMN-1');
                for (i = 0; i < keys.length; i += 1) {
                    temp = metaNodes[keys[i]];
                    while (temp) {
                        if (rules[oldcore.getPath(temp)]) {
                            validNodes.push(metaNodes[keys[i]]);
                            break;
                        }
                        temp = oldcore.getBase(temp);
                    }
                    //if (core.isValidChildOf(metaNodes[keys[i]], node)) {
                    //    validNodes.push(metaNodes[keys[i]]);
                    //}
                }
                console.timeEnd('GVCMN-1');

                //before every next step we check if we still have potential nodes
                if (validNodes.length === 0) {
                    return validNodes;
                }

                console.time('GVCMN-2');
                if (parameters.sensitive === true) {
                    sensitiveFilter(validNodes);
                }
                console.timeEnd('GVCMN-2');
                //before every next step we check if we still have potential nodes
                if (validNodes.length === 0) {
                    return validNodes;
                }

                console.time('GVCMN-3');
                if (parameters.multiplicity === true) {
                    if (rules.max && rules.max > -1 && oldcore.getChildrenRelids(node).length >= rules.max) {
                        validNodes = [];
                        return validNodes;
                    }
                    if (children.length === 0) {
                        return validNodes; //we cannot check type-multiplicity without children
                    }

                    delete rules.max;
                    delete rules.min;

                    //we need to clear nodes that are not on the meta sheet
                    // and we have to initialize the counters
                    keys = Object.keys(rules);
                    for (i = 0; i < keys.length; i += 1) {
                        if (!metaNodes[keys[i]]) {
                            delete rules[keys[i]];
                        } else {
                            typeCounters[keys[i]] = 0;
                        }
                    }

                    keys = Object.keys(rules);
                    for (i = 0; i < children.length; i += 1) {
                        for (j = 0; j < keys.length; j += 1) {
                            if (oldcore.isTypeOf(children[i], metaNodes[keys[j]])) {
                                typeCounters[keys[j]] += 1;
                            }
                        }
                    }

                    i = validNodes.length;
                    keys = Object.keys(typeCounters);
                    while (i--) {
                        for (j = 0; j < keys.length; j += 1) {
                            if (rules[keys[j]].max &&
                                rules[keys[j]].max > -1 &&
                                rules[keys[j]].max <= typeCounters[keys[j]] &&
                                oldcore.isTypeOf(validNodes[i], metaNodes[keys[j]])) {
                                validNodes.splice(i, 1);
                                break;
                            }
                        }
                    }
                }
                console.timeEnd('GVCMN-3');
                //before every next step we check if we still have potential nodes
                if (validNodes.length === 0) {
                    return validNodes;
                }

                console.time('GVCMN-4');
                if (parameters.aspect) {
                    keys = oldcore.getAspectMeta(node, parameters.aspect);
                    i = validNodes.length;

                    while (i--) {
                        inAspect = false;
                        for (j = 0; j < keys.length; j += 1) {
                            if (oldcore.isTypeOf(validNodes[i], metaNodes[keys[j]])) {
                                inAspect = true;
                                break;
                            }
                        }
                        if (!inAspect) {
                            validNodes.splice(i, 1);
                        }
                    }
                }
                console.timeEnd('GVCMN-4');

                console.timeEnd('GVCMN');
                return validNodes;
            };

            //parameters
            // node - the node in question
            // name - the name of the set
            // members - the current members of the set, so that multiplicity can be checked
            // sensitive - if true the function do not return the connection and abstract types
            // multiplicity - if true the function filters out possibilities that fail multiplicity check
            core.getValidSetElementsMetaNodes = function (parameters) {
                var validNodes = [],
                    node = parameters.node,
                    metaNodes = core.getRoot(node).metaElements,
                    keys = Object.keys(metaNodes || {}),
                    i, j,
                    typeCounters = {},
                    members = parameters.members || [],
                    rules = core.getPointerMeta(node, parameters.name) || {},
                    inAspect,
                    temp;

                for (i = 0; i < keys.length; i += 1) {
                    temp = metaNodes[keys[i]];
                    while (temp) {
                        if (rules[oldcore.getPath(temp)]) {
                            validNodes.push(metaNodes[keys[i]]);
                            break;
                        }
                        temp = oldcore.getBase(temp);
                    }
                }

                //before every next step we check if we still have potential nodes
                if (validNodes.length === 0) {
                    return validNodes;
                }

                if (parameters.sensitive === true) {
                    sensitiveFilter(validNodes);
                }

                //before every next step we check if we still have potential nodes
                if (validNodes.length === 0) {
                    return validNodes;
                }

                if (parameters.multiplicity === true) {
                    if (rules.max && rules.max > -1 && oldcore.getMemberPaths(node).length >= rules.max) {
                        validNodes = [];
                        return validNodes;
                    }

                    if (members.length === 0) {
                        return validNodes; //we cannot check type-multiplicity without children
                    }

                    delete rules.max;
                    delete rules.min;

                    //we need to clear nodes that are not on the meta sheet
                    // and we have to initialize the counters
                    keys = Object.keys(rules);
                    for (i = 0; i < keys.length; i += 1) {
                        if (!metaNodes[keys[i]]) {
                            delete rules[keys[i]];
                        } else {
                            typeCounters[keys[i]] = 0;
                        }
                    }

                    keys = Object.keys(rules);
                    for (i = 0; i < members.length; i += 1) {
                        for (j = 0; j < keys.length; j += 1) {
                            if (oldcore.isTypeOf(members[i], metaNodes[keys[j]])) {
                                typeCounters[keys[j]] += 1;
                            }
                        }
                    }

                    i = validNodes.length;
                    keys = Object.keys(typeCounters);
                    while (i--) {
                        for (j = 0; j < keys.length; j += 1) {
                            if (rules[keys[j]].max &&
                                rules[keys[j]].max > -1 &&
                                rules[keys[j]].max <= typeCounters[keys[j]] &&
                                oldcore.isTypeOf(validNodes[i], metaNodes[keys[j]])) {
                                validNodes.splice(i, 1);
                                break;
                            }
                        }
                    }
                }

                return validNodes;
            };
            return core;
        };

        return MetaCacheCore;
    }
)
;