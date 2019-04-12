[![license](https://img.shields.io/github/license/mashape/apistatus.svg?maxAge=2592000)](https://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/webgme/webgme-engine.svg?branch=master)](https://travis-ci.org/webgme/webgme-engine)
[![Version](https://badge.fury.io/js/webgme-engine.svg)](https://www.npmjs.com/package/webgme-engine)
[![Downloads](http://img.shields.io/npm/dm/webgme-engine.svg?style=flat)](http://img.shields.io/npm/dm/webgme-engine.svg?style=flat)

# webgme-engine
This is the "engine" of the [webgme application](https://github.com/webgme/webgme/) and contains all server code, common-modules and client-api.
If this is your first encounter with webgme the [webgme/webgme](https://github.com/webgme/webgme/) is probably what you're looking for.

The webgme-engine was forked off from webgme/webgme at [version v2.17.0](https://github.com/webgme/webgme/releases/tag/v2.17.0) and since then is released separately from webgme starting off from v2.18.0.

Most documentation in the [webgme/webgme - wiki](https://github.com/webgme/webgme/wiki) is still applicable for this repository (all except the GUI specifics).

[webgme/webgme](https://github.com/webgme/webgme) uses the engine as a dependency and a repository should only depend on
one of these libraries.

## Developers

### Dependencies
 - [NodeJS](https://nodejs.org/) (version >= 4, CI tests are performed on versions 8.x, 10.x and LTS is recommended).
 - [MongoDB](https://www.mongodb.com/) (version >= 2.6).
 - [Git](https://git-scm.com) (must be available in PATH).
 - [Redis](https://redis.io/) needed to run all tests and if serving under multiple nodes.

### Command line interface

All runnable javascript programs are stored in the `src/bin` directory, you should start them with node from the root directory of the repository, e.g. `node src/bin/start_server.js` starts the web server.
Each script supports the `--help` or `-h` command line parameter, which will list all possible parameters.

* `start_server.js`: it starts a web server, which opens a connection to the configured MongoDB.
* `run_plugin.js`: executes a plugin via a direct MongoDB connection.
* `merge.js`: merges two branches if there are no conflicts.
* `usermanager.js`: manages users, organizations, and project authorization (read, write, delete).
* `clean_up.js`: lists/removes projects based on supplied criteria (commits, branches, regex etc.).
* `export.js`: exports a (snapshot of a) branch into a webgmex-file.
* `import.js`: imports a (snapshot of a) branch (from webgmex-file) into a webgme project.
* `addon_handler.js`: starts a server that handles running addons (see `config.addOn.workerUrl`).
* `manage_webhooks.js`: add/update/remove webhooks to and from projects.
* `blob_fs_clean_up.js`: cleans up blobs from the filesystem that are not referenced from any projects.
* `plugin_hook.js`: plugin developer utility for triggering plugin on changes made to a project.
* `storage_stats.js`: outputs statistics about the projects in the database.
* `connected_webhook_handler.js`: webhook example illustrating how to create an authenticated remote connection to the storage (models).


### Repo structure
* `config` - contains the configuration files for webgme.
* `dist` - container for `webgme.classes.build.js` generated at prepublish or postinstall.
* `docs` - 'REST' and 'source' are generated at postinstall.
* `seeds` - contains the project templates including the base seed 'EmptyProject' and some samples.
* `src/addon` - addon related files - all these are currently only executed under nodejs.
* `src/app` - sample application illustrating how to use the `webgme.classes.build.js` from served from `dist`.
The path to the app-dir is configurable via `gmeConfig.client.appDir`.
* `src/bin` - contains the bin-scripts explained above.
* `src/client` - code for the browser/GUI API - a.k.a. the "Client API" (strictly JavaScript and no HTML nor CSS)
* `src/common` - code running under nodejs and/or inside a browser. Under nodejs the code (e.g. core, storage and blob) is typically executed in workers and not in the main server process.
* `src/docs` - source code documentation that isn't inlined in the code itself.
* `src/plugin` - plugin related code such as plugin-managers and the `PluginBase`, also contains a range of sample plugins under 'coreplugins'.
* `src/server` - code strictly running under nodejs. Aside from the `worker` code - the code runs in the main server process.
* `test` - test directory, note that `_globals.js` contains utitlity functions for settings up test-contexts.
* `test-karma` - test directory for tests running inside a browser.
* `test-tmp` - temporary files generate during tests.
* `utils` - postinstall, prebublish and build scripts.
