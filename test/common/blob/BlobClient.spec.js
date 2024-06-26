/*eslint-env node, mocha*/
/*eslint no-bitwise: 0, max-len: 0*/
/**
 * @author ksmyth / https://github.com/ksmyth
 * @author pmeijer / https://github.com/pmeijer
 */

var testFixture = require('../../_globals.js');

describe('BlobClient', function () {
    'use strict';
    const _ = require('underscore');
    const assert = require('assert');
    var rimraf = testFixture.rimraf,
        should = testFixture.should,
        superagent = testFixture.superagent,
        expect = testFixture.expect,
        BlobClient = testFixture.BlobClient,
        Artifact = testFixture.requirejs('blob/Artifact'),
        fs = testFixture.fs,
        Q = testFixture.Q,
        server,
        nodeTLSRejectUnauthorized,
        bcParam = {};

    describe('[http]', function () {
        before(function (done) {
            // we have to set the config here
            var gmeConfig = testFixture.getGmeConfig();
            bcParam.serverPort = gmeConfig.server.port;
            bcParam.server = '127.0.0.1';
            bcParam.httpsecure = false;
            bcParam.logger = testFixture.logger.fork('Blob');
            server = testFixture.WebGME.standaloneServer(gmeConfig);
            server.start(function () {
                done();
            });
        });

        beforeEach(async function () {
            await rimraf('./test-tmp/blob-storage');
        });

        after(function (done) {
            server.stop(done);
        });

        it('should get metadata url', function () {
            var bc = new BlobClient(bcParam);
            expect(typeof bc.getMetadataURL === 'function').to.equal(true);
            expect(bc.getMetadataURL()).to.contain('metadata');
            expect(bc.getMetadataURL('1234567890abcdef')).to.contain('1234567890abcdef');
        });

        it('should get download url', function () {
            var bc = new BlobClient(bcParam);
            expect(typeof bc.getDownloadURL === 'function').to.equal(true);
            expect(bc.getDownloadURL()).to.contain('download');
            expect(bc.getDownloadURL('1234567890abcdef')).to.contain('1234567890abcdef');
            expect(bc.getDownloadURL('1234567890abcdef', 'some/path/to/a/file.txt')).to.contain('1234567890abcdef/some%2Fpath%2Fto%2Fa%2Ffile.txt');
        });

        it('getMetaDataUrl should be concatenation of origin and getRelativeMetaDataUrl', function () {
            var bc = new BlobClient(bcParam),
                relativeUrl = bc.getRelativeMetadataURL();

            expect(bc.getMetadataURL()).to.equal(bc.origin + relativeUrl);
        });

        it('getViewURL should be concatenation of origin and getRelativeViewURL', function () {
            var bc = new BlobClient(bcParam),
                relativeUrl = bc.getRelativeViewURL('someHash', 'someSubPath');

            expect(bc.getViewURL('someHash', 'someSubPath')).to.equal(bc.origin + relativeUrl);
        });

        it('getDownloadURL should be concatenation of origin and getRelativeDownloadURL', function () {
            var bc = new BlobClient(bcParam),
                relativeUrl = bc.getRelativeDownloadURL('someHash', 'someSubPath');

            expect(bc.getDownloadURL('someHash', 'someSubPath')).to.equal(bc.origin + relativeUrl);
        });

        it('getCreateURL should be concatenation of origin and getRelativeCreateURL', function () {
            var bc = new BlobClient(bcParam),
                relativeUrl = bc.getRelativeCreateURL('someFileName', true);

            expect(bc.getCreateURL('someFileName', true)).to.equal(bc.origin + relativeUrl);
        });

        it('should have putFile', function () {
            var bc = new BlobClient(bcParam);
            expect(typeof bc.putFile === 'function').to.equal(true);
        });

        it('should create file from empty buffer', function (done) {
            var bc = new BlobClient(bcParam);

            bc.putFile('test.txt', Buffer.alloc(0), function (err, hash) {
                if (err) {
                    done(err);
                    return;
                }
                bc.getMetadata(hash, function (err, metadata) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(metadata.mime).to.equal('text/plain');
                    bc.getObject(hash, function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(typeof res).to.equal('object');
                        expect(typeof res.prototype).to.equal('undefined');
                        //expect(res[1]).to.equal(2);
                        done();
                    });
                });
            });
        });

        it('should create json', function (done) {
            var bc = new BlobClient(bcParam);

            bc.putFile('test.json', str2ab('{"1":2}'), function (err, hash) {
                if (err) {
                    done(err);
                    return;
                }
                bc.getMetadata(hash, function (err, metadata) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(metadata.mime).to.equal('application/json');
                    bc.getObject(hash, function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(typeof res).to.equal('object');
                        expect(typeof res.prototype).to.equal('undefined');
                        //expect(res[1]).to.equal(2);
                        done();
                    });
                });
            });
        });

        it('should create strange filenames', function (done) {
            var bc = new BlobClient(bcParam);

            bc.putFile('te%s#t.json', '{"1":2}', function (err, hash) {
                if (err) {
                    done(err);
                    return;
                }
                bc.getMetadata(hash, function (err, metadata) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(metadata.mime).to.equal('application/json');
                    bc.getObject(hash, function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(typeof res).to.equal('object');
                        expect(typeof res.prototype).to.equal('undefined');
                        //expect(res[1]).to.equal(2);
                        done();
                    });
                });
            });
        });

        it('should putFile unicode', function (done) {
            var bc = new BlobClient(bcParam),
                input = '1111\nmu \u03BC\n1111\n\\U+10400 DESERET CAPITAL LETTER LONG I \uD801\uDC00';

            bc.putFile('1111\u03BC222\uD801\uDC00.bin', input, function (err, hash) {
                if (err) {
                    done(err);
                    return;
                }
                bc.getMetadata(hash, function (err, metadata) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(metadata.mime).to.equal('application/octet-stream');
                    bc.getObject(hash, function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(typeof res).to.equal('object');
                        expect(typeof res.prototype).to.equal('undefined');
                        expect(res.toString('utf8')).to.equal(input);
                        //expect(res[1]).to.equal(2);
                        done();
                    });
                });
            });
        });

        it('should putFile streamed file', function (done) {
            var bc = new BlobClient(bcParam),
                rs = fs.createReadStream('./package.json'),
                content = fs.readFileSync('./package.json');

            bc.putFile('package.json', rs, function (err, hash) {
                if (err) {
                    done(err);
                    return;
                }
                bc.getMetadata(hash, function (err, metadata) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(metadata.mime).to.equal('application/json');
                    bc.getObject(hash, function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(typeof res).to.equal('object');
                        expect(typeof res.prototype).to.equal('undefined');
                        expect(res).to.eql(content);
                        //expect(res[1]).to.equal(2);
                        done();
                    });
                });
            });
        });

        it('should not hide request errors on putFile w/ stream', async function () {
            const bc = new BlobClient(bcParam);
            const rs = fs.createReadStream('./package.json');

            bc.getCreateURL = () => '/nonexistentURL';
            await assert.rejects(() => bc.putFile('package.json', rs));
        });

        it('should putFile streamed string', function (done) {
            var bc = new BlobClient(bcParam),
                stream = require('stream'),
                mystring = 'just a test',
                myBuffer = Buffer.from(mystring),
                rs = new stream.Readable();

            rs._read = () => {};
            rs.push(myBuffer);
            rs.push(null);
            bc.putFile('package.json', rs, function (err, hash) {
                if (err) {
                    done(err);
                    return;
                }
                bc.getMetadata(hash, function (err, metadata) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(metadata.mime).to.equal('application/json');
                    bc.getObject(hash, function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(typeof res).to.equal('object');
                        expect(typeof res.prototype).to.equal('undefined');
                        expect(res).to.eql(myBuffer);
                        //expect(res[1]).to.equal(2);
                        done();
                    });
                });
            });
        });

        it('getObjectAsString should create file from empty buffer and return as string', function (done) {
            var bc = new BlobClient(bcParam);

            bc.putFile('test2.txt', Buffer.alloc(0))
                .then(function (hash) {
                    return bc.getObjectAsString(hash);
                })
                .then(function (res) {
                    expect(typeof res).to.equal('string');
                    expect(res).to.equal('');
                })
                .nodeify(done);
        });

        it('getObjectAsString should create json and return as string', function (done) {
            var bc = new BlobClient(bcParam),
                input = '{"1":2}';

            bc.putFile('test.json', str2ab(input))
                .then(function (hash) {
                    return bc.getObjectAsString(hash);
                })
                .then(function (res) {
                    expect(typeof res).to.equal('string');
                    expect(res).to.equal(input);
                })
                .nodeify(done);
        });

        it('getObjectAsString should create file from unicode and return as string', function (done) {
            var bc = new BlobClient(bcParam),
                input = '1111\nmu \u03BC\n1111\n\\U+10400 DESERET CAPITAL LETTER LONG I \uD801\uDC00';

            bc.putFile('1111\u03BC222\uD801\uDC00.bin', input)
                .then(function (hash) {
                    return bc.getObjectAsString(hash);
                })
                .then(function (res) {
                    expect(typeof res).to.equal('string');
                    expect(res).to.equal(input);
                })
                .nodeify(done);
        });

        it('getObjectAsJSON should raise exception on text file', function (done) {
            var bc = new BlobClient(bcParam);

            bc.putFile('test2.txt', 'txtContent')
                .then(function (hash) {
                    return bc.getObjectAsJSON(hash);
                })
                .then(function (/*res*/) {
                    throw new Error('Should have failed!');
                })
                .catch(function (err) {
                    expect(err.message).to.include('Unexpected token');
                })
                .nodeify(done);
        });

        it('getObjectAsJSON should create json and return as json', function (done) {
            var bc = new BlobClient(bcParam),
                input = '{"1":2}';

            bc.putFile('test.json', str2ab(input))
                .then(function (hash) {
                    return bc.getObjectAsJSON(hash);
                })
                .then(function (res) {
                    expect(typeof res).to.equal('object');
                    expect(res).to.deep.equal(JSON.parse(input));
                })
                .nodeify(done);
        });

        //ISSUE weird escape crash...
        it('getObjectAsJSON should create json and return as json', function (done) {
            var bc = new BlobClient(bcParam),
                path = require('path'),
                input = fs.readFileSync(path.join(__dirname, 'artifacts', 'escape-crash.json'), 'utf8');

            bc.putFile('test.json', input)
                .then(function (hash) {
                    return bc.getObjectAsJSON(hash);
                })
                .then(function (res) {
                    expect(typeof res).to.equal('object');
                    expect(res).to.deep.equal(JSON.parse(input));
                })
                .nodeify(done);
        });

        if (typeof global !== 'undefined') {
            it('should create zip', function (done) {
                var data = base64DecToArr('UEsDBAoAAAAAACNaNkWtbMPDBwAAAAcAAAAIAAAAZGF0YS5ia' +
                    'W5kYXRhIA0KUEsBAj8ACgAAAAAA\n' +
                    'I1o2Ra1sw8MHAAAABwAAAAgAJAAAAAAAAAAgAAAAAAAAAGRhdGEuYmluCgAgAAAAAAABABgAn3xF\n' +
                    'poDWzwGOVUWmgNbPAY5VRaaA1s8BUEsFBgAAAAABAAEAWgAAAC0AAAAAAA==');
                createZip(data, done);
            });
        }

        if (typeof global !== 'undefined') { // i.e. if running under node-webkit
            // need this in package.json: "node-remote": "localhost"
            it('should create zip from Buffer', function (done) {
                var data = base64DecToArr('UEsDBAoAAAAAACNaNkWtbMPDBwAAAAcAAAAIAAAAZGF0YS5ia' +
                    'W5kYXRhIA0KUEsBAj8ACgAAAAAA\n' +
                    'I1o2Ra1sw8MHAAAABwAAAAgAJAAAAAAAAAAgAAAAAAAAAGRhdGEuYmluCgAgAAAAAAABABgAn3xF\n' +
                    'poDWzwGOVUWmgNbPAY5VRaaA1s8BUEsFBgAAAAABAAEAWgAAAC0AAAAAAA==');
                createZip(Buffer.from(data), done);
            });
        }

        if (typeof global !== 'undefined' && typeof window !== 'undefined') { // i.e. if running under node-webkit
            // need this in package.json: "node-remote": "localhost"
            it('should create zip from node-webkit File', function (done) {
                var f = new File('./npm_install.cmd', 'npm_install.cmd');
                //expect(Object.getOwnPropertyNames(f).join(' ')).to.equal(0);
                var bc = new BlobClient(bcParam);
                bc.putFile('npm_install.cmd', f, function (err/*, hash*/) {
                    if (err) {
                        done(err);
                        return;
                    }
                    done();
                });
            });
        }

        it('should create metadata', function (done) {
            var artifact = new Artifact('testartifact', new BlobClient(bcParam));
            artifact.addFiles({file1: 'content1', file2: 'content2'}, function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                expect(Object.keys(hashes).length).to.equal(2);
                done();
            });
        });

        it('should create zip 1', function (done) {
            var filesToAdd = {
                    'j%s#on.json': '{"1":2}',
                    'x#m%l.xml': '<doc/>'
                },
                artifact = new BlobClient(bcParam).createArtifact('xmlAndJson');
            artifact.addFiles(filesToAdd, function (err/*, hashes*/) {
                if (err) {
                    done(new Error('Could not add files : err' + err.toString()));
                    return;
                }
                artifact.save(function (err, hash) {
                    if (err) {
                        done(new Error('Could not save artifact : err' + err.toString()));
                        return;
                    }
                    var agent = superagent.agent();
                    var url = (new BlobClient(bcParam)).getViewURL(hash, 'j%s#on.json');
                    //console.log(url);
                    agent.get(url).end(function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        //console.log(res);
                        should.equal(res.status, 200);
                        done();
                    });
                    //req.open("GET", new BlobClient(bcParam).getViewURL(hash, 'j%s#on.json'), true);
                    //req.onreadystatechange = function () {
                    //    if (req.readyState != 4) return;
                    //    if (req.status != 200) {
                    //        done(req.status);
                    //    }
                    //    done();
                    //}
                    //req.send();
                });
            });
        });

        it('putFiles should put multiple files', function (done) {
            var bc = new BlobClient(bcParam),
                filesToAdd = {
                    'a.json': JSON.stringify({a: 1, b: 2}),
                    'some.txt': 'Thsh shs'
                };
            bc.putFiles(filesToAdd, function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                should.equal(Object.keys(hashes).length, 2);
                done();
            });
        });

        it('putFiles with empty object should return empty hashes obj', function (done) {
            var bc = new BlobClient(bcParam),
                filesToAdd = {};
            bc.putFiles(filesToAdd, function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                should.equal(Object.keys(hashes).length, 0);
                done();
            });
        });

        it('saveAllArtifacts with zero artifacts should return empty hashes list', function (done) {
            var bc = new BlobClient(bcParam);
            bc.saveAllArtifacts(function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                should.equal(hashes.length, 0);
                done();
            });
        });

        it('saveAllArtifacts with empty artifacts should work', function (done) {
            var bc = new BlobClient(bcParam);

            bc.createArtifact('artie1');
            bc.createArtifact('artie2');
            bc.saveAllArtifacts(function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                should.equal(hashes.length, 2);
                done();
            });
        });

        it('save and getArtifact should return same artifact', function (done) {
            var bc = new BlobClient(bcParam),
                artie = bc.createArtifact('artie');
            artie.addFile('aname.txt', 'the text', function (err/*, hash*/) {
                if (err) {
                    done(err);
                    return;
                }
                bc.saveAllArtifacts(function (err, hashes) {
                    if (err) {
                        done(err);
                        return;
                    }
                    should.equal(hashes.length, 1);
                    bc.getArtifact(hashes[0], function (err, artifact) {
                        if (err) {
                            done(err);
                            return;
                        }
                        should.equal(artifact.name, 'artie.zip');
                        done();
                    });
                });
            });
        });


        it('getMetadata should 404 when metadataHash does not exist', function (done) {
            var bc = new BlobClient(bcParam),
                faultyHash = '0214c7b2d364f26020f870ed9b193f59f007070a';

            bc.getMetadata(faultyHash)
                .then(function () {
                    throw new Error('Should have failed!');
                })
                .catch(function (err) {
                    expect(err.status).to.equal(404);
                })
                .nodeify(done);
        });

        it('getMetadata should 404 when metadataHash not valid hash', function (done) {
            var bc = new BlobClient(bcParam),
                faultyHash = '883';

            bc.getMetadata(faultyHash)
                .then(function () {
                    throw new Error('Should have failed!');
                })
                .catch(function (err) {
                    expect(err.status).to.equal(404);
                })
                .nodeify(done);
        });

        it('getMetadata should 404 when metadataHash not valid hash (array)', function (done) {
            var bc = new BlobClient(bcParam),
                faultyHash = ['882', '42'];

            bc.getMetadata(faultyHash)
                .then(function () {
                    throw new Error('Should have failed!');
                })
                .catch(function (err) {
                    expect(err.status).to.equal(404);
                })
                .nodeify(done);
        });

        it('getMetadata should 404 when metadataHash does not exist', function (done) {
            var bc = new BlobClient(bcParam),
                faultyHash = '0214c7b2d364f26020f870ed9b193f59f007070a';

            bc.getMetadata(faultyHash)
                .then(function () {
                    throw new Error('Should have failed!');
                })
                .catch(function (err) {
                    expect(err.status).to.equal(404);
                })
                .nodeify(done);
        });

        it('getMetadata should 404 when metadataHash not valid hash (array of existing hashes)', function (done) {
            var bc = new BlobClient(bcParam);

            bc.putFiles({
                'a.txt': 'text in a',
                'b.txt': 'text in b',
            }).then(function (hashes) {

                return bc.getMetadata([hashes['a.txt'], hashes['b.txt']]);
            })
                .then(function () {
                    throw new Error('Should have failed!');
                })
                .catch(function (err) {
                    expect(err.status).to.equal(404);
                })
                .nodeify(done);
        });
    });

    describe('[https]', function () {
        var proxy; // https reverse proxy
        before(function (done) {
            // we have to set the config here
            nodeTLSRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
            var gmeConfig = testFixture.getGmeConfig();
            var proxyServerPort = gmeConfig.server.port - 1;
            bcParam.serverPort = proxyServerPort; // use https reverse proxy port
            bcParam.server = '127.0.0.1';
            bcParam.httpsecure = true;
            bcParam.logger = testFixture.logger.fork('Blob');

            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
            server = testFixture.WebGME.standaloneServer(gmeConfig);
            var httpProxy = require('http-proxy');
            var fs = require('fs');
            var path = require('path');
            //
            // Create the HTTPS proxy server in front of a HTTP server
            //
            proxy = httpProxy.createServer({
                target: {
                    host: 'localhost',
                    port: gmeConfig.server.port
                },
                ssl: {
                    key: fs.readFileSync(path.join(__dirname, '..', '..', 'certificates', 'sample-key.pem'), 'utf8'),
                    cert: fs.readFileSync(path.join(__dirname, '..', '..', 'certificates', 'sample-cert.pem'), 'utf8')
                }
            });

            server.start(function () {
                proxy.listen(proxyServerPort, done);
            });
        });

        beforeEach(async function () {
            await rimraf('./test-tmp/blob-storage');
        });

        after(function (done) {
            server.stop(function (err) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = nodeTLSRejectUnauthorized;
                proxy.close(function (err1) {
                    done(err || err1);
                });
            });
        });

        it('should create json', function (done) {
            var bc = new BlobClient(bcParam);

            bc.putFile('test.json', str2ab('{"1":2}'), function (err, hash) {
                if (err) {
                    done(err);
                    return;
                }
                bc.getMetadata(hash, function (err, metadata) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(metadata.mime).to.equal('application/json');
                    bc.getObject(hash, function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(typeof res).to.equal('object');
                        expect(typeof res.prototype).to.equal('undefined');
                        //expect(res[1]).to.equal(2);
                        done();
                    });
                });
            });
        });

        it('should create strange filenames', function (done) {
            var bc = new BlobClient(bcParam);

            bc.putFile('te%s#t.json', '{"1":2}', function (err, hash) {
                if (err) {
                    done(err);
                    return;
                }
                bc.getMetadata(hash, function (err, metadata) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(metadata.mime).to.equal('application/json');
                    bc.getObject(hash, function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(typeof res).to.equal('object');
                        expect(typeof res.prototype).to.equal('undefined');
                        //expect(res[1]).to.equal(2);
                        done();
                    });
                });
            });
        });

        if (typeof global !== 'undefined') {
            it('should create zip', function (done) {
                var data = base64DecToArr('UEsDBAoAAAAAACNaNkWtbMPDBwAAAAcAAAAIAAAAZGF0YS5ia' +
                    'W5kYXRhIA0KUEsBAj8ACgAAAAAA\n' +
                    'I1o2Ra1sw8MHAAAABwAAAAgAJAAAAAAAAAAgAAAAAAAAAGRhdGEuYmluCgAgAAAAAAABABgAn3xF\n' +
                    'poDWzwGOVUWmgNbPAY5VRaaA1s8BUEsFBgAAAAABAAEAWgAAAC0AAAAAAA==');
                createZip(data, done);
            });
        }

        if (typeof global !== 'undefined') { // i.e. if running under node-webkit
            // need this in package.json: "node-remote": "localhost"
            it('should create zip from Buffer', function (done) {
                var data = base64DecToArr('UEsDBAoAAAAAACNaNkWtbMPDBwAAAAcAAAAIAAAAZGF0YS5ia' +
                    'W5kYXRhIA0KUEsBAj8ACgAAAAAA\n' +
                    'I1o2Ra1sw8MHAAAABwAAAAgAJAAAAAAAAAAgAAAAAAAAAGRhdGEuYmluCgAgAAAAAAABABgAn3xF\n' +
                    'poDWzwGOVUWmgNbPAY5VRaaA1s8BUEsFBgAAAAABAAEAWgAAAC0AAAAAAA==');
                createZip(Buffer.from(data), done);
            });
        }

        if (typeof global !== 'undefined' && typeof window !== 'undefined') { // i.e. if running under node-webkit
            // need this in package.json: "node-remote": "localhost"
            it('should create zip from node-webkit File', function (done) {
                var f = new File('./npm_install.cmd', 'npm_install.cmd');
                //expect(Object.getOwnPropertyNames(f).join(' ')).to.equal(0);
                var bc = new BlobClient(bcParam);
                bc.putFile('npm_install.cmd', f, function (err/*, hash*/) {
                    if (err) {
                        done(err);
                        return;
                    }
                    done();
                });
            });
        }

        it('should create metadata', function (done) {
            var artifact = new Artifact('testartifact', new BlobClient(bcParam));
            artifact.addFiles({file1: 'content1', file2: 'content2'}, function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                expect(Object.keys(hashes).length).to.equal(2);
                done();
            });
        });

        it('should create zip 1', function (done) {
            var filesToAdd = {
                    'j%s#on.json': '{"1":2}',
                    'x#m%l.xml': '<doc/>'
                },
                artifact = new BlobClient(bcParam).createArtifact('xmlAndJson');
            artifact.addFiles(filesToAdd, function (err/*, hashes*/) {
                if (err) {
                    done('Could not add files : err' + err.toString());
                    return;
                }
                artifact.save(function (err, hash) {
                    if (err) {
                        done('Could not save artifact : err' + err.toString());
                        return;
                    }
                    var agent = superagent.agent();
                    var url = (new BlobClient(bcParam)).getViewURL(hash, 'j%s#on.json');
                    //console.log(url);
                    agent.get(url).end(function (err, res) {
                        if (err) {
                            done(err);
                            return;
                        }
                        //console.log(res);
                        should.equal(res.status, 200);
                        done();
                    });
                    //req.open("GET", new BlobClient(bcParam).getViewURL(hash, 'j%s#on.json'), true);
                    //req.onreadystatechange = function () {
                    //    if (req.readyState != 4) return;
                    //    if (req.status != 200) {
                    //        done(req.status);
                    //    }
                    //    done();
                    //}
                    //req.send();
                });
            });
        });

        it('putFiles should put multiple files', function (done) {
            var bc = new BlobClient(bcParam),
                filesToAdd = {
                    'a.json': JSON.stringify({a: 1, b: 2}),
                    'some.txt': 'Thsh shs'
                };
            bc.putFiles(filesToAdd, function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                should.equal(Object.keys(hashes).length, 2);
                done();
            });
        });

        it('putFiles with empty object should return empty hashes obj', function (done) {
            var bc = new BlobClient(bcParam),
                filesToAdd = {};
            bc.putFiles(filesToAdd, function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                should.equal(Object.keys(hashes).length, 0);
                done();
            });
        });

        it('saveAllArtifacts with zero artifacts should return empty hashes list', function (done) {
            var bc = new BlobClient(bcParam);
            bc.saveAllArtifacts(function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                should.equal(hashes.length, 0);
                done();
            });
        });

        it('saveAllArtifacts with empty artifacts should work', function (done) {
            var bc = new BlobClient(bcParam);

            bc.createArtifact('artie1');
            bc.createArtifact('artie2');
            bc.saveAllArtifacts(function (err, hashes) {
                if (err) {
                    done(err);
                    return;
                }
                should.equal(hashes.length, 2);
                done();
            });
        });

        it('save and getArtifact should return same artifact', function (done) {
            var bc = new BlobClient(bcParam),
                artie = bc.createArtifact('artie');
            artie.addFile('aname.txt', 'the text', function (err/*, hash*/) {
                if (err) {
                    done(err);
                    return;
                }
                bc.saveAllArtifacts(function (err, hashes) {
                    if (err) {
                        done(err);
                        return;
                    }
                    should.equal(hashes.length, 1);
                    bc.getArtifact(hashes[0], function (err, artifact) {
                        if (err) {
                            done(err);
                            return;
                        }
                        should.equal(artifact.name, 'artie.zip');
                        done();
                    });
                });
            });
        });

        it('streamObject to a file', function (done) {
            var bc = new BlobClient(bcParam),
                artie = bc.createArtifact('artie');

            Q.allDone([
                artie.addFile('1.txt', 'text 1'),
                artie.addFile('2.txt', 'text 2'),
                artie.addFile('3.txt', 'text 3')
            ])
                .then(function () {
                    return artie.save();
                })
                .then(function (metadataHash) {
                    var zipFile = testFixture.path.join('test-tmp', 'streamed.zip'),
                        deferred = Q.defer(),
                        writeStream = fs.createWriteStream(zipFile);

                    writeStream.on('error', function (err) {
                        deferred.reject(err);
                    });

                    writeStream.on('finish', function () {
                        deferred.resolve(zipFile);
                    });

                    bc.getStreamObject(metadataHash, writeStream);

                    return deferred.promise;
                })
                .then(function (zip) {
                    // This throws if it does not exist
                    return Q.ninvoke(fs, 'unlink', zip);
                })
                .nodeify(done);
        });

        it('streamObject with subpath to a file', function (done) {
            var bc = new BlobClient(bcParam),
                artie = bc.createArtifact('artie');

            Q.allDone([
                artie.addFile('1.txt', 'text 1'),
                artie.addFile('2.txt', 'text 2'),
                artie.addFile('3.txt', 'text 3')
            ])
                .then(function () {
                    return artie.save();
                })
                .then(function (metadataHash) {
                    var txtFile = testFixture.path.join('test-tmp', '1.txt'),
                        deferred = Q.defer(),
                        writeStream = fs.createWriteStream(txtFile);

                    writeStream.on('error', function (err) {
                        deferred.reject(err);
                    });

                    writeStream.on('finish', function () {
                        deferred.resolve(txtFile);
                    });

                    bc.getStreamObject(metadataHash, writeStream, '1.txt');

                    return deferred.promise;
                })
                .then(function (txtFile) {
                    // This throws if it does not exist
                    return Q.ninvoke(fs, 'unlink', txtFile);
                })
                .nodeify(done);
        });
    });

    describe('paths', function () {
        it('should be correct with default config', function () {
            var bc = new BlobClient({});
            expect(bc.getMetadataURL()).to.contain('/rest/blob');
            expect(bc.getMetadataURL()).to.contain('metadata');
            expect(bc.getDownloadURL()).to.contain('/rest/blob');
            expect(bc.getDownloadURL()).to.contain('download');
            expect(bc.getRelativeViewURL()).to.contain('/rest/blob');
            expect(bc.getRelativeViewURL()).to.contain('view');
            expect(bc.getRelativeDownloadURL()).to.contain('/rest/blob');
            expect(bc.getRelativeDownloadURL()).to.contain('download');
        });

        it('should be correct with relativeUrl set', function () {
            var relUrl = '/relative/',
                bc = new BlobClient({relativeUrl: relUrl});
            expect(bc.getMetadataURL()).not.to.contain('/rest/blob');
            expect(bc.getMetadataURL()).to.contain(relUrl);
            expect(bc.getMetadataURL()).to.contain('metadata');
            expect(bc.getDownloadURL()).not.to.contain('/rest/blob');
            expect(bc.getDownloadURL()).to.contain(relUrl);
            expect(bc.getDownloadURL()).to.contain('download');
            expect(bc.getRelativeViewURL()).not.to.contain('/rest/blob');
            expect(bc.getRelativeViewURL()).to.contain(relUrl);
            expect(bc.getRelativeViewURL()).to.contain('view');
            expect(bc.getRelativeDownloadURL()).not.to.contain('/rest/blob');
            expect(bc.getRelativeDownloadURL()).to.contain(relUrl);
            expect(bc.getRelativeDownloadURL()).to.contain('download');
        });

        it('should be correct with WebGMEGlobal config mountedPath', function () {
            var bc,
                oldGlobal = WebGMEGlobal; // eslint-disable-line no-undef

            WebGMEGlobal = {gmeConfig: {client: {mountedPath: '/mounted'}}}; // eslint-disable-line no-undef

            bc = new BlobClient({});
            expect(bc.getMetadataURL()).to.contain('/mounted/rest/blob');
            expect(bc.getMetadataURL()).to.contain('metadata');
            expect(bc.getDownloadURL()).to.contain('/mounted/rest/blob');
            expect(bc.getDownloadURL()).to.contain('download');
            expect(bc.getRelativeViewURL()).to.contain('/mounted/rest/blob');
            expect(bc.getRelativeViewURL()).to.contain('view');
            expect(bc.getRelativeDownloadURL()).to.contain('/mounted/rest/blob');
            expect(bc.getRelativeDownloadURL()).to.contain('download');

            WebGMEGlobal = oldGlobal; // eslint-disable-line no-undef
        });
    });

    describe('[http - compression level]', function () {
        before(function (done) {
            // we have to set the config here
            var gmeConfig = testFixture.getGmeConfig();
            gmeConfig.blob.compressionLevel = 9;
            bcParam.serverPort = gmeConfig.server.port;
            bcParam.server = '127.0.0.1';
            bcParam.httpsecure = false;
            bcParam.logger = testFixture.logger.fork('Blob');
            server = testFixture.WebGME.standaloneServer(gmeConfig);
            server.start(function () {
                done();
            });
        });

        beforeEach(async function () {
            await rimraf('./test-tmp/blob-storage');
        });

        after(function (done) {
            server.stop(done);
        });

        it('should create artifact and downloading it should create compressed zip', function (done) {
            var filesToAdd = {
                    'a.txt': 'Hello there,Hello there,Hello there,Hello there,Hello there,Hello there,Hello there,',
                    'b.txt': 'Hello there,Hello there,Hello there,Hello there,Hello there,Hello there,Hello there,',
                    'c.txt': 'Hello there,Hello there,Hello there,Hello there,Hello there,Hello there,Hello there,',
                    'd.txt': 'Hello there,Hello there,Hello there,Hello there,Hello there,Hello there,Hello there,',
                },
                bc = new BlobClient(bcParam),
                artifact = bc.createArtifact('compressedAtDl');

            artifact.addFiles(filesToAdd)
                .then(function () {
                    return artifact.save();
                })
                .then(function (hash) {
                    var dlUrl = bc.getDownloadURL(hash),
                        output = fs.createWriteStream('./test-tmp/blob-storage/zipped.zip');

                    superagent.get(dlUrl).pipe(output);

                    output.on('close', function () {
                        // console.log(output.bytesWritten);
                        try {
                            // Set compressionLevel to 0 to check reference value.
                            expect(output.bytesWritten < 766).to.equal(true);
                            expect(output.bytesWritten > 50).to.equal(true); // Shouldn't be empty (9 on windows)

                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                })
                .catch(done);
        });
    });

    describe('[http - access tokens]', function () {
        before(async function () {
            const gmeConfig = testFixture.getGmeConfig();
            gmeConfig.authentication.enable = true;
            gmeConfig.authentication.allowGuests = false;
            gmeConfig.authentication.logInUrl = null;

            const gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig);
            await gmeAuth.addUser('user1', 'u1@mail.com', 'plaintext', false, {
                overwrite: true,
                displayName: 'User One',
            });
            const jwt = await gmeAuth.generateJWTokenForAuthenticatedUser('user1');

            bcParam.serverPort = gmeConfig.server.port;
            bcParam.server = '127.0.0.1';
            bcParam.httpsecure = false;
            bcParam.logger = testFixture.logger.fork('Blob');

            server = testFixture.WebGME.standaloneServer(gmeConfig);
            await new Promise(resolve => server.start(resolve));

            const apiToken = await getAccessToken(jwt);
            bcParam.apiToken = apiToken.id;
            bcParam.webgmeToken = jwt;
        });

        beforeEach(async function () {
            await rimraf('./test-tmp/blob-storage');
        });

        after(function (done) {
            server.stop(done);
        });

        it('should authenticate using access token', async function () {
            const params = _.omit(bcParam, ['apiToken']);
            const bc = new BlobClient(params);
            await bc.putFile('test.txt', Buffer.alloc(0));
        });

        it('should authenticate using JWT', async function () {
            const params = _.omit(bcParam, ['webgmeToken']);
            const bc = new BlobClient(params);
            await bc.putFile('test.txt', Buffer.alloc(0));
        });

        it('should fail if no auth credentials', async function () {
            const params = _.omit(bcParam, ['apiToken', 'webgmeToken']);
            const bc = new BlobClient(params);
            await assert.rejects(() => bc.putFile('test.txt', Buffer.alloc(0)));
        });
    });

    function getAccessToken(jwt) {
        const agent = superagent.agent();
        return new Promise((resolve, reject) => 
            agent.post(server.getUrl() + '/rest/tokens/create/TestToken')
                .set('Authorization', 'Bearer ' + jwt)
                .end(function (err, res) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res.body);
                })
        );
    }

    function createZip(data, done) {
        var bc = new BlobClient(bcParam);
        bc.putFile('testzip.zip', data, function (err, hash) {
            if (err) {
                done(err);
                return;
            }
            bc.getMetadata(hash, function (err, metadata) {
                if (err) {
                    done(err);
                    return;
                }
                expect(metadata.mime).to.equal('application/zip');
                bc.getObject(hash, function (err, res) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(res instanceof ArrayBuffer || res instanceof Buffer).to.equal(true);
                    var data2 = Array.apply([], new Uint8Array(res));
                    expect(data.length).to.equal(data2.length);
                    for (var i = 0; i < data.length; ++i) {
                        expect(data[i]).to.equal(data2[i]);
                    }
                    done();
                });
            });
        });
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
    function b64ToUint6(nChr) {
        return nChr > 64 && nChr < 91 ?
            nChr - 65
            : nChr > 96 && nChr < 123 ?
                nChr - 71
                : nChr > 47 && nChr < 58 ?
                    nChr + 4
                    : nChr === 43 ?
                        62
                        : nChr === 47 ?
                            63
                            :
                            0;
    }

    function base64DecToArr(sBase64, nBlocksSize) {
        /*jslint bitwise: true */
        var sB64Enc = sBase64.replace(/[^A-Za-z0-9+/]/g, ''),
            nInLen = sB64Enc.length,
            nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2,
            taBytes = new Uint8Array(nOutLen),
            nMod3, nMod4, nUint24, nOutIdx, nInIdx;

        for (nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
            nMod4 = nInIdx & 3;
            nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
            if (nMod4 === 3 || nInLen - nInIdx === 1) {
                for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
                    taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
                }
                nUint24 = 0;

            }
        }
        return typeof global === 'undefined' ? taBytes : Buffer.from(taBytes);
    }

    function str2ab(str) {
        var buf = new ArrayBuffer(str.length),
            bufView = new Uint8Array(buf),
            i, strLen;
        for (i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }

        return typeof global === 'undefined' ? buf : ab2buffer(buf);
    }

    function ab2buffer(ab) {
        var buffer = Buffer.alloc(ab.byteLength);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buffer.length; ++i) {
            buffer[i] = view[i];
        }
        return buffer;
    }
});
