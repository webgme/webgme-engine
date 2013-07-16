"use strict";

define(['logManager',
    'clientUtil',
    'js/Constants',
    'js/NodePropertyNames'], function (logManager,
                                                        util,
                                                        CONSTANTS,
                                                        nodePropertyNames) {

    var AspectDesignerControlDiagramDesignerWidgetEventHandlers,
        ATTRIBUTES_STRING = "attributes",
        REGISTRY_STRING = "registry",
        CONNECTION_SOURCE_NAME = "source",
        CONNECTION_TARGET_NAME = "target";

    AspectDesignerControlDiagramDesignerWidgetEventHandlers = function () {
    };

    AspectDesignerControlDiagramDesignerWidgetEventHandlers.prototype.attachDiagramDesignerWidgetEventHandlers = function () {
        var self = this;

        /*OVERRIDE DESIGNER CANVAS METHODS*/
        this.designerCanvas.onDesignerItemsMove = function (repositionDesc) {
            self._onDesignerItemsMove(repositionDesc);
        };

        this.designerCanvas.onCreateNewConnection = function (params) {
            self._onCreateNewConnection(params);
        };

        this.designerCanvas.onSelectionDelete = function (idList) {
            self._onSelectionDelete(idList);
        };

        this.designerCanvas.onBackgroundDroppableAccept = function (helper) {
            return self._onBackgroundDroppableAccept(helper);
        };

        this.designerCanvas.onBackgroundDrop = function (helper, position) {
            self._onBackgroundDrop(helper, position);
        };

        this.designerCanvas.onCheckChanged = function (value, isChecked) {
            self._onConnectionTypeFilterCheckChanged(value, isChecked);
        };

        this.logger.debug("attachDesignerCanvasEventHandlers finished");
    };

    AspectDesignerControlDiagramDesignerWidgetEventHandlers.prototype._onBackgroundDroppableAccept = function (helper) {
        var metaInfo = helper.data(CONSTANTS.META_INFO);
        if (metaInfo) {
            if (metaInfo.hasOwnProperty(CONSTANTS.GME_ID)) {
                if (this._GMEModels.indexOf(metaInfo[CONSTANTS.GME_ID]) === -1 ) {
                    return true;
                }
            }
        }

        return false;
    };

    AspectDesignerControlDiagramDesignerWidgetEventHandlers.prototype._onBackgroundDrop = function (helper, position) {
        var metaInfo = helper.data(CONSTANTS.META_INFO);

        if (metaInfo) {
            if (metaInfo.hasOwnProperty(CONSTANTS.GME_ID)) {
                this._addItemsToAspect(metaInfo[CONSTANTS.GME_ID], position);
            }
        }
    };

    return AspectDesignerControlDiagramDesignerWidgetEventHandlers;
});
