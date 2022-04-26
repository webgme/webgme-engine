/*globals requireJS*/
/*eslint-env node*/

const msal = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const GUID = requireJS('common/util/guid');
const Q = require('q');

const DATALAKE_SCOPE = "api://52094e65-d33d-4c6b-bd32-943bf4adec13/LeapDataLakeScope";


class WebGMEAADClient {
    constructor(gmeConfig, gmeAuth, logger) {
        this.__logger = logger.fork('AADClient');
        this.__gmeConfig = gmeConfig;
        this.__gmeAuth = gmeAuth;
        this.__redirectUri = gmeConfig.authentication.azureActiveDirectory.redirectUri || 'http://localhost:8888/aad';
        this.__activeDirectoryConfig = {
            auth: {
                clientId: gmeConfig.authentication.azureActiveDirectory.clientId,
                authority: gmeConfig.authentication.azureActiveDirectory.authority,
                clientSecret: gmeConfig.authentication.azureActiveDirectory.clientSecret
            },
            system: {
                loggerOptions: {
                    loggerCallback(loglevel, message/*, containsPii*/) {
                        logger.debug(message);
                    },
                    piiLoggingEnabled: false,
                    logLevel: msal.LogLevel.Verbose,
                }
            }
        };
        this.__activeDirectoryClient = new msal.ConfidentialClientApplication(this.__activeDirectoryConfig);

        const TokenGenerator = require(gmeConfig.authentication.jwt.tokenGenerator);
        this.__tokenGenerator = new TokenGenerator(logger, gmeConfig, jwt);

        return this;
    }

    login(req, res) {
        const authCodeUrlParameters = {
            scopes: ['user.read', 'offline_access', DATALAKE_SCOPE],
            redirectUri: this.__redirectUri,
            responseMode: 'form_post'
        };
        this.__activeDirectoryClient.getAuthCodeUrl(authCodeUrlParameters)
            .then((response) => {
                console.log('QUERY:',req.query);
                res.cookie('webgme-redirect', req.query.redirect);
                res.redirect(response);
            })
            .catch((error) => {
                this.__logger.error('Unable to authenticate with AAD!', error);
                res.sendStatus(401);
            });
    }

    getUserIdFromEmail(email) {
        let uid = 'aadid_' + email;
        uid = uid.replace(/@/g,'_at_').replace(/\./g,'_p_');
        return uid;
    }

    cacheUser(req, res, callback) {
        let uid = null;
        let claims = null;
        const tokenRequest = {
            code: req.body.code,
            scopes: ['user.read', 'openid', 'email'],
            redirectUri: this.__redirectUri,
        };
        this.__activeDirectoryClient.acquireTokenByCode(tokenRequest)
            .then((response) => {
                //TODO we might want to enhance user id deduction, but for now it should suffice
                claims = response.idTokenClaims;
                uid = this.getUserIdFromEmail(claims.email);
                return this.__gmeAuth.listUsers();
            })
            .then(users => {
                //TODO should be an easier way to search for the user...
                let userFound = false;
                users.forEach(userData => {
                    if (userData.email === claims.email) {
                        userFound = true;
                    }
                });

                if (userFound) {
                    return this.__gmeAuth.getUser(uid); 
                } else {
                    const options = {aadId: claims.oid};
                    if (claims.name) {
                        options.displayName = claims.name;
                    }
                    return this.__gmeAuth.addUser(uid, claims.email, GUID(), true, options);
                }
            })
            .then(userData => {
                //no matter if it was a new user or an existing one, let's create a token for it
                return this.__gmeAuth.generateJWTokenForAuthenticatedUser(uid);
            })/*
            .then(token => {
                const account = this.__activeDirectoryClient.getTokenCache().getAccountByHomeId(claims.oid);
                const tokenRequest = {
                    scopes: [DATALAKE_SCOPE],
                    account: account
                };
                return this.__activeDirectoryClient.acquireTokenSilent(tokenRequest);
            })
            .then(tokenResponse => {
                const https = require('https');
                const options = {
                    headers: {
                        'Authorization': 'Bearer ' + tokenResponse.accessToken,
                    }
                };            
                const req = https.get(new URL('https://leappremonitiondev.azurewebsites.net/v2/Process/ListProcesses?permission=write'), options, (res) => {
                    // console.log(res);
                    console.log('RESPONSECOMINGBACKFROMPDP');
                    res.setEncoding('utf8');
                    console.log(Object.keys(res));
                    console.log(res.statusCode);
                    console.log(res.rawHeaders);
                    console.log(res.body);
                    res.on('data', (chunk) => {
                        console.log(chunk);
                    });
                });
                req.on('error', (err) => {
                    console.log(err);
                    callback(err);
                });
                req.end();
            })*/
            .then(token => {
                //save it to the token
                res.cookie(this.__gmeConfig.authentication.jwt.cookieId, token);
                callback(null);
            })
            .catch(error => {
                console.log(error);
                this.__logger.error(error);
                callback(error);
            });
    }

    getAccessToken(uid, callback) {
        const deferred = Q.defer();
        this.__gmeAuth.getUser(uid)
        .then(userData => {
            console.log(userData);
            if (userData.hasOwnProperty('aadId')) {
                const account = this.__activeDirectoryClient.getTokenCache().getAccountByHomeId(userData.aadId);
                const tokenRequest = {
                    scopes: [DATALAKE_SCOPE],
                    account: account
                };
                return this.__activeDirectoryClient.acquireTokenSilent(tokenRequest);
            } else {
                throw new Error('Not AAD user, cannot retrieve accessToken');
            }
        })
        .then(deferred.resolve)
        .catch(error => {
            this.__logger.error(error);
            deferred.reject(error);
        });

        return deferred.promise.nodeify(callback);
    }
}

module.exports = WebGMEAADClient;