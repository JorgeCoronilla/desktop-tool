import pino from 'pino';

// Imports condicionales para compatibilidad con renderer y main process
let path: any = null;
let fs: any = null;

// Solo importar módulos de Node.js si estamos en el main process
if (typeof window === 'undefined') {
  try {
    path = require('path');
    fs = require('fs');
  } catch (error) {
    // Silenciar errores si no estamos en Node.js
  }
}



// Configuración del logger según el entorno
const isDevelopment = process.env.NODE_ENV === 'development';
const isRenderer = typeof window !== 'undefined';

// Configuración base para todos los loggers
const baseConfig = {
  level: isDevelopment ? 'info' : 'info', // Cambiado de 'debug' a 'info' para reducir ruido
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => {
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
      return pino(rendererLoggerConfig);
    } else {
      // En el proceso principal, usamos la configuración completa
      return pino(mainLoggerConfig);
    }
  } catch (error) {
    // Fallback a console si el logger falla
    console.warn('Failed to create pino logger, falling back to console:', error);
    return {
      debug: console.log,
      info: console.log,
      warn: console.warn,
      error: console.error,
      fatal: console.error,
      child: () => createLogger(),
    } as any;
  }
};

// Instancia del logger
const logger = createLogger();

// Wrapper para facilitar el uso y agregar contexto
class LoggerService {
  private logger: pino.Logger;
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
    this.logger = logger.child({ context });
  }

  // Métodos de logging con diferentes niveles
  debug(message: string, data?: any) {
    try {
      this.logger.debug(data, message);
    } catch (error) {
      console.log(`[DEBUG] ${this.context}: ${message}`, data);
    }
  }

  info(message: string, data?: any) {
    try {
      this.logger.info(data, message);
    } catch (error) {
      console.log(`[INFO] ${this.context}: ${message}`, data);
    }
  }

  warn(message: string, data?: any) {
    try {
      this.logger.warn(data, message);
    } catch (error) {
      console.warn(`[WARN] ${this.context}: ${message}`, data);
    }
  }

  error(message: string, error?: Error | any) {
    try {
      if (error instanceof Error) {
        this.logger.error({ 
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        }, message);
      } else {
        this.logger.error(error, message);
      }
    } catch (loggerError) {
      console.error(`[ERROR] ${this.context}: ${message}`, error);
    }
  }

  fatal(message: string, error?: Error | any) {
    try {
      if (error instanceof Error) {
        this.logger.fatal({ 
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        }, message);
      } else {
        this.logger.fatal(error, message);
      }
    } catch (loggerError) {
      console.error(`[FATAL] ${this.context}: ${message}`, error);
    }
  }

  // Método para crear un logger hijo con contexto específico
  child(context: string): LoggerService {
    const childLogger = new LoggerService(`${this.context}:${context}`);
    return childLogger;
  }

  // Método para logging de performance
  time(label: string) {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.debug(`Performance: ${label}`, { duration: `${duration}ms` });
      }
    };
  }

  // Método para logging de requests/responses
  logRequest(method: string, url: string, data?: any) {
    this.info(`Request: ${method} ${url}`, { requestData: data });
  }

  logResponse(method: string, url: string, status: number, data?: any) {
    this.info(`Response: ${method} ${url}`, { status, responseData: data });
  }

  // Método para logging de eventos de la aplicación
  logEvent(event: string, data?: any) {
    this.info(`Event: ${event}`, data);
  }

  // Método para logging de errores de componentes React
  logComponentError(componentName: string, error: Error, errorInfo?: any) {
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

// Instancia por defecto
const defaultLogger = new LoggerService('App');

// Función helper para reemplazar console.log con filtrado inteligente
const replaceConsole = () => {
  if (isDevelopment) {
    // En desarrollo, mantenemos console.log original pero filtramos logs innecesarios
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Filtros para evitar logs innecesarios
    const shouldSkipLog = (args: any[]) => {
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

    console.log = (...args: any[]) => {
      originalLog(...args);
      // Solo loggear si no es ruido
      if (!shouldSkipLog(args)) {
        defaultLogger.debug('Console Log', { args });
      }
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      if (!shouldSkipLog(args)) {
        defaultLogger.warn('Console Warn', { args });
      }
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      if (!shouldSkipLog(args)) {
        defaultLogger.error('Console Error', { args });
      }
    };
  } else {
    // En producción, reemplazamos completamente console pero con filtrado
    console.log = (...args: any[]) => {
      if (args.length > 0 && args[0] && typeof args[0] === 'string') {
        defaultLogger.info('Console Log', { args });
      }
    };
    console.warn = (...args: any[]) => defaultLogger.warn('Console Warn', { args });
    console.error = (...args: any[]) => defaultLogger.error('Console Error', { args });
  }
};

export { LoggerService, defaultLogger as logger, replaceConsole };
export default LoggerService;