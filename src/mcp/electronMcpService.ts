import { ElectronMCPServer, MCPToolCall, MCPToolResponse } from './electronMcpServer';

/**
 * Servicio MCP para comunicación interna en Electron
 * Reemplaza la comunicación HTTP con llamadas directas
 */
export class ElectronMCPService {
  private mcpServer: ElectronMCPServer;

  constructor() {
    this.mcpServer = new ElectronMCPServer();
  }

  /**
   * Ejecuta una herramienta MCP
   */
  async callTool(name: string, arguments_: Record<string, any>, options?: { cwd?: string }): Promise<MCPToolResponse> {
    const toolCall: MCPToolCall = {
      name,
      arguments: arguments_
    };

    return await this.mcpServer.executeTool(toolCall, options);
  }

  /**
   * Obtiene la lista de herramientas disponibles
   */
  getTools() {
    return this.mcpServer.getAvailableTools();
  }

  /**
   * Genera documentación de herramientas para OpenAI
   */
  generateToolDocumentation(): string {
    const tools = this.getTools();
    
    let documentation = "# Herramientas Disponibles\n\n";
    documentation += "Tienes acceso a las siguientes herramientas para ayudar al usuario:\n\n";

    for (const tool of tools) {
      documentation += `## ${tool.name}\n`;
      documentation += `**Descripción:** ${tool.description}\n\n`;
      
      if (tool.inputSchema && tool.inputSchema.properties) {
        documentation += "**Parámetros:**\n";
        const properties = tool.inputSchema.properties;
        const required = tool.inputSchema.required || [];
        
        for (const [propName, propSchema] of Object.entries(properties)) {
          const prop = propSchema as any;
          const isRequired = required.includes(propName);
          documentation += `- \`${propName}\` (${prop.type}${isRequired ? ', requerido' : ', opcional'}): ${prop.description || 'Sin descripción'}\n`;
        }
      }
      
      documentation += "\n";
    }

    documentation += "\n## Formato de Uso\n";
    documentation += "Para usar una herramienta, responde con el siguiente formato JSON:\n";
    documentation += "```json\n";
    documentation += "{\n";
    documentation += '  "tool_name": "nombre_de_la_herramienta",\n';
    documentation += '  "arguments": {\n';
    documentation += '    "parametro1": "valor1",\n';
    documentation += '    "parametro2": "valor2"\n';
    documentation += "  }\n";
    documentation += "}\n";
    documentation += "```\n\n";
    documentation += "**IMPORTANTE:** Solo responde con JSON cuando necesites usar una herramienta. Para respuestas normales, usa texto regular.\n";

    return documentation;
  }

  /**
   * Convierte herramientas a formato OpenAI Functions
   */
  getOpenAIFunctions() {
    const tools = this.getTools();
    console.log(`[DEBUG] getOpenAIFunctions called, found ${tools.length} tools`);
    console.log(`[DEBUG] Tool names:`, tools.map(t => t.name));
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }));
  }
}

// Instancia singleton para uso global
export const electronMCPService = new ElectronMCPService();