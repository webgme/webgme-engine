/*globals requireJS*/
/*eslint-env node*/

const msal = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const GUID = requireJS('common/util/guid');
const Q = require('q');
const aadVerify = require('azure-ad-verify-token-commonjs').verify;

class WebGMEAADClient {
    constructor(gmeConfig, gmeAuth, logger) {
        this.__logger = logger.fork('AADClient');
        this.__gmeConfig = gmeConfig;
        this.__gmeAuth = gmeAuth;
        this.__authScopes = ['openid', 'email', 'profile'];
        if (gmeConfig.authentication.azureActiveDirectory.accessScope) {
            this.__authScopes.push(gmeConfig.authentication.azureActiveDirectory.accessScope);
        }

        this.__redirectUri = gmeConfig.authentication.azureActiveDirectory.redirectUri;
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
                this.__logger.info('caching AAD user: ', uid);
                return this.__gmeAuth.listUsers();
                
            })
            .then(users => {
                let userFound = false;
                let options = {};
                users.forEach(userData => {
                    // console.log(userData);
                    if (userData.email === claims.email) {
                        userFound = true;
                        //making sure no weird discrepancy with capital letters
                        uid = userData._id; 
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
                return this.__gmeAuth.generateJWTokenForAuthenticatedUser(uid);
            })
            .then(token => {
                res.cookie(this.__gmeConfig.authentication.jwt.cookieId, token);
                return this.__activeDirectoryClient.getTokenCache().getAccountByLocalId(claims.oid);
                
            })
            .then(account => {
                if (!this.__gmeConfig.authentication.azureActiveDirectory.accessScope) {
                    return Q(null);
                }
                const tokenRequest = {
                    scopes: [this.__gmeConfig.authentication.azureActiveDirectory.accessScope],
                    account: account,
                    forceRefresh: true
                };
                return this.__activeDirectoryClient.acquireTokenSilent(tokenRequest);
            })
            .then(token => {
                if (token) {
                    res.cookie(this.__gmeConfig.authentication.azureActiveDirectory.cookieId, token.accessToken);
                }
                callback(null);
            })
            .catch(error => {
                this.__logger.error(error);
                callback(error);
            });
    }

    getAccessToken(uid, currentToken, callback) {
        const deferred = Q.defer();
        let aadId = null;
        const genNewToken = () => {
            const newDef = Q.defer();            
            this.__activeDirectoryClient.getTokenCache().getAccountByLocalId(aadId)
                .then(account => {
                    // this.__logger.info('getting AAD token - 004 - ', account);
                    if (!account) {
                        const err = new Error('Cannot retrive token silently without account being cached!');
                        err.name = 'MissingAADAccountForTokenError';
                        throw err;
                    }
                    const tokenRequest = {
                        scopes: [this.__gmeConfig.authentication.azureActiveDirectory.accessScope],
                        account: account,
                        forceRefresh: true
                    };
                    return this.__activeDirectoryClient.acquireTokenSilent(tokenRequest);
                })
                .then(newDef.resolve)
                .catch(error => {
                    this.__logger.error(error);
                    newDef.reject(error);
                });

            return newDef.promise;
        };

        const vOptions = {
            jwksUri: this.__gmeConfig.authentication.azureActiveDirectory.jwksUri, 
            issuer: this.__gmeConfig.authentication.azureActiveDirectory.issuer,
            audience: this.__gmeConfig.authentication.azureActiveDirectory.audience
        };

        this.__gmeAuth.getUser(uid)
            .then(userData => {
                if (!Object.hasOwn(userData, 'aadId')) {
                    // not AAD based user -> return null
                    deferred.resolve(null);
                }
                
                if (!this.__gmeConfig.authentication.azureActiveDirectory.accessScope) {
                    // AAD only used for authenticating the user, so no need for access token
                    deferred.resolve(null);
                }

                aadId = userData.aadId;
                if (currentToken) {
                    return aadVerify(currentToken, vOptions);
                }

                return Q(null);
            })
            .then(token => {
                if (token) {
                    if (token.iss === this.__gmeConfig.authentication.azureActiveDirectory.issuer && 
                        token.aud === this.__gmeConfig.authentication.azureActiveDirectory.audience &&
                        token.exp - (Date.now() / 1000) > 0) {
                        return Q({accessToken: currentToken});
                    } else {
                        //the token cannot be used anymore
                        return genNewToken();
                    }
                } else {
                    return genNewToken();
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