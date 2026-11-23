/*eslint-env node*/
/*eslint no-console: 0*/
/**
 * Example configuration for authenticating WebGME against Google Identity (OIDC / Google & Gmail accounts).
 *
 * Setup:
 *   1. In Google Cloud Console -> APIs & Services -> Credentials -> Create Credentials -> OAuth client ID
 *      (Application type: "Web application"), add authorized redirect URI:
 *      http://localhost:8888/oauth/callback
 *   2. Start MongoDB locally (or set MONGO_URI / edit config.mongo.uri).
 *   3. Run:
 *      OAUTH_CLIENT_ID=<client_id> OAUTH_CLIENT_SECRET=<client_secret> NODE_ENV=oauth-google npm start
 *   4. Open http://localhost:8888 in the browser (use the same host as redirectUri so the state cookie matches).
 */

var config = require('./config.default');

if (process.env.PORT) {
    config.server.port = parseInt(process.env.PORT, 10);
}
if (process.env.MONGO_URI) {
    config.mongo.uri = process.env.MONGO_URI;
}

config.authentication.enable = true;
config.authentication.allowGuests = false;
config.authentication.allowPasswordLogin = false;
config.authentication.logInUrl = '/oauth/login';

config.authentication.oauth = {
    enable: true,
    providerName: 'google',
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    authorizationUrl: null,
    tokenUrl: null,
    userInfoUrl: null,
    endSessionUrl: null,
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || ('http://localhost:' + config.server.port + '/oauth/callback'),
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
    loginRoute: '/oauth/login',
    callbackRoute: '/oauth/callback',
    tokenRoute: '/oauth/token',
    jwksUri: null,
    issuer: null,
    audience: null,
    algorithms: ['RS256'],
    acceptExternalBearerJwt: false,
    claims: {
        subject: 'sub',
        username: 'email',
        email: 'email',
        displayName: 'name',
    },
    userIdPrefix: 'google_',
    autoCreateUser: true,
    usersCanCreate: true,
    stateCookieId: 'webgme_oauth_state',
    stateTtlSec: 600,
    extraAuthorizeParams: {
        prompt: 'select_account',
    },
};

module.exports = config;
