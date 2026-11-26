/*globals requireJS*/
/*eslint-env node*/

/**
 * @author lattmann / https://github.com/lattmann
 */

'use strict';

var fs = require('fs'),
    crypto = require('crypto'),
    GUID = requireJS('common/util/guid'),
    StringStreamReader = require('../../util/StringStreamReader'),
    BlobBackendBase = require('./BlobBackendBase');

// Import S3 client and command classes from AWS SDK v3
const {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsCommand
} = require('@aws-sdk/client-s3');

var BlobS3Backend = function (gmeConfig, logger) {
    BlobBackendBase.call(this, gmeConfig, logger);
    this.awsConfig = gmeConfig.blob.s3;
    // NOTE: development mode
    // install https://github.com/jubos/fake-s3
    // make sure you apply my patch: https://github.com/jubos/fake-s3/issues/53
    // build and install it
    // Alternatively use https://github.com/jamhall/s3rver for nodejs
    // Add to your /etc/hosts (on windows C:\Windows\System32\drivers\etc\hosts and the below are reversed)
    // 127.0.0.1 wg-content.localhost
    // 127.0.0.1 wg-metadata.localhost
    // 127.0.0.1 wg-temp.localhost

    // Build S3 client options respecting v2 config keys where possible
    var s3Options = {
        region: this.awsConfig.region,
        endpoint: this.awsConfig.endpoint,
        forcePathStyle: this.awsConfig.s3ForcePathStyle,
        // v2 maxRetries counts retries only; v3 maxAttempts counts total attempts
        maxAttempts: (typeof this.awsConfig.maxRetries === 'number') ? this.awsConfig.maxRetries + 1 : undefined
    };
    // Remove undefined properties to avoid SDK warnings
    Object.keys(s3Options).forEach(key => s3Options[key] === undefined && delete s3Options[key]);

    this.s3 = new S3Client(s3Options);

    // Uncomment to create buckets at start-up when developing
    // [this.tempBucket, this.contentBucket, this.metadataBucket].forEach( bucket => {
    //     this.s3.send(new CreateBucketCommand({ Bucket: bucket }))
    //         .then(() => console.log('Bucket created'))
    //         .catch(err => console.log(err, err.stack));
    // });
};

// Inherits from BlobManagerBase
BlobS3Backend.prototype = Object.create(BlobBackendBase.prototype);

// Override the constructor with this object's constructor
BlobS3Backend.prototype.constructor = BlobS3Backend;


BlobS3Backend.prototype.putObject = function (readStream, bucket, callback) {
    var self = this,
        tempName = GUID() + '.tbf', // TODO: create this in the system temp folder
        shasum = crypto.createHash(this.shaMethod),
        size = 0;

    var ready = function (body) {
        // Upload temporary object
        self.s3.send(new PutObjectCommand({ Bucket: self.tempBucket, Key: tempName, Body: body }))
            .then(() => {
                var hash = shasum.digest('hex');
                // Copy to final bucket/key
                return self.s3.send(new CopyObjectCommand({
                    CopySource: self.tempBucket + '/' + tempName,
                    Bucket: bucket,
                    Key: hash
                }))
                    .then(() => hash);
            })
            .then(hash => {
                // Delete temporary object
                return self.s3.send(new DeleteObjectCommand({ Bucket: self.tempBucket, Key: tempName }))
                    .then(() => ({ hash: hash }));
            })
            .then(res => {
                callback(null, res.hash, size);
            })
            .catch(callback);
    };

    if (readStream instanceof StringStreamReader) {
        readStream = readStream.toString();
        shasum.update(readStream);
        size += readStream.length;
        ready(readStream);
    } else if (readStream instanceof fs.ReadStream) {
        readStream.on('data', function (chunk) {
            shasum.update(chunk);
            size += chunk.length;
        });
        ready(readStream);
    } else {
        var contentTemp = GUID() + '.tmp';
        var writeStream2 = fs.createWriteStream(contentTemp);

        writeStream2.on('finish', function () {
            var readStream2 = fs.createReadStream(contentTemp);

            readStream2.on('data', function (chunk) {
                shasum.update(chunk);
                size += chunk.length;
            });

            readStream2.on('close', function () {
                fs.unlink(contentTemp);
            });

            ready(readStream2);
        });

        readStream.pipe(writeStream2);
    }
};

BlobS3Backend.prototype.getObject = function (hash, writeStream, bucket, callback) {
    var self = this,
        obj = {
            Bucket: bucket,
            Key: hash
        };

    // Retrieve object and pipe its Body (a readable stream) directly
    self.s3.send(new GetObjectCommand(obj))
        .then(data => {
            data.Body.pipe(writeStream);
            writeStream.on('finish', function () {
                // After writing, retrieve metadata via headObject
                self.s3.send(new HeadObjectCommand(obj))
                    .then(meta => {
                        callback(null, { lastModified: (new Date(meta.LastModified)).toISOString() });
                    })
                    .catch(callback);
            });
        })
        .catch(callback);
};

BlobS3Backend.prototype.listObjects = function (bucket, callback) {
    var self = this;

    // NOTE: this returns only the first 1000 objects (pagination not handled)
    self.s3.send(new ListObjectsCommand({ Bucket: bucket }))
        .then(data => {
            var hashes = [];
            if (data.Contents) {
                for (var i = 0; i < data.Contents.length; i += 1) {
                    hashes.push(data.Contents[i].Key);
                }
            }
            callback(null, hashes);
        })
        .catch(callback);
};

module.exports = BlobS3Backend;
