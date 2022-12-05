/*eslint-env node*/
/**
 * @author kecso / https://github.com/kecso
 */
var mongodb = require('mongodb'),
    mongoUri = require('mongo-uri'),
    superagent = require('superagent'),
    Q = require('q');

function hookMessenger(options) {
    var db = null,
        client,
        dbName,
        projectMetadataCollectionId = options.collection || '_projects',
        logger;

    if (options.logger) {
        logger = options.logger;
    } else {
        logger = console;
        // eslint-disable-next-line no-console
        logger.debug = console.log;
    }

    options = options || {};
    options.uri = options.uri || 'mongodb://127.0.0.1:27017/multi';

    dbName = mongoUri.parse(options.uri).database;

    function getProjectMetaData(projectId, callback) {
        if (db === null) {
            logger.error('No mongoDB connection at', options.uri);
            callback({});
            return;
        }

        db.collection(projectMetadataCollectionId, function (err, collection) {
            if (err || !collection) {
                logger.error('cannot get metadata: ', err ||
                    new Error('unknown collection: ' + projectMetadataCollectionId));
                callback({});
                return;
            }

            collection.findOne({_id: projectId}, function (err, projectMetaData) {
                if (err || !projectMetaData) {
                    logger.error('cannot retrieve project\'s metadata: ', err ||
                        new Error('unknown projectId: ' + projectId));
                    callback({});
                    return;
                }

                callback(projectMetaData);
            });
        });
    }

    function start(callback) {
        var deferred = Q.defer();
        if (db) {
            deferred.resolve();
        }
        mongodb.MongoClient.connect(options.uri, {}, function (err, client_) {
            if (!err && client_) {
                client = client_;
                db = client.db(dbName);
                deferred.resolve();
            } else {
                deferred.reject(err || new Error('cannot connect to mongoDB'));
            }
        });

        return deferred.promise.nodeify(callback);
    }

    function stop(callback) {
        var deferred = Q.defer();
        client.close(function (err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });

        return deferred.promise.nodeify(callback);
    }

    function send(eventType, eventData) {
        var hookIds,
            hook,
            payload,
            i;

        if (!eventData.projectId) {
            logger.debug('not project related event receieved: ', eventType);
            return;
        }

        getProjectMetaData(eventData.projectId, function (metaData) {
            hookIds = Object.keys(metaData.hooks || {});

            for (i = 0; i < hookIds.length; i += 1) {
                hook = metaData.hooks[hookIds[i]];
                if (hook.events === 'all' || (hook.events || []).indexOf(eventType) !== -1) {
                    payload = {
                        event: eventType,
                        projectId: eventData.projectId,
                        owner: metaData.owner,
                        projectName: metaData.name,
                        hookId: hookIds[i],
                        data: eventData
                    };

                    superagent.post(hook.url, payload, function (err, result) {
                        logger.debug(err, result);
                    });
                }
            }
        });

    }

    return {
        start: start,
        stop: stop,
        send: send
    };
}

module.exports = hookMessenger;