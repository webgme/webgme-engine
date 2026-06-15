/*globals define*/
/*eslint-env node, browser*/
/**
 * @author lattmann / https://github.com/lattmann
 */

define([
    'common/storage/constants',
    'common/util/jsonPatcher',
    'q',
    'common/regexp',
    'common/util/key'
], function (CONSTANTS, jsonPatcher, Q, REGEXP, generateKey) {
    'use strict';

    /**
     * @param {ProjectInterface} project
     * @param {object} parameters - If more than one is given, the order of precedence is:
     * branchName, commitHash, tagName and rootHash.
     * @param {string} [parameters.rootHash] - The hash of the tree root.
     * @param {string} [parameters.commitHash] - The tree associated with the commitHash.
     * @param {string} [parameters.tagName] - The tree at the given tag.
     * @param {string} [parameters.branchName] - The tree at the given branch.
     * @param {function} [callback]
     * @returns {Promise}
     */
    function getRootHash(project, parameters, callback) {
        var deferred = Q.defer();

        if (parameters.branchName) {
            Q.ninvoke(project, 'getBranchHash', parameters.branchName)
                .then(function (commitHash) {
                    parameters.commitHash = commitHash;
                    return Q.ninvoke(project, 'loadObject', commitHash);
                })
                .then(function (commitObject) {
                    parameters.rootHash = commitObject.root;
                    deferred.resolve(commitObject.root);
                })
                .catch(deferred.reject);
        } else if (parameters.commitHash) {
            Q.ninvoke(project, 'loadObject', parameters.commitHash)
                .then(function (commitObject) {
                    parameters.rootHash = commitObject.root;
                    deferred.resolve(commitObject.root);
                })
                .catch(deferred.reject);
        } else if (parameters.tagName) {
            Q.ninvoke(project, 'getTags')
                .then(function (tags) {
                    if (tags[parameters.tagName]) {
                        parameters.commitHash = tags[parameters.tagName];
                        return Q.ninvoke(project, 'loadObject', tags[parameters.tagName]);
                    } else {
                        throw new Error('Unknown tag name [' + parameters.tagName + ']');
                    }
                })
                .then(function (commitObject) {
                    parameters.rootHash = commitObject.root;
                    deferred.resolve(commitObject.root);
                })
                .catch(deferred.reject);
        } else if (parameters.rootHash) {
            deferred.resolve(parameters.rootHash);
        } else {
            deferred.reject(new Error('No valid input was given to search for rootHash'));
        }

        return deferred.promise.nodeify(callback);
    }

    function _collectObjects(project, objectHashArray) {
        var deferred = Q.defer(),
            promises = [],
            objects = [],
            i;

        for (i = 0; i < objectHashArray.length; i += 1) {
            promises.push(Q.ninvoke(project, 'loadObject', objectHashArray[i]));
        }

        Q.allSettled(promises)
            .then(function (results) {
                var error = null,
                    i;
                for (i = 0; i < results.length; i += 1) {
                    if (results[i].state === 'fulfilled') {
                        objects.push(results[i].value);
                    } else {
                        error = error || results[i].reason || new Error('unable to load');
                    }
                }

                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(objects);
                }
            });
        return deferred.promise;
    }

    function _collectObjectAndAssetHashes(project, rootHash) {
        var deferred = Q.defer(),
            objects = {},
            assets = {},
            queue = [rootHash],
            task,
            error = null,
            working = false,
            timerId;

        timerId = setInterval(function () {
            if (!working) {
                task = queue.shift();
                if (task === undefined) {
                    clearInterval(timerId);
                    if (error) {
                        deferred.reject(error);
                    } else {
                        deferred.resolve({objects: Object.keys(objects), assets: Object.keys(assets)});
                    }
                    return;
                }

                if (!objects[task]) {
                    working = true;
                    project.loadObject(task, function (err, object) {
                        var key;

                        error = error || err;
                        if (!err && object) {
                            objects[task] = true;
                            if (object) {
                                //now put every sub-object on top of the queue
                                for (key in object) {
                                    if (typeof object[key] === 'string' && REGEXP.HASH.test(object[key])) {
                                        queue.push(object[key]);
                                    }
                                }

                                //looking for assets
                                if (object.atr) {
                                    for (key in object.atr) {
                                        //TODO why can't we inlcude BlobConfig???
                                        if (typeof object.atr[key] === 'string' &&
                                            REGEXP.BLOB_HASH.test(object.atr[key])) {
                                            assets[object.atr[key]] = true;
                                        }
                                    }
                                }

                                //checking if the node has a sharded overlay, we do not load the shards, yet
                                if (object.ovr && object.ovr.sharded === true) {
                                    for (key in object.ovr) {
                                        if (typeof object.ovr[key] === 'string' &&
                                            REGEXP.HASH.test(object.ovr[key])) {
                                            objects[object.ovr[key]] = true;
                                        }
                                    }
                                }
                            }
                        }
                        working = false;
                    });
                }

            }
        }, 1);

        return deferred.promise;
    }

    function _getProjectDumper(project) {
        if (typeof project.dumpProject === 'function') {
            return project;
        }

        if (project._dbProject && typeof project._dbProject.dumpProject === 'function') {
            return project._dbProject;
        }

        return null;
    }

    function _dumpProjectRecords(project) {
        var dumper = _getProjectDumper(project);

        if (!dumper) {
            return Q.reject(new Error('Project does not support dumpProject.'));
        }

        return Q.ninvoke(dumper, 'dumpProject');
    }

    function _getProjectObjectInserter(project) {
        if (typeof project.persistObject === 'function') {
            return project;
        }

        if (project._dbProject && typeof project._dbProject.insertObject === 'function') {
            return project._dbProject;
        }

        return null;
    }

    function _persistRepositoryObject(project, inserter, object) {
        if (inserter === project) {
            return Q.ninvoke(project, 'persistObject', object);
        }

        return Q.ninvoke(inserter, 'insertObject', object);
    }

    function _enqueueSnapshotReference(value, queue, visited) {
        if (typeof value === 'string' && REGEXP.HASH.test(value) && !visited[value]) {
            visited[value] = true;
            queue.push(value);
        }
    }

    function _collectSnapshotClosureFromObjects(objects, rootHash) {
        var objectsById = {},
            queue = [rootHash],
            visited = {},
            result = [],
            assets = {},
            i,
            hash,
            object,
            key;

        for (i = 0; i < objects.length; i += 1) {
            objectsById[objects[i][CONSTANTS.MONGO_ID]] = objects[i];
        }

        if (!objectsById[rootHash]) {
            throw new Error('Cannot extract snapshot, root object [' + rootHash + '] is not in objects.');
        }

        visited[rootHash] = true;

        while (queue.length > 0) {
            hash = queue.shift();
            object = objectsById[hash];
            if (!object) {
                continue;
            }

            result.push(object);

            for (key in object) {
                if (Object.hasOwn(object, key)) {
                    _enqueueSnapshotReference(object[key], queue, visited);
                }
            }

            if (object.atr) {
                for (key in object.atr) {
                    if (typeof object.atr[key] === 'string' && REGEXP.BLOB_HASH.test(object.atr[key])) {
                        assets[object.atr[key]] = true;
                    }
                }
            }

            if (object.ovr && object.ovr.sharded === true) {
                for (key in object.ovr) {
                    _enqueueSnapshotReference(object.ovr[key], queue, visited);
                }
            }
        }

        return {
            objects: result,
            hashes: {
                objects: result.map(function (obj) {
                    return obj[CONSTANTS.MONGO_ID];
                }),
                assets: Object.keys(assets)
            }
        };
    }

    function _extractV1SnapshotFromRepositoryJson(projectJson) {
        var rootHash = projectJson.rootHash,
            commitHash = projectJson.commitHash,
            commits = projectJson.commits || [],
            snapshot,
            i;

        if (!rootHash && commitHash) {
            for (i = 0; i < commits.length; i += 1) {
                if (commits[i]._id === commitHash) {
                    rootHash = commits[i].root;
                    break;
                }
            }
        }

        if (!rootHash) {
            throw new Error('Cannot extract v1 snapshot from repository json without rootHash.');
        }

        snapshot = _collectSnapshotClosureFromObjects(projectJson.objects || [], rootHash);

        return {
            projectId: projectJson.projectId,
            kind: projectJson.kind,
            branchName: projectJson.branchName,
            commitHash: commitHash,
            rootHash: rootHash,
            hashes: snapshot.hashes,
            objects: snapshot.objects
        };
    }

    function _collectAssetHashesFromObject(object, assets) {
        var key;

        if (object.atr) {
            for (key in object.atr) {
                if (typeof object.atr[key] === 'string' && REGEXP.BLOB_HASH.test(object.atr[key])) {
                    assets[object.atr[key]] = true;
                }
            }
        }
    }

    function _collectRepositoryHashes(objects, commits) {
        var hashes = {
                objects: [],
                assets: {}
            },
            assets = {},
            i;

        for (i = 0; i < objects.length; i += 1) {
            hashes.objects.push(objects[i][CONSTANTS.MONGO_ID]);
            _collectAssetHashesFromObject(objects[i], assets);
        }

        for (i = 0; i < commits.length; i += 1) {
            hashes.objects.push(commits[i][CONSTANTS.MONGO_ID]);
        }

        hashes.assets = Object.keys(assets);
        return hashes;
    }

    function _resolveDefaultBranchCompat(project, branches, parameters) {
        var deferred = Q.defer(),
            branchName = parameters.defaultBranchName,
            branchNames = Object.keys(branches);

        if (typeof branchName !== 'string') {
            if (branchNames.indexOf('master') > -1) {
                branchName = 'master';
            } else if (branchNames.length > 0) {
                branchName = branchNames[0];
            } else {
                deferred.resolve({
                    branchName: null,
                    commitHash: null,
                    rootHash: null
                });
                return deferred.promise;
            }
        }

        if (!Object.hasOwn(branches, branchName)) {
            deferred.reject(new Error('Unknown default branch [' + branchName + ']'));
            return deferred.promise;
        }

        Q.ninvoke(project, 'loadObject', branches[branchName])
            .then(function (commitObject) {
                deferred.resolve({
                    branchName: branchName,
                    commitHash: branches[branchName],
                    rootHash: commitObject.root
                });
            })
            .catch(deferred.reject);

        return deferred.promise;
    }

    function _assertRepositoryProjectJson(projectJson) {
        if (projectJson.formatVersion !== CONSTANTS.PROJECT_JSON_FORMAT_VERSION) {
            throw new Error('Unsupported project json formatVersion [' + projectJson.formatVersion + ']');
        }

        if (projectJson.exportMode !== CONSTANTS.REPOSITORY_EXPORT_MODE) {
            throw new Error('Unsupported project json exportMode [' + projectJson.exportMode + ']');
        }

        if (!projectJson.objects || projectJson.objects instanceof Array === false) {
            throw new Error('Repository project json is missing objects array.');
        }

        if (!projectJson.commits || projectJson.commits instanceof Array === false) {
            throw new Error('Repository project json is missing commits array.');
        }

        if (!projectJson.branches || typeof projectJson.branches !== 'object') {
            throw new Error('Repository project json is missing branches object.');
        }

        if (!projectJson.tags || typeof projectJson.tags !== 'object') {
            throw new Error('Repository project json is missing tags object.');
        }
    }

    return {
        CONSTANTS: CONSTANTS,
        getProjectFullNameFromProjectId: function (projectId) {
            if (projectId) {
                return projectId.replace(CONSTANTS.PROJECT_ID_SEP, CONSTANTS.PROJECT_DISPLAYED_NAME_SEP);
            }
        },
        getProjectDisplayedNameFromProjectId: function (projectId) {
            if (projectId) {
                return projectId.replace(CONSTANTS.PROJECT_ID_SEP, ' ' + CONSTANTS.PROJECT_DISPLAYED_NAME_SEP + ' ');
            }
        },
        getProjectIdFromProjectFullName: function (projectFullName) {
            if (projectFullName) {
                return projectFullName.replace(CONSTANTS.PROJECT_DISPLAYED_NAME_SEP, CONSTANTS.PROJECT_ID_SEP);
            }
        },
        getProjectIdFromOwnerIdAndProjectName: function (userId, projectName) {
            return userId + CONSTANTS.PROJECT_ID_SEP + projectName;
        },
        getProjectNameFromProjectId: function (projectId) {
            if (projectId) {
                return projectId.substring(projectId.indexOf(CONSTANTS.PROJECT_ID_SEP) + 1);
            }
        },
        getOwnerFromProjectId: function (projectId) {
            if (projectId) {
                return projectId.substring(0, projectId.indexOf(CONSTANTS.PROJECT_ID_SEP));
            }
        },
        getHashTaggedHash: function (hash) {
            if (typeof hash === 'string') {
                return hash[0] === '#' ? hash : '#' + hash;
            }
            return hash;
        },
        getPatchObject: function (oldData, newData) {
            var patchObject = {
                type: 'patch',
                base: oldData[CONSTANTS.MONGO_ID],
                patch: jsonPatcher.create(oldData, newData)
            };
            patchObject[CONSTANTS.MONGO_ID] = newData[CONSTANTS.MONGO_ID];

            return patchObject;
        },
        coreObjectHasOldAndNewData: function (coreObj) {
            return !!(coreObj.oldHash && coreObj.newHash && coreObj.oldData && coreObj.newData);
        },
        getChangedNodes: jsonPatcher.getChangedNodes,
        applyPatch: jsonPatcher.apply,
        checkHashConsistency: function (gmeConfig, dataObj, hash) {
            var result;

            if (gmeConfig.storage.keyType === 'rand160Bits') {
                // Random hashes should not be checked.
                result = true;
            } else if (gmeConfig.storage.disableHashChecks === true) {
                // Configured to not check.
                result = true;
            } else {
                dataObj[CONSTANTS.MONGO_ID] = '';
                result = hash === '#' + generateKey(dataObj, gmeConfig);
            }

            return result;
        },

        /**
         * Extracts a serializable json representation of a project tree.
         * To specify starting point set one of the four options. If more than one is set the order of precedence is:
         * branchName, commitHash, tagName and rootHash.
         *
         * @param {ProjectInterface} project
         * @param {object} parameters - Specifies which project tree should be serialized:
         * @param {string} [parameters.rootHash] - The hash of the tree root.
         * @param {string} [parameters.commitHash] - The tree associated with the commitHash.
         * @param {string} [parameters.tagName] - The tree at the given tag.
         * @param {string} [parameters.branchName] - The tree at the given branch.
         * @param {string} [parameters.kind] - If not given will assign the one in project.
         * @param {function} callback
         */
        getProjectJson: function (project, parameters, callback) {
            var deferred = Q.defer(),
                rawJson;

            getRootHash(project, parameters || {})
                .then(function (rootHash) {
                    return Q.all([
                        _collectObjectAndAssetHashes(project, rootHash),
                        project.getProjectInfo()
                    ]);
                })
                .then(function (res) {
                    var hashes = res[0],
                        info = res[1];
                    rawJson = {
                        rootHash: parameters.rootHash,
                        projectId: project.projectId,
                        kind: typeof parameters.kind === 'string' ? parameters.kind : info.info.kind,
                        branchName: parameters.branchName,
                        commitHash: parameters.commitHash,
                        hashes: hashes,
                        objects: null
                    };
                    return _collectObjects(project, hashes.objects);
                })
                .then(function (objects) {
                    rawJson.objects = objects;
                    deferred.resolve(rawJson);
                })
                .catch(deferred.reject);

            return deferred.promise.nodeify(callback);
        },

        /**
         * Inserts a serialized project tree into the storage and associates it with a commitHash.
         *
         * @param {ProjectInterface} project
         * @param {object} [options]
         * @param {string} [options.branch] - Name of branch to update
         * @param {string} [options.parentCommit] - Array of parents for new commit
         * @param {string} [options.commitMessage=%defaultCommitMessage%] information about the insertion
         * @param {function(Error, hashes)} callback
         */
        insertProjectJson: function (project, projectJson, options, callback) {
            var deferred = Q.defer(),
                toPersist = {},
                rootHash,
                defaultCommitMessage,
                objects,
                i;

            if (projectJson.formatVersion === CONSTANTS.PROJECT_JSON_FORMAT_VERSION &&
                projectJson.exportMode === CONSTANTS.REPOSITORY_EXPORT_MODE) {

                projectJson = _extractV1SnapshotFromRepositoryJson(projectJson);
            }

            rootHash = projectJson.rootHash;
            defaultCommitMessage = 'Importing contents of [' +
                    projectJson.projectId + '@' + rootHash + ']';
            objects = projectJson.objects;

            for (i = 0; i < objects.length; i += 1) {
                // we have to patch the object right before import, for smoother usage experience
                toPersist[objects[i]._id] = objects[i];
            }

            options = options || {};

            options.branch = options.branch || null;
            options.parentCommit = options.parentCommit || [];

            project.makeCommit(options.branch, options.parentCommit,
                rootHash, toPersist, options.commitMessage || defaultCommitMessage)
                .then(function (commitResult) {
                    deferred.resolve(commitResult);
                })
                .catch(deferred.reject);

            return deferred.promise.nodeify(callback);
        },

        /**
         * Extracts a serializable json representation of the full project repository,
         * including all stored objects, branches, tags, and commit history.
         *
         * @param {ProjectInterface} project
         * @param {object} [parameters]
         * @param {string} [parameters.kind] - If not given will assign the one in project.
         * @param {string} [parameters.defaultBranchName] - Branch used for v1 compatible fields.
         * @param {function} callback
         */
        getProjectWithHistory: function (project, parameters, callback) {
            var deferred = Q.defer(),
                rawJson,
                dump;

            parameters = parameters || {};

            Q.all([
                _dumpProjectRecords(project),
                project.getProjectInfo()
            ])
                .then(function (res) {
                    dump = res[0];

                    return _resolveDefaultBranchCompat(project, dump.branches, parameters)
                        .then(function (compat) {
                            var info = res[1];

                            rawJson = {
                                formatVersion: CONSTANTS.PROJECT_JSON_FORMAT_VERSION,
                                exportMode: CONSTANTS.REPOSITORY_EXPORT_MODE,
                                projectId: project.projectId,
                                kind: typeof parameters.kind === 'string' ? parameters.kind : info.info.kind,
                                branchName: compat.branchName,
                                commitHash: compat.commitHash,
                                rootHash: compat.rootHash,
                                branches: dump.branches,
                                tags: dump.tags,
                                commits: dump.commits,
                                hashes: _collectRepositoryHashes(dump.objects, dump.commits),
                                objects: dump.objects
                            };

                            deferred.resolve(rawJson);
                        });
                })
                .catch(deferred.reject);

            return deferred.promise.nodeify(callback);
        },

        /**
         * Inserts a repository project json into the storage, restoring branches and tags.
         *
         * @param {ProjectInterface} project
         * @param {object} projectJson
         * @param {function(Error, object)} callback
         */
        insertProjectWithHistory: function (project, projectJson, callback) {
            var deferred = Q.defer(),
                inserter = _getProjectObjectInserter(project),
                branchNames,
                tagNames;

            try {
                _assertRepositoryProjectJson(projectJson);
            } catch (err) {
                deferred.reject(err);
                return deferred.promise.nodeify(callback);
            }

            if (!inserter) {
                deferred.reject(new Error('Project does not support direct object insertion.'));
                return deferred.promise.nodeify(callback);
            }

            Q.allSettled(projectJson.objects.concat(projectJson.commits).map(function (object) {
                return _persistRepositoryObject(project, inserter, object);
            }))
                .then(function (insertResults) {
                    var failedInserts = [],
                        j;

                    for (j = 0; j < insertResults.length; j += 1) {
                        if (insertResults[j].state === 'rejected') {
                            failedInserts.push(insertResults[j].reason);
                        }
                    }

                    if (failedInserts.length > 0) {
                        throw failedInserts[0];
                    }

                    branchNames = Object.keys(projectJson.branches);
                    return Q.all(branchNames.map(function (branchName) {
                        return Q.ninvoke(project, 'setBranchHash', branchName, '', projectJson.branches[branchName]);
                    }));
                })
                .then(function () {
                    tagNames = Object.keys(projectJson.tags);
                    return Q.all(tagNames.map(function (tagName) {
                        return Q.ninvoke(project, 'createTag', tagName, projectJson.tags[tagName]);
                    }));
                })
                .then(function () {
                    deferred.resolve({
                        projectId: projectJson.projectId,
                        branches: projectJson.branches,
                        tags: projectJson.tags
                    });
                })
                .catch(deferred.reject);

            return deferred.promise.nodeify(callback);
        },
        getRootHash: getRootHash
    };
});
