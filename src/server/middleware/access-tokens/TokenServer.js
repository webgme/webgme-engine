/*eslint-env node*/

/**
 * @author brollb / https://github.com/brollb
 */

'use strict';

const express = require('express');
const Chance = require('chance');
const TOKEN_COLLECTION = '_tokenList';
const {ObjectId} = require('mongodb');

/**
 *
 * @param {object} options - middlewareOptions
 * @param {GmeLogger} options.logger - logger to fork off from
 * @param {GmeConfig} options.gmeConfig - gmeConfig
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
        const token = await self.tokens.create(userId, name);
        res.json(token);
    });

    router.delete('/:id', async function (req, res) {
        const userId = self.getUserId(req);
        const {id} = req.params;
        const deleted = await self.tokens.delete(userId, id);
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
    this.tokenList.createIndex({value: 1}, {unique: true});
};

AccessTokens.prototype.list = async function (userId, sanitize = false) {
    const projection = {};
    if (sanitize) {
        projection.value = 0;
    }
    const tokens = await this.tokenList.find({userId}, projection).toArray();
    return tokens.map(token => this._getPublicToken(token, sanitize));
};

AccessTokens.prototype.create = async function (userId, name) {
    name = name || this.getDefaultTokenName();
    const token = {
        displayName: name,
        userId: userId,
        value: this.chance.guid(),
        issuedAt: new Date(),
    };
    await this.tokenList.save(token);
    return this._getPublicToken(token);
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

AccessTokens.prototype.delete = async function (userId, id) {
    const result = await this.tokenList.deleteOne({userId, _id: ObjectId(id)});
    return result.deletedCount;
};

AccessTokens.prototype.getUserId = async function (id) {
    const token = await this.tokenList.findOne({id});
    return token && token.userId;
};

AccessTokens.prototype._getPublicToken = function (token, sanitize = false) {
    token.id = token._id;
    delete token._id;
    if (sanitize) {
        delete token.value;
    }
    return token;
};

module.exports = TokenServer;
