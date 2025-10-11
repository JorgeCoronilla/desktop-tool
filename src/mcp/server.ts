#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import * as pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';

// Normalizar export de pdf-parse (algunas instalaciones ESM exponen default)
const pdfParseFn: any = (pdfParse as any).default ?? (pdfParse as any);

/**
 * Desktop Helper MCP Server
 * Proporciona herramientas para gestión de archivos y documentos
 */

const server = new Server(
  {
    name: 'desktop-helper',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Herramientas disponibles
const tools: Tool[] = [
  {
    name: 'read_text_file',
    description: 'Lee el contenido de un archivo de texto',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo a leer',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'write_text_file',
    description: 'Escribe contenido a un archivo de texto',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo a escribir',
        },
        content: {
          type: 'string',
          description: 'Contenido a escribir en el archivo',
        },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'create_directory',
    description: 'Crea un directorio',
    inputSchema: {
      type: 'object',
      properties: {
        dirPath: {
          type: 'string',
          description: 'Ruta del directorio a crear',
        },
      },
      required: ['dirPath'],
    },
  },
  {
    name: 'delete_file_or_directory',
    description: 'Elimina un archivo o directorio',
    inputSchema: {
      type: 'object',
      properties: {
        targetPath: {
          type: 'string',
          description: 'Ruta del archivo o directorio a eliminar',
        },
      },
      required: ['targetPath'],
    },
  },
  {
    name: 'list_directory',
    description: 'Lista el contenido de un directorio',
    inputSchema: {
      type: 'object',
      properties: {
        dirPath: {
          type: 'string',
          description: 'Ruta del directorio a listar',
        },
      },
      required: ['dirPath'],
    },
  },
  {
    name: 'copy_file_or_directory',
    description: 'Copia un archivo o directorio',
    inputSchema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Ruta de origen',
        },
        destPath: {
          type: 'string',
          description: 'Ruta de destino',
        },
      },
      required: ['sourcePath', 'destPath'],
    },
  },
  {
    name: 'move_file_or_directory',
    description: 'Mueve un archivo o directorio',
    inputSchema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Ruta de origen',
        },
        destPath: {
          type: 'string',
          description: 'Ruta de destino',
        },
      },
      required: ['sourcePath', 'destPath'],
    },
  },
  {
    name: 'list_files_by_criteria',
    description: 'Lista archivos en un directorio con criterios de filtrado flexibles (extensiones, patrones, tipo)',
    inputSchema: {
      type: 'object',
      properties: {
        dirPath: {
          type: 'string',
          description: 'Ruta del directorio a listar',
        },
        options: {
          type: 'object',
          description: 'Opciones de filtrado',
          properties: {
            includeDirectories: {
              type: 'boolean',
              description: 'Incluir directorios en el resultado',
            },
            includeFiles: {
              type: 'boolean',
              description: 'Incluir archivos en el resultado',
            },
            extensions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Extensiones a incluir (ej: [".pdf", ".txt"])',
            },
            excludeExtensions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Extensiones a excluir',
            },
            namePattern: {
              type: 'string',
              description: 'Patrón regex para el nombre',
            },
            excludeNamePattern: {
              type: 'string',
              description: 'Patrón regex para excluir nombres',
            },
          },
        },
      },
      required: ['dirPath'],
    },
  },
  {
    name: 'delete_multiple_items',
    description: 'Elimina múltiples archivos o directorios de una vez',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array de rutas de archivos o directorios a eliminar',
        },
      },
      required: ['paths'],
    },
  },
  {
    name: 'read_pdf',
    description: 'Lee el contenido de texto de un archivo PDF',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo PDF a leer',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'ocr_pdf',
    description: 'Realiza OCR en un PDF escaneado',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo PDF para OCR',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'read_excel',
    description: 'Lee un archivo Excel o CSV',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo Excel o CSV',
        },
        sheetName: {
          type: 'string',
          description: 'Nombre de la hoja (opcional)',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'write_excel',
    description: 'Escribe datos a un archivo Excel',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo Excel a crear',
        },
        data: {
          type: 'array',
          description: 'Datos a escribir (array de objetos)',
        },
        sheetName: {
          type: 'string',
          description: 'Nombre de la hoja (opcional, por defecto "Hoja1")',
        },
      },
      required: ['filePath', 'data'],
    },
  },
  {
    name: 'modify_excel',
    description: 'Modifica un archivo Excel existente',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo Excel a modificar',
        },
        modifications: {
          type: 'object',
          description: 'Modificaciones a realizar',
          properties: {
            sheetName: {
              type: 'string',
              description: 'Nombre de la hoja',
            },
            addRows: {
              type: 'array',
              description: 'Filas a agregar',
            },
            updateRows: {
              type: 'array',
              description: 'Filas a actualizar',
            },
            deleteRows: {
              type: 'array',
              items: { type: 'number' },
              description: 'Índices de filas a eliminar',
            },
          },
        },
      },
      required: ['filePath', 'modifications'],
    },
  },
];

// Handler para listar herramientas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handler para ejecutar herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'read_text_file':
        return await readTextFile(args.filePath as string);

      case 'write_text_file':
        return await writeTextFile(args.filePath as string, args.content as string);

      case 'create_directory':
        return await createDirectory(args.dirPath as string);

      case 'delete_file_or_directory':
        return await deleteFileOrDirectory(args.targetPath as string);

      case 'list_directory':
        return await listDirectory(args.dirPath as string);

      case 'copy_file_or_directory':
        return await copyFileOrDirectory(args.sourcePath as string, args.destPath as string);

      case 'move_file_or_directory':
        return await moveFileOrDirectory(args.sourcePath as string, args.destPath as string);

      case 'list_files_by_criteria':
        return await listFilesByCriteria(args.dirPath as string, args.options || {});

      case 'delete_multiple_items':
        return await deleteMultipleItems(args.paths as string[]);

      case 'read_pdf':
        return await readPDF(args.filePath as string);

      case 'ocr_pdf':
        return await ocrPDF(args.filePath as string);

      case 'read_excel':
        return await readExcel(args.filePath as string, args.sheetName as string);

      case 'write_excel':
        return await writeExcel(args.filePath as string, args.data as any[], args.sheetName as string);

      case 'modify_excel':
        return await modifyExcel(args.filePath as string, args.modifications as any);

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Implementaciones de las herramientas
async function readTextFile(filePath: string): Promise<CallToolResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      content: [
        {
          type: 'text',
          text: `📄 Contenido de "${path.basename(filePath)}":\n\n${content}`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo leer el archivo: ${error.message}`);
  }
}

async function writeTextFile(filePath: string, content: string): Promise<CallToolResult> {
  try {
    // Crear directorio padre si no existe
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, content, 'utf-8');
    return {
      content: [
        {
          type: 'text',
          text: `📄 Archivo "${path.basename(filePath)}" creado exitosamente`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo escribir el archivo: ${error.message}`);
  }
}

async function createDirectory(dirPath: string): Promise<CallToolResult> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return {
      content: [
        {
          type: 'text',
          text: `📁 Directorio "${path.basename(dirPath)}" creado exitosamente`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo crear el directorio: ${error.message}`);
  }
}

async function deleteFileOrDirectory(targetPath: string): Promise<CallToolResult> {
  try {
    if (!existsSync(targetPath)) {
      throw new Error('El archivo o directorio no existe');
    }

    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      await fs.rmdir(targetPath, { recursive: true });
      return {
        content: [
          {
            type: 'text',
            text: `🗑️ Directorio "${path.basename(targetPath)}" eliminado exitosamente`,
          },
        ],
      };
    } else {
      await fs.unlink(targetPath);
      return {
        content: [
          {
            type: 'text',
            text: `🗑️ Archivo "${path.basename(targetPath)}" eliminado exitosamente`,
          },
        ],
      };
    }
  } catch (error) {
    throw new Error(`No se pudo eliminar: ${error.message}`);
  }
}

async function listDirectory(dirPath: string): Promise<CallToolResult> {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const itemList = items.map(item => {
      const icon = item.isDirectory() ? '📁' : '📄';
      return `${icon} ${item.name}`;
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `📂 Contenido de "${path.basename(dirPath)}":\n\n${itemList}`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo listar el directorio: ${error.message}`);
  }
}

async function copyFileOrDirectory(sourcePath: string, destPath: string): Promise<CallToolResult> {
  try {
    await fs.cp(sourcePath, destPath, { recursive: true });
    return {
      content: [
        {
          type: 'text',
          text: `📋 "${path.basename(sourcePath)}" copiado a "${path.basename(destPath)}" exitosamente`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo copiar: ${error.message}`);
  }
}

async function moveFileOrDirectory(sourcePath: string, destPath: string): Promise<CallToolResult> {
  try {
    await fs.rename(sourcePath, destPath);
    return {
      content: [
        {
          type: 'text',
          text: `📦 "${path.basename(sourcePath)}" movido a "${path.basename(destPath)}" exitosamente`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo mover: ${error.message}`);
  }
}

// Nuevas herramientas migradas

async function listFilesByCriteria(
  dirPath: string,
  options: {
    includeDirectories?: boolean;
    includeFiles?: boolean;
    extensions?: string[];
    excludeExtensions?: string[];
    namePattern?: string;
    excludeNamePattern?: string;
  } = {}
): Promise<CallToolResult> {
  try {
    if (!existsSync(dirPath)) {
      throw new Error('El directorio no existe');
    }

    const {
      includeDirectories = true,
      includeFiles = true,
      extensions = [],
      excludeExtensions = [],
      namePattern,
      excludeNamePattern,
    } = options;

    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const filteredItems = [];

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      const isDirectory = item.isDirectory();

      // Filtrar por tipo
      if (isDirectory && !includeDirectories) continue;
      if (!isDirectory && !includeFiles) continue;

      // Filtrar por extensión
      if (!isDirectory) {
        const ext = path.extname(item.name).toLowerCase();
        if (extensions.length > 0 && !extensions.includes(ext)) continue;
        if (excludeExtensions.length > 0 && excludeExtensions.includes(ext)) continue;
      }

      // Filtrar por patrón de nombre
      if (namePattern) {
        const regex = new RegExp(namePattern, 'i');
        if (!regex.test(item.name)) continue;
      }

      if (excludeNamePattern) {
        const regex = new RegExp(excludeNamePattern, 'i');
        if (regex.test(item.name)) continue;
      }

      filteredItems.push({
        name: item.name,
        path: itemPath,
        isDirectory,
      });
    }

    const itemList = filteredItems
      .map(item => `${item.isDirectory ? '📁' : '📄'} ${item.name}`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Archivos filtrados en "${path.basename(dirPath)}" (${filteredItems.length} elementos):\n\n${itemList}`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo filtrar archivos: ${error.message}`);
  }
}

async function deleteMultipleItems(paths: string[]): Promise<CallToolResult> {
  try {
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const targetPath of paths) {
      try {
        if (!existsSync(targetPath)) {
          results.push(`❌ "${path.basename(targetPath)}" - No existe`);
          errorCount++;
          continue;
        }

        const stats = await fs.stat(targetPath);
        if (stats.isDirectory()) {
          await fs.rmdir(targetPath, { recursive: true });
          results.push(`🗑️ Directorio "${path.basename(targetPath)}" eliminado`);
        } else {
          await fs.unlink(targetPath);
          results.push(`🗑️ Archivo "${path.basename(targetPath)}" eliminado`);
        }
        successCount++;
      } catch (error) {
        results.push(`❌ "${path.basename(targetPath)}" - Error: ${error.message}`);
        errorCount++;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `📊 Eliminación masiva completada:\n✅ Exitosos: ${successCount}\n❌ Errores: ${errorCount}\n\n${results.join('\n')}`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Error en eliminación masiva: ${error.message}`);
  }
}

async function readPDF(filePath: string): Promise<CallToolResult> {
  try {
    if (!existsSync(filePath)) {
      throw new Error('El archivo PDF no existe');
    }

    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParseFn(dataBuffer);

    return {
      content: [
        {
          type: 'text',
          text: `📄 Contenido del PDF "${path.basename(filePath)}":\n\n${data.text}`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo leer el PDF: ${error.message}`);
  }
}

async function ocrPDF(filePath: string): Promise<CallToolResult> {
  try {
    if (!existsSync(filePath)) {
      throw new Error('El archivo PDF no existe');
    }

    // Crear worker de Tesseract
    const worker = await createWorker('spa');

    try {
      // Primero intentamos leer el PDF normalmente
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParseFn(dataBuffer);

      // Si tiene texto, lo devolvemos
      if (data.text && data.text.trim().length > 0) {
        await worker.terminate();
        return {
          content: [
            {
              type: 'text',
              text: `📄 Texto extraído del PDF "${path.basename(filePath)}":\n\n${data.text}`,
            },
          ],
        };
      }

      // Si no tiene texto, necesitaríamos convertir a imagen y hacer OCR
      // Por simplicidad, devolvemos un mensaje indicando que es un PDF escaneado
      await worker.terminate();
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ El PDF "${path.basename(filePath)}" parece ser escaneado. Para OCR completo se requiere conversión a imagen.`,
          },
        ],
      };
    } catch (ocrError) {
      await worker.terminate();
      throw ocrError;
    }
  } catch (error) {
    throw new Error(`No se pudo procesar el PDF para OCR: ${error.message}`);
  }
}

async function readExcel(filePath: string, sheetName?: string): Promise<CallToolResult> {
  try {
    if (!existsSync(filePath)) {
      throw new Error('El archivo Excel no existe');
    }

    const workbook = XLSX.readFile(filePath);
    const targetSheet = sheetName || workbook.SheetNames[0];

    if (!workbook.Sheets[targetSheet]) {
      throw new Error(`La hoja "${targetSheet}" no existe`);
    }

    const worksheet = workbook.Sheets[targetSheet];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Formatear los datos para mostrar
    const formattedData = jsonData
      .map((row: any[], index) => `Fila ${index + 1}: ${row.join(' | ')}`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `📊 Contenido de Excel "${path.basename(filePath)}" - Hoja: ${targetSheet}\n\n${formattedData}`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo leer el archivo Excel: ${error.message}`);
  }
}

async function writeExcel(filePath: string, data: any[], sheetName: string = 'Hoja1'): Promise<CallToolResult> {
  try {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filePath);

    return {
      content: [
        {
          type: 'text',
          text: `📊 Archivo Excel "${path.basename(filePath)}" creado exitosamente con ${data.length} filas`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo escribir el archivo Excel: ${error.message}`);
  }
}

async function modifyExcel(filePath: string, modifications: any): Promise<CallToolResult> {
  try {
    if (!existsSync(filePath)) {
      throw new Error('El archivo Excel no existe');
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = modifications.sheetName || workbook.SheetNames[0];
    
    if (!workbook.Sheets[sheetName]) {
      throw new Error(`La hoja "${sheetName}" no existe`);
    }

    const worksheet = workbook.Sheets[sheetName];
    let jsonData = XLSX.utils.sheet_to_json(worksheet);

    // Aplicar modificaciones
    if (modifications.addRows) {
      jsonData = jsonData.concat(modifications.addRows);
    }

    if (modifications.updateRows) {
      modifications.updateRows.forEach((update: any) => {
        if (update.rowIndex < jsonData.length) {
          jsonData[update.rowIndex] = Object.assign({}, jsonData[update.rowIndex], update.data);
        }
      });
    }

    if (modifications.deleteRows) {
      // Ordenar índices en orden descendente para eliminar correctamente
      const sortedIndices = modifications.deleteRows.sort((a: number, b: number) => b - a);
      sortedIndices.forEach((index: number) => {
        if (index < jsonData.length) {
          jsonData.splice(index, 1);
        }
      });
    }

    // Crear nueva hoja con datos modificados
    const newWorksheet = XLSX.utils.json_to_sheet(jsonData);
    workbook.Sheets[sheetName] = newWorksheet;
    XLSX.writeFile(workbook, filePath);

    return {
      content: [
        {
          type: 'text',
          text: `📊 Archivo Excel "${path.basename(filePath)}" modificado exitosamente`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`No se pudo modificar el archivo Excel: ${error.message}`);
  }
}

// Iniciar el servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Desktop Helper MCP Server iniciado');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  });
}