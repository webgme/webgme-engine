/*eslint-env node, mocha*/
'use strict';

const net = require('net');
const {URL} = require('url');
const superagent = require('superagent');
const io = require('socket.io-client');
const mongoUri = require('mongo-uri');

const testFixture = require('../_globals');
const WebGME = testFixture.WebGME;
const Q = testFixture.Q;
const expect = testFixture.expect;
const MockOAuthServer = require('./middleware/auth/mockOAuthServer');
const verifyOAuthToken = require('../../src/server/middleware/auth/verifyOAuthToken');

function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            const port = addr.port;
            srv.close(() => resolve(port));
        });
    });
}

function getCookieMap(setCookieHeaders) {
    const map = {};
    const list = Array.isArray(setCookieHeaders) ? setCookieHeaders :
        setCookieHeaders ? [setCookieHeaders] : [];
    list.forEach((raw) => {
        const parts = String(raw).split(';');
        const first = parts[0] || '';
        const eqIdx = first.indexOf('=');
        if (eqIdx > 0) {
            const name = first.substring(0, eqIdx).trim();
            const value = first.substring(eqIdx + 1).trim();
            map[name] = {
                value: value,
                raw: String(raw),
                httpOnly: /;\s*HttpOnly(?:;|$)/i.test(raw),
            };
        }
    });
    return map;
}

describe('standalone server generic external OAuth 2.0 / OIDC', function () {
    this.timeout(15000);

    let mockOAuth = null;
    let server = null;
    let helperAuth = null;
    let mongoClient = null;

    afterEach(async function () {
        verifyOAuthToken.clearCache();
        if (mongoClient) {
            await mongoClient.close();
            mongoClient = null;
        }
        if (server) {
            await Q.ninvoke(server, 'stop');
            server = null;
        }
        if (helperAuth) {
            await Q.ninvoke(helperAuth, 'unload');
            helperAuth = null;
        }
        if (mockOAuth) {
            await mockOAuth.stop();
            mockOAuth = null;
        }
    });

    async function startHarness(options) {
        const opts = options || {};
        mockOAuth = new MockOAuthServer(opts.mockOptions || {});
        await mockOAuth.start();
        if (opts.behavior) {
            mockOAuth.setBehavior(opts.behavior);
        }

        const port = await getFreePort();
        const cfg = testFixture.getGmeConfig();
        cfg.server.port = port;
        cfg.authentication.enable = true;
        cfg.authentication.allowGuests = false;
        cfg.authentication.logInUrl = '/oauth/login';
        cfg.authentication.logOutUrl = '';
        cfg.authentication.oauth = Object.assign({}, cfg.authentication.oauth, {
            enable: true,
            providerName: 'keycloak',
            discoveryUrl: mockOAuth.discoveryUrl,
            clientId: 'webgme-test-client',
            redirectUri: 'http://127.0.0.1:' + port + '/oauth/callback',
            scopes: ['openid', 'profile', 'email'],
            usePKCE: true,
            autoCreateUser: true,
            usersCanCreate: true,
        });

        if (typeof opts.customizeConfig === 'function') {
            opts.customizeConfig(cfg, mockOAuth, port);
        }

        helperAuth = await testFixture.clearDBAndGetGMEAuth(cfg);
        if (typeof opts.preSetup === 'function') {
            await opts.preSetup(helperAuth, cfg, mockOAuth);
        }

        server = WebGME.standaloneServer(cfg);
        await Q.ninvoke(server, 'start');

        return {
            cfg: cfg,
            baseUrl: server.getUrl(),
            port: port,
            mockOAuth: mockOAuth,
            helperAuth: helperAuth,
        };
    }

    async function findUserDocInMongo(cfg, userId) {
        if (!mongoClient) {
            mongoClient = await testFixture.mongodb.MongoClient.connect(cfg.mongo.uri, cfg.mongo.options);
        }
        const db = mongoClient.db(mongoUri.parse(cfg.mongo.uri).database);
        return db.collection('_users').findOne({_id: userId});
    }

    async function performOAuthLogin(agent, baseUrl, loginPath) {
        const startUrl = baseUrl + (loginPath || '/oauth/login');
        const loginRes = await agent.get(startUrl).redirects(0).ok(() => true);
        expect(loginRes.status).to.equal(302);

        const loginCookies = getCookieMap(loginRes.headers['set-cookie']);
        const authorizeUrl = loginRes.headers.location;
        expect(authorizeUrl).to.be.a('string');

        const authRes = await superagent.get(authorizeUrl).redirects(0).ok(() => true);
        expect(authRes.status).to.equal(302);
        const callbackUrl = authRes.headers.location;
        expect(callbackUrl).to.include('/oauth/callback');

        const cbRes = await agent.get(callbackUrl).redirects(0).ok(() => true);
        return {
            loginRes: loginRes,
            loginCookies: loginCookies,
            authorizeUrl: authorizeUrl,
            callbackUrl: callbackUrl,
            cbRes: cbRes,
            cbCookies: getCookieMap(cbRes.headers['set-cookie']),
        };
    }

    it('should complete full OIDC + PKCE login, store no external tokens, create project & run Socket.IO worker',
        async function () {
            const {cfg, baseUrl} = await startHarness();
            const agent = superagent.agent();

            // Unauthenticated landing redirects browser to configured /oauth/login
            const rootRes = await agent.get(baseUrl + '/').redirects(0).ok(() => true);
            expect(rootRes.status).to.equal(302);
            expect(rootRes.headers.location).to.equal('/oauth/login?redirect=%2F');

            // Step through login -> OP -> callback
            const flow = await performOAuthLogin(agent, baseUrl, rootRes.headers.location);

            // Validate PKCE & OIDC parameters sent to OP
            const parsedAuth = new URL(flow.authorizeUrl);
            expect(parsedAuth.searchParams.get('response_type')).to.equal('code');
            expect(parsedAuth.searchParams.get('client_id')).to.equal('webgme-test-client');
            expect(parsedAuth.searchParams.get('code_challenge_method')).to.equal('S256');
            expect(parsedAuth.searchParams.get('code_challenge')).to.be.a('string').and.not.equal('');
            expect(parsedAuth.searchParams.get('state')).to.be.a('string').and.not.equal('');
            expect(parsedAuth.searchParams.get('nonce')).to.be.a('string').and.not.equal('');

            // State cookie is HttpOnly; final JWT cookie is non-HttpOnly for browserclient.js
            expect(flow.loginCookies[cfg.authentication.oauth.stateCookieId]).to.be.an('object');
            expect(flow.loginCookies[cfg.authentication.oauth.stateCookieId].httpOnly).to.equal(true);
            expect(flow.cbRes.status).to.equal(302);
            expect(flow.cbRes.headers.location).to.equal('/');

            const jwtCookie = flow.cbCookies[cfg.authentication.jwt.cookieId];
            expect(jwtCookie).to.be.an('object');
            expect(jwtCookie.value).to.be.a('string').and.not.equal('');
            expect(jwtCookie.httpOnly).to.equal(false);
            expect(flow.cbCookies[cfg.authentication.oauth.stateCookieId].value).to.equal('');

            // Fetch WebGME user profile via REST
            const userRes = await agent.get(baseUrl + '/api/user').ok(() => true);
            expect(userRes.status).to.equal(200);
            expect(userRes.body._id).to.equal('alice');
            expect(userRes.body.email).to.equal('alice@example.com');
            expect(userRes.body.displayName).to.equal('Alice Example');
            expect(userRes.body.canCreate).to.equal(true);
            expect(userRes.body.passwordHash).to.equal(undefined);

            // Inspect MongoDB _users document directly: passwordless & zero external OAuth tokens stored
            const rawDoc = await findUserDocInMongo(cfg, 'alice');
            expect(rawDoc).to.be.an('object');
            expect(rawDoc.passwordHash).to.equal(null);
            expect(rawDoc.oauthIdentities).to.deep.equal({keycloak: 'sub-alice'});
            expect(rawDoc.accessToken).to.equal(undefined);
            expect(rawDoc.refreshToken).to.equal(undefined);
            expect(rawDoc.idToken).to.equal(undefined);
            expect(rawDoc['access_token']).to.equal(undefined);
            expect(rawDoc['refresh_token']).to.equal(undefined);

            // Password authentication is impossible for passwordless OAuth user
            let authRejected = false;
            try {
                await helperAuth.authenticateUser('alice', 'any-password');
            } catch (_err) {
                authRejected = true;
            }
            expect(authRejected).to.equal(true);

            // Create a project over REST with the OAuth session
            const projectName = 'OAuthProject';
            const createRes = await agent
                .put(baseUrl + '/api/projects/alice/' + projectName)
                .send({type: 'file', seedName: 'EmptyProject'})
                .ok(() => true);
            expect(createRes.status).to.equal(204);

            // Connect Socket.IO with the issued JWT cookie and run a worker simpleRequest
            const socket = io(baseUrl, {
                multiplex: false,
                reconnection: false,
                extraHeaders: {
                    Cookie: cfg.authentication.jwt.cookieId + '=' + jwtCookie.value,
                },
            });

            await new Promise((resolve, reject) => {
                socket.once('connect', resolve);
                socket.once('connect_error', reject);
                socket.once('error', reject);
            });

            try {
                const exportResult = await Q.ninvoke(socket, 'emit', 'simpleRequest', {
                    command: 'exportProjectToFile',
                    projectId: 'alice+' + projectName,
                    branchName: 'master',
                    path: '',
                    webgmeToken: jwtCookie.value,
                });
                expect(exportResult).to.be.an('object');
                expect(exportResult.hash).to.be.a('string').and.not.equal('');
            } finally {
                socket.disconnect();
            }
        }
    );

    it('should preserve user _id and sync email/displayName when IdP claims change on re-login', async function () {
        const {baseUrl} = await startHarness();

        const agent1 = superagent.agent();
        const flow1 = await performOAuthLogin(agent1, baseUrl);
        expect(flow1.cbRes.status).to.equal(302);

        const user1 = await agent1.get(baseUrl + '/api/user');
        expect(user1.body._id).to.equal('alice');

        mockOAuth.setBehavior({
            nextUser: {
                sub: 'sub-alice',
                preferredUsername: 'alice-ignored-on-relogin',
                email: 'alice.updated@example.com',
                name: 'Alice Updated',
            },
        });

        const agent2 = superagent.agent();
        const flow2 = await performOAuthLogin(agent2, baseUrl);
        expect(flow2.cbRes.status).to.equal(302);

        const user2 = await agent2.get(baseUrl + '/api/user');
        expect(user2.body._id).to.equal('alice');
        expect(user2.body.email).to.equal('alice.updated@example.com');
        expect(user2.body.displayName).to.equal('Alice Updated');
    });

    it('should avoid username collision with pre-existing local account', async function () {
        const {baseUrl} = await startHarness({
            preSetup: async (auth) => {
                await auth.addUser('bob', 'localbob@example.com', 'secret123', true, {overwrite: true});
            },
            behavior: {
                nextUser: {
                    sub: 'sub-bob-ext',
                    preferredUsername: 'bob',
                    email: 'extbob@example.com',
                    name: 'External Bob',
                },
            },
        });

        const agent = superagent.agent();
        const flow = await performOAuthLogin(agent, baseUrl);
        expect(flow.cbRes.status).to.equal(302);

        const userRes = await agent.get(baseUrl + '/api/user');
        expect(userRes.status).to.equal(200);
        expect(userRes.body._id).to.match(/^oauth_bob_[0-9a-f]{8}$/);
        expect(userRes.body._id).to.not.equal('bob');
        expect(userRes.body.oauthIdentities).to.deep.equal({keycloak: 'sub-bob-ext'});

        const localBob = await helperAuth.getUser('bob');
        expect(localBob.email).to.equal('localbob@example.com');
        expect(localBob.oauthIdentities || {}).to.deep.equal({});
    });

    it('should link existing account via useEmailForId and reject disabled or conflicting links', async function () {
        const {baseUrl} = await startHarness({
            customizeConfig: (cfg) => {
                cfg.authentication.useEmailForId = true;
            },
            preSetup: async (auth) => {
                await auth.addUser('charlie', 'charlie@example.com', 'pw123', true, {overwrite: true});
                await auth.addUser('disableduser', 'disabled@example.com', 'pw123', true, {
                    overwrite: true,
                    disabled: true,
                });
            },
            behavior: {
                nextUser: {
                    sub: 'sub-charlie-1',
                    preferredUsername: 'charlie_idp',
                    email: 'charlie@example.com',
                    name: 'Charlie',
                },
            },
        });

        const agent1 = superagent.agent();
        const flow1 = await performOAuthLogin(agent1, baseUrl);
        expect(flow1.cbRes.status).to.equal(302);
        const user1 = await agent1.get(baseUrl + '/api/user');
        expect(user1.body._id).to.equal('charlie');
        expect(user1.body.oauthIdentities).to.deep.equal({keycloak: 'sub-charlie-1'});

        // Different external sub claiming charlie@example.com must be rejected with 403
        mockOAuth.setBehavior({
            nextUser: {
                sub: 'sub-charlie-impostor',
                preferredUsername: 'impostor',
                email: 'charlie@example.com',
                name: 'Impostor',
            },
        });
        const agent2 = superagent.agent();
        const flow2 = await performOAuthLogin(agent2, baseUrl);
        expect(flow2.cbRes.status).to.equal(403);

        // Matched disabled user must be rejected with 403
        mockOAuth.setBehavior({
            nextUser: {
                sub: 'sub-disabled',
                preferredUsername: 'disabled_idp',
                email: 'disabled@example.com',
                name: 'Disabled User',
            },
        });
        const agent3 = superagent.agent();
        const flow3 = await performOAuthLogin(agent3, baseUrl);
        expect(flow3.cbRes.status).to.equal(403);
    });

    it('should support plain OAuth 2.0 mode without discoveryUrl or id_token', async function () {
        const {baseUrl} = await startHarness({
            behavior: {
                issueIdToken: false,
                requireClientSecret: 'plain-oauth-secret',
                nextUser: {
                    sub: 'plain-sub-42',
                    preferredUsername: 'plainuser',
                    email: 'plain@example.com',
                    name: 'Plain OAuth User',
                },
            },
            customizeConfig: (cfg, op) => {
                cfg.authentication.oauth.discoveryUrl = null;
                cfg.authentication.oauth.usePKCE = false;
                cfg.authentication.oauth.clientSecret = 'plain-oauth-secret';
                cfg.authentication.oauth.authorizationUrl = op.authorizationUrl;
                cfg.authentication.oauth.tokenUrl = op.tokenUrl;
                cfg.authentication.oauth.userInfoUrl = op.userInfoUrl;
                cfg.authentication.oauth.scopes = ['profile', 'email'];
            },
        });

        const agent = superagent.agent();
        const flow = await performOAuthLogin(agent, baseUrl);
        expect(flow.cbRes.status).to.equal(302);
        expect(mockOAuth.lastTokenBody['client_secret']).to.equal('plain-oauth-secret');
        expect(mockOAuth.lastTokenBody['code_verifier']).to.equal(undefined);

        const userRes = await agent.get(baseUrl + '/api/user');
        expect(userRes.status).to.equal(200);
        expect(userRes.body._id).to.equal('plainuser');
    });

    it('should exchange external Bearer JWT at /oauth/token and honor acceptExternalBearerJwt', async function () {
        const {baseUrl} = await startHarness({
            customizeConfig: (cfg) => {
                cfg.authentication.oauth.acceptExternalBearerJwt = true;
            },
        });

        const extClaims = {
            sub: 'svc-user-1',
            email: 'svc@example.com',
            name: 'Service User',
        };
        extClaims['preferred_username'] = 'svcuser';

        const validExtJwt = await mockOAuth.mintExternalJwt(extClaims, {
            audience: 'webgme-test-client',
        });

        // Wrong audience is rejected on both /oauth/token and direct API
        const badAudJwt = await mockOAuth.mintExternalJwt(extClaims, {
            audience: 'other-service',
        });
        const badRes = await superagent
            .post(baseUrl + '/oauth/token')
            .set('Authorization', 'Bearer ' + badAudJwt)
            .ok(() => true);
        expect(badRes.status).to.equal(401);

        // Direct API usage with acceptExternalBearerJwt = true
        const directRes = await superagent
            .get(baseUrl + '/api/user')
            .set('Authorization', 'Bearer ' + validExtJwt)
            .ok(() => true);
        expect(directRes.status).to.equal(200);
        expect(directRes.body._id).to.equal('svcuser');

        // POST /oauth/token exchanges external Bearer JWT for WebGME JWT cookie & token JSON
        const postAgent = superagent.agent();
        const postExch = await postAgent
            .post(baseUrl + '/oauth/token')
            .set('Authorization', 'Bearer ' + validExtJwt)
            .ok(() => true);
        expect(postExch.status).to.equal(200);
        expect(postExch.body.userId).to.equal('svcuser');
        expect(postExch.body.token).to.be.a('string').and.not.equal('');

        const postUserRes = await postAgent.get(baseUrl + '/api/user').ok(() => true);
        expect(postUserRes.status).to.equal(200);
        expect(postUserRes.body._id).to.equal('svcuser');

        // GET /oauth/token also works
        const getExch = await superagent
            .get(baseUrl + '/oauth/token')
            .set('Authorization', 'Bearer ' + validExtJwt)
            .ok(() => true);
        expect(getExch.status).to.equal(200);
        expect(getExch.body.userId).to.equal('svcuser');
    });

    it('should reject direct external Bearer JWT on API when acceptExternalBearerJwt is false', async function () {
        const {baseUrl} = await startHarness({
            customizeConfig: (cfg) => {
                cfg.authentication.oauth.acceptExternalBearerJwt = false;
            },
        });

        const extClaims = {sub: 'svc-user-2'};
        extClaims['preferred_username'] = 'svc2';
        const validExtJwt = await mockOAuth.mintExternalJwt(extClaims, {audience: 'webgme-test-client'});

        const res = await superagent
            .get(baseUrl + '/api/user')
            .set('Authorization', 'Bearer ' + validExtJwt)
            .ok(() => true);
        expect(res.status).to.equal(401);
    });

    it('should enforce allowPasswordLogin: false and enableAccessTokens: false (with blob working)',
        async function () {
            const {baseUrl} = await startHarness({
                customizeConfig: (cfg) => {
                    cfg.authentication.allowPasswordLogin = false;
                    cfg.authentication.enableAccessTokens = false;
                    cfg.blob.allowListAll = true;
                },
                preSetup: async (auth) => {
                    await auth.addUser('localpw', 'localpw@example.com', 'pw123', true, {overwrite: true});
                },
            });

            // Password login & HTTP Basic must be blocked
            const postLoginRes = await superagent
                .post(baseUrl + '/login')
                .send({userId: 'localpw', password: 'pw123'})
                .ok(() => true);
            expect(postLoginRes.status).to.equal(403);

            const basicAuth = 'Basic ' + Buffer.from('localpw:pw123').toString('base64');
            const basicRes = await superagent
                .get(baseUrl + '/api/user')
                .set('Authorization', basicAuth)
                .ok(() => true);
            expect(basicRes.status).to.equal(401);

            // Authenticate via OAuth
            const agent = superagent.agent();
            const flow = await performOAuthLogin(agent, baseUrl);
            expect(flow.cbRes.status).to.equal(302);

            // Token endpoints disabled -> 404; Blob endpoint still works with shim -> 200
            const tokensRes = await agent.get(baseUrl + '/rest/tokens').ok(() => true);
            expect(tokensRes.status).to.equal(404);

            const blobRes = await agent.get(baseUrl + '/rest/blob/metadata').ok(() => true);
            expect(blobRes.status).to.equal(200);
        }
    );

    it('should enforce autoCreateUser: false and disabled users', async function () {
        const {baseUrl} = await startHarness({
            customizeConfig: (cfg) => {
                cfg.authentication.oauth.autoCreateUser = false;
            },
            preSetup: async (auth) => {
                await auth.addUser('preprov', 'preprov@example.com', null, true, {
                    overwrite: true,
                    oauthIdentities: {keycloak: 'sub-preprov'},
                });
                await auth.addUser('offuser', 'off@example.com', null, true, {
                    overwrite: true,
                    disabled: true,
                    oauthIdentities: {keycloak: 'sub-off'},
                });
            },
            behavior: {
                nextUser: {
                    sub: 'sub-unprovisioned',
                    preferredUsername: 'stranger',
                    email: 'stranger@example.com',
                },
            },
        });

        const strangerAgent = superagent.agent();
        const strangerFlow = await performOAuthLogin(strangerAgent, baseUrl);
        expect(strangerFlow.cbRes.status).to.equal(403);

        mockOAuth.setBehavior({
            nextUser: {
                sub: 'sub-off',
                preferredUsername: 'offuser',
                email: 'off@example.com',
            },
        });
        const disabledAgent = superagent.agent();
        const disabledFlow = await performOAuthLogin(disabledAgent, baseUrl);
        expect(disabledFlow.cbRes.status).to.equal(403);

        mockOAuth.setBehavior({
            nextUser: {
                sub: 'sub-preprov',
                preferredUsername: 'preprov',
                email: 'preprov@example.com',
            },
        });
        const preAgent = superagent.agent();
        const preFlow = await performOAuthLogin(preAgent, baseUrl);
        expect(preFlow.cbRes.status).to.equal(302);
        const meRes = await preAgent.get(baseUrl + '/api/user');
        expect(meRes.body._id).to.equal('preprov');
    });

    it('should reject invalid state, OP error, bad nonce, forged id_token, and userinfo subject mismatch',
        async function () {
            const {baseUrl} = await startHarness();

            // Missing state cookie
            const noCookieRes = await superagent
                .get(baseUrl + '/oauth/callback?code=abc&state=xyz')
                .ok(() => true);
            expect(noCookieRes.status).to.equal(400);

            // Tampered state query parameter
            const agentTamper = superagent.agent();
            const loginRes = await agentTamper.get(baseUrl + '/oauth/login').redirects(0).ok(() => true);
            const authRes = await superagent.get(loginRes.headers.location).redirects(0).ok(() => true);
            const cbUrl = new URL(authRes.headers.location);
            cbUrl.searchParams.set('state', 'tampered-state-value');
            const tamperRes = await agentTamper.get(cbUrl.toString()).redirects(0).ok(() => true);
            expect(tamperRes.status).to.equal(400);

            // OP error response
            mockOAuth.setBehavior({
                authorizeError: 'access_denied',
                authorizeErrorDescription: 'User cancelled consent',
            });
            const errAgent = superagent.agent();
            const errFlow = await performOAuthLogin(errAgent, baseUrl);
            expect(errFlow.cbRes.status).to.equal(400);

            // Wrong nonce in id_token
            mockOAuth.reset();
            mockOAuth.setBehavior({wrongNonce: true});
            const nonceAgent = superagent.agent();
            const nonceFlow = await performOAuthLogin(nonceAgent, baseUrl);
            expect(nonceFlow.cbRes.status).to.equal(401);

            // Forged signature on id_token
            mockOAuth.reset();
            mockOAuth.setBehavior({forgedSignature: true});
            const forgedAgent = superagent.agent();
            const forgedFlow = await performOAuthLogin(forgedAgent, baseUrl);
            expect(forgedFlow.cbRes.status).to.equal(401);

            // Subject mismatch between id_token and /userinfo
            mockOAuth.reset();
            mockOAuth.setBehavior({userInfoSubjectMismatch: true});
            const mismatchAgent = superagent.agent();
            const mismatchFlow = await performOAuthLogin(mismatchAgent, baseUrl);
            expect(mismatchFlow.cbRes.status).to.equal(401);
        }
    );

    it('should sanitize open redirects, expose only safe /gmeConfig.json metadata, and redirect /logout',
        async function () {
            const {cfg, baseUrl} = await startHarness({
                customizeConfig: (config) => {
                    config.authentication.oauth.clientSecret = 'keep-me-secret';
                    config.authentication.userManagementPageOptions = {apiSecret: 'hidden'};
                },
            });

            // Open redirect attempts must sanitize to '/'
            const agent = superagent.agent();
            const flowExt = await performOAuthLogin(
                agent,
                baseUrl,
                '/oauth/login?redirect=' + encodeURIComponent('https://evil.example.com/phish')
            );
            expect(flowExt.cbRes.status).to.equal(302);
            expect(flowExt.cbRes.headers.location).to.equal('/');

            const agentProto = superagent.agent();
            const flowProto = await performOAuthLogin(
                agentProto,
                baseUrl,
                '/oauth/login?redirect=' + encodeURIComponent('//evil.example.com')
            );
            expect(flowProto.cbRes.status).to.equal(302);
            expect(flowProto.cbRes.headers.location).to.equal('/');

            // Public /gmeConfig.json leaks zero secrets or userManagementPageOptions
            const cfgRes = await superagent.get(baseUrl + '/gmeConfig.json');
            expect(cfgRes.status).to.equal(200);
            expect(cfgRes.body.authentication.userManagementPageOptions).to.equal(undefined);
            expect(cfgRes.body.authentication.oauth).to.deep.equal({
                enable: true,
                providerName: 'keycloak',
                loginRoute: '/oauth/login',
            });

            // /logout clears cookies and redirects to OP end_session_endpoint
            const logoutRes = await agent.get(baseUrl + '/logout').redirects(0).ok(() => true);
            expect(logoutRes.status).to.equal(302);
            expect(logoutRes.headers.location).to.equal(mockOAuth.endSessionUrl);
            const logoutCookies = getCookieMap(logoutRes.headers['set-cookie']);
            expect(logoutCookies[cfg.authentication.jwt.cookieId].value).to.equal('');
            expect(logoutCookies[cfg.authentication.oauth.stateCookieId].value).to.equal('');
        }
    );

    it('should renew cookie JWT near expiry without crashing due to variable shadowing', async function () {
        const {cfg, baseUrl} = await startHarness({
            customizeConfig: (config) => {
                config.authentication.jwt.expiresIn = 10;
                config.authentication.jwt.renewBeforeExpires = 20;
            },
        });

        const agent = superagent.agent();
        const flow = await performOAuthLogin(agent, baseUrl);
        expect(flow.cbRes.status).to.equal(302);

        const res = await agent.get(baseUrl + '/api/user').ok(() => true);
        expect(res.status).to.equal(200);
        expect(res.body._id).to.equal('alice');

        const renewedCookies = getCookieMap(res.headers['set-cookie']);
        expect(renewedCookies[cfg.authentication.jwt.cookieId]).to.be.an('object');
        expect(renewedCookies[cfg.authentication.jwt.cookieId].value).to.be.a('string').and.not.equal('');
    });

    it('should support GitHub-style OAuth claims, sanitize hyphenated logins for projects, & handle HTTP 200 errors',
        async function () {
            const {baseUrl} = await startHarness({
                behavior: {
                    issueIdToken: false,
                    requireClientSecret: 'gh-secret',
                    nextUser: {
                        sub: 987654,
                        preferredUsername: undefined,
                        email: null,
                        name: 'Octo Cat',
                        extraClaims: {
                            id: 987654,
                            login: 'octo-cat-dev',
                        },
                    },
                },
                customizeConfig: (cfg, op) => {
                    cfg.authentication.oauth.providerName = 'github';
                    cfg.authentication.oauth.discoveryUrl = null;
                    cfg.authentication.oauth.usePKCE = false;
                    cfg.authentication.oauth.clientSecret = 'gh-secret';
                    cfg.authentication.oauth.authorizationUrl = op.authorizationUrl;
                    cfg.authentication.oauth.tokenUrl = op.tokenUrl;
                    cfg.authentication.oauth.userInfoUrl = op.userInfoUrl;
                    cfg.authentication.oauth.tokenRoute = null;
                    cfg.authentication.oauth.userIdPrefix = 'gh_';
                    cfg.authentication.oauth.claims = {
                        subject: 'id',
                        username: 'login',
                        email: 'email',
                        displayName: 'name',
                    };
                },
            });

            const agent = superagent.agent();
            const flow = await performOAuthLogin(agent, baseUrl);
            expect(flow.cbRes.status).to.equal(302);
            expect(mockOAuth.lastUserInfoUserAgent).to.equal('webgme-engine');

            const userRes = await agent.get(baseUrl + '/api/user').ok(() => true);
            expect(userRes.status).to.equal(200);
            expect(userRes.body._id).to.equal('octo_cat_dev');
            expect(userRes.body.oauthIdentities).to.deep.equal({github: '987654'});

            const projRes = await agent
                .put(baseUrl + '/api/projects/octo_cat_dev/GitHubProj')
                .send({type: 'file', seedName: 'EmptyProject'})
                .ok(() => true);
            expect(projRes.status).to.equal(204);

            // Simulate GitHub returning HTTP 200 with { error: 'bad_verification_code' }
            const ghTokenErr = {error: 'bad_verification_code'};
            ghTokenErr['error_description'] = 'The code passed is incorrect or expired.';
            mockOAuth.setBehavior({tokenErrorIn200: ghTokenErr});
            const errAgent = superagent.agent();
            const errFlow = await performOAuthLogin(errAgent, baseUrl);
            expect(errFlow.cbRes.status).to.equal(401);
        }
    );

    it('should support Google-style OIDC claims with dotted email usernames and allow project creation',
        async function () {
            const {baseUrl} = await startHarness({
                behavior: {
                    requireClientSecret: 'google-secret',
                    nextUser: {
                        sub: '1122334455',
                        preferredUsername: undefined,
                        email: 'alice.smith@gmail.com',
                        name: 'Alice Smith',
                    },
                },
                customizeConfig: (cfg) => {
                    cfg.authentication.oauth.providerName = 'google';
                    cfg.authentication.oauth.clientSecret = 'google-secret';
                    cfg.authentication.oauth.userIdPrefix = 'google_';
                    cfg.authentication.oauth.claims = {
                        subject: 'sub',
                        username: 'email',
                        email: 'email',
                        displayName: 'name',
                    };
                },
            });

            const agent = superagent.agent();
            const flow = await performOAuthLogin(agent, baseUrl);
            expect(flow.cbRes.status).to.equal(302);

            const userRes = await agent.get(baseUrl + '/api/user').ok(() => true);
            expect(userRes.status).to.equal(200);
            expect(userRes.body._id).to.equal('alice_smith_gmail_com');
            expect(userRes.body.email).to.equal('alice.smith@gmail.com');

            const projRes = await agent
                .put(baseUrl + '/api/projects/alice_smith_gmail_com/GoogleProj')
                .send({type: 'file', seedName: 'EmptyProject'})
                .ok(() => true);
            expect(projRes.status).to.equal(204);
        }
    );
});
