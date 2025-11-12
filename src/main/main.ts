import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
const chokidar = require('chokidar');
import { logger } from '../services/loggerService';
import * as XLSX from 'xlsx';
import * as xlsxCalc from 'xlsx-calc';
import { fromPath as pdfToPicFromPath } from 'pdf2pic';
import * as dotenv from 'dotenv';
import { createOpenAIService, ChatMessage as OpenAIChatMessage } from '../services/openaiService';
import { ElectronMCPService } from '../mcp/electronMcpService';
import { IntegratedMCPService, MCPResponse } from '../services/integratedMcpService';
import { ChatMessage } from '../types/global';

// Función de conversión entre tipos de ChatMessage
function convertToOpenAIChatMessage(message: ChatMessage): OpenAIChatMessage {
  return {
    role: message.role,
    content: message.content,
    timestamp: message.timestamp
  };
}

// Función para convertir mensajes del frontend al tipo ChatMessage completo
function ensureCompleteMessage(message: any): ChatMessage {
  return {
    id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp || new Date()
  };
}

// Inicialización de pdf-parse v2.3.0
let PDFParseClass: any = null;

async function initializePdfParse() {
  if (!PDFParseClass) {
    const pdfParseModule = await import('pdf-parse');
    // En v2.3.0, necesitamos la clase PDFParse
    PDFParseClass = (pdfParseModule as any).PDFParse || (pdfParseModule as any).default?.PDFParse;
  }
  return PDFParseClass;
}

async function initializeTesseract() {
  const tesseractModule = await import('tesseract.js');
  return tesseractModule.createWorker;
}

// Cargar variables de entorno
dotenv.config();

// Instancia global del servicio OpenAI
let openaiService: any = null;

// Instancia del servicio MCP integrado
const mcpService = new ElectronMCPService();

// Instancia del servicio MCP integrado con OpenAI
let integratedMcpService: IntegratedMCPService | null = null;
function ensureOpenAIInitialized(): void {
  try {
    const key = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    if (key && !openaiService) {
      logger.info('OpenAI Service initialization', {
        apiKeyDefined: 'Defined',
        model
      });
      openaiService = createOpenAIService(key, model);
      logger.info('OpenAI Service initialized successfully');
    } else if (!key) {
      logger.warn('OPENAI_API_KEY not defined in environment');
    } else {
      logger.info('OpenAI Service already initialized');
    }
  } catch (e) {
    logger.error('Error initializing OpenAI Service automatically', e);
  }
}

// Variable global para almacenar la API key del usuario
let userApiKey: string | null = null;

function ensureIntegratedMCPServiceInitialized(providedApiKey?: string): void {
  console.log('🔧 [Main] Verificando inicialización del IntegratedMCPService...');
  
  if (!integratedMcpService) {
    // Usar la API key proporcionada, la almacenada del usuario, o la del entorno
    const apiKey = providedApiKey || userApiKey || process.env.OPENAI_API_KEY;
    console.log('🔑 [Main] Estado de la API Key:', {
      defined: !!apiKey,
      length: apiKey ? apiKey.length : 0,
      firstChars: apiKey ? apiKey.substring(0, 8) + '...' : 'undefined',
      source: providedApiKey ? 'provided' : userApiKey ? 'user-stored' : 'environment'
    });
    
    if (!apiKey) {
      console.error('❌ [Main] No se puede inicializar IntegratedMCPService: OPENAI_API_KEY no definida');
      logger.warn('IntegratedMCP: OPENAI_API_KEY not found in environment or user config');
      return;
    }

    // Almacenar la API key del usuario si se proporcionó
    if (providedApiKey) {
      userApiKey = providedApiKey;
    }

    console.log('🚀 [Main] Inicializando IntegratedMCPService...');
    logger.info('Initializing IntegratedMCPService');
    try {
      integratedMcpService = new IntegratedMCPService({
        apiKey,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        tier: 2 // Usar Tier 2 por defecto para mejores límites
      });
      console.log('✅ [Main] IntegratedMCPService inicializado correctamente');
      logger.info('IntegratedMCPService initialized successfully');
    } catch (error) {
      console.error('❌ [Main] Error inicializando IntegratedMCPService:', error);
      logger.error('Error initializing IntegratedMCPService', error);
      integratedMcpService = null;
    }
  } else {
    console.log('ℹ️ [Main] IntegratedMCPService ya está inicializado');
  }
}

let mainWindow: BrowserWindow;

// File watcher variables
let currentWatcher: any = null;
let currentWatchedPath: string | null = null;

// Límites de tamaño (MB)
const MAX_PDF_SIZE_MB = 50;
const MAX_EXCEL_SIZE_MB = 20;

async function ensureFileSizeWithin(
  filePath: string,
  maxMB: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const stats = await fs.promises.stat(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > maxMB) {
      return {
        ok: false,
        error: `Archivo demasiado grande (${sizeMB.toFixed(2)}MB). Límite: ${maxMB}MB.`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : 'Error desconocido al verificar tamaño',
    };
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    const devPort = process.env.DEV_SERVER_PORT || '3002';
    mainWindow.loadURL(`http://localhost:${devPort}`).catch(() => {
      // Fallback: si el dev server no está activo, cargar archivos desde dist
      mainWindow.loadFile(path.join(__dirname, '../../index.html'));
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../index.html'));
    // Abrir DevTools temporalmente para depurar pantalla en blanco
    mainWindow.webContents.openDevTools();
  }

  // Reenviar mensajes de la consola del renderer al proceso principal para depuración
  mainWindow.webContents.on(
    'console-message',
    (level, message, line, sourceId) => {
      logger.debug('Renderer console message', { level, message, line, sourceId });
    }
  );

  // Registrar eventos de carga para diagnosticar fallos
  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Renderer finished loading');
  });
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      logger.error('Renderer failed to load', {
        errorCode,
        errorDescription,
        validatedURL,
      });
    }
  );

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  
  // Intentar inicializar el IntegratedMCPService al arrancar
  // (solo funcionará si hay OPENAI_API_KEY en el entorno)
  try {
    logger.info('Auto-initializing IntegratedMCPService on app ready...');
    ensureIntegratedMCPServiceInitialized();
    if (integratedMcpService) {
      logger.info('IntegratedMCPService auto-initialized successfully');
    } else {
      logger.warn('IntegratedMCPService auto-initialization failed - API key may be missing');
    }
  } catch (error) {
    logger.error('Error during IntegratedMCPService auto-initialization', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers para operaciones de archivos
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Función auxiliar para contar archivos recursivamente (solo para logging)
async function countFilesRecursively(dirPath: string): Promise<number> {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    let count = 0;
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        count += await countFilesRecursively(fullPath);
      } else {
        count++;
      }
    }
    
    return count;
  } catch (error) {
    return 0;
  }
}

// File watcher functions
function startWatchingDirectory(dirPath: string): void {
  // Stop any existing watcher
  stopWatchingDirectory();
  
  logger.info('Starting file watcher', { dirPath });
  
  currentWatcher = chokidar.watch(dirPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 10 // watch up to 10 levels deep
  });

  currentWatchedPath = dirPath;

  // File/directory added
  currentWatcher.on('add', (filePath) => {
    logger.debug('File added', { filePath });
    notifyFileSystemChange('add', filePath);
  });

  // File changed
  currentWatcher.on('change', (filePath) => {
    logger.debug('File changed', { filePath });
    notifyFileSystemChange('change', filePath);
  });

  // File/directory removed
  currentWatcher.on('unlink', (filePath) => {
    logger.debug('File removed', { filePath });
    notifyFileSystemChange('unlink', filePath);
  });

  // Directory added
  currentWatcher.on('addDir', (dirPath) => {
    logger.debug('Directory added', { dirPath });
    notifyFileSystemChange('addDir', dirPath);
  });

  // Directory removed
  currentWatcher.on('unlinkDir', (dirPath) => {
    logger.debug('Directory removed', { dirPath });
    notifyFileSystemChange('unlinkDir', dirPath);
  });

  currentWatcher.on('error', (error) => {
    logger.error('File watcher error', error);
  });
}

function stopWatchingDirectory(): void {
  if (currentWatcher) {
    logger.info('Stopping file watcher', { watchedPath: currentWatchedPath });
    currentWatcher.close();
    currentWatcher = null;
    currentWatchedPath = null;
  }
}

function notifyFileSystemChange(eventType: string, filePath: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('file-system-change', {
      type: eventType,
      path: filePath,
      watchedPath: currentWatchedPath
    });
  }
}

ipcMain.handle('read-directory', async (_, dirPath: string) => {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const result = items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: path.join(dirPath, item.name),
    }));
    
    // Contar archivos recursivamente solo para logging
    const totalFiles = await countFilesRecursively(dirPath);
    console.log(`[DEBUG] Directory items in current level: ${result.length}, Total files recursively: ${totalFiles}`);
    
    return result;
  } catch (error) {
    logger.error('Error reading directory', { dirPath, error });
    return [];
  }
});

ipcMain.handle('get-file-stats', async (_, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return {
      size: stats.size,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
      logger.error('Error getting file stats', { filePath, error });
      return null;
    }
});

ipcMain.handle('count-files-recursively', async (_, dirPath: string) => {
  try {
    const count = await countFilesRecursively(dirPath);
    console.log(`[DEBUG] Recursive file count for ${dirPath}: ${count}`);
    return count;
  } catch (error) {
    console.error('Error counting files recursively:', error);
    return 0;
  }
});

// IPC: Operaciones reales de sistema de archivos
ipcMain.handle('fs-read-text', async (_, filePath: string) => {
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (error) {
    logger.error('Error reading text file', { filePath, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
});

ipcMain.handle(
  'fs-write-text',
  async (_, filePath: string, content: string) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      logger.error('Error writing text file', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
);

ipcMain.handle('fs-delete', async (_, targetPath: string) => {
  try {
    await fs.promises.rm(targetPath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
      logger.error('Error deleting file', { targetPath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
});

ipcMain.handle('fs-copy', async (_, sourcePath: string, destPath: string) => {
  try {
    await fs.promises.cp(sourcePath, destPath, { recursive: true });
    return { success: true };
  } catch (error) {
      logger.error('Error copying file', { sourcePath, destPath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
});

ipcMain.handle('fs-move', async (_, sourcePath: string, destPath: string) => {
  try {
    await fs.promises.rename(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    logger.error('Error moving file', { sourcePath, destPath, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
});

ipcMain.handle('fs-mkdir', async (_, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
      logger.error('Error creating directory', { dirPath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
});

// IPC: Lectura real de PDFs usando pdf-parse
ipcMain.handle('pdf-read', async (_, filePath: string) => {
  try {
    const sizeCheck = await ensureFileSizeWithin(filePath, MAX_PDF_SIZE_MB);
    if (!sizeCheck.ok) {
      return { success: false, error: sizeCheck.error };
    }
    
    // Inicializar pdf-parse si no está disponible
    if (!PDFParseClass) {
      await initializePdfParse();
    }
    
    const dataBuffer = await fs.promises.readFile(filePath);
    
    // Usar la nueva API de pdf-parse v2.3.0
    const parser = new PDFParseClass({ data: dataBuffer });
    let parsed;
    try {
      parsed = await parser.getText();
      return {
        success: true,
        data: {
          text: parsed.text,
          pages: parsed.total || parsed.numpages || 1,
          info: parsed.info || {},
        },
      };
    } finally {
      // Limpiar el parser
      if (parser && typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  } catch (error) {
      logger.error('Error reading PDF', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
});

// IPC: OCR de PDF usando pdf2pic + tesseract.js
ipcMain.handle('pdf-ocr', async (_, filePath: string, lang: string = 'eng') => {
  try {
    const sizeCheck = await ensureFileSizeWithin(filePath, MAX_PDF_SIZE_MB);
    if (!sizeCheck.ok) {
      return { success: false, error: sizeCheck.error };
    }

    // Inicializar pdf-parse si no está disponible
    if (!PDFParseClass) {
      await initializePdfParse();
    }
    
    const dataBuffer = await fs.promises.readFile(filePath);
    const parsed = await PDFParseClass(dataBuffer);
    const numPages: number = Number(parsed.numpages) || 1;

    // Convertir páginas a imágenes temporales
    const tmpDir = path.join(
      app.getPath('temp'),
      `desktop-helper-ocr-${Date.now()}`
    );
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const converter = pdfToPicFromPath(filePath, {
      density: 144,
      saveFilename: 'page',
      savePath: tmpDir,
      format: 'png',
      quality: 100,
    });

    const createWorker = await initializeTesseract();
    const worker = await createWorker();
    // Reinitialize el worker con el idioma solicitado
    await worker.reinitialize(lang);

    let textCombined = '';
    for (let i = 1; i <= numPages; i++) {
      try {
        const result = await converter(i);
        const imagePath = result.path as string;
        const { data } = await worker.recognize(imagePath);
        textCombined += (data?.text || '') + '\n\n';
      } catch (pageErr) {
        console.warn(`OCR falló en página ${i}:`, pageErr);
      }
    }

    await worker.terminate();
    // Limpiar imágenes temporales
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch {}

    return {
      success: true,
      data: {
        text: textCombined.trim(),
        pages: numPages,
        info: { ocrLang: lang },
      },
      message: `OCR completado: ${numPages} páginas procesadas`,
    };
  } catch (error) {
    logger.error('Error performing PDF OCR', { filePath, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
});

// IPC: Operaciones reales de Excel usando xlsx
ipcMain.handle(
  'excel-read',
  async (_, filePath: string, sheetName?: string) => {
    try {
      const sizeCheck = await ensureFileSizeWithin(filePath, MAX_EXCEL_SIZE_MB);
      if (!sizeCheck.ok) {
        return { success: false, error: sizeCheck.error };
      }
      const workbook = XLSX.readFile(filePath);
      const targetSheetName =
        sheetName && workbook.SheetNames.includes(sheetName)
          ? sheetName
          : workbook.SheetNames[0];
      const sheet = workbook.Sheets[targetSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      return {
        success: true,
        data: {
          sheets: workbook.SheetNames,
          currentSheet: targetSheetName,
          data: rows,
          rowCount: rows.length,
        },
      };
    } catch (error) {
      logger.error('Error reading Excel file', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
);

ipcMain.handle(
  'excel-write',
  async (_, filePath: string, data: any[], sheetName: string = 'Hoja1') => {
    try {
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(data || []);
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      XLSX.writeFile(workbook, filePath);
      return { success: true };
    } catch (error) {
      logger.error('Error writing Excel file', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
);

ipcMain.handle(
  'excel-modify',
  async (
    _,
    filePath: string,
    modifications: {
      sheetName?: string;
      addRows?: any[];
      updateRows?: { rowIndex: number; data: any }[];
      deleteRows?: number[];
    }
  ) => {
    try {
      const workbook = XLSX.readFile(filePath);
      const targetSheetName =
        modifications.sheetName &&
        workbook.SheetNames.includes(modifications.sheetName)
          ? modifications.sheetName
          : workbook.SheetNames[0];
      const sheet = workbook.Sheets[targetSheetName];
      let rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      if (
        Array.isArray(modifications.addRows) &&
        modifications.addRows.length > 0
      ) {
        rows = rows.concat(modifications.addRows);
      }
      if (Array.isArray(modifications.updateRows)) {
        for (const upd of modifications.updateRows) {
          if (
            upd &&
            typeof upd.rowIndex === 'number' &&
            upd.rowIndex >= 0 &&
            upd.rowIndex < rows.length
          ) {
            rows[upd.rowIndex] = { ...rows[upd.rowIndex], ...(upd.data || {}) };
          }
        }
      }
      if (Array.isArray(modifications.deleteRows)) {
        // Delete rows by index, highest to lowest to avoid reindex issues
        const sorted = [...modifications.deleteRows].sort((a, b) => b - a);
        for (const idx of sorted) {
          if (idx >= 0 && idx < rows.length) {
            rows.splice(idx, 1);
          }
        }
      }

      const newSheet = XLSX.utils.json_to_sheet(rows);
      workbook.Sheets[targetSheetName] = newSheet;
      XLSX.writeFile(workbook, filePath);
      return { success: true, data: { rowCount: rows.length } };
    } catch (error) {
      logger.error('Error modifying Excel file', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
);

ipcMain.handle('excel-style-cells', async (event, filePath: string, styles: any[]) => {
    try {
      const result = await mcpService.callTool('style_excel_cells', { filePath, styles });
      return result;
    } catch (error) {
      logger.error('Error styling Excel cells', { filePath, error });
      return { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  });

// IPC: Nuevos handlers para fórmulas de Excel usando xlsx-calc
ipcMain.handle(
  'excel-read-with-formulas',
  async (_, filePath: string, sheetName?: string, calculateFormulas: boolean = true) => {
    try {
      const sizeCheck = await ensureFileSizeWithin(filePath, MAX_EXCEL_SIZE_MB);
      if (!sizeCheck.ok) {
        return { success: false, error: sizeCheck.error };
      }
      
      const workbook = XLSX.readFile(filePath);
      const targetSheetName =
        sheetName && workbook.SheetNames.includes(sheetName)
          ? sheetName
          : workbook.SheetNames[0];
      
      const sheet = workbook.Sheets[targetSheetName];
      
      if (calculateFormulas) {
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
        success: true,
        data: {
          sheets: workbook.SheetNames,
          currentSheet: targetSheetName,
          data: rows,
          formulaData: formulaData,
          formulas: formulas,
          rowCount: rows.length,
          formulaCount: formulas.length,
          calculated: calculateFormulas
        },
      };
    } catch (error) {
      logger.error('Error reading Excel file with formulas', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
);

ipcMain.handle(
  'excel-add-formulas',
  async (_, filePath: string, formulas: {
    sheetName?: string;
    cellFormulas: { cell: string; formula: string }[];
  }) => {
    try {
      const sizeCheck = await ensureFileSizeWithin(filePath, MAX_EXCEL_SIZE_MB);
      if (!sizeCheck.ok) {
        return { success: false, error: sizeCheck.error };
      }
      
      const workbook = XLSX.readFile(filePath);
      const targetSheetName =
        formulas.sheetName && workbook.SheetNames.includes(formulas.sheetName)
          ? formulas.sheetName
          : workbook.SheetNames[0];
      
      const sheet = workbook.Sheets[targetSheetName];
      
      // Agregar fórmulas a las celdas especificadas
      for (const cellFormula of formulas.cellFormulas) {
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
      for (const cellFormula of formulas.cellFormulas) {
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
      XLSX.writeFile(workbook, filePath);
      
      return {
        success: true,
        data: {
          formulasAdded: formulas.cellFormulas.length,
          sheetName: targetSheetName
        }
      };
    } catch (error) {
      logger.error('Error adding formulas to Excel file', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
);

ipcMain.handle(
  'excel-calculate-formulas',
  async (_, filePath: string, sheetName?: string) => {
    try {
      const sizeCheck = await ensureFileSizeWithin(filePath, MAX_EXCEL_SIZE_MB);
      if (!sizeCheck.ok) {
        return { success: false, error: sizeCheck.error };
      }
      
      const workbook = XLSX.readFile(filePath);
      const targetSheetName =
        sheetName && workbook.SheetNames.includes(sheetName)
          ? sheetName
          : workbook.SheetNames[0];
      
      // Calcular todas las fórmulas
      try {
        xlsxCalc(workbook);
      } catch (calcError) {
        logger.error('Error calculating formulas', { filePath, error: calcError });
        return {
          success: false,
          error: `Error calculando fórmulas: ${calcError instanceof Error ? calcError.message : 'Error desconocido'}`
        };
      }
      
      // Guardar el archivo con los valores calculados
      XLSX.writeFile(workbook, filePath);
      
      const sheet = workbook.Sheets[targetSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      
      return {
        success: true,
        data: {
          sheetName: targetSheetName,
          rowCount: rows.length,
          calculated: true
        }
      };
    } catch (error) {
      logger.error('Error in excel-calculate-formulas', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
);

ipcMain.handle(
  'excel-get-formulas-info',
  async (_, filePath: string, sheetName?: string) => {
    try {
      const sizeCheck = await ensureFileSizeWithin(filePath, MAX_EXCEL_SIZE_MB);
      if (!sizeCheck.ok) {
        return { success: false, error: sizeCheck.error };
      }
      
      const workbook = XLSX.readFile(filePath);
      const targetSheetName =
        sheetName && workbook.SheetNames.includes(sheetName)
          ? sheetName
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
        success: true,
        data: {
          sheetName: targetSheetName,
          formulas: formulas,
          formulaCount: formulas.length,
          formulaTypes: formulaTypes,
          totalCells: (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1),
          formulaPercentage: formulas.length > 0 ? 
            ((formulas.length / ((range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1))) * 100).toFixed(2) : '0'
        }
      };
    } catch (error) {
      logger.error('Error getting Excel formulas info', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
);

// Handlers para OpenAI

ipcMain.handle('init-openai', async (_, apiKey?: string) => {
  try {
    const key = apiKey || process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    if (!key) {
      throw new Error('API Key de OpenAI no encontrada');
    }

    openaiService = createOpenAIService(key, model);
    console.log(
      '[OpenAI] init-openai: servicio inicializado con modelo',
      model
    );
    return { success: true, message: 'OpenAI inicializado correctamente' };
  } catch (error) {
    logger.error('Error initializing OpenAI', { error });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
});

ipcMain.handle('send-message-to-openai', async (_, messages: any[]) => {
  try {
    if (!openaiService) {
      throw new Error('OpenAI no está inicializado');
    }

    const completeMessages = messages.map(ensureCompleteMessage);
    const openaiMessages = completeMessages.map(convertToOpenAIChatMessage);
    const response = await openaiService.sendMessage(openaiMessages);
    return { success: true, response };
  } catch (error) {
    logger.error('Error sending message to OpenAI', { error });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
});

ipcMain.handle('check-openai-config', async () => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  console.log(
    '[OpenAI] check-openai-config -> hasApiKey:',
    hasApiKey,
    'isInitialized:',
    !!openaiService,
    'model:',
    model
  );

  return {
    hasApiKey,
    model,
    isInitialized: !!openaiService,
  };
});

ipcMain.handle('get-openai-config', async () => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const apiKey = process.env.OPENAI_API_KEY || '';
  
  console.log(
    '[OpenAI] get-openai-config -> hasApiKey:',
    hasApiKey,
    'isInitialized:',
    !!openaiService,
    'model:',
    model
  );

  return {
    hasApiKey,
    model,
    isInitialized: !!openaiService,
    apiKey: hasApiKey ? apiKey : undefined,
  };
});

// IPC handlers para el servicio MCP integrado
ipcMain.handle('mcp-service-init', async (_, apiKey?: string) => {
  try {
    ensureIntegratedMCPServiceInitialized(apiKey);
    return { 
      success: true, 
      isInitialized: !!integratedMcpService 
    };
  } catch (error) {
    logger.error('IntegratedMCP error in mcp-service-init', { error });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      isInitialized: false 
    };
  }
});

ipcMain.handle('mcp-service-send-message', async (_, messages: any[], options?: { currentFolder?: string }) => {
  try {
    ensureIntegratedMCPServiceInitialized();
    if (!integratedMcpService) {
      return { 
        success: false, 
        error: 'IntegratedMCPService no está inicializado' 
      };
    }

    // Convertir mensajes al tipo correcto
    const completeMessages = messages.map(ensureCompleteMessage);
    const response = await integratedMcpService.sendMessage(completeMessages, options);
    return { 
      success: true, 
      response 
    };
  } catch (error) {
    logger.error('IntegratedMCP error in mcp-service-send-message', { error });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
});

ipcMain.handle('mcp-service-check-health', async () => {
  try {
    ensureIntegratedMCPServiceInitialized();
    if (!integratedMcpService) {
      return { 
        success: false, 
        error: 'IntegratedMCPService no está inicializado' 
      };
    }

    const isHealthy = await integratedMcpService.checkHealth();
    return { 
      success: true, 
      isHealthy 
    };
  } catch (error) {
    logger.error('IntegratedMCP error in mcp-service-check-health', { error });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
});

ipcMain.handle('mcp-service-get-tools', async () => {
  try {
    ensureIntegratedMCPServiceInitialized();
    if (!integratedMcpService) {
      return { 
        success: false, 
        error: 'IntegratedMCPService no está inicializado' 
      };
    }

    const tools = integratedMcpService.getAvailableTools();
    return { 
      success: true, 
      tools 
    };
  } catch (error) {
    logger.error('IntegratedMCP error in mcp-service-get-tools', { error });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
});

// IPC handlers para MCP (legacy)
ipcMain.handle('mcp-call-tool', async (_, toolName: string, arguments_: Record<string, any>, options?: { cwd?: string }) => {
  try {
    const result = await mcpService.callTool(toolName, arguments_, options);
    return result;
  } catch (error) {
    logger.error('Error calling MCP tool', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
});

ipcMain.handle('mcp-get-tools', async () => {
  try {
    const tools = mcpService.getTools();
    return { success: true, tools };
  } catch (error) {
    logger.error('Error getting MCP tools', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
});

ipcMain.handle('mcp-get-tool-documentation', async () => {
  try {
    const documentation = mcpService.generateToolDocumentation();
    return { success: true, documentation };
  } catch (error) {
    logger.error('Error getting MCP tool documentation', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
});

ipcMain.handle('mcp-get-openai-functions', async () => {
  try {
    const functions = mcpService.getOpenAIFunctions();
    return { success: true, functions };
  } catch (error) {
    logger.error('Error getting OpenAI functions', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
});

// File watcher IPC handlers
ipcMain.handle('start-file-watcher', async (_, dirPath: string) => {
  try {
    startWatchingDirectory(dirPath);
    return { success: true };
  } catch (error) {
    logger.error('Error starting file watcher', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
});

ipcMain.handle('stop-file-watcher', async () => {
  try {
    stopWatchingDirectory();
    return { success: true };
  } catch (error) {
    logger.error('Error stopping file watcher', { error });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
});

// Batch execution handler
ipcMain.handle('batch-execute', async (_, requests: { id: string; method: string; args: any[] }[]) => {
  const results: { id: string; success: boolean; result?: any; error?: string }[] = [];
  
  for (const request of requests) {
    try {
      let result;
      
      // Map method names to actual logic
       switch (request.method) {
         case 'read-directory':
           const dirPath = request.args[0];
           const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
           result = items.map(item => ({
             name: item.name,
             isDirectory: item.isDirectory(),
             path: path.join(dirPath, item.name)
           }));
           break;
         case 'count-files-recursively':
           result = await countFilesRecursively(request.args[0]);
           break;
         case 'get-file-stats':
           const stats = await fs.promises.stat(request.args[0]);
           result = {
             size: stats.size,
             modified: stats.mtime,
             isDirectory: stats.isDirectory()
           };
           break;
         case 'fs-read-text':
           const content = await fs.promises.readFile(request.args[0], 'utf-8');
           result = { success: true, data: content };
           break;
         default:
           throw new Error(`Unsupported batch method: ${request.method}`);
       }
      
      results.push({
        id: request.id,
        success: true,
        result
      });
    } catch (error) {
      results.push({
        id: request.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
});
