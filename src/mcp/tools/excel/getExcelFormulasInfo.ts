/**
 * Herramienta para obtener información de fórmulas en Excel
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

export const getExcelFormulasInfoTool = {
  name: 'get_excel_formulas_info',
  description: 'Obtiene información detallada sobre las fórmulas en un archivo Excel',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Ruta del archivo Excel a analizar'
      },
      sheetName: {
        type: 'string',
        description: 'Nombre de la hoja a analizar (opcional, por defecto todas)'
      },
      includeDependencies: {
        type: 'boolean',
        description: 'Incluir dependencias de celdas (por defecto true)'
      }
    },
    required: ['filePath']
  },

  execute: async (args: any) => {
    try {
      const { filePath, sheetName, includeDependencies = true } = args;
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`El archivo no existe: ${filePath}`);
      }

      const workbook = XLSX.readFile(filePath, { 
        cellFormula: true, 
        cellText: true 
      });
      
      const sheetsToAnalyze = sheetName ? [sheetName] : workbook.SheetNames;
      
      const results: any = {};
      
      for (const sheet of sheetsToAnalyze) {
        if (!workbook.SheetNames.includes(sheet)) {
          results[sheet] = { error: `La hoja '${sheet}' no existe` };
          continue;
        }

        const worksheet = workbook.Sheets[sheet];
        const formulas: any[] = [];
        
        // Encontrar todas las fórmulas
        Object.keys(worksheet).forEach(cell => {
          if (worksheet[cell].f) {
            const formulaInfo = {
              cell: cell,
              formula: worksheet[cell].f,
              value: worksheet[cell].v,
              type: worksheet[cell].t
            };
            
            // Analizar dependencias si se solicita
            if (includeDependencies) {
              const formula = worksheet[cell].f;
              const dependencies = extractCellReferences(formula);
              formulaInfo.dependencies = dependencies;
              formulaInfo.dependencyCount = dependencies.length;
            }
            
            formulas.push(formulaInfo);
          }
        });
        
        // Estadísticas
        const stats = {
          totalFormulas: formulas.length,
          uniqueFormulas: new Set(formulas.map(f => f.formula)).size,
          mostCommonFormula: getMostCommonFormula(formulas),
          formulaTypes: getFormulaTypes(formulas),
          cellsWithFormulas: formulas.map(f => f.cell).sort()
        };
        
        results[sheet] = {
          formulas: formulas,
          statistics: stats
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            filePath: filePath,
            sheetsAnalyzed: sheetsToAnalyze,
            results: results,
            summary: {
              totalSheets: Object.keys(results).length,
              totalFormulas: Object.values(results).reduce((sum: number, sheet: any) => sum + sheet.statistics.totalFormulas, 0),
              sheetsWithFormulas: Object.keys(results).filter(sheet => results[sheet].statistics.totalFormulas > 0).length
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
            error: error instanceof Error ? error.message : 'Error desconocido al obtener información de fórmulas'
          }, null, 2)
        }]
      };
    }
  }
};

// Función auxiliar para extraer referencias de celdas de una fórmula
function extractCellReferences(formula: string): string[] {
  const cellPattern = /[A-Z]+[0-9]+/g;
  const matches = formula.match(cellPattern) || [];
  return [...new Set(matches)]; // Eliminar duplicados
}

// Función auxiliar para obtener la fórmula más común
function getMostCommonFormula(formulas: any[]): string | null {
  if (formulas.length === 0) return null;
  
  const formulaCounts = formulas.reduce((acc, f) => {
    acc[f.formula] = (acc[f.formula] || 0) + 1;
    return acc;
  }, {});
  
  return Object.keys(formulaCounts).reduce((a, b) => 
    formulaCounts[a] > formulaCounts[b] ? a : b
  );
}

// Función auxiliar para obtener tipos de fórmulas
function getFormulaTypes(formulas: any[]): Record<string, number> {
  const types: Record<string, number> = {};
  
  formulas.forEach(f => {
    const formula = f.formula.toUpperCase();
    let type = 'OTHER';
    
    if (formula.startsWith('=')) {
      const funcMatch = formula.match(/=([A-Z]+)\(/);
      if (funcMatch) {
        type = funcMatch[1];
      }
    }
    
    types[type] = (types[type] || 0) + 1;
  });
  
  return types;
}