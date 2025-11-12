"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPService = void 0;
const openai_1 = __importDefault(require("openai"));
const loggerService_1 = require("./loggerService");
class MCPService {
    constructor(config) {
        this.availableTools = null;
        this.toolsCache = new Map();
        this.toolLoadPromises = new Map();
        this.config = {
            model: 'gpt-4o',
            requireApproval: 'never',
            // Solo cargar herramientas básicas inicialmente
            allowedTools: MCPService.TOOL_CATEGORIES.basic,
            ...config
        };
        this.client = new openai_1.default({
            apiKey: this.config.apiKey,
        });
    }
    /**
     * Carga herramientas bajo demanda basándose en el contenido del mensaje
     */
    async loadToolsOnDemand(messages) {
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
    async loadToolCategory(category) {
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
        }
        finally {
            this.toolLoadPromises.delete(cacheKey);
        }
    }
    /**
     * Realiza la carga efectiva de una categoría de herramientas
     */
    async performToolCategoryLoad(category) {
        loggerService_1.logger.info('Loading MCP tools for category', { category });
        // Simular tiempo de carga (en producción esto podría ser validación de herramientas)
        await new Promise(resolve => setTimeout(resolve, 50));
        const tools = MCPService.TOOL_CATEGORIES[category];
        loggerService_1.logger.info('MCP tools loaded for category', { category, toolCount: tools.length });
    }
    /**
     * Envía un mensaje usando la Responses API con MCP
     */
    async sendMessage(messages, options) {
        try {
            // Cargar herramientas bajo demanda
            const requiredTools = await this.loadToolsOnDemand(messages);
            // Construir el input para la Responses API
            const input = this.buildInput(messages, options?.currentFolder);
            // Configurar las herramientas MCP con las herramientas cargadas
            const tools = [{
                    type: 'mcp',
                    server_label: 'desktop_helper',
                    server_url: this.config.mcpServerUrl,
                    allowed_tools: requiredTools,
                    require_approval: this.config.requireApproval
                }];
            // Llamar a la Responses API
            const response = await this.client.responses.create({
                model: this.config.model,
                input,
                tools,
                previous_response_id: options?.previousResponseId,
                stream: !!options?.onStream
            });
            if (options?.onStream) {
                return this.handleStreamingResponse(response, options.onStream);
            }
            else {
                return this.handleResponse(response);
            }
        }
        catch (error) {
            console.error('Error en MCPService:', error);
            throw new Error(`Error al comunicarse con MCP: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }
    /**
     * Construye el input para la Responses API
     */
    buildInput(messages, currentFolder) {
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
    async handleResponse(response) {
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
    async handleStreamingResponse(response, onStream) {
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
                }
                else if (chunk.type === 'response.done') {
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
        }
        catch (error) {
            loggerService_1.logger.error('Error in MCPService', error);
            throw error;
        }
    }
    /**
     * Extrae información de tool calls de la respuesta (para debugging)
     */
    extractToolCalls(response) {
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
    async checkMCPServerHealth() {
        try {
            const response = await fetch(`${this.config.mcpServerUrl}/health`);
            return response.ok;
        }
        catch (error) {
            loggerService_1.logger.warn('MCP server not available', error);
            return false;
        }
    }
    /**
     * Obtiene la lista de herramientas disponibles del servidor MCP
     */
    async getAvailableTools() {
        if (this.availableTools) {
            return this.availableTools;
        }
        try {
            const response = await fetch(`${this.config.mcpServerUrl}/tools`);
            if (response.ok) {
                const data = await response.json();
                this.availableTools = data.tools?.map((tool) => tool.name) || [];
                return this.availableTools;
            }
        }
        catch (error) {
            loggerService_1.logger.warn('Could not get MCP tools', error);
            return [];
        }
        // Fallback a todas las herramientas conocidas
        this.availableTools = Object.values(MCPService.TOOL_CATEGORIES).flat();
        return this.availableTools;
    }
    /**
     * Precarga una categoría específica de herramientas
     */
    async preloadToolCategory(category) {
        await this.loadToolCategory(category);
    }
    /**
     * Precarga todas las herramientas para uso offline
     */
    async preloadAllTools() {
        const categories = Object.keys(MCPService.TOOL_CATEGORIES);
        await Promise.all(categories.map(category => this.loadToolCategory(category)));
        // Actualizar allowedTools para incluir todas las herramientas
        this.config.allowedTools = Object.values(MCPService.TOOL_CATEGORIES).flat();
    }
    /**
     * Obtiene estadísticas de carga de herramientas
     */
    getToolLoadingStats() {
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
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.apiKey) {
            this.client = new openai_1.default({
                apiKey: newConfig.apiKey,
            });
        }
    }
    /**
     * Obtiene la configuración actual
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.MCPService = MCPService;
// Herramientas organizadas por categorías para lazy loading
MCPService.TOOL_CATEGORIES = {
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
