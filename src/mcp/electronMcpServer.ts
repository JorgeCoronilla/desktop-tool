import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { fromPath as pdfToPicFromPath } from 'pdf2pic';
import { createWorker } from 'tesseract.js';
import xlsxCalc from 'xlsx-calc';

// Variables globales para pdf-parse
let PDFParseClass: any = null;

async function initializePdfParse() {
  if (!PDFParseClass) {
    const pdfParseModule = await import('pdf-parse');
    PDFParseClass = pdfParseModule.default || pdfParseModule;
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
    this.registerTool('read_pdf_smart', this.readPdfSmart.bind(this));

    // Herramientas de Excel
    this.registerTool('read_excel', this.readExcel.bind(this));
    this.registerTool('write_excel', this.writeExcel.bind(this));
    this.registerTool('modify_excel', this.modifyExcel.bind(this));
    
    // Herramientas de Excel con fórmulas
    this.registerTool('read_excel_with_formulas', this.readExcelWithFormulas.bind(this));
    this.registerTool('add_excel_formulas', this.addExcelFormulas.bind(this));
    this.registerTool('calculate_excel_formulas', this.calculateExcelFormulas.bind(this));
    this.registerTool('get_excel_formulas_info', this.getExcelFormulasInfo.bind(this));
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
        name: 'read_pdf_smart',
        description: 'USAR SIEMPRE PRIMERO: Herramienta principal para leer PDFs con estrategias inteligentes. Automáticamente elige la mejor estrategia (lectura directa o OCR) y permite optimizar rendimiento. Use "preview" para facturas/documentos cortos.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo PDF a leer' },
            strategy: { 
              type: 'string', 
              enum: ['preview', 'full', 'pages', 'limit'],
              description: 'Estrategia: "preview" (facturas/docs cortos, default), "full" (documento completo), "pages" (páginas específicas), "limit" (límite caracteres)',
              default: 'preview'
            },
            pages: { 
              type: 'array', 
              items: { type: 'number' },
              description: 'Páginas específicas a leer (solo con strategy="pages"). Ej: [1, 3, 5]'
            },
            maxPages: { 
              type: 'number', 
              description: 'Máximo páginas desde el inicio (strategy="preview"). Default: 3',
              default: 3
            },
            maxCharacters: { 
              type: 'number', 
              description: 'Límite de caracteres (strategy="limit"). Default: 10000',
              default: 10000
            },
            useOcr: { 
              type: 'boolean', 
              description: 'Forzar OCR aunque haya texto directo. Default: false',
              default: false
            }
          },
          required: ['filePath']
        }
      },
      {
        name: 'read_pdf',
        description: 'HERRAMIENTA LEGACY: Lee texto básico de PDFs. Solo usar si read_pdf_smart no está disponible o falla.',
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
        description: 'HERRAMIENTA LEGACY: Lee fragmentos de PDFs grandes. Solo usar si read_pdf_smart no maneja PDFs grandes correctamente.',
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
        description: 'HERRAMIENTA LEGACY: OCR directo para PDFs escaneados. Solo usar si read_pdf_smart con useOcr=true no funciona.',
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
        description: 'Crea un archivo Excel con datos. IMPORTANTE: Siempre debes proporcionar el parámetro "data" con un array de objetos que representen las filas. Ejemplo: [{"Provincia": "Madrid", "Capital": "Madrid"}, {"Provincia": "Barcelona", "Capital": "Barcelona"}]',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel a crear' },
            data: { 
              type: 'array', 
              items: { 
                type: 'object',
                additionalProperties: true
              },
              description: 'REQUERIDO: Array de objetos donde cada objeto representa una fila. Las claves del objeto serán las columnas. Ejemplo: [{"Nombre": "Juan", "Edad": 30}, {"Nombre": "Ana", "Edad": 25}]' 
            },
            sheetName: { type: 'string', description: 'Nombre de la hoja (opcional, por defecto "Sheet1")' }
          },
          required: ['filePath', 'data']
        }
      },
      {
        name: 'modify_excel',
        description: 'Modifica un archivo Excel existente agregando, actualizando o eliminando filas. Ejemplo: para agregar filas usa addRows: [{"Nombre": "Juan", "Edad": 30}]',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel a modificar' },
            modifications: {
              type: 'object',
              description: 'Modificaciones a realizar en el archivo',
              properties: {
                sheetName: { type: 'string', description: 'Nombre de la hoja (opcional, por defecto la primera hoja)' },
                addRows: { 
                  type: 'array', 
                  items: { 
                    type: 'object',
                    additionalProperties: true
                  }, 
                  description: 'Filas a agregar como array de objetos. Ejemplo: [{"Columna1": "valor1", "Columna2": "valor2"}]' 
                },
                updateRows: { 
                  type: 'array', 
                  items: { 
                    type: 'object',
                    additionalProperties: true
                  }, 
                  description: 'Filas a actualizar como array de objetos con índice. Ejemplo: [{"index": 0, "Columna1": "nuevo_valor"}]' 
                },
                deleteRows: { type: 'array', items: { type: 'number' }, description: 'Índices de filas a eliminar (empezando desde 0)' }
              }
            }
          },
          required: ['filePath', 'modifications']
        }
      },
      {
        name: 'read_excel_with_formulas',
        description: 'Lee un archivo Excel con soporte completo para fórmulas. Calcula automáticamente las fórmulas y extrae información detallada. Útil para archivos con cálculos complejos.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel a leer' },
            sheetName: { type: 'string', description: 'Nombre de la hoja específica (opcional, por defecto lee la primera hoja)' },
            calculateFormulas: { type: 'boolean', description: 'Si calcular las fórmulas automáticamente antes de leer (por defecto: true)' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'add_excel_formulas',
        description: 'Agrega fórmulas a celdas específicas en un archivo Excel existente. Ejemplo: agregar =SUM(A1:A10) en la celda B1',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel existente' },
            formulas: {
              type: 'object',
              description: 'Configuración de las fórmulas a agregar',
              properties: {
                sheetName: { type: 'string', description: 'Nombre de la hoja donde agregar las fórmulas (opcional, por defecto la primera hoja)' },
                cellFormulas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      cell: { type: 'string', description: 'Dirección de la celda donde colocar la fórmula (ejemplos: A1, B2, C10)' },
                      formula: { type: 'string', description: 'Fórmula de Excel a agregar (ejemplos: =SUM(A1:A10), =AVERAGE(B1:B5), =A1*B1)' }
                    },
                    required: ['cell', 'formula']
                  },
                  description: 'Array de fórmulas a agregar. Ejemplo: [{"cell": "C1", "formula": "=A1+B1"}]'
                }
              },
              required: ['cellFormulas']
            }
          },
          required: ['filePath', 'formulas']
        }
      },
      {
        name: 'calculate_excel_formulas',
        description: 'Calcula todas las fórmulas en una hoja de Excel y guarda los resultados calculados en el archivo. Útil para actualizar valores después de cambios en los datos.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel con fórmulas a calcular' },
            sheetName: { type: 'string', description: 'Nombre de la hoja específica (opcional, por defecto calcula todas las hojas)' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'get_excel_formulas_info',
        description: 'Obtiene información detallada sobre todas las fórmulas en una hoja de Excel, incluyendo ubicación, dependencias, tipos de fórmulas y estadísticas. No modifica el archivo.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Ruta del archivo Excel a analizar' },
            sheetName: { type: 'string', description: 'Nombre de la hoja específica (opcional, por defecto analiza la primera hoja)' }
          },
          required: ['filePath']
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

  private async readPdfSmart(args: { 
    filePath: string; 
    strategy?: 'full' | 'preview' | 'pages' | 'limit';
    pages?: number[];
    maxPages?: number;
    maxCharacters?: number;
    useOcr?: boolean;
    _options?: { cwd?: string } 
  }) {
    // Establecer valores por defecto
    const strategy = args.strategy || 'preview';
    const maxPages = args.maxPages || 3;
    const maxCharacters = args.maxCharacters || 10000;
    const useOcr = args.useOcr || false;
    
    console.log(`\n🚀 [PDF_SMART] ===== NUEVA PETICIÓN =====`);
    console.log(`📄 [PDF_SMART] Archivo: ${args.filePath}`);
    console.log(`🎯 [PDF_SMART] Estrategia: ${strategy.toUpperCase()}`);
    
    // Log de parámetros específicos según la estrategia
    switch (strategy) {
      case 'preview':
        console.log(`📖 [PDF_SMART] Páginas máximas: ${maxPages}`);
        break;
      case 'pages':
        console.log(`📑 [PDF_SMART] Páginas específicas: [${args.pages?.join(', ') || 'No especificadas'}]`);
        break;
      case 'limit':
        console.log(`📏 [PDF_SMART] Límite de caracteres: ${maxCharacters}`);
        break;
      case 'full':
        console.log(`📚 [PDF_SMART] Lectura completa (máx. 10 páginas)`);
        break;
    }
    
    console.log(`🔧 [PDF_SMART] Forzar OCR: ${useOcr ? 'SÍ' : 'NO'}`);
    console.log(`⏰ [PDF_SMART] Timestamp: ${new Date().toISOString()}`);
    console.log(`🚀 [PDF_SMART] =============================\n`);
    
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }

    console.log(`[OCR] Ruta resuelta: ${resolvedPath}`);

    // Validar que el archivo existe
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Archivo no encontrado: ${resolvedPath}`);
    }

    // Validar que es un PDF
    if (!resolvedPath.toLowerCase().endsWith('.pdf')) {
      throw new Error('El archivo debe ser un PDF');
    }

    try {
      let extractedText = '';
      let metadata = {
        strategy: strategy,
        totalPages: 0,
        pagesRead: [],
        charactersExtracted: 0,
        ocrUsed: false
      };

      // Si se fuerza OCR o si la estrategia lo requiere
      if (useOcr) {
        console.log(`🔧 [PDF_SMART] DECISIÓN: Forzando uso de OCR por parámetro useOcr=true`);
        return await this.readPdfSmartWithOcr(resolvedPath, {...args, strategy, maxPages, maxCharacters, useOcr}, metadata);
      }

      // Intentar lectura directa primero
      console.log(`📖 [PDF_SMART] DECISIÓN: Intentando lectura directa del PDF primero`);
      
      await initializePdfParse();
      const dataBuffer = fs.readFileSync(resolvedPath);
      const parser = new PDFParseClass({ data: dataBuffer });
      let pdfData;
      
      try {
        pdfData = await parser.getText();
      } finally {
        // Limpiar el parser
        if (parser && typeof parser.destroy === 'function') {
          await parser.destroy();
        }
      }
      
      metadata.totalPages = pdfData.total || pdfData.numpages || 1;
      console.log(`📊 [PDF_SMART] PDF analizado: ${metadata.totalPages} páginas, ${pdfData.text?.length || 0} caracteres de texto directo`);

      // Verificar si hay texto extraíble
      if (!pdfData.text || pdfData.text.trim().length < 50) {
        console.log(`⚠️  [PDF_SMART] DECISIÓN: Texto insuficiente en lectura directa (${pdfData.text?.trim().length || 0} chars), cambiando a OCR automáticamente`);
        metadata.ocrUsed = true;
        return await this.readPdfSmartWithOcr(resolvedPath, {...args, strategy, maxPages, maxCharacters, useOcr}, metadata);
      }

      console.log(`✅ [PDF_SMART] DECISIÓN: Texto directo suficiente, aplicando estrategia ${strategy.toUpperCase()}`);

      // Aplicar estrategia de lectura
      switch (strategy) {
        case 'full':
          console.log(`📚 [PDF_SMART] PROCESANDO: Estrategia FULL - Extrayendo todo el texto (${pdfData.text.length} caracteres)`);
          extractedText = pdfData.text;
          metadata.pagesRead = Array.from({length: metadata.totalPages}, (_, i) => i + 1);
          break;

        case 'preview':
          // Para preview, necesitamos OCR para páginas específicas
          console.log(`📖 [PDF_SMART] DECISIÓN: Estrategia PREVIEW requiere OCR para páginas específicas (1-${Math.min(maxPages, metadata.totalPages)})`);
          metadata.ocrUsed = true;
          return await this.readPdfSmartWithOcr(resolvedPath, {...args, strategy, maxPages, maxCharacters, useOcr, pages: Array.from({length: Math.min(maxPages, metadata.totalPages)}, (_, i) => i + 1)}, metadata);

        case 'pages':
          if (!args.pages || args.pages.length === 0) {
            throw new Error('Para strategy="pages" se requiere el parámetro pages con números de página');
          }
          // Para páginas específicas, necesitamos OCR
          console.log(`📑 [PDF_SMART] DECISIÓN: Estrategia PAGES requiere OCR para páginas específicas [${args.pages.join(', ')}]`);
          metadata.ocrUsed = true;
          return await this.readPdfSmartWithOcr(resolvedPath, {...args, strategy, maxPages, maxCharacters, useOcr}, metadata);

        case 'limit':
          console.log(`📏 [PDF_SMART] PROCESANDO: Estrategia LIMIT - Limitando a ${maxCharacters} caracteres de ${pdfData.text.length} totales`);
          extractedText = pdfData.text.substring(0, maxCharacters);
          metadata.pagesRead = [1]; // Aproximación, no sabemos exactamente qué páginas
          break;

        default:
          throw new Error(`Estrategia no válida: ${strategy}`);
      }

      metadata.charactersExtracted = extractedText.length;
      
      console.log(`\n✅ [PDF_SMART] ===== RESULTADO FINAL =====`);
      console.log(`📊 [PDF_SMART] Caracteres extraídos: ${metadata.charactersExtracted}`);
      console.log(`📄 [PDF_SMART] Páginas procesadas: [${metadata.pagesRead.join(', ')}]`);
      console.log(`🔧 [PDF_SMART] OCR utilizado: ${metadata.ocrUsed ? 'SÍ' : 'NO'}`);
      console.log(`⏰ [PDF_SMART] Completado: ${new Date().toISOString()}`);
      console.log(`✅ [PDF_SMART] ===============================\n`);
      
      return {
        text: extractedText,
        metadata: metadata
      };

    } catch (error) {
      console.error(`❌ [PDF_SMART] ERROR en procesamiento:`, error);
      
      // Si falla la lectura directa, intentar OCR como fallback
      if (!args.useOcr) {
        console.log(`🔄 [PDF_SMART] FALLBACK: Cambiando a OCR debido a error en lectura directa`);
        console.log(`🎯 [PDF_SMART] FALLBACK: Estrategia ${args.strategy.toUpperCase()} será procesada con OCR`);
        const metadata = {
          strategy: args.strategy,
          totalPages: 0,
          pagesRead: [],
          charactersExtracted: 0,
          ocrUsed: true
        };
        return await this.readPdfSmartWithOcr(resolvedPath, args, metadata);
      }
      
      console.error(`❌ [PDF_SMART] ERROR FINAL: No se pudo procesar el PDF con ningún método`);
      throw error;
    }
  }

  private async readPdfSmartWithOcr(resolvedPath: string, args: any, metadata: any) {
    console.log(`\n🔍 [PDF_SMART_OCR] ===== INICIANDO OCR =====`);
    console.log(`📄 [PDF_SMART_OCR] Archivo: ${resolvedPath}`);
    console.log(`🎯 [PDF_SMART_OCR] Estrategia: ${args.strategy.toUpperCase()}`);
    
    const tempDir = path.join(process.cwd(), 'temp_ocr_smart');
    
    try {
      // Obtener número total de páginas del PDF primero
      let totalPages = metadata.totalPages || 1;
      
      // Si no tenemos el total de páginas en metadata, intentar obtenerlo
      if (!metadata.totalPages) {
        try {
          if (!PDFParseClass) {
            await initializePdfParse();
          }
          const dataBuffer = fs.readFileSync(resolvedPath);
          const pdfData = new PDFParseClass({ data: dataBuffer });
          const parsedData = await pdfData.getText();
          totalPages = parsedData.total || parsedData.numpages || 1;
          metadata.totalPages = totalPages;
          console.log(`📊 [PDF_SMART_OCR] Total de páginas detectado: ${totalPages}`);
        } catch (pageCountError) {
          console.log(`⚠️  [PDF_SMART_OCR] No se pudo determinar el número de páginas, asumiendo 1`);
          totalPages = 1;
        }
      }

      // Crear directorio temporal
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Configurar pdf2pic
      const convert = pdfToPicFromPath(resolvedPath, {
        density: 200,
        saveFilename: "page",
        savePath: tempDir,
        format: "png",
        width: 2000,
        height: 2000
      });

      let pagesToProcess: number[] = [];
      
      // Determinar qué páginas procesar según la estrategia
      switch (args.strategy) {
        case 'full':
          // Para full, procesamos todas las páginas (limitado a 10 para rendimiento)
          const maxPagesForFull = Math.min(10, totalPages);
          pagesToProcess = Array.from({length: maxPagesForFull}, (_, i) => i + 1);
          console.log(`📚 [PDF_SMART_OCR] FULL: Procesando hasta ${maxPagesForFull} páginas de ${totalPages} totales`);
          break;
          
        case 'preview':
          const maxPages = Math.min(args.maxPages || 3, totalPages);
          pagesToProcess = Array.from({length: maxPages}, (_, i) => i + 1);
          console.log(`📖 [PDF_SMART_OCR] PREVIEW: Procesando primeras ${maxPages} páginas de ${totalPages} totales`);
          break;
          
        case 'pages':
          const requestedPages = args.pages || [1];
          // Filtrar páginas que existen en el PDF
          pagesToProcess = requestedPages.filter(page => page >= 1 && page <= totalPages);
          if (pagesToProcess.length !== requestedPages.length) {
            const invalidPages = requestedPages.filter(page => page < 1 || page > totalPages);
            console.log(`⚠️  [PDF_SMART_OCR] PAGES: Páginas inválidas ignoradas [${invalidPages.join(', ')}] - PDF solo tiene ${totalPages} páginas`);
          }
          console.log(`📑 [PDF_SMART_OCR] PAGES: Procesando páginas válidas [${pagesToProcess.join(', ')}] de ${totalPages} totales`);
          break;
          
        case 'limit':
          // Para limit, solo procesamos la primera página si existe
          pagesToProcess = totalPages >= 1 ? [1] : [];
          console.log(`📏 [PDF_SMART_OCR] LIMIT: Procesando página 1 de ${totalPages} totales (límite: ${args.maxCharacters || 10000} chars)`);
          break;
      }

      // Verificar que tenemos páginas válidas para procesar
      if (pagesToProcess.length === 0) {
        throw new Error(`No hay páginas válidas para procesar. PDF tiene ${totalPages} páginas.`);
      }

      console.log(`🔄 [PDF_SMART_OCR] Páginas a procesar: [${pagesToProcess.join(', ')}]`);
      
      let combinedText = '';
      const processedPages: number[] = [];

      // Procesar cada página
      for (const pageNum of pagesToProcess) {
        try {
          console.log(`[OCR] Convirtiendo página ${pageNum} a imagen...`);
          
          // Convertir página específica con timeout
          const conversionPromise = convert(pageNum, { responseType: "image" });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout en conversión de página ${pageNum}`)), 30000)
          );
          
          const result: any = await Promise.race([conversionPromise, timeoutPromise]);
          
          if (!result || !result.path) {
            console.log(`[OCR] No se pudo convertir la página ${pageNum}, saltando...`);
            continue;
          }

          console.log(`[OCR] Página ${pageNum} convertida: ${result.path}`);

          // Verificar que el archivo de imagen existe
          if (!fs.existsSync(result.path)) {
            console.log(`[OCR] Archivo de imagen no encontrado para página ${pageNum}, saltando...`);
            continue;
          }

          // Crear worker de Tesseract
          console.log(`[OCR] Iniciando reconocimiento OCR para página ${pageNum}...`);
          const worker = await createWorker('spa');
          
          try {
            // Reconocimiento con timeout
            const recognitionPromise = worker.recognize(result.path);
            const ocrTimeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Timeout en OCR de página ${pageNum}`)), 60000)
            );
            
            const { data: { text } }: any = await Promise.race([recognitionPromise, ocrTimeoutPromise]);
            
            if (text && text.trim().length > 0) {
              combinedText += `\n--- Página ${pageNum} ---\n${text.trim()}\n`;
              processedPages.push(pageNum);
              console.log(`[OCR] Página ${pageNum} procesada exitosamente - ${text.length} caracteres`);
              
              // Para strategy 'limit', verificar si ya alcanzamos el límite
              if (args.strategy === 'limit') {
                const maxChars = args.maxCharacters || 10000;
                if (combinedText.length >= maxChars) {
                  combinedText = combinedText.substring(0, maxChars);
                  console.log(`[OCR] Límite de caracteres alcanzado: ${maxChars}`);
                  break;
                }
              }
            } else {
              console.log(`[OCR] No se extrajo texto de la página ${pageNum}`);
            }
          } finally {
            await worker.terminate();
          }

          // Limpiar archivo de imagen temporal
          try {
            fs.unlinkSync(result.path);
          } catch (cleanupError) {
            console.log(`[OCR] Error limpiando archivo temporal: ${cleanupError}`);
          }

        } catch (pageError) {
          console.error(`[OCR] Error procesando página ${pageNum}:`, pageError);
          continue;
        }
      }

      // Actualizar metadata
      metadata.pagesRead = processedPages;
      metadata.charactersExtracted = combinedText.length;
      metadata.ocrUsed = true;

      if (combinedText.trim().length === 0) {
        throw new Error('No se pudo extraer texto de ninguna página del PDF');
      }

      console.log(`\n✅ [PDF_SMART_OCR] ===== RESULTADO OCR =====`);
      console.log(`📊 [PDF_SMART_OCR] Páginas procesadas exitosamente: [${processedPages.join(', ')}]`);
      console.log(`📏 [PDF_SMART_OCR] Caracteres extraídos: ${combinedText.length}`);
      console.log(`🎯 [PDF_SMART_OCR] Estrategia aplicada: ${args.strategy.toUpperCase()}`);
      console.log(`⏰ [PDF_SMART_OCR] Completado: ${new Date().toISOString()}`);
      console.log(`✅ [PDF_SMART_OCR] ===========================\n`);

      return {
        text: combinedText.trim(),
        metadata: metadata
      };

    } finally {
      // Limpiar directorio temporal
      try {
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          for (const file of files) {
            fs.unlinkSync(path.join(tempDir, file));
          }
          fs.rmdirSync(tempDir);
        }
      } catch (cleanupError) {
        console.log(`[OCR] Error en limpieza final:`, cleanupError);
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

  private async readExcelWithFormulas(args: { 
    filePath: string; 
    sheetName?: string; 
    calculateFormulas?: boolean; 
    _options?: { cwd?: string } 
  }) {
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }

    const workbook = XLSX.readFile(resolvedPath);
    const targetSheetName = args.sheetName && workbook.SheetNames.includes(args.sheetName)
      ? args.sheetName
      : workbook.SheetNames[0];
    
    const sheet = workbook.Sheets[targetSheetName];
    
    if (args.calculateFormulas !== false) {
      // Calcular fórmulas usando xlsx-calc
      try {
        xlsxCalc(workbook);
      } catch (calcError) {
        console.warn('Error calculando fórmulas:', calcError);
      }
    }
    
    // Obtener datos con fórmulas preservadas
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    const formulaData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
    
    // Extraer información de fórmulas
    const formulas: { cell: string; formula: string; value?: any }[] = [];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[cellAddress];
        if (cell && cell.f) {
          formulas.push({
            cell: cellAddress,
            formula: cell.f,
            value: cell.v
          });
        }
      }
    }
    
    return {
      sheets: workbook.SheetNames,
      currentSheet: targetSheetName,
      data: rows,
      formulaData: formulaData,
      formulas: formulas,
      rowCount: rows.length,
      formulaCount: formulas.length,
      calculated: args.calculateFormulas !== false
    };
  }

  private async addExcelFormulas(args: {
    filePath: string;
    formulas: {
      sheetName?: string;
      cellFormulas: { cell: string; formula: string }[];
    };
    _options?: { cwd?: string };
  }) {
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }

    const workbook = XLSX.readFile(resolvedPath);
    const targetSheetName = args.formulas.sheetName && workbook.SheetNames.includes(args.formulas.sheetName)
      ? args.formulas.sheetName
      : workbook.SheetNames[0];
    
    const sheet = workbook.Sheets[targetSheetName];
    
    // Agregar fórmulas a las celdas especificadas
    for (const cellFormula of args.formulas.cellFormulas) {
      const cellAddress = cellFormula.cell.toUpperCase();
      if (!sheet[cellAddress]) {
        sheet[cellAddress] = {};
      }
      sheet[cellAddress].f = cellFormula.formula;
      // Limpiar el valor para forzar recálculo
      delete sheet[cellAddress].v;
    }
    
    // Actualizar el rango de la hoja si es necesario
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    for (const cellFormula of args.formulas.cellFormulas) {
      const cellRef = XLSX.utils.decode_cell(cellFormula.cell);
      if (cellRef.r > range.e.r) range.e.r = cellRef.r;
      if (cellRef.c > range.e.c) range.e.c = cellRef.c;
      if (cellRef.r < range.s.r) range.s.r = cellRef.r;
      if (cellRef.c < range.s.c) range.s.c = cellRef.c;
    }
    sheet['!ref'] = XLSX.utils.encode_range(range);
    
    // Calcular fórmulas
    try {
      xlsxCalc(workbook);
    } catch (calcError) {
      console.warn('Error calculando fórmulas:', calcError);
    }
    
    // Guardar el archivo
    XLSX.writeFile(workbook, resolvedPath);
    
    return {
      formulasAdded: args.formulas.cellFormulas.length,
      sheetName: targetSheetName
    };
  }

  private async calculateExcelFormulas(args: { 
    filePath: string; 
    sheetName?: string; 
    _options?: { cwd?: string } 
  }) {
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }

    const workbook = XLSX.readFile(resolvedPath);
    const targetSheetName = args.sheetName && workbook.SheetNames.includes(args.sheetName)
      ? args.sheetName
      : workbook.SheetNames[0];
    
    // Calcular todas las fórmulas
    try {
      xlsxCalc(workbook);
    } catch (calcError) {
      throw new Error(`Error calculando fórmulas: ${calcError instanceof Error ? calcError.message : 'Error desconocido'}`);
    }
    
    // Guardar el archivo con los valores calculados
    XLSX.writeFile(workbook, resolvedPath);
    
    const sheet = workbook.Sheets[targetSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    
    return {
      sheetName: targetSheetName,
      rowCount: rows.length,
      calculated: true
    };
  }

  private async getExcelFormulasInfo(args: { 
    filePath: string; 
    sheetName?: string; 
    _options?: { cwd?: string } 
  }) {
    // Resolver ruta relativa si se proporciona cwd
    let resolvedPath = args.filePath;
    if (args._options?.cwd && !path.isAbsolute(args.filePath)) {
      resolvedPath = path.resolve(args._options.cwd, args.filePath);
    }

    const workbook = XLSX.readFile(resolvedPath);
    const targetSheetName = args.sheetName && workbook.SheetNames.includes(args.sheetName)
      ? args.sheetName
      : workbook.SheetNames[0];
    
    const sheet = workbook.Sheets[targetSheetName];
    
    // Extraer información detallada de fórmulas
    const formulas: { 
      cell: string; 
      formula: string; 
      value?: any; 
      type?: string;
      dependencies?: string[];
    }[] = [];
    
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[cellAddress];
        if (cell && cell.f) {
          // Analizar dependencias básicas (referencias a otras celdas)
          const dependencies = cell.f.match(/[A-Z]+[0-9]+/g) || [];
          
          formulas.push({
            cell: cellAddress,
            formula: cell.f,
            value: cell.v,
            type: typeof cell.v,
            dependencies: [...new Set(dependencies)] as string[] // Eliminar duplicados
          });
        }
      }
    }
    
    // Estadísticas
    const formulaTypes = formulas.reduce((acc, f) => {
      const firstChar = f.formula.charAt(0);
      const key = firstChar === '=' ? 'formula' : 'expression';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      sheetName: targetSheetName,
      formulas: formulas,
      formulaCount: formulas.length,
      formulaTypes: formulaTypes,
      totalCells: (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1),
      formulaPercentage: formulas.length > 0 ? 
        ((formulas.length / ((range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1))) * 100).toFixed(2) : '0'
    };
  }
}