# Changelog

## [v2.25.2](https://github.com/webgme/webgme-engine/tree/v2.25.2) (2021-01-11)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.25.2-alpha...v2.25.2)

**Implemented enhancements:**

- Combined fixes for WebGME-engine 01/21 [\#250](https://github.com/webgme/webgme-engine/pull/250) ([kecso](https://github.com/kecso))

**Fixed bugs:**

- Cannot open webgme with inferred user [\#245](https://github.com/webgme/webgme-engine/issues/245)
- Blob storage fails to store object [\#243](https://github.com/webgme/webgme-engine/issues/243)
- Fix for inferred user login issues [\#248](https://github.com/webgme/webgme-engine/pull/248) ([kecso](https://github.com/kecso))
- Blob issue [\#246](https://github.com/webgme/webgme-engine/pull/246) ([kecso](https://github.com/kecso))

**Closed issues:**

- OverrideFromEnv is adding extra keys to config [\#244](https://github.com/webgme/webgme-engine/issues/244)
- Merge fails with "Cannot read property 'oBaseGuids' of null [\#242](https://github.com/webgme/webgme-engine/issues/242)
- REST API documentation /api/plugins/{pluginId}/\* should be /api/plugin/{pluginId}/\* [\#241](https://github.com/webgme/webgme-engine/issues/241)
- Cannot execute browser plugin in unloaded node [\#238](https://github.com/webgme/webgme-engine/issues/238)
- Failed assert when getting library meta nodes [\#234](https://github.com/webgme/webgme-engine/issues/234)

**Merged pull requests:**

- Bump bl from 1.2.2 to 1.2.3 [\#247](https://github.com/webgme/webgme-engine/pull/247) ([dependabot[bot]](https://github.com/apps/dependabot))
- Bump elliptic from 6.4.1 to 6.5.3 [\#226](https://github.com/webgme/webgme-engine/pull/226) ([dependabot[bot]](https://github.com/apps/dependabot))

## [v2.25.2-alpha](https://github.com/webgme/webgme-engine/tree/v2.25.2-alpha) (2020-10-16)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.25.1...v2.25.2-alpha)

**Implemented enhancements:**

- Binary files for plugin use [\#239](https://github.com/webgme/webgme-engine/pull/239) ([kecso](https://github.com/kecso))
- Escape deprecated [\#230](https://github.com/webgme/webgme-engine/pull/230) ([kecso](https://github.com/kecso))

**Fixed bugs:**

- Cannot get user data that contains null as value [\#231](https://github.com/webgme/webgme-engine/issues/231)
- Fix core docs typo [\#237](https://github.com/webgme/webgme-engine/pull/237) ([brollb](https://github.com/brollb))

**Closed issues:**

- `core.setBase` appears to remove existing children in the node [\#236](https://github.com/webgme/webgme-engine/issues/236)
- Error not thrown when streaming data with BlobClient [\#228](https://github.com/webgme/webgme-engine/issues/228)
- Arrays stored in user data are returned as objects [\#223](https://github.com/webgme/webgme-engine/issues/223)

**Merged pull requests:**

- Decrypt user data \(Fixes \#231\) [\#232](https://github.com/webgme/webgme-engine/pull/232) ([kecso](https://github.com/kecso))
- Add error handler to putFile req when streaming. Fixes \#228 [\#229](https://github.com/webgme/webgme-engine/pull/229) ([brollb](https://github.com/brollb))
- Fix typo in docs [\#225](https://github.com/webgme/webgme-engine/pull/225) ([brollb](https://github.com/brollb))
- Don't treat arrays as objects during decryption. Fixes \#223 [\#224](https://github.com/webgme/webgme-engine/pull/224) ([brollb](https://github.com/brollb))
- Bump lodash from 4.17.15 to 4.17.19 [\#221](https://github.com/webgme/webgme-engine/pull/221) ([dependabot[bot]](https://github.com/apps/dependabot))

## [v2.25.1](https://github.com/webgme/webgme-engine/tree/v2.25.1) (2020-07-02)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.25.0...v2.25.1)

**Implemented enhancements:**

- Streamlined websocket access for routers [\#212](https://github.com/webgme/webgme-engine/issues/212)
- Websocket channel [\#216](https://github.com/webgme/webgme-engine/pull/216) ([kecso](https://github.com/kecso))
- Stream upload to Blob storage - implements \#210 [\#215](https://github.com/webgme/webgme-engine/pull/215) ([kecso](https://github.com/kecso))

**Fixed bugs:**

- Remove trailing whitespace from key. Fixes \#213 [\#214](https://github.com/webgme/webgme-engine/pull/214) ([brollb](https://github.com/brollb))

**Closed issues:**

- Fetching unencrypted userData w/ decrypt=true returns 500 [\#217](https://github.com/webgme/webgme-engine/issues/217)
- Trim whitespace from config.authentication.encryption.key [\#213](https://github.com/webgme/webgme-engine/issues/213)
- Extend BlobClient with Streaming support in PutFile/PutStream when used in node [\#210](https://github.com/webgme/webgme-engine/issues/210)

**Merged pull requests:**

- Only decrypt data if encrypted. Fixes \#217 [\#218](https://github.com/webgme/webgme-engine/pull/218) ([brollb](https://github.com/brollb))
- Update packages [\#220](https://github.com/webgme/webgme-engine/pull/220) ([kecso](https://github.com/kecso))
- Update source docs [\#219](https://github.com/webgme/webgme-engine/pull/219) ([kecso](https://github.com/kecso))

## [v2.25.0](https://github.com/webgme/webgme-engine/tree/v2.25.0) (2020-05-01)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.24.3...v2.25.0)

**Implemented enhancements:**

- Node lookup plugin [\#203](https://github.com/webgme/webgme-engine/issues/203)
- Mailer service [\#195](https://github.com/webgme/webgme-engine/issues/195)
- Enhance merge logging [\#207](https://github.com/webgme/webgme-engine/pull/207) ([kecso](https://github.com/kecso))
- Mailer - service [\#205](https://github.com/webgme/webgme-engine/pull/205) ([kecso](https://github.com/kecso))

**Fixed bugs:**

- Merge log [\#208](https://github.com/webgme/webgme-engine/pull/208) ([kecso](https://github.com/kecso))
- Inferred user password cannot be reset [\#206](https://github.com/webgme/webgme-engine/pull/206) ([kecso](https://github.com/kecso))

**Closed issues:**

- Expose information to reproduce \(and debug\) merge conflicts [\#204](https://github.com/webgme/webgme-engine/issues/204)
- Errors thrown by a plugin's `main` function should be handled automatically [\#201](https://github.com/webgme/webgme-engine/issues/201)
- Store encrypted userData [\#199](https://github.com/webgme/webgme-engine/issues/199)
- Send detailed error message on failure to create access token [\#197](https://github.com/webgme/webgme-engine/issues/197)
- Cannot delete old access tokens [\#192](https://github.com/webgme/webgme-engine/issues/192)
- Change Default Name For Access Tokens [\#190](https://github.com/webgme/webgme-engine/issues/190)
- Should Access Tokens hide their value after creation? [\#188](https://github.com/webgme/webgme-engine/issues/188)
- Add name/displayName to personal access tokens [\#182](https://github.com/webgme/webgme-engine/issues/182)

**Merged pull requests:**

- Catch and handle errors thrown by plugin main fn. Fixes \#201 [\#202](https://github.com/webgme/webgme-engine/pull/202) ([brollb](https://github.com/brollb))
- Optionally encrypt/decrypt userData fields using GME Auth. Closes \#199 [\#200](https://github.com/webgme/webgme-engine/pull/200) ([brollb](https://github.com/brollb))
- Send error message on failed token creation. Closes \#197 [\#198](https://github.com/webgme/webgme-engine/pull/198) ([brollb](https://github.com/brollb))
- Add API token auth to blob. Minor refactor of executor api token auth [\#196](https://github.com/webgme/webgme-engine/pull/196) ([brollb](https://github.com/brollb))
- Use \(unique\) display name for deletion. Fixes \#192 [\#194](https://github.com/webgme/webgme-engine/pull/194) ([brollb](https://github.com/brollb))
- Shorten default access token name. Closes \#190 [\#191](https://github.com/webgme/webgme-engine/pull/191) ([brollb](https://github.com/brollb))
- Only show access token ID on creation. Closes \#188 [\#189](https://github.com/webgme/webgme-engine/pull/189) ([brollb](https://github.com/brollb))

## [v2.24.3](https://github.com/webgme/webgme-engine/tree/v2.24.3) (2020-02-24)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.24.2...v2.24.3)

**Implemented enhancements:**

- Add displayName to access tokens. Closes \#182 [\#187](https://github.com/webgme/webgme-engine/pull/187) ([brollb](https://github.com/brollb))

**Fixed bugs:**

- Error when authenticating with API tokens and guest accounts disabled [\#185](https://github.com/webgme/webgme-engine/issues/185)
- Only call ensureAuthenticated if other auth methods fail. Fixes \#185 [\#186](https://github.com/webgme/webgme-engine/pull/186) ([brollb](https://github.com/brollb))

## [v2.24.2](https://github.com/webgme/webgme-engine/tree/v2.24.2) (2020-02-23)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.24.1...v2.24.2)

**Implemented enhancements:**

- Executor worker access control [\#170](https://github.com/webgme/webgme-engine/issues/170)
- Python plugin generation enhancement [\#184](https://github.com/webgme/webgme-engine/pull/184) ([kecso](https://github.com/kecso))
- Model import validation fix [\#183](https://github.com/webgme/webgme-engine/pull/183) ([kecso](https://github.com/kecso))

**Merged pull requests:**

- Add auth to executor framework \(and access tokens\). Closes \#170 [\#181](https://github.com/webgme/webgme-engine/pull/181) ([brollb](https://github.com/brollb))
- Update ExecutorServer to use async/await [\#180](https://github.com/webgme/webgme-engine/pull/180) ([brollb](https://github.com/brollb))

## [v2.24.1](https://github.com/webgme/webgme-engine/tree/v2.24.1) (2019-11-15)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.24.0...v2.24.1)

**Fixed bugs:**

- Cannot include webgme as a library [\#179](https://github.com/webgme/webgme-engine/issues/179)

## [v2.24.0](https://github.com/webgme/webgme-engine/tree/v2.24.0) (2019-11-15)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.23.2...v2.24.0)

**Fixed bugs:**

- Error in generated plugins [\#167](https://github.com/webgme/webgme-engine/issues/167)
- Library not updated if only meta set changes [\#177](https://github.com/webgme/webgme-engine/issues/177)
- Add getRunningPlugins to documentation. Fixes \#174 [\#175](https://github.com/webgme/webgme-engine/pull/175) ([brollb](https://github.com/brollb))
- Defined nodeObject and use `this` instead of `self`. Fixes \#167 [\#168](https://github.com/webgme/webgme-engine/pull/168) ([brollb](https://github.com/brollb))
- Fixes \#177 Library not updated if only meta set changes [\#178](https://github.com/webgme/webgme-engine/pull/178) ([kecso](https://github.com/kecso))
- Fix for issue \#165 [\#166](https://github.com/webgme/webgme-engine/pull/166) ([cahartsell](https://github.com/cahartsell))

**Closed issues:**

- Incorrect documentation for sendMessageToPlugin [\#174](https://github.com/webgme/webgme-engine/issues/174)

**Merged pull requests:**

- WASM based Hash computation [\#176](https://github.com/webgme/webgme-engine/pull/176) ([kecso](https://github.com/kecso))

## [v2.23.2](https://github.com/webgme/webgme-engine/tree/v2.23.2) (2019-08-21)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.23.1...v2.23.2)

**Closed issues:**

- Python-based plugin namespace is not set correctly [\#165](https://github.com/webgme/webgme-engine/issues/165)
- How to use a server on a subpath? [\#164](https://github.com/webgme/webgme-engine/issues/164)
- Plugin Api For Specific Plugin Returning Not Found [\#163](https://github.com/webgme/webgme-engine/issues/163)
- Importing From GME [\#162](https://github.com/webgme/webgme-engine/issues/162)

## [v2.23.1](https://github.com/webgme/webgme-engine/tree/v2.23.1) (2019-04-22)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.23.0...v2.23.1)

**Implemented enhancements:**

- How to use client.copyNodes? [\#157](https://github.com/webgme/webgme-engine/issues/157)
- Update nodejs version of travis and appveyor [\#159](https://github.com/webgme/webgme-engine/pull/159) ([pmeijer](https://github.com/pmeijer))
- Fixes \#157 by adding doc strings for copyNode/copyNodes/copyMoreNodes [\#158](https://github.com/webgme/webgme-engine/pull/158) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Handle old string errors and make sure result.error isn't overwritten [\#160](https://github.com/webgme/webgme-engine/pull/160) ([pmeijer](https://github.com/pmeijer))

## [v2.23.0](https://github.com/webgme/webgme-engine/tree/v2.23.0) (2019-03-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.22.4...v2.23.0)

**Merged pull requests:**

- Abort plugin [\#156](https://github.com/webgme/webgme-engine/pull/156) ([kecso](https://github.com/kecso))

## [v2.22.4](https://github.com/webgme/webgme-engine/tree/v2.22.4) (2019-02-25)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.22.3...v2.22.4)

**Implemented enhancements:**

- Missing API documentation for various plugin end-points [\#152](https://github.com/webgme/webgme-engine/issues/152)
- Add isValidSetMember method to core API. [\#154](https://github.com/webgme/webgme-engine/pull/154) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- core.getCommonParent returns the node itself if only given rather than the parent [\#151](https://github.com/webgme/webgme-engine/issues/151)
- Fixes \#151 and returns actual ancestor for core.getCommonParent/Base [\#153](https://github.com/webgme/webgme-engine/pull/153) ([pmeijer](https://github.com/pmeijer))

**Merged pull requests:**

- Documentation improvements [\#155](https://github.com/webgme/webgme-engine/pull/155) ([kecso](https://github.com/kecso))

## [v2.22.3](https://github.com/webgme/webgme-engine/tree/v2.22.3) (2019-01-21)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.22.2...v2.22.3)

**Implemented enhancements:**

- Add configuration parameter for compression level of blob artifacts [\#150](https://github.com/webgme/webgme-engine/pull/150) ([pmeijer](https://github.com/pmeijer))

## [v2.22.2](https://github.com/webgme/webgme-engine/tree/v2.22.2) (2018-12-20)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.22.1...v2.22.2)

**Implemented enhancements:**

- Bump mongodb to 4.x and use ubuntu xenial for travis tests [\#149](https://github.com/webgme/webgme-engine/pull/149) ([pmeijer](https://github.com/pmeijer))
- Minor improvements in component templates for plugin generators [\#147](https://github.com/webgme/webgme-engine/pull/147) ([pmeijer](https://github.com/pmeijer))
- Fixes \#140 Replace all usages of new Buffer\(\*\*\) as it is shown to be unsafe [\#142](https://github.com/webgme/webgme-engine/pull/142) ([kecso](https://github.com/kecso))
- Queue worker requests while client has local changes that haven't reached the server [\#141](https://github.com/webgme/webgme-engine/pull/141) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- PLUGIN\_NOTIFICATION not dispatched from client [\#146](https://github.com/webgme/webgme-engine/issues/146)
- Replace all usages of new Buffer\(\*\*\) as it is shown to be unsafe [\#140](https://github.com/webgme/webgme-engine/issues/140)
- Fix exception when undoing to first commit made [\#143](https://github.com/webgme/webgme-engine/pull/143) ([pmeijer](https://github.com/pmeijer))

**Security fixes:**

- Bump browserify to v16.2.3 [\#148](https://github.com/webgme/webgme-engine/pull/148) ([pmeijer](https://github.com/pmeijer))

**Closed issues:**

- Add script for parsing env vars overwriting config settings [\#144](https://github.com/webgme/webgme-engine/issues/144)

**Merged pull requests:**

- Fixes \#144 By parsing WEBGME\_\* environment variables [\#145](https://github.com/webgme/webgme-engine/pull/145) ([pmeijer](https://github.com/pmeijer))

## [v2.22.1](https://github.com/webgme/webgme-engine/tree/v2.22.1) (2018-11-20)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.22.0...v2.22.1)

**Implemented enhancements:**

- Npm audits and updates [\#138](https://github.com/webgme/webgme-engine/pull/138) ([pmeijer](https://github.com/pmeijer))
- Clean up unnecessary auth data in client config [\#137](https://github.com/webgme/webgme-engine/pull/137) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Fix bug where meta-rule checking reports readonly attributes as invalid [\#136](https://github.com/webgme/webgme-engine/pull/136) ([pmeijer](https://github.com/pmeijer))

**Merged pull requests:**

- Major speed-ups in complex meta-query methods by introducing temporary cache [\#139](https://github.com/webgme/webgme-engine/pull/139) ([pmeijer](https://github.com/pmeijer))

## [v2.22.0](https://github.com/webgme/webgme-engine/tree/v2.22.0) (2018-10-29)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.21.3...v2.22.0)

**Implemented enhancements:**

- More descriptive error message when given plugin nsp does not exist [\#132](https://github.com/webgme/webgme-engine/pull/132) ([pmeijer](https://github.com/pmeijer))
- Add example of sortable plugin configs [\#131](https://github.com/webgme/webgme-engine/pull/131) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- META object with namespace in invoked plugin is empty [\#134](https://github.com/webgme/webgme-engine/issues/134)
- Fixes \#134 META object with namespace in invoked plugin is empty [\#135](https://github.com/webgme/webgme-engine/pull/135) ([kecso](https://github.com/kecso))

## [v2.21.3](https://github.com/webgme/webgme-engine/tree/v2.21.3) (2018-09-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.21.2...v2.21.3)

**Implemented enhancements:**

- Add api/plugin/:pluginId/run endpoint for short running plugins [\#129](https://github.com/webgme/webgme-engine/pull/129) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Generated link in /api json should take mounted path into consideration [\#128](https://github.com/webgme/webgme-engine/pull/128) ([pmeijer](https://github.com/pmeijer))

## [v2.21.2](https://github.com/webgme/webgme-engine/tree/v2.21.2) (2018-08-29)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.21.1...v2.21.2)

**Fixed bugs:**

- client.addLibrary fails with 'Invalid CEN Header \(Bad Signature\)' [\#126](https://github.com/webgme/webgme-engine/issues/126)
- Fixes \#126 Seeds are uploaded to blob correctly at /api/seeds/:seedName [\#127](https://github.com/webgme/webgme-engine/pull/127) ([pmeijer](https://github.com/pmeijer))

## [v2.21.1](https://github.com/webgme/webgme-engine/tree/v2.21.1) (2018-08-27)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.21.0...v2.21.1)

**Fixed bugs:**

- FIX the template for generated plugin calling python [\#125](https://github.com/webgme/webgme-engine/pull/125) ([pmeijer](https://github.com/pmeijer))

## [v2.21.0](https://github.com/webgme/webgme-engine/tree/v2.21.0) (2018-08-24)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.20.4...v2.21.0)

**Implemented enhancements:**

- At PluginBase API, add addFile/Artifact and getFile/Artifact methods [\#122](https://github.com/webgme/webgme-engine/issues/122)
- Add option to generate python plugin from PluginGenerator [\#124](https://github.com/webgme/webgme-engine/pull/124) ([pmeijer](https://github.com/pmeijer))
- Fixes \#121, Fixes \#122 and adds core.createChild and harmonizes jsdoc documentation [\#123](https://github.com/webgme/webgme-engine/pull/123) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- core.isInstanceOf always returns false if path of base node provided [\#121](https://github.com/webgme/webgme-engine/issues/121)

## [v2.20.4](https://github.com/webgme/webgme-engine/tree/v2.20.4) (2018-08-09)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.20.3...v2.20.4)

**Implemented enhancements:**

- Some jsdoc fixes in core and project API [\#119](https://github.com/webgme/webgme-engine/pull/119) ([pmeijer](https://github.com/pmeijer))
-  Add getRootHash and getCommitObject on project API [\#118](https://github.com/webgme/webgme-engine/pull/118) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Absolute login and logout urls do not work if app is mounted at different path. [\#111](https://github.com/webgme/webgme-engine/issues/111)
- FIX undo/redo not working on client [\#117](https://github.com/webgme/webgme-engine/pull/117) ([pmeijer](https://github.com/pmeijer))
- Handle --inspect option at spawned add-on process [\#116](https://github.com/webgme/webgme-engine/pull/116) ([pmeijer](https://github.com/pmeijer))
- Fixes \#111 Absolute login and logout urls do not work if app is mounted at different path. [\#115](https://github.com/webgme/webgme-engine/pull/115) ([kecso](https://github.com/kecso))

## [v2.20.3](https://github.com/webgme/webgme-engine/tree/v2.20.3) (2018-07-30)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.20.2...v2.20.3)

**Implemented enhancements:**

- JSON Payload Sizing [\#113](https://github.com/webgme/webgme-engine/issues/113)
- Expose bodyParser.json 'limit' configuration option, verify within co… [\#114](https://github.com/webgme/webgme-engine/pull/114) ([nawgz](https://github.com/nawgz))
- Make sure gmeConfig is loaded correctly in classes.build [\#110](https://github.com/webgme/webgme-engine/pull/110) ([pmeijer](https://github.com/pmeijer))
- Add generation of minified build classes [\#109](https://github.com/webgme/webgme-engine/pull/109) ([pmeijer](https://github.com/pmeijer))

## [v2.20.2](https://github.com/webgme/webgme-engine/tree/v2.20.2) (2018-07-02)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.20.1...v2.20.2)

**Implemented enhancements:**

- Get library root id for GMENode [\#108](https://github.com/webgme/webgme-engine/pull/108) ([kecso](https://github.com/kecso))
- Log error when component-settings fails to load [\#107](https://github.com/webgme/webgme-engine/pull/107) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- FIX Remove recently added branch events. [\#106](https://github.com/webgme/webgme-engine/pull/106) ([pmeijer](https://github.com/pmeijer))

## [v2.20.1](https://github.com/webgme/webgme-engine/tree/v2.20.1) (2018-06-25)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.20.0...v2.20.1)

**Fixed bugs:**

- Point to published npm package for requirejs-text [\#105](https://github.com/webgme/webgme-engine/pull/105) ([pmeijer](https://github.com/pmeijer))

## [v2.20.0](https://github.com/webgme/webgme-engine/tree/v2.20.0) (2018-06-22)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.9...v2.20.0)

**Implemented enhancements:**

- Package update [\#103](https://github.com/webgme/webgme-engine/pull/103) ([kecso](https://github.com/kecso))
- Update README.md and add documentation to client API. [\#102](https://github.com/webgme/webgme-engine/pull/102) ([pmeijer](https://github.com/pmeijer))
- Allow webgme server to be mounted at non-root path [\#101](https://github.com/webgme/webgme-engine/pull/101) ([kecso](https://github.com/kecso))
- Update major version of mocha and karma [\#100](https://github.com/webgme/webgme-engine/pull/100) ([pmeijer](https://github.com/pmeijer))

**Merged pull requests:**

- Add option for plugin\_bin to connect to storage via server [\#104](https://github.com/webgme/webgme-engine/pull/104) ([pmeijer](https://github.com/pmeijer))

## [v2.19.9](https://github.com/webgme/webgme-engine/tree/v2.19.9) (2018-06-04)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.8...v2.19.9)

**Implemented enhancements:**

- Add methods for getting common base and getting common parent for two or more nodes [\#82](https://github.com/webgme/webgme-engine/issues/82)
- Node module updates [\#92](https://github.com/webgme/webgme-engine/pull/92) ([pmeijer](https://github.com/pmeijer))
- Changing meta rule removal propagation [\#97](https://github.com/webgme/webgme-engine/pull/97) ([kecso](https://github.com/kecso))
- Fixes \#82 by adding core.getCommonBase and getCommonParent and equivalents on client API [\#96](https://github.com/webgme/webgme-engine/pull/96) ([pmeijer](https://github.com/pmeijer))
- Add addresses field and more details for webSockets in /api/status endpoint [\#95](https://github.com/webgme/webgme-engine/pull/95) ([pmeijer](https://github.com/pmeijer))
- Add module for handling crosscuts using the core \(e.g. from a plugin\) [\#94](https://github.com/webgme/webgme-engine/pull/94) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Better handling of expired tokens in websocket [\#98](https://github.com/webgme/webgme-engine/pull/98) ([pmeijer](https://github.com/pmeijer))

## [v2.19.8](https://github.com/webgme/webgme-engine/tree/v2.19.8) (2018-05-07)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.7...v2.19.8)

**Implemented enhancements:**

- Minor fixes for release 2.19.8 [\#90](https://github.com/webgme/webgme-engine/pull/90) ([kecso](https://github.com/kecso))
- Infer user at token verification instead at user api path [\#89](https://github.com/webgme/webgme-engine/pull/89) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Unable to import model if model's meta is a library and vice versa [\#86](https://github.com/webgme/webgme-engine/issues/86)
- Fixes discrepancies in admin account and projects created at start up  [\#87](https://github.com/webgme/webgme-engine/pull/87) ([pmeijer](https://github.com/pmeijer))

## [v2.19.7](https://github.com/webgme/webgme-engine/tree/v2.19.7) (2018-04-10)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.6...v2.19.7)

**Implemented enhancements:**

- Allow inferred users to have displayName [\#81](https://github.com/webgme/webgme-engine/issues/81)
- Exception in mixin core when checking valid attribute of undefined attribute [\#65](https://github.com/webgme/webgme-engine/issues/65)
- Remove restriction on zip file size of complex blob artifact [\#84](https://github.com/webgme/webgme-engine/pull/84) ([pmeijer](https://github.com/pmeijer))
- Closes \#81 Allow inferred users to have displayName [\#83](https://github.com/webgme/webgme-engine/pull/83) ([kecso](https://github.com/kecso))
- Closes \#78 Add support to specify seeds to be created at server start up [\#80](https://github.com/webgme/webgme-engine/pull/80) ([kecso](https://github.com/kecso))
- Initiate graceful server shutdown on SIGTERM [\#69](https://github.com/webgme/webgme-engine/pull/69) ([pmeijer](https://github.com/pmeijer))
- Add method getUserId on Project, Plugin and Client APIs [\#67](https://github.com/webgme/webgme-engine/pull/67) ([pmeijer](https://github.com/pmeijer))
- Closes \#65 Exception in mixin core when checking valid attribute of undefined attribute. [\#66](https://github.com/webgme/webgme-engine/pull/66) ([kecso](https://github.com/kecso))

**Fixed bugs:**

- Exported project contains extra .webgmex [\#74](https://github.com/webgme/webgme-engine/issues/74)
- Containment inheritance loop detection during node creation is missing [\#73](https://github.com/webgme/webgme-engine/issues/73)
- "namespace" is not auto set when executing a plugin [\#71](https://github.com/webgme/webgme-engine/issues/71)
- Fixes \#73 Containment inheritance loop detection during node creation is missing [\#76](https://github.com/webgme/webgme-engine/pull/76) ([kecso](https://github.com/kecso))
- Fixes \#74 do not add extra webgmex at project export [\#75](https://github.com/webgme/webgme-engine/pull/75) ([pmeijer](https://github.com/pmeijer))
- Use the activeObject for the nodeId on the client. Fixes \#71 [\#72](https://github.com/webgme/webgme-engine/pull/72) ([brollb](https://github.com/brollb))

**Closed issues:**

- Add support to specify seeds to be created at server start up [\#78](https://github.com/webgme/webgme-engine/issues/78)
- Add support for public organizations and admin to be created at start up [\#77](https://github.com/webgme/webgme-engine/issues/77)

**Merged pull requests:**

- Fixes \#77 adds support for default admin account and public organization [\#79](https://github.com/webgme/webgme-engine/pull/79) ([pmeijer](https://github.com/pmeijer))

## [v2.19.6](https://github.com/webgme/webgme-engine/tree/v2.19.6) (2018-03-12)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.5...v2.19.6)

**Implemented enhancements:**

- Adding a seed as a library [\#63](https://github.com/webgme/webgme-engine/issues/63)
- Add API for generating webgmexm \(export of subset\(s\) of project\) [\#57](https://github.com/webgme/webgme-engine/issues/57)
- Add REST endpoint for statistics about connected users etc. [\#54](https://github.com/webgme/webgme-engine/issues/54)
-  Cannot call setFinishTime of undefined [\#52](https://github.com/webgme/webgme-engine/issues/52)
- Core should check for valid attribute, pointer, aspects and set names. [\#49](https://github.com/webgme/webgme-engine/issues/49)
- renameAttributeMeta does not exist on client API [\#48](https://github.com/webgme/webgme-engine/issues/48)
- Fixes \#63 Expose usage of seed in addLibrary/updateLibrary/updateProjectFromFile from client [\#64](https://github.com/webgme/webgme-engine/pull/64) ([pmeijer](https://github.com/pmeijer))
- Fixes \#57 expose serialization functions [\#62](https://github.com/webgme/webgme-engine/pull/62) ([pmeijer](https://github.com/pmeijer))
- Enable plugins to be required without requirejs and passed to manager as "class" [\#59](https://github.com/webgme/webgme-engine/pull/59) ([pmeijer](https://github.com/pmeijer))
- Fixes \#48 renameAttributeMeta does not exist on client API [\#56](https://github.com/webgme/webgme-engine/pull/56) ([kecso](https://github.com/kecso))
- Fixes \#54 add rest status end points [\#55](https://github.com/webgme/webgme-engine/pull/55) ([pmeijer](https://github.com/pmeijer))
- Use the plugin.result as default result value. Fixes \#52 [\#53](https://github.com/webgme/webgme-engine/pull/53) ([brollb](https://github.com/brollb))
- Support creation of test projects from "json" objects [\#50](https://github.com/webgme/webgme-engine/pull/50) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Cascading moves cause crash during merge [\#60](https://github.com/webgme/webgme-engine/issues/60)
- Core.isValidAttributeValueOf should return false if attribute is readonly and value holder not a metanode [\#51](https://github.com/webgme/webgme-engine/issues/51)
- Fixes \#60 Cascading moves cause crash during merge [\#61](https://github.com/webgme/webgme-engine/pull/61) ([kecso](https://github.com/kecso))
- Fix tests checking for invalid regular expressions which changed around node v8.10.0 [\#58](https://github.com/webgme/webgme-engine/pull/58) ([pmeijer](https://github.com/pmeijer))

## [v2.19.5](https://github.com/webgme/webgme-engine/tree/v2.19.5) (2018-02-09)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.4...v2.19.5)

**Implemented enhancements:**

- Client API should have a method to close project [\#43](https://github.com/webgme/webgme-engine/issues/43)
- Depend on marked explicitly to avoid unsecure version [\#46](https://github.com/webgme/webgme-engine/pull/46) ([pmeijer](https://github.com/pmeijer))
- Closes \#42 Closes \#43 Various improvements to client API and SWM [\#45](https://github.com/webgme/webgme-engine/pull/45) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Setting new position to 0 will assign 100 in client api [\#42](https://github.com/webgme/webgme-engine/issues/42)

**Merged pull requests:**

- Allow multiple watchers of documents sharing the same socket connection [\#47](https://github.com/webgme/webgme-engine/pull/47) ([pmeijer](https://github.com/pmeijer))

## [v2.19.4](https://github.com/webgme/webgme-engine/tree/v2.19.4) (2018-01-29)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.3...v2.19.4)

**Implemented enhancements:**

- Worker manager should have a configurable maximum number of queued jobs [\#41](https://github.com/webgme/webgme-engine/issues/41)
- Fixes \#41 introduce maxQueuedWorkerRequests parameter and fix plugin results at failures [\#44](https://github.com/webgme/webgme-engine/pull/44) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Disconnected worker requests need to be notified properly [\#38](https://github.com/webgme/webgme-engine/issues/38)
- Fixes \#38 Server workers act on changes in the connection state [\#39](https://github.com/webgme/webgme-engine/pull/39) ([pmeijer](https://github.com/pmeijer))

## [v2.19.3](https://github.com/webgme/webgme-engine/tree/v2.19.3) (2018-01-11)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.2...v2.19.3)

**Implemented enhancements:**

- Bump year to 2018. [\#36](https://github.com/webgme/webgme-engine/pull/36) ([kecso](https://github.com/kecso))
- Update to ejs 2.5.7 and use it as a node\_module [\#35](https://github.com/webgme/webgme-engine/pull/35) ([pmeijer](https://github.com/pmeijer))
- Websocket error reporting and promises in storage [\#34](https://github.com/webgme/webgme-engine/pull/34) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Prohibit core and storage to bombard server with loadPaths requests [\#37](https://github.com/webgme/webgme-engine/pull/37) ([pmeijer](https://github.com/pmeijer))

## [v2.19.2](https://github.com/webgme/webgme-engine/tree/v2.19.2) (2017-12-18)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.1...v2.19.2)

**Fixed bugs:**

- Fix Plugin MetaGME Paradigm Importer does not properly import connections [\#33](https://github.com/webgme/webgme-engine/pull/33) ([kecso](https://github.com/kecso))

## [v2.19.1](https://github.com/webgme/webgme-engine/tree/v2.19.1) (2017-12-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.19.0...v2.19.1)

## [v2.19.0](https://github.com/webgme/webgme-engine/tree/v2.19.0) (2017-12-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.18.5...v2.19.0)

**Implemented enhancements:**

- addLibrary from seed [\#29](https://github.com/webgme/webgme-engine/issues/29)
- Add postinstall builder for generating common/libs  [\#2](https://github.com/webgme/webgme-engine/issues/2)
- Fixes \#29 addLibrary and updateLibrary from seed possible [\#31](https://github.com/webgme/webgme-engine/pull/31) ([pmeijer](https://github.com/pmeijer))
- Fixes \#2 browserify common-libs in postinstall script and bump versions [\#26](https://github.com/webgme/webgme-engine/pull/26) ([pmeijer](https://github.com/pmeijer))
- Use eslint for style rules [\#25](https://github.com/webgme/webgme-engine/pull/25) ([pmeijer](https://github.com/pmeijer))
- Track opened transactions and allow multiple invocations to join a single transaction [\#24](https://github.com/webgme/webgme-engine/pull/24) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- CoreQ should not swallow errors from addLibrary and setGuid [\#30](https://github.com/webgme/webgme-engine/pull/30) ([pmeijer](https://github.com/pmeijer))

**Merged pull requests:**

- Add support for editing attributes using Operation Transformations [\#28](https://github.com/webgme/webgme-engine/pull/28) ([pmeijer](https://github.com/pmeijer))

## [v2.18.5](https://github.com/webgme/webgme-engine/tree/v2.18.5) (2017-11-14)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.18.4...v2.18.5)

**Implemented enhancements:**

- Referenced objects returned from the core should be copied at return [\#17](https://github.com/webgme/webgme-engine/issues/17)
- Better source code documentation for callbacks in plugin-base  [\#23](https://github.com/webgme/webgme-engine/pull/23) ([pmeijer](https://github.com/pmeijer))
- Better error handling at faulty metadata.json for plugins [\#22](https://github.com/webgme/webgme-engine/pull/22) ([pmeijer](https://github.com/pmeijer))
- Fix colliding debugger ports in workers for nodejs \> 8  [\#21](https://github.com/webgme/webgme-engine/pull/21) ([pmeijer](https://github.com/pmeijer))
- Bump node-module versions [\#20](https://github.com/webgme/webgme-engine/pull/20) ([pmeijer](https://github.com/pmeijer))
- Fixes \#17 Copies all returned objects from core [\#19](https://github.com/webgme/webgme-engine/pull/19) ([pmeijer](https://github.com/pmeijer))
- Use Node 8 and 6 for CI tests and make appropriate changes [\#18](https://github.com/webgme/webgme-engine/pull/18) ([pmeijer](https://github.com/pmeijer))

## [v2.18.4](https://github.com/webgme/webgme-engine/tree/v2.18.4) (2017-10-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.18.3...v2.18.4)

**Fixed bugs:**

- Relaunching users in client throws exception [\#14](https://github.com/webgme/webgme-engine/issues/14)
- Merging branches with children created in a container and container removed resolves with no conflict [\#13](https://github.com/webgme/webgme-engine/issues/13)
- Merging two branches with new nodes only keeps one [\#12](https://github.com/webgme/webgme-engine/issues/12)
- Merge fixes [\#16](https://github.com/webgme/webgme-engine/pull/16) ([kecso](https://github.com/kecso))
- Fixes \#14 make sure UI is not null before accessing relaunch [\#15](https://github.com/webgme/webgme-engine/pull/15) ([pmeijer](https://github.com/pmeijer))

## [v2.18.3](https://github.com/webgme/webgme-engine/tree/v2.18.3) (2017-09-25)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.18.2...v2.18.3)

**Fixed bugs:**

- Typo in build classes regarding Q [\#9](https://github.com/webgme/webgme-engine/pull/9) ([pmeijer](https://github.com/pmeijer))

## [v2.18.2](https://github.com/webgme/webgme-engine/tree/v2.18.2) (2017-09-19)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.18.1...v2.18.2)

**Implemented enhancements:**

- Add missing client meta methods [\#8](https://github.com/webgme/webgme-engine/pull/8) ([pmeijer](https://github.com/pmeijer))
- Make plugin.isMetaTypeOf more robust and better core documentation [\#7](https://github.com/webgme/webgme-engine/pull/7) ([pmeijer](https://github.com/pmeijer))
- Remove obsolete client side paths in globals. [\#6](https://github.com/webgme/webgme-engine/pull/6) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Meta-rules and constraint checking throws exception in client [\#5](https://github.com/webgme/webgme-engine/pull/5) ([pmeijer](https://github.com/pmeijer))

## [v2.18.1](https://github.com/webgme/webgme-engine/tree/v2.18.1) (2017-09-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.18.0...v2.18.1)

**Implemented enhancements:**

- Expose server modules at require\('webgme-engine'\) [\#4](https://github.com/webgme/webgme-engine/pull/4) ([pmeijer](https://github.com/pmeijer))

**Fixed bugs:**

- Fix randomly failing test regarding copying multiple nodes [\#3](https://github.com/webgme/webgme-engine/pull/3) ([pmeijer](https://github.com/pmeijer))

## [v2.18.0](https://github.com/webgme/webgme-engine/tree/v2.18.0) (2017-09-11)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.17.0...v2.18.0)

**Implemented enhancements:**

- First npm release of webgme-engine [\#1](https://github.com/webgme/webgme-engine/issues/1)

## [v2.17.0](https://github.com/webgme/webgme-engine/tree/v2.17.0) (2017-08-28)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.16.0...v2.17.0)

## [v2.16.0](https://github.com/webgme/webgme-engine/tree/v2.16.0) (2017-07-31)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.15.1...v2.16.0)

## [v2.15.1](https://github.com/webgme/webgme-engine/tree/v2.15.1) (2017-07-06)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.15.0...v2.15.1)

## [v2.15.0](https://github.com/webgme/webgme-engine/tree/v2.15.0) (2017-07-03)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.14.1...v2.15.0)

## [v2.14.1](https://github.com/webgme/webgme-engine/tree/v2.14.1) (2017-06-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.14.0...v2.14.1)

## [v2.14.0](https://github.com/webgme/webgme-engine/tree/v2.14.0) (2017-06-05)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.13.1...v2.14.0)

## [v2.13.1](https://github.com/webgme/webgme-engine/tree/v2.13.1) (2017-05-15)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.13.0...v2.13.1)

## [v2.13.0](https://github.com/webgme/webgme-engine/tree/v2.13.0) (2017-05-08)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.12.1...v2.13.0)

## [v2.12.1](https://github.com/webgme/webgme-engine/tree/v2.12.1) (2017-04-11)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.12.0...v2.12.1)

## [v2.12.0](https://github.com/webgme/webgme-engine/tree/v2.12.0) (2017-04-10)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.11.1...v2.12.0)

## [v2.11.1](https://github.com/webgme/webgme-engine/tree/v2.11.1) (2017-03-21)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.11.0...v2.11.1)

## [v2.11.0](https://github.com/webgme/webgme-engine/tree/v2.11.0) (2017-03-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.10.0...v2.11.0)

## [v2.10.0](https://github.com/webgme/webgme-engine/tree/v2.10.0) (2017-02-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.9.0...v2.10.0)

## [v2.9.0](https://github.com/webgme/webgme-engine/tree/v2.9.0) (2017-01-16)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.8.0...v2.9.0)

## [v2.8.0](https://github.com/webgme/webgme-engine/tree/v2.8.0) (2016-12-20)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.7.1...v2.8.0)

## [v2.7.1](https://github.com/webgme/webgme-engine/tree/v2.7.1) (2016-11-28)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.7.0...v2.7.1)

## [v2.7.0](https://github.com/webgme/webgme-engine/tree/v2.7.0) (2016-11-22)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.6.3...v2.7.0)

## [v2.6.3](https://github.com/webgme/webgme-engine/tree/v2.6.3) (2016-11-16)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.6.2...v2.6.3)

## [v2.6.2](https://github.com/webgme/webgme-engine/tree/v2.6.2) (2016-11-15)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.6.1...v2.6.2)

## [v2.6.1](https://github.com/webgme/webgme-engine/tree/v2.6.1) (2016-10-31)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.6.0...v2.6.1)

## [v2.6.0](https://github.com/webgme/webgme-engine/tree/v2.6.0) (2016-10-24)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.5.1...v2.6.0)

## [v2.5.1](https://github.com/webgme/webgme-engine/tree/v2.5.1) (2016-09-30)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.5.0...v2.5.1)

## [v2.5.0](https://github.com/webgme/webgme-engine/tree/v2.5.0) (2016-09-27)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.4.1...v2.5.0)

## [v2.4.1](https://github.com/webgme/webgme-engine/tree/v2.4.1) (2016-09-01)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.4.0...v2.4.1)

## [v2.4.0](https://github.com/webgme/webgme-engine/tree/v2.4.0) (2016-08-29)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.3.1...v2.4.0)

## [v2.3.1](https://github.com/webgme/webgme-engine/tree/v2.3.1) (2016-08-10)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.3.0...v2.3.1)

## [v2.3.0](https://github.com/webgme/webgme-engine/tree/v2.3.0) (2016-08-01)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.2.1...v2.3.0)

## [v2.2.1](https://github.com/webgme/webgme-engine/tree/v2.2.1) (2016-07-18)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.2.0...v2.2.1)

## [v2.2.0](https://github.com/webgme/webgme-engine/tree/v2.2.0) (2016-07-04)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.1.0...v2.2.0)

## [v2.1.0](https://github.com/webgme/webgme-engine/tree/v2.1.0) (2016-06-06)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.0.1...v2.1.0)

## [v2.0.1](https://github.com/webgme/webgme-engine/tree/v2.0.1) (2016-05-23)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v2.0.0...v2.0.1)

## [v2.0.0](https://github.com/webgme/webgme-engine/tree/v2.0.0) (2016-05-06)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.7.2...v2.0.0)

## [v1.7.2](https://github.com/webgme/webgme-engine/tree/v1.7.2) (2016-04-26)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.7.1...v1.7.2)

## [v1.7.1](https://github.com/webgme/webgme-engine/tree/v1.7.1) (2016-04-18)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.7.0...v1.7.1)

## [v1.7.0](https://github.com/webgme/webgme-engine/tree/v1.7.0) (2016-04-11)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.6.0...v1.7.0)

## [v1.6.0](https://github.com/webgme/webgme-engine/tree/v1.6.0) (2016-03-14)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.5.1...v1.6.0)

## [v1.5.1](https://github.com/webgme/webgme-engine/tree/v1.5.1) (2016-02-20)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.5.0...v1.5.1)

## [v1.5.0](https://github.com/webgme/webgme-engine/tree/v1.5.0) (2016-02-15)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.4.1...v1.5.0)

## [v1.4.1](https://github.com/webgme/webgme-engine/tree/v1.4.1) (2016-01-20)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.4.0...v1.4.1)

## [v1.4.0](https://github.com/webgme/webgme-engine/tree/v1.4.0) (2016-01-18)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.3.2...v1.4.0)

## [v1.3.2](https://github.com/webgme/webgme-engine/tree/v1.3.2) (2016-01-08)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.3.1...v1.3.2)

## [v1.3.1](https://github.com/webgme/webgme-engine/tree/v1.3.1) (2015-12-23)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.3.0...v1.3.1)

## [v1.3.0](https://github.com/webgme/webgme-engine/tree/v1.3.0) (2015-12-21)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.2.1...v1.3.0)

## [v1.2.1](https://github.com/webgme/webgme-engine/tree/v1.2.1) (2015-11-30)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.2.0...v1.2.1)

## [v1.2.0](https://github.com/webgme/webgme-engine/tree/v1.2.0) (2015-11-23)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.1.0...v1.2.0)

## [v1.1.0](https://github.com/webgme/webgme-engine/tree/v1.1.0) (2015-10-26)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.0.2...v1.1.0)

## [v1.0.2](https://github.com/webgme/webgme-engine/tree/v1.0.2) (2015-10-08)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.0.1...v1.0.2)

## [v1.0.1](https://github.com/webgme/webgme-engine/tree/v1.0.1) (2015-10-04)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v1.0.0...v1.0.1)

## [v1.0.0](https://github.com/webgme/webgme-engine/tree/v1.0.0) (2015-09-29)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.14.1...v1.0.0)

## [v0.14.1](https://github.com/webgme/webgme-engine/tree/v0.14.1) (2015-09-07)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.14.0...v0.14.1)

## [v0.14.0](https://github.com/webgme/webgme-engine/tree/v0.14.0) (2015-08-31)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.13.2...v0.14.0)

## [v0.13.2](https://github.com/webgme/webgme-engine/tree/v0.13.2) (2015-08-12)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.13.1...v0.13.2)

## [v0.13.1](https://github.com/webgme/webgme-engine/tree/v0.13.1) (2015-08-10)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.13.0...v0.13.1)

## [v0.13.0](https://github.com/webgme/webgme-engine/tree/v0.13.0) (2015-08-03)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.12.1...v0.13.0)

## [v0.12.1](https://github.com/webgme/webgme-engine/tree/v0.12.1) (2015-07-20)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.12.0...v0.12.1)

## [v0.12.0](https://github.com/webgme/webgme-engine/tree/v0.12.0) (2015-07-06)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.11.1...v0.12.0)

## [v0.11.1](https://github.com/webgme/webgme-engine/tree/v0.11.1) (2015-06-15)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.11.0...v0.11.1)

## [v0.11.0](https://github.com/webgme/webgme-engine/tree/v0.11.0) (2015-06-09)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.10.2...v0.11.0)

## [v0.10.2](https://github.com/webgme/webgme-engine/tree/v0.10.2) (2015-05-12)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.10.1...v0.10.2)

## [v0.10.1](https://github.com/webgme/webgme-engine/tree/v0.10.1) (2015-05-11)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.10.0...v0.10.1)

## [v0.10.0](https://github.com/webgme/webgme-engine/tree/v0.10.0) (2015-05-11)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.9.2...v0.10.0)

## [v0.9.2](https://github.com/webgme/webgme-engine/tree/v0.9.2) (2015-04-15)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.9.1...v0.9.2)

## [v0.9.1](https://github.com/webgme/webgme-engine/tree/v0.9.1) (2015-04-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.9.0...v0.9.1)

## [v0.9.0](https://github.com/webgme/webgme-engine/tree/v0.9.0) (2015-04-13)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.8.2...v0.9.0)

## [v0.8.2](https://github.com/webgme/webgme-engine/tree/v0.8.2) (2015-03-19)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.8.1...v0.8.2)

## [v0.8.1](https://github.com/webgme/webgme-engine/tree/v0.8.1) (2015-03-16)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.8.0...v0.8.1)

## [v0.8.0](https://github.com/webgme/webgme-engine/tree/v0.8.0) (2015-03-16)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.7.2...v0.8.0)

## [v0.7.2](https://github.com/webgme/webgme-engine/tree/v0.7.2) (2015-03-06)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.7.1...v0.7.2)

## [v0.7.1](https://github.com/webgme/webgme-engine/tree/v0.7.1) (2015-02-25)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.7.0...v0.7.1)

## [v0.7.0](https://github.com/webgme/webgme-engine/tree/v0.7.0) (2015-02-16)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/v0.6.6...v0.7.0)

## [v0.6.6](https://github.com/webgme/webgme-engine/tree/v0.6.6) (2015-02-09)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/webgme_0.6.5...v0.6.6)

## [webgme_0.6.5](https://github.com/webgme/webgme-engine/tree/webgme_0.6.5) (2014-06-30)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/webgme_0.6.3...webgme_0.6.5)

## [webgme_0.6.3](https://github.com/webgme/webgme-engine/tree/webgme_0.6.3) (2014-06-26)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/webgme_0.5.12...webgme_0.6.3)

## [webgme_0.5.12](https://github.com/webgme/webgme-engine/tree/webgme_0.5.12) (2014-05-29)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/webgme_0.4.4...webgme_0.5.12)

## [webgme_0.4.4](https://github.com/webgme/webgme-engine/tree/webgme_0.4.4) (2014-02-05)

[Full Changelog](https://github.com/webgme/webgme-engine/compare/deb1828b30e579cb3583c7d61e56be062129a2d4...webgme_0.4.4)



\* *This Changelog was automatically generated by [github_changelog_generator](https://github.com/github-changelog-generator/github-changelog-generator)*
