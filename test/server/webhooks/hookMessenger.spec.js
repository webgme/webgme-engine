/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('./_globals');

describe('Webhook Message sender', function () {
    'use strict';
    var expect = testFixture.expect,
        Q = testFixture.Q,
        gmeConfig = testFixture.gmeFixture.getGmeConfig(),
        mongoUri = gmeConfig.mongo.uri,
        mongoUriParse = require('mongo-uri'),
        dbName = mongoUriParse.parse(mongoUri).database,
        collectionName = 'testHooks',
        port = testFixture.EXPRESS_SERVER_PORT,
        client,
        db,
        acceptor,
        server,
        messageSender = new testFixture.MessageSender({ uri: mongoUri, collection: collectionName });

    before(function (done) {
        //setup hook informations into a collection
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
            .then(function () {
                return messageSender.start();
            })
            .then(done)
            .catch(done);
    });

    after(function (done) {
        messageSender.stop()
            .then(function () {
                Q(client.close());
            })
            .nodeify(done);
    });

    beforeEach(function () {
        acceptor = testFixture.express();
        acceptor.use(testFixture.bodyParser.json());
        server = acceptor.listen(port);
    });

    afterEach(function () {
        server.close();
    });

    it('should send message for matching event', function (done) {
        var eventData = { projectId: 'project', whatever: 'data' };
        //first we need to set the accept for the POSt request
        acceptor.post('/', function (req) {
            expect(req.body).not.to.equal(null);
            expect(req.body).not.to.equal(undefined);
            expect(req.body.event).to.equal('needsMatch');
            expect(req.body.hookId).to.equal('hookOne');
            expect(req.body.data).to.eql(eventData);

            done();
        });

        //we send the event to the eventHandler
        messageSender.send('needsMatch', eventData);
    });

    it('should not send message for non-matching event', function (done) {
        var eventData = { projectId: 'project', whatever: 'data' };
        //first we need to set the accept for the POSt request
        acceptor.post('/', function () {
            throw new Error('non-matching event was fired');
        });

        //we send the event to the eventHandler
        messageSender.send('noMatch', eventData);

        setTimeout(function () {
            done();
        }, 100);
    });

    it('should not send message for non-existing project', function (done) {
        var eventData = { projectId: 'unknown', whatever: 'data' };
        //first we need to set the accept for the POSt request
        acceptor.post('/', function () {
            throw new Error('unknown project fired event');
        });

        //we send the event to the eventHandler
        messageSender.send('needsMatch', eventData);

        setTimeout(function () {
            done();
        }, 100);
    });

    it('should not send message for invalid event', function (done) {
        var eventData = { whatever: 'data' };
        //first we need to set the accept for the POSt request
        acceptor.post('/', function () {
            throw new Error('invalid event was fired');
        });

        //we send the event to the eventHandler
        messageSender.send('needsMatch', eventData);

        setTimeout(function () {
            done();
        }, 100);
    });

    it('should send message for all matching hook', function (done) {
        var eventData = { projectId: 'double', whatever: 'data' },
            counter = 2;
        //first we need to set the accept for the POSt request
        acceptor.post('/', function (req) {
            if (counter > 0) {
                expect(req.body.data).to.eql(eventData);
            }

            counter -= 1;
            if (counter < 0) {
                throw new Error('Too message was sent!');
            }

            if (counter === 0) {
                setTimeout(function () {
                    done();
                }, 100);
            }
        });

        //we send the event to the eventHandler
        messageSender.send('needsMatch', eventData);

    });

    it('should send message for matching hooks only', function (done) {
        var eventData = { projectId: 'double', whatever: 'data' },
            counter = 1;
        //first we need to set the accept for the POSt request
        acceptor.post('/', function (req) {
            if (counter > 0) {
                expect(req.body.data).to.eql(eventData);
            }

            counter -= 1;
            if (counter < 0) {
                throw new Error('Too message was sent!');
            }

            if (counter === 0) {
                setTimeout(function () {
                    done();
                }, 100);
            }
        });

        //we send the event to the eventHandler
        messageSender.send('notAllMatch', eventData);

    });
});
