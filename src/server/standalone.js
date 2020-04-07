/*globals requireJS*/
/*eslint-env node*/

/**
 * @module Server:StandAlone
 * @author kecso / https://github.com/kecso
 */

'use strict';

var path = require('path'),
    OS = require('os'),
    Q = require('q'),
    fs = require('fs'),
    Express = require('express'),
    compression = require('compression'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    multipart = require('connect-multiparty'),
    Http = require('http'),
    ejs = require('ejs'),

    MongoAdapter = require('./storage/mongo'),
    RedisAdapter = require('./storage/datastores/redisadapter'),
    MemoryAdapter = require('./storage/memory'),
    Storage = require('./storage/safestorage'),
    WebSocket = require('./storage/websocket'),
    WebhookManager = require('./util/WebhookManager'),

    // Middleware
    BlobServer = require('./middleware/blob/BlobServer'),
    ExecutorServer = require('./middleware/executor/ExecutorServer'),
    TokenServer = require('./middleware/access-tokens/TokenServer'),
    api = require('./api'),

    getClientConfig = require('../../config/getclientconfig'),
    GMEAUTH = require('./middleware/auth/gmeauth'),
    Logger = require('./logger'),

    AddOnEventPropagator = require('../addon/addoneventpropagator'),

    webgmeUtils = require('../utils'),

    servers = [],

    mainLogger,

    CONSTANTS = requireJS('common/Constants'),
    isAbsUrlPath = new RegExp('^(?:[a-z]+:)?//', 'i');

function shutdown() {
    var i,
        error = false,
        numStops = 0;

    function exit(code) {
        process.exit(code);
    }

    function serverOnStop(server) {
        server.stop(function (err) {
            numStops -= 1;
            if (err) {
                error = true;
                server.logger.error('Stopping server failed', {metadata: err});
            } else {
                server.logger.info('Server stopped.');
            }

            if (numStops === 0) {
                if (error) {
                    exit(1);
                } else {
                    exit(0);
                }

            }
        });
    }

    for (i = 0; i < servers.length; i += 1) {
        // stop server gracefully on ctrl+C or cmd+c
        if (servers[i].isRunning) {
            servers[i].logger.info('Requesting server to stop ...');
            numStops += 1;
            serverOnStop(servers[i]);
        }
    }

    if (numStops === 0) {
        exit(0);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function StandAloneServer(gmeConfig) {
    var self = this,
        clientConfig = getClientConfig(gmeConfig),
        excludeRegExs = [],
        routeComponents = [],
        sockets = [],
        nmpPackageJson = webgmeUtils.getPackageJsonSync(),
        logger = null,
        __storage = null,
        __database = null,
        __webSocket = null,
        __gmeAuth = null,
        apiReady,
        __app = null,
        WorkerManager = require(gmeConfig.server.workerManager.path),
        __workerManager,
        __httpServer = null,
        __addOnEventPropagator = null,
        __baseDir = requireJS.s.contexts._.config.baseUrl, // TODO: this is ugly
        __clientBaseDir = path.resolve(gmeConfig.client.appDir),
        // __requestCounter = 0,
        // __reportedRequestCounter = 0,
        // __requestCheckInterval = 2500,
        __tokenServer,
        __executorServer,
        middlewareOpts;

    self.id = Math.random().toString(36).slice(2, 11);

    if (!mainLogger) {
        mainLogger = Logger.createWithGmeConfig('gme', gmeConfig, true);
    }

    mainLogger.info('Node version', process.version);

    gmeConfig.server.log.transports.forEach(function (transport) {
        if (transport.transportType === 'File') {
            mainLogger.info('Logfile [', transport.options.level, '] :', path.resolve(transport.options.filename));
        }
    });

    this.serverUrl = '';
    this.isRunning = false;

    servers.push(this);

    /**
     * Gets the server's url based on the gmeConfig that was given to the constructor.
     * @returns {string}
     */
    function getUrl() {
        if (!self.serverUrl) {
            // use the cached version if we already built the string
            self.serverUrl = 'http://127.0.0.1:' + gmeConfig.server.port;
        }

        return self.serverUrl;
    }

    function getLogInUrl(req) {
        if (isAbsUrlPath.test(gmeConfig.authentication.logInUrl)) {
            return gmeConfig.authentication.logInUrl;
        }
        return getMountedPath(req) + gmeConfig.authentication.logInUrl;
    }

    function getLogOutUrl(req) {
        if (isAbsUrlPath.test(gmeConfig.authentication.logOutUrl)) {
            return gmeConfig.authentication.logOutUrl;
        }
        return getMountedPath(req) + gmeConfig.authentication.logOutUrl;
    }

    //public functions
    function start(callback) {
        var serverDeferred = Q.defer();

        if (typeof callback !== 'function') {
            callback = function () {
            };
        }

        if (self.isRunning) {
            // FIXME: should this be an error?
            callback();
            return;
        }

        sockets = {};

        __httpServer = Http.createServer(__app);

        if (gmeConfig.server.timeout > -1) {
            __httpServer.timeout = gmeConfig.server.timeout;
        }

        function handleNewConnection(socket) {
            var socketId = socket.remoteAddress + ':' + socket.remotePort;

            if (socket.encrypted) { // https://nodejs.org/api/tls.html#tls_tlssocket_encrypted
                socketId += ':encrypted';
            }

            sockets[socketId] = socket;
            logger.debug('socket connected (added to list) ' + socketId);

            socket.on('close', function () {
                if (sockets.hasOwnProperty(socketId)) {
                    logger.debug('socket closed (removed from list) ' + socketId);
                    delete sockets[socketId];
                }
            });
        }

        __httpServer.on('connection', handleNewConnection);
        __httpServer.on('secureConnection', handleNewConnection);

        __httpServer.on('clientError', function (err/*, socket*/) {
            logger.debug('clientError', err);
        });

        __httpServer.on('error', function (err) {
            if (err.code === 'EADDRINUSE') {
                logger.error('Failed to start server', {metadata: {port: gmeConfig.server.port, error: err}});
                serverDeferred.reject(err);
            } else {
                logger.error('Server raised an error', {metadata: {port: gmeConfig.server.port, error: err}});
            }
        });

        logger.debug('starting server');

        __gmeAuth.connect()
            .then(function (db) {
                var promises = [];

                logger.debug('gmeAuth connected');

                promises.push(Q.ninvoke(__workerManager, 'start'));
                promises.push(__storage.openDatabase());

                if (__executorServer) {
                    promises.push(__executorServer.start({mongoClient: db}));
                }
                if (__tokenServer) {
                    promises.push(__tokenServer.start({mongoClient: db}));
                }

                return Q.all(promises);
            })
            .then(function () {
                var promises = [];
                __webSocket.start(__httpServer);

                promises.push(apiReady);

                routeComponents.forEach(function (component) {
                    promises.push(Q.ninvoke(component, 'start'));
                });

                return Q.all(promises);
            })
            .then(function () {
                // Finally start listening to the server port.
                __httpServer.listen(gmeConfig.server.handle || gmeConfig.server.port, function () {
                    logger.info('Server is listening ...');
                    serverDeferred.resolve();
                });

                return serverDeferred.promise;
            })
            .then(function () {
                return webgmeUtils.createStartUpProjects(gmeConfig, __gmeAuth, __storage, logger, getUrl());
            })
            .nodeify(function (err) {
                self.isRunning = true;
                if (err) {
                    logger.error('Error at server start', err);
                }

                callback(err);
            });
    }

    function stop(callback) {
        var serverDeferred = Q.defer(),
            key;

        if (self.isRunning === false) {
            // FIXME: should this be an error?
            callback();
            return;
        }

        self.isRunning = false;

        // request server close - do not accept any new connections.
        __httpServer.close(function (err) {
            if (err) {
                // First check applies to node >= 10. Second one to node < 10.
                if (err.code === 'ERR_SERVER_NOT_RUNNING' || err.message.indexOf('Not running') > -1) {
                    // It's not running which is what we want.
                    serverDeferred.resolve();
                } else {
                    serverDeferred.reject(err);
                }
            } else {
                serverDeferred.resolve();
            }
        });

        // first we have to request the close then we can destroy the sockets.
        var numDestroyedSockets = 0;
        // destroy all open sockets i.e. keep-alive and socket-io connections, etc.
        for (key in sockets) {
            if (sockets.hasOwnProperty(key)) {
                sockets[key].destroy();
                delete sockets[key];
                logger.debug('destroyed open socket ' + key);
                numDestroyedSockets += 1;
            }
        }

        logger.debug('destroyed # of sockets: ' + numDestroyedSockets);

        return serverDeferred.promise
            .then(function () {
                var promises = [];

                __webSocket.stop();

                if (__executorServer) {
                    __executorServer.stop();
                }

                routeComponents.forEach(function (component) {
                    promises.push(Q.ninvoke(component, 'stop'));
                });

                return Q.all(promises);
            })
            .then(function () {
                return Q.all([
                    __storage.closeDatabase(),
                    Q.ninvoke(__workerManager, 'stop')
                ]);
            })
            .then(function () {
                return __gmeAuth.unload();
            })
            .nodeify(function (err) {
                if (err) {
                    logger.error('Error at server stop', err);
                }

                if (callback) {
                    callback(err);
                }
            });
    }

    this.start = start;
    this.stop = stop;

    //internal functions
    function getUserId(req) {
        return req.userData && req.userData.userId;
    }

    function ensureAuthenticated(req, res, next) {
        var authorization = req.get('Authorization'),
            username,
            password,
            token,
            split;

        if (gmeConfig.authentication.enable === false) {
            // If authentication is turned off we treat everybody as a guest user.
            req.userData = {
                userId: gmeConfig.authentication.guestAccount
            };
            next();
            return;
        }

        if (authorization && authorization.indexOf('Basic') === 0) {
            logger.debug('Basic authentication request');
            // FIXME: ':' should not be in username nor in password
            split = Buffer.from(authorization.substr('Basic '.length), 'base64').toString('utf8').split(':');
            username = split[0];
            password = split[1];
            if (username && password) {
                __gmeAuth.authenticateUser(username, password)
                    .then(function () {
                        req.userData = {
                            userId: username
                        };
                        next();
                    })
                    .catch(function (err) {
                        logger.debug('Basic auth failed', {metadata: err});
                        res.status(401);
                        next(new Error('Basic authentication failed'));
                    });
            } else {
                res.status(401);
                next(new Error('Basic authentication failed'));
            }
        } else if (authorization && authorization.indexOf('Bearer ') === 0) {
            logger.debug('Token Bearer authentication request');
            token = authorization.substr('Bearer '.length);
            __gmeAuth.verifyJWToken(token)
                .then(function (result) {
                    if (result.renew === true) {
                        __gmeAuth.regenerateJWToken(token)
                            .then(function (newToken) {
                                req.userData = {
                                    token: newToken,
                                    newToken: true,
                                    userId: result.content.userId
                                };

                                // TODO: Is this the correct way of doing it?
                                res.header(gmeConfig.authentication.jwt.cookieId, newToken);
                                next();
                            })
                            .catch(next);
                    } else {
                        req.userData = {
                            token: token,
                            userId: result.content.userId
                        };
                        next();
                    }
                })
                .catch(function (err) {
                    if (err.name === 'TokenExpiredError') {
                        if (res.getHeader('X-WebGME-Media-Type') || !gmeConfig.authentication.logInUrl) {
                            res.status(401);
                            next(err);
                        } else {
                            res.redirect(getLogInUrl(req));
                        }
                    } else {
                        logger.error('Cookie verification failed', {metadata: err});
                        res.status(401);
                        next(err);
                    }
                });
        } else if (req.query.token) {
            logger.debug('jwtoken provided in url query string');
            token = req.query.token;
            __gmeAuth.verifyJWToken(token)
                .then(function (result) {
                    if (result.renew === true) {
                        __gmeAuth.regenerateJWToken(token)
                            .then(function (newToken) {
                                req.userData = {
                                    token: newToken,
                                    newToken: true,
                                    userId: result.content.userId
                                };
                                logger.debug('generated new token for user', result.content.userId);
                                res.cookie(gmeConfig.authentication.jwt.cookieId, newToken);
                                // Status code for new token??
                                next();
                            })
                            .catch(next);
                    } else {
                        req.userData = {
                            token: token,
                            userId: result.content.userId
                        };

                        res.cookie(gmeConfig.authentication.jwt.cookieId, token);
                        next();
                    }
                })
                .catch(function (err) {
                    if (err.name === 'TokenExpiredError') {
                        res.clearCookie(gmeConfig.authentication.jwt.cookieId);
                        if (res.getHeader('X-WebGME-Media-Type') || !gmeConfig.authentication.logInUrl) {
                            res.status(401);
                            next(err);
                        } else {
                            res.redirect(getLogInUrl(req));
                        }
                    } else {
                        logger.error('Cookie verification failed', err);
                        res.status(401);
                        next(err);
                    }
                });
        } else if (req.cookies[gmeConfig.authentication.jwt.cookieId]) {
            logger.debug('jwtoken provided in cookie');
            token = req.cookies[gmeConfig.authentication.jwt.cookieId];
            __gmeAuth.verifyJWToken(token)
                .then(function (result) {
                    if (result.renew === true) {
                        __gmeAuth.regenerateJWToken(token)
                            .then(function (newToken) {
                                req.userData = {
                                    token: newToken,
                                    newToken: true,
                                    userId: result.content.userId
                                };
                                logger.debug('generated new token for user', result.content.userId);
                                res.cookie(gmeConfig.authentication.jwt.cookieId, newToken);
                                // Status code for new token??
                                next();
                            })
                            .catch(next);
                    } else {
                        req.userData = {
                            token: token,
                            userId: result.content.userId
                        };
                        next();
                    }
                })
                .catch(function (err) {
                    res.clearCookie(gmeConfig.authentication.jwt.cookieId);
                    if (err.name === 'TokenExpiredError') {
                        if (res.getHeader('X-WebGME-Media-Type') || !gmeConfig.authentication.logInUrl) {
                            res.status(401);
                            next(err);
                        } else {
                            res.redirect(getLogInUrl(req));
                        }
                    } else {
                        logger.error('Cookie verification failed', err);
                        res.status(401);
                        next(err);
                    }
                });
        } else if (gmeConfig.authentication.allowGuests) {
            logger.debug('jwtoken not provided in cookie - will generate a guest token.');
            __gmeAuth.generateJWToken(gmeConfig.authentication.guestAccount, null)
                .then(function (guestToken) {
                    req.userData = {
                        token: guestToken,
                        newToken: true,
                        userId: gmeConfig.authentication.guestAccount
                    };

                    res.cookie(gmeConfig.authentication.jwt.cookieId, guestToken);
                    next();
                })
                .catch(next);
        } else if (res.getHeader('X-WebGME-Media-Type') || !gmeConfig.authentication.logInUrl) {
            // do not redirect with direct api access or if no login url is specified
            res.status(401);
            return next(new Error());
        } else {
            res.redirect(getLogInUrl(req) + webgmeUtils.getRedirectUrlParameter(req));
        }
    }

    function setupExternalRestModules() {
        var keys = Object.keys(gmeConfig.rest.components),
            restComponent,
            mount,
            src,
            i;

        logger.debug('initializing external REST modules');
        for (i = 0; i < keys.length; i++) {
            if (typeof gmeConfig.rest.components[keys[i]] === 'string') {
                mount = keys[i];
                src = gmeConfig.rest.components[keys[i]];
            } else {
                mount = gmeConfig.rest.components[keys[i]].mount;
                src = gmeConfig.rest.components[keys[i]].src;
            }

            restComponent = require(src);

            if (restComponent) {
                logger.debug('Mounting external REST component [' + src + '] at /' + mount);

                if (restComponent.hasOwnProperty('initialize') && restComponent.hasOwnProperty('router')) {
                    restComponent.initialize(middlewareOpts);
                    __app.use('/' + mount, restComponent.router);

                    if (restComponent.hasOwnProperty('start') && restComponent.hasOwnProperty('stop')) {
                        routeComponents.push(restComponent);
                    } else {
                        logger.warn('Deprecated restRouter, [' + src + '] does not have start/stop methods.');
                    }
                } else {
                    logger.warn('Deprecated restComponent [' + src + '], use the RestRouter instead.');
                    __app.use('/' + mount, restComponent(gmeConfig, ensureAuthenticated, logger));
                }
            } else {
                throw new Error('Loading rest component ' + gmeConfig.rest.components[keys[i]] + ' failed.');
            }
        }
    }

    function mountUserManagementPage() {
        var userComponent = require(gmeConfig.authentication.userManagementPage);
        userComponent.initialize(middlewareOpts);
        routeComponents.push(userComponent);
        __app.use('/profile', userComponent.router);
    }

    function getMountedPath(req) {
        return req.header(CONSTANTS.HTTP_HEADERS.MOUNTED_PATH) || '';
    }

    function processRequestBasedGMEConfigFields(baseConfig, req) {
        baseConfig.client.mountedPath = getMountedPath(req);
        return baseConfig;
    }

    //here starts the main part
    //variables

    //creating the logger
    logger = mainLogger.fork('server:standalone');
    self.logger = logger;

    logger.debug('starting standalone server initialization');
    //initializing https extra infos

    //logger.debug('initializing session storage');
    //__sessionStore = new SSTORE(logger, gmeConfig);

    logger.debug('initializing server worker manager');
    __workerManager = new WorkerManager({
        gmeConfig: gmeConfig,
        logger: logger
    });

    logger.debug('initializing authentication modules');
    //TODO: do we need to create this even though authentication is disabled?
    // FIXME: we need to connect with gmeAUTH again! start/stop/start/stop
    __gmeAuth = new GMEAUTH(null, gmeConfig);

    logger.debug('initializing static server');
    __app = new Express();

    if (gmeConfig.storage.database.type.toLowerCase() === 'mongo') {
        __database = new MongoAdapter(logger, gmeConfig);
    } else if (gmeConfig.storage.database.type.toLowerCase() === 'redis') {
        __database = new RedisAdapter(logger, gmeConfig);
    } else if (gmeConfig.storage.database.type.toLowerCase() === 'memory') {
        __database = new MemoryAdapter(logger, gmeConfig);
    } else {
        logger.error(new Error('Unknown storage.database.type in config (config validator not used?)',
            gmeConfig.storage.database.type));
    }

    __storage = new Storage(__database, logger, gmeConfig, __gmeAuth);
    __webSocket = new WebSocket(__storage, logger, gmeConfig, __gmeAuth, __workerManager);

    if (gmeConfig.webhooks.enable) {
        routeComponents.push(new WebhookManager(__storage, logger, gmeConfig));
    }

    if (gmeConfig.addOn.enable) {
        __addOnEventPropagator = new AddOnEventPropagator(__storage, logger, gmeConfig);
        routeComponents.push(__addOnEventPropagator);
    }

    middlewareOpts = {  //TODO: Pass this to every middleware They must not modify the options!
        gmeConfig: gmeConfig,
        logger: logger,
        server: null,
        ensureAuthenticated: ensureAuthenticated,
        getUserId: getUserId,
        getMountedPath: getMountedPath,
        gmeAuth: __gmeAuth,
        safeStorage: __storage,
        workerManager: __workerManager,
        addOnEventPropagator: __addOnEventPropagator,
        webSocket: __webSocket
    };

    //__app.configure(function () {
    //counting of requests works only in debug mode
    // if (gmeConfig.debug === true) {
    //     setInterval(function () {
    //         if (__reportedRequestCounter !== __requestCounter) {
    //             __reportedRequestCounter = __requestCounter;
    //             logger.debug('...handled ' + __reportedRequestCounter + ' requests so far...');
    //         }
    //     }, __requestCheckInterval);
    //     __app.use(function (req, res, next) {
    //         __requestCounter++;
    //         next();
    //     });
    // }

    // __app.use(function (req, res, next) {
    //     console.log(req.url);
    //     next();
    // });

    __app.use(compression());
    __app.use(cookieParser());
    __app.use(bodyParser.json(gmeConfig.server.bodyParser.json));
    __app.use(bodyParser.urlencoded({
        extended: true
    }));
    __app.use(methodOverride());
    __app.use(multipart({defer: true})); // required to upload files. (body parser should not be used!)

    __tokenServer = new TokenServer(middlewareOpts);
    __app.use('/rest/tokens', __tokenServer.router);
    middlewareOpts.accessTokens = __tokenServer.tokens;

    if (gmeConfig.executor.enable) {
        __executorServer = new ExecutorServer(middlewareOpts);
        __app.use('/rest/executor', __executorServer.router);
    } else {
        logger.debug('Executor not enabled. Add \'executor.enable: true\' to configuration to activate.');
    }

    if (gmeConfig.authentication.enable === true && gmeConfig.authentication.userManagementPage) {
        mountUserManagementPage();
    }

    setupExternalRestModules();

    __app.get(['', '/', '/index.html'], ensureAuthenticated, function (req, res) {
        var indexHtmlPath = path.join(__clientBaseDir, 'index.html'),
            protocol = gmeConfig.server.behindSecureProxy ? 'https' : 'http',
            host = protocol + '://' + req.get('host'),
            url = host + req.originalUrl,
            imageUrl = host + '/img/gme-logo.png',
            projectId = req.query.project;

        logger.debug('resolved url', url);

        fs.readFile(indexHtmlPath, 'utf8', function (err, indexTemp) {
            if (err) {
                logger.error(err);
                res.sendStatus(404);
            } else {
                res.contentType('text/html');
                //http://stackoverflow.com/questions/49547/how-to-control-web-page-caching-across-all-browsers
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
                res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
                res.setHeader('Expires', '0'); // Proxies.

                res.send(ejs.render(indexTemp, {
                    webgmeVersion: nmpPackageJson.version,
                    appVersion: gmeConfig.client.appVersion,
                    mountedPath: req.header('X-Proxy-Mounted-Path') || '',
                    url: url,
                    imageUrl: imageUrl,
                    projectId: projectId ? projectId.replace('+', '/') : 'WebGME',
                    favicon: gmeConfig.client.faviconPath,
                    pageTitle: typeof gmeConfig.client.pageTitle === 'string' ? gmeConfig.client.pageTitle : 'WebGME'
                }));
            }
        });
    });

    logger.debug('creating login routing rules for the static server');

    __app.get('/logout', function (req, res) {
        var redirectUrl,
            logOutUrl = '';
        if (gmeConfig.authentication.enable === false) {
            res.sendStatus(404);
        } else {
            redirectUrl = req.query.redirectUrl;
            if (gmeConfig.authentication.logOutUrl) {
                logOutUrl = getLogOutUrl(req);
            }

            res.clearCookie(gmeConfig.authentication.jwt.cookieId);
            res.redirect(logOutUrl || redirectUrl || getLogInUrl(req) || '/');
        }
    });

    __app.post('/login', function (req, res) {
        var userId = req.body.userId,
            password = req.body.password;

        if (gmeConfig.authentication.enable) {
            __gmeAuth.generateJWToken(userId, password)
                .then(function (token) {
                    res.cookie(gmeConfig.authentication.jwt.cookieId, token);
                    res.sendStatus(200);
                })
                .catch(function (err) {
                    logger.error('Failed login', err);
                    res.sendStatus(401);
                });
        } else {
            res.sendStatus(404);
        }
    });

    // TODO: review/revisit this part when google authentication is used.
    //__app.get('/login/google', checkGoogleAuthentication, Passport.authenticate('google'));
    //__app.get('/login/google/return', __gmeAuth.authenticate, function (req, res) {
    //    res.cookie('webgme', req.session.udmId);
    //    redirectUrl(req, res);
    //});

    //TODO: only node_worker/index.html and common/util/common are using this
    //logger.debug('creating decorator specific routing rules');
    __app.get('/bin/getconfig.js', ensureAuthenticated, function (req, res) {
        res.status(200);
        res.setHeader('Content-type', 'application/javascript');
        res.end('define([],function(){ return ' +
            JSON.stringify(processRequestBasedGMEConfigFields(clientConfig, req)) + ';});');
    });

    logger.debug('creating gmeConfig.json specific routing rules');
    __app.get('/gmeConfig.json', function (req, res) {
        res.status(200);
        res.setHeader('Content-type', 'application/json');
        res.end(JSON.stringify(processRequestBasedGMEConfigFields(clientConfig, req)));
    });

    __app.get(/^\/(gme-dist)\/.*\.(js|map)$/, function (req, res) {
        var resolvedPath = path.join(__baseDir, '../dist', req.url.substring('/gme-dist/'.length));
        res.sendFile(resolvedPath);
    });

    logger.debug('creating decorator specific routing rules');
    __app.get(/^\/decorators\/.*/, ensureAuthenticated, function (req, res) {
        var tryNext = function (index) {
            var resolvedPath;
            if (index < gmeConfig.visualization.decoratorPaths.length) {
                resolvedPath = path.resolve(gmeConfig.visualization.decoratorPaths[index]);
                resolvedPath = path.join(resolvedPath, req.url.substring('/decorators/'.length));
                res.sendFile(resolvedPath, function (err) {
                    logger.debug('sending decorator', resolvedPath);
                    if (err && err.code !== 'ECONNRESET') {
                        tryNext(index + 1);
                    }
                });
            } else {
                res.sendStatus(404);
            }
        };

        if (gmeConfig.visualization.decoratorPaths && gmeConfig.visualization.decoratorPaths.length) {
            tryNext(0);
        } else {
            res.sendStatus(404);
        }
    });

    // Plugin paths
    logger.debug('creating plugin specific routing rules');
    __app.get(/^\/plugin\/.*/, webgmeUtils.getGoodExtraAssetRouteFor('plugin',
        gmeConfig.plugin.basePaths, logger, __baseDir));

    // Layout paths
    logger.debug('creating layout specific routing rules');
    __app.get(/^\/layout\/.*/, webgmeUtils.getGoodExtraAssetRouteFor('layout',
        gmeConfig.visualization.layout.basePaths, logger, __baseDir));

    // Panel paths
    logger.debug('creating panel specific routing rules');
    __app.get(/^\/panel\/.*/, webgmeUtils.getRouteFor('panel', gmeConfig.visualization.panelPaths, __baseDir, logger));

    // Assets paths (svgs)
    logger.debug('creating assets/svgs specific routing rules');
    __app.get(/^\/assets\/DecoratorSVG\/.*/, ensureAuthenticated, function (req, res, next) {
        webgmeUtils.getSVGMap(gmeConfig, logger)
            .then(function (svgMap) {
                if (svgMap.hasOwnProperty(req.path)) {
                    res.sendFile(svgMap[req.path]);
                } else {
                    logger.warn('Requested DecoratorSVG not found', req.path);
                    res.sendStatus(404);
                }
            })
            .catch(next);
    });

    __app.get('/assets/decoratorSVGList.json', ensureAuthenticated, function (req, res, next) {
        webgmeUtils.getSVGMap(gmeConfig, logger)
            .then(function (svgMap) {
                res.json(Object.keys(svgMap).map(function (svgName) {
                    return svgName.substring('/assets/DecoratorSVG/'.length);
                }));
            })
            .catch(function (err) {
                logger.error(err);
                next(err);
            });
    });

    logger.debug('creating external library specific routing rules');
    gmeConfig.server.extlibExcludes.forEach(function (regExStr) {
        logger.debug('Adding exclude rule to "/extlib" path: ', regExStr);
        excludeRegExs.push(new RegExp(regExStr));
    });

    __app.get(/^\/extlib\/.*/, ensureAuthenticated, function (req, res) {
        var i;
        for (i = 0; i < excludeRegExs.length; i += 1) {
            if (excludeRegExs[i].test(req.url)) {
                logger.warn('Request attempted to access excluded path "' + req.url + '", caught by "' +
                    gmeConfig.server.extlibExcludes[i] + '" from gmeConfig.');
                res.sendStatus(403);
                return;
            }
        }

        //first we try to give back the common extlib/modules
        var urlArray = req.path.split('/');
        urlArray[1] = '.';
        urlArray.shift();

        var relPath = urlArray.join('/');
        var absPath = path.resolve(path.join(process.cwd(), relPath));
        // must pass the full path
        if (relPath.lastIndexOf('/') === relPath.length - 1) {
            // if URL ends with /, append / to support sending index.html
            absPath = absPath + '/';
        }

        webgmeUtils.expressFileSending(res, absPath, logger);
    });

    logger.debug('creating basic static content related routing rules');
    //static contents
    Express.static.mime.define({'application/wasm': ['wasm']});
    __app.get(/^\/(common|client)\/.*\.(js|wasm)$/, Express.static(__baseDir, {index: false}));

    //TODO remove this part as this is only temporary!!!
    __app.get('/docs/*', Express.static(path.join(__baseDir, '..'), {index: false}));

    __app.use('/rest/blob', BlobServer.createExpressBlob(middlewareOpts));

    //client contents - js/html/css
    __app.get(/^\/.*\.(css|ico|ttf|woff|woff2|js|cur)$/, Express.static(__clientBaseDir));

    // cacheManifest = 'CACHE MANIFEST\n\n#' + nmpPackageJson.version + '\n' +
    //     '/dist/webgme.' + nmpPackageJson.version + '.dist.main.css\n' +
    //     '/dist/webgme.' + nmpPackageJson.version + '.lib.build.js\n'+
    //     '/dist/webgme.' + nmpPackageJson.version + '.dist.build.js\n' +
    //     'NETWORK:\n*';
    //
    // __app.get('/webgme.dist.' + nmpPackageJson.version + '.appcache', function (req, res) {
    //     res.set('Content-Type', 'text/cache-manifest');
    //     res.send(cacheManifest);
    // });

    __app.get('/package.json', ensureAuthenticated, Express.static(path.join(__baseDir, '..')));
    __app.get(/^\/.*\.(_js|html|gif|png|bmp|svg|json|map)$/, ensureAuthenticated, Express.static(__clientBaseDir));

    logger.debug('creating API related routing rules');

    apiReady = api.createAPI(__app, '/api', middlewareOpts);

    // everything else is 404
    logger.debug('creating all other request rule - error 404 -');
    __app.use('*', function (req, res) {
        res.sendStatus(404);
    });

    // catches all next(new Error()) from previous rules, you can set res.status() before you call next(new Error())
    // eslint-disable-next-line
    __app.use(function (err, req, res, next) {
        if (res.statusCode === 200) {
            res.status(err.status || 500);
        }
        res.sendStatus(res.statusCode);
        //res.send(err.stack ? err.stack : err); // FIXME: in dev mode
    });

    logger.debug('gmeConfig of webgme server', {metadata: gmeConfig});
    var networkIfs = OS.networkInterfaces(),
        addresses = [],
        forEveryNetIf = function (netIf) {
            if (netIf.family === 'IPv4') {
                addresses.push('http://' + netIf.address + ':' + gmeConfig.server.port);
            }
        };

    for (var dev in networkIfs) {
        networkIfs[dev].forEach(forEveryNetIf);
    }

    logger.info('Valid addresses of gme web server: ', addresses.join('  '));
    logger.debug('standalone server initialization completed');

    var module = {
        getAddresses: function () {
            return addresses;
        },
        getSocketsInfo: function () {
            return Object.keys(sockets)
                .map(function (sid) {
                    return {
                        address: sockets[sid].address(),
                        localAddress: sockets[sid].localAddress,
                        localPort: sockets[sid].localPort,
                        remoteAddress: sockets[sid].remoteAddress,
                        remotePort: sockets[sid].remotePort,
                    };
                });
        },
        getUrl: getUrl,
        getGmeConfig: function () {
            return gmeConfig;
        },
        start: start,
        stop: stop,
        _setIsRunning: function (value) {
            self.isRunning = value;
        },
        isRunning: function () {
            return self.isRunning;
        }
    };

    middlewareOpts.server = module;

    return module;
}

module.exports = StandAloneServer;
