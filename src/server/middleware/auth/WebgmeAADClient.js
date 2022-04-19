/*globals requireJS*/
/*eslint-env node*/

const msal = require('@azure/msal-node');


class WebGMEAADClient {
    constructor(gmeConfig, logger) {
        this.__logger = logger.fork('AADClient');
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


        return this;
    }

    login(req, res) {
        const authCodeUrlParameters = {
            scopes: ['user.read'],
            redirectUri: 'http://localhost:8888/aad',
            responseMode: 'form_post'
        };
        console.log('kecso001');
        this.__activeDirectoryClient.getAuthCodeUrl(authCodeUrlParameters)
            .then((response) => {
                console.log('kecso002', response);
                res.location(response);
                res.set('Access-Control-Allow-Origin', 'https://login.microsoftonline.com');
                res.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
                res.set('Access-Control-Allow-Headers', 'Special-Request-Header');
                res.set('Access-Control-Allow-Credentials', true);
                res.sendStatus(302);
                // res.redirect(response);
            })
            .catch((error) => {
                this.__logger.error('Unable to authenticate with AAD!', error);
                res.sendStatus(401);
            });
    }

    cacheUser(req, callback) {
        const tokenRequest = {
            code: req.body.code,
            scopes: ['user.read'],
            redirectUri: 'http://localhost:8888/aad',
        };
        this.__activeDirectoryClient.acquireTokenByCode(tokenRequest)
            .then((response) => {
                this.__logger.error(response);
                //TODO maybe we need to generate the token here, pass it back and then standalone can store it
                callback(null);
            })
            .catch(callback);
    }
}

module.exports = WebGMEAADClient;