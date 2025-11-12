/**
 * Sistema de registro automático de herramientas MCP
 * Permite registrar herramientas de forma dinámica y automática
 */

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

export interface ToolCategory {
  name: string;
  description: string;
  tools: MCPToolDefinition[];
}

/**
 * Registro global de herramientas
 */
export class ToolRegistry {
  private tools: Map<string, MCPToolDefinition> = new Map();
  private categories: Map<string, ToolCategory> = new Map();

  /**
   * Registra una herramienta individual
   */
  registerTool(tool: MCPToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Registra una categoría completa de herramientas
   */
  registerCategory(category: ToolCategory): void {
    this.categories.set(category.name, category);
    
    // Registrar todas las herramientas de la categoría
    for (const tool of category.tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Obtiene una herramienta por nombre
   */
  getTool(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Obtiene todas las herramientas registradas
   */
  getAllTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Obtiene todas las categorías
   */
  getAllCategories(): ToolCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Verifica si una herramienta existe
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Elimina una herramienta
   */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Limpia todo el registro
   */
  clear(): void {
    this.tools.clear();
    this.categories.clear();
  }

  /**
   * Obtiene estadísticas del registro
   */
  getStats(): {
    totalTools: number;
    totalCategories: number;
    toolsByCategory: Record<string, number>;
  } {
    const stats = {
      totalTools: this.tools.size,
      totalCategories: this.categories.size,
      toolsByCategory: {} as Record<string, number>
    };

    for (const [categoryName, category] of this.categories) {
      stats.toolsByCategory[categoryName] = category.tools.length;
    }

    return stats;
  }

  /**
   * Registra un handler para una herramienta (método de compatibilidad)
   */
  registerHandler(name: string, handler: (args: any) => Promise<any>): void {
    const tool = this.tools.get(name);
    if (tool) {
      tool.handler = handler;
    } else {
      // Crear una definición básica si no existe
      this.tools.set(name, {
        name,
        description: `Herramienta ${name}`,
        inputSchema: { type: 'object', properties: {} },
        handler
      });
    }
  }

  /**
   * Registra todas las herramientas desde las categorías
   */
  async registerAllTools(): Promise<void> {
    // Este método puede ser extendido para registrar herramientas de forma asíncrona
    // Por ahora, solo aseguramos que las categorías estén registradas
    for (const category of this.categories.values()) {
      for (const tool of category.tools) {
        this.registerTool(tool);
      }
    }
  }

  /**
   * Ejecuta una herramienta por nombre
   */
  async executeTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Herramienta no encontrada: ${name}`);
    }
    return await tool.handler(args);
  }

  /**
   * Convierte herramientas a formato OpenAI Functions
   */
  getOpenAIFunctions(): Array<{
    name: string;
    description: string;
    parameters: any;
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }));
  }
}

/**
 * Instancia global del registro
 */
export const toolRegistry = new ToolRegistry();

/**
 * Decorador para registrar herramientas automáticamente
 */
export function tool(definition: Omit<MCPToolDefinition, 'handler'>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    const toolDef: MCPToolDefinition = {
      ...definition,
      handler: originalMethod.bind(target)
    };

    toolRegistry.registerTool(toolDef);
    
    return descriptor;
  };
}

/**
 * Función auxiliar para crear definiciones de herramientas
 */
export function createToolDefinition(
  name: string,
  description: string,
  inputSchema: MCPToolDefinition['inputSchema'],
  handler: (args: any) => Promise<any>
): MCPToolDefinition {
  return {
    name,
    description,
    inputSchema,
    handler
  };
}