"use strict";
/**
 * High-performance ANSI 24-bit True-Color utilities for CLI graphics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.C_ORANGE_SPIKE = exports.C_CYAN_SPIKE = exports.C_MAGENTA_SPIKE = exports.SYNTH_END = exports.SYNTH_START = exports.SUNSET_END = exports.SUNSET_START = exports.C_ITALIC = exports.C_DIM = exports.C_BOLD = exports.C_RESET = void 0;
exports.rgb = rgb;
exports.bgRgb = bgRgb;
exports.bold = bold;
exports.dim = dim;
exports.italic = italic;
exports.gradientText = gradientText;
exports.stripAnsi = stripAnsi;
exports.C_RESET = '\x1b[0m';
exports.C_BOLD = '\x1b[1m';
exports.C_DIM = '\x1b[2m';
exports.C_ITALIC = '\x1b[3m';
// Curated palette
exports.SUNSET_START = { r: 255, g: 140, b: 0 }; // Deep Amber / Orange
exports.SUNSET_END = { r: 255, g: 215, b: 0 }; // Radiant Gold / Yellow
exports.SYNTH_START = { r: 236, g: 72, b: 153 }; // Pink
exports.SYNTH_END = { r: 99, g: 102, b: 241 }; // Indigo
exports.C_MAGENTA_SPIKE = '\x1b[38;2;255;0;255m';
exports.C_CYAN_SPIKE = '\x1b[38;2;0;255;255m';
exports.C_ORANGE_SPIKE = '\x1b[38;2;255;165;0m';
function rgb(r, g, b) {
    return "\u001B[38;2;".concat(Math.round(r), ";").concat(Math.round(g), ";").concat(Math.round(b), "m");
}
function bgRgb(r, g, b) {
    return "\u001B[48;2;".concat(Math.round(r), ";").concat(Math.round(g), ";").concat(Math.round(b), "m");
}
function bold(text) {
    return "".concat(exports.C_BOLD).concat(text).concat(exports.C_RESET);
}
function dim(text) {
    return "".concat(exports.C_DIM).concat(text).concat(exports.C_RESET);
}
function italic(text) {
    return "".concat(exports.C_ITALIC).concat(text).concat(exports.C_RESET);
}
/**
 * Renders a string with a smooth 24-bit color gradient between two RGB colors.
 */
function gradientText(text, start, end) {
    if (!text)
        return '';
    var len = text.length;
    if (len === 1)
        return rgb(start.r, start.g, start.b) + text + exports.C_RESET;
    var result = '';
    for (var i = 0; i < len; i++) {
        var ratio = i / (len - 1);
        var r = start.r + (end.r - start.r) * ratio;
        var g = start.g + (end.g - start.g) * ratio;
        var b = start.b + (end.b - start.b) * ratio;
        result += rgb(r, g, b) + text[i];
    }
    return result + exports.C_RESET;
}
/**
 * Strips all ANSI escape sequences from a string.
 */
function stripAnsi(text) {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}
