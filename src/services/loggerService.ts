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

// Configuración base del logger
const baseConfig = {
  level: isDevelopment ? 'debug' : 'info',
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
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : {
    target: 'pino/file',
    options: {
      destination: path ? path.join(process.cwd(), 'logs', 'app.log') : './app.log',
      mkdir: true,
    },
  },
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
  if (isRenderer) {
    // En el renderer, usamos una configuración más simple
    return pino(rendererLoggerConfig);
  } else {
    // En el proceso principal, usamos la configuración completa
    return pino(mainLoggerConfig);
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
    this.logger.debug(data, message);
  }

  info(message: string, data?: any) {
    this.logger.info(data, message);
  }

  warn(message: string, data?: any) {
    this.logger.warn(data, message);
  }

  error(message: string, error?: Error | any) {
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
  }

  fatal(message: string, error?: Error | any) {
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

// Función helper para reemplazar console.log
const replaceConsole = () => {
  if (isDevelopment) {
    // En desarrollo, mantenemos console.log pero también loggeamos
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      originalLog(...args);
      defaultLogger.debug('Console Log', { args });
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      defaultLogger.warn('Console Warn', { args });
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      defaultLogger.error('Console Error', { args });
    };
  } else {
    // En producción, reemplazamos completamente console
    console.log = (...args: any[]) => defaultLogger.debug('Console Log', { args });
    console.warn = (...args: any[]) => defaultLogger.warn('Console Warn', { args });
    console.error = (...args: any[]) => defaultLogger.error('Console Error', { args });
  }
};

export { LoggerService, defaultLogger as logger, replaceConsole };
export default LoggerService;