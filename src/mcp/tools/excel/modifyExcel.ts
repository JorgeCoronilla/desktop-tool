/**
 * Herramienta para modificar archivos Excel existentes
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface ModifyExcelArgs {
  filePath: string;
  modifications: {
    addRows?: Array<{ rowData: any[]; insertAt?: number }>;
    updateRows?: Array<{ rowIndex: number; rowData: any[] }>;
    deleteRows?: Array<{ startRow: number; count: number }>;
  };
  sheetName?: string;
}

export const modifyExcelTool = {
  name: 'modify_excel',
  description: 'Modifica archivos Excel existentes añadiendo, actualizando o eliminando filas',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Ruta del archivo Excel a modificar'
      },
      modifications: {
        type: 'object',
        properties: {
          addRows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rowData: { type: 'array', description: 'Datos de la fila a añadir' },
                insertAt: { type: 'number', description: 'Índice donde insertar (opcional)' }
              },
              required: ['rowData']
            },
            description: 'Filas a añadir'
          },
          updateRows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rowIndex: { type: 'number', description: 'Índice de la fila a actualizar' },
                rowData: { type: 'array', description: 'Nuevos datos de la fila' }
              },
              required: ['rowIndex', 'rowData']
            },
            description: 'Filas a actualizar'
          },
          deleteRows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                startRow: { type: 'number', description: 'Índice inicial de la fila' },
                count: { type: 'number', description: 'Número de filas a eliminar' }
              },
              required: ['startRow', 'count']
            },
            description: 'Filas a eliminar'
          }
        }
      },
      sheetName: {
        type: 'string',
        description: 'Nombre de la hoja a modificar (opcional, por defecto la primera)'
      }
    },
    required: ['filePath', 'modifications']
  },

  execute: async (args: ModifyExcelArgs) => {
    try {
      const { filePath, modifications, sheetName } = args;
      
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
      
      // Convertir la hoja a array de arrays para facilitar la modificación
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
      
      let modifiedData = [...data];
      let changesMade = 0;

      // Procesar adiciones
      if (modifications.addRows && modifications.addRows.length > 0) {
        for (const addRow of modifications.addRows) {
          const { rowData, insertAt } = addRow;
          
          if (insertAt !== undefined && insertAt >= 0 && insertAt <= modifiedData.length) {
            modifiedData.splice(insertAt, 0, rowData);
          } else {
            modifiedData.push(rowData);
          }
          changesMade++;
        }
      }

      // Procesar actualizaciones
      if (modifications.updateRows && modifications.updateRows.length > 0) {
        for (const updateRow of modifications.updateRows) {
          const { rowIndex, rowData } = updateRow;
          
          if (rowIndex >= 0 && rowIndex < modifiedData.length) {
            modifiedData[rowIndex] = rowData;
            changesMade++;
          } else {
            throw new Error(`Índice de fila inválido: ${rowIndex}`);
          }
        }
      }

      // Procesar eliminaciones
      if (modifications.deleteRows && modifications.deleteRows.length > 0) {
        // Ordenar por startRow descendente para evitar problemas de índices
        const sortedDeletes = [...modifications.deleteRows].sort((a, b) => b.startRow - a.startRow);
        
        for (const deleteRow of sortedDeletes) {
          const { startRow, count } = deleteRow;
          
          if (startRow >= 0 && startRow < modifiedData.length) {
            const endRow = Math.min(startRow + count, modifiedData.length);
            modifiedData.splice(startRow, endRow - startRow);
            changesMade++;
          } else {
            throw new Error(`Índice de fila inválido para eliminación: ${startRow}`);
          }
        }
      }

      if (changesMade === 0) {
        throw new Error('No se especificaron modificaciones válidas');
      }

      // Crear nueva hoja con los datos modificados
      const newWorksheet = XLSX.utils.aoa_to_sheet(modifiedData);
      
      // Reemplazar la hoja en el libro
      const sheetIndex = workbook.SheetNames.indexOf(targetSheetName);
      workbook.Sheets[targetSheetName] = newWorksheet;

      // Guardar los cambios
      XLSX.writeFile(workbook, filePath);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Archivo Excel modificado exitosamente: ${filePath}`,
            sheetName: targetSheetName,
            changesMade: changesMade,
            totalRows: modifiedData.length
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al modificar el archivo'
          }, null, 2)
        }]
      };
    }
  }
};