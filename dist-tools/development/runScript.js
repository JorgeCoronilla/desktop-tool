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
exports.runScriptTool = void 0;
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const RunScriptSchema = zod_1.z.object({
    script: zod_1.z.string().describe('Contenido del script a ejecutar'),
    language: zod_1.z.enum(['javascript', 'python', 'bash', 'shell', 'powershell', 'cmd']).describe('Lenguaje del script'),
    workingDirectory: zod_1.z.string().optional().describe('Directorio de trabajo para ejecutar el script'),
    timeout: zod_1.z.number().int().positive().optional().describe('Tiempo máximo de ejecución en milisegundos (default: 60000)'),
    args: zod_1.z.array(zod_1.z.string()).optional().describe('Argumentos adicionales para el script'),
    environmentVariables: zod_1.z.record(zod_1.z.string()).optional().describe('Variables de entorno adicionales'),
});
exports.runScriptTool = {
    name: 'run_script',
    description: 'Ejecuta scripts en diferentes lenguajes de forma segura',
    inputSchema: RunScriptSchema,
    execute: async (args) => {
        try {
            const { script, language, workingDirectory, timeout = 60000, args: scriptArgs = [], environmentVariables = {} } = args;
            // Validaciones de seguridad básicas
            if (script.length > 100000) { // 100KB límite
                throw new Error('El script excede el tamaño máximo permitido de 100KB');
            }
            // Detectar comandos peligrosos
            const dangerousPatterns = [
                /rm\s+-rf\s*\//i,
                /format\s+[a-zA-Z]:/i,
                /sudo\s+/i,
                /shutdown\s+/i,
                /reboot/i,
                /mkfs/i,
                /dd\s+if=/i
            ];
            if (dangerousPatterns.some(pattern => pattern.test(script))) {
                throw new Error('Patrones peligrosos detectados en el script');
            }
            // Configurar el intérprete según el lenguaje
            let interpreter;
            let fileExtension;
            let command;
            let commandArgs = [];
            switch (language) {
                case 'javascript':
                    interpreter = 'node';
                    fileExtension = '.js';
                    break;
                case 'python':
                    interpreter = 'python3';
                    fileExtension = '.py';
                    break;
                case 'bash':
                case 'shell':
                    interpreter = 'bash';
                    fileExtension = '.sh';
                    command = 'bash';
                    break;
                case 'powershell':
                    interpreter = 'powershell';
                    fileExtension = '.ps1';
                    command = 'powershell';
                    commandArgs = ['-File'];
                    break;
                case 'cmd':
                    interpreter = 'cmd';
                    fileExtension = '.bat';
                    command = 'cmd';
                    commandArgs = ['/c'];
                    break;
                default:
                    throw new Error(`Lenguaje no soportado: ${language}`);
            }
            // Crear archivo temporal
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'script-'));
            const scriptFile = path.join(tempDir, `script${fileExtension}`);
            // Escribir el script
            await fs.writeFile(scriptFile, script, 'utf8');
            // Hacer ejecutable el script si es necesario
            if (language === 'bash' || language === 'shell') {
                await fs.chmod(scriptFile, 0o755);
            }
            try {
                // Preparar el comando a ejecutar
                let finalCommand;
                let finalArgs = [];
                if (language === 'bash' || language === 'shell') {
                    finalCommand = command;
                    finalArgs = [scriptFile, ...scriptArgs];
                }
                else if (language === 'javascript') {
                    finalCommand = interpreter;
                    finalArgs = [scriptFile, ...scriptArgs];
                }
                else if (language === 'python') {
                    finalCommand = interpreter;
                    finalArgs = [scriptFile, ...scriptArgs];
                }
                else if (language === 'powershell') {
                    finalCommand = command;
                    finalArgs = [...commandArgs, scriptFile, ...scriptArgs];
                }
                else if (language === 'cmd') {
                    finalCommand = command;
                    finalArgs = [...commandArgs, scriptFile, ...scriptArgs];
                }
                else {
                    finalCommand = interpreter;
                    finalArgs = [scriptFile, ...scriptArgs];
                }
                // Ejecutar el script
                return new Promise((resolve, reject) => {
                    const child = (0, child_process_1.spawn)(finalCommand, finalArgs, {
                        cwd: workingDirectory || tempDir,
                        timeout,
                        env: { ...process.env, ...environmentVariables },
                        stdio: ['pipe', 'pipe', 'pipe']
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
                            language,
                            script: script.length > 100 ? script.substring(0, 100) + '...' : script
                        };
                        if (code === 0) {
                            resolve(result);
                        }
                        else {
                            reject(new Error(`Script falló con código ${code}: ${stderr || stdout}`));
                        }
                    });
                    child.on('error', (error) => {
                        reject(new Error(`Error ejecutando script: ${error.message}`));
                    });
                });
            }
            finally {
                // Limpiar archivo temporal
                try {
                    await fs.unlink(scriptFile);
                    await fs.rmdir(tempDir);
                }
                catch (cleanupError) {
                    console.warn('Error limpiando archivos temporales:', cleanupError);
                }
            }
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('timeout')) {
                    throw new Error(`El script excedió el tiempo límite de ${args.timeout}ms`);
                }
                if (error.message.includes('ENOENT')) {
                    throw new Error(`Intérprete no encontrado: ${args.language}`);
                }
                throw new Error(`Error ejecutando script: ${error.message}`);
            }
            throw new Error('Error desconocido ejecutando script');
        }
    }
};
