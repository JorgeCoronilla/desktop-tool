"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfTools = exports.ocrPdfTool = exports.readPdfChunkTool = exports.readPdfTool = exports.readPdfSmartTool = void 0;
// Exportar todas las herramientas de PDF
var readPdfSmart_1 = require("./readPdfSmart");
Object.defineProperty(exports, "readPdfSmartTool", { enumerable: true, get: function () { return readPdfSmart_1.readPdfSmartTool; } });
var readPdf_1 = require("./readPdf");
Object.defineProperty(exports, "readPdfTool", { enumerable: true, get: function () { return readPdf_1.readPdfTool; } });
var readPdfChunk_1 = require("./readPdfChunk");
Object.defineProperty(exports, "readPdfChunkTool", { enumerable: true, get: function () { return readPdfChunk_1.readPdfChunkTool; } });
var ocrPdf_1 = require("./ocrPdf");
Object.defineProperty(exports, "ocrPdfTool", { enumerable: true, get: function () { return ocrPdf_1.ocrPdfTool; } });
// Array para importar todas las herramientas de PDF fácilmente
exports.pdfTools = [
    readPdfSmartTool,
    readPdfTool,
    readPdfChunkTool,
    ocrPdfTool,
];
