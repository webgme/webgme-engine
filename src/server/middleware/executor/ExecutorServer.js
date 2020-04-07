/*globals requireJS*/
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
    Q = require('q'),
    Chance = require('chance'),
    // Mongo collections
    JOB_LIST = '_executorJobList',
    WORKER_LIST = '_executorWorkerList',
    OUTPUT_LIST = '_executorOutput';

const JobInfo = requireJS('common/executor/JobInfo');
const {promisify} = require('util');

/**
 *
 * @param {object} options - middlewareOptions
 * @param {GmeLogger} options.logger - logger to fork off from
 * @param {GmeConfig} options.gmeConfig - gmeConfig
 * @param {function} options.ensureAuthenticated
 * @param {function} options.getUserId
 * @param {AccessTokens} options.accessTokens
 * @constructor
 * @ignore
 */
function ExecutorServer(options) {
    var self = this,
        fs = require('fs'),
        bufferEqual = require('buffer-equal-constant-time'),
        router = express.Router(),
        WorkerInfo = requireJS('common/executor/WorkerInfo'),
        OutputInfo = requireJS('common/executor/OutputInfo'),
        updateLabelsTimeoutId,
        watchLabelsTimeout,
        workerRefreshInterval;

    self.master = null;
    self.getUserId = options.getUserId;
    self.accessTokens = options.accessTokens;
    self.logger = options.logger.fork('middleware:ExecutorServer');
    self.logger.debug('ctor');
    self.gmeConfig = options.gmeConfig;
    self.ensureAuthenticated = promisify(options.ensureAuthenticated);
    self.running = false;

    self.router = router;

    workerRefreshInterval = self.gmeConfig.executor.workerRefreshInterval;

    self.logger.debug('label-jobs config file', self.gmeConfig.labelJobs);
    self.labelJobs = {}; // map from label to blob hash
    self.labelJobsFilename = self.gmeConfig.executor.labelJobs;

    function handleError(err, res) {
        if (err.message === 'Not Found') {
            res.sendStatus(404);
        } else if (err.message === 'Unauthorized') {
            res.sendStatus(403);
        } else {
            self.logger.error(err);
            res.sendStatus(500);
        }
    }

    async function executorAuthenticate(req, res, next) {
        let isAuth = true;

        await self.accessTokens.setUserFromToken(req, res);
        self.ensureHasUserId(req);
        const needsUser = !self.gmeConfig.executor.authentication.allowGuests;
        if (needsUser && self.isGuestUserId(req)) {
            try {
                await self.ensureAuthenticated(req, res);
            } catch (err) {
                return res.send('Unauthorized');
            }
            if (self.isGuestUserId(req)) {
                return res.sendStatus(403);
            }
        }

        if (self.gmeConfig.executor.nonce) {
            const workerNonce = req.headers['x-executor-nonce'];
            if (workerNonce) {
                isAuth = bufferEqual(Buffer.from(workerNonce), Buffer.from(self.gmeConfig.executor.nonce));
            } else {
                isAuth = false;
            }
        }

        if (isAuth) {
            next();
        } else {
            res.sendStatus(403);
        }
    }

    function updateLabelJobs() {
        fs.readFile(self.labelJobsFilename, {encoding: 'utf-8'}, function (err, data) {
            self.logger.debug('Reading ' + self.labelJobsFilename);
            self.labelJobs = JSON.parse(data);
        });
    }

    function watchLabelJobs() {
        fs.exists(self.labelJobsFilename, function (exists) {
            if (exists) {
                updateLabelJobs();
                fs.watch(self.labelJobsFilename, {persistent: false}, function () {
                    updateLabelsTimeoutId = setTimeout(updateLabelJobs, 200);
                });
            } else {
                watchLabelsTimeout = setTimeout(watchLabelJobs, 10 * 1000);
            }
        });
    }

    // ensure authenticated can be used only after this rule
    router.use('*', function (req, res, next) {
        // TODO: set all headers, check rate limit, etc.
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // all endpoints require authentication
    router.use('*', executorAuthenticate);
    router.use('/output/:hash', async function (req, res, next) {
        const {hash} = req.params;
        const userId = self.getUserId(req);
        if (await self.master.canUserAccessJob(userId, hash)) {
            return next();
        }
        return res.sendStatus(403);
    });

    router.get('/', async function (req, res/*, next*/) {
        const userId = self.getUserId(req);
        if (req.query.status) {
            self.logger.debug('get by status:', req.query.status);
        }
        const list = await self.master.getJobList(userId, req.query.status);
        res.send(list);
    });

    router.get('/info/:hash', async function (req, res/*, next*/) {
        try {
            const userId = self.getUserId(req);
            const jobInfo = await self.master.getJobInfo(userId, req.params.hash);
            if (jobInfo) {
                res.send(jobInfo);
            } else {
                res.sendStatus(404);
            }
        } catch (err) {
            handleError(err, res);
        }
    });

    router.post('/create/:hash', async function (req, res/*, next*/) {
        const userId = self.getUserId(req);
        const info = req.body;
        info.hash = req.params.hash;
        try {
            const jobInfo = await self.master.createJob(userId, info);
            res.send(jobInfo);
        } catch (err) {
            handleError(err, res);
        }
    });

    router.post('/update/:hash', async function (req, res/*, next*/) {
        try {
            const userId = self.getUserId(req);
            const info = req.body;
            info.hash = req.params.hash;
            await self.master.updateJob(userId, info);
            res.sendStatus(200);
        } catch (err) {
            handleError(err, res);
        }
    });

    router.post('/cancel/:hash', async function (req, res/*, next*/) {
        try {
            const userId = self.getUserId(req);
            const hash = req.params.hash;
            await self.master.cancelJob(userId, hash, req.body.secret);
            res.sendStatus(200);
        } catch (err) {
            handleError(err, res);
        }
    });

    router.get('/output/:hash', async function (req, res/*, next*/) {
        try {
            const userId = self.getUserId(req);
            const hash = req.params.hash;
            const {start, end} = req.query;
            const docs = await self.master.getJobOutput(
                userId,
                hash,
                parseInt(start, 10),
                parseInt(end, 10)
            );
            res.send(docs);
        } catch (err) {
            handleError(err, res);
        }
    });

    router.post('/output/:hash', async function (req, res/*, next*/) {
        try {
            const {hash} = req.params;
            const userId = self.getUserId(req);
            const output = new OutputInfo(hash, req.body);
            self.logger.debug('output posted', output._id);
            const matchedCount = await self.master.updateJobOutput(userId, hash, output);
            if (matchedCount === 0) {
                self.logger.warn('posted output to job that did not exist');
                res.sendStatus(404);
            } else {
                res.sendStatus(200);
            }
        } catch (err) {
            handleError(err, res);
        }
    });

    // worker API
    router.get('/worker', async function (req, res/*, next*/) {
        const userId = self.getUserId(req);
        const dict = await self.master.getWorkerDict(userId);
        res.json(dict);
    });

    router.post('/worker', async function (req, res/*, next*/) {
        var clientRequest = new WorkerInfo.ClientRequest(req.body),
            serverResponse = new WorkerInfo.ServerResponse({refreshPeriod: workerRefreshInterval});

        serverResponse.labelJobs = self.labelJobs;

        try {
            const userId = self.getUserId(req);
            await self.master.updateWorker(userId, clientRequest.clientId, clientRequest.labels);
            if (!self.running) {
                self.logger.debug('ExecutorServer had been stopped.');
                return res.sendStatus(404);
            } else if (clientRequest.availableProcesses) {
                serverResponse.jobsToStart = await self.master.startQueuedJobs(
                    userId,
                    clientRequest.clientId,
                    clientRequest.labels,
                    clientRequest.availableProcesses
                );
            }

            try {
                const hashes = clientRequest.runningJobs;
                serverResponse.jobsToCancel = await self.master.getCanceledJobs(hashes);
            } catch (err) {
                self.logger.error(err);
            }
            res.json(serverResponse);
        } catch (err) {
            handleError(err, res);
        }
    });

    /**
     *
     * @param {object} params
     * @param {object} mongoClient - open connection to mongodb
     * @param callback
     * @returns {*}
     */
    this.start = async function (params, callback) {
        var mongo = params.mongoClient;
        self.logger.debug('Starting executor');

        return Q.all([
            mongo.collection(JOB_LIST),
            mongo.collection(WORKER_LIST),
            mongo.collection(OUTPUT_LIST)
        ])
            .then(async function (res) {
                if (self.gmeConfig.executor.clearOldDataAtStartUp === true) {
                    await Q.allSettled([
                        mongo.dropCollection(JOB_LIST),
                        mongo.dropCollection(WORKER_LIST),
                        mongo.dropCollection(OUTPUT_LIST)
                    ]);
                }
                self.master = new ExecutorMaster(self.gmeConfig, self.logger, ...res);
            })
            .then(function () {
                watchLabelJobs();
                self.running = true;
            })
            .nodeify(callback);
    };

    /**
     * Clears the opened intervals and timeouts.
     * This does not close the connection to mongo.
     */
    this.stop = function () {
        self.master.stop();
        self.master = null;
        clearTimeout(updateLabelsTimeoutId);
        clearTimeout(watchLabelsTimeout);
        self.running = false;
        self.logger.debug('Executor was stopped');
    };
}

ExecutorServer.prototype.ensureHasUserId = function (req) {
    const {guestAccount} = this.gmeConfig.authentication;
    if (!req.userData) {
        req.userData = {userId: guestAccount};
    }
};

ExecutorServer.prototype.isGuestUserId = function (req) {
    const {guestAccount} = this.gmeConfig.authentication;
    return this.getUserId(req) === guestAccount;
};

function ExecutorMaster(gmeConfig, logger, jobList, workerList, outputList) {
    this.gmeConfig = gmeConfig;
    this.logger = logger.fork('master');
    this.chance = new Chance();
    this.jobList = jobList;
    this.workerList = workerList;
    this.outputList = outputList;
    this.jobList.createIndex({hash: 1}, {unique: true});
    this.workerList.createIndex({clientId: 1}, {unique: true});
    this.clearOutputsTimers = {
        // <jobHash>: {
        //   timeoutObj: <timeoutObject>
        //   jobInfo: <JobInfo>
        // }
    };
    this.running = true;
    this.workerRefreshInterval = gmeConfig.executor.workerRefreshInterval;
    this.workerTimeoutIntervalId = setInterval(this.workerTimeout.bind(this), 10 * 1000);
}

ExecutorMaster.prototype.addUserToQuery = function (userId, query) {
    if (this.gmeConfig.executor.authentication.enable) {
        query.userId = {$in: [userId]};
    }
    return query;
};

ExecutorMaster.prototype.getJobQuery = function (userId, hash) {
    const query = {hash: hash};
    this.addUserToQuery(userId, query);
    return query;
};

ExecutorMaster.prototype.canUserAccessJob = async function (userId, hash) {
    if (this.gmeConfig.executor.authentication.enable) {
        const query = {hash};
        const doc = await this.jobList.findOne(query);
        return doc.userId.includes(userId);
    }
    return true;
};

ExecutorMaster.prototype.getJobList = async function (userId, status) {
    const query = {};
    if (status) {
        query.status = status;
    }

    this.addUserToQuery(userId, query);
    const docs = await this.jobList.find(query, {_id: 0, secret: 0}).toArray();
    const jobList = {};
    for (var i = 0; i < docs.length; i += 1) {
        jobList[docs[i].hash] = docs[i];
    }
    this.logger.debug('Found number of jobs matching status', docs.length, query.status);

    return jobList;
};

ExecutorMaster.prototype.getJobInfo = function (userId, hash) {
    const query = this.getJobQuery(userId, hash);
    return this.jobList.findOne(query, {_id: 0, secret: 0});
};

ExecutorMaster.prototype.createJob = async function (userId, info) {
    info.createTime = new Date().toISOString();
    info.status = info.status || 'CREATED'; // TODO: define a constant for this
    info.userId = [userId];

    const jobInfo = new JobInfo(info);
    jobInfo.secret = this.chance.guid();

    this.logger.debug('job creation info:', {metadata: info});
    const doc = await this.jobList.findOne({hash: info.hash}, {_id: 0, secret: 0});
    if (!doc) {
        await this.jobList.insertOne(jobInfo);
        delete jobInfo._id;
        return jobInfo;
    } else if (doc.status === 'CANCELED') {
        const newInfo = await this.restartCanceledJob(doc, jobInfo);
        return newInfo;
    } else {
        return doc;
    }
};

ExecutorMaster.prototype.restartCanceledJob = async function (oldJobInfo, newInfo) {
    if (this.clearOutputsTimers[oldJobInfo.hash] || oldJobInfo.outputNumber !== null) {
        delete this.clearOutputsTimers[oldJobInfo.hash];

        await this.clearOutput(oldJobInfo);
    }
    await this.jobList.updateOne({hash: oldJobInfo.hash}, newInfo, {upsert: true});
    return newInfo;
};

ExecutorMaster.prototype.updateJob = async function (userId, info) {
    const query = this.getJobQuery(userId, info.hash);
    const doc = await this.jobList.findOne(query);
    if (doc) {
        const jobInfo = new JobInfo(doc);
        const jobInfoUpdate = new JobInfo(info);
        for (var i in jobInfoUpdate) {
            if (jobInfoUpdate[i] !== null && (!(jobInfoUpdate[i] instanceof Array) ||
                jobInfoUpdate[i].length !== 0)) {

                jobInfo[i] = jobInfoUpdate[i];
            }
        }

        jobInfo.secret = doc.secret;
        const result = await this.jobList.updateOne(query, jobInfo);
        if (result.matchedCount === 0) {
            throw new Error('Not Found');
        } else {
            if (JobInfo.isFinishedStatus(jobInfo.status)) {
                if (jobInfo.outputNumber !== null && this.gmeConfig.executor.clearOutputTimeout > -1) {
                    // The job has finished and there is stored output - set timeout to clear it.
                    this.startClearOutputTimer(jobInfo);
                }
            }
        }
    } else {
        throw new Error('Not Found');
    }
};

ExecutorMaster.prototype.startClearOutputTimer = async function (jobInfo) {
    var self = this,
        timeoutObj;

    timeoutObj = setTimeout(function () {

        delete self.clearOutputsTimers[jobInfo.hash];
        self.clearOutput(jobInfo);

    }, this.gmeConfig.executor.clearOutputTimeout);

    this.clearOutputsTimers[jobInfo.hash] = {
        jobInfo: jobInfo,
        timeoutObj: timeoutObj
    };

    this.logger.debug('Timeout', this.gmeConfig.executor.clearOutputTimeout,
        '[ms] to clear output for job set (id)', jobInfo.hash);
};

ExecutorMaster.prototype.cancelJob = async function (userId, hash, secret) {
    const query = this.getJobQuery(userId, hash);
    const doc = await this.jobList.findOne(query);
    if (doc) {
        if (secret !== doc.secret) {
            throw new Error('Unauthorized');
        } else if (JobInfo.isFinishedStatus(doc.status) === false) {
            // Only bother to update the cancelRequested if job hasn't finished.
            await this.jobList.updateOne(query, {
                $set: {
                    cancelRequested: true
                }
            });
        }
    } else {
        throw new Error('Not Found');
    }
};

ExecutorMaster.prototype.getJobOutput = async function (userId, hash, start, end) {
    const query = {hash};

    if (start || end) {
        query.outputNumber = {};
        if (start) {
            query.outputNumber.$gte = start;
        }

        if (end) {
            query.outputNumber.$lt = end;
        }
    }

    this.logger.debug('output requested', query);
    const docs = await this.outputList.find(query)
        .sort({outputNumber: 1})
        .toArray();

    this.logger.debug('got outputs, nbr', docs.length);
    if (docs.length > 0) {
        return docs;
    } else {
        // No output found, could it be that job does not even exist?
        const query = {hash};
        this.addUserToQuery(userId, query);
        const jobInfo = await this.jobList.findOne(query);
        if (jobInfo) {
            return docs;
        } else {
            throw new Error('Not Found');
        }
    }
};

ExecutorMaster.prototype.updateJobOutput = async function (userId, hash, outputInfo) {
    await this.outputList.updateOne({_id: outputInfo._id}, outputInfo, {upsert: true});
    const query = {hash};
    this.addUserToQuery(userId, query);
    const result = await this.jobList.updateOne(query, {
        $set: {
            outputNumber: outputInfo.outputNumber
        }
    });
    return result.matchedCount;
};

ExecutorMaster.prototype.getWorkerDict = async function (userId) {
    const dict = {};
    const workers = await this.workerList.find({userId: {$in: [userId]}}, {_id: 0}).toArray();
    for (let i = 0; i < workers.length; i++) {
        const worker = workers[i];
        const jobs = await this.jobList.find({
            status: 'RUNNING',
            worker: worker.clientId
        }, {_id: 0, secret: 0}).sort({createTime: 1}).toArray();
        dict[worker.clientId] = worker;
        dict[worker.clientId].jobs = jobs;
    }

    return dict;
};

ExecutorMaster.prototype.updateWorker = async function (userId, clientId, labels = []) {
    const query = {clientId};
    await this.workerList.updateOne(query, {
        $set: {
            lastSeen: (new Date()).getTime() / 1000,
            labels: labels,
            userId: [userId],
        }
    }, {upsert: true});
};

ExecutorMaster.prototype.startQueuedJobs = async function (userId, clientId, labels = [], count = 10) {
    const startedHashes = [];
    const docs = await this.jobList.find({
        status: 'CREATED',
        userId: {$in: [userId]},
        labels: {
            $not: {
                $elemMatch: {
                    $nin: labels
                }
            }
        }
    }).limit(count).toArray();

    for (let i = 0; i < docs.length; i++) {
        const numReplaced = await this.jobList.updateOne({_id: docs[i]._id, status: 'CREATED'}, {
            $set: {
                status: 'RUNNING',
                worker: clientId
            }
        });
        if (numReplaced) {
            startedHashes.push(docs[i].hash);
        }
    }

    return startedHashes;
};

ExecutorMaster.prototype.getCanceledJobs = async function (hashes) {
    const query = {
        hash: {
            $in: hashes
        },
        cancelRequested: true
    };
    const docs = await this.jobList.find(query).toArray();
    return docs.map(jobInfo => jobInfo.hash);
};

ExecutorMaster.prototype.clearOutput = async function (jobInfo) {
    let query = {
        $set: {
            outputNumber: null
        }
    };

    if (this.running === true) {
        try {
            await this.jobList.updateOne({hash: jobInfo.hash}, query);
        } catch (err) {
            this.logger.error('Error clearing outputNumber in job', err);
            throw err;
        }
        if (this.running === false) {
            this.logger.error('Cleared job\'s outputNumber, but was shutdown before actual output was removed.',
                jobInfo.hash);
            return;
        }

        query = {
            _id: {
                $regex: '^' + jobInfo.hash
            }
        };

        try {
            const res = await this.outputList.deleteMany(query);
            if (res.deletedCount !== jobInfo.outputNumber + 1) {
                this.logger.warn('Did not remove all output for job', res.deletedCount,
                    {metadata: jobInfo});
            }

            this.logger.debug('Cleared output for job', res.deletedCount, jobInfo.hash);
        } catch (err) {
            this.logger.error('Failed to remove output for job', err);
            throw err;
        }
    }
};

ExecutorMaster.prototype.stop = function () {
    const self = this;
    const timerIds = Object.keys(this.clearOutputsTimers);
    timerIds.forEach(function (timerId) {
        clearTimeout(self.clearOutputsTimers[timerId].timeoutObj);
        self.logger.warn('Outputs will not be cleared for job', timerId,
            self.clearOutputsTimers[timerId].jobInfo.outputNumber);
    });
    this.running = false;
    clearInterval(this.workerTimeoutIntervalId);
};

ExecutorMaster.prototype.workerTimeout = async function () {
    const self = this;
    if (process.uptime() < this.workerRefreshInterval / 1000 * 5) {
        return;
    }

    const query = {
        lastSeen: {
            $lt: Date.now() / 1000 - this.workerRefreshInterval / 1000 * 5
        }
    };

    function logError(err) {
        if (err) {
            self.logger.error(err);
        }
    }

    const docs = await this.workerList.find(query).toArray();
    if (!this.running) {
        this.logger.debug('ExecutorMaster had been stopped.');
        return;
    }

    for (let i = 0; i < docs.length; i += 1) {
        // reset unfinished jobs assigned to worker to CREATED, so they'll be executed by someone else
        this.logger.debug('worker "' + docs[i].clientId + '" is gone');

        this.workerList.deleteOne({_id: docs[i]._id}, logError);
        this.jobList.updateMany({worker: docs[i].clientId, status: {$nin: JobInfo.finishedStatuses}}, {
            $set: {
                worker: null,
                status: 'CREATED',
                startTime: null
            }
        }, logError);
    }
};

module.exports = ExecutorServer;
