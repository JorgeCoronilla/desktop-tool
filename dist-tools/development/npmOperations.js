"use strict";
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
exports.npmOperationsTool = void 0;
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const NpmOperationsSchema = zod_1.z.object({
    operation: zod_1.z.enum(['install', 'uninstall', 'update', 'list', 'search', 'run', 'init', 'audit', 'outdated']).describe('Operación npm a realizar'),
    package: zod_1.z.string().optional().describe('Nombre del paquete (para install, uninstall, search)'),
    script: zod_1.z.string().optional().describe('Nombre del script a ejecutar (para run)'),
    workingDirectory: zod_1.z.string().optional().describe('Directorio donde ejecutar npm'),
    options: zod_1.z.array(zod_1.z.string()).optional().describe('Opciones adicionales para el comando npm'),
    global: zod_1.z.boolean().optional().describe('Instalar globalmente (solo para install)'),
    packages: zod_1.z.array(zod_1.z.string()).optional().describe('Lista de paquetes (para install, uninstall, update)'),
});
exports.npmOperationsTool = {
    name: 'npm_operations',
    description: 'Realiza operaciones npm comunes de forma segura',
    inputSchema: NpmOperationsSchema,
    execute: async (args) => {
        try {
            const { operation, package: packageName, script, workingDirectory = '.', options = [], global = false, packages = [] } = args;
            // Validar que npm esté disponible
            try {
                await new Promise((resolve, reject) => {
                    const child = (0, child_process_1.spawn)('npm', ['--version'], { stdio: 'pipe' });
                    child.on('close', (code) => {
                        if (code === 0)
                            resolve();
                        else
                            reject(new Error('npm no está disponible'));
                    });
                    child.on('error', () => reject(new Error('npm no está disponible')));
                });
            }
            catch (error) {
                throw new Error('npm no está instalado o no está disponible en el PATH');
            }
            // Construir el comando npm
            let npmArgs = [];
            switch (operation) {
                case 'install':
                    npmArgs = ['install'];
                    if (packages.length > 0) {
                        npmArgs.push(...packages);
                    }
                    else if (packageName) {
                        npmArgs.push(packageName);
                    }
                    if (global)
                        npmArgs.push('--global');
                    break;
                case 'uninstall':
                    npmArgs = ['uninstall'];
                    if (packages.length > 0) {
                        npmArgs.push(...packages);
                    }
                    else if (packageName) {
                        npmArgs.push(packageName);
                    }
                    if (global)
                        npmArgs.push('--global');
                    break;
                case 'update':
                    npmArgs = ['update'];
                    if (packages.length > 0) {
                        npmArgs.push(...packages);
                    }
                    else if (packageName) {
                        npmArgs.push(packageName);
                    }
                    if (global)
                        npmArgs.push('--global');
                    break;
                case 'list':
                    npmArgs = ['list'];
                    if (global)
                        npmArgs.push('--global');
                    break;
                case 'search':
                    npmArgs = ['search'];
                    if (packageName) {
                        npmArgs.push(packageName);
                    }
                    else {
                        throw new Error('packageName es requerido para la operación search');
                    }
                    break;
                case 'run':
                    npmArgs = ['run'];
                    if (script) {
                        npmArgs.push(script);
                    }
                    else {
                        throw new Error('script es requerido para la operación run');
                    }
                    break;
                case 'init':
                    npmArgs = ['init', '-y']; // Inicializar con valores por defecto
                    break;
                case 'audit':
                    npmArgs = ['audit'];
                    break;
                case 'outdated':
                    npmArgs = ['outdated'];
                    if (global)
                        npmArgs.push('--global');
                    break;
                default:
                    throw new Error(`Operación npm no soportada: ${operation}`);
            }
            if (options.length > 0) {
                npmArgs.push(...options);
            }
            // Verificar que el directorio existe y tiene package.json (excepto para init)
            if (operation !== 'init') {
                try {
                    await fs.access(workingDirectory);
                }
                catch (error) {
                    throw new Error(`El directorio no existe: ${workingDirectory}`);
                }
                // Verificar que existe package.json (excepto para init)
                const packageJsonPath = path.join(workingDirectory, 'package.json');
                try {
                    await fs.access(packageJsonPath);
                }
                catch (error) {
                    if (operation === 'install' && !packageName && packages.length === 0) {
                        // Para install sin paquetes específicos, se puede ejecutar para instalar dependencias existentes
                    }
                    else {
                        throw new Error(`No se encontró package.json en: ${workingDirectory}`);
                    }
                }
            }
            // Ejecutar el comando npm
            return new Promise((resolve, reject) => {
                const child = (0, child_process_1.spawn)('npm', npmArgs, {
                    cwd: workingDirectory,
                    stdio: 'pipe'
                });
                let stdout = '';
                let stderr = '';
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                child.on('close', (code) => {
                    const result = {
                        success: code === 0,
                        exitCode: code,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        operation,
                        command: `npm ${npmArgs.join(' ')}`,
                        workingDirectory
                    };
                    if (code === 0) {
                        resolve(result);
                    }
                    else {
                        reject(new Error(`npm falló con código ${code}: ${stderr || stdout}`));
                    }
                });
                child.on('error', (error) => {
                    reject(new Error(`Error ejecutando npm: ${error.message}`));
                });
            });
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error en operación npm: ${error.message}`);
            }
            throw new Error('Error desconocido en operación npm');
        }
    }
};
