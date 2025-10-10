import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import { fromPath as pdfToPicFromPath } from 'pdf2pic';
import { createWorker } from 'tesseract.js';
import * as dotenv from 'dotenv';
import { createOpenAIService, ChatMessage } from '../services/openaiService';

// Normalizar export de pdf-parse (algunas instalaciones ESM exponen default)
const pdfParseFn: any = (pdfParse as any).default ?? (pdfParse as any);

// Cargar variables de entorno
dotenv.config();

// Inicialización automática de OpenAI si hay API key en entorno
let openaiService: any = null;
function ensureOpenAIInitialized(): void {
  try {
    const key = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
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

let mainWindow: BrowserWindow;

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

ipcMain.handle('read-directory', async (_, dirPath: string) => {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: path.join(dirPath, item.name),
    }));
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
    const dataBuffer = await fs.promises.readFile(filePath);
    const parsed = await pdfParseFn(dataBuffer);
    return {
      success: true,
      data: {
        text: parsed.text,
        pages: parsed.numpages,
        info: parsed.info || {},
      },
    };
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

    const dataBuffer = await fs.promises.readFile(filePath);
    const parsed = await pdfParseFn(dataBuffer);
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
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

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
  const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
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
