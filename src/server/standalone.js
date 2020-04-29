/*globals requireJS*/
/*eslint-env node*/

/**
 * @module Server:StandAlone
 * @author kecso / https://github.com/kecso
 */

'use strict';

const path = require('path');
const OS = require('os');
const Q = require('q');
const fs = require('fs');
const Express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const multipart = require('connect-multiparty');
const Http = require('http');
const ejs = require('ejs');

const MongoAdapter = require('./storage/mongo');
const RedisAdapter = require('./storage/datastores/redisadapter');
const MemoryAdapter = require('./storage/memory');
const Storage = require('./storage/safestorage');
const WebSocket = require('./storage/websocket');
const WebhookManager = require('./util/WebhookManager');

// Middleware
const BlobServer = require('./middleware/blob/BlobServer');
const ExecutorServer = require('./middleware/executor/ExecutorServer');
const TokenServer = require('./middleware/access-tokens/TokenServer');
const API = require('./api');
const Mailer = require('./middleware/mailer/mailer');

const getClientConfig = require('../../config/getclientconfig');
const GmeAuth = require('./middleware/auth/gmeauth');
const Logger = require('./logger');

const AddOnEventPropagator = require('../addon/addoneventpropagator');
const webgmeUtils = require('../utils');
const servers = [];
const CONSTANTS = requireJS('common/Constants');
const isAbsUrlPath = new RegExp('^(?:[a-z]+:)?//', 'i');

let mainLogger;
const shutdown = () => {
    let i;
    let error;
    let numStops = 0;

    const serverOnStop = (server) => {
        server.stop((err) => {
            numStops -= 1;
            if (err) {
                error = true;
                server.logger.error('Stopping server failed', {metadata: err});
            } else {
                server.logger.info('Server stopped.');
            }

            if (numStops === 0) {
                if (error) {
                    process.exit(1);
                } else {
                    process.exit(0);
                }

            }
        });
    };

    servers.forEach(server => {
        if (server.isRunning) {
            numStops += 1;
        }
    });

    if (numStops === 0) {
        process.exit(0);
    }

    servers.forEach(server => {
        if (server.isRunning) {
            server.logger.info('Requesting server to stop ...');
            serverOnStop(server);
        }
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

class StandAloneServer {
    constructor(gmeConfig) {
        // config based includes
        const WorkerManager = require(gmeConfig.server.workerManager.path);
        // class field initializations
        this.__gmeConfig = gmeConfig;
        this.__clientConfig = getClientConfig(gmeConfig);
        this.__isRunning = false;
        this.__httpServer = null;
        this.__app = new Express();
        this.__gmeAuth = new GmeAuth(null, gmeConfig);
        this.__database = null;
        this.__serverUrl = '';
        this.__routeComponents = [];
        this.__tokenServer = null;
        this.__executorServer = null;
        this.__baseDir = requireJS.s.contexts._.config.baseUrl; // TODO: this is ugly
        this.__clientBaseDir = path.resolve(gmeConfig.client.appDir);
        this.__nmpPackageJson = webgmeUtils.getPackageJsonSync();
        this.__excludeRegExs = [];
        this.__sockets = {};

        this.__middlewareOptions = {
            gmeConfig: gmeConfig,
            gmeAuth: this.__gmeAuth,
        };

        if (!mainLogger) {
            mainLogger = Logger.createWithGmeConfig('gme', gmeConfig, true);
            mainLogger.info('Node version', process.version);
    
            gmeConfig.server.log.transports.forEach(function (transport) {
                if (transport.transportType === 'File') {
                    mainLogger.info('Logfile [', transport.options.level, '] :', 
                        path.resolve(transport.options.filename));
                }
            });
        }
        this.__logger = mainLogger.fork('server:standalone');
        this.__middlewareOptions.logger = this.__logger;
        this.__logger.debug('Starting server initialization');

        this.__mailer = new Mailer(this.__logger, gmeConfig, this.__gmeAuth);

        this.__logger.debug('Initializing worker manager');
        this.__workerManager = new WorkerManager({
            gmeConfig: gmeConfig,
            logger: this.__logger,
        });

        this.__logger.debug('Initializing storage back-end');
        if (gmeConfig.storage.database.type.toLowerCase() === 'mongo') {
            this.__database = new MongoAdapter(this.__logger, gmeConfig);
        } else if (gmeConfig.storage.database.type.toLowerCase() === 'redis') {
            this.__database = new RedisAdapter(this.__logger, gmeConfig);
        } else if (gmeConfig.storage.database.type.toLowerCase() === 'memory') {
            this.__database = new MemoryAdapter(this.__logger, gmeConfig);
        } else {
            this.__logger.error(new Error('Unknown storage.database.type in config (config validator not used?)',
                gmeConfig.storage.database.type));
        }
        this.__storage = new Storage(this.__database, this.__logger, gmeConfig, this.__gmeAuth);
        this.__webSocket = new WebSocket(
            this.__storage,
            this.__logger,
            gmeConfig,
            this.__gmeAuth,
            this.__workerManager
        );

        this.__middlewareOptions.safeStorage = this.__storage;
        this.__middlewareOptions.workerManager = this.__workerManager;
        this.__middlewareOptions.webSocket = this.__webSocket;

        this.__logger.debug('Initializing basic core route functions');
        this.__app.use(compression());
        this.__app.use(cookieParser());
        this.__app.use(bodyParser.json(gmeConfig.server.bodyParser.json));
        this.__app.use(bodyParser.urlencoded({extended: true}));
        this.__app.use(methodOverride());
        this.__app.use(multipart({defer: true})); // required to upload files. (body parser should not be used!)

        this.__logger.debug('Collecting valid self-addresses');
        const networkIfs = OS.networkInterfaces();
        this.__addresses = [];
        for (let netId in networkIfs) {
            networkIfs[netId].forEach(network => {
                if (network.family === 'IPv4') {
                    this.__addresses.push('http://' + network.address + ':' + gmeConfig.server.port);
                }
            });
        }
        this.__logger.info('Valid addresses of gme web server: ', this.__addresses.join('  '));

        if (gmeConfig.webhooks.enable) {
            this.__routeComponents.push(new WebhookManager(this.__storage, this.__logger, gmeConfig));
        }
    
        if (gmeConfig.addOn.enable) {
            this.__addOnEventPropagator = new AddOnEventPropagator(this.__storage, this.__logger, gmeConfig);
            this.__routeComponents.push(this.__addOnEventPropagator);
        }
    }

    getUrl() {
        if (!this.__serverUrl) {
            // use the cached version if we already built the string
            this.__serverUrl = 'http://127.0.0.1:' + this.__gmeConfig.server.port;
        }
        return this.__serverUrl;
    }
    
    getAddresses() {
        return this.__addresses;
    }

    getGmeConfig() {
        return this.__gmeConfig;
    }

    _setIsRunning(value) {
        this.__isRunning = value === true;
    }

    isRunning() {
        return this.__isRunning;
    }

    start(callback) {
        const deferred = Q.defer();
        const {
            __gmeConfig,
            __gmeAuth,
            __logger,
            __app,
            __routeComponents,
            __baseDir,
            __clientBaseDir,
            __nmpPackageJson,
            __clientConfig,
            __excludeRegExs,
            __mailer,
            __workerManager,
            __storage,
            __webSocket,
        } = this;
        let {
            __middlewareOptions,
            __tokenServer,
            __executorServer,
            __httpServer,
            __sockets,
            // eslint-disable-next-line no-unused-vars
            __isRunning,
        } = this;
        const getUserId = req => {
            return req.userData && req.userData.userId;
        };
    
        const getMountedPath = req => {
            return req.header(CONSTANTS.HTTP_HEADERS.MOUNTED_PATH) || '';
        };

        const getLogInUrl = req => {
            if (isAbsUrlPath.test(__gmeConfig.authentication.logInUrl)) {
                return __gmeConfig.authentication.logInUrl;
            }
            return getMountedPath(req) + __gmeConfig.authentication.logInUrl;
        };
    
        const getLogOutUrl = req => {
            if (isAbsUrlPath.test(__gmeConfig.authentication.logOutUrl)) {
                return __gmeConfig.authentication.logOutUrl;
            }
            return getMountedPath(req) + __gmeConfig.authentication.logOutUrl;
        };

        const ensureAuthenticated = (req, res, next) => {
            const authorization = req.get('Authorization');
            let username;
            let password;
            let token;
            let split;
    
            if (__gmeConfig.authentication.enable === false) {
                // If authentication is turned off we treat everybody as a guest user.
                req.userData = {
                    userId: __gmeConfig.authentication.guestAccount
                };
                next();
                return;
            }
    
            if (authorization && authorization.indexOf('Basic') === 0) {
                __logger.debug('Basic authentication request');
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
                            __logger.debug('Basic auth failed', {metadata: err});
                            res.status(401);
                            next(new Error('Basic authentication failed'));
                        });
                } else {
                    res.status(401);
                    next(new Error('Basic authentication failed'));
                }
            } else if (authorization && authorization.indexOf('Bearer ') === 0) {
                __logger.debug('Token Bearer authentication request');
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
                                    res.header(__gmeConfig.authentication.jwt.cookieId, newToken);
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
                            __logger.error('Cookie verification failed', {metadata: err});
                            res.status(401);
                            next(err);
                        }
                    });
            } else if (req.query.token) {
                __logger.debug('jwtoken provided in url query string');
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
                                    __logger.debug('generated new token for user', result.content.userId);
                                    res.cookie(__gmeConfig.authentication.jwt.cookieId, newToken);
                                    next();
                                })
                                .catch(next);
                        } else {
                            req.userData = {
                                token: token,
                                userId: result.content.userId
                            };
    
                            res.cookie(__gmeConfig.authentication.jwt.cookieId, token);
                            next();
                        }
                    })
                    .catch(function (err) {
                        if (err.name === 'TokenExpiredError') {
                            res.clearCookie(__gmeConfig.authentication.jwt.cookieId);
                            if (res.getHeader('X-WebGME-Media-Type') || !__gmeConfig.authentication.logInUrl) {
                                res.status(401);
                                next(err);
                            } else {
                                res.redirect(getLogInUrl(req));
                            }
                        } else {
                            __logger.error('Cookie verification failed', err);
                            res.status(401);
                            next(err);
                        }
                    });
            } else if (req.cookies[__gmeConfig.authentication.jwt.cookieId]) {
                __logger.debug('jwtoken provided in cookie');
                token = req.cookies[__gmeConfig.authentication.jwt.cookieId];
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
                                    __logger.debug('generated new token for user', result.content.userId);
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
                        res.clearCookie(__gmeConfig.authentication.jwt.cookieId);
                        if (err.name === 'TokenExpiredError') {
                            if (res.getHeader('X-WebGME-Media-Type') || !__gmeConfig.authentication.logInUrl) {
                                res.status(401);
                                next(err);
                            } else {
                                res.redirect(getLogInUrl(req));
                            }
                        } else {
                            __logger.error('Cookie verification failed', err);
                            res.status(401);
                            next(err);
                        }
                    });
            } else if (__gmeConfig.authentication.allowGuests) {
                __logger.debug('jwtoken not provided in cookie - will generate a guest token.');
                __gmeAuth.generateJWToken(__gmeConfig.authentication.guestAccount, null)
                    .then(function (guestToken) {
                        req.userData = {
                            token: guestToken,
                            newToken: true,
                            userId: __gmeConfig.authentication.guestAccount
                        };
    
                        res.cookie(__gmeConfig.authentication.jwt.cookieId, guestToken);
                        next();
                    })
                    .catch(next);
            } else if (res.getHeader('X-WebGME-Media-Type') || !__gmeConfig.authentication.logInUrl) {
                // do not redirect with direct api access or if no login url is specified
                res.status(401);
                return next(new Error());
            } else {
                res.redirect(getLogInUrl(req) + webgmeUtils.getRedirectUrlParameter(req));
            }
        };
    
        const setupExternalRestModules = () => {
            const keys = Object.keys(__gmeConfig.rest.components);
    
            __logger.debug('Initializing external REST modules');
            keys.forEach(componentId => {
                let restComponent;
                let mount;
                let src;
                if (typeof __gmeConfig.rest.components[componentId] === 'string') {
                    mount = componentId;
                    src = __gmeConfig.rest.components[componentId];
                } else {
                    mount = __gmeConfig.rest.components[componentId].mount;
                    src = __gmeConfig.rest.components[componentId].src;
                }

                restComponent = require(src);

                if (restComponent) {
                    __logger.debug('Mounting external REST component [' + src + '] at /' + mount);
    
                    if (restComponent.hasOwnProperty('initialize') && restComponent.hasOwnProperty('router')) {
                        restComponent.initialize(__middlewareOptions);
                        __app.use('/' + mount, restComponent.router);
    
                        if (restComponent.hasOwnProperty('start') && restComponent.hasOwnProperty('stop')) {
                            __routeComponents.push(restComponent);
                        } else {
                            __logger.warn('Deprecated restRouter, [' + src + '] does not have start/stop methods.');
                        }
                    } else {
                        __logger.warn('Deprecated restComponent [' + src + '], use the RestRouter instead.');
                        __app.use('/' + mount, restComponent(__gmeConfig, ensureAuthenticated, __logger));
                    }
                } else {
                    throw new Error('Loading rest component ' + __gmeConfig.rest.components[componentId] + ' failed.');
                }
            });
        };
    
        const mountUserManagementPage = () => {
            var userComponent = require(__gmeConfig.authentication.userManagementPage);
            userComponent.initialize(__middlewareOptions);
            __routeComponents.push(userComponent);
            __app.use('/profile', userComponent.router);
        };
    
        const processRequestBasedGMEConfigFields = (baseConfig, req) => {
            baseConfig.client.mountedPath = getMountedPath(req);
            return baseConfig;
        };

        // starting gmeAuth and the mailer service...
        const coreInit = () => {
            const deferred = Q.defer();

            __middlewareOptions.ensureAuthenticated = ensureAuthenticated;
            __middlewareOptions.getUserId = getUserId;
            __middlewareOptions.getMountedPath = getMountedPath;

            if (__gmeConfig.mailer.enable) {
                __mailer.init()
                    .then(() => {
                        __middlewareOptions.mailer = __mailer;
                    })
                    .catch(err => {
                        __logger.info('Failed to start mail service!', {metadata: err});
                    })
                    .finally(deferred.resolve);
            } else {
                __logger.debug('No mail service was configured');
                deferred.resolve();
            }
            
            return deferred.promise;
        };

        // adding all routes
        const buildRoutes = () => {
            __tokenServer = new TokenServer(__middlewareOptions);
            __app.use('/rest/tokens', __tokenServer.router);
            __middlewareOptions.accessTokens = __tokenServer.tokens;

            if (__gmeConfig.executor.enable) {
                __executorServer = new ExecutorServer(__middlewareOptions);
                __app.use('/rest/executor', __executorServer.router);
            } else {
                __logger.debug('Executor not enabled. Add \'executor.enable: true\' to configuration to activate.');
            }

            if (__gmeConfig.authentication.enable === true && __gmeConfig.authentication.userManagementPage) {
                mountUserManagementPage();
            }

            setupExternalRestModules();

            __app.get(['', '/', '/index.html'], ensureAuthenticated, function (req, res) {
                const indexHtmlPath = path.join(__clientBaseDir, 'index.html');
                const protocol = __gmeConfig.server.behindSecureProxy ? 'https' : 'http';
                const host = protocol + '://' + req.get('host');
                const url = host + req.originalUrl;
                const imageUrl = host + '/img/gme-logo.png';
                const projectId = req.query.project;
        
                __logger.debug('resolved url', url);
        
                fs.readFile(indexHtmlPath, 'utf8', function (err, indexTemp) {
                    if (err) {
                        __logger.error(err);
                        res.sendStatus(404);
                    } else {
                        res.contentType('text/html');
                        //http://stackoverflow.com/questions/49547/how-to-control-web-page-caching-across-all-browsers
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
                        res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
                        res.setHeader('Expires', '0'); // Proxies.
        
                        res.send(ejs.render(indexTemp, {
                            webgmeVersion: __nmpPackageJson.version,
                            appVersion: __gmeConfig.client.appVersion,
                            mountedPath: req.header('X-Proxy-Mounted-Path') || '',
                            url: url,
                            imageUrl: imageUrl,
                            projectId: projectId ? projectId.replace('+', '/') : 'WebGME',
                            favicon: __gmeConfig.client.faviconPath,
                            pageTitle: typeof __gmeConfig.client.pageTitle === 'string' ? __gmeConfig.client.pageTitle : 'WebGME',
                        }));
                    }
                });
            });

            __logger.debug('creating login routing rules for the static server');

            __app.get('/logout', function (req, res) {
                let redirectUrl;
                let logOutUrl = '';

                if (__gmeConfig.authentication.enable === false) {
                    res.sendStatus(404);
                } else {
                    redirectUrl = req.query.redirectUrl;
                    if (__gmeConfig.authentication.logOutUrl) {
                        logOutUrl = getLogOutUrl(req);
                    }

                    res.clearCookie(__gmeConfig.authentication.jwt.cookieId);
                    res.redirect(logOutUrl || redirectUrl || getLogInUrl(req) || '/');
                }
            });

            __app.post('/login', function (req, res) {
                const userId = req.body.userId;
                const password = req.body.password;

                if (__gmeConfig.authentication.enable) {
                    __gmeAuth.generateJWToken(userId, password)
                        .then(token => {
                            res.cookie(__gmeConfig.authentication.jwt.cookieId, token);
                            res.sendStatus(200);
                        })
                        .catch(function (err) {
                            __logger.error('Failed login', err);
                            res.sendStatus(401);
                        });
                } else {
                    res.sendStatus(404);
                }
            });

            __app.get('/bin/getconfig.js', ensureAuthenticated, function (req, res) {
                res.status(200);
                res.setHeader('Content-type', 'application/javascript');
                res.end('define([],function(){ return ' +
                    JSON.stringify(processRequestBasedGMEConfigFields(__clientConfig, req)) + ';});');
            });
        
            __logger.debug('creating gmeConfig.json specific routing rules');
            __app.get('/gmeConfig.json', function (req, res) {
                res.status(200);
                res.setHeader('Content-type', 'application/json');
                res.end(JSON.stringify(processRequestBasedGMEConfigFields(__clientConfig, req)));
            });
        
            __app.get(/^\/(gme-dist)\/.*\.(js|map)$/, function (req, res) {
                res.sendFile(path.join(__baseDir, '../dist', req.url.substring('/gme-dist/'.length)));
            });

            __logger.debug('creating decorator specific routing rules');
            __app.get(/^\/decorators\/.*/, ensureAuthenticated, function (req, res) {
                const tryNext = (index) => {
                    let resolvedPath;
                    if (index < __gmeConfig.visualization.decoratorPaths.length) {
                        resolvedPath = path.resolve(__gmeConfig.visualization.decoratorPaths[index]);
                        resolvedPath = path.join(resolvedPath, req.url.substring('/decorators/'.length));
                        res.sendFile(resolvedPath, function (err) {
                            __logger.debug('sending decorator', resolvedPath);
                            if (err && err.code !== 'ECONNRESET') {
                                tryNext(index + 1);
                            }
                        });
                    } else {
                        res.sendStatus(404);
                    }
                };
        
                if (__gmeConfig.visualization.decoratorPaths && __gmeConfig.visualization.decoratorPaths.length) {
                    tryNext(0);
                } else {
                    res.sendStatus(404);
                }
            });
        
            // Plugin paths
            __logger.debug('creating plugin specific routing rules');
            __app.get(/^\/plugin\/.*/, webgmeUtils.getGoodExtraAssetRouteFor('plugin',
                __gmeConfig.plugin.basePaths, __logger, __baseDir));
        
            // Layout paths
            __logger.debug('creating layout specific routing rules');
            __app.get(/^\/layout\/.*/, webgmeUtils.getGoodExtraAssetRouteFor('layout',
                __gmeConfig.visualization.layout.basePaths, __logger, __baseDir));
        
            // Panel paths
            __logger.debug('creating panel specific routing rules');
            __app.get(/^\/panel\/.*/,
                webgmeUtils.getRouteFor(
                    'panel',
                    __gmeConfig.visualization.panelPaths,
                    __baseDir,
                    __logger
                ));
           
            // Assets paths (svgs)
            __logger.debug('creating assets/svgs specific routing rules');
            __app.get(/^\/assets\/DecoratorSVG\/.*/, ensureAuthenticated, function (req, res, next) {
                webgmeUtils.getSVGMap(__gmeConfig, __logger)
                    .then(function (svgMap) {
                        if (svgMap.hasOwnProperty(req.path)) {
                            res.sendFile(svgMap[req.path]);
                        } else {
                            __logger.warn('Requested DecoratorSVG not found', req.path);
                            res.sendStatus(404);
                        }
                    })
                    .catch(next);
            });

            __app.get('/assets/decoratorSVGList.json', ensureAuthenticated, function (req, res, next) {
                webgmeUtils.getSVGMap(__gmeConfig, __logger)
                    .then(function (svgMap) {
                        res.json(Object.keys(svgMap).map(function (svgName) {
                            return svgName.substring('/assets/DecoratorSVG/'.length);
                        }));
                    })
                    .catch(function (err) {
                        __logger.error(err);
                        next(err);
                    });
            });

            __logger.debug('creating external library specific routing rules');
            __gmeConfig.server.extlibExcludes.forEach(function (regExStr) {
                __logger.debug('Adding exclude rule to "/extlib" path: ', regExStr);
                __excludeRegExs.push(new RegExp(regExStr));
            });

            __app.get(/^\/extlib\/.*/, ensureAuthenticated, function (req, res) {
                var i;
                for (i = 0; i < __excludeRegExs.length; i += 1) {
                    if (__excludeRegExs[i].test(req.url)) {
                        __logger.warn('Request attempted to access excluded path "' + req.url + '", caught by "' +
                            __gmeConfig.server.extlibExcludes[i] + '" from gmeConfig.');
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

                webgmeUtils.expressFileSending(res, absPath, __logger);
            });

            __logger.debug('creating basic static content related routing rules');
            //static contents
            Express.static.mime.define({'application/wasm': ['wasm']});
            __app.get(/^\/(common|client)\/.*\.(js|wasm)$/, Express.static(__baseDir, {index: false}));

            //TODO remove this part as this is only temporary!!!
            __app.get('/docs/*', Express.static(path.join(__baseDir, '..'), {index: false}));

            __app.use('/rest/blob', BlobServer.createExpressBlob(__middlewareOptions));

            //client contents - js/html/css
            __app.get(/^\/.*\.(css|ico|ttf|woff|woff2|js|cur)$/, Express.static(__clientBaseDir));

            __app.get('/package.json', ensureAuthenticated, Express.static(path.join(__baseDir, '..')));
            __app.get(/^\/.*\.(_js|html|gif|png|bmp|svg|json|map)$/, ensureAuthenticated, Express.static(__clientBaseDir));

            __logger.debug('creating API related routing rules');

            const apiReady = API.createAPI(__app, '/api', __middlewareOptions);

            // everything else is 404
            __logger.debug('creating all other request rule - error 404 -');
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

            __logger.debug('gmeConfig of webgme server', {metadata: __gmeConfig});
            __logger.debug('standalone server route initialization completed');


            return apiReady;
        };

        // starting everything else 
        const startListening = () => {
            const deferred = Q.defer();
            const handleNewConnection = socket => {
                let socketId = socket.remoteAddress + ':' + socket.remotePort;
    
                if (socket.encrypted) { // https://nodejs.org/api/tls.html#tls_tlssocket_encrypted
                    socketId += ':encrypted';
                }
    
                __sockets[socketId] = socket;
                __logger.debug('socket connected (added to list) ' + socketId);
    
                socket.on('close', function () {
                    if (__sockets.hasOwnProperty(socketId)) {
                        __logger.debug('socket closed (removed from list) ' + socketId);
                        delete __sockets[socketId];
                    }
                });
            };

            __httpServer = Http.createServer(__app);
            if (__gmeConfig.server.timeout > -1) {
                __httpServer.timeout = __gmeConfig.server.timeout;
            }
    
            __httpServer.on('connection', handleNewConnection);
            __httpServer.on('secureConnection', handleNewConnection);
    
            __httpServer.on('clientError', function (err/*, socket*/) {
                __logger.debug('clientError', err);
            });
    
            __httpServer.on('error', function (err) {
                if (err.code === 'EADDRINUSE') {
                    __logger.error('Failed to start server', {metadata: {port: __gmeConfig.server.port, error: err}});
                    deferred.reject(err);
                } else {
                    __logger.error('Server raised an error', {metadata: {port: __gmeConfig.server.port, error: err}});
                }
            });

            __logger.debug('starting server');

            __gmeAuth.connect()
                .then(db => {
                    const promises = [];

                    __logger.debug('gmeAuth connected');

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
                .then(() => {
                    const promises = [];
                    __webSocket.start(__httpServer);

                    __routeComponents.forEach(function (component) {
                        promises.push(Q.ninvoke(component, 'start'));
                    });

                    return Q.all(promises);
                })
                .then(function () {
                    // Finally start listening to the server port.
                    return Q.ninvoke(__httpServer, 'listen', __gmeConfig.server.handle || __gmeConfig.server.port);
                })
                .then(function () {
                    __logger.info('Server is listening ...');
                    return webgmeUtils.createStartUpProjects(gmeConfig, __gmeAuth, __storage, logger, getUrl());
                })
                .then(() => {
                    __isRunning = true;
                    deferred.resolve();
                })
                .catch(deferred.reject);

            return deferred.promise;
        };

        // actual server start fucntion
        coreInit()
            .then(() => {
                return buildRoutes();
            })
            .then(() => {
                return startListening();
            })
            .then(deferred.resolve)
            .catch(deferred.reject);

        return deferred.promise.nodeify(callback);
    }

    stop(callback) {
        const {
            __logger,
            __httpServer,
            __webSocket,
            __routeComponents,
            __executorServer,
            __storage,
            __workerManager,
            __gmeAuth,
        } = this;
        let {__isRunning, __sockets} = this;
        const deferred = Q.defer();

        if (__isRunning === false) {
            // TODO - should this be an error?
            deferred.resolve();
        } else {
            __isRunning = false;
            Q.ninvoke(__httpServer, 'close')
                .then(() => {
                    // first we have to request the close then we can destroy the sockets.
                    let numDestroyedSockets = 0;
                    // destroy all open sockets i.e. keep-alive and socket-io connections, etc.
                    for (let key in __sockets) {
                        if (__sockets.hasOwnProperty(key)) {
                            __sockets[key].destroy();
                            delete __sockets[key];
                            __logger.debug('destroyed open socket ' + key);
                            numDestroyedSockets += 1;
                        }
                    }
                    __logger.debug('destroyed # of sockets: ' + numDestroyedSockets);

                    const promises = [];
                    
                    __webSocket.stop();
    
                    if (__executorServer) {
                        __executorServer.stop();
                    }
    
                    __routeComponents.forEach(function (component) {
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
                .catch(err => {
                    this.__logger.error('Error at server stop', err);
                    if (err.code === 'ERR_SERVER_NOT_RUNNING' || err.message.indexOf('Not running') > -1) {
                        // It's not running which is what we want.
                        deferred.resolve();
                    } else {
                        deferred.reject(err);
                    }
                });
        }
        return deferred.promise.nodeify(callback);
    }


}

module.exports = StandAloneServer;
