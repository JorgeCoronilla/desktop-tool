/**
 * Gestor de herramientas para el LLM
 *
 * Este archivo maneja la comunicación entre el chat y las herramientas disponibles
 */

import { AVAILABLE_TOOLS, FileSystemTool, ToolResult } from './llmTools';

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  timestamp: number;
}

export interface ToolResponse {
  id: string;
  success: boolean;
  result: ToolResult;
  executionTime: number;
  timestamp: number;
}

/**
 * Gestor principal de herramientas
 */
export class ToolManager {
  private static instance: ToolManager;
  private tools: Map<string, FileSystemTool>;
  private executionHistory: ToolResponse[] = [];
  private lastPendingConfirmCall: ToolCall | null = null;

  private constructor() {
    this.tools = new Map();
    this.initializeTools();
  }

  public static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager();
    }
    return ToolManager.instance;
  }

  /**
   * Inicializa todas las herramientas disponibles
   */
  private initializeTools(): void {
    AVAILABLE_TOOLS.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  /**
   * Obtiene la lista de herramientas disponibles
   */
  public getAvailableTools(): FileSystemTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Obtiene información de una herramienta específica
   */
  public getToolInfo(toolName: string): FileSystemTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Ejecuta una herramienta con los parámetros dados
   */
  public async executeTool(toolCall: ToolCall): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const tool = this.tools.get(toolCall.name);

      if (!tool) {
        const errorResult: ToolResult = {
          success: false,
          error: `Herramienta '${toolCall.name}' no encontrada`,
        };

        return this.createResponse(toolCall.id, errorResult, startTime);
      }

      // Validar parámetros requeridos
      const validationError = this.validateParameters(
        tool,
        toolCall.parameters
      );
      if (validationError) {
        const errorResult: ToolResult = {
          success: false,
          error: validationError,
        };

        return this.createResponse(toolCall.id, errorResult, startTime);
      }

      // Ejecutar la herramienta
      // Para herramientas con múltiples parámetros opcionales, pasar el objeto completo
      const paramKeys = Object.keys(tool.parameters);
      let result: ToolResult;
      
      if (paramKeys.length <= 1 || toolCall.name === 'get_task_state' || toolCall.name === 'reset_task_state') {
        // Para herramientas simples o sin parámetros, usar el método original
        result = await tool.execute(...Object.values(toolCall.parameters));
      } else if (toolCall.name === 'update_task_state') {
        // Para update_task_state, pasar el objeto completo de parámetros
        result = await tool.execute(toolCall.parameters);
      } else {
        // Para otras herramientas, usar el método original
        result = await tool.execute(...Object.values(toolCall.parameters));
      }
      const response = this.createResponse(toolCall.id, result, startTime);

      // Guardar en historial
      this.executionHistory.push(response);

      return response;
    } catch (error) {
      const errorResult: ToolResult = {
        success: false,
        error: `Error inesperado: ${error.message}`,
      };

      return this.createResponse(toolCall.id, errorResult, startTime);
    }
  }

  /**
   * Valida los parámetros de una herramienta
   */
  private validateParameters(
    tool: FileSystemTool,
    parameters: Record<string, any>
  ): string | null {
    // Esta es una validación básica. En una implementación más robusta,
    // se podría usar un esquema de validación más sofisticado
    const requiredParams = Object.keys(tool.parameters).filter(
      param => !tool.parameters[param].endsWith('?')
    );

    for (const param of requiredParams) {
      if (!(param in parameters)) {
        return `Parámetro requerido '${param}' no proporcionado`;
      }
    }

    return null;
  }

  /**
   * Crea una respuesta de herramienta
   */
  private createResponse(
    id: string,
    result: ToolResult,
    startTime: number
  ): ToolResponse {
    return {
      id,
      success: result.success,
      result,
      executionTime: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Obtiene el historial de ejecución
   */
  public getExecutionHistory(): ToolResponse[] {
    return [...this.executionHistory];
  }

  /**
   * Limpia el historial de ejecución
   */
  public clearHistory(): void {
    this.executionHistory = [];
  }

  public clearPendingOperations(): void {
    this.lastPendingConfirmCall = null;
  }

  /**
   * Procesa un mensaje del LLM que puede contener llamadas a herramientas
   */
  public async processLLMMessage(
    message: string,
    options?: { cwd?: string }
  ): Promise<{
    toolCalls: ToolCall[];
    responses: ToolResponse[];
    processedMessage: string;
  }> {
    const cwd = options?.cwd;
    // Atajo: si el usuario solo escribe "confirm", reintentar la última llamada destructiva pendiente con confirmación
    const trimmed = (message || '').trim().toLowerCase();
    const toolCalls: ToolCall[] = [];
    const responses: ToolResponse[] = [];
    const resultTexts: string[] = [];
    const contentBlocks: string[] = [];
    if ((trimmed === 'confirm' || trimmed === 'confirmar') && this.lastPendingConfirmCall) {
      // Si no hay cwd y los parámetros contienen <CWD>, devolver mensaje de selección requerida
      if (
        !cwd &&
        this.parametersContainCwd(this.lastPendingConfirmCall.parameters)
      ) {
        resultTexts.push(
          'Selecciona una carpeta de trabajo en el explorador antes de confirmar.'
        );
        return {
          toolCalls,
          responses,
          processedMessage: resultTexts.join(' '),
        };
      }
      const resolvedParams = this.resolveCwdInParameters(
        this.lastPendingConfirmCall.parameters,
        cwd
      );
      const confirmCall: ToolCall = {
        ...this.lastPendingConfirmCall,
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parameters: { ...resolvedParams, confirm: true },
      };
      toolCalls.push(confirmCall);
      const response = await this.executeTool(confirmCall);
      responses.push(response);
      const resultText = response.success
        ? response.result.message || 'Operación completada'
        : response.result.error || 'Error al ejecutar herramienta';
      resultTexts.push(resultText);
      this.lastPendingConfirmCall = null;
      return { toolCalls, responses, processedMessage: resultTexts.join(' ') };
    }

    // Buscar patrones de llamadas a herramientas en el mensaje
    const toolCallPattern = /\[TOOL:(\w+)\]\((.*?)\)/g;
    let processedMessage = message;

    let match;
    const destructiveTools = new Set([
      'delete_file_or_directory',
      'delete_multiple_items',
      'move_file_or_directory',
    ]);

    while ((match = toolCallPattern.exec(message)) !== null) {
      const [fullMatch, toolName, parametersStr] = match;

      try {
        // Parsear parámetros (formato JSON)
        console.log(`[ToolManager] Parseando JSON para herramienta ${toolName}:`, parametersStr);
        // Manejar caso especial: herramientas sin parámetros (cadena vacía)
        const parameters = parametersStr.trim() === '' ? {} : JSON.parse(parametersStr);
        // Si el mensaje usa <CWD> pero no hay carpeta seleccionada, avisar y no ejecutar
        if (!cwd && this.parametersContainCwd(parameters)) {
          resultTexts.push(
            'Selecciona una carpeta de trabajo en el explorador y repite la operación.'
          );
          continue;
        }
        const resolvedParams = this.resolveCwdInParameters(parameters, cwd);

        // Reglas de confirmación/dry-run para acciones destructivas
        if (destructiveTools.has(toolName)) {
          const confirmed = parameters.confirm === true;
          const dryRun = parameters.dryRun === true;
          if (!confirmed && !dryRun) {
            // No ejecutar, sustituir por mensaje de confirmación requerida
            let confirmText = '';
            if (toolName === 'delete_multiple_items') {
              const itemCount = parameters.items?.length || parameters.paths?.length || 0;
              confirmText = `🚨 **CONFIRMACIÓN REQUERIDA**\n\n` +
                           `Estás a punto de eliminar **${itemCount} archivo(s)/directorio(s)**.\n` +
                           `⚠️ Esta acción **NO SE PUEDE DESHACER**.\n\n` +
                           `**Para proceder:**\n` +
                           `• Escribe "confirmar" para ejecutar la eliminación\n` +
                           `• O usa el parámetro {"confirm": true} en la herramienta\n` +
                           `• O usa {"dryRun": true} para simular la operación`;
            } else if (toolName === 'delete_file_or_directory') {
              const target = parameters.path || parameters.targetPath || 'el elemento seleccionado';
              const fileName = target.split('/').pop() || target;
              confirmText = `🚨 **CONFIRMACIÓN REQUERIDA**\n\n` +
                           `Estás a punto de eliminar: **"${fileName}"**\n` +
                           `📁 Ruta: \`${target}\`\n` +
                           `⚠️ Esta acción **NO SE PUEDE DESHACER**.\n\n` +
                           `**Para proceder:**\n` +
                           `• Escribe "confirmar" para ejecutar la eliminación\n` +
                           `• O usa el parámetro {"confirm": true} en la herramienta\n` +
                           `• O usa {"dryRun": true} para simular la operación`;
            } else {
              confirmText = `🚨 **CONFIRMACIÓN REQUERIDA**\n\n` +
                           `Esta operación puede **modificar o eliminar archivos**.\n` +
                           `⚠️ Los cambios pueden ser **IRREVERSIBLES**.\n\n` +
                           `**Para proceder:**\n` +
                           `• Escribe "confirmar" para ejecutar la operación\n` +
                           `• O usa el parámetro {"confirm": true} en la herramienta\n` +
                           `• O usa {"dryRun": true} para simular la operación`;
            }
            resultTexts.push(confirmText);
            // Guardar llamada pendiente para posible confirmación
            this.lastPendingConfirmCall = {
              id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: toolName,
              parameters: resolvedParams,
              timestamp: Date.now(),
            };
            continue;
          }
        }

        const toolCall: ToolCall = {
          id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: toolName,
          parameters: resolvedParams,
          timestamp: Date.now(),
        };

        toolCalls.push(toolCall);

        // Ejecutar la herramienta
        const response = await this.executeTool(toolCall);
        responses.push(response);

        // Reemplazar la llamada en el mensaje con el resultado
        if (!response.success) {
          const errText =
            response.result.error || 'Error al ejecutar herramienta';
          resultTexts.push(errText);
        }
        // Mostrar datos relevantes cuando existan (p.ej., contenido de archivos)
        if (
          response.success &&
          response.result &&
          typeof response.result.data !== 'undefined'
        ) {
          const data = response.result.data;
          // Caso específico: lectura de archivo de texto
          if (toolName === 'read_text_file' && typeof data === 'string') {
            // Evitar resultados excesivamente largos
            const maxLen = 1000;
            const shown =
              data.length > maxLen ? data.slice(0, maxLen) + '…' : data;
            const fileBase = (() => {
              try {
                const p = JSON.parse(parametersStr);
                const fp =
                  p && typeof p.filePath === 'string' ? p.filePath : '';
                const parts = fp.split('/').filter(Boolean);
                return parts[parts.length - 1] || '';
              } catch {
                return '';
              }
            })();
            contentBlocks.push(`Contenido de "${fileBase}":\n"${shown}"`);
          } else if (toolName === 'list_directory' && Array.isArray(data)) {
            // Mostrar elementos del directorio como viñetas por archivo/carpeta
            const dirBase = (() => {
              try {
                const p = JSON.parse(parametersStr);
                const dp = p && typeof p.dirPath === 'string' ? p.dirPath : '';
                const parts = dp.split('/').filter(Boolean);
                return parts[parts.length - 1] || '';
              } catch {
                return '';
              }
            })();
            const bullet = data
              .map((item: any) => {
                const name =
                  item && typeof item.name === 'string'
                    ? item.name
                    : String(item);
                const type =
                  item && typeof item.isDirectory === 'boolean'
                    ? item.isDirectory
                      ? 'carpeta'
                      : 'archivo'
                    : '';
                return `- ${name}${type ? ` (${type})` : ''}`;
              })
              .join('\n');
            contentBlocks.push(`Elementos en "${dirBase}":\n${bullet}`);
          } else if (toolName === 'list_files_by_criteria' && Array.isArray(data)) {
            // Solo agregar contenido detallado, no mensaje duplicado
            const dirBase = (() => {
              try {
                const p = JSON.parse(parametersStr);
                const dp = p && typeof p.dirPath === 'string' ? p.dirPath : '';
                const parts = dp.split('/').filter(Boolean);
                return parts[parts.length - 1] || '';
              } catch {
                return '';
              }
            })();
            if (data.length > 0) {
              const bullet = data
                .map((item: any) => {
                  const name = typeof item === 'string' ? item : (item?.name || String(item));
                  return `- ${name}`;
                })
                .join('\n');
              contentBlocks.push(`Archivos encontrados en "${dirBase}":\n${bullet}`);
            }
          }
          // No agregar mensajes duplicados para delete_multiple_items
        }
      } catch (error) {
        console.error('Error al parsear parámetros de herramienta:', error);
        console.error('JSON problemático:', parametersStr);
        console.error('Herramienta:', toolName);
        console.error('Match completo:', fullMatch);
        resultTexts.push(
          `Error: Formato de herramienta inválido - ${error.message}. JSON: "${parametersStr}"`
        );
      }
    }
    // Añadir líneas amigables por acción
    if (responses.length > 0) {
      const actions = this.buildFriendlyActions(toolCalls, responses);
      if (actions.length > 0) {
        resultTexts.push(...actions);
      }
    }
    // Construir salida final agregando duplicados en todo el conjunto y preservando orden
    const aggregateDuplicatesPreserveOrder = (lines: string[]): string[] => {
      const counts = new Map<string, number>();
      const order: string[] = [];
      for (const line of lines) {
        if (!counts.has(line)) {
          counts.set(line, 1);
          order.push(line);
        } else {
          counts.set(line, (counts.get(line) || 0) + 1);
        }
      }
      return order.map(l => {
        const c = counts.get(l) || 0;
        return c > 1 && l.trim().length > 0 ? `${l} (x${c})` : l;
      });
    };

    // Deduplicar solo los resultados (sin incluir la sección de contenidos)
    const dedupedResultLines = aggregateDuplicatesPreserveOrder([
      ...resultTexts,
    ]);
    // Convertir resultados a viñetas Markdown
    const bulletLines = dedupedResultLines
      .map(line => (line.trim().length > 0 ? `- ${line}` : ''))
      .join('\n');

    const messageParts: string[] = [];
    if (bulletLines.trim().length > 0) {
      messageParts.push(bulletLines);
    }
    // Añadir sección de contenidos al final, si existen, como viñetas por archivo
    if (contentBlocks.length > 0) {
      messageParts.push('');
      messageParts.push('Contenido:');
      const contentBulletLines = contentBlocks
        .map(block => `- ${block.replace(/\n/g, '\n  ')}`)
        .join('\n');
      messageParts.push(contentBulletLines);
    }

    // En modo estricto, cuando hay herramientas detectadas, devolvemos solo los resultados
    if (
      toolCalls.length > 0 ||
      responses.length > 0 ||
      messageParts.length > 0
    ) {
      processedMessage = messageParts.join('\n');
    }

    return {
      toolCalls,
      responses,
      processedMessage,
    };
  }

  private resolveCwdInParameters(parameters: any, cwd?: string): any {
    if (!cwd) return parameters;
    const resolveValue = (val: any): any => {
      if (typeof val === 'string') {
        return val.includes('<CWD>') ? val.replace(/<CWD>/g, cwd) : val;
      } else if (Array.isArray(val)) {
        return val.map(v => resolveValue(v));
      } else if (val && typeof val === 'object') {
        const out: Record<string, any> = {};
        Object.keys(val).forEach(k => {
          out[k] = resolveValue(val[k]);
        });
        return out;
      }
      return val;
    };
    return resolveValue(parameters);
  }

  private parametersContainCwd(parameters: any): boolean {
    const check = (val: any): boolean => {
      if (typeof val === 'string') return val.includes('<CWD>');
      if (Array.isArray(val)) return val.some(v => check(v));
      if (val && typeof val === 'object')
        return Object.values(val).some(v => check(v));
      return false;
    };
    return check(parameters);
  }

  private buildFriendlySummary(
    toolCalls: ToolCall[],
    responses: ToolResponse[]
  ): string {
    const actions: string[] = [];
    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      const call = toolCalls[i];
      if (!call) continue;
      const name = call.name;
      const p = call.parameters || {};
      const basename = (path: string | undefined) => {
        if (!path || typeof path !== 'string') return '';
        const parts = path.split('/').filter(Boolean);
        return parts[parts.length - 1] || '';
      };
      const parentDir = (path: string | undefined) => {
        if (!path || typeof path !== 'string') return '';
        const parts = path.split('/').filter(Boolean);
        return parts.length >= 2 ? parts[parts.length - 2] : '';
      };

      if (resp.success) {
        switch (name) {
          case 'read_text_file': {
            const file = basename(p.filePath);
            actions.push(`📖 Archivo "${file}" leído exitosamente.`);
            break;
          }
          case 'create_directory': {
            const dir = basename(p.dirPath);
            actions.push(`📁 Carpeta "${dir}" creada exitosamente.`);
            break;
          }
          case 'copy_file_or_directory': {
            const src = basename(p.sourcePath);
            const destFolder = parentDir(p.destPath) || basename(p.destPath);
            actions.push(`📋 "${src}" copiado a "${destFolder}" exitosamente.`);
            break;
          }
          case 'move_file_or_directory': {
            const src = basename(p.sourcePath);
            const destFolder = parentDir(p.destPath) || basename(p.destPath);
            actions.push(`📦 "${src}" movido a "${destFolder}" exitosamente.`);
            break;
          }
          case 'write_text_file': {
            const file = basename(p.filePath);
            actions.push(`✅ Archivo "${file}" creado exitosamente.`);
            break;
          }
          case 'delete_file_or_directory': {
            const target = basename(p.targetPath);
            actions.push(`🗑️ "${target}" eliminado exitosamente.`);
            break;
          }
          case 'list_directory': {
            const dir = basename(p.dirPath);
            let count = undefined;
            const data = resp.result?.data;
            if (Array.isArray(data)) count = data.length;
            actions.push(
              `📂 Directorio "${dir}" listado exitosamente${typeof count === 'number' ? ` (${count} elementos)` : ''}.`
            );
            break;
          }
          default: {
            const msg = resp.result?.message || 'Operación completada';
            actions.push(msg);
          }
        }
      } else {
        const msg = resp.result?.error || 'Error al ejecutar herramienta';
        actions.push(msg);
      }
    }
    if (actions.length === 0) return '';
    if (actions.length === 1) return actions[0];
    const last = actions.pop();
    return `${actions.join(' ')} Finalmente, ${last}`;
  }

  // Lista amigable por acción, una línea por respuesta
  private buildFriendlyActions(
    toolCalls: ToolCall[],
    responses: ToolResponse[]
  ): string[] {
    const lines: string[] = [];
    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      const call = toolCalls[i];
      if (!call) continue;
      const name = call.name;
      const p = call.parameters || {};
      const basename = (path: string | undefined) => {
        if (!path || typeof path !== 'string') return '';
        const parts = path.split('/').filter(Boolean);
        return parts[parts.length - 1] || '';
      };
      const parentDir = (path: string | undefined) => {
        if (!path || typeof path !== 'string') return '';
        const parts = path.split('/').filter(Boolean);
        return parts.length >= 2 ? parts[parts.length - 2] : '';
      };

      if (resp.success) {
        switch (name) {
          case 'read_text_file': {
            const file = basename(p.filePath);
            lines.push(`📖 Archivo "${file}" leído exitosamente.`);
            break;
          }
          case 'create_directory': {
            const dir = basename(p.dirPath);
            lines.push(`📁 Carpeta "${dir}" creada exitosamente.`);
            break;
          }
          case 'copy_file_or_directory': {
            const src = basename(p.sourcePath);
            const destFolder = parentDir(p.destPath) || basename(p.destPath);
            lines.push(`📋 "${src}" copiado a "${destFolder}" exitosamente.`);
            break;
          }
          case 'move_file_or_directory': {
            const src = basename(p.sourcePath);
            const destFolder = parentDir(p.destPath) || basename(p.destPath);
            lines.push(`📦 "${src}" movido a "${destFolder}" exitosamente.`);
            break;
          }
          case 'write_text_file': {
            const file = basename(p.filePath);
            lines.push(`✅ Archivo "${file}" creado exitosamente.`);
            break;
          }
          case 'delete_file_or_directory': {
            const target = basename(p.targetPath);
            lines.push(`🗑️ "${target}" eliminado exitosamente.`);
            break;
          }
          case 'list_directory': {
            const dir = basename(p.dirPath);
            let count = undefined;
            const data = resp.result?.data;
            if (Array.isArray(data)) count = data.length;
            lines.push(
              `📂 Directorio "${dir}" listado exitosamente${typeof count === 'number' ? ` (${count} elementos)` : ''}.`
            );
            break;
          }
          case 'list_files_by_criteria': {
            const dir = basename(p.dirPath);
            let count = undefined;
            const data = resp.result?.data;
            if (Array.isArray(data)) count = data.length;
            lines.push(
              `🔍 Búsqueda completada en "${dir}"${typeof count === 'number' ? ` (${count} elementos encontrados)` : ''}.`
            );
            break;
          }
          case 'delete_multiple_items': {
            let count = undefined;
            const data = resp.result?.data;
            if (Array.isArray(data)) count = data.length;
            lines.push(
              `🗑️ Eliminación múltiple completada${typeof count === 'number' ? `: ${count} exitosos, 0 errores` : ''}.`
            );
            break;
          }
          default: {
            const msg = resp.result?.message || 'Operación completada';
            lines.push(msg);
          }
        }
      } else {
        const msg = resp.result?.error || 'Error al ejecutar herramienta';
        lines.push(msg);
      }
    }
    return lines;
  }

  /**
   * Genera documentación de las herramientas disponibles
   */
  public generateToolsDocumentation(): string {
    let doc = '# Herramientas Disponibles para el LLM\n\n';
    doc +=
      'Para usar una herramienta, utiliza el formato: [TOOL:nombre_herramienta]({"parametro": "valor"})\n\n';

    this.tools.forEach(tool => {
      doc += `## ${tool.name}\n`;
      doc += `**Descripción:** ${tool.description}\n\n`;
      doc += `**Parámetros:**\n`;

      Object.entries(tool.parameters).forEach(([param, type]) => {
        const isOptional = param.endsWith('?');
        const paramName = isOptional ? param.slice(0, -1) : param;
        doc += `- \`${paramName}\` (${type})${isOptional ? ' - Opcional' : ' - Requerido'}\n`;
      });

      doc += `\n**Ejemplo de uso:**\n`;
      doc += `\`[TOOL:${tool.name}]({"parametro": "valor"})\`\n\n`;
      doc += '---\n\n';
    });

    return doc;
  }
}

// Exportar instancia singleton
export const toolManager = ToolManager.getInstance();
