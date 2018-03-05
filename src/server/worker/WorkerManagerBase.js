/*eslint-env node*/
/**
 * API for server worker manager. See/edit gmeConfig.server.workerManger.path to switch worker manager.
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

/**
 * Base class for server worker manager
 * {object} parameters
 * {GmeConfig} parameters.gmeConfig
 * {GmeLogger} parameters.logger - logger to fork off from.
 * @constructor
 */
function WorkerManagerBase(parameters) {
    this.gmeConfig = parameters.gmeConfig;
    this.logger = parameters.logger.fork('WorkerManager');
}

/**
 * Called once at server start up.
 * @param {function} callback
 */
WorkerManagerBase.prototype.start = function (callback) {
    callback(new Error('WorkerManagerBase.start - Not Implemented!'));
};


/**
 * Called once at server shutdown up.
 * @param {function} callback
 */
WorkerManagerBase.prototype.stop = function (callback) {
    callback(new Error('WorkerManagerBase.stop - Not Implemented!'));
};

/**
 * Requests handler.
 * See simpleworker/workerrequests for parameters based on command.
 * @param {object} parameters
 * @param {CONSTANTS.SERVER_WORKER_REQUESTS} parameters.command - Type of command to be executed.
 * @param {function} callback
 */
WorkerManagerBase.prototype.request = function (parameters, callback) {
    callback(new Error('WorkerManagerBase.request - Not Implemented!'));
};

/**
 * Should return a JSON serializable status object (for siteAdmins).
 * @param {function} callback
 */
WorkerManagerBase.prototype.getStatus = function (callback) {
    callback(null, {
        msg: 'getStatus not implemented for current worker-manager'
    });
};


module.exports = WorkerManagerBase;