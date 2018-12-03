/*eslint-env node*/
/*eslint no-console: 0*/

/**
 * Updates the passed in gmeConfig with values from environment variables starting with GME_.
 * See https://github.com/webgme/webgme-engine/issues/144 for details
 * Note that the passed in config is mutated!
 * @param {object} config
 */
function overrideFromEnv(config) {
    var env = process.env;

    Object.keys(env)
        .forEach(function (key) {
            if (key.indexOf('GME_') === 0) {
                var configPath,
                    subConfig,
                    wasCreated,
                    value;

                try {
                    value = JSON.parse(env[key]);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        // Regular string value
                        value = env[key];
                    } else {
                        throw e;
                    }
                }

                configPath = key.split('_').slice(1);

                subConfig = config;
                configPath.forEach(function (cfgName, idx) {
                    wasCreated = wasCreated || (subConfig.hasOwnProperty(cfgName) === false);
                    if (idx === configPath.length - 1) {
                        subConfig[cfgName] = value;
                        console.log('ENV ' + (wasCreated ? 'created' : 'updated') +
                            ' config.' + configPath.join('.') + '=' + value + ' <' + typeof value + '>');
                    } else {
                        if (subConfig.hasOwnProperty(cfgName) === false) {
                            subConfig[cfgName] = {};
                        } else if (typeof subConfig[cfgName] !== 'object' ||
                            subConfig[cfgName] === null ||
                            subConfig instanceof Array) {
                            throw new Error(key + ' would override non-object config path at ' + [cfgName]);
                        }

                        subConfig  = subConfig[cfgName];
                    }
                });
            }
        });
}

// var myConfig = {
//     authentication: {
//         allowGuests: true,
//     }
// };
// overrideFromEnv(myConfig);
// console.log(myConfig);

module.exports = overrideFromEnv;
