/*globals requireJS*/
/*eslint-env node*/

const msal = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const GUID = requireJS('common/util/guid');
const Q = require('q');

// const DATALAKE_SCOPE = 'api://52094e65-d33d-4c6b-bd32-943bf4adec13/LeapDataLakeScope';


class WebGMEAADClient {
    constructor(gmeConfig, gmeAuth, logger) {
        this.__logger = logger.fork('AADClient');
        this.__gmeConfig = gmeConfig;
        this.__gmeAuth = gmeAuth;
        this.__authScopes = ['openid', 'email', 'profile'];
        this.__acccessScope = [];
        if (gmeConfig.authentication.azureActiveDirectory.accessScope) {
            this.__authScopes.push(gmeConfig.authentication.azureActiveDirectory.accessScope);
            this.__acccessScope = [gmeConfig.authentication.azureActiveDirectory.accessScope];
        } else {
            this.__acccessScope = ['openid'];
        }

        this.__redirectUri = gmeConfig.authentication.azureActiveDirectory.redirectUri || 'http://localhost:8888/aad';
        this.__activeDirectoryConfig = {
            auth: {
                clientId: gmeConfig.authentication.azureActiveDirectory.clientId,
                authority: gmeConfig.authentication.azureActiveDirectory.authority,
                clientSecret: gmeConfig.authentication.azureActiveDirectory.clientSecret,
                // protocolMode: 'OIDC'
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
            scopes: this.__authScopes,
            redirectUri: this.__redirectUri,
            responseMode: 'form_post'
        };
        this.__activeDirectoryClient.getAuthCodeUrl(authCodeUrlParameters)
            .then((response) => {
                // console.log(req.query);
                // console.log('QUERY:', req.query.redirect);
                res.cookie('webgme-redirect', req.query.redirect || '');
                res.redirect(response);
            })
            .catch((error) => {
                this.__logger.error('Unable to authenticate with AAD!', error);
                res.sendStatus(401);
            });
    }

    getUserIdFromEmail(email) {
        let uid = 'aadid_' + email;
        uid = uid.replace(/@/g, '_at_').replace(/\./g, '_p_').replace(/-/g, '_d_').toLowerCase();
        return uid;
    }

    cacheUser(req, res, callback) {
        this.__logger.error('caching user');
        let uid = null;
        let claims = null;
        const tokenRequest = {
            code: req.body.code,
            scopes: this.__authScopes,
            redirectUri: this.__redirectUri
        };
        this.__activeDirectoryClient.acquireTokenByCode(tokenRequest)
            .then((response) => {
                //TODO we might want to enhance user id deduction, but for now it should suffice
                // console.log('initial claim: ', response);
                claims = response.idTokenClaims;
                uid = this.getUserIdFromEmail(claims.email);
                this.__logger.error('caching user: ', uid);
                return this.__gmeAuth.listUsers();
                
            })
            .then(users => {
                //TODO should be an easier way to search for the user...
                this.__logger.error('caching user: user list arrived');
                let userFound = false;
                let options = {};
                users.forEach(userData => {
                    // console.log(userData);
                    if (userData.email === claims.email) {
                        userFound = true;
                    } else if (claims.oid === userData.aadId) {
                        // unfortunately the user email might change over time
                        // and the only permanent identification is the oid
                        // so let us hope we catch those here adn adjust our lookup
                        userFound = true;
                        uid = userData._id;
                    }

                    //bugfix as some user was initially created without email...
                    if (userData._id === uid) {
                        options.overwrite = true;
                    }
                });

                if (userFound) {
                    return this.__gmeAuth.getUser(uid); 
                } else {
                    options = {aadId: claims.oid};
                    if (claims.name) {
                        options.displayName = claims.name;
                    }
                    return this.__gmeAuth.addUser(uid, claims.email, GUID(), true, options);
                }
            })
            .then(() => {
                //no matter if it was a new user or an existing one, let's create a token for it
                this.__logger.error('caching user - user added');
                return this.__gmeAuth.generateJWTokenForAuthenticatedUser(uid);
            })
            .then(token => {
                // console.log('WEBGME-TOKEN:', token);
                this.__logger.error('caching user- wtoken generated');
                res.cookie(this.__gmeConfig.authentication.jwt.cookieId, token);
                return this.__activeDirectoryClient.getTokenCache().getAccountByLocalId(claims.oid);
                
            })
            .then(account => {
                const tokenRequest = {
                    scopes: this.__acccessScope,
                    account: account,
                    forceRefresh: true
                };
                this.__logger.error('caching user - we have account');
                return this.__activeDirectoryClient.acquireTokenSilent(tokenRequest);
            })
            .then(token => {
                this.__logger.error('caching user - we have aad-token');
                res.cookie(this.__gmeConfig.authentication.azureActiveDirectory.cookieId, token.accessToken);

                callback(null);
            })
            .catch(error => {
                // console.log(error);
                this.__logger.error(error);
                callback(error);
            });
    }

    getAccessToken(uid, callback) {
        // console.log('chk001');
        const deferred = Q.defer();
        this.__gmeAuth.getUser(uid)
            .then(userData => {
                // console.log('chk002');
                // console.log(userData);
                this.__logger.error('getting AAD token - 001 - ', userData);
                if (userData.hasOwnProperty('aadId')) {
                    this.__logger.error('getting AAD token - 002 - ');
                    // console.log('chk003');
                    return this.__activeDirectoryClient.getTokenCache().getAccountByLocalId(userData.aadId);
                } else {
                    // console.log('chk004');
                    this.__logger.error('getting AAD token - 003 - ');
                    throw new Error('Not AAD user, cannot retrieve accessToken');
                }
            })
            .then(account => {
                // console.log(account);
                this.__logger.error('getting AAD token - 004 - ', account);
                if (!account) {
                    const err = new Error('Cannot retrive token silently without account being cached!');
                    err.name = 'MissingAADAccountForTokenError';

                    throw err;
                }
                const tokenRequest = {
                    scopes: this.__acccessScope,
                    account: account,
                    forceRefresh: true
                };
                return this.__activeDirectoryClient.acquireTokenSilent(tokenRequest);
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