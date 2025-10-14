import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
const chokidar = require('chokidar');
import * as XLSX from 'xlsx';
import { fromPath as pdfToPicFromPath } from 'pdf2pic';
import { createWorker } from 'tesseract.js';
import * as dotenv from 'dotenv';
import { createOpenAIService, ChatMessage } from '../services/openaiService';
import { ElectronMCPService } from '../mcp/electronMcpService';
import { IntegratedMCPService, MCPResponse } from '../services/integratedMcpService';

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
      console.log(
        '[OpenAI] Detectada API key en entorno. Inicializando servicio...'
      );
      openaiService = createOpenAIService(key, model);
      console.log('[OpenAI] Servicio inicializado correctamente.');
    } else if (!key) {
      console.warn('[OpenAI] OPENAI_API_KEY no está definida en el entorno.');
    } else {
      console.log('[OpenAI] Servicio ya estaba inicializado.');
    }
  } catch (e) {
    console.error(
      '[OpenAI] Error inicializando automáticamente:',
      e instanceof Error ? e.message : e
    );
  }
}

function ensureIntegratedMCPServiceInitialized(): void {
  if (!integratedMcpService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[IntegratedMCP] No se encontró OPENAI_API_KEY en el entorno');
      return;
    }

    console.log('[IntegratedMCP] Inicializando IntegratedMCPService...');
    try {
      integratedMcpService = new IntegratedMCPService({
        apiKey,
        model: process.env.OPENAI_MODEL || 'gpt-4o'
      });
      console.log('[IntegratedMCP] IntegratedMCPService inicializado correctamente.');
    } catch (error) {
      console.error('[IntegratedMCP] Error inicializando IntegratedMCPService:', error);
      integratedMcpService = null;
    }
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
      console.log(`[Renderer ${level}]`, message);
    }
  );

  // Registrar eventos de carga para diagnosticar fallos
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Renderer: did-finish-load');
  });
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error('Renderer: did-fail-load', {
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
  // Intentar inicialización automática tras crear la ventana
  ensureOpenAIInitialized();
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
  
  console.log(`[FileWatcher] Starting to watch: ${dirPath}`);
  
  currentWatcher = chokidar.watch(dirPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 10 // watch up to 10 levels deep
  });

  currentWatchedPath = dirPath;

  // File/directory added
  currentWatcher.on('add', (filePath) => {
    console.log(`[FileWatcher] File added: ${filePath}`);
    notifyFileSystemChange('add', filePath);
  });

  // File changed
  currentWatcher.on('change', (filePath) => {
    console.log(`[FileWatcher] File changed: ${filePath}`);
    notifyFileSystemChange('change', filePath);
  });

  // File/directory removed
  currentWatcher.on('unlink', (filePath) => {
    console.log(`[FileWatcher] File removed: ${filePath}`);
    notifyFileSystemChange('unlink', filePath);
  });

  // Directory added
  currentWatcher.on('addDir', (dirPath) => {
    console.log(`[FileWatcher] Directory added: ${dirPath}`);
    notifyFileSystemChange('addDir', dirPath);
  });

  // Directory removed
  currentWatcher.on('unlinkDir', (dirPath) => {
    console.log(`[FileWatcher] Directory removed: ${dirPath}`);
    notifyFileSystemChange('unlinkDir', dirPath);
  });

  currentWatcher.on('error', (error) => {
    console.error('[FileWatcher] Error:', error);
  });
}

function stopWatchingDirectory(): void {
  if (currentWatcher) {
    console.log(`[FileWatcher] Stopping watcher for: ${currentWatchedPath}`);
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
    console.error('Error reading directory:', error);
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
    console.error('Error getting file stats:', error);
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
    console.error('fs-read-text error:', error);
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
      console.error('fs-write-text error:', error);
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
    console.error('fs-delete error:', error);
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
    console.error('fs-copy error:', error);
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
    console.error('fs-move error:', error);
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
    console.error('fs-mkdir error:', error);
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
    console.error('pdf-read error:', error);
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
    console.error('pdf-ocr error:', error);
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
      console.error('excel-read error:', error);
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
      console.error('excel-write error:', error);
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
      console.error('excel-modify error:', error);
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
    console.error('Error inicializando OpenAI:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
});

ipcMain.handle('send-message-to-openai', async (_, messages: ChatMessage[]) => {
  try {
    if (!openaiService) {
      throw new Error('OpenAI no está inicializado');
    }

    const response = await openaiService.sendMessage(messages);
    return { success: true, response };
  } catch (error) {
    console.error('Error enviando mensaje a OpenAI:', error);
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
ipcMain.handle('mcp-service-init', async () => {
  try {
    ensureIntegratedMCPServiceInitialized();
    return { 
      success: true, 
      isInitialized: !!integratedMcpService 
    };
  } catch (error) {
    console.error('[IntegratedMCP] Error en mcp-service-init:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      isInitialized: false 
    };
  }
});

ipcMain.handle('mcp-service-send-message', async (_, messages: ChatMessage[], options?: { currentFolder?: string }) => {
  try {
    ensureIntegratedMCPServiceInitialized();
    if (!integratedMcpService) {
      return { 
        success: false, 
        error: 'IntegratedMCPService no está inicializado' 
      };
    }

    const response = await integratedMcpService.sendMessage(messages, options);
    return { 
      success: true, 
      response 
    };
  } catch (error) {
    console.error('[IntegratedMCP] Error en mcp-service-send-message:', error);
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
    console.error('[IntegratedMCP] Error en mcp-service-check-health:', error);
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
    console.error('[IntegratedMCP] Error en mcp-service-get-tools:', error);
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
    console.error('Error calling MCP tool:', error);
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
    console.error('Error getting MCP tools:', error);
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
    console.error('Error getting MCP tool documentation:', error);
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
    console.error('Error getting OpenAI functions:', error);
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
    console.error('Error starting file watcher:', error);
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
    console.error('Error stopping file watcher:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
});
