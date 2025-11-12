/**
 * Índice central de todas las herramientas del MCP
 * Exporta todas las herramientas organizadas por categorías
 */

// Herramientas de Excel
export { readExcelTool } from './excel/readExcel';
export { writeExcelTool } from './excel/writeExcel';
export { modifyExcelTool } from './excel/modifyExcel';
export { styleExcelCellsTool } from './excel/styleExcelCells';
export { readExcelWithFormulasTool } from './excel/readExcelWithFormulas';
export { addExcelFormulasTool } from './excel/addExcelFormulas';
export { calculateExcelFormulasTool } from './excel/calculateExcelFormulas';
export { getExcelFormulasInfoTool } from './excel/getExcelFormulasInfo';

// Herramientas del sistema de archivos
export { createDirectoryTool } from './filesystem/createDirectory';
export { deleteFileOrDirectoryTool } from './filesystem/deleteFileOrDirectory';
export { listDirectoryTool } from './filesystem/listDirectory';
export { copyFileOrDirectoryTool } from './filesystem/copyFileOrDirectory';
export { moveFileOrDirectoryTool } from './filesystem/moveFileOrDirectory';
export { listFilesByCriteriaTool } from './filesystem/listFilesByCriteria';
export { deleteMultipleItemsTool } from './filesystem/deleteMultipleItems';

// Herramientas de PDF
export { pdfTools } from './pdf';

// Herramientas web
export { webTools } from './web';

// Herramientas de desarrollo
export { developmentTools } from './development';

// Herramientas web
export { webSearchTool } from './web/webSearch';
export { webScrapeTool } from './web/webScrape';
export { webTools } from './web';

// Función auxiliar para obtener todas las herramientas
export function getAllTools() {
  return [
    // Excel
    readExcelTool,
    writeExcelTool,
    modifyExcelTool,
    styleExcelCellsTool,
    readExcelWithFormulasTool,
    addExcelFormulasTool,
    calculateExcelFormulasTool,
    getExcelFormulasInfoTool,
    
    // Filesystem
    createDirectoryTool,
    deleteFileOrDirectoryTool,
    listDirectoryTool,
    copyFileOrDirectoryTool,
    moveFileOrDirectoryTool,
    listFilesByCriteriaTool,
    deleteMultipleItemsTool,
    
    // PDF
    pdfTools,
    
    // Web
    webSearchTool,
    webScrapeTool,
    webTools,
    
    // Development
    ...developmentTools,
  ];
}