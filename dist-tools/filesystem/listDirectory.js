"use strict";
/**
 * Herramienta para listar directorios
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
exports.listDirectoryTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.listDirectoryTool = {
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
    execute: async (args) => {
        try {
            const items = await fs.promises.readdir(args.dirPath, {
                withFileTypes: true,
            });
            const files = items.map(item => ({
                name: item.name,
                isDirectory: item.isDirectory(),
                path: path.join(args.dirPath, item.name),
            }));
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            dirPath: args.dirPath,
                            files: files,
                            totalItems: files.length,
                            directories: files.filter(f => f.isDirectory).length,
                            filesCount: files.filter(f => !f.isDirectory).length
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
                            error: error instanceof Error ? error.message : 'Error desconocido al listar directorio'
                        }, null, 2)
                    }]
            };
        }
    }
};
