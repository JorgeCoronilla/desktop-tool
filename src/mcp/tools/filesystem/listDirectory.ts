/**
 * Herramienta para listar directorios
 */

import * as fs from 'fs';
import * as path from 'path';

export const listDirectoryTool = {
  name: 'list_directory',
  description: 'Lista el contenido de un directorio',
  inputSchema: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: 'Ruta del directorio a listar',
      },
    },
    required: ['dirPath'],
  },

  execute: async (args: { dirPath: string }) => {
    try {
      const items = await fs.promises.readdir(args.dirPath, {
        withFileTypes: true,
      });
      
      const files = items.map(item => ({
        name: item.name,
        isDirectory: item.isDirectory(),
        path: path.join(args.dirPath, item.name),
      }));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            dirPath: args.dirPath,
            files: files,
            totalItems: files.length,
            directories: files.filter(f => f.isDirectory).length,
            filesCount: files.filter(f => !f.isDirectory).length
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al listar directorio'
          }, null, 2)
        }]
      };
    }
  }
};