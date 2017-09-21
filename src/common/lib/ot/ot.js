(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ot = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// translation of https://github.com/djspiewak/cccp/blob/master/agent/src/main/scala/com/codecommit/cccp/agent/state.scala

'use strict';

// Client constructor
function Client(revision) {
    this.revision = revision; // the next expected revision number
    this.state = synchronized_; // start state
}

Client.prototype.setState = function (state) {
    this.state = state;
    this.state.logState(this);
};

// Call this method when the user changes the document.
Client.prototype.applyClient = function (operation) {
    this.setState(this.state.applyClient(this, operation));
};

// Call this method with a new operation from the server
Client.prototype.applyServer = function (operation) {
    this.revision++;
    this.setState(this.state.applyServer(this, operation));
};

Client.prototype.serverAck = function () {
    this.revision++;
    this.setState(this.state.serverAck(this));
};

Client.prototype.serverReconnect = function () {
    if (typeof this.state.resend === 'function') {
        this.state.resend(this);
    }
};

// Transforms a selection from the latest known server state to the current
// client state. For example, if we get from the server the information that
// another user's cursor is at position 3, but the server hasn't yet received
// our newest operation, an insertion of 5 characters at the beginning of the
// document, the correct position of the other user's cursor in our current
// document is 8.
Client.prototype.transformSelection = function (selection) {
    return this.state.transformSelection(selection);
};

// Override this method.
Client.prototype.sendOperation = function (revision, operation) {
    throw new Error("sendOperation must be defined in child class");
};

// Override this method.
Client.prototype.applyOperation = function (operation) {
    throw new Error("applyOperation must be defined in child class");
};


// In the 'Synchronized' state, there is no pending operation that the client
// has sent to the server.
function Synchronized() {
}
Client.Synchronized = Synchronized;

Synchronized.prototype.applyClient = function (client, operation) {
    // When the user makes an edit, send the operation to the server and
    // switch to the 'AwaitingConfirm' state
    client.sendOperation(client.revision, operation);
    return new AwaitingConfirm(operation);
};

Synchronized.prototype.applyServer = function (client, operation) {
    // When we receive a new operation from the server, the operation can be
    // simply applied to the current document
    client.applyOperation(operation);
    return this;
};

Synchronized.prototype.serverAck = function (client) {
    throw new Error("There is no pending operation.");
};

// Nothing to do because the latest server state and client state are the same.
Synchronized.prototype.transformSelection = function (x) {
    return x;
};

Synchronized.prototype.logState = function (client) {
    console.log('Synchronized at revision', client.revision);
};

// Singleton
var synchronized_ = new Synchronized();


// In the 'AwaitingConfirm' state, there's one operation the client has sent
// to the server and is still waiting for an acknowledgement.
function AwaitingConfirm(outstanding) {
    // Save the pending operation
    this.outstanding = outstanding;
}
Client.AwaitingConfirm = AwaitingConfirm;

AwaitingConfirm.prototype.applyClient = function (client, operation) {
    // When the user makes an edit, don't send the operation immediately,
    // instead switch to 'AwaitingWithBuffer' state
    return new AwaitingWithBuffer(this.outstanding, operation);
};

AwaitingConfirm.prototype.applyServer = function (client, operation) {
    // This is another client's operation. Visualization:
    //
    //                   /\
    // this.outstanding /  \ operation
    //                 /    \
    //                 \    /
    //  pair[1]         \  / pair[0] (new outstanding)
    //  (can be applied  \/
    //  to the client's
    //  current document)
    var pair = operation.constructor.transform(this.outstanding, operation);
    client.applyOperation(pair[1]);
    return new AwaitingConfirm(pair[0]);
};

AwaitingConfirm.prototype.serverAck = function (client) {
    // The client's operation has been acknowledged
    // => switch to synchronized state
    return synchronized_;
};

AwaitingConfirm.prototype.transformSelection = function (selection) {
    return selection.transform(this.outstanding);
};

AwaitingConfirm.prototype.resend = function (client) {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding operation.
    client.sendOperation(client.revision, this.outstanding);
};

AwaitingConfirm.prototype.logState = function (client) {
    console.log('AwaitingConfirm at revision', client.revision, '\noperation:', this.outstanding);
};


// In the 'AwaitingWithBuffer' state, the client is waiting for an operation
// to be acknowledged by the server while buffering the edits the user makes
function AwaitingWithBuffer(outstanding, buffer) {
    // Save the pending operation and the user's edits since then
    this.outstanding = outstanding;
    this.buffer = buffer;
}
Client.AwaitingWithBuffer = AwaitingWithBuffer;

AwaitingWithBuffer.prototype.applyClient = function (client, operation) {
    // Compose the user's changes onto the buffer
    var newBuffer = this.buffer.compose(operation);
    return new AwaitingWithBuffer(this.outstanding, newBuffer);
};

AwaitingWithBuffer.prototype.applyServer = function (client, operation) {
    // Operation comes from another client
    //
    //                       /\
    //     this.outstanding /  \ operation
    //                     /    \
    //                    /\    /
    //       this.buffer /  \* / pair1[0] (new outstanding)
    //                  /    \/
    //                  \    /
    //          pair2[1] \  / pair2[0] (new buffer)
    // the transformed    \/
    // operation -- can
    // be applied to the
    // client's current
    // document
    //
    // * pair1[1]
    var transform = operation.constructor.transform;
    var pair1 = transform(this.outstanding, operation);
    var pair2 = transform(this.buffer, pair1[1]);
    client.applyOperation(pair2[1]);
    return new AwaitingWithBuffer(pair1[0], pair2[0]);
};

AwaitingWithBuffer.prototype.serverAck = function (client) {
    // The pending operation has been acknowledged
    // => send buffer
    client.sendOperation(client.revision, this.buffer);
    return new AwaitingConfirm(this.buffer);
};

AwaitingWithBuffer.prototype.transformSelection = function (selection) {
    return selection.transform(this.outstanding).transform(this.buffer);
};

AwaitingWithBuffer.prototype.resend = function (client) {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding operation.
    client.sendOperation(client.revision, this.outstanding);
};

AwaitingWithBuffer.prototype.logState = function (client) {
    console.log('AwaitingWithBuffer at revision', client.revision, '\noperation:', this.outstanding);
};


module.exports = Client;


},{}],2:[function(require,module,exports){
var TextOperation = require('./text-operation'),
    Selection = require('./selection'),
    added,
    styleSheet;

function CodeMirrorAdapter(cm) {
    this.cm = cm;
    this.ignoreNextChange = false;
    this.changeInProgress = false;
    this.selectionChanged = false;

    bind(this, 'onChanges');
    bind(this, 'onChange');
    bind(this, 'onCursorActivity');
    bind(this, 'onFocus');
    bind(this, 'onBlur');

    cm.on('changes', this.onChanges);
    cm.on('change', this.onChange);
    cm.on('cursorActivity', this.onCursorActivity);
    cm.on('focus', this.onFocus);
    cm.on('blur', this.onBlur);
}

// Removes all event listeners from the CodeMirror instance.
CodeMirrorAdapter.prototype.detach = function () {
    this.cm.off('changes', this.onChanges);
    this.cm.off('change', this.onChange);
    this.cm.off('cursorActivity', this.onCursorActivity);
    this.cm.off('focus', this.onFocus);
    this.cm.off('blur', this.onBlur);
};

function cmpPos(a, b) {
    if (a.line < b.line) {
        return -1;
    }
    if (a.line > b.line) {
        return 1;
    }
    if (a.ch < b.ch) {
        return -1;
    }
    if (a.ch > b.ch) {
        return 1;
    }
    return 0;
}
function posEq(a, b) {
    return cmpPos(a, b) === 0;
}
function posLe(a, b) {
    return cmpPos(a, b) <= 0;
}

function minPos(a, b) {
    return posLe(a, b) ? a : b;
}
function maxPos(a, b) {
    return posLe(a, b) ? b : a;
}

function codemirrorDocLength(doc) {
    return doc.indexFromPos({line: doc.lastLine(), ch: 0}) +
        doc.getLine(doc.lastLine()).length;
}

// Converts a CodeMirror change array (as obtained from the 'changes' event
// in CodeMirror v4) or single change or linked list of changes (as returned
// by the 'change' event in CodeMirror prior to version 4) into a
// TextOperation and its inverse and returns them as a two-element array.
CodeMirrorAdapter.operationFromCodeMirrorChanges = function (changes, doc) {
    // Approach: Replay the changes, beginning with the most recent one, and
    // construct the operation and its inverse. We have to convert the position
    // in the pre-change coordinate system to an index. We have a method to
    // convert a position in the coordinate system after all changes to an index,
    // namely CodeMirror's `indexFromPos` method. We can use the information of
    // a single change object to convert a post-change coordinate system to a
    // pre-change coordinate system. We can now proceed inductively to get a
    // pre-change coordinate system for all changes in the linked list.
    // A disadvantage of this approach is its complexity `O(n^2)` in the length
    // of the linked list of changes.

    var docEndLength = codemirrorDocLength(doc);
    var operation = new TextOperation().retain(docEndLength);
    var inverse = new TextOperation().retain(docEndLength);

    var indexFromPos = function (pos) {
        return doc.indexFromPos(pos);
    };

    function last(arr) {
        return arr[arr.length - 1];
    }

    function sumLengths(strArr) {
        if (strArr.length === 0) {
            return 0;
        }
        var sum = 0;
        for (var i = 0; i < strArr.length; i++) {
            sum += strArr[i].length;
        }
        return sum + strArr.length - 1;
    }

    function updateIndexFromPos(indexFromPos, change) {
        return function (pos) {
            if (posLe(pos, change.from)) {
                return indexFromPos(pos);
            }
            if (posLe(change.to, pos)) {
                return indexFromPos({
                        line: pos.line + change.text.length - 1 - (change.to.line - change.from.line),
                        ch: (change.to.line < pos.line) ?
                            pos.ch :
                            (change.text.length <= 1) ?
                            pos.ch - (change.to.ch - change.from.ch) + sumLengths(change.text) :
                            pos.ch - change.to.ch + last(change.text).length
                    }) + sumLengths(change.removed) - sumLengths(change.text);
            }
            if (change.from.line === pos.line) {
                return indexFromPos(change.from) + pos.ch - change.from.ch;
            }
            return indexFromPos(change.from) +
                sumLengths(change.removed.slice(0, pos.line - change.from.line)) +
                1 + pos.ch;
        };
    }

    for (var i = changes.length - 1; i >= 0; i--) {
        var change = changes[i];
        indexFromPos = updateIndexFromPos(indexFromPos, change);

        var fromIndex = indexFromPos(change.from);
        var restLength = docEndLength - fromIndex - sumLengths(change.text);

        operation = new TextOperation()
            .retain(fromIndex)
            ['delete'](sumLengths(change.removed))
            .insert(change.text.join('\n'))
            .retain(restLength)
            .compose(operation);

        inverse = inverse.compose(new TextOperation()
            .retain(fromIndex)
            ['delete'](sumLengths(change.text))
            .insert(change.removed.join('\n'))
            .retain(restLength)
        );

        docEndLength += sumLengths(change.removed) - sumLengths(change.text);
    }

    return [operation, inverse];
};

// Singular form for backwards compatibility.
CodeMirrorAdapter.operationFromCodeMirrorChange =
    CodeMirrorAdapter.operationFromCodeMirrorChanges;

// Apply an operation to a CodeMirror instance.
CodeMirrorAdapter.applyOperationToCodeMirror = function (operation, cm) {
    cm.operation(function () {
        var ops = operation.ops;
        var index = 0; // holds the current index into CodeMirror's content
        for (var i = 0, l = ops.length; i < l; i++) {
            var op = ops[i];
            if (TextOperation.isRetain(op)) {
                index += op;
            } else if (TextOperation.isInsert(op)) {
                cm.replaceRange(op, cm.posFromIndex(index));
                index += op.length;
            } else if (TextOperation.isDelete(op)) {
                var from = cm.posFromIndex(index);
                var to = cm.posFromIndex(index - op);
                cm.replaceRange('', from, to);
            }
        }
    });
};

CodeMirrorAdapter.prototype.registerCallbacks = function (cb) {
    this.callbacks = cb;
};

CodeMirrorAdapter.prototype.onChange = function () {
    // By default, CodeMirror's event order is the following:
    // 1. 'change', 2. 'cursorActivity', 3. 'changes'.
    // We want to fire the 'selectionChange' event after the 'change' event,
    // but need the information from the 'changes' event. Therefore, we detect
    // when a change is in progress by listening to the change event, setting
    // a flag that makes this adapter defer all 'cursorActivity' events.
    this.changeInProgress = true;
};

CodeMirrorAdapter.prototype.onChanges = function (_, changes) {
    if (!this.ignoreNextChange) {
        var pair = CodeMirrorAdapter.operationFromCodeMirrorChanges(changes, this.cm);
        this.trigger('change', pair[0], pair[1]);
    }
    if (this.selectionChanged) {
        this.trigger('selectionChange');
    }
    this.changeInProgress = false;
    this.ignoreNextChange = false;
};

CodeMirrorAdapter.prototype.onCursorActivity =
    CodeMirrorAdapter.prototype.onFocus = function () {
        if (this.changeInProgress) {
            this.selectionChanged = true;
        } else {
            this.trigger('selectionChange');
        }
    };

CodeMirrorAdapter.prototype.onBlur = function () {
    if (!this.cm.somethingSelected()) {
        this.trigger('blur');
    }
};

CodeMirrorAdapter.prototype.getValue = function () {
    return this.cm.getValue();
};

CodeMirrorAdapter.prototype.getSelection = function () {
    var cm = this.cm;

    var selectionList = cm.listSelections();
    var ranges = [];
    for (var i = 0; i < selectionList.length; i++) {
        ranges[i] = new Selection.Range(
            cm.indexFromPos(selectionList[i].anchor),
            cm.indexFromPos(selectionList[i].head)
        );
    }

    return new Selection(ranges);
};

CodeMirrorAdapter.prototype.setSelection = function (selection) {
    var ranges = [];
    for (var i = 0; i < selection.ranges.length; i++) {
        var range = selection.ranges[i];
        ranges[i] = {
            anchor: this.cm.posFromIndex(range.anchor),
            head: this.cm.posFromIndex(range.head)
        };
    }
    this.cm.setSelections(ranges);
};

CodeMirrorAdapter.addStyleRule = function (css) {
    var styleElement;

    if (!added) {
        added = {};
        styleElement = document.createElement('style');
        document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement);
        styleSheet = styleElement.sheet;
    }

    if (!added[css]) {
        added[css] = true;
        styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length);
    }
};

CodeMirrorAdapter.prototype.setOtherCursor = function (position, color, clientId) {
    var cursorPos = this.cm.posFromIndex(position);
    //var cursorCoords = this.cm.cursorCoords(cursorPos);
    var cursorEl = document.createElement('span');
    cursorEl.title = clientId;
    cursorEl.className = 'other-client';
    cursorEl.style.display = 'inline-block';
    cursorEl.style.padding = '0';
    cursorEl.style.marginLeft = cursorEl.style.marginRight = '-1px';
    cursorEl.style.borderLeftWidth = '2px';
    cursorEl.style.borderLeftStyle = 'solid';
    cursorEl.style.borderLeftColor = color;
    cursorEl.style.height = 16 + 'px';
    cursorEl.style['margin-bottom'] = -4 + 'px';
    cursorEl.style.zIndex = 0;
    cursorEl.setAttribute('data-clientid', clientId);
    return this.cm.setBookmark(cursorPos, {widget: cursorEl, insertLeft: true});
};

CodeMirrorAdapter.prototype.setOtherSelectionRange = function (range, color, clientId) {
    var match = /^#([0-9a-fA-F]{6})$/.exec(color);
    if (!match) {
        throw new Error("only six-digit hex colors are allowed.");
    }
    var selectionClassName = 'selection-' + match[1];
    var rule = '.' + selectionClassName + ' { background: ' + color + '; }';

    CodeMirrorAdapter.addStyleRule(rule);

    var anchorPos = this.cm.posFromIndex(range.anchor);
    var headPos = this.cm.posFromIndex(range.head);

    return this.cm.markText(
        minPos(anchorPos, headPos),
        maxPos(anchorPos, headPos),
        {className: selectionClassName}
    );
};

CodeMirrorAdapter.prototype.setOtherSelection = function (selection, color, clientId) {
    var selectionObjects = [];
    for (var i = 0; i < selection.ranges.length; i++) {
        var range = selection.ranges[i];
        if (range.isEmpty()) {
            selectionObjects[i] = this.setOtherCursor(range.head, color, clientId);
        } else {
            selectionObjects[i] = this.setOtherSelectionRange(range, color, clientId);
        }
    }
    return {
        clear: function () {
            for (var i = 0; i < selectionObjects.length; i++) {
                selectionObjects[i].clear();
            }
        }
    };
};

CodeMirrorAdapter.prototype.trigger = function (event) {
    var args = Array.prototype.slice.call(arguments, 1);
    var action = this.callbacks && this.callbacks[event];
    if (action) {
        action.apply(this, args);
    }
};

CodeMirrorAdapter.prototype.applyOperation = function (operation) {
    this.ignoreNextChange = true;
    CodeMirrorAdapter.applyOperationToCodeMirror(operation, this.cm);
};

CodeMirrorAdapter.prototype.registerUndo = function (undoFn) {
    this.cm.undo = undoFn;
};

CodeMirrorAdapter.prototype.registerRedo = function (redoFn) {
    this.cm.redo = redoFn;
};

// Throws an error if the first argument is falsy. Useful for debugging.
function assert(b, msg) {
    if (!b) {
        throw new Error(msg || "assertion error");
    }
}

// Bind a method to an object, so it doesn't matter whether you call
// object.method() directly or pass object.method as a reference to another
// function.
function bind(obj, method) {
    var fn = obj[method];
    obj[method] = function () {
        fn.apply(obj, arguments);
    };
}

module.exports = CodeMirrorAdapter;

},{"./selection":3,"./text-operation":4}],3:[function(require,module,exports){
var TextOperation = require('./text-operation');

// Range has `anchor` and `head` properties, which are zero-based indices into
// the document. The `anchor` is the side of the selection that stays fixed,
// `head` is the side of the selection where the cursor is. When both are
// equal, the range represents a cursor.
function Range(anchor, head) {
    this.anchor = anchor;
    this.head = head;
}

Range.fromJSON = function (obj) {
    return new Range(obj.anchor, obj.head);
};

Range.prototype.equals = function (other) {
    return this.anchor === other.anchor && this.head === other.head;
};

Range.prototype.isEmpty = function () {
    return this.anchor === this.head;
};

Range.prototype.transform = function (other) {
    function transformIndex(index) {
        var newIndex = index;
        var ops = other.ops;
        for (var i = 0, l = other.ops.length; i < l; i++) {
            if (TextOperation.isRetain(ops[i])) {
                index -= ops[i];
            } else if (TextOperation.isInsert(ops[i])) {
                newIndex += ops[i].length;
            } else {
                newIndex -= Math.min(index, -ops[i]);
                index += ops[i];
            }
            if (index < 0) {
                break;
            }
        }
        return newIndex;
    }

    var newAnchor = transformIndex(this.anchor);
    if (this.anchor === this.head) {
        return new Range(newAnchor, newAnchor);
    }
    return new Range(newAnchor, transformIndex(this.head));
};

// A selection is basically an array of ranges. Every range represents a real
// selection or a cursor in the document (when the start position equals the
// end position of the range). The array must not be empty.
function Selection(ranges) {
    this.ranges = ranges || [];
}

Selection.Range = Range;

// Convenience method for creating selections only containing a single cursor
// and no real selection range.
Selection.createCursor = function (position) {
    return new Selection([new Range(position, position)]);
};

Selection.fromJSON = function (obj) {
    var objRanges = obj.ranges || obj;
    for (var i = 0, ranges = []; i < objRanges.length; i++) {
        ranges[i] = Range.fromJSON(objRanges[i]);
    }
    return new Selection(ranges);
};

Selection.prototype.equals = function (other) {
    if (this.position !== other.position) {
        return false;
    }
    if (this.ranges.length !== other.ranges.length) {
        return false;
    }
    // FIXME: Sort ranges before comparing them?
    for (var i = 0; i < this.ranges.length; i++) {
        if (!this.ranges[i].equals(other.ranges[i])) {
            return false;
        }
    }
    return true;
};

Selection.prototype.somethingSelected = function () {
    for (var i = 0; i < this.ranges.length; i++) {
        if (!this.ranges[i].isEmpty()) {
            return true;
        }
    }
    return false;
};

// Return the more current selection information.
Selection.prototype.compose = function (other) {
    return other;
};

// Update the selection with respect to an operation.
Selection.prototype.transform = function (other) {
    for (var i = 0, newRanges = []; i < this.ranges.length; i++) {
        newRanges[i] = this.ranges[i].transform(other);
    }
    return new Selection(newRanges);
};


module.exports = Selection;

},{"./text-operation":4}],4:[function(require,module,exports){
if (typeof ot === 'undefined') {
  // Export for browsers
  var ot = {};
}

ot.TextOperation = (function () {
  'use strict';

  // Constructor for new operations.
  function TextOperation () {
    if (!this || this.constructor !== TextOperation) {
      // => function was called without 'new'
      return new TextOperation();
    }

    // When an operation is applied to an input string, you can think of this as
    // if an imaginary cursor runs over the entire string and skips over some
    // parts, deletes some parts and inserts characters at some positions. These
    // actions (skip/delete/insert) are stored as an array in the "ops" property.
    this.ops = [];
    // An operation's baseLength is the length of every string the operation
    // can be applied to.
    this.baseLength = 0;
    // The targetLength is the length of every string that results from applying
    // the operation on a valid input string.
    this.targetLength = 0;
  }

  TextOperation.prototype.equals = function (other) {
    if (this.baseLength !== other.baseLength) { return false; }
    if (this.targetLength !== other.targetLength) { return false; }
    if (this.ops.length !== other.ops.length) { return false; }
    for (var i = 0; i < this.ops.length; i++) {
      if (this.ops[i] !== other.ops[i]) { return false; }
    }
    return true;
  };

  // Operation are essentially lists of ops. There are three types of ops:
  //
  // * Retain ops: Advance the cursor position by a given number of characters.
  //   Represented by positive ints.
  // * Insert ops: Insert a given string at the current cursor position.
  //   Represented by strings.
  // * Delete ops: Delete the next n characters. Represented by negative ints.

  var isRetain = TextOperation.isRetain = function (op) {
    return typeof op === 'number' && op > 0;
  };

  var isInsert = TextOperation.isInsert = function (op) {
    return typeof op === 'string';
  };

  var isDelete = TextOperation.isDelete = function (op) {
    return typeof op === 'number' && op < 0;
  };


  // After an operation is constructed, the user of the library can specify the
  // actions of an operation (skip/insert/delete) with these three builder
  // methods. They all return the operation for convenient chaining.

  // Skip over a given number of characters.
  TextOperation.prototype.retain = function (n) {
    if (typeof n !== 'number') {
      throw new Error("retain expects an integer");
    }
    if (n === 0) { return this; }
    this.baseLength += n;
    this.targetLength += n;
    if (isRetain(this.ops[this.ops.length-1])) {
      // The last op is a retain op => we can merge them into one op.
      this.ops[this.ops.length-1] += n;
    } else {
      // Create a new op.
      this.ops.push(n);
    }
    return this;
  };

  // Insert a string at the current position.
  TextOperation.prototype.insert = function (str) {
    if (typeof str !== 'string') {
      throw new Error("insert expects a string");
    }
    if (str === '') { return this; }
    this.targetLength += str.length;
    var ops = this.ops;
    if (isInsert(ops[ops.length-1])) {
      // Merge insert op.
      ops[ops.length-1] += str;
    } else if (isDelete(ops[ops.length-1])) {
      // It doesn't matter when an operation is applied whether the operation
      // is delete(3), insert("something") or insert("something"), delete(3).
      // Here we enforce that in this case, the insert op always comes first.
      // This makes all operations that have the same effect when applied to
      // a document of the right length equal in respect to the `equals` method.
      if (isInsert(ops[ops.length-2])) {
        ops[ops.length-2] += str;
      } else {
        ops[ops.length] = ops[ops.length-1];
        ops[ops.length-2] = str;
      }
    } else {
      ops.push(str);
    }
    return this;
  };

  // Delete a string at the current position.
  TextOperation.prototype['delete'] = function (n) {
    if (typeof n === 'string') { n = n.length; }
    if (typeof n !== 'number') {
      throw new Error("delete expects an integer or a string");
    }
    if (n === 0) { return this; }
    if (n > 0) { n = -n; }
    this.baseLength -= n;
    if (isDelete(this.ops[this.ops.length-1])) {
      this.ops[this.ops.length-1] += n;
    } else {
      this.ops.push(n);
    }
    return this;
  };

  // Tests whether this operation has no effect.
  TextOperation.prototype.isNoop = function () {
    return this.ops.length === 0 || (this.ops.length === 1 && isRetain(this.ops[0]));
  };

  // Pretty printing.
  TextOperation.prototype.toString = function () {
    // map: build a new array by applying a function to every element in an old
    // array.
    var map = Array.prototype.map || function (fn) {
      var arr = this;
      var newArr = [];
      for (var i = 0, l = arr.length; i < l; i++) {
        newArr[i] = fn(arr[i]);
      }
      return newArr;
    };
    return map.call(this.ops, function (op) {
      if (isRetain(op)) {
        return "retain " + op;
      } else if (isInsert(op)) {
        return "insert '" + op + "'";
      } else {
        return "delete " + (-op);
      }
    }).join(', ');
  };

  // Converts operation into a JSON value.
  TextOperation.prototype.toJSON = function () {
    return this.ops;
  };

  // Converts a plain JS object into an operation and validates it.
  TextOperation.fromJSON = function (ops) {
    var o = new TextOperation();
    for (var i = 0, l = ops.length; i < l; i++) {
      var op = ops[i];
      if (isRetain(op)) {
        o.retain(op);
      } else if (isInsert(op)) {
        o.insert(op);
      } else if (isDelete(op)) {
        o['delete'](op);
      } else {
        throw new Error("unknown operation: " + JSON.stringify(op));
      }
    }
    return o;
  };

  // Apply an operation to a string, returning a new string. Throws an error if
  // there's a mismatch between the input string and the operation.
  TextOperation.prototype.apply = function (str) {
    var operation = this;
    if (str.length !== operation.baseLength) {
      throw new Error("The operation's base length must be equal to the string's length.");
    }
    var newStr = [], j = 0;
    var strIndex = 0;
    var ops = this.ops;
    for (var i = 0, l = ops.length; i < l; i++) {
      var op = ops[i];
      if (isRetain(op)) {
        if (strIndex + op > str.length) {
          throw new Error("Operation can't retain more characters than are left in the string.");
        }
        // Copy skipped part of the old string.
        newStr[j++] = str.slice(strIndex, strIndex + op);
        strIndex += op;
      } else if (isInsert(op)) {
        // Insert string.
        newStr[j++] = op;
      } else { // delete op
        strIndex -= op;
      }
    }
    if (strIndex !== str.length) {
      throw new Error("The operation didn't operate on the whole string.");
    }
    return newStr.join('');
  };

  // Computes the inverse of an operation. The inverse of an operation is the
  // operation that reverts the effects of the operation, e.g. when you have an
  // operation 'insert("hello "); skip(6);' then the inverse is 'delete("hello ");
  // skip(6);'. The inverse should be used for implementing undo.
  TextOperation.prototype.invert = function (str) {
    var strIndex = 0;
    var inverse = new TextOperation();
    var ops = this.ops;
    for (var i = 0, l = ops.length; i < l; i++) {
      var op = ops[i];
      if (isRetain(op)) {
        inverse.retain(op);
        strIndex += op;
      } else if (isInsert(op)) {
        inverse['delete'](op.length);
      } else { // delete op
        inverse.insert(str.slice(strIndex, strIndex - op));
        strIndex -= op;
      }
    }
    return inverse;
  };

  // Compose merges two consecutive operations into one operation, that
  // preserves the changes of both. Or, in other words, for each input string S
  // and a pair of consecutive operations A and B,
  // apply(apply(S, A), B) = apply(S, compose(A, B)) must hold.
  TextOperation.prototype.compose = function (operation2) {
    var operation1 = this;
    if (operation1.targetLength !== operation2.baseLength) {
      throw new Error("The base length of the second operation has to be the target length of the first operation");
    }

    var operation = new TextOperation(); // the combined operation
    var ops1 = operation1.ops, ops2 = operation2.ops; // for fast access
    var i1 = 0, i2 = 0; // current index into ops1 respectively ops2
    var op1 = ops1[i1++], op2 = ops2[i2++]; // current ops
    while (true) {
      // Dispatch on the type of op1 and op2
      if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
        // end condition: both ops1 and ops2 have been processed
        break;
      }

      if (isDelete(op1)) {
        operation['delete'](op1);
        op1 = ops1[i1++];
        continue;
      }
      if (isInsert(op2)) {
        operation.insert(op2);
        op2 = ops2[i2++];
        continue;
      }

      if (typeof op1 === 'undefined') {
        throw new Error("Cannot compose operations: first operation is too short.");
      }
      if (typeof op2 === 'undefined') {
        throw new Error("Cannot compose operations: first operation is too long.");
      }

      if (isRetain(op1) && isRetain(op2)) {
        if (op1 > op2) {
          operation.retain(op2);
          op1 = op1 - op2;
          op2 = ops2[i2++];
        } else if (op1 === op2) {
          operation.retain(op1);
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          operation.retain(op1);
          op2 = op2 - op1;
          op1 = ops1[i1++];
        }
      } else if (isInsert(op1) && isDelete(op2)) {
        if (op1.length > -op2) {
          op1 = op1.slice(-op2);
          op2 = ops2[i2++];
        } else if (op1.length === -op2) {
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          op2 = op2 + op1.length;
          op1 = ops1[i1++];
        }
      } else if (isInsert(op1) && isRetain(op2)) {
        if (op1.length > op2) {
          operation.insert(op1.slice(0, op2));
          op1 = op1.slice(op2);
          op2 = ops2[i2++];
        } else if (op1.length === op2) {
          operation.insert(op1);
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          operation.insert(op1);
          op2 = op2 - op1.length;
          op1 = ops1[i1++];
        }
      } else if (isRetain(op1) && isDelete(op2)) {
        if (op1 > -op2) {
          operation['delete'](op2);
          op1 = op1 + op2;
          op2 = ops2[i2++];
        } else if (op1 === -op2) {
          operation['delete'](op2);
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          operation['delete'](op1);
          op2 = op2 + op1;
          op1 = ops1[i1++];
        }
      } else {
        throw new Error(
          "This shouldn't happen: op1: " +
          JSON.stringify(op1) + ", op2: " +
          JSON.stringify(op2)
        );
      }
    }
    return operation;
  };

  function getSimpleOp (operation, fn) {
    var ops = operation.ops;
    var isRetain = TextOperation.isRetain;
    switch (ops.length) {
    case 1:
      return ops[0];
    case 2:
      return isRetain(ops[0]) ? ops[1] : (isRetain(ops[1]) ? ops[0] : null);
    case 3:
      if (isRetain(ops[0]) && isRetain(ops[2])) { return ops[1]; }
    }
    return null;
  }

  function getStartIndex (operation) {
    if (isRetain(operation.ops[0])) { return operation.ops[0]; }
    return 0;
  }

  // When you use ctrl-z to undo your latest changes, you expect the program not
  // to undo every single keystroke but to undo your last sentence you wrote at
  // a stretch or the deletion you did by holding the backspace key down. This
  // This can be implemented by composing operations on the undo stack. This
  // method can help decide whether two operations should be composed. It
  // returns true if the operations are consecutive insert operations or both
  // operations delete text at the same position. You may want to include other
  // factors like the time since the last change in your decision.
  TextOperation.prototype.shouldBeComposedWith = function (other) {
    if (this.isNoop() || other.isNoop()) { return true; }

    var startA = getStartIndex(this), startB = getStartIndex(other);
    var simpleA = getSimpleOp(this), simpleB = getSimpleOp(other);
    if (!simpleA || !simpleB) { return false; }

    if (isInsert(simpleA) && isInsert(simpleB)) {
      return startA + simpleA.length === startB;
    }

    if (isDelete(simpleA) && isDelete(simpleB)) {
      // there are two possibilities to delete: with backspace and with the
      // delete key.
      return (startB - simpleB === startA) || startA === startB;
    }

    return false;
  };

  // Decides whether two operations should be composed with each other
  // if they were inverted, that is
  // `shouldBeComposedWith(a, b) = shouldBeComposedWithInverted(b^{-1}, a^{-1})`.
  TextOperation.prototype.shouldBeComposedWithInverted = function (other) {
    if (this.isNoop() || other.isNoop()) { return true; }

    var startA = getStartIndex(this), startB = getStartIndex(other);
    var simpleA = getSimpleOp(this), simpleB = getSimpleOp(other);
    if (!simpleA || !simpleB) { return false; }

    if (isInsert(simpleA) && isInsert(simpleB)) {
      return startA + simpleA.length === startB || startA === startB;
    }

    if (isDelete(simpleA) && isDelete(simpleB)) {
      return startB - simpleB === startA;
    }

    return false;
  };

  // Transform takes two operations A and B that happened concurrently and
  // produces two operations A' and B' (in an array) such that
  // `apply(apply(S, A), B') = apply(apply(S, B), A')`. This function is the
  // heart of OT.
  TextOperation.transform = function (operation1, operation2) {
    if (operation1.baseLength !== operation2.baseLength) {
      throw new Error("Both operations have to have the same base length");
    }

    var operation1prime = new TextOperation();
    var operation2prime = new TextOperation();
    var ops1 = operation1.ops, ops2 = operation2.ops;
    var i1 = 0, i2 = 0;
    var op1 = ops1[i1++], op2 = ops2[i2++];
    while (true) {
      // At every iteration of the loop, the imaginary cursor that both
      // operation1 and operation2 have that operates on the input string must
      // have the same position in the input string.

      if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
        // end condition: both ops1 and ops2 have been processed
        break;
      }

      // next two cases: one or both ops are insert ops
      // => insert the string in the corresponding prime operation, skip it in
      // the other one. If both op1 and op2 are insert ops, prefer op1.
      if (isInsert(op1)) {
        operation1prime.insert(op1);
        operation2prime.retain(op1.length);
        op1 = ops1[i1++];
        continue;
      }
      if (isInsert(op2)) {
        operation1prime.retain(op2.length);
        operation2prime.insert(op2);
        op2 = ops2[i2++];
        continue;
      }

      if (typeof op1 === 'undefined') {
        throw new Error("Cannot compose operations: first operation is too short.");
      }
      if (typeof op2 === 'undefined') {
        throw new Error("Cannot compose operations: first operation is too long.");
      }

      var minl;
      if (isRetain(op1) && isRetain(op2)) {
        // Simple case: retain/retain
        if (op1 > op2) {
          minl = op2;
          op1 = op1 - op2;
          op2 = ops2[i2++];
        } else if (op1 === op2) {
          minl = op2;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minl = op1;
          op2 = op2 - op1;
          op1 = ops1[i1++];
        }
        operation1prime.retain(minl);
        operation2prime.retain(minl);
      } else if (isDelete(op1) && isDelete(op2)) {
        // Both operations delete the same string at the same position. We don't
        // need to produce any operations, we just skip over the delete ops and
        // handle the case that one operation deletes more than the other.
        if (-op1 > -op2) {
          op1 = op1 - op2;
          op2 = ops2[i2++];
        } else if (op1 === op2) {
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          op2 = op2 - op1;
          op1 = ops1[i1++];
        }
      // next two cases: delete/retain and retain/delete
      } else if (isDelete(op1) && isRetain(op2)) {
        if (-op1 > op2) {
          minl = op2;
          op1 = op1 + op2;
          op2 = ops2[i2++];
        } else if (-op1 === op2) {
          minl = op2;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minl = -op1;
          op2 = op2 + op1;
          op1 = ops1[i1++];
        }
        operation1prime['delete'](minl);
      } else if (isRetain(op1) && isDelete(op2)) {
        if (op1 > -op2) {
          minl = -op2;
          op1 = op1 + op2;
          op2 = ops2[i2++];
        } else if (op1 === -op2) {
          minl = op1;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minl = op1;
          op2 = op2 + op1;
          op1 = ops1[i1++];
        }
        operation2prime['delete'](minl);
      } else {
        throw new Error("The two operations aren't compatible");
      }
    }

    return [operation1prime, operation2prime];
  };

  return TextOperation;

}());

// Export for CommonJS
if (typeof module === 'object') {
  module.exports = ot.TextOperation;
}
},{}],5:[function(require,module,exports){
  'use strict';

  // A WrappedOperation contains an operation, selection and metadata.
  function WrappedOperation (operation, selection, metadata) {
    this.wrapped = operation;
    this.selection = selection;
    this.metadata = metadata;
  }

  WrappedOperation.prototype.apply = function () {
    return this.wrapped.apply.apply(this.wrapped, arguments);
  };

  WrappedOperation.prototype.invert = function () {
    var selection = this.selection;
    return new WrappedOperation(
      this.wrapped.invert.apply(this.wrapped, arguments),
      selection && typeof selection === 'object' && typeof selection.invert === 'function' ?
        selection.invert.apply(selection, arguments) : selection
    );
  };

  // Copy all properties from source to target.
  function copy (source, target) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key];
      }
    }
  }

  function composeSelection (a, b) {
    if (a && typeof a === 'object') {
      if (typeof a.compose === 'function') { return a.compose(b); }
      var selection = {};
      copy(a, selection);
      copy(b, selection);
      return selection;
    }
    return b;
  }

  WrappedOperation.prototype.compose = function (other) {
    return new WrappedOperation(
      this.wrapped.compose(other.wrapped),
      composeSelection(this.selection, other.selection)
    );
  };

  function transformSelection (selection, operation) {
    if (selection && typeof selection === 'object') {
      if (typeof selection.transform === 'function') {
        return selection.transform(operation);
      }
    }
    return selection;
  }

  WrappedOperation.transform = function (a, b) {
    var transform = a.wrapped.constructor.transform;
    var pair = transform(a.wrapped, b.wrapped);
    return [
      new WrappedOperation(pair[0], transformSelection(a.selection, b.wrapped)),
      new WrappedOperation(pair[1], transformSelection(b.selection, a.wrapped))
    ];
  };

module.exports = WrappedOperation;
},{}],"ot":[function(require,module,exports){
exports.version = '0.0.15';

exports.TextOperation        = require('./text-operation');
exports.WrappedOperation     = require('./wrapped-operation');
exports.Client               = require('./client');
exports.Selection            = require('./selection');
exports.CodeMirrorAdapter    = require('./codemirror-adapter');

},{"./client":1,"./codemirror-adapter":2,"./selection":3,"./text-operation":4,"./wrapped-operation":5}]},{},[])("ot")
});