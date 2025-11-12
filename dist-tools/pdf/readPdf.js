"use strict";
/**
 * Herramienta para leer PDFs (versión legacy)
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
exports.readPdfTool = void 0;
const fs = __importStar(require("fs"));
// Importación dinámica para pdf-parse
let pdfParse = null;
async function ensurePdfParse() {
    if (!pdfParse) {
        const pdfParseModule = await Promise.resolve().then(() => __importStar(require('pdf-parse')));
        pdfParse = pdfParseModule.default;
    }
    return pdfParse;
}
exports.readPdfTool = {
    name: 'read_pdf',
    description: 'HERRAMIENTA LEGACY: Lee texto básico de PDFs. Solo usar si read_pdf_smart no está disponible o falla.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Ruta del archivo PDF a leer',
            },
        },
        required: ['filePath'],
    },
    execute: async (args) => {
        try {
            let resolvedPath = args.filePath;
            // Resolver ruta relativa si se proporciona cwd
            if (args._options?.cwd && !require('path').isAbsolute(args.filePath)) {
                resolvedPath = require('path').resolve(args._options.cwd, args.filePath);
            }
            // Verificar que el archivo existe
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`El archivo no existe: ${resolvedPath}`);
            }
            const dataBuffer = await fs.promises.readFile(resolvedPath);
            // Verificar que el buffer no esté vacío
            if (dataBuffer.length === 0) {
                throw new Error('El archivo PDF está vacío');
            }
            // Verificar que sea un PDF válido (debe empezar con %PDF)
            const pdfHeader = dataBuffer.slice(0, 4).toString();
            if (pdfHeader !== '%PDF') {
                throw new Error('El archivo no es un PDF válido');
            }
            // Inicializar pdf-parse si no está disponible
            await ensurePdfParse();
            // pdf-parse es una función, no una clase
            const data = await pdfParse(dataBuffer);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            text: data.text,
                            pages: data.numpages,
                            info: data.info,
                            metadata: data.metadata,
                            method: 'direct'
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
                            error: error instanceof Error ? error.message : 'Error desconocido al leer PDF'
                        }, null, 2)
                    }]
            };
        }
    }
};
