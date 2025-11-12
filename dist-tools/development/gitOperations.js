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
exports.gitOperationsTool = void 0;
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const GitOperationsSchema = zod_1.z.object({
    operation: zod_1.z.enum(['status', 'log', 'diff', 'branch', 'add', 'commit', 'push', 'pull', 'clone', 'init']).describe('Operación Git a realizar'),
    repositoryPath: zod_1.z.string().optional().describe('Ruta del repositorio Git'),
    options: zod_1.z.array(zod_1.z.string()).optional().describe('Opciones adicionales para el comando Git'),
    message: zod_1.z.string().optional().describe('Mensaje para commit'),
    branch: zod_1.z.string().optional().describe('Nombre de la rama'),
    remote: zod_1.z.string().optional().describe('Nombre del remoto'),
    remoteUrl: zod_1.z.string().optional().describe('URL del repositorio remoto'),
    files: zod_1.z.array(zod_1.z.string()).optional().describe('Archivos para operaciones de add/commit'),
});
exports.gitOperationsTool = {
    name: 'git_operations',
    description: 'Realiza operaciones Git comunes de forma segura',
    inputSchema: GitOperationsSchema,
    execute: async (args) => {
        try {
            const { operation, repositoryPath = '.', options = [], message, branch, remote = 'origin', remoteUrl, files = [] } = args;
            // Validar que git esté disponible
            try {
                await new Promise((resolve, reject) => {
                    const child = (0, child_process_1.spawn)('git', ['--version'], { stdio: 'pipe' });
                    child.on('close', (code) => {
                        if (code === 0)
                            resolve();
                        else
                            reject(new Error('Git no está disponible'));
                    });
                    child.on('error', () => reject(new Error('Git no está disponible')));
                });
            }
            catch (error) {
                throw new Error('Git no está instalado o no está disponible en el PATH');
            }
            // Construir el comando Git
            let gitArgs = [];
            let workingDir = repositoryPath;
            switch (operation) {
                case 'status':
                    gitArgs = ['status'];
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                case 'log':
                    gitArgs = ['log', '--oneline', '-10'];
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                case 'diff':
                    gitArgs = ['diff'];
                    if (files.length > 0)
                        gitArgs.push(...files);
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                case 'branch':
                    if (branch) {
                        gitArgs = ['branch', branch];
                    }
                    else {
                        gitArgs = ['branch', '-a'];
                    }
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                case 'add':
                    gitArgs = ['add'];
                    if (files.length > 0) {
                        gitArgs.push(...files);
                    }
                    else {
                        gitArgs.push('.');
                    }
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                case 'commit':
                    gitArgs = ['commit'];
                    if (message) {
                        gitArgs.push('-m', message);
                    }
                    if (files.length > 0) {
                        gitArgs.push(...files);
                    }
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                case 'push':
                    gitArgs = ['push'];
                    if (remote)
                        gitArgs.push(remote);
                    if (branch)
                        gitArgs.push(branch);
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                case 'pull':
                    gitArgs = ['pull'];
                    if (remote)
                        gitArgs.push(remote);
                    if (branch)
                        gitArgs.push(branch);
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                case 'clone':
                    if (!remoteUrl) {
                        throw new Error('remoteUrl es requerido para la operación clone');
                    }
                    gitArgs = ['clone', remoteUrl];
                    if (options.length > 0)
                        gitArgs.push(...options);
                    // Para clone, el workingDir es el directorio padre
                    workingDir = path.dirname(repositoryPath);
                    break;
                case 'init':
                    gitArgs = ['init'];
                    if (options.length > 0)
                        gitArgs.push(...options);
                    break;
                default:
                    throw new Error(`Operación Git no soportada: ${operation}`);
            }
            // Verificar que el directorio existe (excepto para clone e init)
            if (operation !== 'clone' && operation !== 'init') {
                try {
                    await fs.access(workingDir);
                }
                catch (error) {
                    throw new Error(`El directorio no existe: ${workingDir}`);
                }
                // Verificar que es un repositorio Git válido (excepto para init)
                if (operation !== 'init') {
                    const gitDir = path.join(workingDir, '.git');
                    try {
                        await fs.access(gitDir);
                    }
                    catch (error) {
                        throw new Error(`No es un repositorio Git válido: ${workingDir}`);
                    }
                }
            }
            // Ejecutar el comando Git
            return new Promise((resolve, reject) => {
                const child = (0, child_process_1.spawn)('git', gitArgs, {
                    cwd: workingDir,
                    stdio: 'pipe',
                    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } // Deshabilitar prompts interactivos
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
                        command: `git ${gitArgs.join(' ')}`,
                        workingDirectory: workingDir
                    };
                    if (code === 0) {
                        resolve(result);
                    }
                    else {
                        reject(new Error(`Git falló con código ${code}: ${stderr || stdout}`));
                    }
                });
                child.on('error', (error) => {
                    reject(new Error(`Error ejecutando Git: ${error.message}`));
                });
            });
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error en operación Git: ${error.message}`);
            }
            throw new Error('Error desconocido en operación Git');
        }
    }
};
