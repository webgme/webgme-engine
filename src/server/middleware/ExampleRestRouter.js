/*eslint-env node*/
/**
 * To use in the server add the following to the gme config;
 * gmeConfig.rest.component['path/subPath'] = './middleware/ExampleRestRouter'.
 * It will the expose, e.g. GET <host>/path/subPath/getExample, when running the server.
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

// http://expressjs.com/en/guide/routing.html
var express = require('express'),
    router = express.Router(),
    Q = require('q');

const WebsocketRouter = require('./websocket-router/WebsocketRouter');
const webgme = require('../../../index');
//const StorageUtil = webgme.requirejs('common/storage/util');
const Core = webgme.requirejs('common/core/coreQ');

let pingTimer = null;
let wsRouter = null;
let websocket = null;
/**
 * Called when the server is created but before it starts to listening to incoming requests.
 * N.B. gmeAuth, safeStorage and workerManager are not ready to use until the start function is called.
 * (However inside an incoming request they are all ensured to have been initialized.)
 *
 * @param {object} middlewareOpts - Passed by the webgme server.
 * @param {GmeConfig} middlewareOpts.gmeConfig - GME config parameters.
 * @param {GmeLogger} middlewareOpts.logger - logger
 * @param {function} middlewareOpts.ensureAuthenticated - Ensures the user is authenticated.
 * @param {function} middlewareOpts.getUserId - If authenticated retrieves the userId from the request.
 * @param {object} middlewareOpts.gmeAuth - Authorization module.
 * @param {object} middlewareOpts.safeStorage - Accesses the storage and emits events (PROJECT_CREATED, COMMIT..).
 * @param {object} middlewareOpts.workerManager - Spawns and keeps track of "worker" sub-processes.
 */
function initialize(middlewareOpts) {
    var logger = middlewareOpts.logger.fork('ExampleRestRouter'),
        ensureAuthenticated = middlewareOpts.ensureAuthenticated,
        getUserId = middlewareOpts.getUserId,
        safeStorage = middlewareOpts.safeStorage;

    websocket = middlewareOpts.webSocket;

    logger.debug('initializing ...');

    // Ensure authenticated can be used only after this rule.
    router.use('*', function (req, res, next) {
        // TODO: set all headers, check rate limit, etc.

        // This header ensures that any failures with authentication won't redirect.
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // Use ensureAuthenticated if the routes require authentication. (Can be set explicitly for each route.)
    router.use('*', ensureAuthenticated);

    router.get('/getExample', function (req, res/*, next*/) {
        var userId = getUserId(req);

        res.json({userId: userId, message: 'get request was handled'});
    });

    router.patch('/patchExample', function (req, res/*, next*/) {
        res.sendStatus(200);
    });


    router.post('/postExample', function (req, res/*, next*/) {
        res.sendStatus(201);
    });

    router.delete('/deleteExample', function (req, res/*, next*/) {
        res.sendStatus(204);
    });

    router.get('/error', function (req, res, next) {
        next(new Error('error example'));
    });

    // This example shows how routers can access projects, make modifications, and commit those changes.
    router.get('/updateExample/:projectId', function (req, res) {
        const userId = getUserId(req);
        // the complete object that will contain all necessary info to start manipulating the project
        const context = {}; 
        // Checking if the project in question is valid
        safeStorage.getProjects({username: userId})
            .then(result => {
                // result is an array where every element has projectId, owner, and projectName fields
                let found = false;
                result.forEach(project => {
                    if (project._id === req.params.projectId) {
                        found = true;
                    }
                });
                if (!found) {
                    throw new Error('Unknown project...');
                }

                return safeStorage.openProject({
                    username: userId,
                    projectId: req.params.projectId
                });
            })
            .then(userProject => {
                context.project = userProject;
                context.core = new Core(userProject, {
                    globConf: middlewareOpts.gmeConfig,
                    logger: logger.fork('core')
                });
                return userProject.getBranches();
            })
            .then((/*branches*/) => {
                // this is optional if we know the name of the branch, or if it is an input
                // the branches will be a name - commitHash collection so all branches can be opened
                context.branchName = 'master';
                return context.project.getCommitObject('master');
            })
            .then(commitObject => {
                //the commit object contains all important hashes
                context.commitObject = commitObject;

                return context.core.loadRoot(commitObject.root);
            })
            .then(root => {
                // now that we loaded the root node, any update can happen
                context.root = root;

                // We just call the example function, that accepts the context and creates 
                // a new FCO instance directly under the root node

                return doExampleUpdate(context);
            })
            .then(() => {
                // we will use the same context to create a commit and update the branch
                const persisted = context.core.persist(context.root);

                return context.project.makeCommit(
                    context.branchName,
                    [context.commitObject._id],
                    persisted.rootHash,
                    persisted.objects,
                    'example update finished');
            })
            .then(result => {
                // We expect a SYNCED result, otherwise we either forked or something bad happened.
                // example result: { status: 'SYNCED', hash: '#fd692cc9ac18153149e9c53906cad13017aaebae' }
                if (result.status !== 'SYNCED') {
                    throw new Error('cannot update project');
                }

                res.sendStatus(200);
            })
            .catch(error => {
                logger.error(error);
                res.sendStatus(404);
            });
    });

    logger.debug('ready');
}

/**
 * Called before the server starts listening.
 * @param {function} callback
 */
function start(callback) {
    wsRouter = new WebsocketRouter(websocket, 'ExampleRestRouter');


    wsRouter.onConnect((user, callback) => {
        let pongTimer = setInterval(() => {
            user.send('ping-ping');
        }, 50);

        setTimeout(() => {
            clearInterval(pongTimer);
            user.disconnect(new Error('timeout baby'));
        }, 500);

        user.onMessage((payload, callback) => {
            if (payload === 'ping') {
                callback(null, 'pong');
            } else {
                callback(new Error('unknown message'));
            }
        });

        user.onDisconnect((cause, callback) => {
            clearInterval(pongTimer);
            callback(null);
        });

        callback(null);
    });
    
    pingTimer = setInterval(() => {
        if (wsRouter) {
            wsRouter.send('ping');
        }
    }, 100);

    callback();
}

/**
 * Called after the server stopped listening.
 * @param {function} callback
 */
function stop(callback) {
    if (pingTimer) {
        clearInterval(pingTimer);
        wsRouter.disconnect(new Error('shutting down...'));
    }
    callback();
}
/**
 * This function creates an FCO instance as a child of the root
 * @param {object} projectContext 
 */
function doExampleUpdate(projectContext) {
    const deferred = Q.defer();
    const FCOPath = '/1'; // the meta dictionary should always be traversed to get the proper info!!!
    const core = projectContext.core;
    let root = projectContext.root;
    const metaNodes = core.getAllMetaNodes(root);

    core.createNode({
        parent: root,
        base: metaNodes[FCOPath]
    });
    deferred.resolve();
}

module.exports = {
    initialize: initialize,
    router: router,
    start: start,
    stop: stop
};