"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    selectFolder: () => electron_1.ipcRenderer.invoke('select-folder'),
    readDirectory: (path) => electron_1.ipcRenderer.invoke('read-directory', path),
    getFileStats: (path) => electron_1.ipcRenderer.invoke('get-file-stats', path),
    countFilesRecursively: (path) => electron_1.ipcRenderer.invoke('count-files-recursively', path),
    // OpenAI functions
    initOpenAI: (apiKey) => electron_1.ipcRenderer.invoke('init-openai', apiKey),
    sendMessageToOpenAI: (messages) => electron_1.ipcRenderer.invoke('send-message-to-openai', messages),
    checkOpenAIConfig: () => electron_1.ipcRenderer.invoke('check-openai-config'),
    getOpenAIConfig: () => electron_1.ipcRenderer.invoke('get-openai-config'),
    // FS real operations
    readTextFile: (filePath) => electron_1.ipcRenderer.invoke('fs-read-text', filePath),
    writeTextFile: (filePath, content) => electron_1.ipcRenderer.invoke('fs-write-text', filePath, content),
    deletePath: (targetPath) => electron_1.ipcRenderer.invoke('fs-delete', targetPath),
    copyPath: (sourcePath, destPath) => electron_1.ipcRenderer.invoke('fs-copy', sourcePath, destPath),
    movePath: (sourcePath, destPath) => electron_1.ipcRenderer.invoke('fs-move', sourcePath, destPath),
    createDirectory: (dirPath) => electron_1.ipcRenderer.invoke('fs-mkdir', dirPath),
    // Document operations
    readPDF: (filePath) => electron_1.ipcRenderer.invoke('pdf-read', filePath),
    ocrPDF: (filePath, lang) => electron_1.ipcRenderer.invoke('pdf-ocr', filePath, lang),
    readExcel: (filePath, sheetName) => electron_1.ipcRenderer.invoke('excel-read', filePath, sheetName),
    writeExcel: (filePath, data, sheetName) => electron_1.ipcRenderer.invoke('excel-write', filePath, data, sheetName),
    modifyExcel: (filePath, modifications) => electron_1.ipcRenderer.invoke('excel-modify', filePath, modifications),
    styleExcelCells: (filePath, styles) => electron_1.ipcRenderer.invoke('excel-style-cells', filePath, styles),
    // Excel formula functions
    readExcelWithFormulas: (filePath, sheetName, calculateFormulas) => electron_1.ipcRenderer.invoke('excel-read-with-formulas', filePath, sheetName, calculateFormulas),
    addExcelFormulas: (filePath, formulas) => electron_1.ipcRenderer.invoke('excel-add-formulas', filePath, formulas),
    calculateExcelFormulas: (filePath, sheetName) => electron_1.ipcRenderer.invoke('excel-calculate-formulas', filePath, sheetName),
    getExcelFormulasInfo: (filePath, sheetName) => electron_1.ipcRenderer.invoke('excel-get-formulas-info', filePath, sheetName),
    // MCP Service functions (secure)
    mcpServiceInit: (apiKey) => electron_1.ipcRenderer.invoke('mcp-service-init', apiKey),
    mcpServiceSendMessage: (messages, options) => electron_1.ipcRenderer.invoke('mcp-service-send-message', messages, options),
    mcpServiceCheckHealth: () => electron_1.ipcRenderer.invoke('mcp-service-check-health'),
    mcpServiceGetTools: () => electron_1.ipcRenderer.invoke('mcp-service-get-tools'),
    // MCP functions (legacy)
    mcpCallTool: (toolName, arguments_, options) => electron_1.ipcRenderer.invoke('mcp-call-tool', toolName, arguments_, options),
    mcpGetTools: () => electron_1.ipcRenderer.invoke('mcp-get-tools'),
    mcpGetToolDocumentation: () => electron_1.ipcRenderer.invoke('mcp-get-tool-documentation'),
    mcpGetOpenAIFunctions: () => electron_1.ipcRenderer.invoke('mcp-get-openai-functions'),
    // File watcher functions
    startFileWatcher: (dirPath) => electron_1.ipcRenderer.invoke('start-file-watcher', dirPath),
    stopFileWatcher: () => electron_1.ipcRenderer.invoke('stop-file-watcher'),
    // Batch operations
    batchExecute: (requests) => electron_1.ipcRenderer.invoke('batch-execute', requests),
    // Event listeners
    on: (channel, listener) => {
        electron_1.ipcRenderer.on(channel, listener);
    },
    off: (channel, listener) => {
        electron_1.ipcRenderer.off(channel, listener);
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
