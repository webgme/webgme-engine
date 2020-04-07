/*eslint-env node*/

/**
 * @author brollb / https://github.com/brollb
 */

'use strict';

const express = require('express');
const Chance = require('chance');
const TOKEN_COLLECTION = '_tokenList';

class InvalidTokenError extends Error {}

/**
 *
 * @param {object} options - middlewareOptions
 * @param {GmeLogger} options.logger - logger to fork off from
 * @param {function} options.ensureAuthenticated
 * @constructor
 * @ignore
 */
function TokenServer(options) {
    var self = this,
        router = express.Router();

    self.logger = options.logger.fork('middleware:TokenServer');
    self.ensureAuthenticated = options.ensureAuthenticated;
    self.getUserId = options.getUserId;
    self.router = router;
    self.tokens = new AccessTokens();

    router.use('*', self.ensureAuthenticated);
    router.get('/', async function (req, res) {
        const userId = self.getUserId(req);
        res.json(await self.tokens.list(userId, true));
    });

    router.post('/create/:name?', async function (req, res) {
        const userId = self.getUserId(req);
        const {name} = req.params;
        try {
            const token = await self.tokens.create(userId, name);
            res.json(token);
        } catch (err) {
            const isUserError = err instanceof InvalidTokenError;
            if (isUserError) {
                res.status(400).send(err.message);
            } else {
                res.sendStatus(500);
            }
        }
    });

    router.delete('/:name', async function (req, res) {
        const userId = self.getUserId(req);
        const {name} = req.params;
        const deleted = await self.tokens.delete(userId, name);
        res.json(deleted);
    });
}

TokenServer.prototype.start = async function (params) {
    this.logger.debug('Starting token server');
    const mongo = params.mongoClient;
    const tokenList = await mongo.collection(TOKEN_COLLECTION);
    this.tokens.init(tokenList);
};

function AccessTokens() {
    this.chance = new Chance();
    this.tokenList = null;
}

AccessTokens.prototype.init = function (tokenList) {
    this.tokenList = tokenList;
    this.tokenList.createIndex({id: 1}, {unique: true});
    this.tokenList.createIndex({displayName: 1}, {unique: true});
};

AccessTokens.prototype.list = async function (userId, sanitize = false) {
    const projection = {_id: 0};
    if (sanitize) {
        projection.id = 0;
    }
    const tokens = await this.tokenList.find({userId}, projection).toArray();
    return tokens;
};

AccessTokens.prototype.create = async function (userId, name) {
    name = name || await this.getUniqueDefaultTokenName(userId);
    const token = {
        displayName: name,
        userId: userId,
        id: this.chance.guid(),
        issuedAt: new Date(),
    };
    try {
        await this.tokenList.save(token);
        delete token._id;
        return token;
    } catch (err) {
        if (err.message.includes('duplicate key error')) {
            throw new InvalidTokenError('Token name already exists');
        }
        throw err;
    }
};

AccessTokens.prototype.getUniqueDefaultTokenName = async function (userId) {
    const basename = this.getDefaultTokenName();
    const userTokens = await this.tokenList.find({userId}).toArray();
    const names = userTokens.map(token => token.displayName);
    let name = basename;
    let i = 2;

    while (names.includes(name)) {
        name = `${basename} (${i++})`;
    }

    return name;
};

AccessTokens.prototype.getDefaultTokenName = function () {
    const formatOpts = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'short'
    };
    const date = new Date();
    return `Created on ${date.toLocaleString('en-US', formatOpts)}`;
};

AccessTokens.prototype.delete = async function (userId, displayName) {
    const result = await this.tokenList.deleteOne({userId, displayName});
    return result.deletedCount;
};

AccessTokens.prototype.getUserId = async function (id) {
    const token = await this.tokenList.findOne({id}, {_id: 0});
    return token && token.userId;
};

AccessTokens.prototype.setUserFromToken = async function (req, res, next) {
    const token = req.headers['x-api-token'];

    if (token) {
        const userId = await this.getUserId(token);
        req.userData = req.userData || {};
        req.userData.userId = userId;
    }

    if (next) {
        next();
    }
};

module.exports = TokenServer;
