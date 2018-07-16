/*globals define, GME*/
/*eslint-env browser*/
/*eslint no-console: 0*/

/**
 * @author kecso / https://github.com/kecso
 * @author lattmann / https://github.com/lattmann
 * @author nabana / https://github.com/nabana
 * @author ksmyth / https://github.com/ksmyth
 * @author pmeijer / https://github.com/pmeijer
 */

define('webgme.classes', [
    'client/client',
    'blob/BlobClient',
    'executor/ExecutorClient',
    'common/core/core',
    'common/storage/browserstorage',
    'client/logger',
    'superagent',
    'q',
    'chance'
], function (Client,
             BlobClient,
             ExecutorClient,
             Core,
             Storage,
             logger,
             superagent,
             Q,
             chance) {

    'use strict';
    // Setting global classes
    GME.classes.Client = Client;
    GME.classes.BlobClient = BlobClient;
    GME.classes.ExecutorClient = ExecutorClient;
    GME.classes.Core = Core;
    GME.classes.Storage = Storage;
    GME.classes.logger = logger;

    // Exposing built in libraries
    GME.utils.superagent = superagent;
    GME.utils.Q = Q;
    GME.utils.chance = chance;

    // Pure JavaScript equivalent to jQuery's $.ready() from https://github.com/jfriend00/docReady

    (function (funcName, baseObj) {
        // The public function name defaults to window.docReady
        // but you can pass in your own object and own function name and those will be used
        // if you want to put them in a different namespace
        funcName = funcName || 'docReady';
        baseObj = baseObj || window;
        var readyList = [];
        var readyFired = false;
        var readyEventHandlersInstalled = false;

        // call this when the document is ready
        // this function protects itself against being called more than once
        function ready() {
            if (!readyFired) {
                // this must be set to true before we start calling callbacks
                readyFired = true;
                for (var i = 0; i < readyList.length; i++) {
                    // if a callback here happens to add new ready handlers,
                    // the docReady() function will see that it already fired
                    // and will schedule the callback to run right after
                    // this event loop finishes so all handlers will still execute
                    // in order and no new ones will be added to the readyList
                    // while we are processing the list
                    readyList[i].fn.call(window, readyList[i].ctx);
                }
                // allow any closures held by these functions to free
                readyList = [];
            }
        }

        function readyStateChange() {
            if (document.readyState === 'complete') {
                ready();
            }
        }

        // This is the one public interface
        // docReady(fn, context);
        // the context argument is optional - if present, it will be passed
        // as an argument to the callback
        baseObj[funcName] = function (callback, context) {
            // if ready has already fired, then just schedule the callback
            // to fire asynchronously, but right away
            if (readyFired) {
                setTimeout(function () {
                    callback(context);
                }, 1);
                return;
            } else {
                // add the function and context to the list
                readyList.push({fn: callback, ctx: context});
            }
            // if document already ready to go, schedule the ready function to run
            if (document.readyState === 'complete') {
                setTimeout(ready, 1);
            } else if (!readyEventHandlersInstalled) {
                // otherwise if we don't have event handlers installed, install them
                if (document.addEventListener) {
                    // first choice is DOMContentLoaded event
                    document.addEventListener('DOMContentLoaded', ready, false);
                    // backup is window load event
                    window.addEventListener('load', ready, false);
                } else {
                    // must be IE
                    document.attachEvent('onreadystatechange', readyStateChange);
                    window.attachEvent('onload', ready);
                }
                readyEventHandlersInstalled = true;
            }
        };
    })('docReady', window);

    // See if there is handler attached to body tag when ready

    var evalOnGmeInit = function () {
        if (document.body.getAttribute('on-gme-init')) {
            eval(document.body.getAttribute('on-gme-init'));
        } else {
            console.warn('To use GME, define a javascript function and set the body ' +
            'element\'s on-gme-init property.');
        }
    };

    // wait for document.readyState !== 'loading' and getGmeConfig
    var stillLoading = 2;
    var somethingFinishedLoading = function () {
        if (--stillLoading === 0) {
            evalOnGmeInit();
        }
    };

    if (document.readyState === 'loading') {
        // eslint-disable-next-line
        docReady(function () {
            somethingFinishedLoading();
            requestGmeConfig();
        });
    } else {
        somethingFinishedLoading();
        requestGmeConfig();
    }

    function requestGmeConfig() {
        var http = new XMLHttpRequest(),
            mountPath = '',
            mountElm = document.getElementById('mounted-path'),
            configUrl;

        if (mountElm && mountElm.getAttribute('content')) {
            mountPath = mountElm.getAttribute('content');
        }

        configUrl = window.location.origin + mountPath + '/gmeConfig.json';
        http.onreadystatechange = function () {
            if (http.readyState === 4 && http.status === 200) {
                GME.gmeConfig = JSON.parse(http.responseText);
                somethingFinishedLoading();
            } else if (http.readyState === 4 && http.status !== 200) {
                console.warn('Could not load gmeConfig at', configUrl);
                somethingFinishedLoading();
            }
        };
        http.open('GET', configUrl, true);
        http.send();
    }
});
