import { contextBridge, ipcRenderer } from 'electron';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface OpenAIResponse {
  success: boolean;
  response?: string;
  message?: string;
}

export interface OpenAIConfig {
  hasApiKey: boolean;
  model: string;
  isInitialized: boolean;
}

export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  readDirectory: (path: string) => Promise<FileItem[]>;
  getFileStats: (path: string) => Promise<FileStats | null>;
  // OpenAI functions
  initOpenAI: (apiKey?: string) => Promise<OpenAIResponse>;
  sendMessageToOpenAI: (messages: ChatMessage[]) => Promise<OpenAIResponse>;
  checkOpenAIConfig: () => Promise<OpenAIConfig>;
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
  // OpenAI functions
  initOpenAI: (apiKey?: string) => ipcRenderer.invoke('init-openai', apiKey),
  sendMessageToOpenAI: (messages: ChatMessage[]) =>
    ipcRenderer.invoke('send-message-to-openai', messages),
  checkOpenAIConfig: () => ipcRenderer.invoke('check-openai-config'),
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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
