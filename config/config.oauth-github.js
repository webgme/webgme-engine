/*eslint-env node*/
/*eslint no-console: 0*/
/**
 * Example configuration for authenticating WebGME against a GitHub OAuth App.
 *
 * Setup:
 *   1. In GitHub Settings -> Developer settings -> OAuth Apps -> New OAuth App,
 *      set "Authorization callback URL" to: http://localhost:8888/oauth/callback
 *   2. Start MongoDB locally (or set MONGO_URI / edit config.mongo.uri).
 *   3. Run:
 *      OAUTH_CLIENT_ID=<client_id> OAUTH_CLIENT_SECRET=<client_secret> NODE_ENV=oauth-github npm start
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
    providerName: 'github',
    discoveryUrl: null,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    endSessionUrl: null,
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || ('http://localhost:' + config.server.port + '/oauth/callback'),
    scopes: ['read:user', 'user:email'],
    usePKCE: false,
    loginRoute: '/oauth/login',
    callbackRoute: '/oauth/callback',
    tokenRoute: null,
    jwksUri: null,
    issuer: null,
    audience: null,
    algorithms: ['RS256'],
    acceptExternalBearerJwt: false,
    claims: {
        subject: 'id',
        username: 'login',
        email: 'email',
        displayName: 'name',
    },
    userIdPrefix: 'gh_',
    autoCreateUser: true,
    usersCanCreate: true,
    stateCookieId: 'webgme_oauth_state',
    stateTtlSec: 600,
    extraAuthorizeParams: {},
};

module.exports = config;
