/**
 * Herramienta para realizar OCR en PDFs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Importaciones dinámicas
let pdfParse: any = null;
let pdfToPicFromPath: any = null;
let createWorker: any = null;

async function ensureDependencies() {
  if (!pdfParse) {
    const pdfParseModule = await import('pdf-parse');
    pdfParse = pdfParseModule.default;
  }
  
  if (!pdfToPicFromPath) {
    const { fromPath } = await import('pdf2pic');
    pdfToPicFromPath = fromPath;
  }
  
  if (!createWorker) {
    const tesseractModule = await import('tesseract.js');
    createWorker = tesseractModule.createWorker;
  }
}

export const ocrPdfTool = {
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

  execute: async (args: { 
    filePath: string; 
    language?: string; 
    pages?: number[]; 
    quality?: number;
    _options?: { cwd?: string };
  }) => {
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
          let pagesToProcess: number[] = [];
          
          if (pages && pages.length > 0) {
            pagesToProcess = pages;
          } else {
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
            } catch (pageError) {
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

        } finally {
          // Limpiar directorio temporal
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        }

      } catch (ocrError) {
        // Limpiar directorio temporal en caso de error
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        throw ocrError;
      }

    } catch (error) {
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