"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webTools = exports.webScrapeTool = exports.webSearchTool = void 0;
// Exportar todas las herramientas web
var webSearch_1 = require("./webSearch");
Object.defineProperty(exports, "webSearchTool", { enumerable: true, get: function () { return webSearch_1.webSearchTool; } });
var webScrape_1 = require("./webScrape");
Object.defineProperty(exports, "webScrapeTool", { enumerable: true, get: function () { return webScrape_1.webScrapeTool; } });
// Array para importar todas las herramientas web fácilmente
exports.webTools = [
    webSearchTool,
    webScrapeTool,
];
