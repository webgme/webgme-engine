Configuration
=============

The easiest way to set your custom configuration is to include the default configuration and overwrite/appended to the default fields.

```
- ---------------------
./config/config.mine.js
- ---------------------

var config = require('webgme-engine/config/config.default');

config.addOns.enable = true;
config.addOns.basePaths.push('C:/addons');

module.exports = config;
```

## Which configuration file is being used?
To use any other configuration than the default you need to set the environment variable `NODE_ENV`. When the server starts the configuration file at `config/config.%NODE_ENV%.js` will be loaded. If `NODE_ENV` is not set it falls back to loading `config/config.default.js`.

To start the server using the configuration above,

windows

`set NODE_ENV=mine && npm start`

ubuntu

`NODE_ENV=mine npm start`

## Setting parameters via WEBGME_* env vars
Since [v2.22.2](https://github.com/webgme/webgme-engine/blob/master/CHANGELOG.md#v2222-2018-12-11) individual configuration parameters can be set using environment variables.

Important! - before attempting to set any of these make sure the `config/index.js` in your repository requires and calls `overrideFromEnv(config)` (was not generated in `webgme-cli < 2.8.2`). If not you can copy the content of this [index.js](https://github.com/webgme/bindings/blob/master/config/index.js) and override your file.

To set a configuration variable `config.<configGroup>.<configSubGroup1>.<configSubGroup2>.<cfgName>=<value>` defined the env var `WEBGME_<configGroup>_<configSubGroup1>_<configSubGroup2>_<cfgName>=<value>`. For example:

- `config.server.port=8888` -> `WEBGME_server_port=8888`
- `config.seedProjects.defaultProject='myProject'` -> `WEBGME_seedProjects_defaultProject=myProject`
- `config.authentication.allowGuests=false` -> `WEBGME_authentication_allowGuests=false`

Modification of arrays is not support, but non-existing config sub-group (objects) are created. For more details see #144.

## Configuration groups

##### addOn

- `config.addOn.enable = false`
 - If true enables add-ons.
- `config.addOn.workerUrl = null`
 - If given the webgme server will not spawn a child process for running add-ons and instead post the related events to the url. Use [addon_handler.js](../src/bin/addon_handler.js) for a machine handling such requests.
- `config.addOn.monitorTimeout = 120000`
 - In milliseconds, the waiting time before add-ons are stopped after no activity (new clients joined or hash updates) in the branch.
- `config.addOn.basePaths = ['./src/addon/core']`
 - Note, this is handled by [webgme-cli](https://github.com/webgme/webgme-cli). Array of paths to custom add-ons. If you have an add-on at `C:/SomeAddOns/MyAddOn/MyAddOn.js` the path to append would be `C:/SomeAddOns` or a relative path (from the current working directory). N.B. this will also expose any other add-on in that directory, e.g. `C:/SomeAddOns/MyOtherAddOn/MyOtherAddOn.js`.

##### authentication

- `config.authentication.enable = false`
 - If true certain parts will require that users are authenticated.
- `config.authentication.allowGuests = true`
 - Generate a guest account for non-authenticated connections.
- `config.authentication.guestAccount = 'guest'`
 - User account which non-authenticated connections will access the storage.
- `config.authentication.adminAccount = null`
 - If specified, will create an admin account at the given username at server startup. By default a random password will be generated and logged in the terminal - to specify a password separate it with a `:`, e.g. `'admin:password'`. (Once the admin exists the password will not be updated at startup.)
- `config.authentication.allowUserRegistration = true`
 - Allows user-creation via the REST api without being an authenticated site admin. Provide a path to a module if you want to add your own custom registration path (see [default register end-point](https://github.com/webgme/webgme/blob/master/src/server/api/defaultRegisterEndPoint.js) for structure).
- `config.authentication.registeredUsersCanCreate = true`
 - Use this option if user registration is set to `true` and you want to control if registered users should be able to create projects directly after registered (site-admins can edit the `canCreate` property post-hoc for existing users).
- `config.authentication.inferredUsersCanCreate = false`
 - Users authenticated by externally generated tokens are automatically put in the database at their first login. By default these users cannot create new projects unless this option is set to `true`.
- `config.authentication.logInUrl = '/profile/login'`
 - Where clients are redirected if not authenticated.
- `config.authentication.logOutUrl = '/profile/login'`
 - Where clients are redirected after logout. Leave this empty to logout to the referrer (if none it will fall back on `config.authentication.logInUrl`).
- `config.authentication.userManagementPage = 'webgme-user-management-page'`
 - Replaceable user-management page to use (use this if you have a fork of [webgme-user-management-page](https://github.com/webgme/user-management-page)).
 Given router will be mounted at `/profile`.
- `config.authentication.salts = 10`
 - Strength of the salting of the users' passwords [bcrypt](https://github.com/dcodeIO/bcrypt.js).
- `config.authentication.authorizer.path = './src/server/middleware/auth/defaultauthorizer'`
 - Path (absolute) to module implementing `AuthorizerBase` (located next to `deafultauthorizer`) for getting and setting authorization regarding projects and project creation.
- `config.authentication.authorizer.options = {}`
 - Optional options passed to authorizer module at initialization (via gmeConfig).
- `config.authentication.jwt.cookieId = 'access_token'`
 - Id of token used when placed inside of a cookie.
- `config.authentication.jwt.expiresIn = 3600 * 24 * 7`
 - Lifetime of tokens in seconds.
- `config.authentication.jwt.renewBeforeExpires = 3600`
 - Interval in seconds, if there is less time until expiration the token will be automatically renewed. (Set this to less or equal to 0 to disabled automatic renewal.)
- `config.authentication.jwt.privateKey = './src/server/middleware/auth/EXAMPLE_PRIVATE_KEY'`
 - Private RSA256 key used when generating tokens (N.B. if authentication is turned on - the defaults must be changed and the keys must reside outside of the app's root-directory or alt. a rule should be added to `config.server.extlibExcludes`).
- `config.authentication.jwt.publicKey = './src/server/middleware/auth/EXAMPLE_PRIVATE_KEY'`
 - Public RSA256 key used when evaluating tokens.
- `config.authentication.jwt.algorithm = 'RS256'`
 - The algorithm used for encryption (should not be edited w/o changing keys appropriately).
- `config.authentication.jwt.tokenGenerator = './src/server/middleware/auth/localtokengenerator.js'`
 - Replaceable module for generating tokens in case webgme should not generated new tokens by itself.
- `config.authentication.encryption.algorithm = aes-256-cbc`
 - The type of algorithm used for data encryption. To get an idea of what algorithms you can use, check the [nodejs](https://nodejs.org/dist/latest-v12.x/docs/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv_options) descriptions as well as [openSSL](https://www.openssl.org/docs/man1.0.2/man1/ciphers.html).
- `config.authentication.encryption.key` = './src/server/middleware/auth/EXAMPLE_ENCRYPTION_KEY'`
 - Key file used for data cipher.
- `config.authentication.allowPasswordReset = false`
 - Allows password reset functionality (option to change password without successful login). For maximum security check [mailer](#mailer) options.
- `config.authentication.allowedResetInterval = 3600000`
 - The frequency in milliseconds of the allowed reset requests.
- `config.authentication.resetTimeout = 1200000`
 - The maximum interval of validity of the reset. This means that the password has to be changed within this interval (otherwise the user has to wait until a new request can be made).
- `config.authentication.resetUrl = '/profile/reset'`
 - Location of the reset page where the user should be guided to input the new password. The whole reset procedure can be done with purely REST API calls, but it is usually safer to include an email in the process.

##### api

- `config.api.useEnhancedStarterPage = false`
 - When set to true, the index page will be returned as a fully featured HTML instead of the plain JSON response.

##### bin

- `config.bin.log = see config`
 - Logger settings when running bin scripts.

##### blob
- `config.blob.compressionLevel = 0`
 - Compression level of DEFLATE (between 0 and 9) to use when serving bundled complex artifacts.
- `config.blob.type = 'FS'`
 - Type of storage, available options: `'FS'` (File System), `'S3'` (Simple Storage Service).
- `config.blob.fsDir = './blob-local-storage'`
 - Directory where to store the blob files in case of `'FS'`.
- `config.blob.namespace = ''`
 - If defined and not empty the blob buckets will be put under the given namespace.
- `config.blob.s3 = {}`
 - S3 configuration passed to `aws-sdk` module. See config.default.js for local mock example.

##### client

- `config.client.appDir = './src/client'`
 - Directory from where to serve the static files for the webapp.
- `config.client.appVersion = '1.0.0'`
 - Version of the app, for instance the [generic-ui](https://github.com/webgme/webgme) sets this to load the correct distribution files.
- `config.client.faviconPath = 'img/favicon.ico'`
 - Path to favicon (e.g. put an ico file in your app's root dir and set this to `/extlib/favicon.ico`).
- `config.client.pageTitle = null`
 - Custom title for app, if not given the default title will be the name/id of the open project (or WebGME).
- `config.client.log.level = 'debug'`
 - When [debug](https://github.com/visionmedia/debug) is activated in the browser messages below this level will not be printed.

##### core

- `config.core.enableCustomConstraints = false`
 - If true will enable validation (which takes place on the server) of custom constraints defined in the meta nodes.

##### debug

- `config.debug = false`
 - If true will add extra debug messages.

##### documentEditing

- `config.documentEditing.enable = true`
 - Set to false to disable channels for document editing.
- `config.documentEditing.disconnectTimeout = 20000`
 - In milliseconds, the amount of time to keep a document channel with only disconnected users open.

##### executor

- `config.executor.enable = false`
 - If true will enable the executor.
- `config.executor.authentication.enable = false`
 - If true will enable authentication for the executors allowing them to be associated with a given user. Executors will only be able to view jobs from the given owner (or guest). Workers are associated with a user by providing a user's personal access token in the worker's config.
- `config.executor.authentication.allowGuests = true`
 - If true will require jobs and workers to be associated with an existing user.
- `config.executor.nonce = null`
 - If defined this is the secret shared between the server and attached workers.
- `config.executor.workerRefreshInterval = 5000`
 - Time interval in milliseconds that attached workers will request jobs from the server.
- `config.executor.clearOutputTimeout = 60000`
 - Time in milliseconds that output is stored after a job has finished.
- `config.executor.clearOldDataAtStartUp = false`
 - If true, all data stored for jobs (jobInfos, outputs, workerInfos, etc.) is cleared when the server starts.
- `config.executor.labelJobs = './labelJobs.json'`
 - Path to configuration file for label jobs for the workers.

##### mailer
- `config.mailer.enable = false`
 - Switch to turn on the mail sending services of WebGME. To see what this service can do, please check the [mailer readme](https://github.com/webgme/webgme-engine/blob/master/src/server/middleware/mailer/README.md).
- `config.mailer.service = ''`
 - Allows for shorthand configuraiton of SMTP servers for known services like gmail. For furhter details on what can be configured, please check [nodemailer](https://nodemailer.com/about/).
- `config.mailer.host = ''`
 - The IP address of the SMTP server that should be used by WebGME to send e-mails.
- `config.mailer.port = 587`
 - The port of the SMTP server.
- `config.mailer.secure = false`
 - If true, the connection between WebGME and the SMTP server will be secured.
- `config.mailer.user = 'none'`
 - The username of the account that should be used to access the SMTP server.
- `config.mailer.pwd = 'none'`
 - The password of the account that should be used to access the SMTP server. This information as well as all other sensitive SMTP server configuration cannot be accesssed from the client side.
- `config.mailer.sendPasswordReset = false`
 - If used, the reset request on the REST API will send an e-mail to the user and not respond with the resetHash.

##### mongo
- `config.mongo.uri = 'mongodb://127.0.0.1:27017/multi'`
 - MongoDB connection [uri](http://docs.mongodb.org/manual/reference/connection-string/)
- `config.mongo.options = see config`
 - Options for [MongoClient.connect](https://mongodb.github.io/node-mongodb-native/api-generated/mongoclient.html#connect)

##### plugin
- `config.plugin.allowBrowserExecution = true`
 - If true will enable execution of plugins in the browser.
- `config.plugin.allowServerExecution = false`
 - If true will enable execution of plugins on the server.
- `config.plugin.basePaths = ['./src/plugin/coreplugins']`
 - Note, this is handled by [webgme-cli](https://github.com/webgme/webgme-cli).
- `config.plugin.displayAll = false`
 - If true there is no need to register plugins on the root-node of project - all will be available from the drop-down.
- `config.plugin.serverResultTimeout = 60000`
 - Time, in milliseconds, results will be stored on the server after they have finished (when invoked via the REST api).


##### requirejsPaths
- `config.requirejsPaths = {}`
 - Custom paths that will be added to the `paths` of [requirejs configuration](http://requirejs.org/docs/api.html#config).
 Paths added here will also be served under the given key, i.e. `{myPath: './aPath/aSubPath/'}` will expose files via `<host>/myPath/someFile.js`.


##### rest
- `config.rest.components = {}`
 - Collection of external rest routes index by their (unique) ids. The value is an object with keys; `src` file-path (or name)
 to the module defining the router, `mount` where the router will be mounted relative the <host>, `options` an object with setting for the specific router.
 Use the `RestRouterGenerator` plugin to generate a template router (see the generated file for more info).

##### seedProjects
- `config.seedProjects.enable = true`
 - Enables creation of new projects using seeds.
- `config.seedProjects.allowDuplication = true`
 - Enables duplication of entire project with full history (requires at least mongodb 2.6).
- `config.seedProjects.defaultProject = 'EmptyProject'`
 - Used by the GUI when highlighting/selecting the default project to seed from.
- `config.seedProjects.basePaths = ['./seeds']`
 - List of directories where project seeds are stored.
- `config.seedProjects.createAtStartup= []`
 - Array of descriptions of projects to be created at server start up. The descriptions have the following form:
```
{
  seedId: 'EmptyProject',
  projectName: 'StartProject',
  creatorId: 'siteAdminOrAnAdminInOwnerOrg', // If not given the creator will be the auth.admin
  ownerId: 'MyPublicOrg' // If not given will be the creator
  rights: {
    MyPublicOrg: { read: true, write: false, delete: false }, // The owner will have full access by default
    guest: { read: true }
  }
}
```

##### server
- `config.server.port = 8888`
 - Port the server is hosted from.
- `config.server.handle = null`
 - Optional handle object passed to [server.listen](https://nodejs.org/api/http.html#http_server_listen_handle_callback) (aligning port must still be given).
- `config.server.timeout = -1`
 - If greater than -1 will set the [timeout property of the http-server](https://nodejs.org/api/http.html#http_server_timeout). (This can be used to enable large, > 1Gb, file uploads.)
- `config.server.maxWorkers = 10`
 - Maximum number of child processes spawned by the default worker manager.
- `config.server.workerManager.path = 'src/server/worker/serverworkermanager'`
 - Path to module (implementing `src/server/worker/WorkerManagerBase`) handling worker requests.
- `config.server.workerManager.options = {}`
 - Options for non-default workerManager (valid fields depend on type of worker-manager).
- `config.server.log = see config`
 - Transports and options for the server (winston) logger.
- `config.server.extlibExcludes = ['.\.pem$', 'config\/config\..*\.js$']`
 - Array of regular expressions that will hinder access to files via the '/extlib/' route. Requests to files matching any of the provided pattern will result in 403.
- `config.server.behindSecureProxy = false`
 - Indicate if the webgme server is behind a secure proxy (needed for adding correct OG Metadata in index.html).

##### socketIO
- `config.socketIO.clientOptions = see config`
 - Options passed to the [socketIO client](https://github.com/socketio/socket.io-client#managerurlstring-optsobject) when connecting to the sever.
- `config.socketIO.serverOptions = see config`
 - Options passed to the [socketIO server](https://github.com/socketio/engine.io#methods-1) when attaching to the server.

##### storage
- `config.storage.cache = 2000`
 - Number of core-objects stored before emptying cache (server side).
- `config.storage.clientCache = 2000`
 - Number of core-objects stored before emptying cache (client side).
- `config.storage.broadcastProjectEvents = false`
 - If true, events regarding project/branch creation/deletion are only broadcasted and not emitted back to the socket who made the change. Only modify this if you are writing a custom GUI.
- `config.storage.maxEmittedCoreObjects = -1`
 - If greater than -1, the maximum number of core objects that will be emitted to other clients. N.B. this only applies to newly created nodes, any modified data will always be sent as patches.
- `config.storage.loadBucketSize = 100`
 - Size of bucket before triggering a load of objects from the server.
- `config.storage.loadBucketTimer = 10`
 - Time in milliseconds (after a new bucket has been created) before triggering a load of objects from the server.
- `config.storage.keyType = 'plainSha'`
 - Algorithm used when hashing the objects in the database, can be `'plainSHA1'`, `'rand160Bits'` or `'ZSSHA'`.
- `config.storage.disableHashChecks = false`
 - Since v2.6.2 patched objects on the server are being checked for consistency w.r.t. the provided hash before insertion into database. If true, no checking at all will take place.
- `config.storage.requireHashesToMatch = true`
 - If `config.storage.disableHashChecks` is set to false and this option is set to true, will not insert objects if the hashes do not match. Set this to false to only log the errors.
- `config.storage.autoMerge.enable = false`
 - (N.B. Experimental feature) If enable, incoming commits to branches that initially were `FORKED` will be attempted to be merged with the head of the branch. Use with caution as larger (+100k nodes) projects can slow down the commit rate.
- `config.storage.database.type = 'mongo'`
 - Type of database to store the data (metadata e.g. _users is always stored in mongo), can be `'mongo'`, `'redis'` or `'memory'`.
- `config.storage.database.options = '{}'`
 - Options passed to database client (unless mongo is specified, in that case `config.mongo.options` are used).

##### visualization
Note that although these can be used for serving files from different locations - they are mainly targeted for serving the generic UI and visual extensions added to it.

- `config.visualization.decoratorPaths = []`
 - Array of paths to decorators that should be available.
- `config.visualization.svgDirs = []`
 - Array of paths to directories containing SVG-files that will be available at `<host>/assets/DecoratorSVG/<%path%>` (full list of paths is available at `<host>/assets/decoratorSVGList.json`).
- `config.visualization.visualizerDescriptors = []`
 - Array of paths to json-files containing meta-data about the used visualizers.
- `config.visualization.panelPaths = []`
 - Array of base paths that will be mapped from `'panels'` in requirejs.
- `config.visualization.layout.basePaths = []`
 - Array of base paths for the layouts.

##### webhooks
- `config.webhooks.enable = true`
 - If true will start a webhook-manager from the server.
- `config.webhooks.manager = 'memory'`
 - Type of webhook-manager for detecting events, can be `'memory'`, `'redis'`. Memory runs in the server process, whereas redis
 is running in a sub-process. Redis requires the socket.io adapter to be of type redis. (It is also possible to run the redis manager separately from the webgme server.)
- `config.webhooks.defaults = {}`
 - Collection of hooks that should be added to every new project. Keys are webhook-ids and values are object with at least `url` and `events` defined, see [wiki](https://github.com/webgme/webgme/wiki/GME-WebHooks) for available fields.
 Optionally an `options` object can be passed to be used by the specific webhook (to disable automatic addition leave out the `url` field).
