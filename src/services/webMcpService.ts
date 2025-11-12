import { MCPMessage, MCPStreamChunk } from './mcpService';

export class WebMCPService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  async isInitialized(): Promise<boolean> {
    try {
      console.log('🔍 [WebMCPService] Verificando estado del MCP service...');
      console.log('🔍 [WebMCPService] URL:', `${this.baseUrl}/api/mcp/status`);
      
      const response = await fetch(`${this.baseUrl}/api/mcp/status`);
      console.log('📊 [WebMCPService] Response status:', response.status);
      console.log('📊 [WebMCPService] Response ok:', response.ok);
      
      if (!response.ok) {
        console.error('❌ [WebMCPService] Response not ok:', response.status, response.statusText);
        return false;
      }
      
      const data = await response.json();
      console.log('📊 [WebMCPService] Estado del MCP service:', data);
      return data.success && data.status && data.status.initialized;
    } catch (error) {
      console.error('❌ [WebMCPService] Error verificando estado:', error);
      return false;
    }
  }

  async sendMessage(
    messages: MCPMessage[],
    currentFolder: string,
    onChunk?: (chunk: MCPStreamChunk) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    try {
      console.log('📤 [WebMCPService] Enviando mensaje:', {
        messageCount: messages.length,
        currentFolder,
        hasOnChunk: !!onChunk
      });

      const response = await fetch(`${this.baseUrl}/api/mcp/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          currentFolder,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (onChunk && response.body) {
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'chunk') {
                    onChunk({
                      content: data.content,
                      isComplete: false,
                    });
                    fullResponse += data.content;
                  } else if (data.type === 'done') {
                    console.log('✅ [WebMCPService] Streaming completado');
                    return fullResponse;
                  } else if (data.type === 'error') {
                    throw new Error(data.error);
                  }
                } catch (parseError) {
                  console.warn('⚠️ [WebMCPService] Error parseando chunk:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        return fullResponse;
      } else {
        // Handle non-streaming response
        const data = await response.json();
        console.log('✅ [WebMCPService] Respuesta recibida:', {
          responseLength: data.response?.length || 0
        });
        return data.response;
      }
    } catch (error) {
      console.error('❌ [WebMCPService] Error enviando mensaje:', error);
      throw error;
    }
  }
}