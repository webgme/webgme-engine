/*eslint-env node*/
'use strict';

const crypto = require('crypto');
const http = require('http');
const {URL, URLSearchParams} = require('url');

let joseModulePromise = null;
function getJose() {
    if (!joseModulePromise) {
        joseModulePromise = import('jose');
    }
    return joseModulePromise;
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

class MockOAuthServer {
    constructor(options) {
        this.__options = options || {};
        this.__server = null;
        this.__codes = new Map();
        this.__accessTokens = new Map();
        this.__privateKey = null;
        this.__publicJwk = null;
        this.__forgedPrivateKey = null;

        this.baseUrl = null;
        this.issuer = null;
        this.discoveryUrl = null;
        this.authorizationUrl = null;
        this.tokenUrl = null;
        this.userInfoUrl = null;
        this.jwksUri = null;
        this.endSessionUrl = null;

        this.lastAuthorizeQuery = null;
        this.lastTokenBody = null;
        this.lastUserInfoAuth = null;

        this.reset();
    }

    reset() {
        this.__codes.clear();
        this.__accessTokens.clear();
        this.lastAuthorizeQuery = null;
        this.lastTokenBody = null;
        this.lastUserInfoAuth = null;
        this.behavior = {
            issueIdToken: true,
            authorizeError: null,
            authorizeErrorDescription: null,
            wrongNonce: false,
            forgedSignature: false,
            userInfoSubjectMismatch: false,
            requireClientSecret: null,
            omitEndSessionUrl: false,
            returnUserInfo: true,
            nextUser: {
                sub: 'sub-alice',
                preferredUsername: 'alice',
                email: 'alice@example.com',
                name: 'Alice Example',
                extraClaims: {},
            },
        };
    }

    setBehavior(overrides) {
        if (overrides.nextUser) {
            this.behavior.nextUser = Object.assign({}, this.behavior.nextUser, overrides.nextUser);
        }
        Object.keys(overrides).forEach((key) => {
            if (key !== 'nextUser') {
                this.behavior[key] = overrides[key];
            }
        });
    }

    async __ensureKeys() {
        if (this.__privateKey) {
            return;
        }
        const jose = await getJose();
        const primary = await jose.generateKeyPair('RS256');
        this.__privateKey = primary.privateKey;
        const jwk = await jose.exportJWK(primary.publicKey);
        jwk.kid = 'mock-key-1';
        jwk.use = 'sig';
        jwk.alg = 'RS256';
        this.__publicJwk = jwk;

        const forged = await jose.generateKeyPair('RS256');
        this.__forgedPrivateKey = forged.privateKey;
    }

    async mintExternalJwt(claims, opts) {
        await this.__ensureKeys();
        const jose = await getJose();
        const options = opts || {};
        const signingKey = options.forged ? this.__forgedPrivateKey : this.__privateKey;
        const builder = new jose.SignJWT(claims || {})
            .setProtectedHeader({alg: 'RS256', kid: 'mock-key-1'})
            .setIssuedAt()
            .setIssuer(Object.hasOwn(options, 'issuer') ? options.issuer : this.issuer)
            .setExpirationTime(options.expiresIn || '5m');

        if (options.audience) {
            builder.setAudience(options.audience);
        }

        return builder.sign(signingKey);
    }

    __buildUserClaims(user, subjectOverride) {
        const claims = {
            sub: subjectOverride !== undefined ? subjectOverride : user.sub,
            email: user.email,
            name: user.name,
        };
        if (user.preferredUsername !== undefined) {
            claims['preferred_username'] = user.preferredUsername;
        }
        if (user.extraClaims && typeof user.extraClaims === 'object') {
            Object.assign(claims, user.extraClaims);
        }
        return claims;
    }

    async __handleRequest(req, res) {
        const reqUrl = new URL(req.url, this.baseUrl);
        const pathname = reqUrl.pathname;

        if (req.method === 'GET' && pathname === '/.well-known/openid-configuration') {
            const doc = {
                issuer: this.issuer,
            };
            doc['authorization_endpoint'] = this.authorizationUrl;
            doc['token_endpoint'] = this.tokenUrl;
            doc['userinfo_endpoint'] = this.userInfoUrl;
            doc['jwks_uri'] = this.jwksUri;
            doc['response_types_supported'] = ['code'];
            if (!this.behavior.omitEndSessionUrl) {
                doc['end_session_endpoint'] = this.endSessionUrl;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(doc));
            return;
        }

        if (req.method === 'GET' && pathname === '/jwks') {
            await this.__ensureKeys();
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({keys: [this.__publicJwk]}));
            return;
        }

        if (req.method === 'GET' && pathname === '/authorize') {
            const params = {};
            reqUrl.searchParams.forEach((value, key) => {
                params[key] = value;
            });
            this.lastAuthorizeQuery = params;

            const redirectUri = params['redirect_uri'];
            const state = params.state || '';
            if (!redirectUri) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'missing_redirect_uri'}));
                return;
            }

            const target = new URL(redirectUri);
            if (this.behavior.authorizeError) {
                target.searchParams.set('error', this.behavior.authorizeError);
                if (this.behavior.authorizeErrorDescription) {
                    target.searchParams.set('error_description', this.behavior.authorizeErrorDescription);
                }
                if (state) {
                    target.searchParams.set('state', state);
                }
                res.writeHead(302, {Location: target.toString()});
                res.end();
                return;
            }

            const code = crypto.randomBytes(16).toString('hex');
            this.__codes.set(code, {
                clientId: params['client_id'] || null,
                redirectUri: redirectUri,
                state: state,
                nonce: params.nonce || null,
                codeChallenge: params['code_challenge'] || null,
                codeChallengeMethod: params['code_challenge_method'] || null,
                user: JSON.parse(JSON.stringify(this.behavior.nextUser)),
            });

            target.searchParams.set('code', code);
            if (state) {
                target.searchParams.set('state', state);
            }
            res.writeHead(302, {Location: target.toString()});
            res.end();
            return;
        }

        if (req.method === 'POST' && pathname === '/token') {
            const rawBody = await readRequestBody(req);
            const parsed = new URLSearchParams(rawBody);
            const bodyObj = {};
            parsed.forEach((value, key) => {
                bodyObj[key] = value;
            });
            this.lastTokenBody = bodyObj;

            const code = bodyObj.code;
            const entry = code ? this.__codes.get(code) : null;
            if (code) {
                this.__codes.delete(code);
            }

            if (!entry || bodyObj['grant_type'] !== 'authorization_code' ||
                bodyObj['redirect_uri'] !== entry.redirectUri ||
                (entry.clientId && bodyObj['client_id'] !== entry.clientId)) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'invalid_grant'}));
                return;
            }

            if (this.behavior.requireClientSecret !== null &&
                bodyObj['client_secret'] !== this.behavior.requireClientSecret) {
                res.writeHead(401, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'invalid_client'}));
                return;
            }

            if (entry.codeChallenge) {
                const verifier = bodyObj['code_verifier'] || '';
                const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
                if (!verifier || computed !== entry.codeChallenge) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'invalid_grant_pkce'}));
                    return;
                }
            }

            const accessToken = crypto.randomBytes(16).toString('hex');
            this.__accessTokens.set(accessToken, {
                user: entry.user,
                mismatchSubject: this.behavior.userInfoSubjectMismatch,
            });

            const tokenResponse = {};
            tokenResponse['access_token'] = accessToken;
            tokenResponse['token_type'] = 'Bearer';
            tokenResponse['expires_in'] = 300;

            if (this.behavior.issueIdToken !== false) {
                const idClaims = this.__buildUserClaims(entry.user);
                if (entry.nonce) {
                    idClaims.nonce = this.behavior.wrongNonce ? 'wrong-nonce' : entry.nonce;
                }
                tokenResponse['id_token'] = await this.mintExternalJwt(idClaims, {
                    audience: entry.clientId || undefined,
                    forged: this.behavior.forgedSignature,
                });
            }

            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(tokenResponse));
            return;
        }

        if (req.method === 'GET' && pathname === '/userinfo') {
            this.lastUserInfoAuth = req.headers.authorization || null;
            if (!this.behavior.returnUserInfo) {
                res.writeHead(404, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'not_found'}));
                return;
            }
            const auth = req.headers.authorization || '';
            if (auth.indexOf('Bearer ') !== 0) {
                res.writeHead(401, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'missing_token'}));
                return;
            }
            const accessToken = auth.substring('Bearer '.length).trim();
            const session = this.__accessTokens.get(accessToken);
            if (!session) {
                res.writeHead(401, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'invalid_token'}));
                return;
            }
            const subOverride = session.mismatchSubject ? 'mismatched-' + session.user.sub : session.user.sub;
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(this.__buildUserClaims(session.user, subOverride)));
            return;
        }

        if (req.method === 'GET' && pathname === '/endsession') {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({loggedOut: true}));
            return;
        }

        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'unknown_endpoint'}));
    }

    async start() {
        await this.__ensureKeys();
        this.__server = http.createServer((req, res) => {
            this.__handleRequest(req, res).catch((err) => {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: err.message}));
            });
        });

        await new Promise((resolve, reject) => {
            this.__server.once('error', reject);
            this.__server.listen(0, '127.0.0.1', resolve);
        });

        const addr = this.__server.address();
        this.baseUrl = 'http://127.0.0.1:' + addr.port;
        this.issuer = this.__options.issuer || this.baseUrl;
        this.discoveryUrl = this.baseUrl + '/.well-known/openid-configuration';
        this.authorizationUrl = this.baseUrl + '/authorize';
        this.tokenUrl = this.baseUrl + '/token';
        this.userInfoUrl = this.baseUrl + '/userinfo';
        this.jwksUri = this.baseUrl + '/jwks';
        this.endSessionUrl = this.baseUrl + '/endsession';
        return this.baseUrl;
    }

    async stop() {
        this.__codes.clear();
        this.__accessTokens.clear();
        if (this.__server) {
            await new Promise((resolve) => this.__server.close(resolve));
            this.__server = null;
        }
    }
}

module.exports = MockOAuthServer;
