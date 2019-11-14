/*globals requirejs, expect*/
/*eslint-env node, mocha*/
/**
 * @author kecso / https://github.com/kecso
 */
var WebGMEGlobal = {}; //eslint-disable-line

describe('Test the speed of different key generation methods', function () {
    var Client,
        gmeConfig,
        KeyGenerator,
        client;

    function generateRandomObject(size) {
        const chars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k', 'l', 'e', 'q', 'e', 'r', 't', 'y', 'u',
            'i', 'o', 'p', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
        let object = {value: ''};
        for (let i = 0; i < size; i += 1) {
            object.value += chars[Math.floor(Math.random() * chars.length)];
        }

        return object;
    }

    before(function (done) {
        this.timeout(10000);
        requirejs(['client/client', 'text!gmeConfig.json', 'common/util/key'
        ], function (Client_, gmeConfigJSON, KeyGenerator_) {
            Client = Client_;
            KeyGenerator = KeyGenerator_;
            gmeConfig = JSON.parse(gmeConfigJSON);

            client = new Client(gmeConfig);
            client.connectToDatabase(function (err) {
                expect(err).to.equal(null);
                done();
            });
        });
    });

    it('should generate same hashes with different SHA1 methods', function () {
        let object = generateRandomObject(1000000);
        let myconfig = JSON.parse(JSON.stringify(gmeConfig));
        let then;

        myconfig.storage.keyType = 'plainSHA1';
        then = Date.now();
        let plainHash = KeyGenerator(object,myconfig);
        console.log('plain:'+(Date.now()-then));

        myconfig.storage.keyType = 'rustSHA1';
        then = Date.now();
        let rustHash = KeyGenerator(object,myconfig);
        console.log('wasm:'+(Date.now()-then));

        expect(plainHash).to.equal(rustHash);
    });
});