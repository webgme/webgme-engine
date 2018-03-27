/*globals define*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */


define([
    'q',
    'blob/util',
    'common/util/util',
    'common/storage/util',
    'common/core/coreQ'
], function (Q, blobUtil, commonUtils, storageUtils, Core) {

    /**
     * Functions for serializing a webgme project or models. These will work both on the client and server. <br>
     * To include in your module (e.g. Plugin) require via 'common/util/serialization'.
     * <br>
     * <bold>Important!</bold> In order to export, the state must have been persisted in the database before exporting.
     * If you make changes with the core make sure to persist and make a commit (it could be a headless commit too)
     * before attempting to export.
     * @module serialization
     */
    var exports = {};

    /**
     * Exports a snap-shot of the entire project-tree and uploads a webgmex-file on the blob storage.
     * @param {ProjectInterface} project
     * @param {BlobClient} blobClient
     * @param {object} parameters - One of rootHash, commitHash and branchName and tagName must be given.
     * If more than one is given, the order of precedence is: branchName, commitHash, tagName and rootHash.
     * @param {string} [parameters.rootHash] - The hash of the tree root.
     * @param {string} [parameters.commitHash] - The tree associated with the commitHash.
     * @param {string} [parameters.branchName] - The tree at the given branch.
     * @param {string} [parameters.tagName] - The tree at the given tag.
     * @param {boolean} [parameters.withAssets=false] - Bundle the encountered assets linked from attributes.
     * @param {string} [parameters.kind] - If not given will use the one defined in project (if any).
     * @param {string} [parameters.outName] - Name of the output blob (.webgmex will be appended).
     * @param {function} [callback]
     * @param {Error|null} callback.err - If there was an error
     * @param {object} callback.result - Data about the exported project
     * @param {string} callback.result.hash - Metadata hash to the exported webgmex-file
     * @param {string} callback.result.downloadUrl - Download url of the exported webgmex-file
     * @param {string} callback.result.fileName - The name of the exported webgmex-file
     * @returns {Promise}
     */
    exports.exportProjectToFile = function exportProjectToFile(project, blobClient, parameters, callback) {
        var fileName;

        return storageUtils.getProjectJson(project, {
            branchName: parameters.branchName,
            commitHash: parameters.commitHash,
            rootHash: parameters.rootHash,
            tagName: parameters.tagName,
            kind: parameters.kind
        })
            .then(function (rawJson) {
                fileName = typeof parameters.outName === 'string' ?
                    parameters.outName :
                    rawJson.projectId + '_' + (rawJson.commitHash || '').substr(1, 6);

                fileName += '.webgmex';

                return blobUtil.buildProjectPackage(project.logger.fork('blobUtil'),
                    blobClient,
                    rawJson,
                    parameters.withAssets,
                    fileName);
            })
            .then(function (blobHash) {
                return {
                    hash: blobHash,
                    downloadUrl: blobClient.getRelativeDownloadURL(blobHash),
                    fileName: fileName
                };
            })
            .nodeify(callback);
    };

    /**
     * Exports a selection of models and packages them in webgmexm file which is uploaded to the blob storage.
     * @param {ProjectInterface} project
     * @param {BlobClient} blobClient
     * @param {object} parameters - One of rootHash, commitHash and branchName and tagName must be given.
     * If more than one is given, the order of precedence is: branchName, commitHash, tagName and rootHash.
     * @param {string[]} parameters.paths - Paths to node to export.
     * @param {string} [parameters.rootHash] - The hash of the tree root.
     * @param {string} [parameters.commitHash] - The tree associated with the commitHash.
     * @param {string} [parameters.branchName] - The tree at the given branch.
     * @param {string} [parameters.tagName] - The tree at the given tag.
     * @param {boolean} [parameters.withAssets=false]
     * @param {string} [parameters.outName] - Name of the output blob (.webgmex will be appended).
     * @param {function} [callback]
     * @param {Error|null} callback.err - If there was an error
     * @param {object} callback.result - Data about the exported project
     * @param {string} callback.result.hash - Metadata hash to the exported webgmexm-file
     * @param {string} callback.result.downloadUrl - Download url of the exported webgmexm-file
     * @param {string} callback.result.fileName - The name of the exported webgmexm-file
     * @returns {Promise}
     */
    exports.exportModelsToFile = function exportModelsToFile(project, blobClient, parameters, callback) {
        var core,
            closureInfo,
            fileName;

        return storageUtils.getRootHash(project, parameters)
            .then(function (rootHash) {
                core = new Core(project, {
                    globConf: project.gmeConfig,
                    logger: project.logger
                });

                if (!parameters.paths || parameters.paths instanceof Array === false || parameters.paths.length === 0) {
                    throw new Error('No paths given to export! parameters: ' + JSON.stringify(parameters));
                }

                return core.loadRoot(rootHash);
            })
            .then(function (rootNode) {
                return Q.all(parameters.paths.map(function (path) {
                    return core.loadByPath(rootNode, path);
                }));
            })
            .then(function (nodes) {
                nodes.forEach(function (node, idx) {
                    if (!node) {
                        throw new Error('Given path does not exist [' + parameters.paths[idx] + '].');
                    }
                });

                // All nodes exist - get the closure info from the core.
                closureInfo = core.getClosureInformation(nodes);

                return Q.all(nodes.map(function (node) {
                    return storageUtils.getProjectJson(project, {rootHash: core.getHash(node)});
                }));
            })
            .then(function (rawJsons) {
                var output = {
                        projectId: project.projectId,
                        commitHash: parameters.commitHash,
                        selectionInfo: closureInfo,
                        kind: rawJsons[0].kind,
                        objects: [],
                        hashes: {objects: [], assets: []}
                    },
                    i;

                fileName = typeof parameters.outName === 'string' ?
                    parameters.outName :
                    project.projectId + '_' + (output.commitHash || '').substr(1, 6);

                fileName += '.webgmexm';

                for (i = 0; i < rawJsons.length; i += 1) {
                    commonUtils.extendArrayUnique(output.hashes.objects, rawJsons[i].hashes.objects);
                    commonUtils.extendArrayUnique(output.hashes.assets, rawJsons[i].hashes.assets);
                    commonUtils.extendObjectArrayUnique(
                        output.objects,
                        rawJsons[i].objects,
                        project.ID_NAME
                    );
                }

                return blobUtil.buildProjectPackage(project.logger.fork('blobUtil'),
                    blobClient,
                    output,
                    parameters.withAssets,
                    fileName);
            })
            .then(function (blobHash) {
                return {
                    hash: blobHash,
                    downloadUrl: blobClient.getRelativeDownloadURL(blobHash),
                    fileName: fileName
                };
            })
            .nodeify(callback);
    };

    return exports;
});