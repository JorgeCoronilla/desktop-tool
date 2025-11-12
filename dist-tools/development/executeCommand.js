"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCommandTool = void 0;
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const util_1 = require("util");
const child_process_2 = require("child_process");
const exec = (0, util_1.promisify)(child_process_2.exec);
const ExecuteCommandSchema = zod_1.z.object({
    command: zod_1.z.string().describe('Comando a ejecutar'),
    args: zod_1.z.array(zod_1.z.string()).optional().describe('Argumentos del comando'),
    workingDirectory: zod_1.z
        .string()
        .optional()
        .describe('Directorio de trabajo para ejecutar el comando'),
    timeout: zod_1.z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Tiempo máximo de ejecución en milisegundos (default: 30000)'),
    shell: zod_1.z
        .boolean()
        .optional()
        .describe('Si usar shell para ejecutar el comando (default: false)'),
});
exports.executeCommandTool = {
    name: 'execute_command',
    description: 'Ejecuta comandos del sistema operativo de forma segura',
    inputSchema: ExecuteCommandSchema,
    execute: async (args) => {
        try {
            const { command, args: commandArgs = [], workingDirectory, timeout = 30000, shell = false, } = args;
            // Validaciones de seguridad
            const dangerousCommands = [
                'rm',
                'del',
                'format',
                'sudo',
                'su',
                'chmod',
                'chown',
                'shutdown',
                'reboot',
                'mkfs',
                'dd',
            ];
            const commandToCheck = command.toLowerCase().trim();
            if (dangerousCommands.some(dangerous => commandToCheck.includes(dangerous))) {
                throw new Error(`Comando potencialmente peligroso detectado: ${command}`);
            }
            // Construir el comando completo
            let fullCommand;
            if (shell) {
                fullCommand = `${command} ${commandArgs.join(' ')}`.trim();
            }
            else {
                fullCommand = command;
            }
            // Opciones de ejecución
            const execOptions = {
                timeout,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024, // 1MB buffer
            };
            if (workingDirectory) {
                execOptions.cwd = workingDirectory;
            }
            if (commandArgs.length > 0 && !shell) {
                // Usar spawn para mayor control cuando hay argumentos
                return new Promise((resolve, reject) => {
                    const child = (0, child_process_1.spawn)(command, commandArgs, {
                        cwd: workingDirectory,
                        timeout,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                    let stdout = '';
                    let stderr = '';
                    child.stdout.on('data', (data) => {
                        stdout += data.toString();
                    });
                    child.stderr.on('data', (data) => {
                        stderr += data.toString();
                    });
                    child.on('close', code => {
                        const result = {
                            success: code === 0,
                            exitCode: code,
                            stdout: stdout ? stdout.trim() : '',
                            stderr: stderr ? stderr.trim() : '',
                            command: `${command} ${commandArgs.join(' ')}`.trim(),
                        };
                        if (code === 0) {
                            resolve(result);
                        }
                        else {
                            reject(new Error(`Comando falló con código ${code}: ${stderr || stdout || 'Sin mensaje de error'}`));
                        }
                    });
                    child.on('error', error => {
                        reject(new Error(`Error ejecutando comando: ${error.message}`));
                    });
                });
            }
            else {
                // Usar exec para comandos simples o cuando se usa shell
                const { stdout, stderr } = await exec(fullCommand, execOptions);
                return {
                    success: true,
                    exitCode: 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    command: fullCommand,
                };
            }
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('timeout')) {
                    throw new Error(`El comando excedió el tiempo límite de ${args.timeout}ms`);
                }
                if (error.message.includes('ENOENT')) {
                    throw new Error(`Comando no encontrado: ${args.command}`);
                }
                throw new Error(`Error ejecutando comando: ${error.message}`);
            }
            throw new Error('Error desconocido ejecutando comando');
        }
    },
};
