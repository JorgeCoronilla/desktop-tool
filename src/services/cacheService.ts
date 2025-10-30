import { ChatMessage } from '../types/global';
import crypto from 'crypto';
import { compressionService } from './compressionService';
import { logger } from './loggerService';

export interface CacheEntry {
  messagesHash: string;
  tools: any[];
  context: string;
  timestamp: number;
  currentFolder?: string;
}

export interface ToolsCacheEntry {
  tools: any[];
  timestamp: number;
}

export interface ConversationCacheEntry {
  messages: any[];
  hash: string;
  timestamp: number;
}

/**
 * Servicio de caché para optimizar las llamadas a OpenAI y MCP
 * Evita recomputaciones innecesarias y mejora el tiempo de respuesta
 */
export class CacheService {
  private static instance: CacheService;
  
  // Caché de herramientas MCP (se invalida cada 10 minutos)
  private toolsCache: ToolsCacheEntry | null = null;
  private readonly TOOLS_CACHE_TTL = 10 * 60 * 1000; // 10 minutos
  
  // Caché de contexto de conversación (se invalida cada 5 minutos)
  private conversationCache = new Map<string, ConversationCacheEntry>();
  private readonly CONVERSATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_CONVERSATION_CACHE_SIZE = 50;
  
  // Caché de respuestas completas (se invalida cada 2 minutos)
  private responseCache = new Map<string, { response: any; timestamp: number }>();
  private readonly RESPONSE_CACHE_TTL = 2 * 60 * 1000; // 2 minutos
  private readonly MAX_RESPONSE_CACHE_SIZE = 20;

  private constructor() {
    // Limpiar cachés periódicamente
    setInterval(() => this.cleanupCaches(), 60 * 1000); // Cada minuto
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Genera un hash único para un conjunto de mensajes y contexto
   */
  private hashMessages(messages: ChatMessage[], currentFolder?: string): string {
    const content = JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      folder: currentFolder || '',
    });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Genera un hash para el contexto de herramientas
   */
  private hashToolsContext(messageContent: string): string {
    // Extraer palabras clave para determinar qué herramientas son relevantes
    const keywords = this.extractKeywords(messageContent);
    return crypto.createHash('md5').update(keywords.join('|')).digest('hex');
  }

  /**
   * Extrae palabras clave del contenido del mensaje para determinar herramientas relevantes
   */
  private extractKeywords(content: string): string[] {
    const toolKeywords = {
      file: ['archivo', 'file', 'leer', 'read', 'escribir', 'write', 'crear', 'create'],
      excel: ['excel', 'xlsx', 'hoja', 'sheet', 'celda', 'cell', 'formula'],
      pdf: ['pdf', 'documento', 'document', 'ocr', 'texto'],
      directory: ['carpeta', 'folder', 'directorio', 'directory', 'listar', 'list'],
      copy: ['copiar', 'copy', 'mover', 'move', 'duplicar'],
      delete: ['eliminar', 'delete', 'borrar', 'remove']
    };

    const contentLower = content.toLowerCase();
    const foundKeywords: string[] = [];

    for (const [category, keywords] of Object.entries(toolKeywords)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        foundKeywords.push(category);
      }
    }

    return foundKeywords.length > 0 ? foundKeywords : ['general'];
  }

  /**
   * Obtiene herramientas cacheadas o las computa si es necesario
   */
  getCachedTools(getAllTools: () => any[]): any[] {
    const now = Date.now();
    
    // Verificar si el caché de herramientas es válido
    if (this.toolsCache && (now - this.toolsCache.timestamp) < this.TOOLS_CACHE_TTL) {
      logger.debug('Using cached tools');
      return this.toolsCache.tools;
    }

    // Computar nuevas herramientas
    logger.debug('Computing new tools cache');
    const tools = getAllTools();
    this.toolsCache = {
      tools,
      timestamp: now
    };

    return tools;
  }

  /**
   * Obtiene herramientas relevantes basadas en el contenido del mensaje
   */
  getRelevantTools(messageContent: string, allTools: any[]): any[] {
    const keywords = this.extractKeywords(messageContent);
    
    // Si no hay palabras clave específicas, devolver todas las herramientas
    if (keywords.includes('general')) {
      return allTools;
    }

    // Filtrar herramientas basadas en palabras clave
    const relevantTools = allTools.filter(tool => {
      const toolName = tool.name.toLowerCase();
      return keywords.some(keyword => {
        switch (keyword) {
          case 'file':
            return toolName.includes('file') || toolName.includes('text') || toolName.includes('read') || toolName.includes('write');
          case 'excel':
            return toolName.includes('excel') || toolName.includes('xlsx');
          case 'pdf':
            return toolName.includes('pdf') || toolName.includes('ocr');
          case 'directory':
            return toolName.includes('directory') || toolName.includes('list') || toolName.includes('folder');
          case 'copy':
            return toolName.includes('copy') || toolName.includes('move');
          case 'delete':
            return toolName.includes('delete') || toolName.includes('remove');
          default:
            return false;
        }
      });
    });

    // Si no se encontraron herramientas relevantes, devolver todas
    return relevantTools.length > 0 ? relevantTools : allTools;
  }

  /**
   * Obtiene conversación cacheada
   */
  getCachedConversation(messages: ChatMessage[], currentFolder?: string): ConversationCacheEntry | null {
    const hash = this.hashMessages(messages, currentFolder);
    const cached = this.conversationCache.get(hash);
    
    if (cached && (Date.now() - cached.timestamp) < this.CONVERSATION_CACHE_TTL) {
      logger.debug('Using cached conversation', { hash });
      return cached;
    }

    return null;
  }

  /**
   * Cachea una conversación procesada
   */
  setCachedConversation(messages: ChatMessage[], processedMessages: any[], currentFolder?: string): void {
    const hash = this.hashMessages(messages, currentFolder);
    
    // Limpiar caché si está lleno
    if (this.conversationCache.size >= this.MAX_CONVERSATION_CACHE_SIZE) {
      const oldestKey = this.conversationCache.keys().next().value;
      this.conversationCache.delete(oldestKey);
    }

    this.conversationCache.set(hash, {
      messages: processedMessages,
      hash,
      timestamp: Date.now()
    });

    logger.debug('Cached conversation', { hash });
  }

  /**
   * Obtiene respuesta cacheada
   */
  getCachedResponse(messages: ChatMessage[], currentFolder?: string): any | null {
    const hash = this.hashMessages(messages, currentFolder);
    const cached = this.responseCache.get(hash);
    
    if (cached && (Date.now() - cached.timestamp) < this.RESPONSE_CACHE_TTL) {
      logger.debug('Using cached response', { hash });
      return cached.response;
    }

    return null;
  }

  /**
   * Cachea una respuesta completa
   */
  setCachedResponse(messages: ChatMessage[], response: any, currentFolder?: string): void {
    const hash = this.hashMessages(messages, currentFolder);
    
    // Limpiar caché si está lleno
    if (this.responseCache.size >= this.MAX_RESPONSE_CACHE_SIZE) {
      const oldestKey = this.responseCache.keys().next().value;
      this.responseCache.delete(oldestKey);
    }

    this.responseCache.set(hash, {
      response,
      timestamp: Date.now()
    });

    logger.debug('Cached response', { hash });
  }

  /**
   * Limpia cachés expirados
   */
  private cleanupCaches(): void {
    const now = Date.now();

    // Limpiar caché de herramientas
    if (this.toolsCache && (now - this.toolsCache.timestamp) >= this.TOOLS_CACHE_TTL) {
      this.toolsCache = null;
      logger.debug('Cleaned expired tools cache');
    }

    // Limpiar caché de conversaciones
    for (const [key, entry] of this.conversationCache.entries()) {
      if ((now - entry.timestamp) >= this.CONVERSATION_CACHE_TTL) {
        this.conversationCache.delete(key);
      }
    }

    // Limpiar caché de respuestas
    for (const [key, entry] of this.responseCache.entries()) {
      if ((now - entry.timestamp) >= this.RESPONSE_CACHE_TTL) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Limpia todos los cachés manualmente
   */
  clearAllCaches(): void {
    this.toolsCache = null;
    this.conversationCache.clear();
    this.responseCache.clear();
    logger.info('All caches cleared');
  }

  /**
   * Obtiene estadísticas del caché
   */
  getCacheStats(): {
    toolsCached: boolean;
    conversationCacheSize: number;
    responseCacheSize: number;
  } {
    return {
      toolsCached: !!this.toolsCache,
      conversationCacheSize: this.conversationCache.size,
      responseCacheSize: this.responseCache.size
    };
  }
}

// Exportar instancia singleton
export const cacheService = CacheService.getInstance();