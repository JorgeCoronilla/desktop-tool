/**
 * Herramienta para añadir fórmulas a Excel
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

export const addExcelFormulasTool = {
  name: 'add_excel_formulas',
  description: 'Añade fórmulas a celdas específicas en un archivo Excel',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Ruta del archivo Excel a modificar'
      },
      formulas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            cell: { type: 'string', description: 'Celda en notación A1 (ej: A1, B2)' },
            formula: { type: 'string', description: 'Fórmula a aplicar (ej: =SUM(A1:A10))' }
          },
          required: ['cell', 'formula']
        }
      },
      sheetName: {
        type: 'string',
        description: 'Nombre de la hoja a modificar (opcional, por defecto la primera)'
      }
    },
    required: ['filePath', 'formulas']
  },

  execute: async (args: any) => {
    try {
      const { filePath, formulas, sheetName } = args;
      
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
      
      // Aplicar fórmulas
      let formulasAdded = 0;
      
      for (const formulaConfig of formulas) {
        const { cell, formula } = formulaConfig;
        
        // Validar la celda
        if (!cell.match(/^[A-Z]+[0-9]+$/)) {
          throw new Error(`Formato de celda inválido: ${cell}`);
        }
        
        // Aplicar la fórmula
        worksheet[cell] = {
          f: formula,  // La fórmula
          t: 'n'       // Tipo numérico (se calculará automáticamente)
        };
        
        formulasAdded++;
      }

      // Guardar los cambios
      XLSX.writeFile(workbook, filePath);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Fórmulas añadidas exitosamente`,
            sheetName: targetSheetName,
            formulasAdded: formulasAdded,
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
            error: error instanceof Error ? error.message : 'Error desconocido al añadir fórmulas'
          }, null, 2)
        }]
      };
    }
  }
};