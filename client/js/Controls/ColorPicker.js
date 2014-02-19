/*
 * Copyright (C) 2013 Vanderbilt University, All rights reserved.
 * 
 * Author: Robert Kereskenyi
 */

"use strict";

define(['jquery-spectrum',
    'css!/css/Controls/ColorPicker'], function (/*_spectrum*/) {

    var ColorPicker;

    ColorPicker = function (params) {
        var self = this;

        this.el = params.el;

        this.el.spectrum({
            color: "#dd3333",
            showPalette: true,
            showSelectionPalette: false,
            showInput: true,
            preferredFormat: "hex",
            allowEmpty:true,
            palette: [
                ['rgb(255, 255, 255)', 'rgb(242, 242, 242);', 'rgb(230, 230, 230);', 'rgb(204, 204, 204);', 'rgb(179, 179, 179);', 'rgb(153, 153, 153);', 'rgb(128, 128, 128);', 'rgb(102, 102, 102);', 'rgb(77, 77, 77);', 'rgb(51, 51, 51);', 'rgb(26, 26, 26);', 'rgb(0, 0, 0);'  ],
                ['rgb(255, 204, 204);', 'rgb(255, 230, 204);', 'rgb(255, 255, 204);', 'rgb(230, 255, 204);', 'rgb(204, 255, 204);', 'rgb(204, 255, 230);', 'rgb(204, 255, 255);', 'rgb(204, 229, 255);', 'rgb(204, 204, 255);', 'rgb(229, 204, 255);', 'rgb(255, 204, 255);', 'rgb(255, 204, 230);'],
                ['rgb(255, 153, 153);', 'rgb(255, 204, 153);', 'rgb(255, 255, 153);', 'rgb(204, 255, 153);', 'rgb(153, 255, 153);', 'rgb(153, 255, 204);', 'rgb(153, 255, 255);', 'rgb(153, 204, 255);', 'rgb(153, 153, 255);', 'rgb(204, 153, 255);', 'rgb(255, 153, 255);', 'rgb(255, 153, 204);'],
                ['rgb(255, 102, 102);', 'rgb(255, 179, 102);', 'rgb(255, 255, 102);', 'rgb(179, 255, 102);', 'rgb(102, 255, 102);', 'rgb(102, 255, 179);', 'rgb(102, 255, 255);', 'rgb(102, 178, 255);', 'rgb(102, 102, 255);', 'rgb(178, 102, 255);', 'rgb(255, 102, 255);', 'rgb(255, 102, 179);'],
                ['rgb(255, 51, 51);', 'rgb(255, 153, 51);', 'rgb(255, 255, 51);', 'rgb(153, 255, 51);', 'rgb(51, 255, 51);', 'rgb(51, 255, 153);', 'rgb(51, 255, 255);', 'rgb(51, 153, 255);', 'rgb(51, 51, 255);', 'rgb(153, 51, 255);', 'rgb(255, 51, 255);', 'rgb(255, 51, 153);'],
                ['rgb(255, 0, 0);', 'rgb(255, 128, 0);', 'rgb(255, 255, 0);', 'rgb(128, 255, 0);', 'rgb(0, 255, 0);', 'rgb(0, 255, 128);', 'rgb(0, 255, 255);', 'rgb(0, 127, 255);', 'rgb(0, 0, 255);', 'rgb(127, 0, 255);', 'rgb(255, 0, 255);', 'rgb(255, 0, 128);'],
                ['rgb(204, 0, 0);', 'rgb(204, 102, 0);', 'rgb(204, 204, 0);', 'rgb(102, 204, 0);', 'rgb(0, 204, 0);', 'rgb(0, 204, 102);', 'rgb(0, 204, 204);', 'rgb(0, 102, 204);', 'rgb(0, 0, 204);', 'rgb(102, 0, 204);', 'rgb(204, 0, 204);', 'rgb(204, 0, 102);'],
                ['rgb(153, 0, 0);', 'rgb(153, 76, 0);', 'rgb(153, 153, 0);', 'rgb(77, 153, 0);', 'rgb(0, 153, 0);', 'rgb(0, 153, 77);', 'rgb(0, 153, 153);', 'rgb(0, 76, 153);', 'rgb(0, 0, 153);', 'rgb(76, 0, 153);', 'rgb(153, 0, 153);', 'rgb(153, 0, 77);'],
                ['rgb(102, 0, 0);', 'rgb(102, 51, 0);', 'rgb(102, 102, 0);', 'rgb(51, 102, 0);', 'rgb(0, 102, 0);', 'rgb(0, 102, 51);', 'rgb(0, 102, 102);', 'rgb(0, 51, 102);', 'rgb(0, 0, 102);', 'rgb(51, 0, 102);', 'rgb(102, 0, 102);', 'rgb(102, 0, 51);']
            ],
            show: function() {
                var spectrumContainer = $('.sp-container'),
                    clearButton = spectrumContainer.find(".sp-clear");

                clearButton.off("click.spectrum");
                clearButton.on("click.ColorPicker", function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    self.el.spectrum("hide");
                    self.onColorChanged();
                });
            },
            hide: function() {
                self._destroy();
            },
            change: function(color) {
                if (color) {
                    self.onColorChanged(color.toHexString());
                } else {
                    self.onColorChanged();
                }
                self._destroy();
            }
        });

        this.el.spectrum('show');
    };

    ColorPicker.prototype.setColor = function (color) {
        this.el.spectrum("set", color);
    };

    ColorPicker.prototype.onColorChanged = function (color) {
        console.log('ColorPicker.onColorChanged not overridden: ' + color);
    };

    ColorPicker.prototype._destroy = function () {
        this.el.spectrum('destroy');
    };

    return ColorPicker;
});