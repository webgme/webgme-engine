/*globals requireJS*/
/*eslint-env node*/

const msal = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const GUID = requireJS('common/util/guid');



class WebGMEAADClient {
    constructor(gmeConfig, gmeAuth, logger) {
        this.__logger = logger.fork('AADClient');
        this.__gmeConfig = gmeConfig;
        this.__gmeAuth = gmeAuth;
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
            scopes: ['user.read', 'offline_access'],
            redirectUri: 'http://localhost:8888/aad',
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
            redirectUri: 'http://localhost:8888/aad',
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
            })
            .then(token => {
                //save it to the token
                res.cookie(this.__gmeConfig.authentication.jwt.cookieId, token);
                callback(null);
            })
            .catch(error => {
                this.__logger.error(error);
                callback(error);
            });
    }
}

module.exports = WebGMEAADClient;