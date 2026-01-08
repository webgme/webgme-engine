/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */
var testFixture = require('./_globals');
describe('redisWebhookManager', function () {
    'use strict';

    var eventGenerator = new testFixture.EventGenerator(),
        expect = testFixture.expect,
        gmeConfig = testFixture.gmeFixture.getGmeConfig(),
        uriParser = require('mongo-uri'),
        childProcess = require('child_process'),
        path = require('path'),
        mongoUri = gmeConfig.mongo.uri,
        port = testFixture.EXPRESS_SERVER_PORT,
        collectionName = '_projects',
        db,
        client,
        dbName = uriParser.parse(mongoUri).database,
        acceptor,
        server,
        managerProc;



    before(function (done) {
        let cnt = 2;
        function atComplete() {
            cnt -= 1;
            if (cnt === 0) {
                done();
            }
        }

        managerProc = childProcess.fork(path.join(__dirname, '../../../src/server/webhooks/redisWebhookManager.js'),
            [mongoUri], { stdio: 'pipe' });

        managerProc.stdout.on('data', () => {
            atComplete();
        });

        testFixture.mongodb.MongoClient.connect(mongoUri, {})
            .then(function (client_) {
                client = client_;
                db = client.db(dbName);

                return db.dropCollection(collectionName)
                    .catch(()=>{}); // ignore error if collection does not exist
            })
            .then(function () {
                const collection = db.collection(collectionName);
                return collection.insertMany([
                    {
                        _id: 'project',
                        hooks: { hookOne: { events: ['needsMatch'], url: `http://localhost:${port}` } }
                    },
                    {
                        _id: 'double',
                        hooks: {
                            hookOne: { events: ['needsMatch'], url: `http://localhost:${port}` },
                            hookTwo: { events: 'all', url: `http://localhost:${port}` }
                        }
                    }
                ]);
            })
            .then(atComplete)
            .catch(done);
    });

    beforeEach(function () {
        acceptor = testFixture.express();
        acceptor.use(testFixture.bodyParser.json());
        server = acceptor.listen(port);
    });

    afterEach(function () {
        server.close();
    });

    after(function (done) {
        let cnt = 2;
        function atClosed() {
            cnt -= 1;
            if (cnt === 0) {
                done();
            }
        }

        managerProc.kill();
        managerProc.on('exit', atClosed);
        client.close(atClosed);
    });

    it('should manage to get the event from redis and send it to the proper url', function (done) {
        var testEType = 'needsMatch',
            testEData = { projectId: 'project', one: 1, two: 'two' };

        acceptor.post('/', function (req) {
            try {
                expect(req.body).not.to.equal(null);
                expect(req.body).not.to.equal(undefined);
                expect(req.body.event).to.equal('needsMatch');
                expect(req.body.hookId).to.equal('hookOne');
                expect(req.body.data).to.eql(testEData);
                done();
            } catch (err) {
                done(err);
            }
        });

        eventGenerator.send('socket.io#/#otherAnything', testEType, testEData);
    });
});
