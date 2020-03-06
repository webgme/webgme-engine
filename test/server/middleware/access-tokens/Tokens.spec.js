/*eslint-env node, mocha*/

const testFixture = require('../../../_globals.js');
describe('TokenServer', function () {
    const assert = require('assert');
    const {promisify} = require('util');
    const agent = testFixture.superagent.agent();

    let gmeConfig,
        baseUrl,
        server;

    beforeEach(async function () {
        gmeConfig = testFixture.getGmeConfig();
        await testFixture.clearDatabase(gmeConfig);
        server = testFixture.WebGME.standaloneServer(gmeConfig);
        server.start = promisify(server.start);
        server.stop = promisify(server.stop);
        await server.start();
        baseUrl = server.getUrl();
    });

    afterEach(async function () {
        if (server) {
            await server.stop();
            server = null;
        }
    });

    it('should be able to request access tokens', async function () {
        const response = await createToken();
        assert.equal(response.status, 200);
        assert(response.body.userId, 'Did not set userId');
    });

    it('should be able to create access tokens w/ default display name', async function () {
        const response = await createToken();
        assert.equal(response.status, 200);
        assert(response.body.displayName.startsWith('Created on'), 'Did not set userId');
    });

    it('should be able to list access tokens', async function () {
        await createToken();
        await createToken();
        const res = await listTokens();
        assert.equal(res.status, 200);
        const tokens = res.body;
        assert.equal(tokens.length, 2);
    });

    it('should token list should not include ID', async function () {
        await createToken();
        await createToken();
        const res = await listTokens();
        assert.equal(res.status, 200);
        const tokens = res.body;
        tokens.forEach(token => {
            assert(!token.id);
        });
    });

    it('should be able to delete access tokens', async function () {
        await createToken();
        const {body: token} = await createToken();
        await deleteToken(token.id);
        const res = await listTokens();
        assert.equal(res.status, 200);
        const tokens = res.body;
        assert.equal(tokens.length, 1);
    });

    function createToken() {
        return new Promise(function (resolve, reject) {
            agent.post(baseUrl + '/rest/tokens/create').end(function (err, res) {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    function deleteToken(id) {
        return new Promise(function (resolve, reject) {
            agent.delete(baseUrl + '/rest/tokens/' + id).end(function (err, res) {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    function listTokens() {
        return new Promise(function (resolve, reject) {
            agent.get(baseUrl + '/rest/tokens/').end(function (err, res) {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }
});
