/* jshint node:true */
/**
 * @author kecso / https://github.com/kecso
 */

'use strict';

var webgme = require('../../webgme'),
    FS = require('fs'),
    path = require('path'),
    Q = require('q'),
    MongoURI = require('mongo-uri'),
    STORAGE_CONSTANTS = webgme.requirejs('common/storage/constants'),
    gmeConfig = require(path.join(process.cwd(), 'config')),
    logger = webgme.Logger.create('gme:bin:import', gmeConfig.bin.log),
    Core = webgme.core,
    AdmZip = require('adm-zip'),
    FSBlobClient = require('../../src/server/middleware/blob/BlobClientWithFSBackend'),
    storageUtils = webgme.requirejs('common/storage/util'),
    blobUtil = webgme.requirejs('blob/util'),
    REGEXP = webgme.requirejs('common/regexp'),
    main;

main = function (argv) {
    var mainDeferred = Q.defer(),
        jsonProject,
        gmeAuth,
        Command = require('commander').Command,
        program = new Command(),
        syntaxFailure = false,
        cliStorage,
        project,
        params,
        commitHash,
        core,
        makeCommitParams = {commitMessage: 'loading project from package'},
        blobClient = new FSBlobClient(gmeConfig, logger.fork('BlobClient')),
        finishUp = function (error) {
            var ended = function () {
                if (error) {
                    mainDeferred.reject(error);
                    return;
                }
                mainDeferred.resolve();
            };

            if (gmeAuth) {
                gmeAuth.unload();
            }
            if (cliStorage) {
                cliStorage.closeDatabase()
                    .then(ended)
                    .catch(function (err) {
                        logger.error(err);
                        ended();
                    });
            } else {
                ended();
            }
        };

    program
        .version('0.0.1')
        .usage('[options]')
        .option('-p, --project-name [string]', 'project name [mandatory]')
        .option('-o, --owner [string]', 'the owner of the project [by default, the user is the owner]')
        .option('-b, --branch [branch]',
            'the branch that should be created with the imported data [by default it is the \'master\']')
        .parse(argv);

    if (!program.projectName) {
        logger.error('project name is a mandatory parameter!');
        syntaxFailure = true;
    }

    if (syntaxFailure) {
        program.outputHelp();
        mainDeferred.reject(new SyntaxError('invalid argument'));
        return mainDeferred.promise;
    }

    program.branch = program.branch || 'master';

    webgme.getGmeAuth(gmeConfig)
        .then(function (gmeAuth__) {
            gmeAuth = gmeAuth__;

            cliStorage = webgme.getStorage(logger.fork('storage'), gmeConfig, gmeAuth);
            return cliStorage.openDatabase();
        })
        .then(function () {
            var params = {
                projectId: ''
            };

            if (program.owner) {
                params.projectId = program.owner + STORAGE_CONSTANTS.PROJECT_ID_SEP + program.projectName;
                params.ownerId = program.owner;
            } else {
                params.projectId = gmeConfig.authentication.guestAccount +
                    STORAGE_CONSTANTS.PROJECT_ID_SEP + program.projectName;
            }
            ;

            return cliStorage.openProject(params);
        })
        .then(function (project_) {
            project = project_;

            return project.getBranches();
        })
        .then(function (_branches) {
            if (!_branches[program.branch]) {
                throw new Error('Cannot find branch [' + program.branch + '].');
            }

            core = new Core(project, {
                globConf: gmeConfig,
                logger: logger.fork('core')
            });

            return Q.nfcall(project.loadObject, _branches[program.branch]);
        })
        .then(function (commitObj) {
            if (commitObj && commitObj.root) {
                return Q.nfcall(core.loadRoot, commitObj.root);
            }

            throw new Error('unable to load latest commit');
        })
        .then(function (root) {
            console.time('traverseTime');
            return Q.nfcall(core.traverse, root, {}, function (node, next) {
                console.log(core.getPath(node));
                console.log(process.memoryUsage());
                setTimeout(function () {
                    next(null);
                }, 10);
            });
        })
        .then(function () {
            console.log('traverse finished');
            console.timeEnd('traverseTime');
            finishUp(null);
        })
        .catch(finishUp);
    return mainDeferred.promise;
};

module.exports = {
    main: main
};

if (require.main === module) {
    main(process.argv)
        .then(function () {
            console.log('Done');
            process.exit(0);
        })
        .catch(function (err) {
            console.error(err);
            process.exit(1);
        });
}
