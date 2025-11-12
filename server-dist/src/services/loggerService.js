"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceConsole = exports.logger = exports.LoggerService = void 0;
const pino_1 = __importDefault(require("pino"));
// Imports condicionales para compatibilidad con renderer y main process
let path = null;
let fs = null;
// Solo importar módulos de Node.js si estamos en el main process
if (typeof window === 'undefined') {
    try {
        path = require('path');
        fs = require('fs');
    }
    catch (error) {
        // Silenciar errores si no estamos en Node.js
    }
}
// Configuración del logger según el entorno
const isDevelopment = process.env.NODE_ENV === 'development';
const isRenderer = typeof window !== 'undefined';
// Configuración base para todos los loggers
const baseConfig = {
    level: isDevelopment ? 'info' : 'info', // Cambiado de 'debug' a 'info' para reducir ruido
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
};
// Configuración específica para el proceso principal (main)
const mainLoggerConfig = {
    ...baseConfig,
    // Simplificamos la configuración para evitar problemas con workers
    ...(isDevelopment ? {
    // En desarrollo, usamos configuración simple sin transport
    } : {
        // En producción, escribimos a archivo si es posible
        transport: path ? {
            target: 'pino/file',
            options: {
                destination: path.join(process.cwd(), 'logs', 'app.log'),
                mkdir: true,
            },
        } : undefined,
    }),
};
// Configuración específica para el proceso renderer
const rendererLoggerConfig = {
    ...baseConfig,
    browser: {
        asObject: true,
    },
};
// Crear el logger apropiado según el contexto
const createLogger = () => {
    try {
        if (isRenderer) {
            // En el renderer, usamos una configuración más simple
            return (0, pino_1.default)(rendererLoggerConfig);
        }
        else {
            // En el proceso principal, usamos la configuración completa
            return (0, pino_1.default)(mainLoggerConfig);
        }
    }
    catch (error) {
        // Fallback a console si el logger falla
        console.warn('Failed to create pino logger, falling back to console:', error);
        return {
            debug: console.log,
            info: console.log,
            warn: console.warn,
            error: console.error,
            fatal: console.error,
            child: () => createLogger(),
        };
    }
};
// Instancia del logger
const logger = createLogger();
// Wrapper para facilitar el uso y agregar contexto
class LoggerService {
    constructor(context = 'App') {
        this.context = context;
        this.logger = logger.child({ context });
    }
    // Métodos de logging con diferentes niveles
    debug(message, data) {
        try {
            this.logger.debug(data, message);
        }
        catch (error) {
            console.log(`[DEBUG] ${this.context}: ${message}`, data);
        }
    }
    info(message, data) {
        try {
            this.logger.info(data, message);
        }
        catch (error) {
            console.log(`[INFO] ${this.context}: ${message}`, data);
        }
    }
    warn(message, data) {
        try {
            this.logger.warn(data, message);
        }
        catch (error) {
            console.warn(`[WARN] ${this.context}: ${message}`, data);
        }
    }
    error(message, error) {
        try {
            if (error instanceof Error) {
                this.logger.error({
                    error: {
                        message: error.message,
                        stack: error.stack,
                        name: error.name,
                    }
                }, message);
            }
            else {
                this.logger.error(error, message);
            }
        }
        catch (loggerError) {
            console.error(`[ERROR] ${this.context}: ${message}`, error);
        }
    }
    fatal(message, error) {
        try {
            if (error instanceof Error) {
                this.logger.fatal({
                    error: {
                        message: error.message,
                        stack: error.stack,
                        name: error.name,
                    }
                }, message);
            }
            else {
                this.logger.fatal(error, message);
            }
        }
        catch (loggerError) {
            console.error(`[FATAL] ${this.context}: ${message}`, error);
        }
    }
    // Método para crear un logger hijo con contexto específico
    child(context) {
        const childLogger = new LoggerService(`${this.context}:${context}`);
        return childLogger;
    }
    // Método para logging de performance
    time(label) {
        const start = Date.now();
        return {
            end: () => {
                const duration = Date.now() - start;
                this.debug(`Performance: ${label}`, { duration: `${duration}ms` });
            }
        };
    }
    // Método para logging de requests/responses
    logRequest(method, url, data) {
        this.info(`Request: ${method} ${url}`, { requestData: data });
    }
    logResponse(method, url, status, data) {
        this.info(`Response: ${method} ${url}`, { status, responseData: data });
    }
    // Método para logging de eventos de la aplicación
    logEvent(event, data) {
        this.info(`Event: ${event}`, data);
    }
    // Método para logging de errores de componentes React
    logComponentError(componentName, error, errorInfo) {
        this.error(`Component Error in ${componentName}`, {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
            },
            errorInfo,
        });
    }
}
exports.LoggerService = LoggerService;
// Instancia por defecto
const defaultLogger = new LoggerService('App');
exports.logger = defaultLogger;
// Función helper para reemplazar console.log con filtrado inteligente
const replaceConsole = () => {
    if (isDevelopment) {
        // En desarrollo, mantenemos console.log original pero filtramos logs innecesarios
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        // Filtros para evitar logs innecesarios
        const shouldSkipLog = (args) => {
            const firstArg = args[0];
            if (typeof firstArg === 'string') {
                // Filtrar logs de React DevTools, webpack, y otros sistemas internos
                return firstArg.includes('React DevTools') ||
                    firstArg.includes('webpack') ||
                    firstArg.includes('HMR') ||
                    firstArg.includes('Download the React DevTools') ||
                    firstArg.includes('[object Object]');
            }
            // Filtrar objetos vacíos o sin información útil
            if (typeof firstArg === 'object' && firstArg !== null) {
                const str = JSON.stringify(firstArg);
                return str === '{}' || str.includes('[object Object]');
            }
            return false;
        };
        console.log = (...args) => {
            originalLog(...args);
            // Solo loggear si no es ruido
            if (!shouldSkipLog(args)) {
                defaultLogger.debug('Console Log', { args });
            }
        };
        console.warn = (...args) => {
            originalWarn(...args);
            if (!shouldSkipLog(args)) {
                defaultLogger.warn('Console Warn', { args });
            }
        };
        console.error = (...args) => {
            originalError(...args);
            if (!shouldSkipLog(args)) {
                defaultLogger.error('Console Error', { args });
            }
        };
    }
    else {
        // En producción, reemplazamos completamente console pero con filtrado
        console.log = (...args) => {
            if (args.length > 0 && args[0] && typeof args[0] === 'string') {
                defaultLogger.info('Console Log', { args });
            }
        };
        console.warn = (...args) => defaultLogger.warn('Console Warn', { args });
        console.error = (...args) => defaultLogger.error('Console Error', { args });
    }
};
exports.replaceConsole = replaceConsole;
exports.default = LoggerService;
