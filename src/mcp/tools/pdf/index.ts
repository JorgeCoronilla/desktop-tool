// Exportar todas las herramientas de PDF
export { readPdfSmartTool } from './readPdfSmart';
export { readPdfTool } from './readPdf';
export { readPdfChunkTool } from './readPdfChunk';
export { ocrPdfTool } from './ocrPdf';

// Array para importar todas las herramientas de PDF fácilmente
export const pdfTools = [
  readPdfSmartTool,
  readPdfTool,
  readPdfChunkTool,
  ocrPdfTool,
];