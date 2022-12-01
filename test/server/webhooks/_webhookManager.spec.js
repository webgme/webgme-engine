/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */
var testFixture = require('./_globals');
describe('_webhook Manager', function () {
    'use strict';

    var eventGenerator = new testFixture.EventGenerator(),
        expect = testFixture.expect,
        gmeConfig = testFixture.gmeFixture.getGmeConfig(),
        mongoUri = gmeConfig.mongo.uri,
        port = testFixture.EXPRESS_SERVER_PORT,
        collectionName = '_projects',
        db,
        acceptor,
        server,
        managerProc = require('child_process').spawn('node', ['./src/webhookManager.js', mongoUri]);

    managerProc.stdout.on('data', function (/* data */) {
        // console.log('stdout: ', data.toString('utf-8'));
    });

    managerProc.stderr.on('data', function (/* data */) {
        // console.log('stderr: ', data.toString('utf-8'));
    });

    managerProc.on('close', function (/* code */) {
        // console.log('child process exited with code ', code);
    });

    before(function (done) {
        testFixture.mongodb.MongoClient.connect(mongoUri, {}, function (err, db_) {
            if (err || !db_) {
                throw err || new Error('cannot open mongoDB connection');
            }

            db = db_;
            db.dropCollection(collectionName, function (/*err, result*/) {
                db.collection(collectionName, function (err, collection) {
                    collection.insertMany([
                        {
                            _id: 'project',
                            hooks: {hookOne: {events: ['needsMatch'], url: `http://localhost:${port}}`}}
                        },
                        {
                            _id: 'double',
                            hooks: {
                                hookOne: {events: ['needsMatch'], url: `http://localhost:${port}}`},
                                hookTwo: {events: 'all', url: `http://localhost:${port}}`}
                            }
                        }
                    ], {}, function (err/*, result*/) {
                        if (err) {
                            throw err;
                        }

                        done();
                    });
                });

            });

        });
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
        managerProc.kill();
        db.dropDatabase(done);
    });

    it('should manage to get the event from redis and send it to the proper ulr', function (done) {
        var testEType = 'needsMatch',
            testEData = {projectId: 'project', one: 1, two: 'two'};

        acceptor.post('/', function (req) {
            expect(req.body).not.to.equal(null);
            expect(req.body).not.to.equal(undefined);
            expect(req.body.event).to.equal('needsMatch');
            expect(req.body.hookId).to.equal('hookOne');
            expect(req.body.data).to.eql(testEData);

            done();
        });

        eventGenerator.send('socket.io#/#otherAnything', testEType, testEData);
    });
});
