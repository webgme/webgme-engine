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
    const result = await jose.jwtVerify(token, jwks, {
        issuer: options.issuer,
        audience: options.audience,
        algorithms: ['RS256'],
    });

    return result.payload;
}

module.exports = {
    verify,
};
