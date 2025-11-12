/**
 * Utilidad de logging condicional para reducir ruido en consola
 * Permite activar/desactivar diferentes niveles de logging
 */

// Configuración de logging - cambiar a true para activar logs específicos
const DEBUG_CONFIG = {
  CRITICAL: true,        // Errores críticos y problemas importantes
  APP_LIFECYCLE: false,  // Inicialización de servicios, conexiones
  FILE_WATCHER: false,   // Eventos del file watcher
  FOLDER_REFRESH: false, // Operaciones de refresh de carpetas
  MCP_TOOLS: false,      // Interacciones con MCP y herramientas
};

type LogLevel = keyof typeof DEBUG_CONFIG;

class DebugLogger {
  private static shouldLog(level: LogLevel): boolean {
    return DEBUG_CONFIG[level];
  }

  static critical(message: string, ...args: any[]) {
    if (this.shouldLog('CRITICAL')) {
      console.log(`🔴 [CRITICAL] ${message}`, ...args);
    }
  }

  static appLifecycle(message: string, ...args: any[]) {
    if (this.shouldLog('APP_LIFECYCLE')) {
      console.log(`🟢 [APP] ${message}`, ...args);
    }
  }

  static fileWatcher(message: string, ...args: any[]) {
    if (this.shouldLog('FILE_WATCHER')) {
      console.log(`👁️ [WATCH] ${message}`, ...args);
    }
  }

  static folderRefresh(message: string, ...args: any[]) {
    if (this.shouldLog('FOLDER_REFRESH')) {
      console.log(`🔄 [REFRESH] ${message}`, ...args);
    }
  }

  static mcpTools(message: string, ...args: any[]) {
    if (this.shouldLog('MCP_TOOLS')) {
      console.log(`🔧 [MCP] ${message}`, ...args);
    }
  }

  // Método para activar/desactivar categorías dinámicamente
  static setLogLevel(level: LogLevel, enabled: boolean) {
    (DEBUG_CONFIG as any)[level] = enabled;
    console.log(`🔧 Debug logging for ${level} ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Método para mostrar configuración actual
  static showConfig() {
    console.log('🔧 Current debug configuration:', DEBUG_CONFIG);
  }
}

export default DebugLogger;