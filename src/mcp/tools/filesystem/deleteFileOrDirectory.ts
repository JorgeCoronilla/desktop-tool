/**
 * Herramienta para eliminar archivos o directorios
 */

import * as fs from 'fs';
import * as path from 'path';

export const deleteFileOrDirectoryTool = {
  name: 'delete_file_or_directory',
  description: 'Elimina un archivo o directorio',
  inputSchema: {
    type: 'object',
    properties: {
      targetPath: {
        type: 'string',
        description: 'Ruta del archivo o directorio a eliminar',
      },
    },
    required: ['targetPath'],
  },

  execute: async (args: { targetPath: string; _options?: { cwd?: string } }) => {
    try {
      let finalPath = args.targetPath;

      // Si se proporciona un directorio actual y la ruta no es absoluta, usar el directorio actual
      if (args._options?.cwd && !path.isAbsolute(args.targetPath)) {
        finalPath = path.join(args._options.cwd, args.targetPath);
      }

      await fs.promises.rm(finalPath, { recursive: true, force: true });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            targetPath: finalPath,
            message: `Archivo o directorio eliminado exitosamente: ${finalPath}`
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al eliminar archivo o directorio'
          }, null, 2)
        }]
      };
    }
  }
};