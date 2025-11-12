/**
 * Herramienta para escribir/crear archivos Excel
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface WriteExcelArgs {
  filePath: string;
  data: any[];
  sheetName?: string;
  headers?: string[];
}

export const writeExcelTool = {
  name: 'write_excel',
  description: 'Crea o sobrescribe archivos Excel con datos JSON',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Ruta donde se guardará el archivo Excel'
      },
      data: {
        type: 'array',
        description: 'Datos a escribir en formato array de objetos o arrays'
      },
      sheetName: {
        type: 'string',
        description: 'Nombre de la hoja (opcional, por defecto "Sheet1")'
      },
      headers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Encabezados opcionales para las columnas'
      }
    },
    required: ['filePath', 'data']
  },

  execute: async (args: WriteExcelArgs) => {
    try {
      const { filePath, data, sheetName = 'Sheet1', headers } = args;
      
      // Validar datos
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Los datos deben ser un array no vacío');
      }

      // Crear el libro de trabajo
      const workbook = XLSX.utils.book_new();
      
      // Convertir datos a hoja de cálculo
      let worksheet: XLSX.WorkSheet;
      
      if (headers && Array.isArray(headers)) {
        // Si hay headers explícitos, usarlos
        worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
      } else if (Array.isArray(data[0])) {
        // Si los datos son arrays (formato tabla)
        worksheet = XLSX.utils.aoa_to_sheet(data);
      } else {
        // Si los datos son objetos (formato JSON)
        worksheet = XLSX.utils.json_to_sheet(data);
      }

      // Añadir la hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      
      // Crear directorio si no existe
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Escribir el archivo
      XLSX.writeFile(workbook, filePath);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Archivo Excel creado exitosamente: ${filePath}`,
            sheetName: sheetName,
            totalRows: data.length
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al escribir el archivo'
          }, null, 2)
        }]
      };
    }
  }
};