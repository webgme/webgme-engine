/*globals define*/
/*eslint-env node, browser*/
/**
 * This class (extracted functionality from cache implemented by mmaroti) caches objects associated
 * with a project.
 *
 * @author pmeijer / https://github.com/pmeijer
 * @author kecso / https://github.com/kecso
 * @author mmaroti / https://github.com/mmaroti
 */

define([
    'common/util/assert',
    'common/storage/constants',
    'common/storage/util'
], function (ASSERT, CONSTANTS, UTIL) {
    'use strict';
    function ProjectCache(storage, projectId, mainLogger, gmeConfig) {
        var self = this,
            backup = {},
            cache = {},
            ongoingObjectRequests = {},
            ongoingPathsRequests = {},
            logger = mainLogger.fork('ProjectCache'),
            cacheSize = 0;

        logger.debug('ctor', projectId);

        this.queuedPersists = {};

        // Useful for debugging potential mutations, but not good for performance.
        function deepFreeze(obj) {
            Object.freeze(obj);

            if (obj instanceof Array) {
                for (var i = 0; i < obj.length; i += 1) {
                    if (obj[i] !== null && typeof obj[i] === 'object') {
                        deepFreeze(obj[i]);
                    }
                }
            } else {
                for (var key in obj) {
                    if (obj[key] !== null && typeof obj[key] === 'object') {
                        deepFreeze(obj[key]);
                    }
                }
            }
        }

        function cacheInsert(key, obj) {
            ASSERT(obj[CONSTANTS.MONGO_ID] === key);
            logger.debug('cacheInsert', key);

            if (gmeConfig.storage.freezeCache) {
                deepFreeze(obj);
            }

            if (!cache[key]) {
                cache[key] = obj;

                if (++cacheSize >= gmeConfig.storage.cache) {
                    logger.debug('Cache size reached - moved to backup');
                    backup = cache;
                    cache = {};
                    cacheSize = 0;
                }
                return true;
            } else {
                return false;
            }
        }

        function getFromCache(hash) {
            var obj = cache[hash],
                commitId;

            if (typeof obj === 'undefined') {
                obj = backup[hash];

                if (typeof obj === 'undefined') {
                    for (commitId in self.queuedPersists) {
                        if (self.queuedPersists.hasOwnProperty(commitId) && self.queuedPersists[commitId][hash]) {
                            obj = self.queuedPersists[commitId][hash];
                            break;
                        }
                    }
                }
            }

            return obj;
        }

        this.loadObject = function (key, callback) {
            var commitId,
                cachedObject;

            ASSERT(typeof key === 'string' && typeof callback === 'function');
            logger.debug('loadObject', {metadata: key});

            cachedObject = cache[key];
            if (typeof cachedObject === 'undefined') {
                cachedObject = backup[key];
                if (typeof cachedObject === 'undefined') {
                    for (commitId in self.queuedPersists) {
                        if (self.queuedPersists.hasOwnProperty(commitId) && self.queuedPersists[commitId][key]) {
                            cachedObject = self.queuedPersists[commitId][key];
                            break;
                        }
                    }

                    if (typeof cachedObject === 'undefined') {

                        if (typeof ongoingObjectRequests[key] === 'undefined') {
                            ongoingObjectRequests[key] = [callback];

                            logger.debug('object set to be loaded from storage', key);
                            storage.loadObject(projectId, key, function (err, loadResult) {
                                ASSERT(typeof loadResult === 'object' || typeof loadResult === 'undefined');
                                logger.debug('object loaded from database', key);
                                var callbacks,
                                    cb,
                                    subKey;

                                if ((loadResult || {}).multipleObjects === true) {
                                    for (subKey in loadResult.objects) {
                                        callbacks = ongoingObjectRequests[subKey] || [];
                                        delete ongoingObjectRequests[subKey];
                                        if (!err && loadResult.objects[subKey]) {
                                            cacheInsert(subKey, loadResult.objects[subKey]);
                                        }

                                        if (callbacks) {
                                            while ((cb = callbacks.pop())) {
                                                cb(err, loadResult.objects[subKey]);
                                            }
                                        }
                                    }
                                } else {
                                    callbacks = ongoingObjectRequests[key] || [];
                                    delete ongoingObjectRequests[key];
                                    if (!err && loadResult) {
                                        cacheInsert(key, loadResult);
                                    }

                                    while ((cb = callbacks.pop())) {
                                        cb(err, loadResult);
                                    }
                                }
                            });
                        } else {
                            logger.debug('object was already queued to be loaded', key);
                            ongoingObjectRequests[key].push(callback);
                        }
                        return;
                    } else {
                        logger.debug('object was erased from cache and backup but present in queuedPersists', key);
                        cacheInsert(key, cachedObject);
                    }
                } else {
                    logger.debug('object was in backup', key);
                    cacheInsert(key, cachedObject);
                }
            } else {
                logger.debug('object was in cache', key);
            }

            ASSERT(typeof cachedObject === 'object' &&
                cachedObject !== null &&
                cachedObject[CONSTANTS.MONGO_ID] === key);
            callback(null, cachedObject);
        };

        /**
         * Loads the necessary objects for the nodes corresponding to paths and inserts them in the cache.
         * If the rootKey is empty or does not exist - it won't attempt to load any nodes.
         *
         * Note that when the callback is called - all requested objects may or may not be in the cache. The resolving
         * of callback only indicates that between the call to loadPaths and the point of resolving - all objects have
         * been in the cache.
         *
         * @param {string} rootKey
         * @param {string[]} paths
         * @param {function(err)} callback
         */
        this.loadPaths = function (rootKey, paths, callback) {
            logger.debug('loadPaths', {metadata: {rootKey: rootKey, paths: paths}});
            var cachedObjects = {},
                excludes = [],
                pathsInfo = [],
                rootObj = getFromCache(rootKey),
                whenDone = {
                    cb: callback,
                    cnt: paths.length // When all paths are accounted for - callback will be invoked.
                },
                i,
                j,
                pathArray,
                obj,
                doRequest,
                key;

            if (!rootKey) {
                logger.debug('rootKey empty:', rootKey);
                callback(null);
                return;
            }

            // Filter out paths that are currently being requested.
            // We also need to keep track of when all requested paths are loaded
            // and make a final call to the callback at that point.
            paths = paths.filter(function (path) {
                var id = rootKey + path;
                if (ongoingPathsRequests[id]) {
                    ongoingPathsRequests[id].push(whenDone);
                    return false;
                } else {
                    return true;
                }
            });

            i = paths.length;

            if (rootObj) {
                // The root was loaded, so for each requested path we start from the root
                // and work our way down to the containment chain and add each object that is
                // already in the cache to 'excludes'.

                excludes.push(rootKey);
                cachedObjects[rootKey] = rootObj;
                while (i--) {
                    pathArray = paths[i].split('/');
                    pathArray.shift();

                    obj = rootObj;
                    doRequest = false;
                    for (j = 0; j < pathArray.length; j += 1) {
                        key = obj[pathArray[j]];
                        if (key) {
                            obj = getFromCache(key);
                            if (typeof obj !== 'undefined') {
                                excludes.push(key);
                                cachedObjects[key] = obj;
                            } else {
                                pathsInfo.push({
                                    parentHash: key,
                                    path: '/' + pathArray.slice(j + 1).join('/')
                                });
                                doRequest = true;
                                break;
                            }
                        } else {
                            // The given path does not exist anymore - break.
                            break;
                        }
                    }

                    if (doRequest) {
                        // A request is needed - therefore initialize a new entry to ongoing.
                        ongoingPathsRequests[rootKey + paths[i]] = [whenDone];
                    } else {
                        whenDone.cnt -= 1;
                        paths.splice(i, 1);
                    }
                }
            } else {
                pathsInfo = paths.map(function (path) {
                    ongoingPathsRequests[rootKey + path] = [whenDone];
                    return {
                        parentHash: rootKey,
                        path: path
                    };
                });
            }

            if (paths.length === 0) {
                logger.debug('No new paths to request.');
                if (whenDone.cnt === 0) {
                    logger.debug('All objects already in cache too.');
                    whenDone.cb(null);
                }
                return;
            }

            logger.debug('loadPaths will request from server, pathsInfo:', pathsInfo);
            storage.loadPaths(projectId, pathsInfo, excludes, function (err, serverObjects) {
                var callbacks = [],
                    keys,
                    id,
                    i;

                for (i = 0; i < paths.length; i += 1) {
                    id = rootKey + paths[i];
                    ongoingPathsRequests[id].forEach(function (doneEntry) {
                        // Account for a completed request...
                        doneEntry.cnt -= 1;
                        ASSERT(doneEntry.cnt >= 0, 'ongoingPathsRequests negative for an entry!?');
                        // if the last one for that entry - that call is completed.
                        if (doneEntry.cnt === 0) {
                            callbacks.push(doneEntry.cb);
                        }
                    });

                    // Finally clear out all entries stored for this id..
                    delete ongoingPathsRequests[id];
                }

                if (!err && serverObjects) {
                    // Insert every obtained object into the cache (that was not there before).
                    keys = Object.keys(serverObjects);
                    for (i = 0; i < keys.length; i += 1) {
                        if (!cacheInsert(keys[i], serverObjects[keys[i]])) {
                            logger.debug('Inserting same object again', keys[i]);
                        }
                    }

                    // Reinsert the cachedObjects.
                    keys = Object.keys(cachedObjects);
                    for (i = 0; i < keys.length; i += 1) {
                        cacheInsert(keys[i], cachedObjects[keys[i]]);
                    }

                    callbacks.forEach(function (cb) {
                        cb(null);
                    });
                } else {
                    logger.error('loadingPaths failed', err || new Error('no object arrived from server'));
                    callbacks.forEach(function (cb) {
                        cb(err);
                    });
                }
            });
        };

        this.insertObject = function (obj, stackedObjects) {
            ASSERT(typeof obj === 'object' && obj !== null);

            var key = obj[CONSTANTS.MONGO_ID];
            logger.debug('insertObject', {metadata: key});
            ASSERT(typeof key === 'string');

            if (cacheInsert(key, obj) === false) {
                // The storage on the server will return error if it's not the same..
                logger.debug('object inserted was already in cache');
            } else {
                var item = backup[key];

                if (typeof item !== 'undefined') {
                    // The storage on the server will return error if it's not the same..
                    logger.debug('object inserted was already in back-up');
                } else {
                    item = ongoingObjectRequests[key];
                    if (typeof item !== 'undefined') {
                        delete ongoingObjectRequests[key];

                        var cb;
                        while ((cb = item.pop())) {
                            cb(null, obj);
                        }
                    }
                }
            }
            if (stackedObjects) {
                stackedObjects[key] = obj;
            }
        };

        this.insertPatchObject = function (obj) {
            ASSERT(typeof obj === 'object' && obj !== null);

            var base,
                patch,
                key = obj[CONSTANTS.MONGO_ID];

            if (obj.base && typeof obj.patch === 'object' && key) {
                base = getFromCache(obj.base);

                if (base) {
                    patch = UTIL.applyPatch(base, obj.patch);
                    if (patch.status === 'success') {
                        patch.result[CONSTANTS.MONGO_ID] = key;
                        this.insertObject(patch.result);
                    } else {
                        logger.error('patch application failed', patch);
                    }
                } else {
                    logger.debug('the base [' +
                        obj.base + '] is not available from the cache so the patch object is ignored');
                }
            } else {
                logger.error('invalid patch object format', obj);
            }
        };
    }

    return ProjectCache;
});