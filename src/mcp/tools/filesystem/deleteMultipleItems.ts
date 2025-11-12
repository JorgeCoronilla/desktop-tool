/**
 * Herramienta para eliminar múltiples elementos
 */

import * as fs from 'fs';

export const deleteMultipleItemsTool = {
  name: 'delete_multiple_items',
  description: 'Elimina múltiples archivos o directorios de una vez',
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array de rutas de archivos o directorios a eliminar',
      },
    },
    required: ['paths'],
  },

  execute: async (args: { paths: string[] }) => {
    try {
      const results = [];
      
      for (const path of args.paths) {
        try {
          await fs.promises.rm(path, { recursive: true, force: true });
          results.push({
            path: path,
            success: true,
            message: 'Elemento eliminado exitosamente'
          });
        } catch (error) {
          results.push({
            path: path,
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            results: results,
            summary: {
              total: args.paths.length,
              successful: successful,
              failed: failed
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
            error: error instanceof Error ? error.message : 'Error desconocido al eliminar múltiples elementos'
          }, null, 2)
        }]
      };
    }
  }
};