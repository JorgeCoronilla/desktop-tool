# Diseño de Arquitectura MCP para Desktop Helper

## 🎯 Objetivo
Migrar la aplicación Desktop Helper del sistema actual de function calling manual a una arquitectura basada en Model Context Protocol (MCP) usando OpenAI Responses API.

## 📊 Análisis de la Situación Actual

### ✅ Componentes que se mantienen:
- **Servidor MCP Integrado** (`src/mcp/electronMcpServer.ts`) - ✅ Completamente funcional con 14 herramientas
- **Servidor HTTP MCP** (`src/mcp/httpServer.ts`) - ✅ Para integración con Claude Desktop
- **Interfaz de usuario** (`src/components/`) - ✅ Solo requiere cambios menores
- **Lógica de herramientas** (`src/tools/llmTools.ts`) - ✅ Reutilizable

### ❌ Componentes que se reemplazan:
- **OpenAI Service** (`src/services/openaiService.ts`) - Migrar a Responses API
- **Tool Manager** (`src/tools/toolManager.ts`) - Eliminar parsing manual
- **Lógica de App.tsx** - Simplificar flujo de mensajes

## 🏗️ Nueva Arquitectura MCP

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Chat UI       │───▶│  OpenAI          │───▶│   MCP Server    │
│   (React)       │    │  Responses API   │    │   (localhost)   │
│                 │    │                  │    │                 │
│  - Input        │    │  - Tool calls    │    │  - 14 tools     │
│  - Messages     │    │  - Streaming     │    │  - File ops     │
│  - File picker  │    │  - Error handling│    │  - PDF/Excel    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Ventajas de la nueva arquitectura:
1. **Reducción de latencia**: Eliminación de round-trips manuales
2. **Simplificación**: No más parsing de `[TOOL:name](params)`
3. **Escalabilidad**: Gestión centralizada de herramientas
4. **Mantenibilidad**: Separación clara de responsabilidades

## 📋 Plan de Implementación

### Fase 1: Nuevo Servicio OpenAI con MCP
**Archivo**: `src/services/mcpService.ts`

```typescript
interface MCPServiceConfig {
  apiKey: string;
  mcpServerUrl: string;
  allowedTools?: string[];
  requireApproval?: 'always' | 'never' | Record<string, 'always' | 'never'>;
}

class MCPService {
  // Usar OpenAI Responses API en lugar de Chat Completions
  // Configurar MCP server local
  // Manejar streaming de respuestas
  // Gestionar aprobaciones para herramientas destructivas
}
```

**Características clave**:
- Uso de `https://api.openai.com/v1/responses` endpoint
- Configuración MCP con servidor local (`http://localhost:3000`)
- Filtrado de herramientas con `allowed_tools`
- Streaming de respuestas en tiempo real
- Manejo de errores y reconexión automática

### Fase 2: Adaptación de App.tsx
**Cambios principales**:

```typescript
// ANTES (function calling manual)
const { processedMessage, toolCalls, responses } = 
  await toolManager.processLLMMessage(accumulated, { cwd: appState.currentFolder });

// DESPUÉS (MCP automático)
const response = await mcpService.sendMessage(messages, {
  currentFolder: appState.currentFolder,
  onStream: (chunk) => updateMessageContent(chunk)
});
```

**Simplificaciones**:
- Eliminar `toolManager.processLLMMessage`
- Eliminar parsing manual de herramientas
- Eliminar lógica de confirmación manual
- Simplificar manejo de estado de tareas

### Fase 3: Configuración del Servidor MCP
**Puerto y acceso**:
- Servidor MCP corriendo en `http://localhost:3000`
- Configuración en `package.json` para auto-start
- Manejo de errores de conexión

**Herramientas disponibles** (14 total):
1. `read_text_file` - Lectura de archivos de texto
2. `write_text_file` - Escritura de archivos
3. `create_directory` - Creación de directorios
4. `delete_file_or_directory` - Eliminación básica
5. `list_directory` - Listado de directorios
6. `copy_file_or_directory` - Copia de archivos
7. `move_file_or_directory` - Movimiento de archivos
8. `list_files_by_criteria` - Filtrado avanzado
9. `delete_multiple_items` - Eliminación masiva
10. `read_pdf` - Lectura de PDFs
11. `ocr_pdf` - OCR de PDFs escaneados
12. `read_excel` - Lectura de Excel/CSV
13. `write_excel` - Escritura de Excel
14. `modify_excel` - Modificación de Excel

### Fase 4: Optimizaciones
**Filtrado de herramientas**:
```typescript
const allowedTools = [
  'read_text_file', 'write_text_file', 'list_directory',
  'read_pdf', 'read_excel'  // Solo herramientas de lectura por defecto
];
```

**Configuración de aprobaciones**:
```typescript
const requireApproval = {
  'delete_file_or_directory': 'always',
  'delete_multiple_items': 'always',
  'move_file_or_directory': 'always'
};
```

## 🔧 Configuración Técnica

### Dependencias necesarias:
- OpenAI SDK actualizado (>= 4.0.0)
- Servidor MCP ya implementado
- Sin dependencias adicionales

### Variables de entorno:
```env
OPENAI_API_KEY=sk-...
MCP_SERVER_URL=http://localhost:3000
MCP_SERVER_PORT=3000
```

### Scripts de package.json:
```json
{
  "scripts": {
    "start": "npm run build && npm run build:main && electron dist/main/main/main.js",
    "mcp:http-build": "tsc src/mcp/httpServer.ts --outDir dist/mcp ...",
    "mcp:http-server": "npm run mcp:http-build && node dist/mcp/httpServer.js"
  }
}
```

## 🧪 Plan de Testing

### Fase de testing:
1. **Conexión MCP**: Verificar comunicación con servidor local
2. **Herramientas básicas**: Probar lectura/escritura de archivos
3. **Herramientas avanzadas**: Probar PDF y Excel
4. **Streaming**: Verificar respuestas en tiempo real
5. **Manejo de errores**: Probar reconexión y fallbacks
6. **Aprobaciones**: Verificar flujo de herramientas destructivas

### Métricas de éxito:
- ✅ Reducción de latencia en tool calls
- ✅ Eliminación de errores de parsing manual
- ✅ Mantenimiento de todas las funcionalidades actuales
- ✅ Mejora en la experiencia de usuario

## 🚀 Cronograma

1. **Día 1**: Implementar MCPService
2. **Día 2**: Adaptar App.tsx y eliminar toolManager
3. **Día 3**: Testing y optimizaciones
4. **Día 4**: Documentación y deployment

## 📝 Notas de Implementación

### Consideraciones especiales:
- Mantener compatibilidad con Electron y web
- Preservar funcionalidad de selección de carpetas
- Conservar sistema de mensajes y estado
- Asegurar manejo correcto de archivos grandes (PDFs, Excel)

### Rollback plan:
- Mantener rama actual como backup
- Implementación incremental con feature flags
- Testing exhaustivo antes de merge final