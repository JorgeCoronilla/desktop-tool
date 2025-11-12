"use strict";
/**
 * Herramienta para eliminar archivos o directorios
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
exports.deleteFileOrDirectoryTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.deleteFileOrDirectoryTool = {
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
    execute: async (args) => {
        try {
            let finalPath = args.targetPath;
            // Si se proporciona un directorio actual y la ruta no es absoluta, usar el directorio actual
            if (args._options?.cwd && !path.isAbsolute(args.targetPath)) {
                finalPath = path.join(args._options.cwd, args.targetPath);
            }
            await fs.promises.rm(finalPath, { recursive: true, force: true });
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            targetPath: finalPath,
                            message: `Archivo o directorio eliminado exitosamente: ${finalPath}`
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
                            error: error instanceof Error ? error.message : 'Error desconocido al eliminar archivo o directorio'
                        }, null, 2)
                    }]
            };
        }
    }
};
