"use strict";
// Exportar todas las herramientas de Excel
Object.defineProperty(exports, "__esModule", { value: true });
exports.excelTools = exports.getExcelFormulasInfoTool = exports.calculateExcelFormulasTool = exports.addExcelFormulasTool = exports.readExcelWithFormulasTool = exports.styleExcelCellsTool = exports.modifyExcelTool = exports.writeExcelTool = exports.readExcelTool = void 0;
var readExcel_1 = require("./readExcel");
Object.defineProperty(exports, "readExcelTool", { enumerable: true, get: function () { return readExcel_1.readExcelTool; } });
var writeExcel_1 = require("./writeExcel");
Object.defineProperty(exports, "writeExcelTool", { enumerable: true, get: function () { return writeExcel_1.writeExcelTool; } });
var modifyExcel_1 = require("./modifyExcel");
Object.defineProperty(exports, "modifyExcelTool", { enumerable: true, get: function () { return modifyExcel_1.modifyExcelTool; } });
var styleExcelCells_1 = require("./styleExcelCells");
Object.defineProperty(exports, "styleExcelCellsTool", { enumerable: true, get: function () { return styleExcelCells_1.styleExcelCellsTool; } });
var readExcelWithFormulas_1 = require("./readExcelWithFormulas");
Object.defineProperty(exports, "readExcelWithFormulasTool", { enumerable: true, get: function () { return readExcelWithFormulas_1.readExcelWithFormulasTool; } });
var addExcelFormulas_1 = require("./addExcelFormulas");
Object.defineProperty(exports, "addExcelFormulasTool", { enumerable: true, get: function () { return addExcelFormulas_1.addExcelFormulasTool; } });
var calculateExcelFormulas_1 = require("./calculateExcelFormulas");
Object.defineProperty(exports, "calculateExcelFormulasTool", { enumerable: true, get: function () { return calculateExcelFormulas_1.calculateExcelFormulasTool; } });
var getExcelFormulasInfo_1 = require("./getExcelFormulasInfo");
Object.defineProperty(exports, "getExcelFormulasInfoTool", { enumerable: true, get: function () { return getExcelFormulasInfo_1.getExcelFormulasInfoTool; } });
// Array con todas las herramientas de Excel para facilitar la importación
exports.excelTools = [
    readExcelTool,
    writeExcelTool,
    modifyExcelTool,
    styleExcelCellsTool,
    readExcelWithFormulasTool,
    addExcelFormulasTool,
    calculateExcelFormulasTool,
    getExcelFormulasInfoTool
];
