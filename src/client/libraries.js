/*globals define*/
/*eslint-env browser*/

/**
 * @author kecso / https://github.com/kecso
 */
define(['common/Constants'], function (CONSTANTS) {
    'use strict';
    function gmeLibraries(logger, state, storage, saveRoot) {

        function getLibraryNames() {
            if (state.core && state.nodes[CONSTANTS.PROJECT_ROOT_ID] &&
                typeof state.nodes[CONSTANTS.PROJECT_ROOT_ID].node === 'object') {
                return state.core.getLibraryNames(state.nodes[CONSTANTS.PROJECT_ROOT_ID].node);
            }

            return [];
        }

        function getLibraryInfo(libraryName) {
            if (state.core && state.nodes[CONSTANTS.PROJECT_ROOT_ID] &&
                typeof state.nodes[CONSTANTS.PROJECT_ROOT_ID].node === 'object') {
                return state.core.getLibraryInfo(state.nodes[CONSTANTS.PROJECT_ROOT_ID].node, libraryName) || null;
            }

            return null;
        }

        function removeLibrary(libraryName) {
            state.core.removeLibrary(state.nodes[CONSTANTS.PROJECT_ROOT_ID].node, libraryName);
            saveRoot('removeLibrary(' + libraryName + ')');
        }

        function renameLibrary(oldName, newName) {
            state.core.renameLibrary(state.nodes[CONSTANTS.PROJECT_ROOT_ID].node, oldName, newName);
            saveRoot('renameLibrary(' + oldName + ',' + newName + ')');
        }

        function openLibraryOriginInNewWindow(libraryRootId, followBranch) {
            // FIXME: This does not belong here (the client knows nothing about the URL serialization..
            //eslint-disable-next-line no-console
            console.warn('client.openLibraryOriginInNewWindow is deprecated use ' +
                'src/client/Utils/LibraryManager.js instead.');
            var address,
                info;
            if (!state.nodes[libraryRootId]) {
                logger.warn('only cached libraries can be followed!');
                return;
            }
            info = getLibraryInfo(state.core.getFullyQualifiedName(state.nodes[libraryRootId].node));

            if (!info) {
                logger.warn('the library has no valid info');
                return;
            }

            if (!info.projectId) {
                logger.warn('the library has only partial info');
                return;
            }

            address = window.location.origin + '/?project=' + encodeURIComponent(info.projectId);

            if (info.branchName && followBranch) {
                address += '&branch=' + encodeURIComponent(info.branchName);
            } else if (info.commitHash) {
                address += '&commit=' + encodeURIComponent(info.commitHash);
            }

            window.open(address, '_blank');
            window.focus();

        }

        return {
            getLibraryNames: getLibraryNames,
            removeLibrary: removeLibrary,
            renameLibrary: renameLibrary,
            getLibraryInfo: getLibraryInfo,
            openLibraryOriginInNewWindow: openLibraryOriginInNewWindow
        };
    }

    return gmeLibraries;
});