"use strict";
/**
 * Herramienta para mover archivos o directorios
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
exports.moveFileOrDirectoryTool = void 0;
const fs = __importStar(require("fs"));
exports.moveFileOrDirectoryTool = {
    name: 'move_file_or_directory',
    description: 'Mueve un archivo o directorio',
    inputSchema: {
        type: 'object',
        properties: {
            sourcePath: { type: 'string', description: 'Ruta de origen' },
            destPath: { type: 'string', description: 'Ruta de destino' },
        },
        required: ['sourcePath', 'destPath'],
    },
    execute: async (args) => {
        try {
            await fs.promises.rename(args.sourcePath, args.destPath);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            sourcePath: args.sourcePath,
                            destPath: args.destPath,
                            message: `Archivo o directorio movido exitosamente de ${args.sourcePath} a ${args.destPath}`
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
                            error: error instanceof Error ? error.message : 'Error desconocido al mover archivo o directorio'
                        }, null, 2)
                    }]
            };
        }
    }
};
