import OpenAI from 'openai';
import { logger } from './loggerService';

export interface MCPServiceConfig {
  apiKey: string;
  mcpServerUrl: string;
  allowedTools?: string[];
  requireApproval?: 'always' | 'never' | Record<string, 'always' | 'never'>;
  model?: string;
}

export interface MCPMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MCPStreamChunk {
  content: string;
  isComplete: boolean;
}

export interface MCPResponse {
  id: string;
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result?: any;
  }>;
}

export class MCPService {
  private client: OpenAI;
  private config: MCPServiceConfig;
  private availableTools: string[] | null = null;
  private toolsCache: Map<string, any> = new Map();
  private toolLoadPromises: Map<string, Promise<any>> = new Map();

  // Herramientas organizadas por categorías para lazy loading
  private static readonly TOOL_CATEGORIES = {
    basic: [
      'read_text_file',
      'write_text_file',
      'create_directory',
      'list_directory'
    ],
    advanced: [
      'copy_file_or_directory',
      'move_file_or_directory',
      'list_files_by_criteria',
      'delete_file_or_directory',
      'delete_multiple_items'
    ],
    pdf: [
      'read_pdf',
      'read_pdf_smart',
      'ocr_pdf'
    ],
    excel: [
      'read_excel',
      'write_excel',
      'modify_excel'
    ]
  };

  constructor(config: MCPServiceConfig) {
    this.config = {
      model: 'gpt-4o',
      requireApproval: 'never',
      // Solo cargar herramientas básicas inicialmente
      allowedTools: MCPService.TOOL_CATEGORIES.basic,
      ...config
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
    });
  }

  /**
   * Carga herramientas bajo demanda basándose en el contenido del mensaje
   */
  private async loadToolsOnDemand(messages: MCPMessage[]): Promise<string[]> {
    const messageContent = messages.map(m => m.content).join(' ').toLowerCase();
    const currentTools = new Set(this.config.allowedTools || []);
    
    // Detectar necesidad de herramientas específicas
    const needsPdf = /pdf|documento|leer archivo|extraer texto/i.test(messageContent);
    const needsExcel = /excel|xlsx|hoja de cálculo|spreadsheet/i.test(messageContent);
    const needsAdvanced = /copiar|mover|eliminar|buscar archivos|criterios/i.test(messageContent);
    
    // Cargar categorías según necesidad
    if (needsPdf) {
      await this.loadToolCategory('pdf');
      MCPService.TOOL_CATEGORIES.pdf.forEach(tool => currentTools.add(tool));
    }
    
    if (needsExcel) {
      await this.loadToolCategory('excel');
      MCPService.TOOL_CATEGORIES.excel.forEach(tool => currentTools.add(tool));
    }
    
    if (needsAdvanced) {
      await this.loadToolCategory('advanced');
      MCPService.TOOL_CATEGORIES.advanced.forEach(tool => currentTools.add(tool));
    }
    
    return Array.from(currentTools);
  }

  /**
   * Carga una categoría específica de herramientas
   */
  private async loadToolCategory(category: keyof typeof MCPService.TOOL_CATEGORIES): Promise<void> {
    const cacheKey = `category_${category}`;
    
    if (this.toolsCache.has(cacheKey)) {
      return; // Ya está cargada
    }
    
    // Evitar cargas duplicadas
    if (this.toolLoadPromises.has(cacheKey)) {
      return this.toolLoadPromises.get(cacheKey);
    }
    
    const loadPromise = this.performToolCategoryLoad(category);
    this.toolLoadPromises.set(cacheKey, loadPromise);
    
    try {
      await loadPromise;
      this.toolsCache.set(cacheKey, true);
    } finally {
      this.toolLoadPromises.delete(cacheKey);
    }
  }

  /**
   * Realiza la carga efectiva de una categoría de herramientas
   */
  private async performToolCategoryLoad(category: keyof typeof MCPService.TOOL_CATEGORIES): Promise<void> {
    logger.info('Loading MCP tools for category', { category });
    
    // Simular tiempo de carga (en producción esto podría ser validación de herramientas)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const tools = MCPService.TOOL_CATEGORIES[category];
    logger.info('MCP tools loaded for category', { category, toolCount: tools.length });
  }

  /**
   * Envía un mensaje usando la Responses API con MCP
   */
  async sendMessage(
    messages: MCPMessage[],
    options?: {
      currentFolder?: string;
      onStream?: (chunk: MCPStreamChunk) => void;
      previousResponseId?: string;
    }
  ): Promise<MCPResponse> {
    try {
      // Cargar herramientas bajo demanda
      const requiredTools = await this.loadToolsOnDemand(messages);
      
      // Construir el input para la Responses API
      const input = this.buildInput(messages, options?.currentFolder);

      // Configurar las herramientas MCP con las herramientas cargadas
      const tools = [{
        type: 'mcp' as const,
        server_label: 'desktop_helper',
        server_url: this.config.mcpServerUrl,
        allowed_tools: requiredTools,
        require_approval: this.config.requireApproval
      }];

      // Llamar a la Responses API
      const response = await this.client.responses.create({
        model: this.config.model!,
        input,
        tools,
        previous_response_id: options?.previousResponseId,
        stream: !!options?.onStream
      });

      if (options?.onStream) {
        return this.handleStreamingResponse(response, options.onStream);
      } else {
        return this.handleResponse(response);
      }

    } catch (error) {
      console.error('Error en MCPService:', error);
      throw new Error(`Error al comunicarse con MCP: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Construye el input para la Responses API
   */
  private buildInput(messages: MCPMessage[], currentFolder?: string): any {
    // Agregar contexto del directorio actual si está disponible
    const contextMessage = currentFolder 
      ? `Directorio de trabajo actual: ${currentFolder}\n\n`
      : '';

    // Convertir mensajes al formato de la Responses API
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.role === 'system' 
        ? contextMessage + msg.content
        : msg.content
    }));

    return formattedMessages;
  }

  /**
   * Maneja respuestas no streaming
   */
  private async handleResponse(response: any): Promise<MCPResponse> {
    // La Responses API maneja automáticamente las llamadas a herramientas MCP
    // Solo necesitamos extraer el contenido final
    
    return {
      id: response.id,
      content: response.output?.content || '',
      toolCalls: this.extractToolCalls(response)
    };
  }

  /**
   * Maneja respuestas streaming
   */
  private async handleStreamingResponse(
    response: any, 
    onStream: (chunk: MCPStreamChunk) => void
  ): Promise<MCPResponse> {
    let accumulatedContent = '';
    let responseId = '';

    try {
      for await (const chunk of response) {
        if (chunk.type === 'response.delta') {
          const content = chunk.delta?.content || '';
          accumulatedContent += content;
          
          onStream({
            content,
            isComplete: false
          });
        } else if (chunk.type === 'response.done') {
          responseId = chunk.response.id;
          
          onStream({
            content: '',
            isComplete: true
          });
        }
      }

      return {
        id: responseId,
        content: accumulatedContent,
        toolCalls: [] // Las tool calls se manejan automáticamente en streaming
      };

    } catch (error) {
      logger.error('Error in MCPService', error);
      throw error;
    }
  }

  /**
   * Extrae información de tool calls de la respuesta (para debugging)
   */
  private extractToolCalls(response: any): Array<{name: string; arguments: any; result?: any}> {
    // En la Responses API con MCP, las tool calls se ejecutan automáticamente
    // Esta función es principalmente para logging/debugging
    const toolCalls = [];
    
    if (response.tool_calls) {
      for (const call of response.tool_calls) {
        toolCalls.push({
          name: call.function?.name || 'unknown',
          arguments: call.function?.arguments || {},
          result: call.result
        });
      }
    }

    return toolCalls;
  }

  /**
   * Verifica si el servidor MCP está disponible
   */
  async checkMCPServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.mcpServerUrl}/health`);
      return response.ok;
    } catch (error) {
      logger.warn('MCP server not available', error);
      return false;
    }
  }

  /**
   * Obtiene la lista de herramientas disponibles del servidor MCP
   */
  async getAvailableTools(): Promise<string[]> {
    if (this.availableTools) {
      return this.availableTools;
    }

    try {
      const response = await fetch(`${this.config.mcpServerUrl}/tools`);
      if (response.ok) {
        const data = await response.json();
        this.availableTools = data.tools?.map((tool: any) => tool.name) || [];
        return this.availableTools;
      }
    } catch (error) {
      logger.warn('Could not get MCP tools', error);
      return [];
    }
    
    // Fallback a todas las herramientas conocidas
    this.availableTools = Object.values(MCPService.TOOL_CATEGORIES).flat();
    return this.availableTools;
  }

  /**
   * Precarga una categoría específica de herramientas
   */
  async preloadToolCategory(category: keyof typeof MCPService.TOOL_CATEGORIES): Promise<void> {
    await this.loadToolCategory(category);
  }

  /**
   * Precarga todas las herramientas para uso offline
   */
  async preloadAllTools(): Promise<void> {
    const categories = Object.keys(MCPService.TOOL_CATEGORIES) as Array<keyof typeof MCPService.TOOL_CATEGORIES>;
    await Promise.all(categories.map(category => this.loadToolCategory(category)));
    
    // Actualizar allowedTools para incluir todas las herramientas
    this.config.allowedTools = Object.values(MCPService.TOOL_CATEGORIES).flat();
  }

  /**
   * Obtiene estadísticas de carga de herramientas
   */
  getToolLoadingStats(): {
    loadedCategories: string[];
    totalCategories: number;
    cacheSize: number;
  } {
    const loadedCategories = Array.from(this.toolsCache.keys())
      .filter(key => key.startsWith('category_'))
      .map(key => key.replace('category_', ''));
    
    return {
      loadedCategories,
      totalCategories: Object.keys(MCPService.TOOL_CATEGORIES).length,
      cacheSize: this.toolsCache.size
    };
  }

  /**
   * Actualiza la configuración del servicio
   */
  updateConfig(newConfig: Partial<MCPServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.apiKey) {
      this.client = new OpenAI({
        apiKey: newConfig.apiKey,
      });
    }
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): MCPServiceConfig {
    return { ...this.config };
  }
}