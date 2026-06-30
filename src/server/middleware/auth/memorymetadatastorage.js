/*globals requireJS*/
/*eslint-env node*/

/**
 * In-memory implementation of project metadata storage (no MongoDB).
 * @author webgme-engine contributors
 */
'use strict';

var Q = require('q'),
    CONSTANTS = requireJS('common/Constants'),
    storageUtil = requireJS('common/storage/util');

function MemoryMetadataStorage(mainLogger /*, gmeConfig*/) {
    var self = this,
        logger = mainLogger.fork('MemoryMetadataStorage'),
        projects = {};

    function start(params, callback) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise.nodeify(callback);
    }

    function stop(callback) {
        var deferred = Q.defer();
        projects = {};
        deferred.resolve();
        return deferred.promise.nodeify(callback);
    }

    function getProjects(callback) {
        var result = Object.keys(projects).map(function (id) {
            var project = projects[id];
            project.hooks = project.hooks || {};
            return project;
        });
        return Q.resolve(result).nodeify(callback);
    }

    function getProject(projectId, callback) {
        var projectData = projects[projectId];
        if (!projectData) {
            return Q.reject(new Error('no such project [' + projectId + ']')).nodeify(callback);
        }
        projectData.hooks = projectData.hooks || {};
        return Q.resolve(projectData).nodeify(callback);
    }

    function addProject(ownerId, projectName, info, callback) {
        var id = storageUtil.getProjectIdFromOwnerIdAndProjectName(ownerId, projectName),
            data;

        if (typeof info === 'function') {
            callback = info;
            info = {};
        }

        if (projects[id]) {
            return Q.reject(new Error('Project already exists ' + id + ' in _projects collection')).nodeify(callback);
        }

        data = {
            _id: id,
            owner: ownerId,
            name: projectName,
            info: info || {},
            hooks: {}
        };
        projects[id] = data;

        return Q.resolve(id).nodeify(callback);
    }

    function deleteProject(projectId, callback) {
        if (!projects[projectId]) {
            return Q.resolve({ deletedCount: 0 }).nodeify(callback);
        }
        delete projects[projectId];
        return Q.resolve({ deletedCount: 1 }).nodeify(callback);
    }

    function transferProject(projectId, newOwnerId, info, callback) {
        var projectInfo,
            projectName,
            newProjectId,
            hooks;

        if (typeof info === 'function') {
            callback = info;
            info = undefined;
        }

        logger.debug('transferProject: projectId, newOrgOrUserId', projectId, newOwnerId);

        return getProject(projectId)
            .then(function (projectData) {
                projectInfo = info || projectData.info;
                projectName = projectData.name;
                hooks = projectData.hooks;

                return addProject(newOwnerId, projectName, projectInfo);
            })
            .then(function (newProjectId_) {
                newProjectId = newProjectId_;
                return Q.all([
                    deleteProject(projectId),
                    self.updateProjectHooks(newProjectId, hooks)
                ]);
            })
            .then(function () {
                return newProjectId;
            })
            .nodeify(callback);
    }

    function duplicateProject(projectId, ownerId, projectName, info, callback) {
        var newProjectId,
            hooks;

        if (typeof info === 'function') {
            callback = info;
            info = undefined;
        }

        return getProject(projectId)
            .then(function (oldData) {
                hooks = oldData.hooks;
                return addProject(ownerId, projectName, info || oldData.info);
            })
            .then(function (id_) {
                newProjectId = id_;
                return self.updateProjectHooks(newProjectId, hooks);
            })
            .then(function () {
                return newProjectId;
            })
            .nodeify(callback);
    }

    function updateProjectInfo(projectId, info, callback) {
        var projectData = projects[projectId];
        if (!projectData) {
            return Q.reject(new Error('no such project [' + projectId + ']')).nodeify(callback);
        }

        CONSTANTS.STORAGE.PROJECT_INFO_KEYS.forEach(function (infoKey) {
            projectData.info[infoKey] = info[infoKey] || projectData.info[infoKey];
        });

        return getProject(projectId).nodeify(callback);
    }

    function _ensureValidEvents(events) {
        var i;

        if (events instanceof Array === false) {
            if (events !== 'all') {
                throw new Error('Event [' + events + '] is not an array and not "all"');
            }
        } else {
            for (i = 0; i < events.length; i += 1) {
                if (Object.hasOwn(CONSTANTS.WEBHOOK_EVENTS, events[i]) === false) {
                    throw new Error('Event [' + events[i] + '] not among valid events. Valid events: ' +
                        Object.keys(CONSTANTS.WEBHOOK_EVENTS));
                }
            }
        }
    }

    function getProjectHooks(projectId, callback) {
        return getProject(projectId)
            .then(function (projectData) {
                return projectData.hooks;
            })
            .nodeify(callback);
    }

    function updateProjectHooks(projectId, hooks, callback) {
        var projectData = projects[projectId];
        if (!projectData) {
            return Q.reject(new Error('no such project [' + projectId + ']')).nodeify(callback);
        }

        projectData.hooks = hooks;

        return getProject(projectId).nodeify(callback);
    }

    function getProjectHook(projectId, hookId, callback) {
        return getProjectHooks(projectId)
            .then(function (hooks) {
                if (typeof hookId !== 'string' || !hookId) {
                    throw new Error('hookId empty or not a string [' + hookId + ']');
                }

                if (Object.hasOwn(hooks, hookId) === false) {
                    throw new Error('no such hook [' + hookId + ']');
                }

                return hooks[hookId];
            })
            .nodeify(callback);
    }

    function addProjectHook(projectId, hookId, data, callback) {
        return getProjectHooks(projectId)
            .then(function (hooks) {
                var now = (new Date()).toISOString(),
                    hookData = {
                        createdAt: now,
                        updatedAt: now,
                        active: true,
                        description: 'No description given',
                        events: []
                    };

                if (typeof hookId !== 'string' || !hookId) {
                    throw new Error('hookId empty or not a string [' + hookId + ']');
                }

                if (typeof data.url !== 'string' || !data.url) {
                    throw new Error('data.url empty or not a string [' + data.url + ']');
                }

                if (data.events) {
                    _ensureValidEvents(data.events);
                }

                if (Object.hasOwn(hooks, hookId) === true) {
                    throw new Error('hook already exists [' + hookId + ']');
                }

                hookData.url = data.url;

                if (data.active === false) {
                    hookData.active = false;
                }

                hookData.description = data.description || hookData.description;
                hookData.events = data.events || hookData.events;

                hooks[hookId] = hookData;

                return updateProjectHooks(projectId, hooks);
            })
            .then(function (projectData) {
                return projectData.hooks[hookId];
            })
            .nodeify(callback);
    }

    function updateProjectHook(projectId, hookId, data, callback) {
        return getProjectHooks(projectId)
            .then(function (hooks) {
                if (typeof hookId !== 'string' || !hookId) {
                    throw new Error('hookId empty or not a string [' + hookId + ']');
                }

                if (!hooks[hookId]) {
                    throw new Error('no such hook [' + hookId + ']');
                }

                if (data.url) {
                    if (typeof data.url !== 'string') {
                        throw new Error('data.url not a string [' + data.url + ']');
                    }

                    hooks[hookId].url = data.url;
                }

                if (data.events) {
                    _ensureValidEvents(data.events);

                    hooks[hookId].events = data.events;
                }

                if (data.active === false) {
                    hooks[hookId].active = false;
                }

                hooks[hookId].description = data.description || hooks[hookId].description;

                hooks[hookId].updatedAt = (new Date()).toISOString();

                return updateProjectHooks(projectId, hooks);
            })
            .then(function () {
                return getProjectHook(projectId, hookId);
            })
            .nodeify(callback);
    }

    function removeProjectHook(projectId, hookId, callback) {
        return getProjectHooks(projectId)
            .then(function (hooks) {
                if (typeof hookId !== 'string' || !hookId) {
                    throw new Error('hookId empty or not a string [' + hookId + ']');
                }

                if (Object.hasOwn(hooks, hookId) === false) {
                    throw new Error('no such hook [' + hookId + ']');
                }

                delete hooks[hookId];

                return updateProjectHooks(projectId, hooks);
            })
            .then(function (projectData) {
                return projectData.hooks;
            })
            .nodeify(callback);
    }

    self.start = start;
    self.stop = stop;

    self.getProjects = getProjects;
    self.getProject = getProject;
    self.addProject = addProject;
    self.deleteProject = deleteProject;
    self.transferProject = transferProject;
    self.duplicateProject = duplicateProject;
    self.updateProjectInfo = updateProjectInfo;

    self.getProjectHooks = getProjectHooks;
    self.getProjectHook = getProjectHook;
    self.addProjectHook = addProjectHook;
    self.updateProjectHooks = updateProjectHooks;
    self.updateProjectHook = updateProjectHook;
    self.removeProjectHook = removeProjectHook;
}

module.exports = MemoryMetadataStorage;
