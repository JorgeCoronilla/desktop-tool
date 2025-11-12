"use strict";
/**
 * Herramienta para leer archivos Excel y CSV
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
exports.readExcelTool = void 0;
const XLSX = __importStar(require("xlsx"));
const fs = __importStar(require("fs"));
exports.readExcelTool = {
    name: 'read_excel',
    description: 'Lee archivos Excel o CSV y devuelve los datos en formato JSON',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Ruta del archivo Excel o CSV a leer'
            },
            sheetName: {
                type: 'string',
                description: 'Nombre de la hoja a leer (opcional, por defecto la primera)'
            },
            range: {
                type: 'string',
                description: 'Rango de celdas a leer (ej: A1:C10) (opcional)'
            },
            hasHeaders: {
                type: 'boolean',
                description: 'Indica si la primera fila contiene encabezados (por defecto true)'
            }
        },
        required: ['filePath']
    },
    execute: async (args) => {
        try {
            const { filePath, sheetName, range, hasHeaders = true } = args;
            // Verificar que el archivo existe
            if (!fs.existsSync(filePath)) {
                throw new Error(`El archivo no existe: ${filePath}`);
            }
            // Leer el archivo
            const workbook = XLSX.readFile(filePath);
            // Determinar la hoja a leer
            const targetSheetName = sheetName || workbook.SheetNames[0];
            if (!workbook.SheetNames.includes(targetSheetName)) {
                throw new Error(`La hoja '${targetSheetName}' no existe en el archivo`);
            }
            const worksheet = workbook.Sheets[targetSheetName];
            // Opciones de lectura
            const readOptions = {
                header: hasHeaders ? 1 : undefined,
                range: range || undefined,
                defval: null // Valor por defecto para celdas vacías
            };
            // Convertir a JSON
            const data = XLSX.utils.sheet_to_json(worksheet, readOptions);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            data: data,
                            sheetName: targetSheetName,
                            totalRows: data.length,
                            hasHeaders: hasHeaders
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
                            error: error instanceof Error ? error.message : 'Error desconocido al leer el archivo'
                        }, null, 2)
                    }]
            };
        }
    }
};
