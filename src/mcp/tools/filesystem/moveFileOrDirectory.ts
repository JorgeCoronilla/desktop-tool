/**
 * Herramienta para mover archivos o directorios
 */

import * as fs from 'fs';

export const moveFileOrDirectoryTool = {
  name: 'move_file_or_directory',
  description: 'Mueve un archivo o directorio',
  inputSchema: {
    type: 'object',
    properties: {
      sourcePath: { type: 'string', description: 'Ruta de origen' },
      destPath: { type: 'string', description: 'Ruta de destino' },
    },
    required: ['sourcePath', 'destPath'],
  },

  execute: async (args: { sourcePath: string; destPath: string }) => {
    try {
      await fs.promises.rename(args.sourcePath, args.destPath);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            sourcePath: args.sourcePath,
            destPath: args.destPath,
            message: `Archivo o directorio movido exitosamente de ${args.sourcePath} a ${args.destPath}`
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al mover archivo o directorio'
          }, null, 2)
        }]
      };
    }
  }
};