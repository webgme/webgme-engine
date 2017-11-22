These libraries are used in the browser and on the server and are browserified in
`util/postinstall.js` (called from npm postinstall).
 
In addition to the browserified node-modules from `COMMON_LIBS.js`, `requirejs` and `requirejs/text`
are copied over into `./requirejs`.