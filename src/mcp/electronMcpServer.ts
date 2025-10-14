import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { fromPath as pdfToPicFromPath } from 'pdf2pic';
import { createWorker } from 'tesseract.js';

// Variables globales para pdf-parse
let PDFParseClass: any = null;

async function initializePdfParse() {
  if (!PDFParseClass) {
    const pdfParseModule = await import('pdf-parse');
    PDFParseClass = (pdfParseModule as any).PDFParse || pdfParseModule.PDFParse;
  }
  return PDFParseClass;
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
 * Servidor MCP integrado para Electron
 * Ejecuta herramientas directamente sin transporte de red
 */
export class ElectronMCPServer {
  private server: Server;
  private tools: Map<string, (args: any) => Promise<any>>;

  constructor() {
    this.server = new Server(
      {
        name: 'desktop-helper-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.tools = new Map();
    this.setupTools();
  }

  private setupTools() {
    // Herramientas de archivos
    this.registerTool('read_text_file', this.readTextFile.bind(this));
    this.registerTool('write_text_file', this.writeTextFile.bind(this));
    this.registerTool('create_directory', this.createDirectory.bind(this));
    this.registerTool('delete_file_or_directory', this.deleteFileOrDirectory.bind(this));
    this.registerTool('list_directory', this.listDirectory.bind(this));
    this.registerTool('copy_file_or_directory', this.copyFileOrDirectory.bind(this));
    this.registerTool('move_file_or_directory', this.moveFileOrDirectory.bind(this));
    this.registerTool('list_files_by_criteria', this.listFilesByCriteria.bind(this));
    this.registerTool('delete_multiple_items', this.deleteMultipleItems.bind(this));

    // Herramientas de PDF
    this.registerTool('read_pdf', this.readPdf.bind(this));
    this.registerTool('read_pdf_chunk', this.readPdfChunk.bind(this));
    this.registerTool('ocr_pdf', this.ocrPdf.bind(this));

    // Herramientas de Excel
    this.registerTool('read_excel', this.readExcel.bind(this));
    this.registerTool('write_excel', this.writeExcel.bind(this));
    this.registerTool('modify_excel', this.modifyExcel.bind(this));
  }

  private registerTool(name: string, handler: (args: any) => Promise<any>) {
    this.tools.set(name, handler);
  }

  /**
   * Ejecuta una herramienta directamente
   */
  async executeTool(toolCall: MCPToolCall, options?: { cwd?: string }): Promise<MCPToolResponse> {
    try {
      const handler = this.tools.get(toolCall.name);
      if (!handler) {
        return {
          success: false,
          error: `Herramienta '${toolCall.name}' no encontrada`
        };
      }

      // Pasar las opciones (incluyendo cwd) a los argumentos de la herramienta
      const argsWithOptions = {
        ...toolCall.arguments,
        _options: options
      };

      const result = await handler(argsWithOptions);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Obtiene la lista de herramientas disponibles
   */
  getAvailableTools() {
    return [
      {
        name: 'read_text_file',
        description: 'Lee el contenido de un archivo de texto',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo a leer' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'write_text_file',
        description: 'Escribe contenido a un archivo de texto',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo a escribir' },
            content: { type: 'string', description: 'Contenido a escribir' }
          },
          required: ['filePath', 'content']
        }
      },
      {
        name: 'create_directory',
        description: 'Crea un directorio',
        inputSchema: {
          type: 'object',
          properties: {
            dirPath: { type: 'string', description: 'Ruta del directorio a crear' }
          },
          required: ['dirPath']
        }
      },
      {
        name: 'delete_file_or_directory',
        description: 'Elimina un archivo o directorio',
        inputSchema: {
          type: 'object',
          properties: {
            targetPath: { type: 'string', description: 'Ruta del archivo o directorio a eliminar' }
          },
          required: ['targetPath']
        }
      },
      {
        name: 'list_directory',
        description: 'Lista el contenido de un directorio',
        inputSchema: {
          type: 'object',
          properties: {
            dirPath: { type: 'string', description: 'Ruta del directorio a listar' }
          },
          required: ['dirPath']
        }
      },
      {
        name: 'copy_file_or_directory',
        description: 'Copia un archivo o directorio',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePath: { type: 'string', description: 'Ruta de origen' },
            destPath: { type: 'string', description: 'Ruta de destino' }
          },
          required: ['sourcePath', 'destPath']
        }
      },
      {
        name: 'move_file_or_directory',
        description: 'Mueve un archivo o directorio',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePath: { type: 'string', description: 'Ruta de origen' },
            destPath: { type: 'string', description: 'Ruta de destino' }
          },
          required: ['sourcePath', 'destPath']
        }
      },
      {
        name: 'list_files_by_criteria',
        description: 'Lista archivos que coinciden con criterios específicos',
        inputSchema: {
          type: 'object',
          properties: {
            dirPath: { type: 'string', description: 'Directorio base para buscar' },
            extension: { type: 'string', description: 'Extensión de archivo (opcional)' },
            namePattern: { type: 'string', description: 'Patrón en el nombre (opcional)' },
            recursive: { type: 'boolean', description: 'Búsqueda recursiva (opcional)' }
          },
          required: ['dirPath']
        }
      },
      {
        name: 'delete_multiple_items',
        description: 'Elimina múltiples archivos o directorios de una vez',
        inputSchema: {
          type: 'object',
          properties: {
            paths: { type: 'array', items: { type: 'string' }, description: 'Array de rutas de archivos o directorios a eliminar' }
          },
          required: ['paths']
        }
      },
      {
        name: 'read_pdf',
        description: 'USAR SIEMPRE PRIMERO: Lee y extrae texto de cualquier archivo PDF. Esta es la herramienta principal para leer PDFs. Funciona con la mayoría de PDFs que contienen texto.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo PDF a leer' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'read_pdf_chunk',
        description: 'Lee un fragmento específico de un PDF grande. Use esta herramienta cuando read_pdf indique que el PDF es muy grande y muestre chunks disponibles.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo PDF' },
            chunkIndex: { type: 'number', description: 'Índice del fragmento a leer (0-based)' },
            maxChunkSize: { type: 'number', description: 'Tamaño máximo del fragmento en caracteres (opcional, default: 8000)' }
          },
          required: ['filePath', 'chunkIndex']
        }
      },
      {
        name: 'ocr_pdf',
        description: 'SOLO usar si read_pdf falla: OCR para PDFs escaneados como imágenes. NO usar para PDFs normales. Solo usar cuando read_pdf no puede extraer texto.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo PDF escaneado para OCR' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'read_excel',
        description: 'Lee un archivo Excel o CSV',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel o CSV' },
            sheetName: { type: 'string', description: 'Nombre de la hoja (opcional)' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'write_excel',
        description: 'Escribe datos a un archivo Excel',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel a crear' },
            data: { 
              type: 'array', 
              items: { type: 'object' },
              description: 'Datos a escribir (array de objetos)' 
            },
            sheetName: { type: 'string', description: 'Nombre de la hoja (opcional)' }
          },
          required: ['filePath', 'data']
        }
      },
      {
        name: 'modify_excel',
        description: 'Modifica un archivo Excel existente',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel a modificar' },
            modifications: {
              type: 'object',
              description: 'Modificaciones a realizar',
              properties: {
                sheetName: { type: 'string', description: 'Nombre de la hoja' },
                addRows: { type: 'array', items: { type: 'object' }, description: 'Filas a agregar' },
                updateRows: { type: 'array', items: { type: 'object' }, description: 'Filas a actualizar' },
                deleteRows: { type: 'array', items: { type: 'number' }, description: 'Índices de filas a eliminar' }
              }
            }
          },
          required: ['filePath', 'modifications']
        }
      }
    ];
  }

  // Implementaciones de herramientas
  private async readTextFile(args: { filePath: string; _options?: { cwd?: string } }) {
    let finalPath = args.filePath;
    
    // Si se proporciona un directorio actual y la ruta no es absoluta, usar el directorio actual
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      finalPath = path.join(args._options.cwd, args.filePath);
    }
    
    const content = await fs.promises.readFile(finalPath, 'utf-8');
    return { content, filePath: finalPath };
  }

  private async writeTextFile(args: { filePath: string; content: string; _options?: { cwd?: string } }) {
    let finalPath = args.filePath;
    
    // Si se proporciona un directorio actual y la ruta no es absoluta, usar el directorio actual
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      finalPath = path.join(args._options.cwd, args.filePath);
    }
    
    // Crear el directorio padre si no existe
    const dir = path.dirname(finalPath);
    await fs.promises.mkdir(dir, { recursive: true });
    
    await fs.promises.writeFile(finalPath, args.content, 'utf-8');
    return { success: true, filePath: finalPath };
  }

  private async createDirectory(args: { dirPath: string; _options?: { cwd?: string } }) {
    let finalPath = args.dirPath;
    
    // Si se proporciona un directorio actual y la ruta no es absoluta, usar el directorio actual
    if (args._options?.cwd && !path.isAbsolute(args.dirPath)) {
      finalPath = path.join(args._options.cwd, args.dirPath);
    }
    
    await fs.promises.mkdir(finalPath, { recursive: true });
    return { success: true, dirPath: finalPath };
  }

  private async deleteFileOrDirectory(args: { targetPath: string; _options?: { cwd?: string } }) {
    let finalPath = args.targetPath;
    
    // Si se proporciona un directorio actual y la ruta no es absoluta, usar el directorio actual
    if (args._options?.cwd && !path.isAbsolute(args.targetPath)) {
      finalPath = path.join(args._options.cwd, args.targetPath);
    }
    
    await fs.promises.rm(finalPath, { recursive: true, force: true });
    return { success: true, targetPath: finalPath };
  }

  private async listDirectory(args: { dirPath: string }) {
    const items = await fs.promises.readdir(args.dirPath, { withFileTypes: true });
    const files = items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: path.join(args.dirPath, item.name)
    }));
    return { files };
  }

  private async copyFileOrDirectory(args: { sourcePath: string; destPath: string }) {
    await fs.promises.cp(args.sourcePath, args.destPath, { recursive: true });
    return { success: true };
  }

  private async moveFileOrDirectory(args: { sourcePath: string; destPath: string }) {
    await fs.promises.rename(args.sourcePath, args.destPath);
    return { success: true };
  }

  private async listFilesByCriteria(args: { dirPath: string; extension?: string; namePattern?: string; recursive?: boolean }) {
    const files: string[] = [];
    
    const searchDir = async (dir: string) => {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory() && args.recursive) {
          await searchDir(fullPath);
        } else if (item.isFile()) {
          let matches = true;
          
          if (args.extension && !item.name.endsWith(args.extension)) {
            matches = false;
          }
          
          if (args.namePattern && !item.name.includes(args.namePattern)) {
            matches = false;
          }
          
          if (matches) {
            files.push(fullPath);
          }
        }
      }
    };
    
    await searchDir(args.dirPath);
    return { files };
  }

  private async deleteMultipleItems(args: { paths: string[] }) {
    const results = [];
    for (const path of args.paths) {
      try {
        await fs.promises.rm(path, { recursive: true, force: true });
        results.push({ path, success: true });
      } catch (error) {
        results.push({ path, success: false, error: error instanceof Error ? error.message : 'Error desconocido' });
      }
    }
    return { results };
  }

  private async readPdf(args: { filePath: string; _options?: { cwd?: string } }) {
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }
    
    try {
      // Verificar que el archivo existe
      await fs.promises.access(resolvedPath, fs.constants.F_OK);
      
      const dataBuffer = await fs.promises.readFile(resolvedPath);
      
      // Verificar que el buffer no esté vacío
      if (dataBuffer.length === 0) {
        throw new Error('El archivo PDF está vacío');
      }
      
      // Verificar que sea un PDF válido (debe empezar con %PDF)
      const pdfHeader = dataBuffer.slice(0, 4).toString();
      if (pdfHeader !== '%PDF') {
        throw new Error('El archivo no es un PDF válido');
      }
      
      // Inicializar pdf-parse si no está disponible
      if (!PDFParseClass) {
        await initializePdfParse();
      }

      const parser = new PDFParseClass({ data: dataBuffer });
      
      let data;
      try {
        data = await parser.getText();
      } finally {
        // Limpiar recursos
        if (parser.destroy) {
          await parser.destroy();
        }
      }
      
      // Si no se extrajo texto, intentar OCR automáticamente
      if (!data.text || data.text.trim().length === 0) {
        console.log('No se encontró texto en el PDF, intentando OCR...');
        try {
          const ocrResult = await this.ocrPdf({ filePath: resolvedPath });
          return { 
            text: ocrResult.text, 
            pages: data.numpages || 1, 
            method: 'ocr',
            note: 'Texto extraído mediante OCR (PDF escaneado)'
          };
        } catch (ocrError) {
          throw new Error(`No se pudo extraer texto del PDF ni mediante OCR: ${ocrError instanceof Error ? ocrError.message : 'Error desconocido'}`);
        }
      }
      
      // Verificar si el PDF es muy grande (más de 15,000 caracteres)
      const maxSize = 15000;
      if (data.text.length > maxSize) {
        const chunkSize = 8000;
        const totalChunks = Math.ceil(data.text.length / chunkSize);
        
        return {
          text: `PDF muy grande (${data.text.length} caracteres). Para evitar límites de tokens, use read_pdf_chunk.`,
          pages: data.numpages,
          isLarge: true,
          totalChunks,
          chunkSize,
          suggestion: `Use read_pdf_chunk con chunkIndex de 0 a ${totalChunks - 1} para leer este PDF en fragmentos.`,
          availableChunks: Array.from({ length: totalChunks }, (_, i) => i)
        };
      }
      
      return { text: data.text, pages: data.numpages };
    } catch (error) {
      // Proporcionar un mensaje de error más específico
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al leer PDF: ${errorMessage}. Intenta usar ocr_pdf para PDFs escaneados.`);
    }
  }

  private async readPdfChunk(args: { filePath: string; chunkIndex: number; maxChunkSize?: number; _options?: { cwd?: string } }) {
    try {
      await initializePdfParse();
      
      const { filePath, chunkIndex, maxChunkSize = 8000 } = args;
      
      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`El archivo no existe: ${filePath}`);
      }
      
      // Leer el PDF completo
      const dataBuffer = fs.readFileSync(filePath);
      const data = await PDFParseClass(dataBuffer);
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error('No se pudo extraer texto del PDF - puede ser un PDF escaneado');
      }
      
      // Dividir el texto en chunks
      const text = data.text;
      const chunks = [];
      for (let i = 0; i < text.length; i += maxChunkSize) {
        chunks.push(text.slice(i, i + maxChunkSize));
      }
      
      // Verificar que el índice del chunk es válido
      if (chunkIndex < 0 || chunkIndex >= chunks.length) {
        throw new Error(`Índice de chunk inválido: ${chunkIndex}. Chunks disponibles: 0-${chunks.length - 1}`);
      }
      
      return {
        text: chunks[chunkIndex],
        chunkIndex,
        totalChunks: chunks.length,
        chunkSize: chunks[chunkIndex].length,
        totalPages: data.numpages,
        isLastChunk: chunkIndex === chunks.length - 1
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al leer chunk del PDF: ${errorMessage}`);
    }
  }

  private async ocrPdf(args: { filePath: string; _options?: { cwd?: string } }) {
    console.log('[OCR] Iniciando proceso OCR para:', args.filePath);
    
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }

    console.log('[OCR] Ruta resuelta:', resolvedPath);

    // Verificar que el archivo existe
    try {
      await fs.promises.access(resolvedPath, fs.constants.F_OK);
      console.log('[OCR] Archivo existe, verificando validez...');
    } catch (error) {
      throw new Error(`El archivo PDF no existe: ${resolvedPath}`);
    }

    // Verificar que sea un PDF válido
    try {
      const dataBuffer = await fs.promises.readFile(resolvedPath);
      if (dataBuffer.length === 0) {
        throw new Error('El archivo PDF está vacío');
      }
      
      const pdfHeader = dataBuffer.slice(0, 4).toString();
      if (pdfHeader !== '%PDF') {
        throw new Error('El archivo no es un PDF válido');
      }
      console.log('[OCR] PDF válido, tamaño:', dataBuffer.length, 'bytes');
    } catch (error) {
      throw new Error(`Error al validar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    // Crear directorio temporal seguro
    const os = require('os');
    const tempDir = path.join(os.tmpdir(), `desktop-helper-ocr-${Date.now()}`);
    console.log('[OCR] Directorio temporal:', tempDir);
    
    try {
      await fs.promises.mkdir(tempDir, { recursive: true });
      console.log('[OCR] Directorio temporal creado');
      
      // Configurar pdf2pic con parámetros más robustos y timeout
      console.log('[OCR] Configurando conversión PDF a imagen...');
      const convert = pdfToPicFromPath(resolvedPath, {
        density: 150,           // Mejor calidad
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 2000,           // Mayor resolución
        height: 2000
      });

      const pageToConvert = 1;
      console.log('[OCR] Convirtiendo página', pageToConvert, 'a imagen...');
      
      // Agregar timeout para la conversión
      const conversionPromise = convert(pageToConvert);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout en conversión PDF a imagen (30s)')), 30000)
      );
      
      const result = await Promise.race([conversionPromise, timeoutPromise]) as any;
      console.log('[OCR] Conversión completada:', result);
      
      // Verificar que se generó la imagen
      if (!result || !result.path) {
        throw new Error('No se pudo convertir el PDF a imagen');
      }

      // Verificar que el archivo de imagen existe
      await fs.promises.access(result.path, fs.constants.F_OK);
      console.log('[OCR] Imagen generada en:', result.path);
      
      // Crear worker de Tesseract con timeout
      console.log('[OCR] Inicializando Tesseract...');
      const worker = await createWorker('eng');
      console.log('[OCR] Tesseract inicializado, procesando imagen...');
      
      try {
        // Agregar timeout para OCR
        const ocrPromise = worker.recognize(result.path);
        const ocrTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout en OCR (60s)')), 60000)
        );
        
        const { data: { text } } = await Promise.race([ocrPromise, ocrTimeoutPromise]) as any;
        console.log('[OCR] OCR completado, texto extraído:', text.length, 'caracteres');
        
        if (!text || text.trim().length === 0) {
          throw new Error('No se pudo extraer texto de la imagen');
        }
        
        return { text: text.trim(), method: 'ocr' };
      } finally {
        console.log('[OCR] Terminando worker de Tesseract...');
        await worker.terminate();
        console.log('[OCR] Worker terminado');
      }
      
    } catch (ocrError) {
      console.error('[OCR] Error en proceso OCR:', ocrError);
      throw new Error(`No se pudo procesar el PDF con OCR: ${ocrError instanceof Error ? ocrError.message : 'Error desconocido'}`);
    } finally {
      // Limpiar archivos temporales
      try {
        console.log('[OCR] Limpiando archivos temporales...');
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log('[OCR] Limpieza completada');
      } catch (cleanupError) {
        console.warn('No se pudo limpiar directorio temporal:', cleanupError);
      }
    }
  }

  private async readExcel(args: { filePath: string; sheetName?: string; _options?: { cwd?: string } }) {
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    const sheetName = args.sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return { data, sheetNames: workbook.SheetNames };
  }

  private async writeExcel(args: { filePath: string; data: any[]; sheetName?: string; _options?: { cwd?: string } }) {
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(args.data);
    XLSX.utils.book_append_sheet(workbook, worksheet, args.sheetName || 'Hoja1');
    XLSX.writeFile(workbook, resolvedPath);
    return { success: true };
  }

  private async modifyExcel(args: { filePath: string; modifications: any; _options?: { cwd?: string } }) {
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    const sheetName = args.modifications.sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (args.modifications.addRows) {
      jsonData = jsonData.concat(args.modifications.addRows);
    }

    if (args.modifications.updateRows) {
      for (const update of args.modifications.updateRows) {
        if (update.index >= 0 && update.index < jsonData.length) {
          const currentRow = jsonData[update.index];
          if (typeof currentRow === 'object' && currentRow !== null && typeof update.data === 'object' && update.data !== null) {
            jsonData[update.index] = { ...currentRow, ...update.data };
          }
        }
      }
    }

    if (args.modifications.deleteRows) {
      const sortedIndices = args.modifications.deleteRows.sort((a: number, b: number) => b - a);
      for (const index of sortedIndices) {
        if (index >= 0 && index < jsonData.length) {
          jsonData.splice(index, 1);
        }
      }
    }

    const newWorksheet = XLSX.utils.json_to_sheet(jsonData);
    workbook.Sheets[sheetName] = newWorksheet;
    XLSX.writeFile(workbook, resolvedPath);
    
    return { success: true };
  }
}