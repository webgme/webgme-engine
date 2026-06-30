/*eslint-env node*/

/**
 * Minimal in-memory MongoDB database facade for auth-disabled local deployments.
 * Supports the subset of collection operations used by TokenServer and ExecutorServer.
 */
'use strict';

function InMemoryCollection() {
    var self = this,
        documents = [],
        uniqueIndexes = {};

    function matches(doc, query) {
        return Object.keys(query).every(function (key) {
            return doc[key] === query[key];
        });
    }

    function applyProjection(doc, projection) {
        if (!projection) {
            return Object.assign({}, doc);
        }

        var result = {},
            include = Object.keys(projection).some(function (key) {
                return projection[key] === 1;
            });

        if (include) {
            Object.keys(projection).forEach(function (key) {
                if (projection[key] === 1 && Object.hasOwn(doc, key)) {
                    result[key] = doc[key];
                }
            });
            return result;
        }

        result = Object.assign({}, doc);
        Object.keys(projection).forEach(function (key) {
            if (projection[key] === 0) {
                delete result[key];
            }
        });
        return result;
    }

    function checkUniqueIndexes(doc, excludeId) {
        Object.keys(uniqueIndexes).forEach(function (field) {
            documents.forEach(function (existing) {
                if (excludeId !== undefined && existing._id === excludeId) {
                    return;
                }
                if (existing[field] === doc[field]) {
                    throw new Error('E11000 duplicate key error collection: index: ' + field + '_1 dup key');
                }
            });
        });
    }

    self.createIndex = function (spec, options) {
        if (options && options.unique) {
            Object.keys(spec).forEach(function (field) {
                uniqueIndexes[field] = true;
            });
        }
        return Promise.resolve();
    };

    self.find = function (query, options) {
        query = query || {};
        options = options || {};
        return {
            toArray: function () {
                return Promise.resolve(
                    documents
                        .filter(function (doc) {
                            return matches(doc, query);
                        })
                        .map(function (doc) {
                            return applyProjection(doc, options.projection);
                        })
                );
            }
        };
    };

    self.findOne = function (query, options) {
        query = query || {};
        options = options || {};
        var doc = documents.find(function (d) {
            return matches(d, query);
        });
        return Promise.resolve(doc ? applyProjection(doc, options.projection) : null);
    };

    self.insertOne = function (doc) {
        var copy = Object.assign({}, doc);
        copy._id = copy._id || documents.length + 1;
        checkUniqueIndexes(copy);
        documents.push(copy);
        return Promise.resolve({ insertedId: copy._id });
    };

    self.deleteOne = function (query) {
        var idx = documents.findIndex(function (doc) {
            return matches(doc, query);
        });
        if (idx === -1) {
            return Promise.resolve({ deletedCount: 0 });
        }
        documents.splice(idx, 1);
        return Promise.resolve({ deletedCount: 1 });
    };

    self.updateOne = function (query, update) {
        var doc = documents.find(function (d) {
            return matches(d, query);
        });
        if (!doc) {
            return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
        }
        if (update.$set) {
            Object.assign(doc, update.$set);
        }
        return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    };
}

function MemoryMongoFacade() {
    var collections = {};

    this.collection = function (name) {
        if (!collections[name]) {
            collections[name] = new InMemoryCollection();
        }
        return collections[name];
    };
}

module.exports = MemoryMongoFacade;
