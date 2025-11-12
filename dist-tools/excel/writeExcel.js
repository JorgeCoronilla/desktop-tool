"use strict";
/**
 * Herramienta para escribir/crear archivos Excel
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
exports.writeExcelTool = void 0;
const XLSX = __importStar(require("xlsx"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.writeExcelTool = {
    name: 'write_excel',
    description: 'Crea o sobrescribe archivos Excel con datos JSON',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Ruta donde se guardará el archivo Excel'
            },
            data: {
                type: 'array',
                description: 'Datos a escribir en formato array de objetos o arrays'
            },
            sheetName: {
                type: 'string',
                description: 'Nombre de la hoja (opcional, por defecto "Sheet1")'
            },
            headers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Encabezados opcionales para las columnas'
            }
        },
        required: ['filePath', 'data']
    },
    execute: async (args) => {
        try {
            const { filePath, data, sheetName = 'Sheet1', headers } = args;
            // Validar datos
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('Los datos deben ser un array no vacío');
            }
            // Crear el libro de trabajo
            const workbook = XLSX.utils.book_new();
            // Convertir datos a hoja de cálculo
            let worksheet;
            if (headers && Array.isArray(headers)) {
                // Si hay headers explícitos, usarlos
                worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
            }
            else if (Array.isArray(data[0])) {
                // Si los datos son arrays (formato tabla)
                worksheet = XLSX.utils.aoa_to_sheet(data);
            }
            else {
                // Si los datos son objetos (formato JSON)
                worksheet = XLSX.utils.json_to_sheet(data);
            }
            // Añadir la hoja al libro
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            // Crear directorio si no existe
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Escribir el archivo
            XLSX.writeFile(workbook, filePath);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Archivo Excel creado exitosamente: ${filePath}`,
                            sheetName: sheetName,
                            totalRows: data.length
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
                            error: error instanceof Error ? error.message : 'Error desconocido al escribir el archivo'
                        }, null, 2)
                    }]
            };
        }
    }
};
