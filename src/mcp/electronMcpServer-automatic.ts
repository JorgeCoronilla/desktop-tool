import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { fromPath as pdfToPicFromPath } from 'pdf2pic';
import xlsxCalc from 'xlsx-calc';

// Importar el registro de herramientas
import { ToolRegistry } from './tools/toolRegistry';

// Variables globales para lazy loading
let pdfParse: any = null;

async function initializePdfParse() {
  if (!pdfParse) {
    const pdfParseModule = await import('pdf-parse');
    pdfParse = (pdfParseModule as any).default || pdfParseModule;
  }
  return pdfParse;
}

async function initializeTesseract() {
  const tesseractModule = await import('tesseract.js');
  return tesseractModule.createWorker;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResponse {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Servidor MCP integrado para Electron con registro automático de herramientas
 * Ejecuta herramientas directamente sin transporte de red
 */
export class ElectronMCPServer {
  private toolRegistry: ToolRegistry;

  constructor() {
    this.toolRegistry = new ToolRegistry();
    this.initializeAutomaticToolRegistration();
  }

  private async initializeAutomaticToolRegistration() {
    try {
      // Registrar todas las herramientas automáticamente
      await this.toolRegistry.registerAllTools();
      
      // Registrar handlers para las herramientas existentes
      this.registerExistingToolHandlers();
      
      console.log(`✅ Registradas ${this.toolRegistry.getAllTools().length} herramientas automáticamente`);
    } catch (error) {
      console.error('❌ Error al registrar herramientas automáticamente:', error);
      // Fallback al sistema manual
      this.setupManualTools();
    }
  }

  private registerExistingToolHandlers() {
    // Herramientas de archivos
    this.toolRegistry.registerHandler('read_text_file', this.readTextFile.bind(this));
    this.toolRegistry.registerHandler('write_text_file', this.writeTextFile.bind(this));
    this.toolRegistry.registerHandler('create_directory', this.createDirectory.bind(this));
    this.toolRegistry.registerHandler('delete_file_or_directory', this.deleteFileOrDirectory.bind(this));
    this.toolRegistry.registerHandler('list_directory', this.listDirectory.bind(this));
    this.toolRegistry.registerHandler('copy_file_or_directory', this.copyFileOrDirectory.bind(this));
    this.toolRegistry.registerHandler('move_file_or_directory', this.moveFileOrDirectory.bind(this));
    this.toolRegistry.registerHandler('list_files_by_criteria', this.listFilesByCriteria.bind(this));
    this.toolRegistry.registerHandler('delete_multiple_items', this.deleteMultipleItems.bind(this));

    // Herramientas de PDF
    this.toolRegistry.registerHandler('read_pdf', this.readPdf.bind(this));
    this.toolRegistry.registerHandler('read_pdf_chunk', this.readPdfChunk.bind(this));
    this.toolRegistry.registerHandler('ocr_pdf', this.ocrPdf.bind(this));
    this.toolRegistry.registerHandler('read_pdf_smart', this.readPdfSmart.bind(this));

    // Herramientas de Excel
    this.toolRegistry.registerHandler('read_excel', this.readExcel.bind(this));
    this.toolRegistry.registerHandler('write_excel', this.writeExcel.bind(this));
    this.toolRegistry.registerHandler('modify_excel', this.modifyExcel.bind(this));
    this.toolRegistry.registerHandler('style_excel_cells', this.styleExcelCells.bind(this));

    // Herramientas de Excel con fórmulas
    this.toolRegistry.registerHandler('read_excel_with_formulas', this.readExcelWithFormulas.bind(this));
    this.toolRegistry.registerHandler('add_excel_formulas', this.addExcelFormulas.bind(this));
    this.toolRegistry.registerHandler('calculate_excel_formulas', this.calculateExcelFormulas.bind(this));
    this.toolRegistry.registerHandler('get_excel_formulas_info', this.getExcelFormulasInfo.bind(this));
  }

  private setupManualTools() {
    // Fallback al sistema manual si el automático falla
    console.log('🔄 Usando sistema de registro manual como fallback');
    
    // Aquí irían las herramientas manuales como backup
    // Por ahora, solo registramos las básicas
    const basicTools = [
      'read_text_file',
      'write_text_file', 
      'create_directory',
      'list_directory'
    ];
    
    basicTools.forEach(toolName => {
      this.toolRegistry.registerHandler(toolName, async (args) => {
        return { success: false, error: `Herramienta ${toolName} no implementada en fallback` };
      });
    });
  }

  /**
   * Ejecuta una herramienta directamente usando el registro
   */
  async executeTool(
    toolCall: MCPToolCall,
    options?: { cwd?: string }
  ): Promise<MCPToolResponse> {
    try {
      const result = await this.toolRegistry.executeTool(toolCall.name, {
        ...toolCall.arguments,
        _options: options,
      });
      
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Obtiene la lista de herramientas disponibles
   */
  getAvailableTools() {
    return this.toolRegistry.getAllTools();
  }

  /**
   * Obtiene las funciones de OpenAI
   */
  getOpenAIFunctions() {
    return this.toolRegistry.getOpenAIFunctions();
  }

  // ===== IMPLEMENTACIONES DE HERRAMIENTAS EXISTENTES =====
  
  private async readTextFile(args: any): Promise<any> {
    const { filePath } = args;
    const content = fs.readFileSync(filePath, 'utf8');
    return { content, filePath };
  }

  private async writeTextFile(args: any): Promise<any> {
    const { filePath, content } = args;
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true, filePath };
  }

  private async createDirectory(args: any): Promise<any> {
    const { dirPath } = args;
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true, dirPath };
  }

  private async deleteFileOrDirectory(args: any): Promise<any> {
    const { path: itemPath } = args;
    fs.rmSync(itemPath, { recursive: true, force: true });
    return { success: true, path: itemPath };
  }

  private async listDirectory(args: any): Promise<any> {
    const { dirPath } = args;
    const items = fs.readdirSync(dirPath);
    const result = items.map(item => {
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);
      return {
        name: item,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime
      };
    });
    return { items: result, dirPath };
  }

  private async copyFileOrDirectory(args: any): Promise<any> {
    const { sourcePath, destPath } = args;
    const stats = fs.statSync(sourcePath);
    if (stats.isDirectory()) {
      fs.cpSync(sourcePath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
    return { success: true, sourcePath, destPath };
  }

  private async moveFileOrDirectory(args: any): Promise<any> {
    const { sourcePath, destPath } = args;
    fs.renameSync(sourcePath, destPath);
    return { success: true, sourcePath, destPath };
  }

  private async listFilesByCriteria(args: any): Promise<any> {
    const { dirPath, extension, minSize, maxSize, modifiedAfter } = args;
    const items = fs.readdirSync(dirPath, { recursive: true });
    const filtered = items.filter(item => {
      const itemPath = item.toString();
      const fullPath = path.join(dirPath, itemPath);
      const stats = fs.statSync(fullPath);
      
      if (extension && !itemPath.endsWith(extension)) return false;
      if (minSize && stats.size < minSize) return false;
      if (maxSize && stats.size > maxSize) return false;
      if (modifiedAfter && stats.mtime < new Date(modifiedAfter)) return false;
      
      return true;
    });
    
    return { files: filtered, count: filtered.length };
  }

  private async deleteMultipleItems(args: any): Promise<any> {
    const { paths } = args;
    const results = paths.map((itemPath: string) => {
      try {
        fs.rmSync(itemPath, { recursive: true, force: true });
        return { path: itemPath, success: true };
      } catch (error) {
        return { path: itemPath, success: false, error: error.message };
      }
    });
    
    return { results, deleted: results.filter(r => r.success).length };
  }

  // Herramientas de PDF
  private async readPdf(args: any): Promise<any> {
    const { filePath } = args;
    const pdfParse = await initializePdfParse();
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  }

  private async readPdfChunk(args: any): Promise<any> {
    const { filePath, startPage, endPage } = args;
    const pdfParse = await initializePdfParse();
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    // Extraer páginas específicas (implementación simplificada)
    const pages = data.text.split('\n\n');
    const chunkPages = pages.slice(startPage - 1, endPage);
    
    return {
      text: chunkPages.join('\n\n'),
      pages: chunkPages.length,
      startPage,
      endPage
    };
  }

  private async ocrPdf(args: any): Promise<any> {
    const { filePath, language = 'eng' } = args;
    
    // Convertir PDF a imágenes
    const options = {
      density: 100,
      saveFilename: 'temp',
      savePath: '/tmp',
      format: 'png',
      width: 1024,
      height: 768
    };
    
    const convert = pdfToPicFromPath(filePath, options);
    const images = await convert.bulk(-1); // Convertir todas las páginas
    
    // Procesar con OCR
    const createWorker = await initializeTesseract();
    const worker = await createWorker(language);
    
    const results = [];
    for (const image of images) {
      const { data: { text } } = await worker.recognize(image.path);
      results.push({
        page: image.page,
        text: text
      });
    }
    
    await worker.terminate();
    
    return {
      pages: results,
      totalPages: results.length
    };
  }

  private async readPdfSmart(args: any): Promise<any> {
    const { filePath } = args;
    
    try {
      // Intentar primero con pdf-parse
      const pdfParse = await initializePdfParse();
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      
      if (data.text.trim().length > 0) {
        return {
          method: 'pdf-parse',
          text: data.text,
          pages: data.numpages
        };
      }
    } catch (error) {
      console.log('pdf-parse falló, intentando OCR...');
    }
    
    // Si no hay texto, usar OCR
    const ocrResult = await this.ocrPdf({ filePath });
    return {
      method: 'ocr',
      pages: ocrResult.pages,
      text: ocrResult.pages.map((p: any) => p.text).join('\n\n')
    };
  }

  // Herramientas de Excel
  private async readExcel(args: any): Promise<any> {
    const { filePath, sheetName } = args;
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new Error(`Hoja ${sheetName || 'por defecto'} no encontrada`);
    }
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    return {
      data,
      sheetName: sheetName || workbook.SheetNames[0],
      totalRows: data.length,
      totalCols: data.length > 0 ? data[0].length : 0
    };
  }

  private async writeExcel(args: any): Promise<any> {
    const { filePath, data, headers, sheetName = 'Sheet1' } = args;
    
    let worksheet;
    if (headers) {
      worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    } else {
      worksheet = XLSX.utils.aoa_to_sheet(data);
    }
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filePath);
    
    return {
      success: true,
      filePath,
      sheetName,
      totalRows: data.length + (headers ? 1 : 0)
    };
  }

  private async modifyExcel(args: any): Promise<any> {
    const { filePath, modifications, sheetName } = args;
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new Error(`Hoja ${sheetName || 'por defecto'} no encontrada`);
    }
    
    // Aplicar modificaciones
    modifications.forEach((mod: any) => {
      const cellRef = XLSX.utils.encode_cell({ r: mod.row, c: mod.col });
      sheet[cellRef] = { v: mod.value };
    });
    
    XLSX.writeFile(workbook, filePath);
    
    return {
      success: true,
      filePath,
      modifications: modifications.length
    };
  }

  private async styleExcelCells(args: any): Promise<any> {
    const { filePath, styles, sheetName } = args;
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new Error(`Hoja ${sheetName || 'por defecto'} no encontrada`);
    }
    
    // Aplicar estilos (implementación simplificada)
    styles.forEach((style: any) => {
      const cellRef = XLSX.utils.encode_cell({ r: style.row, c: style.col });
      if (!sheet[cellRef]) sheet[cellRef] = {};
      sheet[cellRef].s = style.style;
    });
    
    XLSX.writeFile(workbook, filePath);
    
    return {
      success: true,
      filePath,
      stylesApplied: styles.length
    };
  }

  // Herramientas de Excel con fórmulas
  private async readExcelWithFormulas(args: any): Promise<any> {
    const { filePath, sheetName } = args;
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new Error(`Hoja ${sheetName || 'por defecto'} no encontrada`);
    }
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const formulas = [];
    
    // Extraer fórmulas
    Object.keys(sheet).forEach(cell => {
      if (sheet[cell].f) {
        const { r, c } = XLSX.utils.decode_cell(cell);
        formulas.push({
          cell: cell,
          row: r,
          col: c,
          formula: sheet[cell].f,
          value: sheet[cell].v
        });
      }
    });
    
    return {
      data,
      formulas,
      sheetName: sheetName || workbook.SheetNames[0]
    };
  }

  private async addExcelFormulas(args: any): Promise<any> {
    const { filePath, formulas, sheetName } = args;
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new Error(`Hoja ${sheetName || 'por defecto'} no encontrada`);
    }
    
    // Agregar fórmulas
    formulas.forEach((formula: any) => {
      const cellRef = XLSX.utils.encode_cell({ r: formula.row, c: formula.col });
      sheet[cellRef] = { f: formula.formula };
    });
    
    // Calcular fórmulas
    const calculatedSheet = xlsxCalc(workbook.Sheets[sheetName || workbook.SheetNames[0]]);
    
    XLSX.writeFile(workbook, filePath);
    
    return {
      success: true,
      filePath,
      formulasAdded: formulas.length
    };
  }

  private async calculateExcelFormulas(args: any): Promise<any> {
    const { filePath, sheetName } = args;
    const workbook = XLSX.readFile(filePath);
    const sheetNameToUse = sheetName || workbook.SheetNames[0];
    
    if (!workbook.Sheets[sheetNameToUse]) {
      throw new Error(`Hoja ${sheetNameToUse} no encontrada`);
    }
    
    // Calcular fórmulas
    const calculatedSheet = xlsxCalc(workbook.Sheets[sheetNameToUse]);
    
    // Guardar resultado
    XLSX.writeFile(workbook, filePath);
    
    return {
      success: true,
      filePath,
      sheetName: sheetNameToUse
    };
  }

  private async getExcelFormulasInfo(args: any): Promise<any> {
    const { filePath, sheetName } = args;
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new Error(`Hoja ${sheetName || 'por defecto'} no encontrada`);
    }
    
    const formulas = [];
    const functions = new Set();
    
    Object.keys(sheet).forEach(cell => {
      if (sheet[cell].f) {
        const { r, c } = XLSX.utils.decode_cell(cell);
        formulas.push({
          cell: cell,
          row: r,
          col: c,
          formula: sheet[cell].f,
          value: sheet[cell].v
        });
        
        // Extraer funciones de Excel
        const functionMatches = sheet[cell].f.match(/[A-Z]+\(/g);
        if (functionMatches) {
          functionMatches.forEach(func => functions.add(func.slice(0, -1)));
        }
      }
    });
    
    return {
      totalFormulas: formulas.length,
      formulas,
      functions: Array.from(functions),
      sheetName: sheetName || workbook.SheetNames[0]
    };
  }
}