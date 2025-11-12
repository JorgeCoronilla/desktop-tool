/**
 * Herramientas MCP que están funcionando correctamente
 * Versión simplificada mientras se arreglan las demás
 */

// Herramientas de Excel (funcionando)
export { readExcelTool } from './excel/readExcel';
export { writeExcelTool } from './excel/writeExcel';
export { modifyExcelTool } from './excel/modifyExcel';
export { styleExcelCellsTool } from './excel/styleExcelCells';
export { readExcelWithFormulasTool } from './excel/readExcelWithFormulas';
export { addExcelFormulasTool } from './excel/addExcelFormulas';
export { calculateExcelFormulasTool } from './excel/calculateExcelFormulas';

// Herramientas de desarrollo (funcionando)
export { executeCommandTool } from './development/executeCommand';
export { runScriptTool } from './development/runScript';
export { gitOperationsTool } from './development/gitOperations';
export { npmOperationsTool } from './development/npmOperations';

// Importar las herramientas de desarrollo como array
import { executeCommandTool } from './development/executeCommand';
import { runScriptTool } from './development/runScript';
import { gitOperationsTool } from './development/gitOperations';
import { npmOperationsTool } from './development/npmOperations';

export const developmentTools = [
  executeCommandTool,
  runScriptTool,
  gitOperationsTool,
  npmOperationsTool
];

// Función para obtener solo las herramientas que funcionan
export function getWorkingTools() {
  return [
    // Excel
    readExcelTool,
    writeExcelTool,
    modifyExcelTool,
    styleExcelCellsTool,
    readExcelWithFormulasTool,
    addExcelFormulasTool,
    calculateExcelFormulasTool,
    
    // Development
    ...developmentTools,
  ];
}