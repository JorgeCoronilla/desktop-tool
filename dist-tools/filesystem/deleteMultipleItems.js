"use strict";
/**
 * Herramienta para eliminar múltiples elementos
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
exports.deleteMultipleItemsTool = void 0;
const fs = __importStar(require("fs"));
exports.deleteMultipleItemsTool = {
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
    execute: async (args) => {
        try {
            const results = [];
            for (const path of args.paths) {
                try {
                    await fs.promises.rm(path, { recursive: true, force: true });
                    results.push({
                        path: path,
                        success: true,
                        message: 'Elemento eliminado exitosamente'
                    });
                }
                catch (error) {
                    results.push({
                        path: path,
                        success: false,
                        error: error instanceof Error ? error.message : 'Error desconocido',
                    });
                }
            }
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            results: results,
                            summary: {
                                total: args.paths.length,
                                successful: successful,
                                failed: failed
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
                            error: error instanceof Error ? error.message : 'Error desconocido al eliminar múltiples elementos'
                        }, null, 2)
                    }]
            };
        }
    }
};
