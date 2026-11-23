/*eslint-env node*/
'use strict';

const {URL} = require('url');

let joseModulePromise = null;
const jwksByUri = new Map();

function getJoseModule() {
    if (!joseModulePromise) {
        joseModulePromise = import('jose');
    }

    return joseModulePromise;
}

async function getJwks(jwksUri) {
    const key = String(jwksUri);

    if (!jwksByUri.has(key)) {
        const jose = await getJoseModule();
        jwksByUri.set(key, jose.createRemoteJWKSet(new URL(key)));
    }

    return jwksByUri.get(key);
}

async function verify(token, options) {
    const jose = await getJoseModule();
    const jwks = await getJwks(options.jwksUri);
    const verifyOpts = {
        algorithms: Array.isArray(options.algorithms) && options.algorithms.length > 0 ?
            options.algorithms : ['RS256'],
    };

    if (options.issuer) {
        verifyOpts.issuer = options.issuer;
    }

    if (options.audience) {
        verifyOpts.audience = options.audience;
    }

    const result = await jose.jwtVerify(token, jwks, verifyOpts);

    return result.payload;
}

function clearCache() {
    jwksByUri.clear();
}

module.exports = {
    verify,
    clearCache,
};
