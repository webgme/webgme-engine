/*
 * Copyright (C) 2012 Vanderbilt University, All rights reserved.
 * 
 * Author: Miklos Maroti
 */

define([ "assert" ], function (ASSERT) {
	"use strict";

	// ----------------- node -----------------

	var Node = function (parent, relid) {
		ASSERT(parent instanceof Node);
		ASSERT(typeof relid === "string");

		// create non-enumerable  properties
		Object.defineProperties(this, {
			parent: {
				value: parent
			},
			relid: {
				value: relid
			},
			level: {
				value: parent.level + 1
			},
			refcount : {
				value: 0,
				writable: true
			}
		});
	};

	var emptyNodes = [];
	
	var increaseRefcount = function(node) {
		if( ++node.refcount === 1 ) {
			var index = emptyNodes.indexOf(this);
			ASSERT(index >= 0);
			emptyNodes.splice(index, 1);
		}
	};
	
	// create non-enumerable methods
	Object.defineProperties(Node.prototype, {
		/**
		 * The leaf property is true if the node has no children
		 */
		leaf: {
			get: function () {
				var relid;
				for( relid in this ) {
					return false;
				}
				return true;
			}
		},

		/**
		 * The empty property is true if the node has no children
		 * and has no associated data
		 */
		empty: {
			get: function () {
				return this.refcount === 0;
			}
		},
		
		/**
		 * The path property contains the path of this node. This is a slow
		 * method, you should not use it.
		 */
		path: {
			get: function () {
				return this.parent ? this.parent.path + "/" + this.relid : "";
			}
		},

		/**
		 * Returns the child with the given relid. If that child does not exist,
		 * then it is created.
		 */
		child: {
			value: function (relid) {
				ASSERT(typeof relid === "string");

				var node = this[relid];
				ASSERT(node === undefined || node instanceof Node);

				if( !node ) {
					node = new Node(this, relid);

					this[relid] = node;
					increaseRefcount(this);
				}

				return node;
			}
		}
	});

	// ----------------- tree -----------------

	/**
	 * Special root object with no relid
	 */
	var root = Object.create(Node.prototype, {
		parent: {
			value: null
		},
		level: {
			value: 0
		},
		refcount: {
			value: 1,
			writable: true
		}
	});

	var unusedTreeIds = [];
	var treeIdCount = 0;

	var Tree = function () {
		this.id = unusedTreeIds.length !== 0 ? unusedTreeIds.pop() : "#"
		+ treeIdCount++;
	};

	/**
	 * Removes all data associated with this tree and destroys this tree object.
	 */
	Tree.prototype.destroy = function () {
		this.clear();

		unusedTreeIds.push(this.id);
		delete this.id;
	};

	/**
	 * Removes all node data associated with this tree object
	 */
	Tree.prototype.clearAll = function () {
		ASSERT(this.id);
		this.deleteData(root);
	};

	/**
	 * Returns the node at the given path. This is a slow method, you should not
	 * use it.
	 */
	Tree.prototype.getNode = function (path) {
		ASSERT(this.id);
		ASSERT(typeof path === "string");

		var relids = path.split("/");
		ASSERT(relids[0] === "");

		var node = root;
		for( var i = 1; node && i < relids.length; ++i ) {
			node = node.child(relids[i]);
		}

		return node;
	};

	Tree.prototype.hasData = function (node) {
		ASSERT(this.id);
		ASSERT(node instanceof Node);

		return node.hasOwnProperty(this.id);
	};

	/**
	 * Adds an empty data object to this node and its ancestors.
	 */
	var addEmptyData = function (node, id) {
		while( node && !node.hasOwnProperty(id) ) {
			Object.defineProperty(node, id, {
				value: {},
				writable: true,
				configurable: true
			});
			node = node.parent;
		}
	};

	Tree.prototype.setData = function (node, data) {
		ASSERT(this.id);
		ASSERT(node instanceof Node);

		addEmptyData(node, this.id);
		node[this.id] = data;
	};

	Tree.prototype.getData = function (node) {
		ASSERT(this.id);
		ASSERT(node instanceof Node);

		addEmptyData(node, this.id);
		return node[this.id];
	};

	/**
	 * Recursively deletes data associated with this node and all of its
	 * descendants.
	 */
	Tree.prototype.deleteData = function (node) {
		ASSERT(this.id);
		ASSERT(node instanceof Node);

		if( node.hasOwnProperty(this.id) ) {
			delete node[this.id];

			for( var relid in node ) {
				this.deleteData(node[relid]);
			}
		}
	};

	// ----------------- public interface -----------------

	return Tree;
});
