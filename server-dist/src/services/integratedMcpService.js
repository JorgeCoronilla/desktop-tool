"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegratedMCPService = exports.MODEL_LIMITS = void 0;
const openai_1 = __importDefault(require("openai"));
const electronMcpService_1 = require("../mcp/electronMcpService");
const cacheService_1 = require("./cacheService");
const loggerService_1 = require("./loggerService");
/**
 * Límites de tokens por modelo según OpenAI API Tiers
 * Basado en la documentación oficial: https://platform.openai.com/docs/guides/rate-limits
 */
exports.MODEL_LIMITS = {
    // GPT-5 Series (nuevos modelos)
    'gpt-5': {
        tier1: { tpm: 200000, maxPerMessage: 15000, maxPerConversation: 40000 },
        tier2: { tpm: 1000000, maxPerMessage: 25000, maxPerConversation: 60000 },
        tier3: { tpm: 2000000, maxPerMessage: 40000, maxPerConversation: 100000 },
        tier4: { tpm: 5000000, maxPerMessage: 80000, maxPerConversation: 150000 },
        tier5: { tpm: 50000000, maxPerMessage: 150000, maxPerConversation: 300000 }
    },
    'gpt-5-chat-latest': {
        tier1: { tpm: 90000, maxPerMessage: 12000, maxPerConversation: 30000 },
        tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 },
        tier3: { tpm: 900000, maxPerMessage: 30000, maxPerConversation: 80000 },
        tier4: { tpm: 2250000, maxPerMessage: 50000, maxPerConversation: 120000 },
        tier5: { tpm: 22500000, maxPerMessage: 100000, maxPerConversation: 200000 }
    },
    'gpt-5-codex': {
        tier1: { tpm: 200000, maxPerMessage: 15000, maxPerConversation: 40000 },
        tier2: { tpm: 1000000, maxPerMessage: 25000, maxPerConversation: 60000 },
        tier3: { tpm: 2000000, maxPerMessage: 40000, maxPerConversation: 100000 },
        tier4: { tpm: 5000000, maxPerMessage: 80000, maxPerConversation: 150000 },
        tier5: { tpm: 50000000, maxPerMessage: 150000, maxPerConversation: 300000 }
    },
    'gpt-5-mini': {
        tier1: { tpm: 400000, maxPerMessage: 20000, maxPerConversation: 50000 },
        tier2: { tpm: 2000000, maxPerMessage: 30000, maxPerConversation: 75000 },
        tier3: { tpm: 4000000, maxPerMessage: 50000, maxPerConversation: 125000 },
        tier4: { tpm: 10000000, maxPerMessage: 100000, maxPerConversation: 200000 },
        tier5: { tpm: 100000000, maxPerMessage: 200000, maxPerConversation: 400000 }
    },
    'gpt-5-nano': {
        tier1: { tpm: 400000, maxPerMessage: 20000, maxPerConversation: 50000 },
        tier2: { tpm: 2000000, maxPerMessage: 30000, maxPerConversation: 75000 },
        tier3: { tpm: 4000000, maxPerMessage: 50000, maxPerConversation: 125000 },
        tier4: { tpm: 10000000, maxPerMessage: 100000, maxPerConversation: 200000 },
        tier5: { tpm: 100000000, maxPerMessage: 200000, maxPerConversation: 400000 }
    },
    'gpt-5-pro': {
        tier1: { tpm: 90000, maxPerMessage: 12000, maxPerConversation: 30000 },
        tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 },
        tier3: { tpm: 900000, maxPerMessage: 30000, maxPerConversation: 80000 },
        tier4: { tpm: 2250000, maxPerMessage: 50000, maxPerConversation: 120000 },
        tier5: { tpm: 22500000, maxPerMessage: 100000, maxPerConversation: 200000 }
    },
    // GPT-3.5 Turbo Series
    'gpt-3.5-turbo': {
        tier1: { tpm: 90000, maxPerMessage: 8000, maxPerConversation: 20000 },
        tier2: { tpm: 2000000, maxPerMessage: 20000, maxPerConversation: 50000 },
        tier3: { tpm: 4000000, maxPerMessage: 30000, maxPerConversation: 80000 },
        tier4: { tpm: 8000000, maxPerMessage: 50000, maxPerConversation: 120000 },
        tier5: { tpm: 40000000, maxPerMessage: 100000, maxPerConversation: 200000 }
    },
    'gpt-3.5-turbo-instruct': {
        tier1: { tpm: 40000, maxPerMessage: 8000, maxPerConversation: 20000 },
        tier2: { tpm: 90000, maxPerMessage: 15000, maxPerConversation: 30000 },
        tier3: { tpm: 180000, maxPerMessage: 25000, maxPerConversation: 50000 },
        tier4: { tpm: 360000, maxPerMessage: 40000, maxPerConversation: 80000 },
        tier5: { tpm: 1800000, maxPerMessage: 80000, maxPerConversation: 150000 }
    },
    // GPT-4 Series
    'gpt-4': {
        tier1: { tpm: 10000, maxPerMessage: 8000, maxPerConversation: 20000 },
        tier2: { tpm: 40000, maxPerMessage: 15000, maxPerConversation: 35000 },
        tier3: { tpm: 80000, maxPerMessage: 25000, maxPerConversation: 50000 },
        tier4: { tpm: 300000, maxPerMessage: 40000, maxPerConversation: 80000 },
        tier5: { tpm: 10000000, maxPerMessage: 80000, maxPerConversation: 150000 }
    },
    // GPT-4 Turbo Series
    'gpt-4-turbo': {
        tier1: { tpm: 150000, maxPerMessage: 12000, maxPerConversation: 30000 },
        tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 },
        tier3: { tpm: 800000, maxPerMessage: 30000, maxPerConversation: 80000 },
        tier4: { tpm: 2000000, maxPerMessage: 50000, maxPerConversation: 120000 },
        tier5: { tpm: 30000000, maxPerMessage: 100000, maxPerConversation: 200000 }
    },
    // GPT-4.1 Series
    'gpt-4.1': {
        tier1: { tpm: 150000, maxPerMessage: 12000, maxPerConversation: 30000 },
        tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 },
        tier3: { tpm: 800000, maxPerMessage: 30000, maxPerConversation: 80000 },
        tier4: { tpm: 2000000, maxPerMessage: 50000, maxPerConversation: 120000 },
        tier5: { tpm: 30000000, maxPerMessage: 100000, maxPerConversation: 200000 }
    },
    'gpt-4.1-mini': {
        tier1: { tpm: 500000, maxPerMessage: 15000, maxPerConversation: 40000 },
        tier2: { tpm: 2000000, maxPerMessage: 25000, maxPerConversation: 60000 },
        tier3: { tpm: 4000000, maxPerMessage: 40000, maxPerConversation: 100000 },
        tier4: { tpm: 10000000, maxPerMessage: 80000, maxPerConversation: 150000 },
        tier5: { tpm: 180000000, maxPerMessage: 150000, maxPerConversation: 300000 }
    },
    'gpt-4.1-nano': {
        tier1: { tpm: 500000, maxPerMessage: 15000, maxPerConversation: 40000 },
        tier2: { tpm: 2000000, maxPerMessage: 25000, maxPerConversation: 60000 },
        tier3: { tpm: 4000000, maxPerMessage: 40000, maxPerConversation: 100000 },
        tier4: { tpm: 10000000, maxPerMessage: 80000, maxPerConversation: 150000 },
        tier5: { tpm: 180000000, maxPerMessage: 150000, maxPerConversation: 300000 }
    },
    // GPT-4o Series (modelos actuales)
    'gpt-4o': {
        tier1: { tpm: 150000, maxPerMessage: 12000, maxPerConversation: 30000 },
        tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 },
        tier3: { tpm: 800000, maxPerMessage: 30000, maxPerConversation: 80000 },
        tier4: { tpm: 2000000, maxPerMessage: 50000, maxPerConversation: 120000 },
        tier5: { tpm: 30000000, maxPerMessage: 100000, maxPerConversation: 200000 }
    },
    'gpt-4o-mini': {
        tier1: { tpm: 500000, maxPerMessage: 15000, maxPerConversation: 40000 },
        tier2: { tpm: 2000000, maxPerMessage: 25000, maxPerConversation: 60000 },
        tier3: { tpm: 4000000, maxPerMessage: 40000, maxPerConversation: 100000 },
        tier4: { tpm: 10000000, maxPerMessage: 80000, maxPerConversation: 150000 },
        tier5: { tpm: 150000000, maxPerMessage: 150000, maxPerConversation: 300000 }
    },
    // Fallback para modelos no reconocidos
    'default': {
        tier1: { tpm: 30000, maxPerMessage: 8000, maxPerConversation: 20000 },
        tier2: { tpm: 450000, maxPerMessage: 15000, maxPerConversation: 35000 },
        tier3: { tpm: 800000, maxPerMessage: 25000, maxPerConversation: 50000 },
        tier4: { tpm: 2000000, maxPerMessage: 40000, maxPerConversation: 80000 },
        tier5: { tpm: 30000000, maxPerMessage: 80000, maxPerConversation: 150000 }
    }
};
/**
 * Servicio integrado que combina OpenAI con ElectronMCPService
 * Reemplaza la necesidad de un servidor MCP externo
 */
class IntegratedMCPService {
    constructor(config, confirmationCallback) {
        this.conversationTokens = 0;
        console.log('🔧 [IntegratedMCPService] Iniciando constructor con config:', {
            model: config.model,
            tier: config.tier || 1,
            hasApiKey: !!config.apiKey,
            apiKeyLength: config.apiKey?.length || 0
        });
        this.openai = new openai_1.default({ apiKey: config.apiKey });
        this.model = config.model;
        this.mcpService = new electronMcpService_1.ElectronMCPService();
        this.confirmationCallback = confirmationCallback;
        // Obtener límites dinámicos basados en el modelo y tier
        const limits = this.getModelLimits(config.model, config.tier || 1);
        this.maxTokensPerMessage = config.maxTokensPerMessage || limits.maxPerMessage;
        this.maxTokensPerConversation = config.maxTokensPerConversation || limits.maxPerConversation;
        console.log('✅ [IntegratedMCPService] Constructor completado:', {
            model: this.model,
            maxTokensPerMessage: this.maxTokensPerMessage,
            maxTokensPerConversation: this.maxTokensPerConversation,
            mcpServiceInitialized: !!this.mcpService
        });
    }
    /**
     * Obtiene los límites de tokens para un modelo y tier específico
     */
    getModelLimits(model, tier) {
        // Normalizar nombre del modelo para búsqueda
        const normalizedModel = model.toLowerCase();
        // Buscar límites específicos del modelo
        for (const [modelKey, limits] of Object.entries(exports.MODEL_LIMITS)) {
            if (normalizedModel.includes(modelKey) || normalizedModel === modelKey) {
                return limits[`tier${tier}`];
            }
        }
        // Fallback a límites por defecto
        return exports.MODEL_LIMITS.default[`tier${tier}`];
    }
    /**
     * Estima el número de tokens en un texto (aproximación: 1 token ≈ 4 caracteres)
     */
    estimateTokens(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }
        return Math.ceil(text.length / 4);
    }
    /**
     * Fragmenta texto largo en chunks manejables
     */
    chunkText(text, maxChunkSize = 8000) {
        if (text.length <= maxChunkSize) {
            return [text];
        }
        const chunks = [];
        const sentences = text.split(/[.!?]+\s+/);
        let currentChunk = '';
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            }
            else {
                currentChunk += (currentChunk ? '. ' : '') + sentence;
            }
        }
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        return chunks;
    }
    /**
     * Crea un resumen del contenido de un PDF para reducir tokens
     */
    createPdfSummary(pdfResult) {
        const { text, pages } = pdfResult;
        // Verificar si el texto existe y es válido
        if (!text || typeof text !== 'string') {
            const errorSummary = {
                type: 'pdf_error',
                pages: pages || 0,
                error: 'No se pudo extraer texto del PDF',
                note: 'El PDF no pudo ser procesado correctamente. Puede estar protegido, corrupto, o contener solo imágenes.'
            };
            return JSON.stringify(errorSummary);
        }
        const estimatedTokens = this.estimateTokens(text);
        if (estimatedTokens <= 2000) {
            // Si es pequeño, devolver el texto completo
            return JSON.stringify(pdfResult);
        }
        // Para PDFs grandes, crear un resumen estructurado
        const chunks = this.chunkText(text, 1000);
        const preview = chunks[0]; // Primer chunk como preview
        const summary = {
            type: 'pdf_summary',
            pages: pages,
            estimated_tokens: estimatedTokens,
            total_length: text.length,
            preview: preview,
            chunks_available: chunks.length,
            note: `PDF grande detectado (${estimatedTokens} tokens estimados). Mostrando preview del primer fragmento. Use 'read_pdf_chunk' para obtener fragmentos específicos.`
        };
        return JSON.stringify(summary);
    }
    /**
     * Procesa el resultado de herramientas para manejar contenido grande
     */
    processToolResult(toolName, result) {
        // Manejar PDFs especialmente
        if (toolName === 'read_pdf') {
            const resultString = this.createPdfSummary(result);
            const estimatedTokens = this.estimateTokens(resultString);
            // Verificar si agregar este resultado excedería el límite de tokens por conversación
            if (this.conversationTokens + estimatedTokens > this.maxTokensPerConversation) {
                return JSON.stringify({
                    error: `Agregar este PDF excedería el límite de tokens por conversación (${this.maxTokensPerConversation}). Tokens actuales: ${this.conversationTokens}, tokens del PDF: ${estimatedTokens}`,
                    suggestion: 'Inicie una nueva conversación o use read_pdf_chunk para procesar el PDF en fragmentos más pequeños.'
                });
            }
            this.conversationTokens += estimatedTokens;
            return resultString;
        }
        // Para otras herramientas, verificar tamaño general
        const resultString = JSON.stringify(result);
        const estimatedTokens = this.estimateTokens(resultString);
        if (estimatedTokens > 3000) {
            // Truncar resultados muy grandes
            const truncated = resultString.substring(0, 8000);
            const truncatedTokens = this.estimateTokens(truncated);
            this.conversationTokens += truncatedTokens;
            return JSON.stringify({
                type: 'truncated_result',
                content: truncated + '...',
                estimated_tokens: estimatedTokens,
                note: 'Resultado truncado debido al tamaño. Use herramientas más específicas para obtener información detallada.'
            });
        }
        this.conversationTokens += estimatedTokens;
        return resultString;
    }
    /**
     * Reinicia el contador de tokens para nueva conversación
     */
    resetConversation() {
        this.conversationTokens = 0;
    }
    isDestructiveOperation(toolName, args) {
        const destructiveTools = [
            'delete_file_or_directory',
            'delete_multiple_items',
            'move_file_or_directory',
            'copy_file_or_directory', // También puede ser destructivo si sobrescribe
        ];
        const isDestructive = destructiveTools.includes(toolName);
        loggerService_1.logger.debug('Checking if tool is destructive', {
            toolName,
            isDestructive,
            destructiveTools
        });
        return isDestructive;
    }
    getConfirmationMessage(toolName, args) {
        switch (toolName) {
            case 'delete_file_or_directory':
                return `¿Estás seguro de que quieres eliminar "${args.targetPath}"?`;
            case 'delete_multiple_items':
                const fileCount = Array.isArray(args.paths) ? args.paths.length : 1;
                const pathsList = Array.isArray(args.paths)
                    ? args.paths.slice(0, 3).join(', ') +
                        (args.paths.length > 3 ? '...' : '')
                    : '';
                return `¿Estás seguro de que quieres eliminar ${fileCount} elemento(s)? ${pathsList}`;
            case 'move_file_or_directory':
                return `¿Estás seguro de que quieres mover "${args.sourcePath}" a "${args.destPath}"?`;
            case 'copy_file_or_directory':
                return `¿Estás seguro de que quieres copiar "${args.sourcePath}" a "${args.destPath}"? Esto puede sobrescribir archivos existentes.`;
            default:
                return `¿Estás seguro de que quieres ejecutar la operación "${toolName}"?`;
        }
    }
    /**
     * Envía un mensaje a OpenAI con herramientas MCP disponibles
     */
    async sendMessage(messages, options) {
        console.log('📨 [IntegratedMCPService] sendMessage iniciado:', {
            messagesCount: messages.length,
            currentFolder: options?.currentFolder,
            model: this.model,
            conversationTokens: this.conversationTokens
        });
        loggerService_1.logger.debug('IntegratedMCP sendMessage called', {
            messagesCount: messages.length
        });
        // Verificar caché de respuesta completa primero
        const cachedResponse = cacheService_1.cacheService.getCachedResponse(messages, options?.currentFolder);
        if (cachedResponse) {
            console.log('💾 [IntegratedMCPService] Respuesta encontrada en caché');
            loggerService_1.logger.debug('IntegratedMCP returning cached complete response');
            return cachedResponse;
        }
        try {
            // Verificar si el último mensaje es una confirmación
            const lastMessage = messages[messages.length - 1];
            const isConfirmedMessage = lastMessage?.content?.startsWith('CONFIRMADO:');
            // Verificar caché de conversación procesada
            let conversationMessages;
            const cachedConversation = cacheService_1.cacheService.getCachedConversation(messages, options?.currentFolder);
            if (cachedConversation) {
                loggerService_1.logger.debug('IntegratedMCP using cached conversation messages');
                conversationMessages = cachedConversation.messages;
            }
            else {
                conversationMessages = messages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                }));
                // Cachear la conversación procesada
                cacheService_1.cacheService.setCachedConversation(messages, conversationMessages, options?.currentFolder);
            }
            // Obtener herramientas MCP con caché optimizado
            const allTools = cacheService_1.cacheService.getCachedTools(() => this.mcpService.getOpenAIFunctions());
            // Obtener herramientas relevantes basadas en el último mensaje
            const lastMessageContent = lastMessage?.content || '';
            const relevantTools = cacheService_1.cacheService.getRelevantTools(lastMessageContent, allTools);
            loggerService_1.logger.debug('Using relevant tools from cache', {
                relevantCount: relevantTools.length,
                totalCount: allTools.length
            });
            const tools = relevantTools.map(func => ({
                type: 'function',
                function: func,
            }));
            const allToolCalls = [];
            let finalContent = '';
            const maxIterations = 10; // Prevenir bucles infinitos
            let iteration = 0;
            while (iteration < maxIterations) {
                iteration++;
                loggerService_1.logger.debug('Sending request to OpenAI', {
                    model: this.model,
                    toolsCount: tools.length,
                    toolNames: tools.map(t => t.function.name)
                });
                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: conversationMessages,
                    tools: tools.length > 0 ? tools : undefined,
                    tool_choice: 'auto',
                    temperature: 1,
                    max_completion_tokens: 2000,
                });
                loggerService_1.logger.debug('OpenAI response received', {
                    choicesCount: completion.choices?.length || 0,
                    hasMessage: !!completion.choices?.[0]?.message
                });
                const choice = completion.choices[0];
                if (!choice?.message) {
                    loggerService_1.logger.error('No choice or message in OpenAI response');
                    throw new Error('No se recibió respuesta de OpenAI');
                }
                const message = choice.message;
                loggerService_1.logger.debug('Processing OpenAI message', {
                    hasContent: !!message.content,
                    toolCallsCount: message.tool_calls?.length || 0
                });
                finalContent = message.content || '';
                // Si no hay tool_calls, hemos terminado
                if (!message.tool_calls || message.tool_calls.length === 0) {
                    break;
                }
                // Agregar el mensaje del asistente a la conversación
                conversationMessages.push({
                    role: 'assistant',
                    content: message.content,
                    tool_calls: message.tool_calls,
                });
                // Procesar todas las llamadas a herramientas
                for (const toolCall of message.tool_calls) {
                    if (toolCall.type === 'function') {
                        const functionName = toolCall.function.name;
                        let functionArgs = {};
                        try {
                            functionArgs = JSON.parse(toolCall.function.arguments);
                        }
                        catch (error) {
                            loggerService_1.logger.error('Error parsing tool arguments', error);
                            continue;
                        }
                        // Verificar si es una operación destructiva y necesita confirmación
                        // Solo solicitar confirmación si no es un mensaje ya confirmado
                        if (this.isDestructiveOperation(functionName, functionArgs) &&
                            !isConfirmedMessage) {
                            loggerService_1.logger.debug('Destructive operation detected', {
                                functionName,
                                hasConfirmationCallback: !!this.confirmationCallback
                            });
                            if (this.confirmationCallback) {
                                const confirmationMessage = this.getConfirmationMessage(functionName, functionArgs);
                                loggerService_1.logger.debug('Using confirmation callback', { functionName });
                                const confirmed = await this.confirmationCallback(functionName, functionArgs, confirmationMessage);
                                if (!confirmed) {
                                    // Si no se confirma, devolver respuesta con información de cancelación
                                    return {
                                        content: `Operación "${functionName}" cancelada por el usuario.`,
                                        toolCalls: allToolCalls,
                                    };
                                }
                            }
                            else {
                                // Si no hay callback de confirmación, solicitar confirmación al usuario
                                loggerService_1.logger.debug('No confirmation callback, returning needsConfirmation', {
                                    functionName
                                });
                                const confirmationMessage = this.getConfirmationMessage(functionName, functionArgs);
                                loggerService_1.logger.debug('Confirmation message created', {
                                    message: confirmationMessage
                                });
                                return {
                                    content: `Se requiere confirmación para la operación "${functionName}".`,
                                    needsConfirmation: {
                                        toolName: functionName,
                                        args: functionArgs,
                                        message: confirmationMessage,
                                    },
                                    toolCalls: allToolCalls,
                                };
                            }
                        }
                        else if (isConfirmedMessage) {
                            loggerService_1.logger.debug('Operation already confirmed, proceeding', {
                                functionName
                            });
                        }
                        // Ejecutar la herramienta MCP
                        try {
                            const result = await this.mcpService.callTool(functionName, functionArgs, options?.currentFolder
                                ? { cwd: options.currentFolder }
                                : undefined);
                            allToolCalls.push({
                                name: functionName,
                                arguments: functionArgs,
                                result: result,
                            });
                            // Procesar el resultado con chunking inteligente
                            const processedContent = this.processToolResult(functionName, result);
                            // Agregar el resultado procesado a la conversación
                            conversationMessages.push({
                                role: 'tool',
                                content: processedContent,
                                tool_call_id: toolCall.id,
                            });
                        }
                        catch (error) {
                            loggerService_1.logger.error('Error executing tool', { functionName, error });
                            const errorResult = {
                                error: error instanceof Error ? error.message : 'Error desconocido',
                            };
                            allToolCalls.push({
                                name: functionName,
                                arguments: functionArgs,
                                result: errorResult,
                            });
                            // Agregar el error a la conversación
                            conversationMessages.push({
                                role: 'tool',
                                content: JSON.stringify(errorResult),
                                tool_call_id: toolCall.id,
                            });
                        }
                    }
                }
            }
            const response = {
                content: finalContent,
                toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            };
            // Cachear la respuesta completa para futuras consultas similares
            cacheService_1.cacheService.setCachedResponse(messages, response, options?.currentFolder);
            loggerService_1.logger.debug('Response cached for future use');
            return response;
        }
        catch (error) {
            loggerService_1.logger.error('IntegratedMCP error communicating with OpenAI', error);
            throw new Error(`Error de OpenAI: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }
    /**
     * Verifica si el servicio está configurado correctamente
     */
    async checkHealth() {
        try {
            // Verificar que OpenAI responde
            const testCompletion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: 'test' }],
                max_completion_tokens: 1,
            });
            return !!testCompletion.choices[0]?.message;
        }
        catch (error) {
            loggerService_1.logger.error('IntegratedMCP health check failed', error);
            return false;
        }
    }
    /**
     * Obtiene las herramientas disponibles
     */
    getAvailableTools() {
        return this.mcpService.getTools();
    }
    /**
     * Obtiene las herramientas en formato OpenAI
     */
    getOpenAIFunctions() {
        return this.mcpService.getOpenAIFunctions();
    }
}
exports.IntegratedMCPService = IntegratedMCPService;
