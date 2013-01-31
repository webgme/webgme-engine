"use strict";

define(['logManager',
    'clientUtil',
    'js/DiagramDesigner/NodePropertyNames'], function (logManager,
                                                        util,
                                                        nodePropertyNames) {

    var DesignerControlDesignerCanvasEventHandlers,
        ATTRIBUTES_STRING = "attributes",
        REGISTRY_STRING = "registry",
        GME_ID = "GME_ID",
        CONNECTION_SOURCE_NAME = "source",
        CONNECTION_TARGET_NAME = "target";

    DesignerControlDesignerCanvasEventHandlers = function () {
    };

    DesignerControlDesignerCanvasEventHandlers.prototype.attachDesignerCanvasEventHandlers = function () {
        var self = this;

        /*OVERRIDE DESIGNER CANVAS METHODS*/
        this.designerCanvas.onDesignerItemsMove = function (repositionDesc) {
            self._onDesignerItemsMove(repositionDesc);
        };

        this.designerCanvas.onDesignerItemsCopy = function (copyDesc) {
            self._onDesignerItemsCopy(copyDesc);
        };

        this.designerCanvas.onCreateNewConnection = function (params) {
            self._onCreateNewConnection(params);
        };

        this.designerCanvas.onSelectionDelete = function (idList) {
            self._onSelectionDelete(idList);
        };

        this.designerCanvas.onDesignerItemDoubleClick = function (id, event) {
            self._onDesignerItemDoubleClick(id, event);
        };

        this.designerCanvas.onModifyConnectionEnd = function (params) {
            self._onModifyConnectionEnd(params);
        };

        this.designerCanvas.onRegisterSubcomponent = function (objID, sCompID, metaInfo) {
            self._onRegisterSubcomponent(objID, sCompID, metaInfo);
        };

        this.designerCanvas.onUnregisterSubcomponent = function (objID, sCompID) {
            self._onUnregisterSubcomponent(objID, sCompID);
        };

        this.logger.debug("attachDesignerCanvasEventHandlers finished");
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._onDesignerItemsMove = function (repositionDesc) {
        var id;

        this._client.startTransaction();
        for (id in repositionDesc) {
            if (repositionDesc.hasOwnProperty(id)) {
                this._client.setRegistry(this._ComponentID2GmeID[id], nodePropertyNames.Registry.position, { "x": repositionDesc[id].x, "y": repositionDesc[id].y });
            }
        }
        this._client.completeTransaction();
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._onDesignerItemsCopy = function (copyDesc) {
        var copyOpts = { "parentId": this.currentNodeInfo.id },
            id,
            desc,
            gmeID;

        this.designerCanvas.beginUpdate();

        for (id in copyDesc.items) {
            if (copyDesc.items.hasOwnProperty(id)) {
                desc = copyDesc.items[id];
                gmeID = this._ComponentID2GmeID[desc.oItemId];

                copyOpts[gmeID] = {};
                copyOpts[gmeID][ATTRIBUTES_STRING] = {};
                copyOpts[gmeID][REGISTRY_STRING] = {};

                copyOpts[gmeID][REGISTRY_STRING][nodePropertyNames.Registry.position] = { "x": desc.posX, "y": desc.posY };

                //remove the component from UI
                //it will be recreated when the GME client calls back with the result
                this.designerCanvas.deleteComponent(id);
            }
        }

        for (id in copyDesc.connections) {
            if (copyDesc.connections.hasOwnProperty(id)) {
                desc = copyDesc.connections[id];
                gmeID = this._ComponentID2GmeID[desc.oConnectionId];

                copyOpts[gmeID] = {};

                //remove the component from UI
                //it will be recreated when the GME client calls back with the result
                this.designerCanvas.deleteComponent(id);
            }
        }

        this.designerCanvas.endUpdate();

        this._client.intellyPaste(copyOpts);
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._onCreateNewConnection = function (params) {
        var sourceId,
            targetId;

        if (params.srcSubCompId !== undefined) {
            sourceId = this._Subcomponent2GMEID[params.src][params.srcSubCompId];
        } else {
            sourceId = this._ComponentID2GmeID[params.src];
        }

        if (params.dstSubCompId !== undefined) {
            targetId = this._Subcomponent2GMEID[params.dst][params.dstSubCompId];
        } else {
            targetId = this._ComponentID2GmeID[params.dst];
        }

        this._client.makeConnection({   "parentId": this.currentNodeInfo.id,
            "sourceId": sourceId,
            "targetId": targetId,
            "directed": true });

        var p = {   "parentId": this.currentNodeInfo.id,
            "sourceId": sourceId,
            "targetId": targetId,
            "directed": true };

        this.logger.warning("onCreateNewConnection: " + JSON.stringify(p));
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._onSelectionDelete = function (idList) {
        var objIdList = [],
            i = idList.length;

        while(i--) {
            objIdList.insertUnique(this._ComponentID2GmeID[idList[i]]);
        }

        if (objIdList.length > 0) {
            this._client.delMoreNodes(objIdList);
        }
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._onDesignerItemDoubleClick = function (id, event) {
        var gmeID = this._ComponentID2GmeID[id];

        if (gmeID) {
            //TODO: somewhat tricked here for DEBUG purposes
            if (event.offsetX < 20 && event.offsetY < 20) {
                this._switchToNextDecorator(gmeID);
            } else {
                this.logger.debug("Opening model with id '" + gmeID + "'");
                this._client.setSelectedObjectId(gmeID);
            }
        }
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._onModifyConnectionEnd = function (params) {
        var gmeID = this._ComponentID2GmeID[params.id],
            oldDesc = params.old,
            newDesc = params.new,
            newEndPointGMEID;

        if (gmeID) {
            this._client.startTransaction();

            //update connection endpoint - SOURCE
            if (oldDesc.srcObjId !== newDesc.srcObjId ||
                oldDesc.srcSubCompId !== newDesc.srcSubCompId) {
                if (newDesc.srcSubCompId !== undefined ) {
                    newEndPointGMEID = this._Subcomponent2GMEID[newDesc.srcObjId][newDesc.srcSubCompId];
                } else {
                    newEndPointGMEID = this._ComponentID2GmeID[newDesc.srcObjId];
                }
                this._client.makePointer(gmeID, CONNECTION_SOURCE_NAME, newEndPointGMEID);
            }

            //update connection endpoint - TARGET
            if (oldDesc.dstObjId !== newDesc.dstObjId ||
                oldDesc.dstSubCompId !== newDesc.dstSubCompId) {
                if (newDesc.dstSubCompId !== undefined ) {
                    newEndPointGMEID = this._Subcomponent2GMEID[newDesc.dstObjId][newDesc.dstSubCompId];
                } else {
                    newEndPointGMEID = this._ComponentID2GmeID[newDesc.dstObjId];
                }
                this._client.makePointer(gmeID, CONNECTION_TARGET_NAME, newEndPointGMEID);
            }

            this._client.completeTransaction();
        }
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._onRegisterSubcomponent = function (objID, sCompID, metaInfo) {
        //store that a subcomponent with a given ID has been added to object with objID
        this._GMEID2Subcomponent[metaInfo[GME_ID]] = this._GMEID2Subcomponent[metaInfo[GME_ID]] || {};
        this._GMEID2Subcomponent[metaInfo[GME_ID]][objID] = sCompID;

        this._Subcomponent2GMEID[objID] = this._Subcomponent2GMEID[objID] || {};
        this._Subcomponent2GMEID[objID][sCompID] = metaInfo[GME_ID];
        //TODO: add event handling here that a subcomponent appeared
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._onUnregisterSubcomponent = function (objID, sCompID) {
        var gmeID = this._Subcomponent2GMEID[objID][sCompID];

        delete this._Subcomponent2GMEID[objID][sCompID];
        delete this._GMEID2Subcomponent[gmeID][objID];
        //TODO: add event handling here that a subcomponent disappeared
    };

    DesignerControlDesignerCanvasEventHandlers.prototype._switchToNextDecorator = function (id) {
        var objDesc = this._getObjectDescriptor(id),
            nextDec = "DecoratorWithPorts";

        switch (objDesc.decorator) {
            case "DefaultDecorator":
                nextDec = "CircleDecorator";
                break;
            case "CircleDecorator":
                nextDec = "DecoratorWithPorts";
                break;
            case "DecoratorWithPorts":
                nextDec = "DefaultDecorator";
                break;
            default:
                break;
        }

        this._client.startTransaction();
        this._client.setRegistry(id, nodePropertyNames.Registry.decorator, nextDec);
        this._client.completeTransaction();
    };
    

    return DesignerControlDesignerCanvasEventHandlers;
});
