import { z } from 'zod';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

const GitOperationsSchema = z.object({
  operation: z.enum(['status', 'log', 'diff', 'branch', 'add', 'commit', 'push', 'pull', 'clone', 'init']).describe('Operación Git a realizar'),
  repositoryPath: z.string().optional().describe('Ruta del repositorio Git'),
  options: z.array(z.string()).optional().describe('Opciones adicionales para el comando Git'),
  message: z.string().optional().describe('Mensaje para commit'),
  branch: z.string().optional().describe('Nombre de la rama'),
  remote: z.string().optional().describe('Nombre del remoto'),
  remoteUrl: z.string().optional().describe('URL del repositorio remoto'),
  files: z.array(z.string()).optional().describe('Archivos para operaciones de add/commit'),
});

export const gitOperationsTool = {
  name: 'git_operations',
  description: 'Realiza operaciones Git comunes de forma segura',
  inputSchema: GitOperationsSchema,
  execute: async (args) => {
    try {
      const { operation, repositoryPath = '.', options = [], message, branch, remote = 'origin', remoteUrl, files = [] } = args;
      
      // Validar que git esté disponible
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn('git', ['--version'], { stdio: 'pipe' });
          child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error('Git no está disponible'));
          });
          child.on('error', () => reject(new Error('Git no está disponible')));
        });
      } catch (error) {
        throw new Error('Git no está instalado o no está disponible en el PATH');
      }

      // Construir el comando Git
      let gitArgs: string[] = [];
      let workingDir = repositoryPath;

      switch (operation) {
        case 'status':
          gitArgs = ['status'];
          if (options.length > 0) gitArgs.push(...options);
          break;

        case 'log':
          gitArgs = ['log', '--oneline', '-10'];
          if (options.length > 0) gitArgs.push(...options);
          break;

        case 'diff':
          gitArgs = ['diff'];
          if (files.length > 0) gitArgs.push(...files);
          if (options.length > 0) gitArgs.push(...options);
          break;

        case 'branch':
          if (branch) {
            gitArgs = ['branch', branch];
          } else {
            gitArgs = ['branch', '-a'];
          }
          if (options.length > 0) gitArgs.push(...options);
          break;

        case 'add':
          gitArgs = ['add'];
          if (files.length > 0) {
            gitArgs.push(...files);
          } else {
            gitArgs.push('.');
          }
          if (options.length > 0) gitArgs.push(...options);
          break;

        case 'commit':
          gitArgs = ['commit'];
          if (message) {
            gitArgs.push('-m', message);
          }
          if (files.length > 0) {
            gitArgs.push(...files);
          }
          if (options.length > 0) gitArgs.push(...options);
          break;

        case 'push':
          gitArgs = ['push'];
          if (remote) gitArgs.push(remote);
          if (branch) gitArgs.push(branch);
          if (options.length > 0) gitArgs.push(...options);
          break;

        case 'pull':
          gitArgs = ['pull'];
          if (remote) gitArgs.push(remote);
          if (branch) gitArgs.push(branch);
          if (options.length > 0) gitArgs.push(...options);
          break;

        case 'clone':
          if (!remoteUrl) {
            throw new Error('remoteUrl es requerido para la operación clone');
          }
          gitArgs = ['clone', remoteUrl];
          if (options.length > 0) gitArgs.push(...options);
          // Para clone, el workingDir es el directorio padre
          workingDir = path.dirname(repositoryPath);
          break;

        case 'init':
          gitArgs = ['init'];
          if (options.length > 0) gitArgs.push(...options);
          break;

        default:
          throw new Error(`Operación Git no soportada: ${operation}`);
      }

      // Verificar que el directorio existe (excepto para clone e init)
      if (operation !== 'clone' && operation !== 'init') {
        try {
          await fs.access(workingDir);
        } catch (error) {
          throw new Error(`El directorio no existe: ${workingDir}`);
        }

        // Verificar que es un repositorio Git válido (excepto para init)
        if (operation !== 'init') {
          const gitDir = path.join(workingDir, '.git');
          try {
            await fs.access(gitDir);
          } catch (error) {
            throw new Error(`No es un repositorio Git válido: ${workingDir}`);
          }
        }
      }

      // Ejecutar el comando Git
      return new Promise((resolve, reject) => {
        const child = spawn('git', gitArgs, {
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
          } else {
            reject(new Error(`Git falló con código ${code}: ${stderr || stdout}`));
          }
        });

        child.on('error', (error) => {
          reject(new Error(`Error ejecutando Git: ${error.message}`));
        });
      });

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error en operación Git: ${error.message}`);
      }
      throw new Error('Error desconocido en operación Git');
    }
  }
};