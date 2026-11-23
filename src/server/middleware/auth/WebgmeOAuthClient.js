/*eslint-env node*/
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const {URL, URLSearchParams} = require('url');
const oauthVerify = require('./verifyOAuthToken');

class WebGMEOAuthClient {
    constructor(gmeConfig, gmeAuth, logger) {
        this.__logger = logger.fork('OAuthClient');
        this.__gmeConfig = gmeConfig;
        this.__gmeAuth = gmeAuth;
        this.__oauthCfg = gmeConfig.authentication.oauth || {};
        this.__metadataPromise = null;
        this.__resolvedMeta = null;
        this.__cookieKey = null;
    }

    __getCookieEncryptionKey() {
        if (this.__cookieKey) {
            return this.__cookieKey;
        }
        const keyPath = this.__gmeConfig.authentication.encryption && this.__gmeConfig.authentication.encryption.key;
        const fileSecret = keyPath ? fs.readFileSync(keyPath, 'utf8') : '';
        const clientSecret = this.__oauthCfg.clientSecret || '';
        this.__cookieKey = crypto
            .createHash('sha256')
            .update('webgme-oauth-state:')
            .update(fileSecret)
            .update(':')
            .update(clientSecret)
            .digest();
        return this.__cookieKey;
    }

    __sealStatePayload(payload) {
        const key = this.__getCookieEncryptionKey();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const raw = Buffer.from(JSON.stringify(payload), 'utf8');
        const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
        const tag = cipher.getAuthTag();
        return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
    }

    __unsealStatePayload(sealed) {
        if (typeof sealed !== 'string' || !sealed) {
            return null;
        }
        const parts = sealed.split('.');
        if (parts.length !== 3) {
            return null;
        }
        try {
            const iv = Buffer.from(parts[0], 'base64url');
            const tag = Buffer.from(parts[1], 'base64url');
            const encrypted = Buffer.from(parts[2], 'base64url');
            if (iv.length !== 12 || tag.length !== 16) {
                return null;
            }
            const key = this.__getCookieEncryptionKey();
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
            return JSON.parse(plaintext.toString('utf8'));
        } catch (_err) {
            return null;
        }
    }

    __sanitizeRedirect(rawRedirect) {
        if (typeof rawRedirect !== 'string') {
            return '/';
        }
        const trimmed = rawRedirect.trim();
        if (!trimmed || trimmed.charAt(0) !== '/' || trimmed.indexOf('//') === 0 ||
            trimmed.indexOf('/\\') === 0) {
            return '/';
        }
        return trimmed;
    }

    __isSecureCookie() {
        return Boolean(this.__gmeConfig.server && this.__gmeConfig.server.behindSecureProxy);
    }

    async __resolveMetadata() {
        if (this.__resolvedMeta) {
            return this.__resolvedMeta;
        }
        const cfg = this.__oauthCfg;
        if (!cfg.discoveryUrl) {
            this.__resolvedMeta = {
                authorizationUrl: cfg.authorizationUrl,
                tokenUrl: cfg.tokenUrl,
                userInfoUrl: cfg.userInfoUrl,
                jwksUri: cfg.jwksUri,
                issuer: cfg.issuer,
                endSessionUrl: cfg.endSessionUrl,
            };
            return this.__resolvedMeta;
        }

        if (!this.__metadataPromise) {
            this.__metadataPromise = (async () => {
                const res = await fetch(cfg.discoveryUrl, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                        'User-Agent': 'webgme-engine',
                    },
                });
                if (!res.ok) {
                    throw new Error('Failed to fetch OIDC discovery document: HTTP ' + res.status);
                }
                const doc = await res.json();
                const resolved = {
                    authorizationUrl: cfg.authorizationUrl || doc['authorization_endpoint'] || null,
                    tokenUrl: cfg.tokenUrl || doc['token_endpoint'] || null,
                    userInfoUrl: cfg.userInfoUrl || doc['userinfo_endpoint'] || null,
                    jwksUri: cfg.jwksUri || doc['jwks_uri'] || null,
                    issuer: cfg.issuer || doc.issuer || null,
                    endSessionUrl: cfg.endSessionUrl || doc['end_session_endpoint'] || null,
                };
                if (!resolved.authorizationUrl || !resolved.tokenUrl) {
                    throw new Error('OIDC discovery document missing authorization_endpoint or token_endpoint');
                }
                this.__resolvedMeta = resolved;
                return resolved;
            })().catch(err => {
                this.__metadataPromise = null;
                throw err;
            });
        }
        return this.__metadataPromise;
    }

    async getLogoutUrl() {
        try {
            const meta = await this.__resolveMetadata();
            return meta.endSessionUrl || null;
        } catch (_err) {
            return this.__oauthCfg.endSessionUrl || null;
        }
    }

    async login(req, res) {
        try {
            const cfg = this.__oauthCfg;
            const meta = await this.__resolveMetadata();
            const state = crypto.randomBytes(32).toString('hex');
            const nonce = crypto.randomBytes(16).toString('hex');
            const redirectUrl = this.__sanitizeRedirect(req.query && req.query.redirect);
            let codeVerifier = null;

            const authUrl = new URL(meta.authorizationUrl);
            const params = authUrl.searchParams;
            params.set('response_type', 'code');
            params.set('client_id', cfg.clientId);
            params.set('redirect_uri', cfg.redirectUri);
            if (Array.isArray(cfg.scopes) && cfg.scopes.length > 0) {
                params.set('scope', cfg.scopes.join(' '));
            }
            params.set('state', state);
            params.set('nonce', nonce);

            if (cfg.usePKCE) {
                codeVerifier = crypto.randomBytes(32).toString('base64url');
                const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
                params.set('code_challenge', codeChallenge);
                params.set('code_challenge_method', 'S256');
            }

            if (cfg.extraAuthorizeParams && typeof cfg.extraAuthorizeParams === 'object') {
                Object.keys(cfg.extraAuthorizeParams).forEach(paramKey => {
                    const paramVal = cfg.extraAuthorizeParams[paramKey];
                    if (paramVal !== undefined && paramVal !== null) {
                        params.set(paramKey, String(paramVal));
                    }
                });
            }

            const sealed = this.__sealStatePayload({
                s: state,
                n: nonce,
                v: codeVerifier,
                r: redirectUrl,
                t: Date.now(),
            });

            res.cookie(cfg.stateCookieId, sealed, {
                httpOnly: true,
                sameSite: 'lax',
                secure: this.__isSecureCookie(),
                path: '/',
                maxAge: cfg.stateTtlSec * 1000,
            });
            res.redirect(authUrl.toString());
        } catch (err) {
            this.__logger.error('Failed to initiate OAuth login', {metadata: err});
            res.status(502).json({error: 'Unable to initiate external OAuth login'});
        }
    }

    async __exchangeCode(meta, code, codeVerifier) {
        const cfg = this.__oauthCfg;
        const pairs = [
            ['grant_type', 'authorization_code'],
            ['code', code],
            ['redirect_uri', cfg.redirectUri],
            ['client_id', cfg.clientId],
        ];
        if (cfg.clientSecret) {
            pairs.push(['client_secret', cfg.clientSecret]);
        }
        if (codeVerifier) {
            pairs.push(['code_verifier', codeVerifier]);
        }

        const body = new URLSearchParams(pairs);
        const tokenRes = await fetch(meta.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                'User-Agent': 'webgme-engine',
            },
            body: body.toString(),
        });

        if (!tokenRes.ok) {
            const err = new Error('OAuth token endpoint rejected authorization code (HTTP ' + tokenRes.status + ')');
            err.statusCode = 401;
            throw err;
        }

        const tokenBody = await tokenRes.json();
        if (tokenBody && tokenBody.error) {
            const err = new Error(
                'OAuth token endpoint returned error: ' + String(tokenBody['error_description'] || tokenBody.error)
            );
            err.statusCode = 401;
            throw err;
        }

        return tokenBody;
    }

    async __fetchUserInfo(meta, accessToken) {
        const res = await fetch(meta.userInfoUrl, {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                Accept: 'application/json',
                'User-Agent': 'webgme-engine',
            },
        });
        if (!res.ok) {
            const err = new Error('OAuth userinfo endpoint returned HTTP ' + res.status);
            err.statusCode = 401;
            throw err;
        }
        return res.json();
    }

    __getSafeUserIdPrefix() {
        const raw = typeof this.__oauthCfg.userIdPrefix === 'string' ?
            this.__oauthCfg.userIdPrefix.replace(/[^0-9a-zA-Z_]/g, '_') : '';
        const stripped = raw.replace(/^_+/, '');
        return stripped || 'oauth_';
    }

    __buildSanitizedUserId(rawCandidate, subject) {
        const prefix = this.__getSafeUserIdPrefix();
        const cleanCandidate = typeof rawCandidate === 'string' ?
            rawCandidate.trim().replace(/[^0-9a-zA-Z_]/g, '_').replace(/^_+/, '') : '';
        if (cleanCandidate && cleanCandidate.length >= 2 && cleanCandidate.toLowerCase() !== 'system') {
            return cleanCandidate;
        }
        const cleanSub = String(subject || '').trim().replace(/[^0-9a-zA-Z_]/g, '_').replace(/^_+/, '');
        if (cleanSub) {
            return prefix + cleanSub;
        }
        return prefix + crypto.createHash('sha256').update(String(subject)).digest('hex').slice(0, 12);
    }

    async __pickUniqueUserId(preferredId, providerName, subject) {
        let candidate = preferredId;
        let existing = null;
        try {
            existing = await this.__gmeAuth.getUser(candidate);
        } catch (_err) {
            existing = null;
        }
        if (!existing) {
            return candidate;
        }

        const prefix = this.__getSafeUserIdPrefix();
        const hashSuffix = crypto
            .createHash('sha256')
            .update(providerName + ':' + String(subject))
            .digest('hex')
            .slice(0, 8);
        const safePreferred = String(preferredId || '').replace(/[^0-9a-zA-Z_]/g, '_').replace(/^_+/, '');
        candidate = prefix + (safePreferred || 'user') + '_' + hashSuffix;
        return candidate;
    }

    async __resolveOrCreateUser(claims) {
        const cfg = this.__oauthCfg;
        const claimsCfg = cfg.claims || {};
        const providerName = cfg.providerName || 'oauth';
        const subKey = claimsCfg.subject || 'sub';
        const rawSub = claims && claims[subKey];

        if (rawSub === undefined || rawSub === null || String(rawSub).trim() === '') {
            const err = new Error('External identity claims missing required subject field [' + subKey + ']');
            err.statusCode = 401;
            throw err;
        }

        const subject = String(rawSub);
        const email = claimsCfg.email && claims[claimsCfg.email] ? String(claims[claimsCfg.email]).trim() : '';
        const displayName = claimsCfg.displayName && claims[claimsCfg.displayName] ?
            String(claims[claimsCfg.displayName]).trim() : '';
        const username = claimsCfg.username && claims[claimsCfg.username] ?
            String(claims[claimsCfg.username]).trim() : '';

        const existingByIdentity = await this.__gmeAuth.findUserByOAuthIdentity(providerName, subject);
        if (existingByIdentity) {
            if (existingByIdentity.disabled === true) {
                const err = new Error('User account is disabled');
                err.statusCode = 403;
                throw err;
            }
            const nextFields = {};
            if (email && email !== existingByIdentity.email) {
                nextFields.email = email;
            }
            if (displayName && displayName !== existingByIdentity.displayName) {
                nextFields.displayName = displayName;
            }
            if (Object.keys(nextFields).length > 0) {
                await this.__gmeAuth.updateUser(existingByIdentity._id, nextFields);
            }
            return existingByIdentity._id;
        }

        if (this.__gmeConfig.authentication.useEmailForId && email) {
            const matches = await this.__gmeAuth.listUsers({email: email, disabled: undefined});
            if (Array.isArray(matches) && matches.length === 1) {
                const matchedUser = matches[0];
                if (matchedUser.disabled === true) {
                    const err = new Error('User account is disabled');
                    err.statusCode = 403;
                    throw err;
                }
                if (matchedUser.oauthIdentities && matchedUser.oauthIdentities[providerName] &&
                    matchedUser.oauthIdentities[providerName] !== subject) {
                    const err = new Error('Email is already linked to a different external identity');
                    err.statusCode = 403;
                    throw err;
                }
                await this.__gmeAuth.linkOAuthIdentity(matchedUser._id, providerName, subject);
                return matchedUser._id;
            }
        }

        if (!cfg.autoCreateUser) {
            const err = new Error('User is not provisioned for WebGME access');
            err.statusCode = 403;
            throw err;
        }

        const preferredId = this.__buildSanitizedUserId(username, subject);
        const userId = await this.__pickUniqueUserId(preferredId, providerName, subject);
        const canCreate = typeof cfg.usersCanCreate === 'boolean' ?
            cfg.usersCanCreate : this.__gmeConfig.authentication.inferredUsersCanCreate === true;
        const identityMap = {};
        identityMap[providerName] = subject;

        await this.__gmeAuth.addUser(
            userId,
            email || (userId + '@users.invalid'),
            null,
            canCreate,
            {
                overwrite: false,
                displayName: displayName || userId,
                oauthIdentities: identityMap,
            }
        );

        return userId;
    }

    async handleCallback(req, res) {
        const cfg = this.__oauthCfg;
        const query = req.query || {};
        const sealed = req.cookies && req.cookies[cfg.stateCookieId];

        if (typeof res.clearCookie === 'function') {
            res.clearCookie(cfg.stateCookieId, {path: '/'});
        }

        if (query.error) {
            res.status(400).json({
                error: 'External OAuth error: ' + String(query['error_description'] || query.error),
            });
            return;
        }

        const cookieData = this.__unsealStatePayload(sealed);
        if (!cookieData || typeof query.state !== 'string' || !query.state ||
            typeof cookieData.s !== 'string') {
            res.status(400).json({error: 'Invalid or missing OAuth state'});
            return;
        }

        const ttlMs = (cfg.stateTtlSec || 600) * 1000;
        if (typeof cookieData.t !== 'number' || Date.now() - cookieData.t > ttlMs) {
            res.status(400).json({error: 'Expired OAuth state'});
            return;
        }

        const stateA = Buffer.from(query.state, 'utf8');
        const stateB = Buffer.from(cookieData.s, 'utf8');
        if (stateA.length !== stateB.length || !crypto.timingSafeEqual(stateA, stateB)) {
            res.status(400).json({error: 'OAuth state mismatch'});
            return;
        }

        if (!query.code || typeof query.code !== 'string') {
            res.status(400).json({error: 'Missing authorization code'});
            return;
        }

        try {
            const meta = await this.__resolveMetadata();
            const tokenBody = await this.__exchangeCode(meta, query.code, cookieData.v || null);
            const idToken = tokenBody && tokenBody['id_token'];
            const accessToken = tokenBody && tokenBody['access_token'];

            let idClaims = null;
            if (idToken) {
                if (!meta.jwksUri) {
                    const err = new Error('Received id_token but no jwksUri is configured for verification');
                    err.statusCode = 401;
                    throw err;
                }
                idClaims = await oauthVerify.verify(idToken, {
                    jwksUri: meta.jwksUri,
                    issuer: meta.issuer || undefined,
                    audience: cfg.audience || cfg.clientId,
                    algorithms: cfg.algorithms,
                });
                if (cookieData.n && idClaims.nonce !== cookieData.n) {
                    const err = new Error('OIDC nonce mismatch');
                    err.statusCode = 401;
                    throw err;
                }
            }

            let userInfoClaims = null;
            if (meta.userInfoUrl && accessToken) {
                userInfoClaims = await this.__fetchUserInfo(meta, accessToken);
                if (idClaims && idClaims.sub && userInfoClaims.sub &&
                    String(idClaims.sub) !== String(userInfoClaims.sub)) {
                    const err = new Error('UserInfo subject does not match id_token subject');
                    err.statusCode = 401;
                    throw err;
                }
            }

            const mergedClaims = idClaims || userInfoClaims ?
                Object.assign({}, userInfoClaims || {}, idClaims || {}) : null;

            if (!mergedClaims) {
                const err = new Error('OAuth provider returned neither verified id_token nor userinfo claims');
                err.statusCode = 401;
                throw err;
            }

            const userId = await this.__resolveOrCreateUser(mergedClaims);
            const webgmeToken = await this.__gmeAuth.generateJWTokenForAuthenticatedUser(userId);
            const cookieId = this.__gmeConfig.authentication.jwt.cookieId;

            res.cookie(cookieId, webgmeToken, {
                sameSite: 'lax',
                secure: this.__isSecureCookie(),
                path: '/',
            });

            res.redirect(this.__sanitizeRedirect(cookieData.r));
        } catch (err) {
            const status = err.statusCode || 401;
            this.__logger.error('OAuth callback failed', {metadata: err});
            res.status(status).json({error: err.message || 'OAuth authentication failed'});
        }
    }

    async resolveUserFromExternalJwt(externalToken) {
        const cfg = this.__oauthCfg;
        const meta = await this.__resolveMetadata();
        if (!meta.jwksUri) {
            const err = new Error('jwksUri is required to verify external JWT tokens');
            err.statusCode = 401;
            throw err;
        }
        const claims = await oauthVerify.verify(externalToken, {
            jwksUri: meta.jwksUri,
            issuer: meta.issuer || undefined,
            audience: cfg.audience || cfg.clientId,
            algorithms: cfg.algorithms,
        });
        return this.__resolveOrCreateUser(claims);
    }

    async exchangeBearerToken(req, res) {
        const authHeader = typeof req.get === 'function' ? req.get('Authorization') : null;
        if (!authHeader || authHeader.indexOf('Bearer ') !== 0) {
            res.status(401).json({error: 'Missing Bearer token'});
            return;
        }
        const externalToken = authHeader.substring('Bearer '.length).trim();
        if (!externalToken) {
            res.status(401).json({error: 'Empty Bearer token'});
            return;
        }

        try {
            const userId = await this.resolveUserFromExternalJwt(externalToken);
            const webgmeToken = await this.__gmeAuth.generateJWTokenForAuthenticatedUser(userId);
            const cookieId = this.__gmeConfig.authentication.jwt.cookieId;

            res.cookie(cookieId, webgmeToken, {
                sameSite: 'lax',
                secure: this.__isSecureCookie(),
                path: '/',
            });
            res.status(200).json({userId: userId, token: webgmeToken});
        } catch (err) {
            const status = err.statusCode || 401;
            this.__logger.debug('Bearer token exchange failed', {metadata: err});
            res.status(status).json({error: err.message || 'Invalid external Bearer token'});
        }
    }
}

module.exports = WebGMEOAuthClient;
