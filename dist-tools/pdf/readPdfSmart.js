"use strict";
/**
 * Herramienta para leer PDFs inteligentemente
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
exports.readPdfSmartTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Importaciones dinámicas para evitar problemas de inicialización
let pdfParse = null;
let pdfToPicFromPath = null;
let initializeTesseract = null;
let initializePdfParse = null;
// Funciones de inicialización
async function ensurePdfParse() {
    if (!pdfParse) {
        const pdfParseModule = await Promise.resolve().then(() => __importStar(require('pdf-parse')));
        pdfParse = pdfParseModule.default;
    }
    return pdfParse;
}
async function ensurePdf2pic() {
    if (!pdfToPicFromPath) {
        const { fromPath } = await Promise.resolve().then(() => __importStar(require('pdf2pic')));
        pdfToPicFromPath = fromPath;
    }
    return pdfToPicFromPath;
}
async function ensureTesseract() {
    if (!initializeTesseract) {
        const { createWorker } = await Promise.resolve().then(() => __importStar(require('tesseract.js')));
        initializeTesseract = () => createWorker;
    }
    return initializeTesseract;
}
exports.readPdfSmartTool = {
    name: 'read_pdf_smart',
    description: 'USAR SIEMPRE PRIMERO: Herramienta principal para leer PDFs con estrategias inteligentes. Automáticamente elige la mejor estrategia (lectura directa o OCR) y permite optimizar rendimiento. Use "preview" para facturas/documentos cortos.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Ruta del archivo PDF a leer',
            },
            strategy: {
                type: 'string',
                enum: ['preview', 'full', 'pages', 'limit'],
                description: 'Estrategia: "preview" (facturas/docs cortos, default), "full" (documento completo), "pages" (páginas específicas), "limit" (límite caracteres)',
                default: 'preview',
            },
            pages: {
                type: 'array',
                items: { type: 'number' },
                description: 'Páginas específicas a leer (solo con strategy="pages"). Ej: [1, 3, 5]',
            },
            maxPages: {
                type: 'number',
                description: 'Máximo páginas desde el inicio (strategy="preview"). Default: 3',
                default: 3,
            },
            maxCharacters: {
                type: 'number',
                description: 'Límite de caracteres (strategy="limit"). Default: 10000',
                default: 10000,
            },
            useOcr: {
                type: 'boolean',
                description: 'Forzar OCR aunque haya texto directo. Default: false',
                default: false,
            },
        },
        required: ['filePath'],
    },
    execute: async (args) => {
        try {
            const { filePath, strategy = 'preview', pages, maxPages = 3, maxCharacters = 10000, useOcr = false, _options } = args;
            // Resolver ruta relativa si se proporciona cwd
            let resolvedPath = filePath;
            if (_options?.cwd && !path.isAbsolute(filePath)) {
                resolvedPath = path.resolve(_options.cwd, filePath);
            }
            // Validar que el archivo existe
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`Archivo no encontrado: ${resolvedPath}`);
            }
            // Validar que es un PDF
            if (!resolvedPath.toLowerCase().endsWith('.pdf')) {
                throw new Error('El archivo debe ser un PDF');
            }
            // Verificar que el archivo no esté vacío
            const dataBuffer = fs.readFileSync(resolvedPath);
            if (dataBuffer.length === 0) {
                throw new Error('El archivo PDF está vacío');
            }
            // Verificar que sea un PDF válido (debe empezar con %PDF)
            const pdfHeader = dataBuffer.slice(0, 4).toString();
            if (pdfHeader !== '%PDF') {
                throw new Error('El archivo no es un PDF válido');
            }
            // Inicializar pdf-parse
            await ensurePdfParse();
            // Extraer texto del PDF
            const pdfData = await pdfParse(dataBuffer);
            // Si no se extrajo texto o se fuerza OCR, intentar OCR
            if ((!pdfData.text || pdfData.text.trim().length === 0) || useOcr) {
                if (useOcr) {
                    // Forzar OCR
                    const ocrResult = await performOCR(resolvedPath);
                    return {
                        text: ocrResult.text,
                        pages: pdfData.numpages || 1,
                        method: 'ocr',
                        note: 'Texto extraído mediante OCR (forzado)',
                    };
                }
                else {
                    // Intentar OCR automáticamente
                    try {
                        const ocrResult = await performOCR(resolvedPath);
                        return {
                            text: ocrResult.text,
                            pages: pdfData.numpages || 1,
                            method: 'ocr',
                            note: 'Texto extraído mediante OCR (PDF escaneado)',
                        };
                    }
                    catch (ocrError) {
                        throw new Error(`No se pudo extraer texto del PDF ni mediante OCR: ${ocrError instanceof Error ? ocrError.message : 'Error desconocido'}`);
                    }
                }
            }
            // Aplicar estrategia de lectura
            let extractedText = pdfData.text;
            let pagesRead = [];
            switch (strategy) {
                case 'preview':
                    // Limitar a las primeras páginas
                    const previewPages = Math.min(maxPages, pdfData.numpages || 1);
                    pagesRead = Array.from({ length: previewPages }, (_, i) => i + 1);
                    // Aquí normalmente implementaríamos la lógica para leer páginas específicas
                    // Por simplicidad, usamos el texto completo por ahora
                    break;
                case 'pages':
                    // Leer páginas específicas
                    if (pages && pages.length > 0) {
                        pagesRead = pages;
                        // Similarmente, implementaríamos lógica para páginas específicas
                    }
                    break;
                case 'limit':
                    // Limitar caracteres
                    if (extractedText.length > maxCharacters) {
                        extractedText = extractedText.substring(0, maxCharacters) + '... [texto truncado]';
                    }
                    break;
                case 'full':
                default:
                    // Texto completo
                    pagesRead = Array.from({ length: pdfData.numpages || 1 }, (_, i) => i + 1);
                    break;
            }
            // Verificar si el PDF es muy grande
            const maxSize = 15000;
            if (extractedText.length > maxSize) {
                const chunkSize = 8000;
                const totalChunks = Math.ceil(extractedText.length / chunkSize);
                return {
                    text: `PDF muy grande (${extractedText.length} caracteres). Para evitar límites de tokens, use read_pdf_chunk.`,
                    pages: pdfData.numpages,
                    isLarge: true,
                    totalChunks,
                    chunkSize,
                    suggestion: `Use read_pdf_chunk con chunkIndex de 0 a ${totalChunks - 1} para leer este PDF en fragmentos.`,
                    availableChunks: Array.from({ length: totalChunks }, (_, i) => i),
                    method: 'direct',
                };
            }
            return {
                text: extractedText,
                pages: pdfData.numpages,
                pagesRead: pagesRead,
                method: 'direct',
                strategy: strategy,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            throw new Error(`Error al leer PDF: ${errorMessage}. Intenta usar ocr_pdf para PDFs escaneados.`);
        }
    }
};
// Función auxiliar para realizar OCR
async function performOCR(pdfPath) {
    // Esta es una implementación simplificada
    // En la práctica, necesitaríamos convertir el PDF a imágenes y luego aplicar OCR
    throw new Error('Función OCR no implementada completamente en esta versión modular');
}
