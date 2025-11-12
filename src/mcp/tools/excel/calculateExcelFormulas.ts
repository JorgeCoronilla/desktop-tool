/**
 * Herramienta para calcular fórmulas en Excel
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

export const calculateExcelFormulasTool = {
  name: 'calculate_excel_formulas',
  description: 'Calcula todas las fórmulas en un archivo Excel',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Ruta del archivo Excel a procesar'
      },
      sheetName: {
        type: 'string',
        description: 'Nombre de la hoja a procesar (opcional, por defecto todas)'
      }
    },
    required: ['filePath']
  },

  execute: async (args: any) => {
    try {
      const { filePath, sheetName } = args;
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`El archivo no existe: ${filePath}`);
      }

      // Leer el archivo con opciones para calcular fórmulas
      const workbook = XLSX.readFile(filePath, { 
        cellFormula: true, 
        cellText: true,
        cellNF: false 
      });
      
      const sheetsToProcess = sheetName ? [sheetName] : workbook.SheetNames;
      
      const results: any = {};
      
      for (const sheet of sheetsToProcess) {
        if (!workbook.SheetNames.includes(sheet)) {
          results[sheet] = { error: `La hoja '${sheet}' no existe` };
          continue;
        }

        const worksheet = workbook.Sheets[sheet];
        const formulas: any = {};
        
        // Encontrar y calcular fórmulas
        Object.keys(worksheet).forEach(cell => {
          if (worksheet[cell].f) {
            formulas[cell] = {
              formula: worksheet[cell].f,
              calculatedValue: worksheet[cell].v,
              originalValue: worksheet[cell].w || worksheet[cell].v
            };
          }
        });
        
        results[sheet] = {
          totalFormulas: Object.keys(formulas).length,
          formulas: formulas
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            filePath: filePath,
            sheetsProcessed: sheetsToProcess,
            results: results,
            totalSheets: Object.keys(results).length
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al calcular fórmulas'
          }, null, 2)
        }]
      };
    }
  }
};