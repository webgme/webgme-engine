# Webgme-Engine
This is the "engine" of the webgme app containing all server code, common-modules and client-api. 
The webgme-engine was forked off from webgme/webgme at [version v2.17.0](https://github.com/webgme/webgme/releases/tag/v2.17.0) and since then is released separately from webgme starting off from v2.18.0 (note that all previous webgme code and tags still exist in this repo).

Most documentation in the [webgme/webgme - wiki](https://github.com/webgme/webgme/wiki) is still applicable for this repository (all except the GUI specifics).

# Command line interface

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