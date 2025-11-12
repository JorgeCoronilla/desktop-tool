"use strict";
/**
 * Herramienta para crear directorios
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
exports.createDirectoryTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.createDirectoryTool = {
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
    execute: async (args) => {
        try {
            let finalPath = args.dirPath;
            // Si se proporciona un directorio actual y la ruta no es absoluta, usar el directorio actual
            if (args._options?.cwd && !path.isAbsolute(args.dirPath)) {
                finalPath = path.join(args._options.cwd, args.dirPath);
            }
            await fs.promises.mkdir(finalPath, { recursive: true });
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            dirPath: finalPath,
                            message: `Directorio creado exitosamente: ${finalPath}`
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
                            error: error instanceof Error ? error.message : 'Error desconocido al crear directorio'
                        }, null, 2)
                    }]
            };
        }
    }
};
