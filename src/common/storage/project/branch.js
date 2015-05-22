/*globals define*/
/*jshint browser: true, node:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

define(['common/storage/constants'], function (CONSTANTS) {
    'use strict';

    function Branch(name, mainLogger) {
        var logger = mainLogger.fork('Branch:' + name),
            originHash = '',
            localHash = '',
            commitQueue = [],
            updateQueue = [];

        logger.debug('ctor');
        this.name = name;

        this.updateHandler = null;
        this.commitHandler = null;

        this.localUpdateHandler = null;

        this.getLocalHash = function () {
            return localHash;
        };

        this.getOriginHash = function () {
            return originHash;
        };

        this.updateHashes = function (newLocal, newOrigin) {
            logger.debug('updatingHashes');
            if (newLocal !== null) {
                logger.debug('localHash: old, new', localHash, newLocal);
                localHash = newLocal;
            }
            if (newOrigin !== null) {
                logger.debug('originHash: old, new', originHash, newOrigin);
                originHash = newOrigin;
            }
        };

        this.queueCommit = function (commitData) {
            commitQueue.push(commitData);
            logger.debug('Adding new commit to queue', commitQueue.length);
        };

        this.getFirstCommit = function (shift) {
            var commitData;
            if (shift) {
                commitData = commitQueue.shift();
                logger.debug('Removed commit from queue', commitQueue.length);
            } else {
                commitData = commitQueue[0];
            }

            return commitData;
        };

        this.getCommitQueue = function () {
            return commitQueue;
        };

        this.getCommitsForNewFork = function (commitHash) {
            var i,
                forkHash,
                commitData,
                subQueue = [];
            // Move over all commit-data up till the chosen commitHash to the fork's queue,
            // except the commit that caused the fork (all its objects are already in the database).
            for (i = 0; i < commitQueue.length; i += 1) {
                commitData = commitQueue[i];
                if (i === 0) {
                    forkHash = commitData.commitObject[CONSTANTS.MONGO_ID];
                } else {
                    subQueue.push(commitData);
                }
                if (commitData.commitObject[CONSTANTS.MONGO_ID] === commitHash) {
                    // The commitHash from where to fork has been reached.
                    // If any, the rest of the 'pending' commits will not be used.
                    break;
                }
            }
            return {hash: forkHash, queue: subQueue};
        };

        this.setCommitQueue = function (newQueue) {
            commitQueue = newQueue;
        };

        this.addToUpdateQueue = function (updateData) {
            updateQueue.push(updateData);
            logger.debug('Adding new update to queue', updateQueue.length);
        };

        this.getUpdateQueue = function () {
            return updateQueue;
        };
    }

    return Branch;
});