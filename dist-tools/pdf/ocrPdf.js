"use strict";
/**
 * Herramienta para realizar OCR en PDFs
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
exports.ocrPdfTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Importaciones dinámicas
let pdfParse = null;
let pdfToPicFromPath = null;
let createWorker = null;
async function ensureDependencies() {
    if (!pdfParse) {
        const pdfParseModule = await Promise.resolve().then(() => __importStar(require('pdf-parse')));
        pdfParse = pdfParseModule.default;
    }
    if (!pdfToPicFromPath) {
        const { fromPath } = await Promise.resolve().then(() => __importStar(require('pdf2pic')));
        pdfToPicFromPath = fromPath;
    }
    if (!createWorker) {
        const tesseractModule = await Promise.resolve().then(() => __importStar(require('tesseract.js')));
        createWorker = tesseractModule.createWorker;
    }
}
exports.ocrPdfTool = {
    name: 'ocr_pdf',
    description: 'Realiza OCR (Reconocimiento Óptico de Caracteres) en PDFs escaneados o imágenes para extraer texto. Útil cuando read_pdf no encuentra texto.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Ruta del archivo PDF a procesar',
            },
            language: {
                type: 'string',
                description: 'Idioma del texto (spa, eng, por, etc). Default: spa',
                default: 'spa',
            },
            pages: {
                type: 'array',
                items: { type: 'number' },
                description: 'Páginas específicas a procesar (opcional). Ej: [1, 3, 5]',
            },
            quality: {
                type: 'number',
                description: 'Calidad de imagen para OCR (1-100). Default: 75',
                default: 75,
            },
        },
        required: ['filePath'],
    },
    execute: async (args) => {
        try {
            const { filePath, language = 'spa', pages, quality = 75 } = args;
            let resolvedPath = filePath;
            // Resolver ruta relativa si se proporciona cwd
            if (args._options?.cwd && !path.isAbsolute(filePath)) {
                resolvedPath = path.resolve(args._options.cwd, filePath);
            }
            // Verificar que el archivo existe
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`El archivo no existe: ${resolvedPath}`);
            }
            // Verificar que sea un PDF válido
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
            // Inicializar dependencias
            await ensureDependencies();
            // Crear directorio temporal para imágenes
            const tempDir = path.join(os.tmpdir(), `pdf_ocr_${Date.now()}`);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            try {
                // Convertir PDF a imágenes
                const options = {
                    density: quality,
                    saveFilename: 'page',
                    savePath: tempDir,
                    format: 'png',
                    width: 1024,
                    height: 768,
                };
                const convert = pdfToPicFromPath(resolvedPath, options);
                let pageCount = 0;
                let ocrText = '';
                let processedPages = [];
                // Crear worker de Tesseract
                const worker = await createWorker();
                await worker.loadLanguage(language);
                await worker.initialize(language);
                try {
                    // Determinar páginas a procesar
                    let pagesToProcess = [];
                    if (pages && pages.length > 0) {
                        pagesToProcess = pages;
                    }
                    else {
                        // Obtener número total de páginas
                        const pdfData = await pdfParse(dataBuffer);
                        const totalPages = pdfData.numpages || 1;
                        pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1);
                    }
                    // Procesar cada página
                    for (const pageNum of pagesToProcess) {
                        try {
                            // Convertir página a imagen
                            const imageResult = await convert(pageNum);
                            if (imageResult && imageResult.path) {
                                // Realizar OCR en la imagen
                                const { data: { text } } = await worker.recognize(imageResult.path);
                                if (text && text.trim()) {
                                    ocrText += `=== PÁGINA ${pageNum} ===\n${text}\n\n`;
                                    processedPages.push(pageNum);
                                    pageCount++;
                                }
                            }
                        }
                        catch (pageError) {
                            console.warn(`Error procesando página ${pageNum}:`, pageError);
                        }
                    }
                    await worker.terminate();
                    if (pageCount === 0) {
                        throw new Error('No se pudo extraer texto de ninguna página');
                    }
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    text: ocrText,
                                    pagesProcessed: processedPages,
                                    totalPagesProcessed: pageCount,
                                    method: 'ocr',
                                    language: language,
                                    quality: quality,
                                    note: 'Texto extraído mediante OCR'
                                }, null, 2)
                            }]
                    };
                }
                finally {
                    // Limpiar directorio temporal
                    if (fs.existsSync(tempDir)) {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            }
            catch (ocrError) {
                // Limpiar directorio temporal en caso de error
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
                throw ocrError;
            }
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Error desconocido al realizar OCR en PDF'
                        }, null, 2)
                    }]
            };
        }
    }
};
