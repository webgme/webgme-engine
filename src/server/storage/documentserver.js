/*globals*/
/*eslint-env node*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var ot = require('webgme-ot'),
    TextOperation = ot.TextOperation,
    WrappedOperation = ot.WrappedOperation,
    Selection = ot.Selection;

function DocumentServer(mainLogger, documentStr, docId, gmeConfig, operations) {
    this.logger = mainLogger.fork('DocumentServer' + docId);
    this.document = documentStr || '';
    this.gmeConfig = gmeConfig;
    this.operations = operations || [];
    this.users = {};
    this.docId = docId;
}

DocumentServer.prototype.getOperationsSince = function (revision) {
    if (revision < 0 || this.operations.length < revision) {
        throw new Error('Operation revision not in history [' + revision + ']');
    }

    return this.operations.slice(revision);
};

DocumentServer.prototype.receiveOperation = function (revision, operation) {
    // Find all operations that the client didn't know of when it sent the
    // operation ...
    var concurrentOperations = this.getOperationsSince(revision);

    // ... and transform the operation against all these operations ...
    var transform = operation.constructor.transform;

    for (var i = 0; i < concurrentOperations.length; i++) {
        operation = transform(operation, concurrentOperations[i])[0];
    }

    // ... and apply that on the document.
    this.document = operation.apply(this.document);
    // Store operation in history.
    this.operations.push(operation);

    // It's the caller's responsibility to send the operation to all connected
    // clients and an acknowledgement to the creator.
    this.logger.debug('New operation [', operation, '] at revision', this.operations.length);

    return operation;
};

DocumentServer.prototype.onOperation = function (data) {
    var wrapped;

    wrapped = new WrappedOperation(
        TextOperation.fromJSON(data.operation),
        data.selection && Selection.fromJSON(data.selection),
        {userId: data.userId, sessionId: data.sessionId, watcherId: data.watcherId});


    return this.receiveOperation(data.revision, wrapped);
};

DocumentServer.prototype.onSelection = function (revision, selection) {
    if (!selection) {
        return;
    }

    if (revision < 0 || this.operations.length < revision) {
        throw new Error('Selection revision not in history [' + revision + ']');
    }

    // Find all operations that the client didn't know of when it sent the selection and transform it against these.
    return this.operations.slice(revision)
        .reduce(function (transformed, wrappedOp) {
            return transformed.transform(wrappedOp.wrapped);
        }, Selection.fromJSON(selection));
};

module.exports = DocumentServer;
