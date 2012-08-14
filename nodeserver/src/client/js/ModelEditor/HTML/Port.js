"use strict";

define(['logManager',
    'text!ModelEditorHTML/ModelPortLeftTmpl.html',
    'text!ModelEditorHTML/ModelPortRightTmpl.html',
    'css!ModelEditorHTMLCSS/Port'], function (logManager,
                                              modelPortLeftTmpl,
                                              modelPortRightTmpl) {

    var Port;

    Port = function (id, options) {
        //component's outermost DOM element
        this.el = $('<div/>').attr("id", id);
        this.id = id;

        this.title = options.title || "";
        this.orientation = options.orientation || "W";
        this.skinParts = [];
        this.modelEditorCanvas = options.modelEditorCanvas || null;

        //get logger instance for this component
        this.logger = logManager.create("Port_" + this.id);
        this.logger.debug("Created");

        this._initialize();
    };

    Port.prototype._initialize = function () {
        var concretePortTemplate = this.orientation === "W" ? modelPortLeftTmpl : modelPortRightTmpl,
            portDomString,
            data = {};

        data.name = this.title;
        data.pid = this.id;
        portDomString = _.template(concretePortTemplate, data);

        this.el = $(portDomString);
        this.skinParts.connectionPoint = this.el.find(".dot");
        this.skinParts.portTitle = this.el.find(".title");
    };

    Port.prototype.update = function (options) {
        if (options.title) {
            this.skinParts.portTitle.text(options.title);
        }
    };

    Port.prototype.destroy = function () {
        var self = this;

        //finally remove itself from DOM
        if (this.el) {
            this.el.fadeOut('slow', function () {
                self.el.empty();
                self.el.remove();
            });
        }
    };

    return Port;
});