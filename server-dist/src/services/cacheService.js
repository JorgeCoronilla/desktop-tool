"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const loggerService_1 = require("./loggerService");
/**
 * Servicio de caché para optimizar las llamadas a OpenAI y MCP
 * Evita recomputaciones innecesarias y mejora el tiempo de respuesta
 */
class CacheService {
    constructor() {
        // Caché de herramientas MCP (se invalida cada 10 minutos)
        this.toolsCache = null;
        this.TOOLS_CACHE_TTL = 10 * 60 * 1000; // 10 minutos
        // Caché de contexto de conversación (se invalida cada 5 minutos)
        this.conversationCache = new Map();
        this.CONVERSATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
        this.MAX_CONVERSATION_CACHE_SIZE = 50;
        // Caché de respuestas completas (se invalida cada 2 minutos)
        this.responseCache = new Map();
        this.RESPONSE_CACHE_TTL = 2 * 60 * 1000; // 2 minutos
        this.MAX_RESPONSE_CACHE_SIZE = 20;
        // Limpiar cachés periódicamente
        setInterval(() => this.cleanupCaches(), 60 * 1000); // Cada minuto
    }
    static getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }
    /**
     * Genera un hash único para un conjunto de mensajes y contexto
     */
    hashMessages(messages, currentFolder) {
        const content = JSON.stringify({
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            folder: currentFolder || '',
        });
        return crypto_1.default.createHash('md5').update(content).digest('hex');
    }
    /**
     * Genera un hash para el contexto de herramientas
     */
    hashToolsContext(messageContent) {
        // Extraer palabras clave para determinar qué herramientas son relevantes
        const keywords = this.extractKeywords(messageContent);
        return crypto_1.default.createHash('md5').update(keywords.join('|')).digest('hex');
    }
    /**
     * Extrae palabras clave del contenido del mensaje para determinar herramientas relevantes
     */
    extractKeywords(content) {
        const toolKeywords = {
            file: ['archivo', 'file', 'leer', 'read', 'escribir', 'write', 'crear', 'create'],
            excel: ['excel', 'xlsx', 'hoja', 'sheet', 'celda', 'cell', 'formula'],
            pdf: ['pdf', 'documento', 'document', 'ocr', 'texto'],
            directory: ['carpeta', 'folder', 'directorio', 'directory', 'listar', 'list'],
            copy: ['copiar', 'copy', 'mover', 'move', 'duplicar'],
            delete: ['eliminar', 'delete', 'borrar', 'remove']
        };
        const contentLower = content.toLowerCase();
        const foundKeywords = [];
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
    getCachedTools(getAllTools) {
        const now = Date.now();
        // Verificar si el caché de herramientas es válido
        if (this.toolsCache && (now - this.toolsCache.timestamp) < this.TOOLS_CACHE_TTL) {
            loggerService_1.logger.debug('Using cached tools');
            return this.toolsCache.tools;
        }
        // Computar nuevas herramientas
        loggerService_1.logger.debug('Computing new tools cache');
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
    getRelevantTools(messageContent, allTools) {
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
    getCachedConversation(messages, currentFolder) {
        const hash = this.hashMessages(messages, currentFolder);
        const cached = this.conversationCache.get(hash);
        if (cached && (Date.now() - cached.timestamp) < this.CONVERSATION_CACHE_TTL) {
            loggerService_1.logger.debug('Using cached conversation', { hash });
            return cached;
        }
        return null;
    }
    /**
     * Cachea una conversación procesada
     */
    setCachedConversation(messages, processedMessages, currentFolder) {
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
        loggerService_1.logger.debug('Cached conversation', { hash });
    }
    /**
     * Obtiene respuesta cacheada
     */
    getCachedResponse(messages, currentFolder) {
        const hash = this.hashMessages(messages, currentFolder);
        const cached = this.responseCache.get(hash);
        if (cached && (Date.now() - cached.timestamp) < this.RESPONSE_CACHE_TTL) {
            loggerService_1.logger.debug('Using cached response', { hash });
            return cached.response;
        }
        return null;
    }
    /**
     * Cachea una respuesta completa
     */
    setCachedResponse(messages, response, currentFolder) {
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
        loggerService_1.logger.debug('Cached response', { hash });
    }
    /**
     * Limpia cachés expirados
     */
    cleanupCaches() {
        const now = Date.now();
        // Limpiar caché de herramientas
        if (this.toolsCache && (now - this.toolsCache.timestamp) >= this.TOOLS_CACHE_TTL) {
            this.toolsCache = null;
            loggerService_1.logger.debug('Cleaned expired tools cache');
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
    clearAllCaches() {
        this.toolsCache = null;
        this.conversationCache.clear();
        this.responseCache.clear();
        loggerService_1.logger.info('All caches cleared');
    }
    /**
     * Obtiene estadísticas del caché
     */
    getCacheStats() {
        return {
            toolsCached: !!this.toolsCache,
            conversationCacheSize: this.conversationCache.size,
            responseCacheSize: this.responseCache.size
        };
    }
}
exports.CacheService = CacheService;
// Exportar instancia singleton
exports.cacheService = CacheService.getInstance();
