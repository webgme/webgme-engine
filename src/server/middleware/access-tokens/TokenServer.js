/*eslint-env node*/

/**
 * @author brollb / https://github.com/brollb
 */

'use strict';

const express = require('express');
const Chance = require('chance');
const TOKEN_COLLECTION = '_tokenList';

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
        res.json(await self.tokens.list(userId));
    });

    router.post('/create/:name?', async function (req, res) {
        const userId = self.getUserId(req);
        const {name} = req.params;
        const token = await self.tokens.create(userId, name);
        res.json(token);
    });

    router.delete('/:id', async function (req, res) {
        const userId = self.getUserId(req);
        const deleted = await self.tokens.delete(userId, req.params.id);
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
};

AccessTokens.prototype.list = async function (userId) {
    const tokens = await this.tokenList.find({userId}, {_id: 0}).toArray();
    return tokens;
};

AccessTokens.prototype.create = async function (userId, name) {
    name = name || `Created on ${new Date()}`;
    const token = {
        displayName: name,
        userId: userId,
        id: this.chance.guid(),
        issuedAt: new Date(),
    };
    await this.tokenList.save(token);
    delete token._id;
    return token;
};

AccessTokens.prototype.delete = async function (userId, id) {
    const result = await this.tokenList.deleteOne({userId, id});
    return result.deletedCount;
};

AccessTokens.prototype.getUserId = async function (id) {
    const token = await this.tokenList.findOne({id}, {_id: 0});
    return token && token.userId;
};

module.exports = TokenServer;
