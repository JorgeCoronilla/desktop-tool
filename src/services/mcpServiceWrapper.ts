import { ChatMessage } from '../types/global';

export interface MCPMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MCPServiceWrapper {
  isInitialized(): Promise<boolean>;
  sendMessage(messages: (ChatMessage | MCPMessage)[], options?: { currentFolder?: string }): Promise<any>;
  checkMCPServerHealth(): Promise<boolean>;
  getAvailableTools(): Promise<string[]>;
}

export class SecureMCPServiceWrapper implements MCPServiceWrapper {
  private initialized = false;

  async isInitialized(): Promise<boolean> {
    try {
      const result = await window.electronAPI?.mcpServiceInit();
      if (result?.success) {
        this.initialized = result.isInitialized;
        return this.initialized;
      }
      return false;
    } catch (error) {
      console.error('Error checking MCP service initialization:', error);
      return false;
    }
  }

  async sendMessage(messages: (ChatMessage | MCPMessage)[], options?: { currentFolder?: string }): Promise<any> {
    if (!this.initialized) {
      await this.isInitialized();
    }

    if (!this.initialized) {
      throw new Error('MCPService no está inicializado');
    }

    // Convertir mensajes al formato ChatMessage para el IPC
    const chatMessages: ChatMessage[] = messages.map((msg, index) => {
      if ('id' in msg && 'timestamp' in msg) {
        // Ya es un ChatMessage
        return msg as ChatMessage;
      } else {
        // Es un MCPMessage, convertir a ChatMessage
        const mcpMsg = msg as MCPMessage;
        return {
          id: `msg-${Date.now()}-${index}`,
          role: mcpMsg.role === 'system' ? 'assistant' : mcpMsg.role, // Convertir system a assistant
          content: mcpMsg.role === 'system' ? `[SYSTEM] ${mcpMsg.content}` : mcpMsg.content,
          timestamp: new Date()
        } as ChatMessage;
      }
    });

    const result = await window.electronAPI?.mcpServiceSendMessage(chatMessages, options);
    if (result?.success) {
      return result.response;
    } else {
      throw new Error(result?.error || 'Error enviando mensaje al MCPService');
    }
  }

  async checkMCPServerHealth(): Promise<boolean> {
    if (!this.initialized) {
      await this.isInitialized();
    }

    if (!this.initialized) {
      return false;
    }

    const result = await window.electronAPI?.mcpServiceCheckHealth();
    return result?.success && result?.isHealthy || false;
  }

  async getAvailableTools(): Promise<string[]> {
    if (!this.initialized) {
      await this.isInitialized();
    }

    if (!this.initialized) {
      return [];
    }

    const result = await window.electronAPI?.mcpServiceGetTools();
    return result?.success ? result.tools || [] : [];
  }
}