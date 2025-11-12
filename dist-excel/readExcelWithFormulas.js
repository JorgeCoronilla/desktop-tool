"use strict";
/**
 * Herramienta para leer Excel con fórmulas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readExcelWithFormulasTool = void 0;
const XLSX = require("xlsx");
const fs = require("fs");
exports.readExcelWithFormulasTool = {
    name: 'read_excel_with_formulas',
    description: 'Lee un archivo Excel y devuelve los datos incluyendo las fórmulas',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Ruta del archivo Excel a leer'
            },
            sheetName: {
                type: 'string',
                description: 'Nombre de la hoja a leer (opcional, por defecto la primera)'
            },
            range: {
                type: 'string',
                description: 'Rango de celdas a leer (ej: A1:C10, opcional)'
            },
            hasHeaders: {
                type: 'boolean',
                description: 'Si la primera fila contiene encabezados (por defecto true)'
            }
        },
        required: ['filePath']
    },
    execute: async (args) => {
        try {
            const { filePath, sheetName, range, hasHeaders = true } = args;
            if (!fs.existsSync(filePath)) {
                throw new Error(`El archivo no existe: ${filePath}`);
            }
            const workbook = XLSX.readFile(filePath, { cellFormula: true, cellText: true });
            const targetSheet = sheetName || workbook.SheetNames[0];
            if (!workbook.SheetNames.includes(targetSheet)) {
                throw new Error(`La hoja '${targetSheet}' no existe`);
            }
            const worksheet = workbook.Sheets[targetSheet];
            // Leer con fórmulas
            const options = {
                header: hasHeaders ? 1 : 'A',
                defval: null,
                raw: false,
                range: range || undefined
            };
            const data = XLSX.utils.sheet_to_json(worksheet, options);
            // Obtener información de fórmulas
            const formulas = {};
            Object.keys(worksheet).forEach(cell => {
                if (worksheet[cell].f) {
                    formulas[cell] = {
                        formula: worksheet[cell].f,
                        value: worksheet[cell].v,
                        calculatedValue: worksheet[cell].v
                    };
                }
            });
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            data: data,
                            formulas: formulas,
                            sheetName: targetSheet,
                            range: range || 'all',
                            hasHeaders: hasHeaders,
                            totalRows: data.length,
                            totalFormulas: Object.keys(formulas).length
                        }, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Error desconocido al leer Excel'
                        }, null, 2)
                    }]
            };
        }
    }
};
