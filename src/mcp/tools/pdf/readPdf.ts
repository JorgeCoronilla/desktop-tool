/**
 * Herramienta para leer PDFs (versión legacy)
 */

import * as fs from 'fs';

// Importación dinámica para pdf-parse
let pdfParse: any = null;

async function ensurePdfParse() {
  if (!pdfParse) {
    const pdfParseModule = await import('pdf-parse');
    pdfParse = pdfParseModule.default;
  }
  return pdfParse;
}

export const readPdfTool = {
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

  execute: async (args: { filePath: string; _options?: { cwd?: string } }) => {
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

    } catch (error) {
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