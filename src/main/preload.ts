import { contextBridge, ipcRenderer } from 'electron';
import { ChatMessage } from '../types/global';

export interface OpenAIResponse {
  success: boolean;
  response?: string;
  message?: string;
}

export interface OpenAIConfig {
  hasApiKey: boolean;
  model: string;
  isInitialized: boolean;
  apiKey?: string;
}

export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  readDirectory: (path: string) => Promise<FileItem[]>;
  getFileStats: (path: string) => Promise<FileStats | null>;
  countFilesRecursively: (path: string) => Promise<number>;
  // OpenAI functions
  initOpenAI: (apiKey?: string) => Promise<OpenAIResponse>;
  sendMessageToOpenAI: (messages: ChatMessage[]) => Promise<OpenAIResponse>;
  checkOpenAIConfig: () => Promise<OpenAIConfig>;
  getOpenAIConfig: () => Promise<OpenAIConfig>;
  // FS real operations
  readTextFile: (
    filePath: string
  ) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeTextFile: (
    filePath: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>;
  deletePath: (
    targetPath: string
  ) => Promise<{ success: boolean; error?: string }>;
  copyPath: (
    sourcePath: string,
    destPath: string
  ) => Promise<{ success: boolean; error?: string }>;
  movePath: (
    sourcePath: string,
    destPath: string
  ) => Promise<{ success: boolean; error?: string }>;
  createDirectory: (
    dirPath: string
  ) => Promise<{ success: boolean; error?: string }>;
  // Document operations
  readPDF: (
    filePath: string
  ) => Promise<{
    success: boolean;
    data?: { text: string; pages: number; info: any };
    error?: string;
  }>;
  ocrPDF: (
    filePath: string,
    lang?: string
  ) => Promise<{
    success: boolean;
    data?: { text: string; pages: number; info: any };
    message?: string;
    error?: string;
  }>;
  readExcel: (
    filePath: string,
    sheetName?: string
  ) => Promise<{
    success: boolean;
    data?: {
      sheets: string[];
      currentSheet: string;
      data: any[];
      rowCount: number;
    };
    error?: string;
  }>;
  writeExcel: (
    filePath: string,
    data: any[],
    sheetName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  modifyExcel: (
    filePath: string,
    modifications: {
      sheetName?: string;
      addRows?: any[];
      updateRows?: { rowIndex: number; data: any }[];
      deleteRows?: number[];
    }
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  styleExcelCells: (
    filePath: string,
    styles: any[]
  ) => Promise<{ success: boolean; error?: string }>;
  // Excel formula functions
  readExcelWithFormulas: (
    filePath: string,
    sheetName?: string,
    calculateFormulas?: boolean
  ) => Promise<{
    success: boolean;
    data?: {
      sheets: string[];
      currentSheet: string;
      data: any[];
      formulaData: any[];
      formulas: { cell: string; formula: string; value?: any }[];
      rowCount: number;
      formulaCount: number;
      calculated: boolean;
    };
    error?: string;
  }>;
  addExcelFormulas: (
    filePath: string,
    formulas: {
      sheetName?: string;
      cellFormulas: { cell: string; formula: string }[];
    }
  ) => Promise<{
    success: boolean;
    data?: {
      formulasAdded: number;
      sheetName: string;
    };
    error?: string;
  }>;
  calculateExcelFormulas: (
    filePath: string,
    sheetName?: string
  ) => Promise<{
    success: boolean;
    data?: {
      sheetName: string;
      rowCount: number;
      calculated: boolean;
    };
    error?: string;
  }>;
  getExcelFormulasInfo: (
    filePath: string,
    sheetName?: string
  ) => Promise<{
    success: boolean;
    data?: {
      sheetName: string;
      formulas: {
        cell: string;
        formula: string;
        value?: any;
        type?: string;
        dependencies?: string[];
      }[];
      formulaCount: number;
      formulaTypes: Record<string, number>;
      totalCells: number;
      formulaPercentage: string;
    };
    error?: string;
  }>;
  // MCP Service functions (secure)
  mcpServiceInit: (apiKey?: string) => Promise<{ success: boolean; isInitialized: boolean; error?: string }>;
  mcpServiceSendMessage: (
    messages: ChatMessage[],
    options?: { currentFolder?: string }
  ) => Promise<{ success: boolean; response?: any; error?: string }>;
  mcpServiceCheckHealth: () => Promise<{ success: boolean; isHealthy?: boolean; error?: string }>;
  mcpServiceGetTools: () => Promise<{ success: boolean; tools?: string[]; error?: string }>;
  // MCP functions (legacy)
  mcpCallTool: (
    toolName: string,
    arguments_: Record<string, any>,
    options?: { cwd?: string }
  ) => Promise<{ success: boolean; result?: any; error?: string }>;
  mcpGetTools: () => Promise<{ success: boolean; tools?: any[]; error?: string }>;
  mcpGetToolDocumentation: () => Promise<{ success: boolean; documentation?: string; error?: string }>;
  mcpGetOpenAIFunctions: () => Promise<{ success: boolean; functions?: any[]; error?: string }>;
  // File watcher functions
  startFileWatcher: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  stopFileWatcher: () => Promise<{ success: boolean; error?: string }>;
  // Batch operations
  batchExecute: (requests: { id: string; method: string; args: any[] }[]) => Promise<{ id: string; success: boolean; result?: any; error?: string }[]>;
  // Event listeners
  on: (channel: string, listener: (...args: any[]) => void) => void;
  off: (channel: string, listener: (...args: any[]) => void) => void;
}

export interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface FileStats {
  size: number;
  modified: Date;
  isDirectory: boolean;
}

const electronAPI: ElectronAPI = {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (path: string) => ipcRenderer.invoke('read-directory', path),
  getFileStats: (path: string) => ipcRenderer.invoke('get-file-stats', path),
  countFilesRecursively: (path: string) => ipcRenderer.invoke('count-files-recursively', path),
  // OpenAI functions
  initOpenAI: (apiKey?: string) => ipcRenderer.invoke('init-openai', apiKey),
  sendMessageToOpenAI: (messages: ChatMessage[]) =>
    ipcRenderer.invoke('send-message-to-openai', messages),
  checkOpenAIConfig: () => ipcRenderer.invoke('check-openai-config'),
  getOpenAIConfig: () => ipcRenderer.invoke('get-openai-config'),
  // FS real operations
  readTextFile: (filePath: string) =>
    ipcRenderer.invoke('fs-read-text', filePath),
  writeTextFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs-write-text', filePath, content),
  deletePath: (targetPath: string) =>
    ipcRenderer.invoke('fs-delete', targetPath),
  copyPath: (sourcePath: string, destPath: string) =>
    ipcRenderer.invoke('fs-copy', sourcePath, destPath),
  movePath: (sourcePath: string, destPath: string) =>
    ipcRenderer.invoke('fs-move', sourcePath, destPath),
  createDirectory: (dirPath: string) => ipcRenderer.invoke('fs-mkdir', dirPath),
  // Document operations
  readPDF: (filePath: string) => ipcRenderer.invoke('pdf-read', filePath),
  ocrPDF: (filePath: string, lang?: string) =>
    ipcRenderer.invoke('pdf-ocr', filePath, lang),
  readExcel: (filePath: string, sheetName?: string) =>
    ipcRenderer.invoke('excel-read', filePath, sheetName),
  writeExcel: (filePath: string, data: any[], sheetName?: string) =>
    ipcRenderer.invoke('excel-write', filePath, data, sheetName),
  modifyExcel: (
    filePath: string,
    modifications: {
      sheetName?: string;
      addRows?: any[];
      updateRows?: { rowIndex: number; data: any }[];
      deleteRows?: number[];
    }
  ) => ipcRenderer.invoke('excel-modify', filePath, modifications),

  styleExcelCells: (
    filePath: string,
    styles: any[]
  ) => ipcRenderer.invoke('excel-style-cells', filePath, styles),

  // Excel formula functions
  readExcelWithFormulas: (filePath: string, sheetName?: string, calculateFormulas?: boolean) =>
    ipcRenderer.invoke('excel-read-with-formulas', filePath, sheetName, calculateFormulas),
  addExcelFormulas: (
    filePath: string,
    formulas: {
      sheetName?: string;
      cellFormulas: { cell: string; formula: string }[];
    }
  ) => ipcRenderer.invoke('excel-add-formulas', filePath, formulas),
  calculateExcelFormulas: (filePath: string, sheetName?: string) =>
    ipcRenderer.invoke('excel-calculate-formulas', filePath, sheetName),
  getExcelFormulasInfo: (filePath: string, sheetName?: string) =>
    ipcRenderer.invoke('excel-get-formulas-info', filePath, sheetName),

  // MCP Service functions (secure)
  mcpServiceInit: (apiKey?: string) => ipcRenderer.invoke('mcp-service-init', apiKey),
  mcpServiceSendMessage: (messages: ChatMessage[], options?: { currentFolder?: string }) =>
    ipcRenderer.invoke('mcp-service-send-message', messages, options),
  mcpServiceCheckHealth: () => ipcRenderer.invoke('mcp-service-check-health'),
  mcpServiceGetTools: () => ipcRenderer.invoke('mcp-service-get-tools'),
  // MCP functions (legacy)
  mcpCallTool: (toolName: string, arguments_: Record<string, any>, options?: { cwd?: string }) =>
    ipcRenderer.invoke('mcp-call-tool', toolName, arguments_, options),
  mcpGetTools: () => ipcRenderer.invoke('mcp-get-tools'),
  mcpGetToolDocumentation: () => ipcRenderer.invoke('mcp-get-tool-documentation'),
  mcpGetOpenAIFunctions: () => ipcRenderer.invoke('mcp-get-openai-functions'),
  // File watcher functions
  startFileWatcher: (dirPath: string) => ipcRenderer.invoke('start-file-watcher', dirPath),
  stopFileWatcher: () => ipcRenderer.invoke('stop-file-watcher'),
  // Batch operations
  batchExecute: (requests: { id: string; method: string; args: any[] }[]) => 
    ipcRenderer.invoke('batch-execute', requests),
  // Event listeners
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, listener);
  },
  off: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.off(channel, listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
