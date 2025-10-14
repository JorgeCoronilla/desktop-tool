import OpenAI from 'openai';

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

  constructor(config: MCPServiceConfig) {
    this.config = {
      model: 'gpt-4o',
      requireApproval: 'never',
      allowedTools: [
        // Herramientas básicas de archivos
        'read_text_file',
        'write_text_file',
        'create_directory',
        'list_directory',
        'copy_file_or_directory',
        'move_file_or_directory',
        
        // Herramientas avanzadas
        'list_files_by_criteria',
        'delete_file_or_directory',
        'delete_multiple_items',
        
        // Herramientas de PDF
        'read_pdf',
        'ocr_pdf',
        
        // Herramientas de Excel
        'read_excel',
        'write_excel',
        'modify_excel'
      ],
      ...config
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
    });
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
      // Construir el input para la Responses API
      const input = this.buildInput(messages, options?.currentFolder);

      // Configurar las herramientas MCP
      const tools = [{
        type: 'mcp' as const,
        server_label: 'desktop_helper',
        server_url: this.config.mcpServerUrl,
        allowed_tools: this.config.allowedTools,
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
      console.error('Error en streaming:', error);
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
      console.warn('Servidor MCP no disponible:', error);
      return false;
    }
  }

  /**
   * Obtiene la lista de herramientas disponibles del servidor MCP
   */
  async getAvailableTools(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.mcpServerUrl}/tools`);
      if (response.ok) {
        const data = await response.json();
        return data.tools?.map((tool: any) => tool.name) || [];
      }
    } catch (error) {
      console.warn('No se pudieron obtener las herramientas MCP:', error);
    }
    
    return this.config.allowedTools || [];
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