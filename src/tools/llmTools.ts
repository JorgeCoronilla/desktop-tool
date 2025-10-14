/**
 * Herramientas para el LLM - Desktop Helper (Renderer Process)
 *
 * Este archivo contiene todas las herramientas que el LLM puede usar
 * para realizar operaciones sobre archivos y documentos.
 * Adaptado para funcionar en el proceso renderer de Electron usando IPC.
 */

import { TaskState, TaskContext } from '../types/global';

// Tipos para las herramientas
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface FileSystemTool {
  name: string;
  description: string;
  parameters: any;
  execute: (...args: any[]) => Promise<ToolResult>;
}

// Tipo local para elementos de directorio devueltos por readDirectory
type FileItem = { name: string; isDirectory: boolean; path: string };

/**
 * Herramientas básicas del sistema de archivos (usando IPC)
 */
export class FileSystemTools {
  /**
   * Lee el contenido de un archivo de texto
   */
  static async readTextFile(filePath: string): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.readTextFile) {
        const res = await window.electronAPI.readTextFile(filePath);
        if (res.success) {
          return {
            success: true,
            data: res.data,
            message: `📖 Archivo leído: ${filePath.split('/').pop()}`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al leer archivo',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para leer archivos',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al leer el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Escribe contenido a un archivo de texto
   */
  static async writeTextFile(
    filePath: string,
    content: string
  ): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.writeTextFile) {
        const res = await window.electronAPI.writeTextFile(filePath, content);
        if (res.success) {
          return {
            success: true,
            data: { filePath, content },
            message: `📄 Archivo "${filePath.split('/').pop()}" creado exitosamente`
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al escribir archivo',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para escribir archivos',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al escribir el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Crea un directorio
   */
  static async createDirectory(dirPath: string): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.createDirectory) {
        const res = await window.electronAPI.createDirectory(dirPath);
        if (res.success) {
          return {
            success: true,
            message: `📁 Directorio creado: ${dirPath.split('/').pop()}`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al crear directorio',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para crear directorios',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al crear el directorio: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Elimina un archivo o directorio
   */
  static async deleteFileOrDirectory(targetPath: string): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.deletePath) {
        const res = await window.electronAPI.deletePath(targetPath);
        if (res.success) {
          return {
            success: true,
            message: `🗑️ Eliminado: ${targetPath.split('/').pop()}`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al eliminar',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para eliminar',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al eliminar: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Copia un archivo o directorio
   */
  static async copyFileOrDirectory(
    sourcePath: string,
    destPath: string
  ): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.copyPath) {
        const res = await window.electronAPI.copyPath(sourcePath, destPath);
        if (res.success) {
          return {
            success: true,
            message: `Copiado de ${sourcePath.split('/').pop()} a ${destPath.split('/').pop()}`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al copiar',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para copiar',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al copiar: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Mueve un archivo o directorio
   */
  static async moveFileOrDirectory(
    sourcePath: string,
    destPath: string
  ): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.movePath) {
        const res = await window.electronAPI.movePath(sourcePath, destPath);
        if (res.success) {
          return {
            success: true,
            message: `Movido de ${sourcePath.split('/').pop()} a ${destPath.split('/').pop()}`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al mover',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para mover',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al mover: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Lista el contenido de un directorio
   */
  static async listDirectory(dirPath: string): Promise<ToolResult> {
    try {
      // Usar la API existente de Electron
      if (window.electronAPI && window.electronAPI.readDirectory) {
        const items = await window.electronAPI.readDirectory(dirPath);
        return {
          success: true,
          data: items,
          message: `Directorio listado exitosamente: ${items.length} elementos encontrados`,
        };
      } else {
        return {
          success: false,
          error: 'API de Electron no disponible',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error al listar el directorio: ${error.message}`,
      };
    }
  }

  /**
   * Lista archivos en un directorio con criterios de filtrado flexibles
   */
  static async listFilesByCriteria(
    dirPath: string,
    options: {
      includeDirectories?: boolean;
      includeFiles?: boolean;
      extensions?: string[]; // extensiones a incluir (ej: ['.pdf', '.txt'])
      excludeExtensions?: string[]; // extensiones a excluir (ej: ['.pdf'])
      namePattern?: string; // patrón regex para el nombre
      excludeNamePattern?: string; // patrón regex para excluir nombres
    } = {}
  ): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.readDirectory) {
        const itemsRaw = await window.electronAPI.readDirectory(dirPath);
        const items: FileItem[] = Array.isArray(itemsRaw)
          ? (itemsRaw as FileItem[])
          : [];
        
        const {
          includeDirectories = true,
          includeFiles = true,
          extensions = [],
          excludeExtensions = [],
          namePattern,
          excludeNamePattern
        } = options;

        const filtered = items.filter((item: FileItem) => {
          const lowerName = (item?.name || '').toLowerCase();
          
          // Filtrar por tipo (archivo/directorio)
          if (item.isDirectory && !includeDirectories) return false;
          if (!item.isDirectory && !includeFiles) return false;
          
          // Filtrar por extensiones a incluir
          if (extensions.length > 0 && !item.isDirectory) {
            const hasIncludedExt = extensions.some(ext => 
              lowerName.endsWith(ext.toLowerCase())
            );
            if (!hasIncludedExt) return false;
          }
          
          // Filtrar por extensiones a excluir
          if (excludeExtensions.length > 0 && !item.isDirectory) {
            const hasExcludedExt = excludeExtensions.some(ext => 
              lowerName.endsWith(ext.toLowerCase())
            );
            if (hasExcludedExt) return false;
          }
          
          // Filtrar por patrón de nombre
          if (namePattern) {
            try {
              const regex = new RegExp(namePattern, 'i');
              if (!regex.test(item.name)) return false;
            } catch (e) {
              // Si el patrón regex es inválido, ignorar este filtro
            }
          }
          
          // Excluir por patrón de nombre
          if (excludeNamePattern) {
            try {
              const regex = new RegExp(excludeNamePattern, 'i');
              if (regex.test(item.name)) return false;
            } catch (e) {
              // Si el patrón regex es inválido, ignorar este filtro
            }
          }
          
          return true;
        });

        return {
          success: true,
          data: filtered,
          message: `Archivos encontrados: ${filtered.length} elementos`,
        };
      }
      return { success: false, error: 'API de Electron no disponible' };
    } catch (error) {
      return {
        success: false,
        error: `Error al filtrar archivos: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Elimina múltiples archivos o directorios
   */
  static async deleteMultipleItems(paths: string[]): Promise<ToolResult> {
    try {
      if (!Array.isArray(paths) || paths.length === 0) {
        return {
          success: false,
          error: 'Se requiere un array de rutas no vacío',
        };
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const path of paths) {
        try {
          const result = await this.deleteFileOrDirectory(path);
          results.push({ path, result });
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          results.push({ 
            path, 
            result: { 
              success: false, 
              error: error instanceof Error ? error.message : 'Error desconocido' 
            } 
          });
          errorCount++;
        }
      }

      return {
        success: errorCount === 0,
        data: results,
        message: `Eliminación completada: ${successCount} exitosos, ${errorCount} errores`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error en eliminación múltiple: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }
}

/**
 * Herramientas para trabajar con archivos PDF (simuladas)
 */
export class PDFTools {
  /**
   * Lee el contenido de texto de un archivo PDF
   */
  static async readPDF(filePath: string): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.readPDF) {
        const res = await window.electronAPI.readPDF(filePath);
        if (res.success && res.data) {
          return {
            success: true,
            data: res.data,
            message: `PDF leído: ${filePath.split('/').pop()}`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al leer PDF',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para leer PDF',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al leer el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Realiza OCR en un PDF escaneado
   */
  static async ocrPDF(filePath: string): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.ocrPDF) {
        const res = await window.electronAPI.ocrPDF(filePath);
        if (res.success && res.data) {
          return {
            success: true,
            data: res.data,
            message:
              res.message || `OCR completado en ${filePath.split('/').pop()}`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido en OCR',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para OCR de PDF',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error en OCR: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }
}

/**
 * Herramientas para trabajar con archivos Excel/CSV (simuladas)
 */
export class ExcelTools {
  /**
   * Lee un archivo Excel o CSV
   */
  static async readExcel(
    filePath: string,
    sheetName?: string
  ): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.readExcel) {
        const res = await window.electronAPI.readExcel(filePath, sheetName);
        if (res.success && res.data) {
          const rows = Array.isArray(res.data.data)
            ? res.data.data.length
            : res.data.rowCount;
          return {
            success: true,
            data: res.data,
            message: `Excel leído: hoja ${res.data.currentSheet}, ${rows} filas`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al leer Excel',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para leer Excel',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al leer Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Escribe datos a un archivo Excel
   */
  static async writeExcel(
    filePath: string,
    data: any[],
    sheetName: string = 'Hoja1'
  ): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.writeExcel) {
        const res = await window.electronAPI.writeExcel(
          filePath,
          data,
          sheetName
        );
        if (res.success) {
          return {
            success: true,
            message: `Excel escrito en hoja "${sheetName}"`,
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al escribir Excel',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para escribir Excel',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al escribir Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  /**
   * Modifica un archivo Excel existente
   */
  static async modifyExcel(
    filePath: string,
    modifications: {
      sheetName?: string;
      addRows?: any[];
      updateRows?: { rowIndex: number; data: any }[];
      deleteRows?: number[];
    }
  ): Promise<ToolResult> {
    try {
      if (window.electronAPI && window.electronAPI.modifyExcel) {
        const res = await window.electronAPI.modifyExcel(
          filePath,
          modifications
        );
        if (res.success) {
          return {
            success: true,
            data: res.data,
            message: 'Excel modificado exitosamente',
          };
        }
        return {
          success: false,
          error: res.error || 'Error desconocido al modificar Excel',
        };
      }
      return {
        success: false,
        error: 'API de Electron no disponible para modificar Excel',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al modificar Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }
}

/**
 * Herramientas para gestión de estado de tareas
 */
export class TaskStateTools {
  private static taskContext: TaskContext = {
    state: TaskState.IDLE,
    description: '',
    currentStep: '',
    completedSteps: 0,
    lastAction: '',
    needsConfirmation: false
  };

  /**
   * Consulta el estado actual de la tarea
   */
  static async getTaskState(): Promise<ToolResult> {
    try {
      return {
        success: true,
        data: TaskStateTools.taskContext,
        message: '' // Sin mensaje para evitar spam en el chat
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al obtener estado: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Actualiza el estado de la tarea
   */
  static async updateTaskState(
    state: TaskState,
    description?: string,
    currentStep?: string,
    needsConfirmation?: boolean,
    confirmationMessage?: string,
    error?: string
  ): Promise<ToolResult> {
    try {
      TaskStateTools.taskContext = {
        ...TaskStateTools.taskContext,
        state,
        ...(description && { description }),
        ...(currentStep && { currentStep }),
        ...(needsConfirmation !== undefined && { needsConfirmation }),
        ...(confirmationMessage && { confirmationMessage }),
        ...(error && { error })
      };

      if (state === TaskState.IN_PROGRESS && currentStep) {
        TaskStateTools.taskContext.completedSteps++;
        TaskStateTools.taskContext.lastAction = currentStep;
      }

      let friendlyMessage = '';
      switch (state) {
        case TaskState.IN_PROGRESS:
          friendlyMessage = '🚀 Iniciando tarea...';
          break;
        case TaskState.COMPLETED:
          friendlyMessage = '✅ ¡Tarea completada exitosamente!';
          break;
        case TaskState.FAILED:
          friendlyMessage = '❌ La tarea ha fallado';
          break;
        case TaskState.IDLE:
          friendlyMessage = '⏸️ En espera';
          break;
        default:
          friendlyMessage = `Estado actualizado a: ${state}`;
      }

      return {
        success: true,
        data: TaskStateTools.taskContext,
        message: friendlyMessage
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al actualizar estado: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Marca un paso como completado
   */
  static async completeStep(stepDescription: string): Promise<ToolResult> {
    try {
      TaskStateTools.taskContext.completedSteps++;
      TaskStateTools.taskContext.lastAction = stepDescription;
      TaskStateTools.taskContext.currentStep = '';

      return {
        success: true,
        data: TaskStateTools.taskContext,
        message: `Paso completado: ${stepDescription}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al completar paso: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Reinicia el estado de la tarea
   */
  static async resetTaskState(): Promise<ToolResult> {
    try {
      TaskStateTools.taskContext = {
        state: TaskState.IDLE,
        description: '',
        currentStep: '',
        completedSteps: 0,
        lastAction: '',
        needsConfirmation: false
      };

      return {
        success: true,
        data: TaskStateTools.taskContext,
        message: 'Estado de tarea reiniciado'
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al reiniciar estado: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Obtiene el contexto completo para el LLM
   */
  static getContextForLLM(): TaskContext {
    return { ...TaskStateTools.taskContext };
  }
}

export const AVAILABLE_TOOLS: FileSystemTool[] = [
  {
    name: 'read_text_file',
    description: 'Lee el contenido de un archivo de texto',
    parameters: { filePath: 'string' },
    execute: FileSystemTools.readTextFile,
  },
  {
    name: 'write_text_file',
    description: 'Escribe contenido a un archivo de texto',
    parameters: { filePath: 'string', content: 'string' },
    execute: FileSystemTools.writeTextFile,
  },
  {
    name: 'create_directory',
    description: 'Crea un directorio',
    parameters: { dirPath: 'string' },
    execute: FileSystemTools.createDirectory,
  },
  {
    name: 'delete_file_or_directory',
    description: 'Elimina un archivo o directorio',
    parameters: { targetPath: 'string' },
    execute: FileSystemTools.deleteFileOrDirectory,
  },
  {
    name: 'copy_file_or_directory',
    description: 'Copia un archivo o directorio',
    parameters: { sourcePath: 'string', destPath: 'string' },
    execute: FileSystemTools.copyFileOrDirectory,
  },
  {
    name: 'move_file_or_directory',
    description: 'Mueve un archivo o directorio',
    parameters: { sourcePath: 'string', destPath: 'string' },
    execute: FileSystemTools.moveFileOrDirectory,
  },
  {
    name: 'list_directory',
    description: 'Lista el contenido de un directorio',
    parameters: { dirPath: 'string' },
    execute: FileSystemTools.listDirectory,
  },
  {
    name: 'list_files_by_criteria',
    description: 'Lista archivos en un directorio con criterios de filtrado flexibles (extensiones, patrones, tipo)',
    parameters: { 
      dirPath: 'string', 
      options: 'object?' // { includeDirectories?, includeFiles?, extensions?, excludeExtensions?, namePattern?, excludeNamePattern? }
    },
    execute: (dirPath: string, options?: any) => FileSystemTools.listFilesByCriteria(dirPath, options || {}),
  },
  {
    name: 'delete_multiple_items',
    description: 'Elimina múltiples archivos o directorios de una vez',
    parameters: { paths: 'array' }, // array de strings con las rutas
    execute: (paths: string[]) => FileSystemTools.deleteMultipleItems(paths),
  },
  {
    name: 'read_pdf',
    description: 'USAR SIEMPRE PRIMERO: Lee y extrae texto de cualquier archivo PDF. Esta es la herramienta principal para leer PDFs.',
    parameters: { filePath: 'string' },
    execute: PDFTools.readPDF,
  },
  {
    name: 'ocr_pdf',
    description: 'SOLO usar si read_pdf falla: OCR para PDFs escaneados como imágenes. NO usar para PDFs normales.',
    parameters: { filePath: 'string' },
    execute: PDFTools.ocrPDF,
  },
  {
    name: 'read_excel',
    description: 'Lee un archivo Excel o CSV',
    parameters: { filePath: 'string', sheetName: 'string?' },
    execute: ExcelTools.readExcel,
  },
  {
    name: 'write_excel',
    description: 'Escribe datos a un archivo Excel',
    parameters: { filePath: 'string', data: 'array', sheetName: 'string?' },
    execute: ExcelTools.writeExcel,
  },
  {
    name: 'modify_excel',
    description: 'Modifica un archivo Excel existente',
    parameters: {
      filePath: 'string',
      modifications: 'object',
    },
    execute: ExcelTools.modifyExcel,
  },
  {
    name: 'get_task_state',
    description: 'Obtiene el estado actual de la tarea',
    parameters: {},
    execute: TaskStateTools.getTaskState,
  },
  {
    name: 'update_task_state',
    description: 'Actualiza el estado de la tarea',
    parameters: { 
      state: 'string', // TaskState enum value
      description: 'string?',
      currentStep: 'string?',
      needsConfirmation: 'boolean?',
      confirmationMessage: 'string?',
      error: 'string?'
    },
    execute: (params: any) => 
      TaskStateTools.updateTaskState(
        params.state as TaskState, 
        params.description, 
        params.currentStep, 
        params.needsConfirmation, 
        params.confirmationMessage, 
        params.error
      ),
  },
  {
    name: 'complete_step',
    description: 'Marca un paso como completado',
    parameters: { stepDescription: 'string' },
    execute: TaskStateTools.completeStep,
  },
  {
    name: 'reset_task_state',
    description: 'Reinicia el estado de la tarea',
    parameters: {},
    execute: TaskStateTools.resetTaskState,
  },
];
