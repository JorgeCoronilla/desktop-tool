"use strict";
/**
 * Herramienta para listar archivos por criterios
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFilesByCriteriaTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.listFilesByCriteriaTool = {
    name: 'list_files_by_criteria',
    description: 'Lista archivos que coinciden con criterios específicos',
    inputSchema: {
        type: 'object',
        properties: {
            dirPath: {
                type: 'string',
                description: 'Directorio base para buscar',
            },
            extension: {
                type: 'string',
                description: 'Extensión de archivo (opcional)',
            },
            namePattern: {
                type: 'string',
                description: 'Patrón en el nombre (opcional)',
            },
            recursive: {
                type: 'boolean',
                description: 'Búsqueda recursiva (opcional)',
            },
        },
        required: ['dirPath'],
    },
    execute: async (args) => {
        try {
            const files = [];
            const searchDir = async (dir) => {
                const items = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory() && args.recursive) {
                        await searchDir(fullPath);
                    }
                    else if (item.isFile()) {
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
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            dirPath: args.dirPath,
                            files: files,
                            totalFiles: files.length,
                            criteria: {
                                extension: args.extension,
                                namePattern: args.namePattern,
                                recursive: args.recursive
                            }
                        }, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Error desconocido al listar archivos por criterios'
                        }, null, 2)
                    }]
            };
        }
    }
};
