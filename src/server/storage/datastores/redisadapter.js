/*eslint-env node*/
/**
 * @module Server:Storage:Redis
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var redis = require('redis'),
    Q = require('q'),
    RedisProject = require('./redisproject');

// Data structure (for projectId guest+test):
// guest+test = hashMap(objectHash, objectStr)
// guest+test:branches = hashMap(branchName, branchHash)
// guest+test:commits = hashMap(objectHash, timestamp)
// guest+test:tags = hashMap(objectHash, commitHash)

/**
 * @param mainLogger
 * @param gmeConfig
 * @constructor
 * @ignore
 */
function RedisAdapter(mainLogger, gmeConfig) {
    var self = this,
        connectionCnt = 0,
        connectDeferred,
        disconnectDeferred,
        logger = mainLogger.fork('redisAdapter');

    this.client = null;
    this.logger = logger;
    this.CONSTANTS = {
        BRANCHES: ':branches',
        COMMITS: ':commits',
        TAGS: ':tags'
    };

    function normalizeRedisOptions(options) {
        var redisOptions = Object.assign({}, options || {});

        // Backward compatibility with legacy host/port style.
        if (redisOptions.host || redisOptions.port) {
            redisOptions.socket = Object.assign({}, redisOptions.socket || {});
            if (redisOptions.host) {
                redisOptions.socket.host = redisOptions.host;
                delete redisOptions.host;
            }

            if (redisOptions.port) {
                redisOptions.socket.port = redisOptions.port;
                delete redisOptions.port;
            }
        }

        return redisOptions;
    }

    function redisCommand(command, args) {
        function normalizeArg(arg) {
            return typeof arg === 'number' ? String(arg) : arg;
        }

        function toObjectFromFlatArray(items) {
            var i,
                result = {};

            for (i = 0; i < items.length; i += 2) {
                result[items[i]] = items[i + 1];
            }

            return result;
        }

        if (!self.client) {
            return Q.reject(new Error('Database is not open.'));
        }

        args = args || [];
        command = command.toUpperCase();
        return Q(self.client.sendCommand([command].concat(args.map(normalizeArg))))
            .then(function (result) {
                if (command === 'HGETALL') {
                    if (!result) {
                        return {};
                    }

                    // RESP2 returns flat arrays for HGETALL.
                    if (Array.isArray(result)) {
                        return toObjectFromFlatArray(result);
                    }
                }

                return result;
            });
    }

    function hmsetFromObject(key, object) {
        var args = [key];

        Object.keys(object || {}).forEach(function (field) {
            args.push(field, object[field]);
        });

        if (args.length === 1) {
            return Q();
        }

        return redisCommand('HSET', args);
    }

    function openDatabase(callback) {
        var client;
        connectionCnt += 1;
        logger.debug('openDatabase, connection counter:', connectionCnt);

        if (connectionCnt === 1) {
            if (self.client === null) {
                logger.debug('Connecting to database...');
                connectDeferred = Q.defer();
                client = redis.createClient(normalizeRedisOptions(gmeConfig.storage.database.options));
                client.on('error', function (err) {
                    logger.error('Redis client: ', err);
                });

                Q(client.connect())
                    .then(function () {
                        self.client = client;
                        disconnectDeferred = null;
                        logger.debug('Connected.');
                        connectDeferred.resolve();
                    })
                    .catch(function (err) {
                        self.client = null;
                        connectDeferred.reject(err);
                    });
            } else {
                logger.debug('Count is 1 but redis is not null');
                connectDeferred = Q();
            }
        } else {
            // we are already connected
            logger.debug('Reusing redis connection.');
            if (!connectDeferred) {
                connectDeferred = Q();
            }
        }

        return connectDeferred.promise ? connectDeferred.promise.nodeify(callback) : connectDeferred.nodeify(callback);
    }

    function closeDatabase(callback) {
        connectionCnt -= 1;
        logger.debug('closeDatabase, connection counter:', connectionCnt);

        if (connectionCnt < 0) {
            logger.error('connection counter became negative, too many closeDatabase. Setting it to 0.', connectionCnt);
            connectionCnt = 0;
        }

        if (!disconnectDeferred) {
            disconnectDeferred = Q.defer();
        }

        if (connectionCnt === 0) {
            if (self.client) {
                logger.debug('Closing connection to redis...');
                Q(self.client.quit())
                    .catch(function (err) {
                        // If client is already closed we still consider this a successful shutdown.
                        if (err && err.name !== 'ClientClosedError' && err.message !== 'The client is closed') {
                            throw err;
                        }
                    })
                    .then(function () {
                        self.client = null;
                        logger.debug('Closed.');
                        disconnectDeferred.resolve();
                    })
                    .catch(disconnectDeferred.reject);
            } else {
                disconnectDeferred.resolve();
            }
        } else {
            logger.debug('Connections still alive.');
        }

        return disconnectDeferred.promise.nodeify(callback);
    }

    function deleteProject(projectId, callback) {
        var deferred = Q.defer();

        if (self.client) {
            redisCommand('DEL', [projectId,
                projectId + self.CONSTANTS.BRANCHES,
                projectId + self.CONSTANTS.TAGS,
                projectId + self.CONSTANTS.COMMITS])
                .then(function (result) {
                    if (result > 0) {
                        deferred.resolve(true);
                    } else {
                        deferred.reject(false);
                    }
                })
                .catch(deferred.reject);
        } else {
            deferred.reject(new Error('Database is not open.'));
        }

        return deferred.promise.nodeify(callback);
    }

    function openProject(projectId, callback) {
        var deferred = Q.defer();

        logger.debug('openProject', projectId);

        if (self.client) {
            redisCommand('EXISTS', [projectId])
                .then(function (result) {
                    // 1 if the key exists.
                    // 0 if the key does not exist.
                    logger.debug('openProject, result', result);
                    if (result === 1) {
                        deferred.resolve(new RedisProject(projectId, self));
                    } else {
                        deferred.reject(new Error('Project does not exist ' + projectId));
                    }
                })
                .catch(deferred.reject);

        } else {
            deferred.reject(new Error('Database is not open.'));
        }

        return deferred.promise.nodeify(callback);
    }

    function createProject(projectId, callback) {
        var deferred = Q.defer();

        logger.debug('createProject', projectId);

        if (self.client) {
            redisCommand('HSETNX', [projectId, '_id', projectId])
                .then(function (result) {
                    // 1 if field is a new field in the hash and value was set.
                    // 0 if field already exists in the hash and the value was updated.
                    if (result === 1) {
                        deferred.resolve(new RedisProject(projectId, self));
                    } else {
                        deferred.reject(new Error('Project already exists ' + projectId));
                    }
                })
                .catch(deferred.reject);

        } else {
            deferred.reject(new Error('Database is not open.'));
        }

        return deferred.promise.nodeify(callback);
    }

    function renameProject(projectId, newProjectId, callback) {
        var deferred = Q.defer();

        if (self.client) {
            redisCommand('RENAMENX', [projectId, newProjectId])
                .then(function (result) {
                    // 1 if key was renamed to newkey.
                    // 0 if newkey already exists.
                    if (result === 1) {
                        // Force rename for branches and commits.
                        Q.allSettled([
                            redisCommand('RENAME',
                                [projectId + self.CONSTANTS.BRANCHES, newProjectId + self.CONSTANTS.BRANCHES]),
                            redisCommand('RENAME',
                                [projectId + self.CONSTANTS.COMMITS, newProjectId + self.CONSTANTS.COMMITS]),
                            redisCommand('RENAME',
                                [projectId + self.CONSTANTS.TAGS, newProjectId + self.CONSTANTS.TAGS])
                        ])
                            .then(function (/*result*/) {
                                // Result may contain errors if no branches or commits were created,
                                // these do not matter.
                                deferred.resolve();
                            });
                    } else {
                        deferred.reject(new Error('Project already exists ' + newProjectId));
                    }
                })
                .catch(function (err) {
                    if (err.message === 'ERR no such key') {
                        deferred.reject(new Error('Project does not exist ' + projectId));
                    } else {
                        deferred.reject(err);
                    }
                });
        } else {
            deferred.reject(new Error('Database is not open.'));
        }

        return deferred.promise.nodeify(callback);
    }

    function duplicateProject(projectId, newProjectId, callback) {
        var newProject;

        logger.warn('duplicateProject can use a lot of memory for redis', projectId);

        return self.openProject(projectId)
            .then(function () {
                return self.createProject(newProjectId);
            })
            .then(function (newProject_) {
                newProject = newProject_;
                // TODO: Is there a more efficient way of doing this?
                return Q.all([
                    redisCommand('HGETALL', [projectId]),
                    redisCommand('HGETALL', [projectId + self.CONSTANTS.BRANCHES]),
                    redisCommand('HGETALL', [projectId + self.CONSTANTS.COMMITS]),
                    redisCommand('HGETALL', [projectId + self.CONSTANTS.TAGS]),
                ]);
            })
            .then(function (result) {
                var promises = [hmsetFromObject(newProjectId, result[0])];

                // Branches and Commits might not have been created for the source project
                if (result[1]) {
                    promises.push(hmsetFromObject(newProjectId + self.CONSTANTS.BRANCHES, result[1]));
                }

                if (result[2]) {
                    promises.push(hmsetFromObject(newProjectId + self.CONSTANTS.COMMITS, result[2]));
                }

                if (result[3]) {
                    promises.push(hmsetFromObject(newProjectId + self.CONSTANTS.TAGS, result[3]));
                }

                return Q.all(promises);
            })
            .then(function () {
                return newProject;
            })
            .nodeify(callback);
    }

    this.openDatabase = openDatabase;
    this.closeDatabase = closeDatabase;

    this.openProject = openProject;
    this.deleteProject = deleteProject;
    this.createProject = createProject;
    this.renameProject = renameProject;
    this.duplicateProject = duplicateProject;
    this.redisCommand = redisCommand;
}

module.exports = RedisAdapter;
