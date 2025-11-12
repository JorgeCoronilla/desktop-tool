"use strict";
/**
 * Herramienta para añadir fórmulas a Excel
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addExcelFormulasTool = void 0;
const XLSX = __importStar(require("xlsx"));
const fs = __importStar(require("fs"));
exports.addExcelFormulasTool = {
    name: 'add_excel_formulas',
    description: 'Añade fórmulas a celdas específicas en un archivo Excel',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Ruta del archivo Excel a modificar'
            },
            formulas: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        cell: { type: 'string', description: 'Celda en notación A1 (ej: A1, B2)' },
                        formula: { type: 'string', description: 'Fórmula a aplicar (ej: =SUM(A1:A10))' }
                    },
                    required: ['cell', 'formula']
                }
            },
            sheetName: {
                type: 'string',
                description: 'Nombre de la hoja a modificar (opcional, por defecto la primera)'
            }
        },
        required: ['filePath', 'formulas']
    },
    execute: async (args) => {
        try {
            const { filePath, formulas, sheetName } = args;
            // Verificar que el archivo existe
            if (!fs.existsSync(filePath)) {
                throw new Error(`El archivo no existe: ${filePath}`);
            }
            // Leer el archivo existente
            const workbook = XLSX.readFile(filePath);
            // Determinar la hoja a modificar
            const targetSheetName = sheetName || workbook.SheetNames[0];
            if (!workbook.SheetNames.includes(targetSheetName)) {
                throw new Error(`La hoja '${targetSheetName}' no existe en el archivo`);
            }
            const worksheet = workbook.Sheets[targetSheetName];
            // Aplicar fórmulas
            let formulasAdded = 0;
            for (const formulaConfig of formulas) {
                const { cell, formula } = formulaConfig;
                // Validar la celda
                if (!cell.match(/^[A-Z]+[0-9]+$/)) {
                    throw new Error(`Formato de celda inválido: ${cell}`);
                }
                // Aplicar la fórmula
                worksheet[cell] = {
                    f: formula, // La fórmula
                    t: 'n' // Tipo numérico (se calculará automáticamente)
                };
                formulasAdded++;
            }
            // Guardar los cambios
            XLSX.writeFile(workbook, filePath);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Fórmulas añadidas exitosamente`,
                            sheetName: targetSheetName,
                            formulasAdded: formulasAdded,
                            filePath: filePath
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
                            error: error instanceof Error ? error.message : 'Error desconocido al añadir fórmulas'
                        }, null, 2)
                    }]
            };
        }
    }
};
