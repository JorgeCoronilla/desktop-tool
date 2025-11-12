"use strict";
/**
 * Herramienta para leer PDFs en fragmentos
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
exports.readPdfChunkTool = void 0;
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
exports.readPdfChunkTool = {
    name: 'read_pdf_chunk',
    description: 'Lee PDFs muy grandes en fragmentos para evitar límites de tokens. Útil cuando read_pdf_smart indica que el PDF es demasiado grande.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Ruta del archivo PDF a leer',
            },
            chunkIndex: {
                type: 'number',
                description: 'Índice del fragmento a leer (empieza en 0)',
                default: 0,
            },
            chunkSize: {
                type: 'number',
                description: 'Tamaño del fragmento en caracteres. Default: 8000',
                default: 8000,
            },
            overlap: {
                type: 'number',
                description: 'Superposición entre fragmentos en caracteres. Default: 500',
                default: 500,
            },
        },
        required: ['filePath'],
    },
    execute: async (args) => {
        try {
            const { filePath, chunkIndex = 0, chunkSize = 8000, overlap = 500 } = args;
            let resolvedPath = filePath;
            // Resolver ruta relativa si se proporciona cwd
            if (args._options?.cwd && !require('path').isAbsolute(filePath)) {
                resolvedPath = require('path').resolve(args._options.cwd, filePath);
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
            // Obtener el texto completo del PDF
            const data = await pdfParse(dataBuffer);
            const fullText = data.text;
            // Calcular el fragmento
            const startPos = Math.max(0, chunkIndex * (chunkSize - overlap));
            const endPos = Math.min(fullText.length, startPos + chunkSize);
            const chunkText = fullText.substring(startPos, endPos);
            // Calcular información sobre fragmentos
            const totalChunks = Math.ceil(fullText.length / (chunkSize - overlap));
            const hasNext = endPos < fullText.length;
            const hasPrevious = startPos > 0;
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            chunkText,
                            chunkIndex,
                            chunkSize: chunkText.length,
                            totalChunks,
                            hasNext,
                            hasPrevious,
                            startPosition: startPos,
                            endPosition: endPos,
                            totalTextLength: fullText.length,
                            pages: data.numpages,
                            info: data.info,
                            metadata: data.metadata,
                            method: 'chunked'
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
                            error: error instanceof Error ? error.message : 'Error desconocido al leer fragmento de PDF'
                        }, null, 2)
                    }]
            };
        }
    }
};
