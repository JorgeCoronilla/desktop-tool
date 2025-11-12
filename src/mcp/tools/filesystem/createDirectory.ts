/**
 * Herramienta para crear directorios
 */

import * as fs from 'fs';
import * as path from 'path';

export const createDirectoryTool = {
  name: 'create_directory',
  description: 'Crea un directorio',
  inputSchema: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: 'Ruta del directorio a crear',
      },
    },
    required: ['dirPath'],
  },

  execute: async (args: { dirPath: string; _options?: { cwd?: string } }) => {
    try {
      let finalPath = args.dirPath;

      // Si se proporciona un directorio actual y la ruta no es absoluta, usar el directorio actual
      if (args._options?.cwd && !path.isAbsolute(args.dirPath)) {
        finalPath = path.join(args._options.cwd, args.dirPath);
      }

      await fs.promises.mkdir(finalPath, { recursive: true });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            dirPath: finalPath,
            message: `Directorio creado exitosamente: ${finalPath}`
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al crear directorio'
          }, null, 2)
        }]
      };
    }
  }
};