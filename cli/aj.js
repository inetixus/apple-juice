#!/usr/bin/env node
"use strict";
/**
 * Apple Juice CLI  —  Roblox Studio AI Sync
 * Full UI revamp modelled on Claude Code's terminal design.
 * Includes slash command menu with live filtering, Tab autocomplete.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var crypto_1 = require("crypto");
var path_1 = require("path");
var os_1 = require("os");
var readline = require("readline");
var child_process_1 = require("child_process");
var http_1 = require("http");
var ansi_ts_1 = require("./utils/ansi.ts");
var Diff = require("diff");
var https_1 = require("https");
function customFetch(url_1) {
    return __awaiter(this, arguments, void 0, function (url, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    try {
                        var isHttps = url.startsWith('https:');
                        var lib = isHttps ? https_1.default : http_1.default;
                        var method = options.method || 'GET';
                        var headers = __assign({}, options.headers);
                        var body = options.body;
                        if (body && typeof body === 'object') {
                            body = JSON.stringify(body);
                            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
                        }
                        var req_1 = lib.request(url, {
                            method: method,
                            headers: headers,
                        }, function (res) {
                            var chunks = [];
                            res.on('data', function (chunk) { return chunks.push(chunk); });
                            res.on('end', function () {
                                var raw = Buffer.concat(chunks).toString('utf8');
                                resolve({
                                    ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
                                    status: res.statusCode || 0,
                                    statusText: res.statusMessage || '',
                                    text: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                        return [2 /*return*/, raw];
                                    }); }); },
                                    json: function () { return __awaiter(_this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            try {
                                                return [2 /*return*/, JSON.parse(raw)];
                                            }
                                            catch (_b) {
                                                return [2 /*return*/, {}];
                                            }
                                            return [2 /*return*/];
                                        });
                                    }); },
                                });
                            });
                        });
                        if (options.signal) {
                            if (typeof options.signal.addEventListener === 'function') {
                                options.signal.addEventListener('abort', function () {
                                    req_1.destroy();
                                    reject(new Error('The operation was aborted.'));
                                });
                            }
                            else {
                                options.signal.onabort = function () {
                                    req_1.destroy();
                                    reject(new Error('The operation was aborted.'));
                                };
                            }
                        }
                        req_1.on('error', function (err) {
                            reject(err);
                        });
                        if (body) {
                            req_1.write(body);
                        }
                        req_1.end();
                    }
                    catch (e) {
                        reject(e);
                    }
                })];
        });
    });
}
// Shadow global fetch to avoid experimental fetch warning and pkg Node 18 compatibility crash
var fetch = customFetch;
var globalConfig = null;
var globalRl = null;
var localOpenRouterModels = [];
try {
    var candidates = [
        path_1.default.join(__dirname, 'modellist.txt'),
        path_1.default.join(__dirname, '../cli/modellist.txt'),
        path_1.default.join(process.cwd(), 'cli/modellist.txt'),
        path_1.default.join(path_1.default.dirname(process.execPath), 'cli/modellist.txt'),
        path_1.default.join(path_1.default.dirname(process.execPath), 'modellist.txt'),
    ];
    var foundPath = '';
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var c = candidates_1[_i];
        if (fs_1.default.existsSync(c)) {
            foundPath = c;
            break;
        }
    }
    if (foundPath) {
        var raw = fs_1.default.readFileSync(foundPath, 'utf8');
        var parsed = JSON.parse(raw);
        if (parsed && parsed.data) {
            localOpenRouterModels = parsed.data.map(function (m) { return m.id; });
        }
    }
}
catch (e) {
    // ignore
}
// ─── ANSI ────────────────────────────────────────────────────────────────────
var R = '\x1b[0m';
var BOLD = '\x1b[1m';
var DIM = '\x1b[2m';
var BRIGHT_RED = '\x1b[91m';
var BRIGHT_GREEN = '\x1b[92m';
var BRIGHT_YELLOW = '\x1b[93m';
var BRIGHT_CYAN = '\x1b[96m';
var BRIGHT_WHITE = '\x1b[97m';
var WHITE = '\x1b[37m';
var THEME_COLORS = ['terracotta', 'red', 'blue', 'green', 'yellow', 'cyan'];
// Apple Juice brand — dynamic colors (initially premium terracotta)
var BRAND = '\x1b[38;2;204;107;73m';
var BRAND_DIM = '\x1b[38;2;130;70;50m';
var BRAND_B = '\x1b[38;2;230;120;80m';
var BRAND_SHIMMER = '\x1b[38;2;250;165;130m';
function applyPromptColor(colorName) {
    var name = (colorName === null || colorName === void 0 ? void 0 : colorName.toLowerCase()) || 'terracotta';
    if (name === 'red') {
        BRAND = '\x1b[38;2;230;30;30m';
        BRAND_DIM = '\x1b[38;2;140;20;20m';
        BRAND_B = '\x1b[38;2;255;60;60m';
        BRAND_SHIMMER = '\x1b[38;2;255;120;120m';
    }
    else if (name === 'blue') {
        BRAND = '\x1b[38;2;40;110;230m';
        BRAND_DIM = '\x1b[38;2;25;65;140m';
        BRAND_B = '\x1b[38;2;70;150;255m';
        BRAND_SHIMMER = '\x1b[38;2;140;185;255m';
    }
    else if (name === 'green') {
        BRAND = '\x1b[38;2;46;204;113m';
        BRAND_DIM = '\x1b[38;2;25;120;65m';
        BRAND_B = '\x1b[38;2;85;235;150m';
        BRAND_SHIMMER = '\x1b[38;2;135;245;180m';
    }
    else if (name === 'yellow') {
        BRAND = '\x1b[38;2;241;196;15m';
        BRAND_DIM = '\x1b[38;2;145;115;8m';
        BRAND_B = '\x1b[38;2;255;220;50m';
        BRAND_SHIMMER = '\x1b[38;2;255;235;120m';
    }
    else if (name === 'cyan') {
        BRAND = '\x1b[38;2;52;152;219m';
        BRAND_DIM = '\x1b[38;2;30;90;130m';
        BRAND_B = '\x1b[38;2;85;185;245m';
        BRAND_SHIMMER = '\x1b[38;2;145;210;255m';
    }
    else {
        BRAND = '\x1b[38;2;204;107;73m';
        BRAND_DIM = '\x1b[38;2;130;70;50m';
        BRAND_B = '\x1b[38;2;230;120;80m';
        BRAND_SHIMMER = '\x1b[38;2;250;165;130m';
    }
}
var C_COMMENT = '\x1b[38;5;244m';
var C_STRING = '\x1b[38;5;78m';
var C_NUMBER = '\x1b[38;5;215m';
var C_KEYWORD = '\x1b[38;5;197m\x1b[1m';
var C_BUILTIN = '\x1b[38;5;75m';
var C_OPERATOR = '\x1b[38;5;116m';
var C_IDENTIFIER = '\x1b[38;5;253m';
function stripAnsi(s) {
    return s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}
function formatModelName(model) {
    if (!model)
        return '';
    var parts = model.split('/');
    var name = parts[parts.length - 1];
    var suffix = '';
    if (name.includes(':')) {
        var colonIdx = name.indexOf(':');
        suffix = " <".concat(name.slice(colonIdx + 1), ">");
        name = name.slice(0, colonIdx);
    }
    var words = name.split('-');
    var formattedWords = words.map(function (word) {
        if (!word)
            return '';
        if (/\d/.test(word))
            return word;
        if (word.toLowerCase() === 'reasoning')
            return 'reasoning';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
    return formattedWords.filter(Boolean).join(' ') + suffix;
}
function termWidth() {
    return process.stdout.columns || 80;
}
function padRight(text, visLen) {
    var vis = stripAnsi(text).length;
    return text + ' '.repeat(Math.max(0, visLen - vis));
}
function drawHorizontalLineWithText(leftText, rightText) {
    var w = process.stdout.columns || 80;
    var leftTextPart = leftText ? " ".concat(leftText, " ") : '';
    var rightTextPart = rightText ? " ".concat(rightText, " ") : '';
    var leftLen = stripAnsi(leftTextPart).length;
    var rightLen = stripAnsi(rightTextPart).length;
    var leftLines = 3;
    var remaining = w - leftLines - leftLen - rightLen - 4;
    if (remaining <= 0) {
        return "\u001B[38;2;65;65;65m".concat('─'.repeat(w)).concat(R);
    }
    return "\u001B[38;2;65;65;65m".concat('─'.repeat(leftLines)).concat(R).concat(leftTextPart, "\u001B[38;2;65;65;65m").concat('─'.repeat(remaining)).concat(R).concat(rightTextPart, "\u001B[38;2;65;65;65m\u2500\u2500\u2500\u2500").concat(R);
}
function getGitBranch() {
    try {
        var headPath = path_1.default.join(process.cwd(), '.git', 'HEAD');
        if (fs_1.default.existsSync(headPath)) {
            var head = fs_1.default.readFileSync(headPath, 'utf8').trim();
            if (head.startsWith('ref: ')) {
                return head.replace('ref: refs/heads/', '');
            }
        }
    }
    catch (_) { }
    return 'main';
}
function getContextBar(history) {
    var textLen = JSON.stringify(history).length;
    var pct = Math.min(100, Math.max(0, Math.round((textLen / 30000) * 100)));
    var bars = Math.round(pct / 10);
    var barStr = '█'.repeat(bars) + '░'.repeat(10 - bars);
    return "".concat(barStr, " ").concat(pct, "% used");
}
// ─── Spinner ─────────────────────────────────────────────────────────────────
var SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
// Fixed apple frames: consistent dimensions, proper centered rotation effect
var APPLE_FRAMES = [
    [
        "    \\|/     ",
        "   .-\"-.    ",
        "  /     \\   ",
        "  |  |  |   ",
        "  \\     /   ",
        "   `-'-`    "
    ],
    [
        "    \\|/     ",
        "   .-\"-.    ",
        "  /  |  \\   ",
        "  |  |  |   ",
        "  \\  |  /   ",
        "   `-'-`    "
    ],
    [
        "    \\|/     ",
        "   .-\"-.    ",
        "  / (|\\ \\   ",
        "  | (|)| |   ",
        "  \\ (|/ /   ",
        "   `-'-`    "
    ],
    [
        "    \\|/     ",
        "   .-\"-.    ",
        "  /  |\\ \\   ",
        "  |  |)| |   ",
        "  \\  |/ /   ",
        "   `-'-`    "
    ],
    [
        "    \\|/     ",
        "   .-\"-.    ",
        "  /     \\   ",
        "  |  |  |   ",
        "  \\     /   ",
        "   `-'-`    "
    ],
    [
        "    \\|/     ",
        "   .-\"-.    ",
        "  /  )| \\   ",
        "  |  )| |   ",
        "  \\  )| /   ",
        "   `-'-`    "
    ],
    [
        "    \\|/     ",
        "   .-\"-.    ",
        "  / (|  \\   ",
        "  | (|  |   ",
        "  \\ (|  /   ",
        "   `-'-`    "
    ],
    [
        "    \\|/     ",
        "   .-\"-.    ",
        "  /  \\| \\   ",
        "  |  \\| |   ",
        "  \\  \\| /   ",
        "   `-'-`    "
    ]
];
function getAppleFrame(frame, isRainbow) {
    if (isRainbow === void 0) { isRainbow = false; }
    var fIndex = frame % APPLE_FRAMES.length;
    var rawLines = APPLE_FRAMES[fIndex];
    var frameColor = BRAND;
    if (isRainbow) {
        var rainbowColors = [
            '\x1b[38;2;255;99;71m',
            '\x1b[38;2;255;165;0m',
            '\x1b[38;2;238;232;170m',
            '\x1b[38;2;50;205;50m',
            '\x1b[38;2;64;224;208m',
            '\x1b[38;2;30;144;255m',
            '\x1b[38;2;147;112;219m'
        ];
        frameColor = rainbowColors[frame % rainbowColors.length];
    }
    var green = '\x1b[38;2;46;204;113m';
    var stem = '\x1b[38;2;139;69;19m';
    var lines = __spreadArray([], rawLines, true);
    lines[0] = lines[0].replace(/\\\|\//g, "".concat(stem, "\\").concat(green, "\u2502").concat(stem, "/").concat(R));
    lines[0] = lines[0].replace(/\|/g, "".concat(stem, "\u2502").concat(R));
    lines[0] = lines[0].replace(/\\\|/g, "".concat(stem, "\\\u2502").concat(R));
    lines[0] = lines[0].replace(/\|\\/g, "".concat(stem, "\u2502\\").concat(R));
    for (var idx = 1; idx < lines.length; idx++) {
        var line = lines[idx];
        line = line.replace(/([()|])/g, "".concat(BRAND_SHIMMER, "$1").concat(frameColor));
        lines[idx] = "".concat(frameColor).concat(line).concat(R);
    }
    return lines;
}
var _spinInterval = null;
var lastSpinnerLinesCount = 0;
function clearSpinner() {
    if (lastSpinnerLinesCount > 0) {
        for (var i = 0; i < lastSpinnerLinesCount; i++) {
            process.stdout.write('\x1b[A\r\x1b[K');
        }
        lastSpinnerLinesCount = 0;
    }
}
function getSpinnerColor(frame, isRainbow) {
    if (isRainbow === void 0) { isRainbow = false; }
    if (isRainbow) {
        var rainbowColors = [
            '\x1b[38;2;255;99;71m',
            '\x1b[38;2;255;165;0m',
            '\x1b[38;2;238;232;170m',
            '\x1b[38;2;50;205;50m',
            '\x1b[38;2;64;224;208m',
            '\x1b[38;2;30;144;255m',
            '\x1b[38;2;147;112;219m'
        ];
        return rainbowColors[frame % rainbowColors.length];
    }
    var colors = [BRAND, BRAND_B, BRAND_SHIMMER, BRAND_B, BRAND];
    return colors[frame % colors.length];
}
var SPIN_DURATIONS = [300, 150, 120, 120, 150, 300];
function startSpinner(msg, isRainbow) {
    if (isRainbow === void 0) { isRainbow = false; }
    clearSpinner();
    var frame = 0;
    var startTime = Date.now();
    process.stdout.write('\n');
    var tick = function () {
        clearSpinner();
        var elapsed = (Date.now() - startTime) / 1000;
        var elapsedSec = elapsed.toFixed(1);
        var phase = getReasoningPhase(elapsed);
        var appleLines = getAppleFrame(frame, isRainbow);
        var outputLines = [];
        outputLines.push('');
        var appleHeight = appleLines.length;
        for (var i = 0; i < appleHeight; i++) {
            if (i === Math.floor(appleHeight / 2)) {
                outputLines.push("    ".concat(appleLines[i], "   ").concat(BOLD).concat(WHITE).concat(msg).concat(R, " ").concat(BRAND_DIM, "\u2794").concat(R, " ").concat(DIM).concat(phase).concat(R, "  ").concat(DIM, "[").concat(elapsedSec, "s]").concat(R));
            }
            else {
                outputLines.push("    ".concat(appleLines[i]));
            }
        }
        outputLines.push('');
        process.stdout.write(outputLines.join('\n') + '\n');
        lastSpinnerLinesCount = outputLines.length + 1;
        var delay = SPIN_DURATIONS[frame % SPIN_DURATIONS.length];
        frame++;
        _spinInterval = setTimeout(tick, delay);
    };
    tick();
}
function stopSpinner() {
    if (_spinInterval) {
        clearTimeout(_spinInterval);
        _spinInterval = null;
    }
    clearSpinner();
}
// ─── Sync Progress ────────────────────────────────────────────────────────────
var SF = SPIN_FRAMES;
var _sfFrame = 0;
var _sfInterval = null;
var _sfLines = 0;
var _sfStartTime = 0;
var _sfStepTimes = {};
function _drawSync(steps) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    for (var _i = 0, steps_1 = steps; _i < steps_1.length; _i++) {
        var s = steps_1[_i];
        if (s.status === 'running' && !((_a = _sfStepTimes[s.name]) === null || _a === void 0 ? void 0 : _a.start)) {
            _sfStepTimes[s.name] = { start: Date.now() };
        }
        if (s.status === 'done' || s.status === 'failed') {
            if (!_sfStepTimes[s.name]) {
                _sfStepTimes[s.name] = { start: _sfStartTime };
            }
            if (!_sfStepTimes[s.name].elapsed) {
                _sfStepTimes[s.name].elapsed = (Date.now() - ((_b = _sfStepTimes[s.name].start) !== null && _b !== void 0 ? _b : _sfStartTime)) / 1000;
            }
        }
    }
    var completedCount = steps.filter(function (s) { return s.status === 'done' || s.status === 'failed'; }).length;
    var ratio = completedCount / steps.length;
    var overallElapsed = ((Date.now() - _sfStartTime) / 1000).toFixed(1);
    var w = Math.min(termWidth() - 4, 70);
    var lines = [];
    var headerText = " ".concat(BOLD).concat((0, ansi_ts_1.gradientText)('Syncing to Roblox Studio', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END)).concat(R, " ");
    var rawHeaderLen = 'Syncing to Roblox Studio'.length + 2;
    var sideLineLen = Math.max(0, Math.floor((w - rawHeaderLen - 12) / 2));
    var rightSideLineLen = Math.max(0, w - rawHeaderLen - sideLineLen - 12);
    lines.push("  ".concat(BRAND, "\u256D").concat('─'.repeat(sideLineLen)).concat(headerText).concat(BRAND).concat('─'.repeat(rightSideLineLen), " [").concat(overallElapsed, "s] \u256E").concat(R));
    for (var _l = 0, steps_2 = steps; _l < steps_2.length; _l++) {
        var s = steps_2[_l];
        var icon = "".concat(DIM, "\u25CB").concat(R);
        var nameText = "".concat(DIM).concat(s.name).concat(R);
        var timeText = '';
        if (s.status === 'done') {
            icon = "".concat(BRIGHT_GREEN, "\u2714").concat(R);
            var elapsed = (_e = (_d = (_c = _sfStepTimes[s.name]) === null || _c === void 0 ? void 0 : _c.elapsed) === null || _d === void 0 ? void 0 : _d.toFixed(1)) !== null && _e !== void 0 ? _e : '0.0';
            nameText = "".concat(WHITE).concat(s.name).concat(R);
            timeText = " ".concat(DIM, "(").concat(elapsed, "s)").concat(R);
        }
        else if (s.status === 'failed') {
            icon = "".concat(BRIGHT_RED, "\u2716").concat(R);
            var elapsed = (_h = (_g = (_f = _sfStepTimes[s.name]) === null || _f === void 0 ? void 0 : _f.elapsed) === null || _g === void 0 ? void 0 : _g.toFixed(1)) !== null && _h !== void 0 ? _h : '0.0';
            nameText = "".concat(BRIGHT_RED).concat(s.name).concat(R);
            timeText = " ".concat(DIM, "(").concat(elapsed, "s)").concat(R);
        }
        else if (s.status === 'running') {
            icon = "".concat(BRAND).concat(SF[_sfFrame]).concat(R);
            nameText = "".concat(BOLD).concat(WHITE).concat(s.name).concat(R);
            var currentElapsed = ((Date.now() - ((_k = (_j = _sfStepTimes[s.name]) === null || _j === void 0 ? void 0 : _j.start) !== null && _k !== void 0 ? _k : Date.now())) / 1000).toFixed(1);
            timeText = " ".concat(BRAND, "(").concat(currentElapsed, "s...)").concat(R);
        }
        var stepLine = "  ".concat(BRAND, "\u2502").concat(R, "  ").concat(icon, "  ").concat(nameText).concat(timeText);
        lines.push(padRight(stepLine, w + 12) + "".concat(BRAND, "\u2502").concat(R));
    }
    lines.push("  ".concat(BRAND, "\u251C").concat('─'.repeat(w + 2), "\u2524").concat(R));
    var barWidth = Math.max(10, w - 24);
    var filledLen = Math.round(barWidth * ratio);
    var emptyLen = barWidth - filledLen;
    var filledBar = "\u001B[38;2;255;160;30m".concat('█'.repeat(filledLen), "\u001B[0m");
    var emptyBar = "\u001B[90m".concat('░'.repeat(emptyLen), "\u001B[0m");
    var percentStr = "".concat(Math.round(ratio * 100), "%").padStart(4);
    var progressBar = "".concat(filledBar).concat(emptyBar, "  ").concat(BRAND).concat(percentStr).concat(R);
    var progressLine = "  ".concat(BRAND, "\u2502").concat(R, "  ").concat(progressBar);
    lines.push(padRight(progressLine, w + 12) + "".concat(BRAND, "\u2502").concat(R));
    lines.push("  ".concat(BRAND, "\u2570").concat('─'.repeat(w + 2), "\u256F").concat(R));
    var box = lines.join('\n');
    if (_sfLines > 0) {
        for (var i = 0; i < _sfLines; i++) {
            process.stdout.write('\x1b[A\x1b[2K');
        }
    }
    process.stdout.write(box + '\n');
    _sfLines = lines.length;
}
function startSyncProgress(steps) {
    _sfLines = 0;
    _sfStartTime = Date.now();
    _sfStepTimes = {};
    _sfInterval = setInterval(function () { _sfFrame = (_sfFrame + 1) % SF.length; _drawSync(steps); }, 80);
}
function stopSyncProgress(steps) {
    if (_sfInterval) {
        clearInterval(_sfInterval);
        _sfInterval = null;
    }
    _drawSync(steps);
    _sfLines = 0;
}
var STATUS_VERBS = [
    'Reticulating', 'Orchestrating', 'Compiling', 'Restructuring', 'Optimizing', 'Indexing', 'Tokenizing', 'Hashing', 'Decrypting', 'Encrypting',
    'Parsing', 'Resolving', 'Validating', 'Calibrating', 'Synthesizing', 'Normalizing', 'Quantizing', 'Sharding', 'Serializing', 'Compressing',
    'Interpreting', 'Assembling', 'Refactoring', 'Profiling', 'Debugging', 'Tracing', 'Caching', 'Synchronizing', 'Serialising', 'Hydrating',
    'Dehydrating', 'Transpiling', 'Vectorizing', 'Clustering', 'Pruning', 'Pipetuning', 'Backpropagating', 'Fine-tuning', 'Quantifying', 'Formulating',
    'Cerebrating', 'Ruminating', 'Cogitating', 'Deliberating', 'Contemplating', 'Musing', 'Speculating', 'Envisioning', 'Rationalizing', 'Conceptualizing',
    'Hypothesizing', 'Analyzing', 'Deducting', 'Inferring', 'Deconstructing', 'Deciphering', 'Pondering', 'Meditating', 'Philosophizing', 'Weighing',
    'Synthesising', 'Diagnosing', 'Evaluating', 'Extrapolating', 'Brainstorming', 'Reviewing', 'Reflecting', 'Visualizing', 'Predicting', 'Discerning',
    'Grasping', 'Apprehending', 'Comprehending', 'Fathoming', 'Intuiting', 'Postulating', 'Scheming', 'Puzzling', 'Synthetizing', 'Postulating',
    'Brewing', 'Fermenting', 'Simmering', 'Distilling', 'Tempering', 'Kneading', 'Caramelizing', 'Flambéing', 'Zesting', 'Infusing',
    'Crystallizing', 'Transmuting', 'Coagulating', 'Sublimating', 'Filtering', 'Decanting', 'Steeping', 'Macerating', 'Roasting', 'Searing',
    'Baking', 'Basting', 'Pureeing', 'Whisking', 'Marinating', 'Glazing', 'Pickling', 'Chilling', 'Smoking', 'Condensing',
    'Extracting', 'Concentrating', 'Liquefying', 'Solidifying', 'Precipitating', 'Alchemizing', 'Vaporizing', 'Evaporating', 'Dissolving', 'Charring',
    'Orbiting', 'Undulating', 'Cascading', 'Hovering', 'Fluttering', 'Swooping', 'Gliding', 'Levitating', 'Oscillating', 'Vibrating',
    'Pulsating', 'Spinning', 'Swirling', 'Spiraling', 'Launching', 'Catapulting', 'Scurrying', 'Slithering', 'Galloping', 'Rippling',
    'Fluctuating', 'Surging', 'Sweeping', 'Whirling', 'Rotating', 'Revolving', 'Precessing', 'Drifting', 'Flowing', 'Streaming',
    'Zooming', 'Darting', 'Sprinting', 'Bounding', 'Leaping', 'Bouncing', 'Prancing', 'Swaying', 'Tumbling', 'Rolling',
    'Booping', "Beboppin'", 'Flibbertigibbeting', 'Lollygagging', 'Skedaddling', 'Shenaniganing', 'Bamboozling', 'Dilly-dallying', 'Tomfoolering', 'Boondoggling',
    'Discombobulating', 'Giga-thinking', 'Hyper-focusing', 'Coffee-powered', 'Pixel-pushing', 'Byte-chewing', 'Glitch-hunting', 'Rubber-ducking', 'Nonsensing', 'Kerfuffling',
    'Architecting', 'Composing', 'Crafting', 'Creating'
];
function getReasoningPhase(elapsed) {
    var idx = Math.floor(elapsed / 1.5);
    var seed = (idx * 17 + 11) % STATUS_VERBS.length;
    return STATUS_VERBS[seed] + '...';
}
function formatArtifactsBox(scripts) {
    var lines = [''];
    for (var _i = 0, scripts_1 = scripts; _i < scripts_1.length; _i++) {
        var s = scripts_1[_i];
        var action = String(s.action || 'create').toLowerCase();
        var typeLabel = s.type || s.scriptType || s.className || 'Instance';
        var nameLabel = s.name || s.instanceName || 'Unnamed';
        var pathLabel = s.parent || s.newParentPath || '';
        if (action === 'delete') {
            lines.push("  ".concat(DIM, "\uD83D\uDEE0\uFE0F  Deleted ").concat(nameLabel, " from ").concat(pathLabel).concat(R));
        }
        else if (action === 'run_playtest') {
            lines.push("  ".concat(DIM, "\u25B6  Running Roblox Studio Playtest...").concat(R));
        }
        else if (action === 'rename_instance' || action === 'move_instance') {
            lines.push("  ".concat(DIM, "\uD83D\uDCE6 Moved ").concat(s.oldPath || '', " \u2794 ").concat(s.newParentPath || s.newName || '').concat(R));
        }
        else {
            var sizeStr = '';
            if (s.code) {
                var sizeBytes = s.code.length;
                sizeStr = sizeBytes > 1024 ? "".concat((sizeBytes / 1024).toFixed(1), " KB") : "".concat(sizeBytes, " B");
                sizeStr = " ".concat(DIM, "(").concat(s.code.split('\n').length, " lines, ").concat(sizeStr, ")").concat(R);
            }
            lines.push("  ".concat(BRIGHT_GREEN, "\u2713").concat(R, " ").concat(DIM, "Created").concat(R, " ").concat(WHITE).concat(typeLabel, ":").concat(nameLabel).concat(R, " ").concat(DIM, "in ").concat(pathLabel).concat(R).concat(sizeStr));
        }
    }
    return lines.join('\n') + '\n';
}
function highlightLuau(code) {
    var rules = [
        { type: 'comment', re: /^--\[\[\s\S]*?\]\]|^--.*$/ },
        { type: 'string', re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^\[\[[\s\S]*?\]\]/ },
        { type: 'number', re: /^\b0x[0-9a-fA-F]+\b|^\b\d+(?:\.\d+)?\b/ },
        { type: 'keyword', re: /^\b(and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while|continue|self)\b/ },
        { type: 'builtin', re: /^\b(print|warn|error|Instance|game|workspace|script|Vector3|Color3|CFrame|UDim2|task|math|string|table|pairs|ipairs|typeof|new|Connect|Wait|Clone|Destroy|GetService)\b/ },
        { type: 'ident', re: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
        { type: 'op', re: /^[+\-*/%^#=~<>.:;]/ },
        { type: 'ws', re: /^\s+/ },
        { type: 'other', re: /^./ },
    ];
    var out = '', i = 0;
    while (i < code.length) {
        var sub = code.slice(i);
        for (var _i = 0, rules_1 = rules; _i < rules_1.length; _i++) {
            var r = rules_1[_i];
            var m = sub.match(r.re);
            if (m) {
                var v = m[0];
                i += v.length;
                switch (r.type) {
                    case 'comment':
                        out += C_COMMENT + v + R;
                        break;
                    case 'string':
                        out += C_STRING + v + R;
                        break;
                    case 'number':
                        out += C_NUMBER + v + R;
                        break;
                    case 'keyword':
                        out += C_KEYWORD + v + R;
                        break;
                    case 'builtin':
                        out += C_BUILTIN + v + R;
                        break;
                    case 'op':
                        out += C_OPERATOR + v + R;
                        break;
                    case 'ident':
                        out += C_IDENTIFIER + v + R;
                        break;
                    default: out += v;
                }
                break;
            }
        }
    }
    return out;
}
function renderAlignedTable(rows) {
    var dataRows = rows.filter(function (row) { return !row.every(function (cell) { return cell.startsWith('-'); }); });
    if (dataRows.length === 0)
        return '';
    var numCols = dataRows[0].length;
    var colWidths = Array(numCols).fill(0);
    for (var _i = 0, dataRows_1 = dataRows; _i < dataRows_1.length; _i++) {
        var row = dataRows_1[_i];
        for (var c = 0; c < numCols; c++) {
            if (row[c]) {
                colWidths[c] = Math.max(colWidths[c], stripAnsi(row[c]).length);
            }
        }
    }
    var w = termWidth();
    var G_LINE = '\x1b[38;2;100;100;100m';
    var outLines = [];
    var topBorder = G_LINE + '┌─' + colWidths.map(function (w) { return '─'.repeat(w); }).join('─┬─') + '─┐' + R;
    outLines.push('  ' + topBorder);
    var header = dataRows[0];
    var headerCells = header.map(function (cell, idx) {
        var text = "".concat(BOLD).concat(WHITE).concat(cell).concat(R);
        return padRight(text, colWidths[idx]);
    }).join(" ".concat(G_LINE, "\u2502").concat(R, " "));
    outLines.push("  ".concat(G_LINE, "\u2502").concat(R, " ") + headerCells + " ".concat(G_LINE, "\u2502").concat(R));
    var midBorder = G_LINE + '├─' + colWidths.map(function (w) { return '─'.repeat(w); }).join('─┼─') + '─┤' + R;
    outLines.push('  ' + midBorder);
    for (var r = 1; r < dataRows.length; r++) {
        var row = dataRows[r];
        var cells = row.map(function (cell, idx) {
            var text = "".concat(DIM).concat(cell).concat(R);
            return padRight(text, colWidths[idx]);
        }).join(" ".concat(G_LINE, "\u2502").concat(R, " "));
        outLines.push("  ".concat(G_LINE, "\u2502").concat(R, " ") + cells + " ".concat(G_LINE, "\u2502").concat(R));
    }
    var botBorder = G_LINE + '└─' + colWidths.map(function (w) { return '─'.repeat(w); }).join('─┴─') + '─┘' + R;
    outLines.push('  ' + botBorder);
    return '\n' + outLines.join('\n') + '\n';
}
function renderMarkdown(text) {
    if ((text.match(/```/g) || []).length % 2 === 1)
        text += '\n```';
    var parts = text.split(/(```[a-zA-Z]*\n[\s\S]*?\n```)/g);
    var out = '';
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var part = parts_1[_i];
        if (part.startsWith('```')) {
            var lines = part.split('\n');
            var lang = lines[0].replace('```', '').trim().toLowerCase();
            var code = lines.slice(1, -1).join('\n');
            var title = (lang || 'code').toUpperCase();
            var w = Math.min(termWidth() - 6, 72);
            out += "\n  ".concat(DIM, "\u256D\u2500 ").concat(title, " ").concat('─'.repeat(Math.max(0, w - title.length - 3)), "\u256E").concat(R, "\n");
            var hl = (lang === 'lua' || lang === 'luau') ? highlightLuau(code) : code;
            out += hl.split('\n').map(function (l) { return "  ".concat(DIM, "\u2502").concat(R, " ").concat(l); }).join('\n');
            out += "\n  ".concat(DIM, "\u2570").concat('─'.repeat(w + 2), "\u256F").concat(R, "\n");
        }
        else {
            var r = part;
            var lines = r.split('\n');
            var tableLinesList = [];
            var isTable = false;
            var newLines = [];
            for (var _a = 0, lines_1 = lines; _a < lines_1.length; _a++) {
                var line = lines_1[_a];
                var trimmed = line.trim();
                if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                    isTable = true;
                    var cells = trimmed.split('|').map(function (c) { return c.trim(); }).slice(1, -1);
                    tableLinesList.push(cells);
                }
                else {
                    if (isTable && tableLinesList.length > 0) {
                        var alignedTable = renderAlignedTable(tableLinesList);
                        newLines.push(alignedTable);
                        tableLinesList.length = 0;
                        isTable = false;
                    }
                    newLines.push(line);
                }
            }
            if (isTable && tableLinesList.length > 0) {
                var alignedTable = renderAlignedTable(tableLinesList);
                newLines.push(alignedTable);
            }
            r = newLines.join('\n');
            r = r.replace(/\*\*(.*?)\*\*/g, "".concat(BOLD, "$1").concat(R));
            r = r.replace(/\*(.*?)\*/g, "\u001B[3m$1".concat(R));
            r = r.replace(/`(.*?)`/g, "".concat(BRIGHT_YELLOW, "$1").concat(R));
            r = r.replace(/^### (.+)$/gm, "".concat(BOLD).concat(WHITE, "$1").concat(R));
            r = r.replace(/^## (.+)$/gm, "".concat(BOLD).concat(BRIGHT_WHITE, "$1").concat(R));
            r = r.replace(/^# (.+)$/gm, "".concat(BOLD).concat(BRAND, "$1").concat(R));
            r = r.replace(/^[-*] (.+)$/gm, "  ".concat(DIM, "\u2022").concat(R, " $1"));
            out += r;
        }
    }
    return out;
}
function drawHeader(serverOnline, paired, config) {
    var w = termWidth();
    var titleText = (0, ansi_ts_1.gradientText)('Apple Juice CLI', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
    var projectLabel = "".concat(DIM, "active project:").concat(R, " ").concat(WHITE).concat(path_1.default.basename(process.cwd())).concat(R);
    var engineVersion = "".concat(DIM, "v2.1.0").concat(R);
    var leftPart = "  ".concat(BOLD).concat(titleText).concat(R, "  \u2502  ").concat(projectLabel);
    var gap = Math.max(1, w - stripAnsi(leftPart).length - stripAnsi(engineVersion).length - 4);
    process.stdout.write("\u001B[1;1H\u001B[2K".concat(leftPart).concat(' '.repeat(gap)).concat(engineVersion, "\n"));
    process.stdout.write("\u001B[2;1H\u001B[2K  \u001B[38;2;65;65;65m".concat('─'.repeat(w - 4)).concat(R, "\n"));
    process.stdout.write("\u001B[3;1H\u001B[2K");
}
function drawWelcomeCard(state) {
    var col1W = 44;
    var col2W = 32;
    var padR = function (str, len) {
        var vis = stripAnsi(str).length;
        return str + ' '.repeat(Math.max(0, len - vis));
    };
    var padC = function (str, len) {
        var vis = stripAnsi(str).length;
        var left = Math.floor(Math.max(0, len - vis) / 2);
        var right = Math.max(0, len - vis - left);
        return ' '.repeat(left) + str + ' '.repeat(right);
    };
    var col1 = [];
    col1.push(padC("".concat(BOLD, "Welcome back!").concat(R), col1W));
    var green = '\x1b[38;2;46;204;113m';
    var stem = '\x1b[38;2;139;69;19m';
    var red = '\x1b[38;2;230;30;30m';
    var white = '\x1b[38;2;255;255;255m';
    var art = [
        "            ".concat(stem, "\u2588").concat(green, "\u2584\u2580").concat(R, "          "),
        "     ".concat(red, "\u2584\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2584").concat(R, "     "),
        "   ".concat(red, "\u2584\u2588\u2588\u2588\u2588").concat(white, "\u2588\u2588").concat(red, "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2584").concat(R, "   "),
        "   ".concat(red, "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588").concat(R, "   "),
        "     ".concat(red, "\u2580\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2580").concat(R, "     ")
    ];
    for (var _i = 0, art_1 = art; _i < art_1.length; _i++) {
        var line = art_1[_i];
        col1.push(padC(line, col1W));
    }
    col1.push(padR('', col1W));
    var provider = state.config.provider || 'openai';
    var providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
    col1.push(padC("".concat(DIM).concat(providerLabel, " (128K context)").concat(R), col1W));
    var shortenedCwd = process.cwd().replace(os_1.default.homedir(), '~');
    col1.push(padC("".concat(DIM).concat(shortenedCwd).concat(R), col1W));
    var col2 = [];
    col2.push(padR("".concat(BOLD).concat(WHITE, "Getting Started").concat(R), col2W));
    col2.push(padR("Type any prompt to ask the AI.", col2W));
    col2.push(padR("Prefix with ".concat(BRAND, "/").concat(R, " to run TUI commands:"), col2W));
    col2.push(padR("  ".concat(BRAND, "/model").concat(R, "    Change AI Model"), col2W));
    col2.push(padR("  ".concat(BRAND, "/sync").concat(R, "     Push files to Studio"), col2W));
    col2.push(padR("  ".concat(BRAND, "/config").concat(R, "   View configuration"), col2W));
    col2.push('---');
    col2.push(padR("".concat(BOLD).concat(WHITE, "What's new").concat(R), col2W));
    col2.push(padR("Server: ".concat(state.serverOnline ? "".concat(BRIGHT_GREEN, "Online").concat(R, " ").concat(DIM, "(port 3000)").concat(R) : "".concat(BRIGHT_RED, "Offline").concat(R)), col2W));
    col2.push(padR("Studio: ".concat(state.paired ? "".concat(BRIGHT_GREEN, "Paired").concat(R, " ") : "".concat(BRIGHT_YELLOW, "Not paired").concat(R)), col2W));
    col2.push(padR("Type ".concat(BRAND, "/help").concat(R, " for all commands"), col2W));
    var maxLines = Math.max(col1.length, col2.length);
    while (col1.length < maxLines)
        col1.push(padR('', col1W));
    while (col2.length < maxLines)
        col2.push(padR('', col2W));
    var rawTitle = ' Apple Juice Sync v2.1 ';
    var coloredTitle = (0, ansi_ts_1.gradientText)(rawTitle, ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
    var rawTitleLen = rawTitle.length;
    var prefix = '───';
    var G_LINE = '\x1b[38;2;100;100;100m';
    var suffix = '─'.repeat(col1W + 2 - prefix.length - rawTitleLen);
    var col1Top = "".concat(prefix).concat(coloredTitle).concat(G_LINE).concat(suffix);
    var col2Top = '─'.repeat(col2W + 2);
    process.stdout.write("\u001B[5;1H  ".concat(G_LINE, "\u250C").concat(col1Top, "\u252C").concat(col2Top, "\u2510").concat(R, "\n"));
    for (var i = 0; i < maxLines; i++) {
        var c1 = col1[i];
        var c2 = col2[i];
        if (c2 === '---') {
            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, " ").concat(c1, " ").concat(G_LINE, "\u251C").concat('─'.repeat(col2W + 2), "\u2524").concat(R, "\n"));
        }
        else {
            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, " ").concat(c1, " ").concat(G_LINE, "\u2502").concat(R, " ").concat(c2, " ").concat(G_LINE, "\u2502").concat(R, "\n"));
        }
    }
    process.stdout.write("  ".concat(G_LINE, "\u2514").concat('─'.repeat(col1W + 2), "\u2534").concat('─'.repeat(col2W + 2), "\u2518").concat(R, "\n\n"));
}
function drawFooter(serverOnline, paired) {
    var hints = "".concat(DIM, "?").concat(R, " ").concat(DIM, "for shortcuts").concat(R);
    var srv = serverOnline ? "".concat(BRIGHT_GREEN, "\u25CF server").concat(R) : "".concat(DIM, "\u25E6 server").concat(R);
    var std = paired ? "".concat(BRIGHT_GREEN, "\u2713 studio").concat(R) : "".concat(BRIGHT_YELLOW, "\u25E6 studio").concat(R);
    var rightStatus = "".concat(srv, " \u00B7 ").concat(std);
    var w = termWidth();
    var gap = Math.max(1, w - stripAnsi(hints).length - stripAnsi(rightStatus).length - 4);
    return "  ".concat(hints).concat(' '.repeat(gap)).concat(rightStatus, "\n                                                               ").concat(DIM, "\u00A9 apple juice \u00B7 /sync").concat(R, "\n\n\n");
}
function printUserMsg(text) {
    var indentedText = text.split('\n').join('\n  ');
    process.stdout.write("\n  ".concat(BOLD).concat(WHITE, "You").concat(R, "\n  ").concat(DIM).concat(indentedText).concat(R, "\n"));
}
function printAssistantMsg(text) {
    var displayText = text.trim();
    if (displayText.startsWith('{') && displayText.endsWith('}')) {
        try {
            var parsed = JSON.parse(displayText);
            if (typeof parsed.assistant === 'string')
                displayText = parsed.assistant;
            else if (typeof parsed.text === 'string')
                displayText = parsed.text;
            else if (typeof parsed.message === 'string')
                displayText = parsed.message;
            else if (typeof parsed.code === 'string')
                displayText = parsed.code;
        }
        catch (e) {
        }
    }
    process.stdout.write("\n  ".concat(BOLD).concat(BRAND, "Apple Juice").concat(R, "\n"));
    var rendered = renderMarkdown(displayText);
    for (var _i = 0, _a = rendered.split('\n'); _i < _a.length; _i++) {
        var line = _a[_i];
        process.stdout.write("  ".concat(line, "\n"));
    }
}
function printError(msg) {
    process.stdout.write("\n  ".concat(BRIGHT_RED, "\u2718").concat(R, "  ").concat(msg, "\n"));
}
function printInfo(msg) {
    process.stdout.write("\n  ".concat(DIM).concat(msg).concat(R, "\n"));
}
function printSuccess(msg) {
    process.stdout.write("\n  ".concat(BRIGHT_GREEN, "\u2713").concat(R, "  ").concat(msg, "\n"));
}
function redrawScreen(state) {
    var rows = process.stdout.rows || 24;
    if (rows < 10) {
        console.clear();
        drawHeader(state.serverOnline, state.paired, state.config);
        if (state.history.length === 0)
            drawWelcomeCard(state);
        if (state.history.length > 0) {
            var last = state.history[state.history.length - 1];
            if (last.role === 'assistant') {
                var prev = state.history[state.history.length - 2];
                if ((prev === null || prev === void 0 ? void 0 : prev.role) === 'user')
                    printUserMsg(prev.content);
                printAssistantMsg(last.content);
            }
        }
        if (globalRl)
            globalRl.prompt(true);
        return;
    }
    process.stdout.write('\x1b[r');
    console.clear();
    process.stdout.write('\x1b[1;1H');
    drawHeader(state.serverOnline, state.paired, state.config);
    process.stdout.write("\u001B[4;".concat(rows - 4, "r"));
    process.stdout.write('\x1b[4;1H');
    if (state.history.length === 0) {
        drawWelcomeCard(state);
    }
    else {
        for (var _i = 0, _a = state.history; _i < _a.length; _i++) {
            var msg = _a[_i];
            if (msg.role === 'user')
                printUserMsg(msg.content);
            else
                printAssistantMsg(msg.content);
        }
    }
    if (state.lastError)
        printError(state.lastError);
    if (state.infoMessage)
        printInfo(state.infoMessage);
    if (globalRl) {
        // Force-clear the input line and redraw prompt to prevent stale command text
        var inputRow = rows - 2;
        process.stdout.write("\u001B[".concat(inputRow, ";1H\u001B[2K"));
        globalRl.prompt(true);
    }
}
var getGlobalConfigPath = function () { return path_1.default.join(os_1.default.homedir(), '.aj.json'); };
var getLocalConfigPath = function () { return path_1.default.join(process.cwd(), '.aj.json'); };
function loadConfig() {
    var config = { sessionKey: '', apiUrl: 'http://localhost:3000', isFirstRun: true };
    try {
        var g = getGlobalConfigPath();
        if (fs_1.default.existsSync(g))
            Object.assign(config, JSON.parse(fs_1.default.readFileSync(g, 'utf8')), { isFirstRun: false });
    }
    catch (_) { }
    try {
        var l = getLocalConfigPath();
        if (fs_1.default.existsSync(l))
            Object.assign(config, JSON.parse(fs_1.default.readFileSync(l, 'utf8')));
    }
    catch (_) { }
    if (config.sessionKey)
        config.isFirstRun = false;
    if (config.themeColor) {
        applyPromptColor(config.themeColor);
    }
    else if (config.promptColor) {
        applyPromptColor(config.promptColor);
    }
    return config;
}
function saveConfig(config, global) {
    if (global === void 0) { global = false; }
    var p = global ? getGlobalConfigPath() : getLocalConfigPath();
    try {
        fs_1.default.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8');
    }
    catch (_) { }
}
function detectAndSaveProjectPath(config) {
    var markers = ['package.json', '.git', 'place.project.json'];
    var dir = process.cwd();
    for (var i = 0; i < 6; i++) {
        if (markers.some(function (m) { return fs_1.default.existsSync(path_1.default.join(dir, m)); })) {
            config.projectPath = dir;
            saveConfig(config);
            return;
        }
        var parent_1 = path_1.default.dirname(dir);
        if (parent_1 === dir)
            break;
        dir = parent_1;
    }
}
function pingServer(apiUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var ctrl_1, t, url, res, _1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    ctrl_1 = new AbortController();
                    t = setTimeout(function () { return ctrl_1.abort(); }, 1500);
                    url = apiUrl.replace('://localhost', '://127.0.0.1');
                    return [4 /*yield*/, fetch("".concat(url, "/api/projects"), { signal: ctrl_1.signal }).catch(function () { return null; })];
                case 1:
                    res = _a.sent();
                    clearTimeout(t);
                    return [2 /*return*/, !!res && (res.status === 200 || res.status === 401)];
                case 2:
                    _1 = _a.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function checkPairingStatus(config) {
    return __awaiter(this, void 0, void 0, function () {
        var res, data, _2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!config.sessionKey)
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch("".concat(config.apiUrl, "/api/status?key=").concat(encodeURIComponent(config.sessionKey), "&t=").concat(Date.now()))];
                case 2:
                    res = _a.sent();
                    if (!res.ok)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, res.json().catch(function () { return null; })];
                case 3:
                    data = _a.sent();
                    return [2 /*return*/, !!data && data.status === 'ok' && !!data.lastPollTime && (Date.now() - data.lastPollTime < 10000)];
                case 4:
                    _2 = _a.sent();
                    return [2 /*return*/, false];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function startServerAutomatically(config) {
    return __awaiter(this, void 0, void 0, function () {
        var isPkg, cmd, args, env, child, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    process.stdout.write("\n  ".concat(BRAND, "\u26A1").concat(R, "  Starting local server\u2026\n"));
                    try {
                        isPkg = typeof process.pkg !== 'undefined';
                        cmd = 'node';
                        args = __spreadArray(__spreadArray([], process.execArgv, true), [process.argv[1] || '', 'server'], false);
                        if (isPkg) {
                            cmd = process.execPath;
                            args = [];
                        }
                        env = {
                            AJ_MODE: 'server', PATH: process.env.PATH || '',
                            SystemRoot: process.env.SystemRoot || 'C:\\Windows',
                            windir: process.env.windir || 'C:\\Windows',
                            USERPROFILE: process.env.USERPROFILE || '',
                            HOMEDRIVE: process.env.HOMEDRIVE || '',
                            HOMEPATH: process.env.HOMEPATH || '',
                            APPDATA: process.env.APPDATA || '',
                            LOCALAPPDATA: process.env.LOCALAPPDATA || '',
                        };
                        child = (0, child_process_1.spawn)(cmd, args, {
                            detached: true, stdio: 'ignore',
                            windowsHide: true, cwd: config.projectPath || process.cwd(),
                            env: env,
                        });
                        child.unref();
                    }
                    catch (e) {
                        process.stdout.write("  ".concat(BRIGHT_RED, "\u2717").concat(R, "  Failed to start: ").concat(e.message, "\n"));
                        return [2 /*return*/, false];
                    }
                    startSpinner('Waiting for server');
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < 40)) return [3 /*break*/, 7];
                    return [4 /*yield*/, pingServer(config.apiUrl)];
                case 2:
                    if (!_a.sent()) return [3 /*break*/, 4];
                    stopSpinner();
                    printSuccess("Server online at ".concat(BRAND).concat(config.apiUrl).concat(R));
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 100); })];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4: return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 250); })];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    i++;
                    return [3 /*break*/, 1];
                case 7:
                    stopSpinner();
                    process.stdout.write("\n  ".concat(BRIGHT_YELLOW, "\u26A0").concat(R, "  Server still starting \u2014 proceeding.\n"));
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 300); })];
                case 8:
                    _a.sent();
                    return [2 /*return*/, false];
            }
        });
    });
}
function generateAuthCode() {
    return __awaiter(this, void 0, void 0, function () {
        var chars, code, i;
        return __generator(this, function (_a) {
            chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            code = '';
            for (i = 0; i < 6; i++)
                code += chars[crypto_1.default.randomInt(0, chars.length)];
            return [2 /*return*/, code];
        });
    });
}
function initAuthPairing(config) {
    return __awaiter(this, void 0, void 0, function () {
        var authCode, res, data, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!config.cliUserId) {
                        config.cliUserId = crypto_1.default.randomBytes(8).toString('hex');
                        saveConfig(config, true);
                    }
                    return [4 /*yield*/, generateAuthCode()];
                case 1:
                    authCode = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, fetch("".concat(config.apiUrl, "/api/pair/init"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ authCode: authCode, cliUserId: config.cliUserId }),
                        })];
                case 3:
                    res = _a.sent();
                    if (!res.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, res.json()];
                case 4:
                    data = _a.sent();
                    config.sessionKey = data.sessionKey;
                    config.isFirstRun = false;
                    saveConfig(config);
                    return [2 /*return*/, authCode];
                case 5:
                    process.stdout.write("\n".concat(BRIGHT_RED, "\u2717").concat(R, "  Failed to initialize pairing (").concat(res.status, ")\n"));
                    return [3 /*break*/, 7];
                case 6:
                    e_1 = _a.sent();
                    process.stdout.write("\n".concat(BRIGHT_RED, "\u2717").concat(R, "  Server error: ").concat(e_1.message, "\n"));
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, null];
            }
        });
    });
}
function parseHelpFile() {
    var fallback = {
        shortcuts: [
            "  ".concat(DIM, "!").concat(R, " for shell mode            ").concat(DIM, "double tap esc").concat(R, " to clear input        ").concat(DIM, "ctrl + shift + _").concat(R, " to undo"),
            "  ".concat(DIM, "/").concat(R, " for commands              ").concat(DIM, "shift + tab").concat(R, " to auto-accept edits      ").concat(DIM, "alt + v").concat(R, " to paste images"),
            "  ".concat(DIM, "@").concat(R, " for file paths            ").concat(DIM, "ctrl + o").concat(R, " for verbose output           ").concat(DIM, "alt + p").concat(R, " to switch model"),
            "  ".concat(DIM, "&").concat(R, " for background            ").concat(DIM, "ctrl + t").concat(R, " to toggle tasks               ").concat(DIM, "ctrl + s").concat(R, " to stash prompt"),
            "  ".concat(DIM, "/btw").concat(R, " for side question      ").concat(DIM, "backslash (\\) + return (\u23CE)").concat(R, " for     ").concat(DIM, "ctrl + g").concat(R, " to edit in $EDITOR"),
            "                              newline                                ".concat(DIM, "/keybindings").concat(R, " to customize")
        ],
        defaultCommands: [
            ['/add-dir', 'Add a new working directory'],
            ['/agents', 'Manage agent configurations'],
            ['/background', 'Send this session to the background and free the terminal'],
            ['/branch', 'Create a branch of the current conversation at this point'],
            ['/btw', 'Ask a quick side question without interrupting the main conversation'],
            ['/clear', 'Start a new session with empty context; previous session stays on disk (resumable with /resume)'],
            ['/resume', 'Restore the previous session cleared with /clear'],
            ['/color', 'Set the prompt bar color for this session'],
            ['/compact', 'Free up context by summarizing the conversation so far'],
            ['/config', 'Open config panel'],
            ['/context', 'Visualize current context usage as a colored grid'],
        ],
        customCommands: [
            ['/pair', 'Link terminal to Roblox Studio'],
            ['/status', 'Refresh server + Studio status'],
            ['/sync', 'AI-edit a file and push to Studio'],
            ['/provider', 'Set API provider (openai|google|deepseek|openrouter)'],
            ['/key', 'Set API key (optional provider)'],
            ['/model', 'Select AI model interactively'],
            ['/config', 'Show configuration'],
            ['/clear', 'Clear history and screen'],
            ['/exit', 'Quit Apple Juice CLI'],
        ],
    };
    try {
        var possiblePaths = [
            path_1.default.join(process.cwd(), 'cli', 'help.txt'),
            path_1.default.join(process.cwd(), 'help.txt'),
            path_1.default.join(__dirname, 'help.txt'),
            path_1.default.join(__dirname, 'cli', 'help.txt'),
            path_1.default.join(__dirname, '..', 'cli', 'help.txt'),
        ];
        var content = '';
        for (var _i = 0, possiblePaths_1 = possiblePaths; _i < possiblePaths_1.length; _i++) {
            var p = possiblePaths_1[_i];
            if (fs_1.default.existsSync(p)) {
                content = fs_1.default.readFileSync(p, 'utf8');
                break;
            }
        }
        if (!content)
            return fallback;
        var lines = content.split(/\r?\n/);
        var shortcuts = [];
        var defaultCommands = [];
        var customCommands = [];
        var currentSection = '';
        var lastCmd = '';
        var keyMap = {
            '!': "".concat(DIM, "!").concat(R),
            '/': "".concat(DIM, "/").concat(R),
            '@': "".concat(DIM, "@").concat(R),
            '&': "".concat(DIM, "&").concat(R),
            '/btw': "".concat(DIM, "/btw").concat(R),
            'double tap esc': "".concat(DIM, "double tap esc").concat(R),
            'shift + tab': "".concat(DIM, "shift + tab").concat(R),
            'ctrl + o': "".concat(DIM, "ctrl + o").concat(R),
            'ctrl + t': "".concat(DIM, "ctrl + t").concat(R),
            'backslash (\\) + return (⏎)': "".concat(DIM, "backslash (\\) + return (\u23CE)").concat(R),
            'ctrl + shift + _': "".concat(DIM, "ctrl + shift + _").concat(R),
            'alt + v': "".concat(DIM, "alt + v").concat(R),
            'alt + p': "".concat(DIM, "alt + p").concat(R),
            'ctrl + s': "".concat(DIM, "ctrl + s").concat(R),
            'ctrl + g': "".concat(DIM, "ctrl + g").concat(R),
            '/keybindings': "".concat(DIM, "/keybindings").concat(R),
        };
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var trimmed = line.trim();
            if (!trimmed)
                continue;
            var lowerTrimmed = trimmed.toLowerCase();
            if (lowerTrimmed === 'shortcuts') {
                currentSection = 'shortcuts';
                continue;
            }
            else if (lowerTrimmed === 'default commands') {
                currentSection = 'default commands';
                continue;
            }
            else if (lowerTrimmed === 'custom commands') {
                currentSection = 'custom commands';
                continue;
            }
            if (currentSection === 'shortcuts') {
                var styled = line;
                for (var _a = 0, _b = Object.entries(keyMap); _a < _b.length; _a++) {
                    var _c = _b[_a], rawKey = _c[0], styledKey = _c[1];
                    styled = styled.split(rawKey).join(styledKey);
                }
                shortcuts.push('  ' + styled);
            }
            else if (currentSection === 'default commands' || currentSection === 'custom commands') {
                if (trimmed.startsWith('/')) {
                    lastCmd = trimmed;
                }
                else if (lastCmd) {
                    var list = currentSection === 'default commands' ? defaultCommands : customCommands;
                    list.push([lastCmd, trimmed]);
                    lastCmd = '';
                }
            }
        }
        if (shortcuts.length === 0 && defaultCommands.length === 0 && customCommands.length === 0) {
            return fallback;
        }
        return {
            shortcuts: shortcuts.length > 0 ? shortcuts : fallback.shortcuts,
            defaultCommands: defaultCommands.length > 0 ? defaultCommands : fallback.defaultCommands,
            customCommands: customCommands.length > 0 ? customCommands : fallback.customCommands,
        };
    }
    catch (e) {
        return fallback;
    }
}
function drawHelpTab(tabIndex, helpData) {
    console.clear();
    var w = termWidth();
    var titleText = (0, ansi_ts_1.gradientText)('Apple Juice', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
    process.stdout.write("\n  ".concat(BOLD).concat(titleText).concat(R, "  ").concat(DIM, "Help & Shortcuts").concat(R, "\n"));
    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
    var tabs = ['Help', 'General', 'Commands', 'Custom commands'];
    var tabLine = '  ';
    for (var i = 0; i < tabs.length; i++) {
        var active = i === tabIndex;
        var tabName = " ".concat(tabs[i], " ");
        if (active) {
            tabLine += "".concat(BOLD, "\u001B[48;2;40;100;200m\u001B[38;2;255;255;255m").concat(tabName).concat(R, "  ");
        }
        else {
            tabLine += "".concat(DIM).concat(tabName).concat(R, "  ");
        }
    }
    process.stdout.write(tabLine + '\n');
    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
    if (tabIndex === 0) {
        process.stdout.write("  ".concat(BOLD, "Apple Juice Sync v2.1").concat(R, "\n\n"));
        process.stdout.write("  Apple Juice is an AI-powered sync interface designed to sync your local workspace\n");
        process.stdout.write("  directly to Roblox Studio while using powerful LLM generation.\n\n");
        process.stdout.write("  ".concat(BRAND, "\u2022").concat(R, " Type any chat message to chat with the AI about your Roblox scripts.\n"));
        process.stdout.write("  ".concat(BRAND, "\u2022").concat(R, " Use slash commands like ").concat(BRAND, "/sync").concat(R, " to automatically edit files.\n"));
        process.stdout.write("  ".concat(BRAND, "\u2022").concat(R, " Use the arrow keys \u2190 and \u2192 to navigate the other tabs for shortcuts & commands.\n"));
    }
    else if (tabIndex === 1) {
        process.stdout.write("  ".concat(BOLD, "Shortcuts").concat(R, "\n\n"));
        for (var _i = 0, _a = helpData.shortcuts; _i < _a.length; _i++) {
            var line = _a[_i];
            process.stdout.write(line + '\n');
        }
        process.stdout.write("\n  ".concat(DIM, "For more help: https://code.claude.com/docs/en/overview").concat(R, "\n"));
    }
    else if (tabIndex === 2) {
        process.stdout.write("  ".concat(BOLD, "Default Commands").concat(R, "\n\n"));
        for (var _b = 0, _c = helpData.defaultCommands; _b < _c.length; _b++) {
            var _d = _c[_b], c = _d[0], d = _d[1];
            process.stdout.write("  ".concat(BRAND).concat(c.padEnd(16)).concat(R).concat(DIM).concat(d).concat(R, "\n"));
        }
    }
    else if (tabIndex === 3) {
        process.stdout.write("  ".concat(BOLD, "Custom Commands").concat(R, "\n\n"));
        for (var _e = 0, _f = helpData.customCommands; _e < _f.length; _e++) {
            var _g = _f[_e], c = _g[0], d = _g[1];
            process.stdout.write("  ".concat(BRAND).concat(c.padEnd(16)).concat(R).concat(DIM).concat(d).concat(R, "\n"));
        }
    }
    process.stdout.write("\n  ".concat(DIM, "Use \u2190 and \u2192 arrow keys to switch tabs \u00B7 Esc to close").concat(R, "\n"));
}
function showInteractiveHelp(rl, state) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var tabIndex = 0;
                    var helpData = parseHelpFile();
                    var origTtyWrite = rl._ttyWrite;
                    rl._ttyWrite = function () { };
                    drawHelpTab(tabIndex, helpData);
                    var openedAt = Date.now();
                    var onKeypress = function (str, key) {
                        if (!key)
                            return;
                        if (key.ctrl && key.name === 'c') {
                            cleanup();
                            process.stdout.write('\x1b[r');
                            process.exit(0);
                        }
                        if (key.name === 'return' && Date.now() - openedAt < 300) {
                            return;
                        }
                        if (key.name === 'escape' || key.name === 'return') {
                            cleanup();
                            resolve();
                            return;
                        }
                        if (key.name === 'right') {
                            tabIndex = (tabIndex + 1) % 4;
                            drawHelpTab(tabIndex, helpData);
                        }
                        else if (key.name === 'left') {
                            tabIndex = (tabIndex - 1 + 4) % 4;
                            drawHelpTab(tabIndex, helpData);
                        }
                    };
                    function cleanup() {
                        process.stdin.removeListener('keypress', onKeypress);
                        rl._ttyWrite = origTtyWrite;
                    }
                    process.stdin.on('keypress', onKeypress);
                })];
        });
    });
}
function renderWordDiff(original, modified) {
    var lineDiffs = Diff.diffLines(original, modified);
    var outLines = [];
    var w = Math.min(termWidth() - 8, 70);
    var BG_ADD = '\x1b[48;2;20;70;30m\x1b[38;2;255;255;255m';
    var BG_REM = '\x1b[48;2;80;20;20m\x1b[38;2;255;255;255m';
    for (var idx = 0; idx < lineDiffs.length; idx++) {
        var part = lineDiffs[idx];
        var lines = part.value.split('\n');
        if (lines[lines.length - 1] === '')
            lines.pop();
        if (part.added) {
            for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                var line = lines_2[_i];
                outLines.push("".concat(BRIGHT_GREEN, "+").concat(R, " ").concat(BG_ADD, " ").concat(line, " ").concat(R));
            }
        }
        else if (part.removed) {
            for (var _a = 0, lines_3 = lines; _a < lines_3.length; _a++) {
                var line = lines_3[_a];
                outLines.push("".concat(BRIGHT_RED, "-").concat(R, " ").concat(BG_REM, " ").concat(line, " ").concat(R));
            }
        }
        else {
            if (lines.length > 8) {
                outLines.push("  ".concat(DIM, "[... ").concat(lines.length - 4, " unchanged lines collapsed ...]").concat(R));
                outLines.push("  ".concat(DIM).concat(lines[lines.length - 2]).concat(R));
                outLines.push("  ".concat(DIM).concat(lines[lines.length - 1]).concat(R));
            }
            else {
                for (var _b = 0, lines_4 = lines; _b < lines_4.length; _b++) {
                    var line = lines_4[_b];
                    outLines.push("  ".concat(DIM).concat(line).concat(R));
                }
            }
        }
    }
    return outLines.join('\n');
}
function showInteractiveArtifacts(rl, state) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(!state.artifacts || state.artifacts.length === 0)) return [3 /*break*/, 2];
                    printInfo('No active artifacts to review.');
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1500); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2: return [2 /*return*/, new Promise(function (resolve) {
                        var selectedIndex = 0;
                        var selectedButton = 'open';
                        var viewMode = 'list';
                        var totalLinesDrawn = 0;
                        var origTtyWrite = rl._ttyWrite;
                        rl._ttyWrite = function () { };
                        var wasRaw = process.stdin.isRaw;
                        if (process.stdin.isTTY)
                            process.stdin.setRawMode(true);
                        readline.emitKeypressEvents(process.stdin);
                        var listHeight = state.artifacts.length + 6;
                        process.stdout.write('\n'.repeat(listHeight));
                        process.stdout.write("\u001B[".concat(listHeight, "A"));
                        var draw = function () {
                            if (totalLinesDrawn > 0) {
                                process.stdout.write("\u001B[".concat(totalLinesDrawn, "A"));
                            }
                            var output = '';
                            var w = termWidth();
                            if (viewMode === 'list') {
                                var titleText = (0, ansi_ts_1.gradientText)('Apple Juice Artifact Reviewer', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
                                output += "  ".concat(BOLD).concat(titleText).concat(R, "\n");
                                output += "  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n");
                                for (var i = 0; i < state.artifacts.length; i++) {
                                    var a = state.artifacts[i];
                                    var isActive = i === selectedIndex;
                                    var statusBadge = "".concat(DIM, "[ Pending ]").concat(R);
                                    if (a.status === 'approved')
                                        statusBadge = "".concat(BRIGHT_GREEN, "[ Approved ]").concat(R);
                                    else if (a.status === 'rejected')
                                        statusBadge = "".concat(BRIGHT_RED, "[ Rejected ]").concat(R);
                                    var actionText = a.action === 'delete' ? "".concat(BRIGHT_RED, "[DELETE]").concat(R) : a.action === 'create' ? "".concat(BRIGHT_GREEN, "[NEW]").concat(R) : "".concat(BRIGHT_YELLOW, "[MODIFY]").concat(R);
                                    var openBtn = (isActive && selectedButton === 'open') ? "\u001B[7m Open \u001B[27m" : "[ Open ]";
                                    var acceptBtn = (isActive && selectedButton === 'accept') ? "\u001B[7m Accept \u001B[27m" : "[ Accept ]";
                                    var rejectBtn = (isActive && selectedButton === 'reject') ? "\u001B[7m Reject \u001B[27m" : "[ Reject ]";
                                    if (isActive) {
                                        output += "  ".concat(BRAND, "\u2794").concat(R, " ").concat(BOLD).concat(WHITE).concat(a.name).concat(R, " in ").concat(DIM).concat(a.parent).concat(R, " ").concat(actionText, "  ").concat(openBtn, "  ").concat(acceptBtn, "  ").concat(rejectBtn, "  ").concat(statusBadge, "\n");
                                    }
                                    else {
                                        output += "    ".concat(a.name, " in ").concat(DIM).concat(a.parent).concat(R, " ").concat(actionText, "  [ Open ]  [ Accept ]  [ Reject ]  ").concat(statusBadge, "\n");
                                    }
                                }
                                output += "  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n");
                                output += "  ".concat(BOLD).concat(WHITE, "Commands:").concat(R, " Arrow keys to navigate \u00B7 Enter to select \u00B7 Esc to return\n");
                            }
                            else {
                                var a = state.artifacts[selectedIndex];
                                var titleText = (0, ansi_ts_1.gradientText)("Diff for ".concat(a.name), ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
                                output += "  ".concat(BOLD).concat(titleText).concat(R, "  [").concat(a.parent, "]\n");
                                output += "  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n");
                                var originalCode = '';
                                try {
                                    var possiblePath = path_1.default.resolve(process.cwd(), a.name);
                                    if (fs_1.default.existsSync(possiblePath)) {
                                        originalCode = fs_1.default.readFileSync(possiblePath, 'utf8');
                                    }
                                }
                                catch (_) { }
                                var diffText = renderWordDiff(originalCode, a.code);
                                output += diffText + '\n';
                                output += "  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n");
                                output += "  ".concat(BRAND, "Esc / Backspace").concat(R, " to return to list\n");
                            }
                            var lines = output.split('\n');
                            if (lines[lines.length - 1] === '') {
                                lines.pop();
                            }
                            for (var _i = 0, lines_5 = lines; _i < lines_5.length; _i++) {
                                var line = lines_5[_i];
                                process.stdout.write("\u001B[2K".concat(line, "\n"));
                            }
                            totalLinesDrawn = lines.length;
                        };
                        draw();
                        var onKeypress = function (str, key) { return __awaiter(_this, void 0, void 0, function () {
                            var i, a, pushRes, e_2, a, i;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!key)
                                            return [2 /*return*/];
                                        if (key.ctrl && key.name === 'c') {
                                            cleanup();
                                            process.stdout.write('\x1b[r');
                                            process.exit(0);
                                        }
                                        if (!(viewMode === 'list')) return [3 /*break*/, 13];
                                        if (key.name === 'escape') {
                                            cleanup();
                                            resolve();
                                            return [2 /*return*/];
                                        }
                                        if (!(key.name === 'up')) return [3 /*break*/, 1];
                                        selectedIndex = (selectedIndex - 1 + state.artifacts.length) % state.artifacts.length;
                                        draw();
                                        return [3 /*break*/, 12];
                                    case 1:
                                        if (!(key.name === 'down')) return [3 /*break*/, 2];
                                        selectedIndex = (selectedIndex + 1) % state.artifacts.length;
                                        draw();
                                        return [3 /*break*/, 12];
                                    case 2:
                                        if (!(key.name === 'left')) return [3 /*break*/, 3];
                                        if (selectedButton === 'reject')
                                            selectedButton = 'accept';
                                        else if (selectedButton === 'accept')
                                            selectedButton = 'open';
                                        draw();
                                        return [3 /*break*/, 12];
                                    case 3:
                                        if (!(key.name === 'right')) return [3 /*break*/, 4];
                                        if (selectedButton === 'open')
                                            selectedButton = 'accept';
                                        else if (selectedButton === 'accept')
                                            selectedButton = 'reject';
                                        draw();
                                        return [3 /*break*/, 12];
                                    case 4:
                                        if (!(key.name === 'return' || key.name === 'enter')) return [3 /*break*/, 12];
                                        if (!(selectedButton === 'open')) return [3 /*break*/, 5];
                                        viewMode = 'diff';
                                        if (totalLinesDrawn > 0) {
                                            process.stdout.write("\u001B[".concat(totalLinesDrawn, "A"));
                                            for (i = 0; i < totalLinesDrawn; i++) {
                                                process.stdout.write('\x1b[2K\n');
                                            }
                                            process.stdout.write("\u001B[".concat(totalLinesDrawn, "A"));
                                            totalLinesDrawn = 0;
                                        }
                                        draw();
                                        return [3 /*break*/, 12];
                                    case 5:
                                        if (!(selectedButton === 'accept')) return [3 /*break*/, 11];
                                        a = state.artifacts[selectedIndex];
                                        a.status = 'approved';
                                        cleanup();
                                        state.infoMessage = "Syncing ".concat(a.name, " to Roblox Studio...");
                                        redrawScreen(state);
                                        _a.label = 6;
                                    case 6:
                                        _a.trys.push([6, 8, , 9]);
                                        return [4 /*yield*/, fetch("".concat(state.config.apiUrl, "/api/cli/push-scripts"), {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    sessionKey: state.config.sessionKey,
                                                    scripts: [a]
                                                }),
                                            })];
                                    case 7:
                                        pushRes = _a.sent();
                                        if (pushRes.ok) {
                                            state.infoMessage = "".concat(BRIGHT_GREEN, "\u2713").concat(R, " Successfully synced ").concat(a.name, " to Roblox Studio!");
                                        }
                                        else {
                                            state.lastError = "Studio push failed: ".concat(pushRes.statusText);
                                        }
                                        return [3 /*break*/, 9];
                                    case 8:
                                        e_2 = _a.sent();
                                        state.lastError = "Studio push error: ".concat(e_2.message);
                                        return [3 /*break*/, 9];
                                    case 9:
                                        redrawScreen(state);
                                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                                    case 10:
                                        _a.sent();
                                        state.infoMessage = undefined;
                                        state.lastError = undefined;
                                        process.stdout.write('\n'.repeat(listHeight));
                                        process.stdout.write("\u001B[".concat(listHeight, "A"));
                                        totalLinesDrawn = 0;
                                        process.stdin.on('keypress', onKeypress);
                                        rl._ttyWrite = function () { };
                                        draw();
                                        return [3 /*break*/, 12];
                                    case 11:
                                        if (selectedButton === 'reject') {
                                            a = state.artifacts[selectedIndex];
                                            a.status = 'rejected';
                                            draw();
                                        }
                                        _a.label = 12;
                                    case 12: return [3 /*break*/, 14];
                                    case 13:
                                        if (key.name === 'escape' || key.name === 'backspace') {
                                            if (totalLinesDrawn > 0) {
                                                process.stdout.write("\u001B[".concat(totalLinesDrawn, "A"));
                                                for (i = 0; i < totalLinesDrawn; i++) {
                                                    process.stdout.write('\x1b[2K\n');
                                                }
                                                process.stdout.write("\u001B[".concat(totalLinesDrawn, "A"));
                                                totalLinesDrawn = 0;
                                            }
                                            viewMode = 'list';
                                            draw();
                                        }
                                        _a.label = 14;
                                    case 14: return [2 /*return*/];
                                }
                            });
                        }); };
                        function cleanup() {
                            process.stdin.removeListener('keypress', onKeypress);
                            rl._ttyWrite = origTtyWrite;
                            if (totalLinesDrawn > 0) {
                                process.stdout.write("\u001B[".concat(totalLinesDrawn, "A"));
                                for (var i = 0; i < totalLinesDrawn; i++) {
                                    process.stdout.write('\x1b[2K\n');
                                }
                                process.stdout.write("\u001B[".concat(totalLinesDrawn, "A"));
                            }
                        }
                        process.stdin.on('keypress', onKeypress);
                    })];
            }
        });
    });
}
function handleFeedbackSync(rl, state, feedbackMsg) {
    return __awaiter(this, void 0, void 0, function () {
        var res, err, data, reply, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startSpinner('Thinking', false);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, fetch("".concat(state.config.apiUrl, "/api/chat"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                prompt: feedbackMsg,
                                sessionKey: state.config.sessionKey,
                                messages: state.history,
                                provider: state.config.provider,
                                apiKey: state.config.provider === 'google' ? state.config.googleKey
                                    : state.config.provider === 'deepseek' ? state.config.deepseekKey
                                        : state.config.provider === 'openrouter' ? state.config.openrouterKey
                                            : state.config.openaiKey,
                                openaiKey: state.config.openaiKey,
                                model: state.config.model,
                            }),
                        })];
                case 2:
                    res = _a.sent();
                    stopSpinner();
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                case 3:
                    err = _a.sent();
                    state.lastError = "Steering failed: ".concat(err.error || res.statusText);
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                case 5:
                    data = _a.sent();
                    reply = (data.message || data.code || JSON.stringify(data));
                    if (Array.isArray(data.scripts) && data.scripts.length > 0) {
                        reply += formatArtifactsBox(data.scripts);
                        state.artifacts = data.scripts.map(function (s, i) { return ({
                            action: s.action || 'create',
                            type: s.type || s.scriptType || 'Script',
                            parent: s.parent || 'ServerScriptService',
                            name: s.name || "GeneratedScript_".concat(i),
                            code: s.code || '',
                            status: 'pending'
                        }); });
                        state.infoMessage = "\u2728 Generated ".concat(data.scripts.length, " adjusted artifacts! Type /artifact to view.");
                    }
                    state.history.push({ role: 'assistant', content: reply });
                    _a.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    e_3 = _a.sent();
                    stopSpinner();
                    state.lastError = "Feedback error: ".concat(e_3.message);
                    return [3 /*break*/, 8];
                case 8:
                    redrawScreen(state);
                    rl.prompt();
                    return [2 /*return*/];
            }
        });
    });
}
function showInteractiveSettings(rl, state) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var selectedIndex = 0;
                    var options = ['themeColor', 'chatbarStyle', 'showTokenPricing'];
                    var optionLabels = ['UI Theme Color', 'Chatbar Prompt Style', 'Show Token Metrics & Cost'];
                    var origTtyWrite = rl._ttyWrite;
                    rl._ttyWrite = function () { };
                    var wasRaw = process.stdin.isRaw;
                    if (process.stdin.isTTY)
                        process.stdin.setRawMode(true);
                    readline.emitKeypressEvents(process.stdin);
                    var draw = function () {
                        console.clear();
                        var w = termWidth();
                        var titleText = (0, ansi_ts_1.gradientText)('Apple Juice Personal Settings', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
                        var white_shine = '\x1b[38;2;255;255;255m';
                        process.stdout.write("\n  ".concat(BOLD).concat(titleText).concat(R, "\n"));
                        process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
                        for (var i = 0; i < options.length; i++) {
                            var opt = options[i];
                            var label = optionLabels[i];
                            var valDisplay = '';
                            if (opt === 'themeColor') {
                                valDisplay = state.config.themeColor || 'terracotta';
                            }
                            else if (opt === 'chatbarStyle') {
                                valDisplay = state.config.chatbarStyle || 'mode';
                            }
                            else if (opt === 'showTokenPricing') {
                                valDisplay = state.config.showTokenPricing !== false ? 'Enabled' : 'Disabled';
                            }
                            var active = i === selectedIndex;
                            if (active) {
                                process.stdout.write("  ".concat(BRAND, "\u2794").concat(R, " ").concat(BOLD).concat(WHITE).concat(label.padEnd(30)).concat(R, " :  ").concat(BRAND, "[ ").concat(valDisplay, " ]").concat(R, "\n"));
                            }
                            else {
                                process.stdout.write("    ".concat(DIM).concat(label.padEnd(30)).concat(R, " :  [ ").concat(valDisplay, " ]\n"));
                            }
                        }
                        process.stdout.write("\n  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n"));
                        var G_LINE = '\x1b[38;2;100;100;100m';
                        process.stdout.write("  ".concat(BOLD).concat(WHITE, "Live Preview Panel:").concat(R, "\n"));
                        process.stdout.write("  ".concat(G_LINE, "\u250C").concat('─'.repeat(w - 6), "\u2510").concat(R, "\n"));
                        var currentOpt = options[selectedIndex];
                        if (currentOpt === 'themeColor') {
                            var colorsList = THEME_COLORS.map(function (c) {
                                var cAnsi = BRAND;
                                if (c === 'red')
                                    cAnsi = '\x1b[38;2;230;30;30m';
                                else if (c === 'blue')
                                    cAnsi = '\x1b[38;2;40;110;230m';
                                else if (c === 'green')
                                    cAnsi = '\x1b[38;2;46;204;113m';
                                else if (c === 'yellow')
                                    cAnsi = '\x1b[38;2;241;196;15m';
                                else if (c === 'cyan')
                                    cAnsi = '\x1b[38;2;52;152;219m';
                                else
                                    cAnsi = '\x1b[38;2;204;107;73m';
                                var isSelected = c === (state.config.themeColor || 'terracotta');
                                return isSelected ? "".concat(cAnsi).concat(BOLD, "\u001B[4m[ ").concat(c, " ]\u001B[24m").concat(R) : "".concat(cAnsi).concat(c).concat(R);
                            }).join('  ');
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(BOLD, "Theme Colors:").concat(R, "  ").concat(colorsList, "  ").padEnd(w + 35) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(BOLD, "Example Conversation Preview:").concat(R).padEnd(w + 10) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            var colUserPrompt = "  ".concat(BRAND, "\u2794").concat(R, "  ").concat(WHITE, "User:").concat(R, " ").concat(DIM, "How do I create a script parented to Workspace?").concat(R);
                            var divLine = "".concat(BRAND_DIM).concat('-'.repeat(Math.max(10, w - 12))).concat(R);
                            var colAssist1 = "     ".concat(WHITE, "Assistant:").concat(R, " ").concat(DIM, "You can write a script or use ").concat(R).concat(BRAND_B, "/sync").concat(R).concat(DIM, " to").concat(R);
                            var colAssist2 = "     ".concat(DIM, "generate it. Let's create it in ServerScriptService.").concat(R);
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(colUserPrompt).padEnd(w + 30) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(divLine).padEnd(w + 10) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(colAssist1).padEnd(w + 35) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(colAssist2).padEnd(w + 25) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(divLine).padEnd(w + 10) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                        }
                        else if (currentOpt === 'chatbarStyle') {
                            var styles = ['mode', 'minimal', 'model', 'both'];
                            var stylesList = styles.map(function (s) {
                                var isSelected = s === (state.config.chatbarStyle || 'mode');
                                return isSelected ? "".concat(BRAND).concat(BOLD, "\u001B[4m[ ").concat(s, " ]\u001B[24m").concat(R) : "".concat(DIM).concat(s).concat(R);
                            }).join('  ');
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(BOLD, "Style Options:").concat(R, "  ").concat(stylesList).padEnd(w + 35) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(BOLD, "Live Prompt Preview:").concat(R).padEnd(w + 10) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            var mockPrompt = '';
                            var style = state.config.chatbarStyle || 'mode';
                            if (style === 'mode') {
                                mockPrompt = "\u001B[38;2;140;140;140m[ Normal ]\u001B[0m ".concat(BRAND, "\u203A\u001B[0m  _");
                            }
                            else if (style === 'minimal') {
                                mockPrompt = "".concat(BRAND, "\u203A\u001B[0m  _");
                            }
                            else if (style === 'model') {
                                mockPrompt = "\u001B[38;2;140;140;140m[ gpt-4o-mini ]\u001B[0m ".concat(BRAND, "\u203A\u001B[0m  _");
                            }
                            else if (style === 'both') {
                                mockPrompt = "\u001B[38;2;140;140;140m[ Normal | gpt-4o-mini ]\u001B[0m ".concat(BRAND, "\u203A\u001B[0m  _");
                            }
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(mockPrompt).padEnd(w + 40) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                        }
                        else if (currentOpt === 'showTokenPricing') {
                            var showPricing = state.config.showTokenPricing !== false;
                            var toggleList = "".concat(showPricing ? "".concat(BRAND).concat(BOLD, "\u001B[4m[ Enabled ]\u001B[24m").concat(R, "  ").concat(DIM, "Disabled").concat(R) : "".concat(DIM, "Enabled").concat(R, "  ").concat(BRAND).concat(BOLD, "\u001B[4m[ Disabled ]\u001B[24m").concat(R));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(BOLD, "Status Option:").concat(R, "  ").concat(toggleList).padEnd(w + 35) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(BOLD, "Status Line Live Preview:").concat(R).padEnd(w + 10) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            var bottomLine = '';
                            if (showPricing) {
                                var leftPart = "gpt-4o-mini | \uD83D\uDCC1 project | \uD83D\uDD00 main | ".concat(BRIGHT_GREEN, "\u25CF server").concat(R, " \u00B7 ").concat(BRIGHT_GREEN, "\u2713 studio").concat(R);
                                var rightPart = "$0.045 / 312 tokens";
                                bottomLine = drawHorizontalLineWithText(leftPart, rightPart);
                            }
                            else {
                                var leftPart = "gpt-4o-mini | \uD83D\uDCC1 project | \uD83D\uDD00 main | ".concat(BRIGHT_GREEN, "\u25CF server").concat(R, " \u00B7 ").concat(BRIGHT_GREEN, "\u2713 studio").concat(R);
                                var rightPart = getContextBar(state.history);
                                bottomLine = drawHorizontalLineWithText(leftPart, rightPart);
                            }
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").concat(bottomLine).padEnd(w + 40) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                            process.stdout.write("  ".concat(G_LINE, "\u2502").concat(R, "  ").padEnd(w - 4) + "".concat(G_LINE, "\u2502").concat(R, "\n"));
                        }
                        process.stdout.write("  ".concat(G_LINE, "\u2514").concat('─'.repeat(w - 6), "\u2518").concat(R, "\n"));
                        process.stdout.write("\n  Use \u2191/\u2193 to navigate \u00B7 Enter to cycle value \u00B7 Esc to save and close\n");
                    };
                    draw();
                    var onKeypress = function (str, key) {
                        if (!key)
                            return;
                        if (key.ctrl && key.name === 'c') {
                            cleanup();
                            process.stdout.write('\x1b[r');
                            process.exit(0);
                        }
                        if (key.name === 'escape') {
                            cleanup();
                            saveConfig(state.config);
                            resolve();
                            return;
                        }
                        if (key.name === 'up') {
                            selectedIndex = (selectedIndex - 1 + options.length) % options.length;
                            draw();
                        }
                        else if (key.name === 'down') {
                            selectedIndex = (selectedIndex + 1) % options.length;
                            draw();
                        }
                        else if (key.name === 'return' || key.name === 'enter') {
                            var opt = options[selectedIndex];
                            if (opt === 'themeColor') {
                                var current = state.config.themeColor || 'terracotta';
                                var nextIdx = (THEME_COLORS.indexOf(current) + 1) % THEME_COLORS.length;
                                state.config.themeColor = THEME_COLORS[nextIdx];
                                applyPromptColor(state.config.themeColor);
                            }
                            else if (opt === 'chatbarStyle') {
                                var current = state.config.chatbarStyle || 'mode';
                                var styles = ['mode', 'minimal', 'model', 'both'];
                                var nextIdx = (styles.indexOf(current) + 1) % styles.length;
                                state.config.chatbarStyle = styles[nextIdx];
                            }
                            else if (opt === 'showTokenPricing') {
                                var current = state.config.showTokenPricing !== false;
                                state.config.showTokenPricing = !current;
                            }
                            draw();
                        }
                    };
                    function cleanup() {
                        process.stdin.removeListener('keypress', onKeypress);
                        rl._ttyWrite = origTtyWrite;
                    }
                    process.stdin.on('keypress', onKeypress);
                })];
        });
    });
}
function askTextInput(rl_1, promptText_1) {
    return __awaiter(this, arguments, void 0, function (rl, promptText, defaultValue) {
        if (defaultValue === void 0) { defaultValue = ''; }
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var value = defaultValue;
                    var origTtyWrite = rl._ttyWrite;
                    rl._ttyWrite = function () { };
                    var wasRaw = process.stdin.isRaw;
                    if (process.stdin.isTTY)
                        process.stdin.setRawMode(true);
                    readline.emitKeypressEvents(process.stdin);
                    var openedAt = Date.now();
                    function draw() {
                        console.clear();
                        process.stdout.write("\n  ".concat(BOLD).concat(promptText).concat(R, "\n"));
                        process.stdout.write("  Input: ".concat(BRAND).concat(value).concat(R, "\u001B[K\n\n"));
                        process.stdout.write("  ".concat(DIM, "Press Enter to confirm, Esc to cancel").concat(R, "\n"));
                    }
                    draw();
                    var onKeypress = function (str, key) {
                        if (!key)
                            return;
                        if (key.ctrl && key.name === 'c') {
                            cleanup();
                            process.stdout.write('\x1b[r');
                            process.exit(0);
                        }
                        if (key.name === 'escape') {
                            cleanup();
                            resolve(null);
                            return;
                        }
                        if ((key.name === 'return' || key.name === 'enter')) {
                            if (Date.now() - openedAt < 300)
                                return;
                            cleanup();
                            resolve(value.trim());
                            return;
                        }
                        if (key.name === 'backspace') {
                            value = value.slice(0, -1);
                            draw();
                        }
                        else if (str && str.length === 1 && !key.ctrl && !key.meta) {
                            value += str;
                            draw();
                        }
                    };
                    function cleanup() {
                        process.stdin.removeListener('keypress', onKeypress);
                        rl._ttyWrite = origTtyWrite;
                    }
                    process.stdin.on('keypress', onKeypress);
                })];
        });
    });
}
function showModelSelector(rl, models) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var query = '';
                    var selectedIndex = 0;
                    var filtered = __spreadArray([], models, true);
                    var origTtyWrite = rl._ttyWrite;
                    rl._ttyWrite = function () { };
                    var wasRaw = process.stdin.isRaw;
                    if (process.stdin.isTTY)
                        process.stdin.setRawMode(true);
                    readline.emitKeypressEvents(process.stdin);
                    var openedAt = Date.now();
                    function draw() {
                        console.clear();
                        process.stdout.write("\n  ".concat(BOLD, "Select AI model").concat(R, "\n"));
                        process.stdout.write("  Search: ".concat(query, "\n\n"));
                        var MAX_VISIBLE = 10;
                        var startIdx = 0;
                        var endIdx = filtered.length;
                        if (filtered.length > MAX_VISIBLE) {
                            startIdx = Math.max(0, selectedIndex - Math.floor(MAX_VISIBLE / 2));
                            endIdx = startIdx + MAX_VISIBLE;
                            if (endIdx > filtered.length) {
                                endIdx = filtered.length;
                                startIdx = Math.max(0, endIdx - MAX_VISIBLE);
                            }
                        }
                        if (startIdx > 0) {
                            process.stdout.write("    \u2191 ...\n");
                        }
                        for (var i = startIdx; i < endIdx; i++) {
                            if (i === selectedIndex) {
                                process.stdout.write("  > \u001B[36m".concat(filtered[i], "\u001B[0m\n"));
                            }
                            else {
                                process.stdout.write("    ".concat(filtered[i], "\n"));
                            }
                        }
                        if (endIdx < filtered.length) {
                            process.stdout.write("    \u2193 ...\n");
                        }
                        process.stdout.write('\n  Use ↑/↓ to select, Enter to confirm, Esc to cancel\n');
                    }
                    draw();
                    var onKeypress = function (str, key) {
                        if (!key)
                            return;
                        if (key.ctrl && key.name === 'c') {
                            cleanup();
                            process.stdout.write('\x1b[r');
                            process.exit(0);
                        }
                        if (key.name === 'escape') {
                            cleanup();
                            resolve(null);
                            return;
                        }
                        if (key.name === 'return' && Date.now() - openedAt < 300) {
                            return;
                        }
                        if (key.name === 'return' || key.name === 'enter') {
                            cleanup();
                            resolve(filtered[selectedIndex] || null);
                            return;
                        }
                        if (key.name === 'up') {
                            selectedIndex = Math.max(0, selectedIndex - 1);
                            draw();
                        }
                        else if (key.name === 'down') {
                            selectedIndex = Math.min(filtered.length - 1, selectedIndex + 1);
                            draw();
                        }
                        else if (key.name === 'backspace') {
                            query = query.slice(0, -1);
                            updateFilter();
                        }
                        else if (str && str.length === 1 && !key.ctrl && !key.meta) {
                            query += str;
                            updateFilter();
                        }
                    };
                    function updateFilter() {
                        filtered = models.filter(function (m) { return m.toLowerCase().includes(query.toLowerCase()); });
                        selectedIndex = 0;
                        draw();
                    }
                    function cleanup() {
                        process.stdin.removeListener('keypress', onKeypress);
                        rl._ttyWrite = origTtyWrite;
                    }
                    process.stdin.on('keypress', onKeypress);
                })];
        });
    });
}
// ─── Interactive session ──────────────────────────────────────────────────────
function startInteractiveSession(config) {
    return __awaiter(this, void 0, void 0, function () {
        function getTokenPricingLabel(state) {
            if (state.config.showTokenPricing === false) {
                return getContextBar(state.history);
            }
            var inTokens = state.totalInputTokens || 0;
            var outTokens = state.totalOutputTokens || 0;
            var cost = ((inTokens * 0.15) / 1000000) + ((outTokens * 0.60) / 1000000);
            return "Tokens: ".concat(inTokens + outTokens, " \u00B7 Cost: $").concat(cost.toFixed(5));
        }
        function getModePill(mode) {
            var style = state.config.chatbarStyle || 'mode';
            var modelLabel = state.config.provider === 'google' ? 'Google' : formatModelName(state.config.model || 'gpt-4o-mini');
            var displayModel = modelLabel.length > 25 ? modelLabel.slice(0, 22) + '…' : modelLabel;
            if (style === 'minimal') {
                return "".concat(BRAND, "\u203A").concat(R, " ");
            }
            var pillText = '';
            if (style === 'mode') {
                pillText = mode;
            }
            else if (style === 'model') {
                pillText = displayModel;
            }
            else if (style === 'both') {
                pillText = "".concat(mode, " | ").concat(displayModel);
            }
            var pillColor = '\x1b[38;2;140;140;140m';
            if (mode === 'Plan')
                pillColor = '\x1b[38;2;160;110;235m';
            else if (mode === 'Auto')
                pillColor = '\x1b[38;2;60;185;120m';
            return "".concat(pillColor, "[ ").concat(pillText, " ]").concat(R, " ").concat(BRAND, "\u203A").concat(R, " ");
        }
        function updatePromptAndRedraw() {
            rl.prompt(true);
            rl._refreshLine();
        }
        function clearSlashListLocal() {
            if (slashListLines > 0) {
                var rows = process.stdout.rows || 24;
                var startRow = rows - 3 - slashListLines;
                for (var i = 0; i < slashListLines; i++) {
                    process.stdout.write("\u001B[".concat(startRow + i, ";1H\u001B[2K"));
                }
                slashListLines = 0;
                var inputRow = rows - 2;
                process.stdout.write("\u001B[".concat(inputRow, ";1H"));
            }
        }
        function drawSlashListLocal(query) {
            clearSlashListLocal();
            var lower = query.toLowerCase();
            var filtered = COMMANDS_LIST.filter(function (c) {
                return !query || c.command.toLowerCase().includes(lower) ||
                    c.label.toLowerCase().includes(lower) ||
                    c.description.toLowerCase().includes(lower);
            });
            var rows = process.stdout.rows || 24;
            var w = Math.min(72, termWidth() - 4);
            if (filtered.length === 0) {
                var totalRows = 2;
                slashListLines = totalRows;
                var startRow_1 = rows - 2 - totalRows;
                process.stdout.write("\u001B[".concat(startRow_1, ";1H\u001B[2K  ").concat(DIM, "No matching commands for \"/").concat(query, "\"").concat(R));
                process.stdout.write("\u001B[".concat(startRow_1 + 1, ";1H\u001B[2K  ").concat(DIM).concat('─'.repeat(40)).concat(R));
                var pill_1 = getModePill(activeMode);
                var pillLen_1 = stripAnsi(pill_1).length;
                var cursorPos_1 = globalRl.cursor || 0;
                var col_1 = Math.max(1, 1 + pillLen_1 + cursorPos_1);
                process.stdout.write("\u001B[".concat(rows - 2, ";").concat(col_1, "H"));
                return;
            }
            var groups = {};
            for (var _i = 0, filtered_1 = filtered; _i < filtered_1.length; _i++) {
                var cmd = filtered_1[_i];
                if (!groups[cmd.category])
                    groups[cmd.category] = [];
                groups[cmd.category].push(cmd);
            }
            var lines = [];
            lines.push("  ".concat(DIM).concat('─'.repeat(w)).concat(R));
            for (var _a = 0, _b = Object.entries(groups); _a < _b.length; _a++) {
                var _c = _b[_a], cat = _c[0], cmds = _c[1];
                lines.push("  ".concat(DIM).concat(cat.toUpperCase()).concat(R));
                for (var _d = 0, cmds_1 = cmds; _d < cmds_1.length; _d++) {
                    var cmd = cmds_1[_d];
                    var isExact = cmd.command.toLowerCase() === query.toLowerCase() || !query;
                    var cmdDisplay = isExact ? "".concat(BOLD).concat(BRAND).concat(cmd.label).concat(R) : "".concat(BRAND).concat(cmd.label).concat(R);
                    lines.push("  ".concat(cmdDisplay).concat(' '.repeat(Math.max(1, 20 - stripAnsi(cmd.label).length))).concat(DIM).concat(cmd.description).concat(R));
                }
            }
            lines.push("  ".concat(DIM).concat('─'.repeat(w)).concat(R));
            slashListLines = lines.length;
            var startRow = rows - 3 - slashListLines;
            for (var i = 0; i < lines.length; i++) {
                process.stdout.write("\u001B[".concat(startRow + i, ";1H\u001B[2K").concat(lines[i]));
            }
            var pill = getModePill(activeMode);
            var pillLen = stripAnsi(pill).length;
            var cursorPos = globalRl.cursor || 0;
            var col = Math.max(1, 1 + pillLen + cursorPos);
            process.stdout.write("\u001B[".concat(rows - 2, ";").concat(col, "H"));
        }
        var serverOnline, paired, pairingCode, code, state, rl, exiting, activeMode, onKeyPressGlobal, originalPrompt, originalRefreshLine, onResize, slashActive, slashQuery, lastInputLen, slashListLines, COMMANDS_LIST, isCommandRunning, slashCheckInterval, origRedraw, hb;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    globalConfig = config;
                    applyPromptColor(config.promptColor);
                    return [4 /*yield*/, pingServer(config.apiUrl)];
                case 1:
                    serverOnline = _a.sent();
                    if (!!serverOnline) return [3 /*break*/, 4];
                    return [4 /*yield*/, startServerAutomatically(config)];
                case 2:
                    serverOnline = _a.sent();
                    if (!!serverOnline) return [3 /*break*/, 4];
                    return [4 /*yield*/, startLightweightServer(true)];
                case 3:
                    _a.sent();
                    serverOnline = true;
                    _a.label = 4;
                case 4: return [4 /*yield*/, checkPairingStatus(config)];
                case 5:
                    paired = _a.sent();
                    if (!!paired) return [3 /*break*/, 9];
                    return [4 /*yield*/, initAuthPairing(config)];
                case 6:
                    code = _a.sent();
                    if (!code) return [3 /*break*/, 9];
                    pairingCode = code;
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, checkPairingStatus(config)];
                case 8:
                    paired = _a.sent();
                    if (paired)
                        pairingCode = undefined;
                    _a.label = 9;
                case 9:
                    state = { serverOnline: serverOnline, paired: paired, history: [], config: config, pairingCode: pairingCode };
                    rl = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        terminal: true,
                        completer: function (line) {
                            var _a;
                            var allCmds = [
                                { command: '/add-dir', label: '/add-dir', description: 'Add a new working directory', category: 'Code' },
                                { command: '/agents', label: '/agents', description: 'Manage agent configurations', category: 'System' },
                                { command: '/background', label: '/background', description: 'Send this session to the background', category: 'System' },
                                { command: '/branch', label: '/branch', description: 'Create a branch of the current conversation', category: 'Chat' },
                                { command: '/btw', label: '/btw', description: 'Ask a quick side question', category: 'Chat' },
                                { command: '/clear', label: '/clear', description: 'Start a new empty session', category: 'Chat' },
                                { command: '/resume', label: '/resume', description: 'Restore a previous session', category: 'Chat' },
                                { command: '/color', label: '/color', description: 'Set prompt bar color', category: 'System' },
                                { command: '/compact', label: '/compact', description: 'Summarize conversation to save context', category: 'Chat' },
                                { command: '/context', label: '/context', description: 'Visualize current context usage', category: 'System' },
                                { command: '/pair', label: '/pair', description: 'Link terminal to Roblox Studio', category: 'Connection' },
                                { command: '/status', label: '/status', description: 'Refresh server + Studio pairing status', category: 'System' },
                                { command: '/sync', label: '/sync <file>', description: 'AI-edit a file and push to Studio', category: 'Code' },
                                { command: '/provider', label: '/provider <p>', description: 'Set API provider (openai|google)', category: 'AI' },
                                { command: '/key', label: '/key <k>', description: 'Set API key for current provider', category: 'AI' },
                                { command: '/model', label: '/model', description: 'Set AI model interactively', category: 'AI' },
                                { command: '/config', label: '/config', description: 'Show current configuration', category: 'System' },
                                { command: '/settings', label: '/settings', description: 'Open personal settings panel', category: 'System' },
                                { command: '/artifact', label: '/artifact', description: 'Review, accept, or steer generated code artifacts', category: 'Code' },
                                { command: '/help', label: '/help', description: 'Show all available commands', category: 'Chat' },
                                { command: '/exit', label: '/exit', description: 'Quit Apple Juice CLI', category: 'System' },
                            ];
                            var parts = line.trim().split(' ');
                            var cmdPart = parts[0];
                            var modelSuggestions = (state.config.availableModels && state.config.availableModels.length > 0)
                                ? state.config.availableModels
                                : __spreadArray([
                                    'gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1-preview',
                                    'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro',
                                    'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-5-haiku-20241022',
                                    'claude-3-opus', 'claude-opus-4.6', 'claude-opus-4.7', 'claude-opus-4.6-fast', 'claude-opus-4.7-fast',
                                    'deepseek-chat', 'deepseek-coder', 'deepseek-v3', 'deepseek-r1',
                                    'openrouter/anthropic/claude-3.5-sonnet', 'openrouter/google/gemini-2.5-pro',
                                    'openrouter/deepseek/deepseek-r1', 'openrouter/meta-llama/llama-3.1-405b-instruct',
                                    'openrouter/meta-llama/llama-3-8b-instruct:free'
                                ], localOpenRouterModels.map(function (m) { return m.startsWith('openrouter/') ? m : "openrouter/".concat(m); }), true);
                            if (cmdPart === '/model' && parts.length > 1) {
                                var pref_1 = (_a = parts[1]) !== null && _a !== void 0 ? _a : '';
                                var hits = modelSuggestions.filter(function (m) { return m.toLowerCase().startsWith(pref_1.toLowerCase()); });
                                if (hits.length === 1 && hits[0].toLowerCase() !== pref_1.toLowerCase()) {
                                    if (globalRl) {
                                        globalRl.line = "/model ".concat(hits[0]);
                                        globalRl.cursor = globalRl.line.length;
                                    }
                                }
                                return [[], line];
                            }
                            if (line.startsWith('/')) {
                                var query_1 = line.toLowerCase();
                                var matches = allCmds.filter(function (c) { return c.command.toLowerCase().startsWith(query_1); });
                                if (matches.length === 1 && matches[0].command.toLowerCase() !== query_1) {
                                    if (globalRl) {
                                        globalRl.line = matches[0].command + ' ';
                                        globalRl.cursor = globalRl.line.length;
                                    }
                                }
                            }
                            if (globalRl) {
                                process.nextTick(function () { return globalRl._refreshLine(); });
                            }
                            return [[], line];
                        },
                    });
                    globalRl = rl;
                    exiting = false;
                    activeMode = 'Normal';
                    onKeyPressGlobal = function (ch, key) {
                        if (exiting || isCommandRunning)
                            return;
                        if (key && (key.name === 'backtab' || (key.name === 'tab' && key.shift) || key.sequence === '\x1b[Z')) {
                            var modes = ['Normal', 'Plan', 'Auto'];
                            var currentIdx = modes.indexOf(activeMode);
                            activeMode = modes[(currentIdx + 1) % modes.length];
                            updatePromptAndRedraw();
                        }
                    };
                    process.stdin.on('keypress', onKeyPressGlobal);
                    originalPrompt = rl.prompt.bind(rl);
                    rl.prompt = function (preserveCursor) {
                        var rows = process.stdout.rows || 24;
                        var w = termWidth();
                        if (rows >= 10) {
                            process.stdout.write("\u001B[".concat(rows - 3, ";1H\u001B[2K"));
                            var shortcutsHint = " ".concat(DIM, "Press ").concat(R).concat(BRAND, "[Tab]").concat(R).concat(DIM, " for commands \u00B7 ").concat(R).concat(BRAND, "[Shift+Tab]").concat(R).concat(DIM, " to toggle agents \u00B7 ").concat(R).concat(BRAND, "[Ctrl+C]").concat(R).concat(DIM, " to exit").concat(R, " ");
                            var linePadding = Math.max(0, Math.floor((w - stripAnsi(shortcutsHint).length) / 2));
                            var rightPadding = Math.max(0, w - stripAnsi(shortcutsHint).length - linePadding);
                            process.stdout.write("\u001B[38;2;65;65;65m".concat('─'.repeat(linePadding)).concat(R) +
                                shortcutsHint +
                                "\u001B[38;2;65;65;65m".concat('─'.repeat(rightPadding)).concat(R));
                            process.stdout.write("\u001B[".concat(rows - 1, ";1H\u001B[2K"));
                            var modelLabel = state.config.provider === 'google' ? 'Google (128K)' : formatModelName(state.config.model || 'gpt-4o-mini');
                            var contextLabel = getTokenPricingLabel(state);
                            process.stdout.write(drawHorizontalLineWithText(modelLabel, contextLabel));
                            process.stdout.write("\u001B[".concat(rows, ";1H\u001B[2K"));
                            process.stdout.write("\u001B[".concat(rows - 2, ";1H\u001B[2K"));
                        }
                        rl.setPrompt(getModePill(activeMode));
                        originalPrompt(preserveCursor);
                    };
                    originalRefreshLine = rl._refreshLine.bind(rl);
                    rl._refreshLine = function () {
                        originalRefreshLine();
                        var rows = process.stdout.rows || 24;
                        if (rows >= 10 && !exiting && !state.modalOpen) {
                            process.stdout.write('\x1b[s');
                            process.stdout.write("\u001B[".concat(rows - 1, ";1H\u001B[2K"));
                            var modelLabel = state.config.provider === 'google' ? 'Google (128K)' : formatModelName(state.config.model || 'gpt-4o-mini');
                            var contextLabel = getTokenPricingLabel(state);
                            process.stdout.write(drawHorizontalLineWithText(modelLabel, contextLabel));
                            process.stdout.write("\u001B[".concat(rows, ";1H\u001B[2K"));
                            process.stdout.write('\x1b[u');
                        }
                    };
                    onResize = function () {
                        if (!exiting && !state.modalOpen) {
                            redrawScreen(state);
                        }
                    };
                    process.stdout.on('resize', onResize);
                    slashActive = false;
                    slashQuery = '';
                    lastInputLen = 0;
                    slashListLines = 0;
                    COMMANDS_LIST = [
                        { command: '/add-dir', label: '/add-dir', description: 'Add a new working directory', category: 'Code' },
                        { command: '/agents', label: '/agents', description: 'Manage agent configurations', category: 'System' },
                        { command: '/background', label: '/background', description: 'Send this session to the background', category: 'System' },
                        { command: '/branch', label: '/branch', description: 'Create a branch of the current conversation', category: 'Chat' },
                        { command: '/btw', label: '/btw', description: 'Ask a quick side question', category: 'Chat' },
                        { command: '/clear', label: '/clear', description: 'Start a new empty session', category: 'Chat' },
                        { command: '/resume', label: '/resume', description: 'Restore a previous session', category: 'Chat' },
                        { command: '/color', label: '/color', description: 'Set prompt bar color', category: 'System' },
                        { command: '/compact', label: '/compact', description: 'Summarize conversation to save context', category: 'Chat' },
                        { command: '/context', label: '/context', description: 'Visualize current context usage', category: 'System' },
                        { command: '/pair', label: '/pair', description: 'Link terminal to Roblox Studio', category: 'Connection' },
                        { command: '/status', label: '/status', description: 'Refresh server + Studio pairing status', category: 'System' },
                        { command: '/sync', label: '/sync <file>', description: 'AI-edit a file and push to Studio', category: 'Code' },
                        { command: '/provider', label: '/provider <p>', description: 'Set API provider (openai|google|deepseek|openrouter)', category: 'AI' },
                        { command: '/key', label: '/key [p] <k>', description: 'Set API key (optional provider)', category: 'AI' },
                        { command: '/model', label: '/model', description: 'Select AI model interactively', category: 'AI' },
                        { command: '/config', label: '/config', description: 'Show current configuration', category: 'System' },
                        { command: '/settings', label: '/settings', description: 'Open personal settings panel', category: 'System' },
                        { command: '/artifact', label: '/artifact', description: 'Review, accept, or steer generated code artifacts', category: 'Code' },
                        { command: '/help', label: '/help', description: 'Show all available commands', category: 'Chat' },
                        { command: '/exit', label: '/exit', description: 'Quit Apple Juice CLI', category: 'System' },
                    ];
                    isCommandRunning = false;
                    slashCheckInterval = setInterval(function () {
                        if (!globalRl || exiting || isCommandRunning) {
                            return;
                        }
                        var line = globalRl.line || '';
                        if (line.length !== lastInputLen) {
                            lastInputLen = line.length;
                            if (line.startsWith('/')) {
                                var afterSlash = line.slice(1);
                                if (!afterSlash.includes(' ')) {
                                    if (!slashActive) {
                                        slashActive = true;
                                        slashQuery = afterSlash;
                                        drawSlashListLocal(afterSlash);
                                    }
                                    else {
                                        slashQuery = afterSlash;
                                        drawSlashListLocal(afterSlash);
                                    }
                                    return;
                                }
                            }
                            if (slashActive) {
                                clearSlashListLocal();
                                slashActive = false;
                                slashQuery = '';
                            }
                        }
                    }, 100);
                    slashCheckInterval.unref();
                    origRedraw = redrawScreen;
                    redrawScreen = function (s) {
                        if (slashActive) {
                            clearSlashListLocal();
                            slashActive = false;
                        }
                        origRedraw(s);
                    };
                    rl.setPrompt(' ');
                    hb = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                        var sv, pr, changed;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (exiting)
                                        return [2 /*return*/];
                                    return [4 /*yield*/, pingServer(config.apiUrl)];
                                case 1:
                                    sv = _a.sent();
                                    return [4 /*yield*/, checkPairingStatus(config)];
                                case 2:
                                    pr = _a.sent();
                                    changed = false;
                                    if (sv !== state.serverOnline) {
                                        state.serverOnline = sv;
                                        changed = true;
                                    }
                                    if (pr !== state.paired) {
                                        state.paired = pr;
                                        changed = true;
                                        if (pr) {
                                            state.pairingCode = undefined;
                                            state.infoMessage = "".concat(BRIGHT_GREEN, "\u2713").concat(R, " Paired with Studio");
                                            setTimeout(function () { state.infoMessage = undefined; if (!state.modalOpen)
                                                redrawScreen(state); }, 2500);
                                        }
                                    }
                                    if (changed && !state.modalOpen)
                                        redrawScreen(state);
                                    return [2 /*return*/];
                            }
                        });
                    }); }, 1500);
                    hb.unref();
                    redrawScreen(state);
                    rl.prompt();
                    rl.on('line', function (rawLine) { return __awaiter(_this, void 0, void 0, function () {
                        var input, rows, allCmds, _a, rawCmd, args, cmd, _b, oldKey, _c, _d, code, i, dirPath, resolvedPath, w, titleText, w, spinFrame_1, bgInterval, branchName, cleanName, newSessionKey, question, w, res, err, data, reply, replyLines, _i, replyLines_1, line, e_4, targetKey, savedHistory, currentKey, currentHistory, themes, selected, summaryPrompt, res, err, data, reply, e_5, w, titleText, textLen, maxCapacity, pct, activeBlocks, row, rowStr, col, blockIndex, p, valid, provInput, k, validProviders, m, popularModels, res, data, e_6, selected, finalModel, finalModel, res, err, data, d_1, detail, hint, reply, normAction, normSource, normParent, normName, normType, pathParts, parentStr, textReply, artifactsBox, keys, hasUsefulKey, e_7;
                        var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
                        return __generator(this, function (_w) {
                            switch (_w.label) {
                                case 0:
                                    isCommandRunning = true;
                                    if (slashActive) {
                                        clearSlashListLocal();
                                        slashActive = false;
                                        slashQuery = '';
                                        lastInputLen = 0;
                                    }
                                    _w.label = 1;
                                case 1:
                                    _w.trys.push([1, , 94, 95]);
                                    input = rawLine.trim();
                                    if (!input || input === '/') {
                                        rl.prompt(true);
                                        return [2 /*return*/];
                                    }
                                    rows = process.stdout.rows || 24;
                                    if (rows >= 10) {
                                        process.stdout.write("\u001B[".concat(rows - 4, ";1H\n\n"));
                                    }
                                    else {
                                        process.stdout.write('\n\n');
                                    }
                                    if (!(input.startsWith('/') || input === '?')) return [3 /*break*/, 85];
                                    allCmds = ['/add-dir', '/agents', '/background', '/branch', '/btw', '/clear', '/resume', '/color', '/compact', '/context', '/pair', '/status', '/sync', '/key', '/model', '/config', '/settings', '/artifact', '/help', '/exit'];
                                    _a = input.slice(1).split(' '), rawCmd = _a[0], args = _a.slice(1);
                                    cmd = rawCmd.toLowerCase();
                                    _b = cmd;
                                    switch (_b) {
                                        case 'exit': return [3 /*break*/, 2];
                                        case 'quit': return [3 /*break*/, 2];
                                        case 'clear': return [3 /*break*/, 3];
                                        case 'cls': return [3 /*break*/, 3];
                                        case 'help': return [3 /*break*/, 5];
                                        case 'status': return [3 /*break*/, 7];
                                        case 'pair': return [3 /*break*/, 11];
                                        case 'sync': return [3 /*break*/, 19];
                                        case 'add-dir': return [3 /*break*/, 23];
                                        case 'agents': return [3 /*break*/, 27];
                                        case 'background': return [3 /*break*/, 29];
                                        case 'branch': return [3 /*break*/, 31];
                                        case 'btw': return [3 /*break*/, 37];
                                        case 'resume': return [3 /*break*/, 49];
                                        case 'color': return [3 /*break*/, 51];
                                        case 'compact': return [3 /*break*/, 54];
                                        case 'context': return [3 /*break*/, 66];
                                        case 'provider': return [3 /*break*/, 68];
                                        case 'key': return [3 /*break*/, 69];
                                        case 'model': return [3 /*break*/, 70];
                                        case 'settings': return [3 /*break*/, 80];
                                        case 'config': return [3 /*break*/, 80];
                                        case 'artifact': return [3 /*break*/, 82];
                                    }
                                    return [3 /*break*/, 84];
                                case 2:
                                    exiting = true;
                                    clearInterval(hb);
                                    process.stdin.removeListener('keypress', onKeyPressGlobal);
                                    process.stdout.removeListener('resize', onResize);
                                    process.stdout.write('\x1b[r');
                                    process.stdout.write("\n  ".concat(DIM, "Goodbye.").concat(R, "\n\n"));
                                    rl.close();
                                    process.exit(0);
                                    return [2 /*return*/];
                                case 3:
                                    if (!state.config.sessions)
                                        state.config.sessions = {};
                                    oldKey = state.config.sessionKey;
                                    state.config.sessions[oldKey] = __spreadArray([], state.history, true);
                                    state.config.previousSessionKey = oldKey;
                                    state.config.sessionKey = crypto_1.default.randomBytes(8).toString('hex');
                                    state.history = [];
                                    saveConfig(state.config);
                                    state.infoMessage = "Started new session. Previous saved (resumable with /resume).";
                                    state.lastError = undefined;
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1800); })];
                                case 4:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 5:
                                    state.modalOpen = true;
                                    return [4 /*yield*/, showInteractiveHelp(rl, state)];
                                case 6:
                                    _w.sent();
                                    state.modalOpen = false;
                                    redrawScreen(state);
                                    rl.prompt(true);
                                    return [2 /*return*/];
                                case 7:
                                    _c = state;
                                    return [4 /*yield*/, pingServer(config.apiUrl)];
                                case 8:
                                    _c.serverOnline = _w.sent();
                                    _d = state;
                                    return [4 /*yield*/, checkPairingStatus(config)];
                                case 9:
                                    _d.paired = _w.sent();
                                    state.infoMessage = "Server ".concat(state.serverOnline ? 'online' : 'offline', "  \u00B7  Studio ").concat(state.paired ? 'paired' : 'not paired');
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1800); })];
                                case 10:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 11: return [4 /*yield*/, initAuthPairing(config)];
                                case 12:
                                    code = _w.sent();
                                    if (!code) {
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    state.pairingCode = code;
                                    i = 0;
                                    _w.label = 13;
                                case 13:
                                    if (!(i < 30)) return [3 /*break*/, 17];
                                    state.infoMessage = "Waiting for Studio to connect (".concat(i + 1, "/30)\u2026");
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                                case 14:
                                    _w.sent();
                                    return [4 /*yield*/, checkPairingStatus(config)];
                                case 15:
                                    if (_w.sent()) {
                                        state.paired = true;
                                        return [3 /*break*/, 17];
                                    }
                                    _w.label = 16;
                                case 16:
                                    i++;
                                    return [3 /*break*/, 13];
                                case 17:
                                    state.pairingCode = undefined;
                                    state.infoMessage = state.paired
                                        ? "".concat(BRIGHT_GREEN, "\u2713").concat(R, " Paired successfully!")
                                        : "".concat(BRIGHT_YELLOW, "\u26A0").concat(R, " Timed out \u2014 verify the code in Studio.");
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                                case 18:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 19:
                                    if (!!args[0]) return [3 /*break*/, 20];
                                    state.lastError = 'Usage: /sync <filePath> [prompt]';
                                    redrawScreen(state);
                                    state.lastError = undefined;
                                    return [3 /*break*/, 22];
                                case 20: return [4 /*yield*/, handleCodeCommand(config, args[0], args.slice(1).join(' ') || 'Refactor and improve this code')];
                                case 21:
                                    _w.sent();
                                    redrawScreen(state);
                                    _w.label = 22;
                                case 22:
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 23:
                                    dirPath = args.join(' ');
                                    if (!!dirPath) return [3 /*break*/, 25];
                                    return [4 /*yield*/, askTextInput(rl, 'Enter the directory path to add:')];
                                case 24:
                                    dirPath = _w.sent();
                                    _w.label = 25;
                                case 25:
                                    if (!dirPath) {
                                        redrawScreen(state);
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    resolvedPath = path_1.default.isAbsolute(dirPath) ? dirPath : path_1.default.resolve(process.cwd(), dirPath);
                                    if (fs_1.default.existsSync(resolvedPath) && fs_1.default.statSync(resolvedPath).isDirectory()) {
                                        process.chdir(resolvedPath);
                                        state.config.projectPath = resolvedPath;
                                        saveConfig(state.config);
                                        state.infoMessage = "".concat(BRIGHT_GREEN, "\u2713").concat(R, " Working directory changed to: ").concat(resolvedPath);
                                    }
                                    else {
                                        state.lastError = "Directory does not exist: ".concat(resolvedPath);
                                    }
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                                case 26:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    state.lastError = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 27:
                                    console.clear();
                                    w = termWidth();
                                    titleText = (0, ansi_ts_1.gradientText)('Agent Configurations', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
                                    process.stdout.write("\n  ".concat(BOLD).concat(titleText).concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
                                    process.stdout.write("  \uD83E\uDD16 ".concat(BOLD, "Lead Coordinator").concat(R, "  \u00B7  ").concat(BRIGHT_GREEN, "active").concat(R, "\n"));
                                    process.stdout.write("     ".concat(DIM, "Oversees execution plans and routes specialized tasks to subagents.").concat(R, "\n\n"));
                                    process.stdout.write("  \uD83D\uDCD0 ".concat(BOLD, "Code Architect").concat(R, "    \u00B7  ").concat(DIM, "idle").concat(R, "\n"));
                                    process.stdout.write("     ".concat(DIM, "Analyzes codebase structure and ensures clean patterns & conventions.").concat(R, "\n\n"));
                                    process.stdout.write("  \uD83D\uDCC2 ".concat(BOLD, "File Explorer").concat(R, "     \u00B7  ").concat(DIM, "idle").concat(R, "\n"));
                                    process.stdout.write("     ".concat(DIM, "Performs targeted filesystem searches, context gathering, and grep indexing.").concat(R, "\n\n"));
                                    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM, "Cycle prompt agents dynamically in the REPL using [Shift+Tab]").concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM, "Press Enter to return to chat...").concat(R));
                                    return [4 /*yield*/, new Promise(function (resolve) {
                                            var onKey = function (str, key) {
                                                if (key && (key.name === 'return' || key.name === 'enter')) {
                                                    process.stdin.removeListener('keypress', onKey);
                                                    resolve();
                                                }
                                            };
                                            process.stdin.on('keypress', onKey);
                                        })];
                                case 28:
                                    _w.sent();
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 29:
                                    console.clear();
                                    w = termWidth();
                                    process.stdout.write("\n  ".concat(BRAND, "\u26A1").concat(R, "  ").concat(BOLD, "Backgrounding active session\u2026").concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
                                    spinFrame_1 = 0;
                                    bgInterval = setInterval(function () {
                                        var s = SPIN_FRAMES[spinFrame_1 % SPIN_FRAMES.length];
                                        process.stdout.write("\r  ".concat(BRAND).concat(s).concat(R, "  ").concat(DIM, "Detaching processes, saving context and terminal state...").concat(R));
                                        spinFrame_1++;
                                    }, 80);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1500); })];
                                case 30:
                                    _w.sent();
                                    clearInterval(bgInterval);
                                    process.stdout.write('\r\x1b[K');
                                    process.stdout.write("  ".concat(BRIGHT_GREEN, "\u2713").concat(R, " Session safely suspended and running in background.\n\n"));
                                    process.stdout.write("  ".concat(BOLD, "To resume this session, execute:").concat(R, "\n"));
                                    process.stdout.write("    ".concat(BRAND, "aj resume ").concat(state.config.sessionKey).concat(R, "\n\n"));
                                    process.stdout.write("  ".concat(DIM, "Goodbye.").concat(R, "\n\n"));
                                    exiting = true;
                                    clearInterval(hb);
                                    process.stdin.removeListener('keypress', onKeyPressGlobal);
                                    process.stdout.removeListener('resize', onResize);
                                    process.stdout.write('\x1b[r');
                                    rl.close();
                                    process.exit(0);
                                    return [2 /*return*/];
                                case 31:
                                    branchName = args.join('-');
                                    if (!!branchName) return [3 /*break*/, 33];
                                    return [4 /*yield*/, askTextInput(rl, 'Enter name for the new conversation branch:')];
                                case 32:
                                    branchName = _w.sent();
                                    _w.label = 33;
                                case 33:
                                    if (!branchName) {
                                        redrawScreen(state);
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    cleanName = branchName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                                    if (!!cleanName) return [3 /*break*/, 35];
                                    state.lastError = 'Invalid branch name.';
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1500); })];
                                case 34:
                                    _w.sent();
                                    state.lastError = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 35:
                                    newSessionKey = "".concat(cleanName, "-").concat(crypto_1.default.randomBytes(4).toString('hex'));
                                    if (!state.config.sessions)
                                        state.config.sessions = {};
                                    state.config.sessions[state.config.sessionKey] = __spreadArray([], state.history, true);
                                    state.config.previousSessionKey = state.config.sessionKey;
                                    state.config.sessionKey = newSessionKey;
                                    state.config.sessions[newSessionKey] = __spreadArray([], state.history, true);
                                    saveConfig(state.config);
                                    state.infoMessage = "".concat(BRIGHT_GREEN, "\u2713").concat(R, " Branched current conversation at this point as: ").concat(cleanName);
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2200); })];
                                case 36:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 37:
                                    question = args.join(' ');
                                    if (!!question) return [3 /*break*/, 39];
                                    return [4 /*yield*/, askTextInput(rl, 'Ask a quick side question (runs out-of-context):')];
                                case 38:
                                    question = _w.sent();
                                    _w.label = 39;
                                case 39:
                                    if (!question) {
                                        redrawScreen(state);
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    console.clear();
                                    w = termWidth();
                                    process.stdout.write("\n  ".concat(BOLD, "Side Question (Out of Context)").concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n"));
                                    process.stdout.write("  ".concat(BRAND, "Question:").concat(R, " ").concat(question, "\n\n"));
                                    startSpinner('Thinking', false);
                                    _w.label = 40;
                                case 40:
                                    _w.trys.push([40, 46, , 47]);
                                    return [4 /*yield*/, fetch("".concat(config.apiUrl, "/api/chat"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                prompt: question,
                                                sessionKey: config.sessionKey + '-btw',
                                                messages: [],
                                                provider: state.config.provider,
                                                apiKey: state.config.provider === 'google' ? state.config.googleKey
                                                    : state.config.provider === 'deepseek' ? state.config.deepseekKey
                                                        : state.config.provider === 'openrouter' ? state.config.openrouterKey
                                                            : state.config.openaiKey,
                                                openaiKey: state.config.openaiKey,
                                                model: state.config.model,
                                            }),
                                        })];
                                case 41:
                                    res = _w.sent();
                                    stopSpinner();
                                    if (!!res.ok) return [3 /*break*/, 43];
                                    return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                                case 42:
                                    err = _w.sent();
                                    process.stdout.write("  ".concat(BRIGHT_RED, "\u2717 API error ").concat(res.status, ": ").concat(err.error || res.statusText).concat(R, "\n"));
                                    return [3 /*break*/, 45];
                                case 43: return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                                case 44:
                                    data = _w.sent();
                                    reply = data.message || data.assistant || data.text || 'No response returned.';
                                    process.stdout.write("  ".concat(BOLD, "Response:").concat(R, "\n\n"));
                                    replyLines = reply.split('\n');
                                    for (_i = 0, replyLines_1 = replyLines; _i < replyLines_1.length; _i++) {
                                        line = replyLines_1[_i];
                                        process.stdout.write("  ".concat(DIM, "\u2502").concat(R, "  ").concat(line, "\n"));
                                    }
                                    _w.label = 45;
                                case 45: return [3 /*break*/, 47];
                                case 46:
                                    e_4 = _w.sent();
                                    stopSpinner();
                                    process.stdout.write("  ".concat(BRIGHT_RED, "\u2717 Connection error: ").concat(e_4.message).concat(R, "\n"));
                                    return [3 /*break*/, 47];
                                case 47:
                                    process.stdout.write("\n  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM, "Press Enter to return to main chat...").concat(R));
                                    return [4 /*yield*/, new Promise(function (resolve) {
                                            var onKey = function (str, key) {
                                                if (key && (key.name === 'return' || key.name === 'enter')) {
                                                    process.stdin.removeListener('keypress', onKey);
                                                    resolve();
                                                }
                                            };
                                            process.stdin.on('keypress', onKey);
                                        })];
                                case 48:
                                    _w.sent();
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 49:
                                    targetKey = args[0] || state.config.previousSessionKey;
                                    if (!targetKey) {
                                        state.lastError = 'Usage: /resume <sessionKey> (No previous session to restore)';
                                    }
                                    else {
                                        savedHistory = (_e = state.config.sessions) === null || _e === void 0 ? void 0 : _e[targetKey];
                                        if (savedHistory) {
                                            currentKey = state.config.sessionKey;
                                            currentHistory = __spreadArray([], state.history, true);
                                            state.config.sessions[currentKey] = currentHistory;
                                            state.config.previousSessionKey = currentKey;
                                            state.config.sessionKey = targetKey;
                                            state.history = savedHistory;
                                            saveConfig(state.config);
                                            state.infoMessage = "".concat(BRIGHT_GREEN, "\u2713").concat(R, " Successfully resumed session: ").concat(targetKey);
                                        }
                                        else {
                                            state.lastError = "Session \"".concat(targetKey, "\" not found in cache.");
                                        }
                                    }
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                                case 50:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    state.lastError = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 51:
                                    themes = ['terracotta', 'magenta', 'cyan', 'gold'];
                                    state.modalOpen = true;
                                    return [4 /*yield*/, showModelSelector(rl, themes)];
                                case 52:
                                    selected = _w.sent();
                                    state.modalOpen = false;
                                    if (selected) {
                                        state.config.promptColor = selected;
                                        saveConfig(state.config);
                                        applyPromptColor(selected);
                                        state.infoMessage = "Theme set to ".concat(selected, "!");
                                    }
                                    else {
                                        state.infoMessage = 'Theme selection cancelled.';
                                    }
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1200); })];
                                case 53:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 54:
                                    if (!(state.history.length === 0)) return [3 /*break*/, 56];
                                    state.infoMessage = 'History is empty, nothing to compact.';
                                    redrawScreen(state);
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1500); })];
                                case 55:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 56:
                                    startSpinner('Compacting conversation', false);
                                    _w.label = 57;
                                case 57:
                                    _w.trys.push([57, 63, , 64]);
                                    summaryPrompt = "Please summarize our conversation so far in a few highly concise sentences, listing the key files edited, decisions made, and current status. This will be used as the context baseline to save prompt tokens.";
                                    return [4 /*yield*/, fetch("".concat(config.apiUrl, "/api/chat"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                prompt: summaryPrompt,
                                                sessionKey: config.sessionKey,
                                                messages: state.history,
                                                provider: state.config.provider,
                                                apiKey: state.config.provider === 'google' ? state.config.googleKey
                                                    : state.config.provider === 'deepseek' ? state.config.deepseekKey
                                                        : state.config.provider === 'openrouter' ? state.config.openrouterKey
                                                            : state.config.openaiKey,
                                                openaiKey: state.config.openaiKey,
                                                model: state.config.model,
                                            }),
                                        })];
                                case 58:
                                    res = _w.sent();
                                    stopSpinner();
                                    if (!!res.ok) return [3 /*break*/, 60];
                                    return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                                case 59:
                                    err = _w.sent();
                                    state.lastError = "Compaction failed: ".concat(err.error || res.statusText);
                                    return [3 /*break*/, 62];
                                case 60: return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                                case 61:
                                    data = _w.sent();
                                    reply = data.message || data.assistant || data.text || 'Summary generation completed.';
                                    state.history = [
                                        { role: 'assistant', content: "\uD83D\uDCDD ".concat(BOLD, "[Context Baseline Summary]").concat(R, "\n\n").concat(reply) }
                                    ];
                                    state.infoMessage = "".concat(BRIGHT_GREEN, "\u2713").concat(R, " Chat context successfully compacted!");
                                    _w.label = 62;
                                case 62: return [3 /*break*/, 64];
                                case 63:
                                    e_5 = _w.sent();
                                    stopSpinner();
                                    state.lastError = "Compaction error: ".concat(e_5.message);
                                    return [3 /*break*/, 64];
                                case 64:
                                    redrawScreen(state);
                                    state.lastError = undefined;
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2200); })];
                                case 65:
                                    _w.sent();
                                    state.infoMessage = undefined;
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 66:
                                    console.clear();
                                    w = termWidth();
                                    titleText = (0, ansi_ts_1.gradientText)('Context Utilization', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
                                    process.stdout.write("\n  ".concat(BOLD).concat(titleText).concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
                                    textLen = JSON.stringify(state.history).length;
                                    maxCapacity = 30000;
                                    pct = Math.min(100, Math.max(0, Math.round((textLen / maxCapacity) * 100)));
                                    activeBlocks = Math.round(pct);
                                    process.stdout.write("  ".concat(BOLD, "Model:").concat(R, " ").concat(state.config.model || 'gpt-4o-mini', "\n"));
                                    process.stdout.write("  ".concat(BOLD, "Usage:").concat(R, " ").concat(textLen.toLocaleString(), " / ").concat(maxCapacity.toLocaleString(), " chars (").concat(pct, "%)\n\n"));
                                    process.stdout.write("  ".concat(BOLD, "Visual Allocation Grid:").concat(R, "\n\n"));
                                    for (row = 0; row < 5; row++) {
                                        rowStr = '  ';
                                        for (col = 0; col < 20; col++) {
                                            blockIndex = row * 20 + col;
                                            if (blockIndex < activeBlocks) {
                                                rowStr += "".concat(BRAND, "\u25A0").concat(R, " ");
                                            }
                                            else {
                                                rowStr += "".concat(DIM, "\u25A1").concat(R, " ");
                                            }
                                        }
                                        process.stdout.write(rowStr + '\n');
                                    }
                                    process.stdout.write("\n  ".concat(DIM, "Legend: ").concat(BRAND, "\u25A0").concat(R, " Used (").concat(pct, "%)  \u00B7  ").concat(DIM, "\u25A1").concat(R, " Free (").concat(100 - pct, "%)").concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n"));
                                    process.stdout.write("  ".concat(DIM, "Press Enter to return to chat...").concat(R));
                                    return [4 /*yield*/, new Promise(function (resolve) {
                                            var onKey = function (str, key) {
                                                if (key && (key.name === 'return' || key.name === 'enter')) {
                                                    process.stdin.removeListener('keypress', onKey);
                                                    resolve();
                                                }
                                            };
                                            process.stdin.on('keypress', onKey);
                                        })];
                                case 67:
                                    _w.sent();
                                    redrawScreen(state);
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 68:
                                    {
                                        p = (_f = args[0]) === null || _f === void 0 ? void 0 : _f.toLowerCase();
                                        valid = ['openai', 'google', 'deepseek', 'openrouter'];
                                        if (!p || !valid.includes(p)) {
                                            state.lastError = 'Usage: /provider <openai|google|deepseek|openrouter>';
                                        }
                                        else {
                                            state.config.provider = p;
                                            saveConfig(state.config);
                                            state.infoMessage = "Provider set to ".concat(p);
                                        }
                                        redrawScreen(state);
                                        state.lastError = undefined;
                                        state.infoMessage = undefined;
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    _w.label = 69;
                                case 69:
                                    {
                                        provInput = (_g = args[0]) === null || _g === void 0 ? void 0 : _g.toLowerCase();
                                        k = args[1];
                                        if (!k && args[0]) {
                                            k = args[0];
                                            provInput = k.startsWith('sk-or-') ? 'openrouter' : k.startsWith('sk-') ? 'openai' : k.startsWith('AIza') ? 'google' : (state.config.provider || 'openai');
                                        }
                                        if (!k) {
                                            state.lastError = 'Usage: /key [openai|google|deepseek|openrouter] <api_key>';
                                        }
                                        else {
                                            validProviders = ['openai', 'google', 'deepseek', 'openrouter'];
                                            if (!validProviders.includes(provInput)) {
                                                state.lastError = 'Invalid provider. Choose: openai, google, deepseek, openrouter';
                                            }
                                            else {
                                                if (provInput === 'google')
                                                    state.config.googleKey = k;
                                                else if (provInput === 'openai')
                                                    state.config.openaiKey = k;
                                                else if (provInput === 'deepseek')
                                                    state.config.deepseekKey = k;
                                                else if (provInput === 'openrouter')
                                                    state.config.openrouterKey = k;
                                                state.config.provider = provInput;
                                                saveConfig(state.config);
                                                state.infoMessage = "Saved ".concat(provInput, " API key.");
                                            }
                                        }
                                        redrawScreen(state);
                                        state.lastError = undefined;
                                        state.infoMessage = undefined;
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    _w.label = 70;
                                case 70:
                                    m = args.join(' ');
                                    if (!!m) return [3 /*break*/, 78];
                                    popularModels = (state.config.availableModels && state.config.availableModels.length > 0)
                                        ? state.config.availableModels
                                        : __spreadArray([
                                            'gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1-preview',
                                            'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro',
                                            'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-5-haiku-20241022',
                                            'claude-3-opus', 'claude-opus-4.6', 'claude-opus-4.7', 'claude-opus-4.6-fast', 'claude-opus-4.7-fast',
                                            'deepseek-chat', 'deepseek-coder', 'deepseek-v3', 'deepseek-r1',
                                            'openrouter/anthropic/claude-3.5-sonnet', 'openrouter/google/gemini-2.5-pro',
                                            'openrouter/deepseek/deepseek-r1', 'openrouter/meta-llama/llama-3.1-405b-instruct',
                                            'openrouter/meta-llama/llama-3-8b-instruct:free'
                                        ], localOpenRouterModels.map(function (x) { return x.startsWith('openrouter/') ? x : "openrouter/".concat(x); }), true);
                                    if (!(state.config.provider === 'openrouter')) return [3 /*break*/, 75];
                                    if (localOpenRouterModels.length > 0) {
                                        popularModels = localOpenRouterModels.map(function (x) { return x.startsWith('openrouter/') ? x : "openrouter/".concat(x); });
                                    }
                                    _w.label = 71;
                                case 71:
                                    _w.trys.push([71, 74, , 75]);
                                    state.infoMessage = 'Fetching OpenRouter models...';
                                    redrawScreen(state);
                                    return [4 /*yield*/, fetch('https://openrouter.ai/api/v1/models')];
                                case 72:
                                    res = _w.sent();
                                    return [4 /*yield*/, res.json()];
                                case 73:
                                    data = _w.sent();
                                    if (data && data.data) {
                                        popularModels = data.data.map(function (x) { return x.id.startsWith('openrouter/') ? x.id : "openrouter/".concat(x.id); });
                                    }
                                    state.infoMessage = undefined;
                                    return [3 /*break*/, 75];
                                case 74:
                                    e_6 = _w.sent();
                                    state.infoMessage = undefined;
                                    return [3 /*break*/, 75];
                                case 75:
                                    state.modalOpen = true;
                                    return [4 /*yield*/, showModelSelector(rl, popularModels)];
                                case 76:
                                    selected = _w.sent();
                                    state.modalOpen = false;
                                    if (selected) {
                                        finalModel = selected;
                                        if (selected.startsWith('openrouter/')) {
                                            finalModel = selected.substring(11);
                                            state.config.provider = 'openrouter';
                                        }
                                        state.config.model = finalModel;
                                        saveConfig(state.config);
                                        state.infoMessage = "Model \u2192 ".concat(finalModel, " (Provider: ").concat(state.config.provider, ")");
                                    }
                                    else {
                                        state.infoMessage = 'Model selection cancelled.';
                                    }
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 100); })];
                                case 77:
                                    _w.sent();
                                    return [3 /*break*/, 79];
                                case 78:
                                    finalModel = m;
                                    if (m.startsWith('openrouter/')) {
                                        finalModel = m.substring(11);
                                        state.config.provider = 'openrouter';
                                    }
                                    state.config.model = finalModel;
                                    saveConfig(state.config);
                                    state.infoMessage = "Model \u2192 ".concat(finalModel, " (Provider: ").concat(state.config.provider, ")");
                                    _w.label = 79;
                                case 79:
                                    redrawScreen(state);
                                    state.lastError = undefined;
                                    state.infoMessage = undefined;
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 80:
                                    state.modalOpen = true;
                                    return [4 /*yield*/, showInteractiveSettings(rl, state)];
                                case 81:
                                    _w.sent();
                                    state.modalOpen = false;
                                    redrawScreen(state);
                                    rl.prompt(true);
                                    return [2 /*return*/];
                                case 82:
                                    state.modalOpen = true;
                                    return [4 /*yield*/, showInteractiveArtifacts(rl, state)];
                                case 83:
                                    _w.sent();
                                    state.modalOpen = false;
                                    redrawScreen(state);
                                    rl.prompt(true);
                                    return [2 /*return*/];
                                case 84:
                                    state.lastError = "Unknown command: /".concat(cmd, " \u2014 type /help");
                                    redrawScreen(state);
                                    state.lastError = undefined;
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 85:
                                    if (!state.paired) {
                                        state.lastError = 'Not paired with Studio. Run /pair first.';
                                        redrawScreen(state);
                                        state.lastError = undefined;
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    startSpinner('Thinking', activeMode !== 'Normal');
                                    _w.label = 86;
                                case 86:
                                    _w.trys.push([86, 92, , 93]);
                                    return [4 /*yield*/, fetch("".concat(config.apiUrl, "/api/chat"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                prompt: input,
                                                sessionKey: config.sessionKey,
                                                messages: state.history,
                                                provider: state.config.provider,
                                                apiKey: state.config.provider === 'google' ? state.config.googleKey
                                                    : state.config.provider === 'deepseek' ? state.config.deepseekKey
                                                        : state.config.provider === 'openrouter' ? state.config.openrouterKey
                                                            : state.config.openaiKey,
                                                openaiKey: state.config.openaiKey,
                                                model: state.config.model,
                                            }),
                                        })];
                                case 87:
                                    res = _w.sent();
                                    stopSpinner();
                                    if (!!res.ok) return [3 /*break*/, 89];
                                    return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                                case 88:
                                    err = _w.sent();
                                    state.lastError = "API error ".concat(res.status, ": ").concat(err.error || res.statusText);
                                    return [3 /*break*/, 91];
                                case 89: return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                                case 90:
                                    data = _w.sent();
                                    d_1 = data;
                                    if (d_1.error) {
                                        detail = typeof d_1.detail === 'string' ? d_1.detail : '';
                                        hint = detail.includes('empty') || detail === ''
                                            ? ' The model may not support structured JSON output. Try /model to switch.'
                                            : " (".concat(detail.slice(0, 120), ")");
                                        state.lastError = "".concat(d_1.error).concat(hint);
                                        redrawScreen(state);
                                        state.lastError = undefined;
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    reply = void 0;
                                    if (typeof data === 'object' && data !== null) {
                                        normAction = (_j = (_h = d_1.action) !== null && _h !== void 0 ? _h : d_1.Action) !== null && _j !== void 0 ? _j : "create";
                                        normSource = (_p = (_o = (_m = (_l = (_k = d_1.code) !== null && _k !== void 0 ? _k : d_1.Source) !== null && _l !== void 0 ? _l : d_1.content) !== null && _m !== void 0 ? _m : d_1.Content) !== null && _o !== void 0 ? _o : d_1.script) !== null && _p !== void 0 ? _p : d_1.Script;
                                        normParent = (_q = d_1.parent) !== null && _q !== void 0 ? _q : d_1.Parent;
                                        normName = (_r = d_1.name) !== null && _r !== void 0 ? _r : d_1.Name;
                                        normType = (_v = (_u = (_t = (_s = d_1.scriptType) !== null && _s !== void 0 ? _s : d_1.Type) !== null && _t !== void 0 ? _t : d_1.type) !== null && _u !== void 0 ? _u : d_1.ClassName) !== null && _v !== void 0 ? _v : d_1.className;
                                        if (normSource === undefined && String(normAction).toLowerCase() === "create") {
                                            normSource = "";
                                        }
                                        if (d_1.path && normSource !== undefined) {
                                            pathParts = String(d_1.path).split('/');
                                            normName = pathParts[pathParts.length - 1];
                                            normParent = pathParts.slice(0, -1).join('/') || 'ReplicatedStorage';
                                        }
                                        if (typeof normSource === "string" && !Array.isArray(d_1.scripts)) {
                                            parentStr = String(normParent || 'ReplicatedStorage');
                                            if (parentStr.startsWith('game.')) {
                                                parentStr = parentStr.substring(5);
                                            }
                                            d_1.scripts = [{
                                                    action: String(normAction).toLowerCase(),
                                                    type: String(normType || 'Script'),
                                                    scriptType: String(normType || 'Script'),
                                                    parent: parentStr,
                                                    name: String(normName || 'Script'),
                                                    code: normSource
                                                }];
                                            d_1.message = "Successfully created ".concat(normName, " in ").concat(parentStr);
                                        }
                                        if (Array.isArray(d_1.scripts)) {
                                            textReply = typeof d_1.message === 'string' && d_1.message.trim() ? d_1.message : '';
                                            artifactsBox = d_1.scripts.length > 0 ? formatArtifactsBox(d_1.scripts) : '';
                                            reply = textReply + artifactsBox;
                                        }
                                        else if (typeof d_1.message === 'string' && d_1.message.trim() && d_1.ok) {
                                            reply = d_1.message;
                                        }
                                        else if (d_1.tool_call_function || d_1.tool_calls) {
                                            reply = typeof d_1.assistant === 'string' && d_1.assistant.trim()
                                                ? d_1.assistant + '\n\n⚠️  The model used tool-call syntax instead of creating scripts. Try /model to switch.'
                                                : '⚠️  The model returned an unsupported format. Try /model to switch to a more capable model.';
                                        }
                                        else if (typeof d_1.message === 'string' && d_1.message.trim()) {
                                            reply = d_1.message;
                                        }
                                        else if (typeof d_1.assistant === 'string' && d_1.assistant.trim()) {
                                            reply = d_1.assistant;
                                        }
                                        else if (typeof d_1.text === 'string' && d_1.text.trim()) {
                                            reply = d_1.text;
                                        }
                                        else if (typeof d_1.code === 'string' && d_1.code.trim()) {
                                            reply = d_1.code;
                                        }
                                        else {
                                            keys = Object.keys(data);
                                            hasUsefulKey = keys.some(function (k) { return k && typeof d_1[k] === 'string' && d_1[k].trim(); });
                                            if (!hasUsefulKey) {
                                                state.lastError = 'The model returned an empty response. Try rephrasing or use /model to switch.';
                                                redrawScreen(state);
                                                state.lastError = undefined;
                                                rl.prompt();
                                                return [2 /*return*/];
                                            }
                                            reply = JSON.stringify(data);
                                        }
                                    }
                                    else {
                                        reply = String(data);
                                    }
                                    if (!reply || reply.trim().length === 0) {
                                        state.lastError = 'The model returned an empty response. Try rephrasing or use /model to switch.';
                                        redrawScreen(state);
                                        state.lastError = undefined;
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    state.history.push({ role: 'user', content: input });
                                    state.history.push({ role: 'assistant', content: reply });
                                    if (state.history.length > 40)
                                        state.history = state.history.slice(-40);
                                    state.lastError = undefined;
                                    _w.label = 91;
                                case 91: return [3 /*break*/, 93];
                                case 92:
                                    e_7 = _w.sent();
                                    stopSpinner();
                                    state.lastError = "Connection error: ".concat(e_7.message);
                                    return [3 /*break*/, 93];
                                case 93:
                                    redrawScreen(state);
                                    state.lastError = undefined;
                                    rl.prompt();
                                    return [3 /*break*/, 95];
                                case 94:
                                    isCommandRunning = false;
                                    lastInputLen = ((globalRl === null || globalRl === void 0 ? void 0 : globalRl.line) || '').length;
                                    return [7 /*endfinally*/];
                                case 95: return [2 /*return*/];
                            }
                        });
                    }); });
                    rl.on('close', function () {
                        process.stdin.removeListener('keypress', onKeyPressGlobal);
                        process.stdout.removeListener('resize', onResize);
                        process.stdout.write('\x1b[r');
                        if (!exiting) {
                            process.stdout.write("\n  ".concat(DIM, "Session ended.").concat(R, "\n\n"));
                            process.exit(0);
                        }
                    });
                    return [2 /*return*/];
            }
        });
    });
}
function handleStatusCommand(config) {
    return __awaiter(this, void 0, void 0, function () {
        var serverOnline, paired, w, titleText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pingServer(config.apiUrl)];
                case 1:
                    serverOnline = _a.sent();
                    return [4 /*yield*/, checkPairingStatus(config)];
                case 2:
                    paired = _a.sent();
                    w = termWidth();
                    console.clear();
                    titleText = (0, ansi_ts_1.gradientText)('Apple Juice', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
                    process.stdout.write("\n  ".concat(BOLD).concat(titleText).concat(R, "  ").concat(DIM, "Status").concat(R, "\n"));
                    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
                    process.stdout.write("  ".concat(DIM, "Server").concat(R, "   ").concat(serverOnline ? "".concat(BRIGHT_GREEN, "\u25CF Online").concat(R, "  ").concat(DIM).concat(config.apiUrl).concat(R) : "".concat(BRIGHT_RED, "\u25CF Offline").concat(R), "\n"));
                    process.stdout.write("  ".concat(DIM, "Studio").concat(R, "   ").concat(paired ? "".concat(BRIGHT_GREEN, "\u2713 Paired").concat(R) : "".concat(BRIGHT_YELLOW, "\u25E6 Not paired").concat(R), "\n"));
                    process.stdout.write("  ".concat(DIM, "Session").concat(R, "  ").concat(config.sessionKey ? "".concat(DIM).concat(config.sessionKey.slice(0, 20), "\u2026").concat(R) : "".concat(DIM, "none").concat(R), "\n\n"));
                    if (!!serverOnline) return [3 /*break*/, 4];
                    return [4 /*yield*/, startServerAutomatically(config)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    if (!paired)
                        process.stdout.write("  Run ".concat(BRAND, "aj").concat(R, " and type ").concat(BRAND, "/pair").concat(R, " to link Studio.\n\n"));
                    else
                        printSuccess('System fully ready. Happy building!');
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function handlePairCommand(config) {
    return __awaiter(this, void 0, void 0, function () {
        var serverOnline, code, paired, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pingServer(config.apiUrl)];
                case 1:
                    serverOnline = _a.sent();
                    if (!!serverOnline) return [3 /*break*/, 3];
                    return [4 /*yield*/, startServerAutomatically(config)];
                case 2:
                    serverOnline = _a.sent();
                    _a.label = 3;
                case 3:
                    if (!serverOnline) {
                        printError('Server offline — cannot initiate pairing.');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, initAuthPairing(config)];
                case 4:
                    code = _a.sent();
                    if (!code)
                        return [2 /*return*/];
                    process.stdout.write("\n  ".concat(BRAND, "Pairing code").concat(R, "  ").concat(BOLD).concat(BRIGHT_CYAN).concat(code).concat(R, "\n"));
                    process.stdout.write("  ".concat(DIM, "Enter this in the Roblox Studio plugin, then press Connect.").concat(R, "\n\n"));
                    paired = false;
                    i = 0;
                    _a.label = 5;
                case 5:
                    if (!(i < 30)) return [3 /*break*/, 9];
                    process.stdout.write("\r\u001B[K  ".concat(DIM, "Waiting for Studio (").concat(i + 1, "/30)\u2026").concat(R));
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, checkPairingStatus(config)];
                case 7:
                    paired = _a.sent();
                    if (paired)
                        return [3 /*break*/, 9];
                    _a.label = 8;
                case 8:
                    i++;
                    return [3 /*break*/, 5];
                case 9:
                    process.stdout.write('\r\x1b[K');
                    if (paired)
                        printSuccess("".concat(BOLD, "Paired!").concat(R, " Studio is connected."));
                    else
                        printError('Timed out — verify the code in Studio.');
                    process.stdout.write('\n');
                    return [2 /*return*/];
            }
        });
    });
}
function handleCodeCommand(config, filePath, instructions) {
    return __awaiter(this, void 0, void 0, function () {
        var resolved, sv, steps, original, basename, prompt, res, err, data, code, push, e_8;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.clear();
                    resolved = path_1.default.resolve(process.cwd(), filePath);
                    if (!!fs_1.default.existsSync(resolved)) return [3 /*break*/, 2];
                    printError("File not found: ".concat(filePath));
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, pingServer(config.apiUrl)];
                case 3:
                    sv = _c.sent();
                    if (!!sv) return [3 /*break*/, 6];
                    return [4 /*yield*/, startServerAutomatically(config)];
                case 4:
                    sv = _c.sent();
                    if (!!sv) return [3 /*break*/, 6];
                    return [4 /*yield*/, startLightweightServer(true)];
                case 5:
                    _c.sent();
                    sv = true;
                    _c.label = 6;
                case 6:
                    steps = [
                        { name: 'Backup local file', status: 'running' },
                        { name: 'Generate edits via AI', status: 'pending' },
                        { name: 'Write updated source', status: 'pending' },
                        { name: 'Push to Roblox Studio', status: 'pending' },
                    ];
                    startSyncProgress(steps);
                    original = fs_1.default.readFileSync(resolved, 'utf8');
                    basename = path_1.default.basename(resolved);
                    fs_1.default.writeFileSync(resolved + '.bak', original, 'utf8');
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 400); })];
                case 7:
                    _c.sent();
                    steps[0].status = 'done';
                    steps[1].status = 'running';
                    prompt = "Update the file \"".concat(basename, "\":\n\nORIGINAL:\n").concat(original, "\n\nINSTRUCTIONS:\n").concat(instructions, "\n\nReturn only the updated code in the standard JSON format.");
                    _c.label = 8;
                case 8:
                    _c.trys.push([8, 19, , 21]);
                    return [4 /*yield*/, fetch("".concat(config.apiUrl, "/api/chat"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                prompt: prompt,
                                sessionKey: config.sessionKey, messages: [],
                                provider: config.provider,
                                apiKey: config.provider === 'google' ? config.googleKey
                                    : config.provider === 'deepseek' ? config.deepseekKey
                                        : config.provider === 'openrouter' ? config.openrouterKey
                                            : config.openaiKey,
                                openaiKey: config.openaiKey, model: config.model,
                            }),
                        })];
                case 9:
                    res = _c.sent();
                    if (!!res.ok) return [3 /*break*/, 12];
                    return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                case 10:
                    err = _c.sent();
                    steps[1].status = 'failed';
                    stopSyncProgress(steps);
                    printError("AI error: ".concat(err.error || res.statusText));
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2500); })];
                case 11:
                    _c.sent();
                    return [2 /*return*/];
                case 12:
                    steps[1].status = 'done';
                    steps[2].status = 'running';
                    return [4 /*yield*/, res.json()];
                case 13:
                    data = _c.sent();
                    code = (data.code || ((_b = (_a = data.scripts) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.code));
                    if (!!code) return [3 /*break*/, 15];
                    steps[2].status = 'failed';
                    stopSyncProgress(steps);
                    printError('AI returned no code payload.');
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2500); })];
                case 14:
                    _c.sent();
                    return [2 /*return*/];
                case 15:
                    fs_1.default.writeFileSync(resolved, code, 'utf8');
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 400); })];
                case 16:
                    _c.sent();
                    steps[2].status = 'done';
                    steps[3].status = 'running';
                    return [4 /*yield*/, fetch("".concat(config.apiUrl, "/api/cli/push-code"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionKey: config.sessionKey,
                                name: data.scriptName || basename.replace(path_1.default.extname(basename), ''),
                                type: data.scriptType || 'Script',
                                parent: data.scriptParent || 'ServerScriptService',
                                code: code,
                            }),
                        })];
                case 17:
                    push = _c.sent();
                    steps[3].status = push.ok ? 'done' : 'failed';
                    stopSyncProgress(steps);
                    if (push.ok)
                        printSuccess("".concat(BOLD, "Sync complete!").concat(R, " Studio updated."));
                    else
                        process.stdout.write("\n  ".concat(BRIGHT_YELLOW, "\u26A0").concat(R, "  File saved locally but Studio was offline.\n"));
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                case 18:
                    _c.sent();
                    return [3 /*break*/, 21];
                case 19:
                    e_8 = _c.sent();
                    steps[1].status = 'failed';
                    stopSyncProgress(steps);
                    printError("Sync error: ".concat(e_8.message));
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2500); })];
                case 20:
                    _c.sent();
                    return [3 /*break*/, 21];
                case 21: return [2 /*return*/];
            }
        });
    });
}
function showHelp() {
    var w = termWidth();
    var titleText = (0, ansi_ts_1.gradientText)('Apple Juice CLI', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
    process.stdout.write("\n  ".concat(BOLD).concat(titleText).concat(R, "  ").concat(DIM, "v2.1").concat(R, "\n"));
    process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
    process.stdout.write("  ".concat(DIM, "Commands").concat(R, "\n\n"));
    var cmds = [
        ['aj', 'Open interactive session'],
        ['aj help', 'Show this help'],
        ['aj status', 'Check server & Studio status'],
        ['aj auth <key>', 'Save a session key'],
        ['aj ask "<prompt>"', 'Quick one-off AI question'],
        ['aj code <f> -p "<i>"', 'AI-edit a file and push to Studio'],
        ['aj pair', 'Link terminal to Roblox Studio'],
        ['aj provider <p>', 'Set API provider (openai|google|deepseek|openrouter)'],
        ['aj key <k>', 'Set API key'],
        ['aj model <m>', 'Set AI model'],
        ['aj config', 'Show configuration'],
    ];
    for (var _i = 0, cmds_2 = cmds; _i < cmds_2.length; _i++) {
        var _a = cmds_2[_i], c = _a[0], d = _a[1];
        process.stdout.write("  ".concat(BRAND).concat(c.padEnd(28)).concat(R).concat(DIM).concat(d).concat(R, "\n"));
    }
    process.stdout.write("\n  ".concat(DIM, "Default Commands (Inside a session)").concat(R, "\n\n"));
    var defaultCmds = [
        ['/add-dir', 'Add a new working directory'],
        ['/agents', 'Manage agent configurations'],
        ['/background', 'Send session to background and free terminal'],
        ['/branch', 'Create branch of current conversation'],
        ['/btw', 'Ask quick side question out-of-context'],
        ['/clear', 'Backup & start new session (resumable with /resume)'],
        ['/resume', 'Restore a previously cleared session'],
        ['/color', 'Set the prompt bar theme color'],
        ['/compact', 'Summarize conversation to free up context'],
        ['/config', 'Open config panel'],
        ['/context', 'Visualize context usage as colored grid'],
    ];
    for (var _b = 0, defaultCmds_1 = defaultCmds; _b < defaultCmds_1.length; _b++) {
        var _c = defaultCmds_1[_b], c = _c[0], d = _c[1];
        process.stdout.write("  ".concat(BRAND).concat(c.padEnd(28)).concat(R).concat(DIM).concat(d).concat(R, "\n"));
    }
    process.stdout.write("\n  ".concat(DIM, "Custom Commands (Inside a session)").concat(R, "\n\n"));
    var customCmds = [
        ['/pair', 'Link terminal to Roblox Studio'],
        ['/status', 'Refresh server + Studio status'],
        ['/sync', 'AI-edit a file and push to Studio'],
        ['/provider', 'Set API provider (openai|google|deepseek|openrouter)'],
        ['/key', 'Set API key (optional provider)'],
        ['/model', 'Select AI model interactively'],
        ['/config', 'Show configuration'],
        ['/clear', 'Clear history and screen'],
        ['/exit', 'Quit Apple Juice CLI'],
    ];
    for (var _d = 0, customCmds_1 = customCmds; _d < customCmds_1.length; _d++) {
        var _e = customCmds_1[_d], c = _e[0], d = _e[1];
        process.stdout.write("  ".concat(BRAND).concat(c.padEnd(28)).concat(R).concat(DIM).concat(d).concat(R, "\n"));
    }
    process.stdout.write('\n');
}
var _ka = setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
    var _3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(globalConfig === null || globalConfig === void 0 ? void 0 : globalConfig.sessionKey)) return [3 /*break*/, 4];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, fetch("".concat(globalConfig.apiUrl, "/api/pair/keepalive"), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionKey: globalConfig.sessionKey }),
                    })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                _3 = _a.sent();
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); }, 55000);
_ka.unref();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, isBgBinary, command, config, _a, p, valid, prov, k, valid, m, w, titleText, rows, _i, rows_1, _b, k, v, k, isGlobal, q, online, res, d, replyText, e_9, file, pIdx;
        var _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    args = process.argv.slice(2);
                    if (args[0] === '--')
                        args = args.slice(1);
                    isBgBinary = path_1.default.basename(process.execPath).toLowerCase().includes('aj-bg');
                    command = (_c = args[0]) === null || _c === void 0 ? void 0 : _c.toLowerCase();
                    config = loadConfig();
                    detectAndSaveProjectPath(config);
                    if (!(command === '--server' || command === 'server' || process.env.AJ_MODE === 'server' || (!command && isBgBinary))) return [3 /*break*/, 2];
                    return [4 /*yield*/, startLightweightServer()];
                case 1:
                    _f.sent();
                    return [2 /*return*/];
                case 2:
                    if (!!command) return [3 /*break*/, 4];
                    return [4 /*yield*/, startInteractiveSession(config)];
                case 3:
                    _f.sent();
                    return [2 /*return*/];
                case 4:
                    _a = command;
                    switch (_a) {
                        case 'help': return [3 /*break*/, 5];
                        case '--help': return [3 /*break*/, 5];
                        case '-h': return [3 /*break*/, 5];
                        case 'pair': return [3 /*break*/, 6];
                        case '/pair': return [3 /*break*/, 6];
                        case '-pair': return [3 /*break*/, 6];
                        case '--pair': return [3 /*break*/, 6];
                        case 'provider': return [3 /*break*/, 8];
                        case 'key': return [3 /*break*/, 9];
                        case 'model': return [3 /*break*/, 10];
                        case 'config': return [3 /*break*/, 11];
                        case 'auth': return [3 /*break*/, 12];
                        case 'status': return [3 /*break*/, 13];
                        case 'ask': return [3 /*break*/, 15];
                        case 'code': return [3 /*break*/, 27];
                    }
                    return [3 /*break*/, 29];
                case 5:
                    showHelp();
                    return [3 /*break*/, 30];
                case 6: return [4 /*yield*/, handlePairCommand(config)];
                case 7:
                    _f.sent();
                    return [3 /*break*/, 30];
                case 8:
                    {
                        p = (_d = args[1]) === null || _d === void 0 ? void 0 : _d.toLowerCase();
                        valid = ['openai', 'google', 'deepseek', 'openrouter'];
                        if (!p || !valid.includes(p)) {
                            process.stdout.write("Usage: aj provider <openai|google|deepseek|openrouter>\n");
                            process.exit(1);
                        }
                        config.provider = p;
                        saveConfig(config);
                        printSuccess("Provider set to ".concat(p, "."));
                        return [3 /*break*/, 30];
                    }
                    _f.label = 9;
                case 9:
                    {
                        prov = (_e = args[1]) === null || _e === void 0 ? void 0 : _e.toLowerCase();
                        k = args[2];
                        if (!k && args[1]) {
                            k = args[1];
                            prov = k.startsWith('sk-or-') ? 'openrouter' : k.startsWith('sk-') ? 'openai' : k.startsWith('AIza') ? 'google' : (config.provider || 'openai');
                        }
                        if (!k) {
                            process.stdout.write("Usage: aj key [openai|google|deepseek|openrouter] <api_key>\n");
                            process.exit(1);
                        }
                        valid = ['openai', 'google', 'deepseek', 'openrouter'];
                        if (!valid.includes(prov)) {
                            process.stdout.write("Invalid provider. Choose: openai, google, deepseek, openrouter\n");
                            process.exit(1);
                        }
                        if (prov === 'google')
                            config.googleKey = k;
                        else if (prov === 'openai')
                            config.openaiKey = k;
                        else if (prov === 'deepseek')
                            config.deepseekKey = k;
                        else if (prov === 'openrouter')
                            config.openrouterKey = k;
                        config.provider = prov;
                        saveConfig(config, false);
                        printSuccess("Saved ".concat(prov, " key."));
                        return [3 /*break*/, 30];
                    }
                    _f.label = 10;
                case 10:
                    {
                        m = args.slice(1).join(' ');
                        if (!m) {
                            process.stdout.write("Usage: aj model <model_name>\n");
                            process.exit(1);
                        }
                        config.model = m;
                        saveConfig(config);
                        printSuccess("Model set to '".concat(m, "'."));
                        return [3 /*break*/, 30];
                    }
                    _f.label = 11;
                case 11:
                    {
                        w = termWidth();
                        titleText = (0, ansi_ts_1.gradientText)('Apple Juice', ansi_ts_1.SUNSET_START, ansi_ts_1.SUNSET_END);
                        process.stdout.write("\n  ".concat(BOLD).concat(titleText).concat(R, "  ").concat(DIM, "Configuration").concat(R, "\n"));
                        process.stdout.write("  ".concat(DIM).concat('─'.repeat(w - 4)).concat(R, "\n\n"));
                        rows = [
                            ['API URL', config.apiUrl],
                            ['Provider', config.provider || 'openai (default)'],
                            ['Model', config.model || 'gpt-4o-mini (default)'],
                            ['OpenAI Key', config.openaiKey ? config.openaiKey.slice(0, 12) + '…' : 'not set'],
                            ['Google Key', config.googleKey ? config.googleKey.slice(0, 12) + '…' : 'not set'],
                        ];
                        for (_i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                            _b = rows_1[_i], k = _b[0], v = _b[1];
                            process.stdout.write("  ".concat(BRAND).concat(k.padEnd(14)).concat(R).concat(DIM).concat(v).concat(R, "\n"));
                        }
                        process.stdout.write('\n');
                        return [3 /*break*/, 30];
                    }
                    _f.label = 12;
                case 12:
                    {
                        k = args[1];
                        if (!k) {
                            process.stdout.write("Usage: aj auth <sessionKey> [-g|--global]\n");
                            process.exit(1);
                        }
                        config.sessionKey = k;
                        isGlobal = args.includes('--global') || args.includes('-g');
                        saveConfig(config, isGlobal);
                        printSuccess("Session key saved ".concat(isGlobal ? 'globally' : 'locally', "."));
                        return [3 /*break*/, 30];
                    }
                    _f.label = 13;
                case 13: return [4 /*yield*/, handleStatusCommand(config)];
                case 14:
                    _f.sent();
                    return [3 /*break*/, 30];
                case 15:
                    q = args.slice(1).join(' ');
                    if (!q) {
                        process.stdout.write("Usage: aj ask \"<prompt>\"\n");
                        process.exit(1);
                    }
                    return [4 /*yield*/, pingServer(config.apiUrl)];
                case 16:
                    online = _f.sent();
                    if (!!online) return [3 /*break*/, 19];
                    return [4 /*yield*/, startServerAutomatically(config)];
                case 17:
                    online = _f.sent();
                    if (!!online) return [3 /*break*/, 19];
                    return [4 /*yield*/, startLightweightServer(true)];
                case 18:
                    _f.sent();
                    online = true;
                    _f.label = 19;
                case 19:
                    startSpinner('Asking');
                    _f.label = 20;
                case 20:
                    _f.trys.push([20, 25, , 26]);
                    return [4 /*yield*/, fetch("".concat(config.apiUrl, "/api/chat"), {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                prompt: q,
                                sessionKey: config.sessionKey,
                                messages: [],
                                provider: config.provider,
                                apiKey: config.provider === 'google' ? config.googleKey
                                    : config.provider === 'deepseek' ? config.deepseekKey
                                        : config.provider === 'openrouter' ? config.openrouterKey
                                            : config.openaiKey,
                                openaiKey: config.openaiKey,
                                model: config.model
                            }),
                        })];
                case 21:
                    res = _f.sent();
                    stopSpinner();
                    if (!res.ok) return [3 /*break*/, 23];
                    return [4 /*yield*/, res.json()];
                case 22:
                    d = _f.sent();
                    process.stdout.write('\n');
                    replyText = (d.message || d.code || JSON.stringify(d));
                    if (Array.isArray(d.scripts) && d.scripts.length > 0) {
                        replyText += formatArtifactsBox(d.scripts);
                    }
                    process.stdout.write(renderMarkdown(replyText));
                    process.stdout.write('\n\n');
                    return [3 /*break*/, 24];
                case 23:
                    printError("Error ".concat(res.status));
                    _f.label = 24;
                case 24: return [3 /*break*/, 26];
                case 25:
                    e_9 = _f.sent();
                    stopSpinner();
                    printError(e_9.message);
                    return [3 /*break*/, 26];
                case 26: return [3 /*break*/, 30];
                case 27:
                    file = args[1];
                    pIdx = args.indexOf('-p');
                    if (pIdx < 0)
                        pIdx = args.indexOf('--prompt');
                    if (!file || pIdx < 0 || !args[pIdx + 1]) {
                        process.stdout.write("Usage: aj code <file> -p \"<instructions>\"\n");
                        process.exit(1);
                    }
                    return [4 /*yield*/, handleCodeCommand(config, file, args[pIdx + 1])];
                case 28:
                    _f.sent();
                    return [3 /*break*/, 30];
                case 29:
                    printError("Unknown command: '".concat(command, "'. Type ").concat(BRAND, "aj help").concat(R, " for usage."));
                    _f.label = 30;
                case 30: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    process.stderr.write("\n  \u2717 Unexpected error: ".concat(err.stack || err, "\n\n"));
    process.exit(1);
});
// ─── Lightweight In-Process Server ───────────────────────────────────────────
var LIGHTWEIGHT_SYSTEM_PROMPT = "### ABSOLUTE OUTPUT RULE \u2014 READ THIS FIRST ###\nYour ENTIRE response MUST be a single valid JSON object and NOTHING ELSE.\n- NO plain text before or after the JSON.\n- NO markdown fences (```json ... ```).\n- DO NOT describe what you are going to do before outputting the JSON. DO IT by writing the code in the \"code\" or \"scripts\" field.\n- If you output anything other than a raw JSON object starting with { and ending with }, the response will be REJECTED.\n\nThe only valid JSON response shape is:\n{\n  \"message\": \"Your text response explaining what you did, tips, or guidance.\",\n  \"code\": \"The raw code block you generated or updated (no markdown backticks, just raw code).\",\n  \"scripts\": [\n    {\n      \"action\": \"create\",\n      \"scriptType\": \"Script\" | \"LocalScript\" | \"ModuleScript\",\n      \"parent\": \"ServerScriptService\" | \"ReplicatedStorage\" | \"StarterGui\" | \"StarterPlayerScripts\",\n      \"name\": \"ScriptName\",\n      \"code\": \"-- full script code here\"\n    }\n  ],\n  \"suggestions\": [\"Add more items\", \"Add purchase animations\"]\n}\n\nIf you cannot produce code, still return JSON: {\"scripts\":[], \"code\": \"\", \"message\": \"<explanation>\", \"suggestions\":[]}\n\n### YOU ARE: Apple Juice AI ###\nYou are an expert Roblox game developer and software architect operating directly inside Roblox Studio via a sync plugin.\nYou build games by writing Roblox Luau code. You NEVER show code for the user to copy-paste. You ONLY write code in the \"code\" or \"scripts\" fields.\n\n## WORKFLOW & ACTIONS\nIf generating or modifying multiple files, add JSON objects to the \"scripts\" array. The plugin executes each entry live in Studio.\nSupported Actions in the \"scripts\" array:\n1. \"create\" \u2014 Create or replace a script.\n   Usage: {\"action\": \"create\", \"scriptType\": \"Script\" | \"LocalScript\" | \"ModuleScript\", \"parent\": \"ServerScriptService\", \"name\": \"MyScript\", \"code\": \"-- entire code\"}\n2. \"delete\" \u2014 Delete an instance.\n   Usage: {\"action\": \"delete\", \"name\": \"Name\", \"parent\": \"ParentPath\"}\n3. \"create_instance\" \u2014 Create high-level non-script objects (Folders, RemoteEvents, ScreenGuis, etc.).\n   Usage: {\"action\": \"create_instance\", \"className\": \"RemoteEvent\", \"instanceName\": \"MyEvent\", \"parent\": \"ReplicatedStorage\"}\n4. \"rename_instance\" \u2014 Rename an object.\n   Usage: {\"action\": \"rename_instance\", \"oldPath\": \"Workspace.OldName\", \"newName\": \"NewName\"}\n5. \"move_instance\" \u2014 Move an object.\n   Usage: {\"action\": \"move_instance\", \"oldPath\": \"Workspace.MyPart\", \"newParentPath\": \"ServerStorage\"}\n6. \"run_playtest\" \u2014 Trigger a 6-second playtest to verify functionality. Always include this as the last entry if playtesting is needed.\n   Usage: {\"action\": \"run_playtest\"}\n\n## ROBLOX ARCHITECTURE & PARADIGMS\n- **Workspace**: 3D world, BaseParts, Models, terrain. Replicated.\n- **ServerScriptService**: Server Scripts. Never accessible from client.\n- **ServerStorage**: Server-only assets and data. Not replicated.\n- **ReplicatedStorage**: Shared modules, RemoteEvents, RemoteFunctions, assets. Replicated.\n- **StarterPlayerScripts** / **StarterCharacterScripts**: LocalScripts cloned per player.\n- **StarterGui**: ScreenGuis and LocalScripts cloned to PlayerGui.\n- **Replication**: Server is authoritative. Clients communicate via RemoteEvents (fire-and-forget) and RemoteFunctions (request-response). NEVER trust the client; validate all Remote inputs on the server.\n\n## ROBLOX LUAU STYLE & SAFETY\n- **Strong Typing**: Use Luau type annotations where appropriate (e.g. `local speed: number = 100`, type assertions `x :: type`).\n- **Operators**: Use compound assignments like `+=`, `-=`, `..=`, and ternary expressions `if a then b else c`.\n- **Scoping**: ALWAYS use `local` for variables and functions. Never declare global variables.\n- **Service Access**: ALWAYS use `game:GetService(\"ServiceName\")` instead of `game.ServiceName`.\n- **Instance Safety**: Use `WaitForChild(\"Name\", timeout)` or `FindFirstChild` on clients to prevent infinite yield warnings.\n- **Task Library**: STRICTLY use `task.spawn`, `task.defer`, `task.delay`, and `task.wait` instead of legacy `spawn`, `delay`, `wait`.\n- **Clean Up**: Always disconnect connections, destroy instances, and clean up threads when destroyed to prevent memory leaks.\n- **Full Implementation**: ZERO TOLERANCE for placeholders, TODOs, or leaving parts for the user to implement. Write the complete, robust, production-ready code.\n- Every script MUST start with a print statement: `print(\"[AppleJuice] Running ScriptName...\")`\n- INFINITE YIELD GUARD: NEVER use WaitForChild() without a timeout (e.g., use `WaitForChild(\"Name\", 5)`).\n- DO NOT spawn Parts or any 3D objects in the Workspace unless the user explicitly asks you to create physical 3D objects.\n- Place Scripts in ServerScriptService and LocalScripts in StarterPlayerScripts or StarterGui. Never put scripts directly in the Workspace.\n\n## UI GENERATION \u2014 USE AppleJuiceUI LIBRARY\nWhen creating ANY UI, you MUST require and use the AppleJuiceUI component library located in ReplicatedStorage:\n```luau\nlocal UI = require(game:GetService(\"ReplicatedStorage\"):WaitForChild(\"AppleJuiceUI\", 10))\nUI.setTheme(\"Juice\") -- themes: \"Juice\" (lime), \"Midnight\" (blue), \"Ember\" (orange), \"Claude\" (violet/orange developer style)\n```\n\n### One-Call Templates:\n- `UI.ShopTemplate({Title, Tabs: { {Id, Label, Items: {{Text, Price, Icon}} } }})`\n- `UI.InventoryTemplate({Title, Items: { {Name, Icon, Count, Rarity} }})`\n- `UI.HUDTemplate({StartingCoins})` (returns {health, currency})\n\n### Individual Components:\n- `UI.createScreenGui(\"Name\")`\n- `UI.DynamicScale(screen)`\n- `UI.Card(parent, {Size, Position})`\n- `UI.Button(parent, {Text, Style, OnClick})`\n- `UI.ProgressBar(parent, {Value, Label, FillColor})`\n- `UI.Toast(screen, {Text, Type})`\n\n### Icons Catalog (use UI.Icons.X):\nCoin, Cash, Crystal, Diamond, Ingot, Premium, Robux, Ticket, VIP, Aura, Trail, Teleport, AngelHeart, Magnet, Crown, LuckyBlock, Coil, Trophy, Shield, Sword, Gift, Potion, Rocket, Fire, Heart, Hoverboard, Lightning, Rebirth, Star, Upgrade, Wheel.\n\nFINAL REMINDER: Return ONLY a single, valid JSON object containing your response. Do not enclose it in markdown code blocks.";
function callDirectAI(prompt, messages, provider, apiKey, model) {
    return __awaiter(this, void 0, void 0, function () {
        var geminiResponseSchema, openaiResponseFormat, url, contents, res, _a, _b, _c, data, text, url, apiMessages, headers, resolvedModel, res, _d, _e, _f, data, text;
        var _g, _h, _j, _k, _l, _m, _o, _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    geminiResponseSchema = {
                        type: 'OBJECT',
                        properties: {
                            message: { type: 'STRING', description: 'Your text response explaining what you did, tips, or guidance.' },
                            code: { type: 'STRING', description: 'The raw code block you generated or updated (no markdown backticks, just raw code).' },
                            scripts: {
                                type: 'ARRAY',
                                description: 'An array of action scripts to execute in Roblox Studio.',
                                items: {
                                    type: 'OBJECT',
                                    properties: {
                                        action: { type: 'STRING', description: 'The action to take: create, delete, create_instance, rename_instance, move_instance, run_playtest' },
                                        scriptType: { type: 'STRING', description: 'Script, LocalScript, or ModuleScript' },
                                        parent: { type: 'STRING', description: 'The path to the parent instance (e.g. ServerScriptService, ReplicatedStorage)' },
                                        name: { type: 'STRING', description: 'Name of the script or instance' },
                                        code: { type: 'STRING', description: 'The full Luau code for the script' }
                                    },
                                    required: ['action']
                                }
                            },
                            suggestions: {
                                type: 'ARRAY',
                                items: { type: 'STRING' },
                                description: 'An array of 2-3 suggestions for the user.'
                            }
                        },
                        required: ['message']
                    };
                    openaiResponseFormat = {
                        type: 'json_schema',
                        json_schema: {
                            name: 'AppleJuiceResponse',
                            strict: false,
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', description: 'Your text response explaining what you did.' },
                                    code: { type: 'string', description: 'The raw code block you generated or updated.' },
                                    scripts: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                action: { type: 'string', enum: ['create', 'delete', 'create_instance', 'rename_instance', 'move_instance', 'run_playtest'] },
                                                scriptType: { type: 'string', enum: ['Script', 'LocalScript', 'ModuleScript'] },
                                                parent: { type: 'string' },
                                                name: { type: 'string' },
                                                code: { type: 'string' }
                                            },
                                            required: ['action']
                                        }
                                    },
                                    suggestions: {
                                        type: 'array',
                                        items: { type: 'string' }
                                    }
                                },
                                required: ['message']
                            }
                        }
                    };
                    if (!(provider === 'google')) return [3 /*break*/, 5];
                    url = "https://generativelanguage.googleapis.com/v1beta/models/".concat(model || 'gemini-1.5-flash', ":generateContent?key=").concat(apiKey);
                    contents = __spreadArray(__spreadArray([
                        { role: 'user', parts: [{ text: LIGHTWEIGHT_SYSTEM_PROMPT }] },
                        { role: 'model', parts: [{ text: 'Understood.' }] }
                    ], messages.map(function (m) { return ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }); }), true), [
                        { role: 'user', parts: [{ text: prompt }] },
                    ], false);
                    return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: contents,
                                generationConfig: {
                                    temperature: 0.2,
                                    responseMimeType: 'application/json',
                                    responseSchema: geminiResponseSchema
                                }
                            })
                        })];
                case 1:
                    res = _q.sent();
                    if (!!res.ok) return [3 /*break*/, 3];
                    _a = Error.bind;
                    _c = (_b = "Gemini: ".concat(res.statusText, " - ")).concat;
                    return [4 /*yield*/, res.text()];
                case 2: throw new (_a.apply(Error, [void 0, _c.apply(_b, [_q.sent()])]))();
                case 3: return [4 /*yield*/, res.json()];
                case 4:
                    data = _q.sent();
                    text = ((_l = (_k = (_j = (_h = (_g = data.candidates) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.content) === null || _j === void 0 ? void 0 : _j.parts) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.text) || '{}';
                    try {
                        return [2 /*return*/, JSON.parse(text.trim().replace(/^```json/i, '').replace(/```$/, ''))];
                    }
                    catch (_r) {
                        return [2 /*return*/, { message: text, code: '' }];
                    }
                    return [3 /*break*/, 10];
                case 5:
                    url = 'https://api.openai.com/v1/chat/completions';
                    if (provider === 'deepseek') {
                        url = 'https://api.deepseek.com/v1/chat/completions';
                    }
                    else if (provider === 'openrouter') {
                        url = 'https://openrouter.ai/api/v1/chat/completions';
                    }
                    apiMessages = __spreadArray(__spreadArray([{ role: 'system', content: LIGHTWEIGHT_SYSTEM_PROMPT }], messages.map(function (m) { return ({ role: m.role, content: m.content }); }), true), [{ role: 'user', content: prompt }], false);
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': "Bearer ".concat(apiKey),
                    };
                    if (provider === 'openrouter') {
                        headers['HTTP-Referer'] = 'https://github.com/inetixus/apple-juice';
                        headers['X-Title'] = 'Apple Juice Roblox Sync';
                    }
                    resolvedModel = model || (provider === 'deepseek' ? 'deepseek-chat' : provider === 'openrouter' ? 'meta-llama/llama-3.3-70b-instruct:free' : 'gpt-4o-mini');
                    if (provider === 'openrouter') {
                        resolvedModel = resolvedModel.replace(/^openrouter\//, '');
                    }
                    return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify({
                                model: resolvedModel,
                                temperature: 0.2,
                                messages: apiMessages,
                                response_format: openaiResponseFormat
                            })
                        })];
                case 6:
                    res = _q.sent();
                    if (!!res.ok) return [3 /*break*/, 8];
                    _d = Error.bind;
                    _f = (_e = "".concat(provider === 'openrouter' ? 'OpenRouter' : provider === 'deepseek' ? 'DeepSeek' : 'OpenAI', " API Error ").concat(res.status, ": ").concat(res.statusText, " - ")).concat;
                    return [4 /*yield*/, res.text()];
                case 7: throw new (_d.apply(Error, [void 0, _f.apply(_e, [_q.sent()])]))();
                case 8: return [4 /*yield*/, res.json()];
                case 9:
                    data = _q.sent();
                    text = ((_p = (_o = (_m = data.choices) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.message) === null || _p === void 0 ? void 0 : _p.content) || '{}';
                    try {
                        return [2 /*return*/, JSON.parse(text.trim())];
                    }
                    catch (_s) {
                        return [2 /*return*/, { message: text, code: '' }];
                    }
                    _q.label = 10;
                case 10: return [2 /*return*/];
            }
        });
    });
}
function startLightweightServer() {
    return __awaiter(this, arguments, void 0, function (inProcess) {
        var logFile, logStream_1, log, port, activeSessionKey, lastPollTime, pendingCodePayload, server;
        var _this = this;
        if (inProcess === void 0) { inProcess = false; }
        return __generator(this, function (_a) {
            if (!inProcess) {
                try {
                    logFile = path_1.default.join(os_1.default.homedir(), '.applejuice-server.log');
                    logStream_1 = fs_1.default.createWriteStream(logFile, { flags: 'a' });
                    log = function () {
                        var a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            a[_i] = arguments[_i];
                        }
                        return logStream_1.write("[".concat(new Date().toISOString(), "] ").concat(a.map(function (x) { return typeof x === 'object' ? JSON.stringify(x) : String(x); }).join(' '), "\n"));
                    };
                    console.log = log;
                    console.error = log;
                }
                catch (_) { }
                process.on('uncaughtException', function (err) { return console.error('Uncaught:', err); });
                process.on('unhandledRejection', function (reason) { return console.error('Unhandled:', reason); });
            }
            port = 3000;
            activeSessionKey = 'LOCAL-SESSION-KEY';
            lastPollTime = Date.now();
            pendingCodePayload = null;
            server = http_1.default.createServer(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var url, path_, sendJSON, body, b, code, b, pluginPayload, b, r, normAction, normSource, normParent, normName, normType, pathParts, parentStr, scriptResults, e_10;
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                return __generator(this, function (_p) {
                    switch (_p.label) {
                        case 0:
                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                            if (req.method === 'OPTIONS') {
                                res.writeHead(200);
                                res.end();
                                return [2 /*return*/];
                            }
                            url = new URL(req.url || '', "http://localhost:".concat(port));
                            path_ = url.pathname;
                            sendJSON = function (data, status) {
                                if (status === void 0) { status = 200; }
                                res.writeHead(status, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify(data));
                            };
                            body = function () { return new Promise(function (resolve) { var b = ''; req.on('data', function (c) { return b += c; }); req.on('end', function () { try {
                                resolve(JSON.parse(b));
                            }
                            catch (_a) {
                                resolve({});
                            } }); }); };
                            if (path_ === '/api/projects' && req.method === 'GET') {
                                sendJSON([]);
                                return [2 /*return*/];
                            }
                            if (path_ === '/api/status' && req.method === 'GET') {
                                sendJSON({ status: 'ok', lastPollTime: lastPollTime });
                                return [2 /*return*/];
                            }
                            if (!(path_ === '/api/pair/init' && req.method === 'POST')) return [3 /*break*/, 2];
                            return [4 /*yield*/, body()];
                        case 1:
                            b = _p.sent();
                            code = (b.authCode || '').toUpperCase();
                            if (code)
                                activeSessionKey = code;
                            sendJSON({ ok: true, sessionKey: activeSessionKey, ownerUserId: 'local-user' });
                            return [2 /*return*/];
                        case 2:
                            if (path_ === '/api/pair/keepalive' && req.method === 'POST') {
                                sendJSON({ status: 'ok' });
                                return [2 /*return*/];
                            }
                            if (path_ === '/api/connect' && req.method === 'GET') {
                                sendJSON({ connected: true, sessionKey: activeSessionKey, ip: '127.0.0.1' });
                                return [2 /*return*/];
                            }
                            if (path_ === '/api/poll' && req.method === 'GET') {
                                lastPollTime = Date.now();
                                if (pendingCodePayload) {
                                    sendJSON(pendingCodePayload);
                                    pendingCodePayload = null;
                                }
                                else {
                                    sendJSON({ paired: true, hasNewCode: false });
                                }
                                return [2 /*return*/];
                            }
                            if (!(path_ === '/api/cli/push-code' && req.method === 'POST')) return [3 /*break*/, 4];
                            return [4 /*yield*/, body()];
                        case 3:
                            b = _p.sent();
                            pluginPayload = JSON.stringify({
                                scripts: [{
                                        action: "create",
                                        type: b.type || "Script",
                                        parent: b.parent || "Workspace",
                                        name: b.name || "Script",
                                        code: b.code || ""
                                    }]
                            });
                            pendingCodePayload = {
                                paired: true,
                                hasNewCode: true,
                                code: pluginPayload,
                                messageId: Date.now().toString(),
                                requestedFile: b.name || 'Script'
                            };
                            sendJSON({ ok: true });
                            return [2 /*return*/];
                        case 4:
                            if (['/api/logs', '/api/tree', '/api/report-file', '/api/request-file'].includes(path_) && req.method === 'POST') {
                                sendJSON({ success: true });
                                return [2 /*return*/];
                            }
                            if (!(path_ === '/api/chat' && req.method === 'POST')) return [3 /*break*/, 10];
                            return [4 /*yield*/, body()];
                        case 5:
                            b = _p.sent();
                            _p.label = 6;
                        case 6:
                            _p.trys.push([6, 8, , 9]);
                            return [4 /*yield*/, callDirectAI(b.prompt || '', b.messages || [], b.provider || 'openai', b.apiKey || '', b.model || 'gpt-4o-mini')];
                        case 7:
                            r = _p.sent();
                            if (r && typeof r === 'object') {
                                normAction = (_b = (_a = r.action) !== null && _a !== void 0 ? _a : r.Action) !== null && _b !== void 0 ? _b : "create";
                                normSource = (_g = (_f = (_e = (_d = (_c = r.code) !== null && _c !== void 0 ? _c : r.Source) !== null && _d !== void 0 ? _d : r.content) !== null && _e !== void 0 ? _e : r.Content) !== null && _f !== void 0 ? _f : r.script) !== null && _g !== void 0 ? _g : r.Script;
                                normParent = (_h = r.parent) !== null && _h !== void 0 ? _h : r.Parent;
                                normName = (_j = r.name) !== null && _j !== void 0 ? _j : r.Name;
                                normType = (_o = (_m = (_l = (_k = r.scriptType) !== null && _k !== void 0 ? _k : r.Type) !== null && _l !== void 0 ? _l : r.type) !== null && _m !== void 0 ? _m : r.ClassName) !== null && _o !== void 0 ? _o : r.className;
                                if (normSource === undefined && String(normAction).toLowerCase() === "create") {
                                    normSource = "";
                                }
                                if (r.path && normSource !== undefined) {
                                    pathParts = String(r.path).split('/');
                                    normName = pathParts[pathParts.length - 1];
                                    normParent = pathParts.slice(0, -1).join('/') || 'ReplicatedStorage';
                                }
                                if (typeof normSource === "string" && !Array.isArray(r.scripts)) {
                                    parentStr = String(normParent || 'ReplicatedStorage');
                                    if (parentStr.startsWith('game.')) {
                                        parentStr = parentStr.substring(5);
                                    }
                                    r.scripts = [{
                                            action: String(normAction).toLowerCase(),
                                            type: String(normType || 'Script'),
                                            scriptType: String(normType || 'Script'),
                                            parent: parentStr,
                                            name: String(normName || 'Script'),
                                            code: normSource
                                        }];
                                    r.message = "Successfully created ".concat(normName, " in ").concat(parentStr);
                                }
                                if (Array.isArray(r.scripts) && r.scripts.length > 0) {
                                    scriptResults = r.scripts.map(function (s, i) { return ({
                                        action: s.action || 'create',
                                        type: s.type || s.scriptType || 'Script',
                                        parent: s.parent || 'ServerScriptService',
                                        name: s.name || "GeneratedScript_".concat(i),
                                        code: s.code || ''
                                    }); });
                                    pendingCodePayload = {
                                        paired: true,
                                        hasNewCode: true,
                                        code: JSON.stringify({ scripts: scriptResults }),
                                        messageId: Date.now().toString(),
                                        requestedFile: scriptResults[0].name || 'Script'
                                    };
                                }
                            }
                            sendJSON(r);
                            return [3 /*break*/, 9];
                        case 8:
                            e_10 = _p.sent();
                            sendJSON({ error: e_10.message || 'AI Error' }, 500);
                            return [3 /*break*/, 9];
                        case 9: return [2 /*return*/];
                        case 10:
                            res.writeHead(404);
                            res.end();
                            return [2 /*return*/];
                    }
                });
            }); });
            server.listen(port, function () { if (!inProcess)
                console.log("[Apple Juice] Server on http://localhost:".concat(port)); });
            return [2 /*return*/];
        });
    });
}
