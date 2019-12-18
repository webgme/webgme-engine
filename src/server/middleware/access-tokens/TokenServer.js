/*eslint-env node*/

/**
 * @author lattmann / https://github.com/lattmann
 * @author ksmyth / https://github.com/ksmyth
 * @author pmeijer / https://github.com/pmeijer
 *
 curl http://localhost:8855/rest/executor/info/77704f10a36aa4214f5b0095ba8099e729a10f46
 curl -X POST -H "Content-Type: application/json"
 -d {} http://localhost:8855/rest/executor/create/77704f10a36aa4214f5b0095ba8099e729a10f46
 curl -X POST -H "Content-Type: application/json"
 -d {\"status\":\"CREATED\"} http://localhost:8855/rest/executor/update/77704f10a36aa4214f5b0095ba8099e729a10f46
 */

'use strict';

var express = require('express'),
    Chance = require('chance'),
    // Mongo collections
    TOKEN_LIST = '_tokenList';

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

    router.post('/create', async function (req, res) {
        const userId = self.getUserId(req);
        const token = await self.tokens.create(userId);
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
    const tokenList = await mongo.collection(TOKEN_LIST);
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

AccessTokens.prototype.create = async function (userId) {
    const token = {
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
