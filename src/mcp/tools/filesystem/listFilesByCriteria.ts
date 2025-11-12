/**
 * Herramienta para listar archivos por criterios
 */

import * as fs from 'fs';
import * as path from 'path';

export const listFilesByCriteriaTool = {
  name: 'list_files_by_criteria',
  description: 'Lista archivos que coinciden con criterios específicos',
  inputSchema: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: 'Directorio base para buscar',
      },
      extension: {
        type: 'string',
        description: 'Extensión de archivo (opcional)',
      },
      namePattern: {
        type: 'string',
        description: 'Patrón en el nombre (opcional)',
      },
      recursive: {
        type: 'boolean',
        description: 'Búsqueda recursiva (opcional)',
      },
    },
    required: ['dirPath'],
  },

  execute: async (args: {
    dirPath: string;
    extension?: string;
    namePattern?: string;
    recursive?: boolean;
  }) => {
    try {
      const files: string[] = [];

      const searchDir = async (dir: string) => {
        const items = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);

          if (item.isDirectory() && args.recursive) {
            await searchDir(fullPath);
          } else if (item.isFile()) {
            let matches = true;

            if (args.extension && !item.name.endsWith(args.extension)) {
              matches = false;
            }

            if (args.namePattern && !item.name.includes(args.namePattern)) {
              matches = false;
            }

            if (matches) {
              files.push(fullPath);
            }
          }
        }
      };

      await searchDir(args.dirPath);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            dirPath: args.dirPath,
            files: files,
            totalFiles: files.length,
            criteria: {
              extension: args.extension,
              namePattern: args.namePattern,
              recursive: args.recursive
            }
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al listar archivos por criterios'
          }, null, 2)
        }]
      };
    }
  }
};