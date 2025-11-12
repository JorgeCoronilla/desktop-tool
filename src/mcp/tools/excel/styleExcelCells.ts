/**
 * Herramienta para aplicar estilos a celdas de Excel
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface StyleRange {
  startCell: string;
  endCell: string;
}

interface CellStyle {
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: { rgb: string };
  };
  fill?: {
    fgColor?: { rgb: string };
    patternType?: string;
  };
  border?: {
    top?: { style: string; color: { rgb: string } };
    bottom?: { style: string; color: { rgb: string } };
    left?: { style: string; color: { rgb: string } };
    right?: { style: string; color: { rgb: string } };
  };
  alignment?: {
    horizontal?: string;
    vertical?: string;
    wrapText?: boolean;
  };
}

interface StyleExcelCellsArgs {
  filePath: string;
  styles: Array<{
    range: string | StyleRange;
    style: CellStyle;
  }>;
  sheetName?: string;
}

export const styleExcelCellsTool = {
  name: 'style_excel_cells',
  description: 'Aplica estilos a celdas específicas de un archivo Excel',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Ruta del archivo Excel a modificar'
      },
      styles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            range: {
              oneOf: [
                { type: 'string', description: 'Rango en notación A1 (ej: A1:C10)' },
                {
                  type: 'object',
                  properties: {
                    startCell: { type: 'string' },
                    endCell: { type: 'string' }
                  },
                  required: ['startCell', 'endCell']
                }
              ]
            },
            style: {
              type: 'object',
              properties: {
                font: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    size: { type: 'number' },
                    bold: { type: 'boolean' },
                    italic: { type: 'boolean' },
                    color: { type: 'object', properties: { rgb: { type: 'string' } } }
                  }
                },
                fill: {
                  type: 'object',
                  properties: {
                    fgColor: { type: 'object', properties: { rgb: { type: 'string' } } },
                    patternType: { type: 'string' }
                  }
                },
                border: {
                  type: 'object',
                  properties: {
                    top: { type: 'object', properties: { style: { type: 'string' }, color: { type: 'object', properties: { rgb: { type: 'string' } } } } },
                    bottom: { type: 'object', properties: { style: { type: 'string' }, color: { type: 'object', properties: { rgb: { type: 'string' } } } } },
                    left: { type: 'object', properties: { style: { type: 'string' }, color: { type: 'object', properties: { rgb: { type: 'string' } } } } },
                    right: { type: 'object', properties: { style: { type: 'string' }, color: { type: 'object', properties: { rgb: { type: 'string' } } } } }
                  }
                },
                alignment: {
                  type: 'object',
                  properties: {
                    horizontal: { type: 'string' },
                    vertical: { type: 'string' },
                    wrapText: { type: 'boolean' }
                  }
                }
              }
            }
          },
          required: ['range', 'style']
        }
      },
      sheetName: {
        type: 'string',
        description: 'Nombre de la hoja a modificar (opcional, por defecto la primera)'
      }
    },
    required: ['filePath', 'styles']
  },

  execute: async (args: StyleExcelCellsArgs) => {
    try {
      const { filePath, styles, sheetName } = args;
      
      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`El archivo no existe: ${filePath}`);
      }

      // Leer el archivo existente
      const workbook = XLSX.readFile(filePath);
      
      // Determinar la hoja a modificar
      const targetSheetName = sheetName || workbook.SheetNames[0];
      
      if (!workbook.SheetNames.includes(targetSheetName)) {
        throw new Error(`La hoja '${targetSheetName}' no existe en el archivo`);
      }

      const worksheet = workbook.Sheets[targetSheetName];
      
      // Aplicar cada estilo
      let stylesApplied = 0;
      
      for (const styleConfig of styles) {
        const { range, style } = styleConfig;
        
        // Convertir rango a notación de celdas
        const rangeStr = typeof range === 'string' ? range : `${range.startCell}:${range.endCell}`;
        
        // Obtener el rango de celdas
        const cellRange = XLSX.utils.decode_range(rangeStr);
        
        // Aplicar estilo a cada celda en el rango
        for (let row = cellRange.s.r; row <= cellRange.e.r; row++) {
          for (let col = cellRange.s.c; col <= cellRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            
            if (!worksheet[cellAddress]) {
              worksheet[cellAddress] = { v: '', t: 's' };
            }
            
            // Aplicar estilos
            if (!worksheet[cellAddress].s) {
              worksheet[cellAddress].s = {};
            }
            
            // Fusionar estilos existentes con nuevos
            worksheet[cellAddress].s = { ...worksheet[cellAddress].s, ...style };
            stylesApplied++;
          }
        }
      }

      // Guardar los cambios
      XLSX.writeFile(workbook, filePath);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Estilos aplicados exitosamente a ${stylesApplied} celdas`,
            sheetName: targetSheetName,
            stylesApplied: stylesApplied,
            filePath: filePath
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al aplicar estilos'
          }, null, 2)
        }]
      };
    }
  }
};