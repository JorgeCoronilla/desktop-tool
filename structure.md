# Desktop Helper - Estructura Técnica

## Descripción General

Desktop Helper es una aplicación de escritorio construida con **Electron** que combina un explorador de archivos inteligente con un asistente de IA. La aplicación utiliza una arquitectura moderna basada en React y TypeScript, con **Model Context Protocol (MCP)** para la integración de herramientas de IA y comunicación IPC entre procesos para operaciones del sistema de archivos.

## Stack Tecnológico

### Frontend (Renderer Process)

- **React 18** - Biblioteca de interfaz de usuario
- **TypeScript** - Tipado estático y desarrollo robusto
- **CSS tradicional** - Estilos globales con clases CSS estándar
- **CSS Variables** - Sistema de temas dinámico (light/dark)

### Backend (Main Process)

- **Electron** - Framework para aplicaciones de escritorio multiplataforma
- **Node.js** - Runtime del proceso principal
- **IPC (Inter-Process Communication)** - Comunicación entre procesos

### Arquitectura MCP (Model Context Protocol)

- **@modelcontextprotocol/sdk** - SDK oficial de Anthropic para MCP
- **ElectronMCPServer** - Servidor MCP integrado para ejecución directa
- **IntegratedMCPService** - Servicio que combina OpenAI con MCP
- **HTTP MCP Server** - Servidor HTTP independiente para desarrollo

### Herramientas de Desarrollo

- **Webpack** - Bundler y configuración de desarrollo
- **ts-loader** - Compilador de TypeScript para Webpack
- **css-loader & style-loader** - Procesamiento de CSS tradicional
- **HtmlWebpackPlugin** - Generación de HTML
- **React Refresh** - Hot reload para desarrollo
- **Prettier** - Formateo de código
- **concurrently** - Ejecución paralela de scripts

### Librerías Especializadas

- **OpenAI** - Integración con modelos de IA
- **pdf-parse** - Extracción de texto de PDFs
- **pdf2pic** - Conversión de PDF a imágenes
- **tesseract.js** - OCR (Reconocimiento Óptico de Caracteres)
- **xlsx** - Manipulación de archivos Excel
- **csv-parser** - Procesamiento de archivos CSV
- **fs-extra** - Operaciones avanzadas del sistema de archivos
- **react-markdown** - Renderizado de Markdown
- **remark-gfm** - Soporte para GitHub Flavored Markdown

## Arquitectura del Proyecto

### Estructura de Carpetas

```
src/
├── components/          # Componentes React reutilizables
│   ├── Chat/           # Interfaz de chat con IA
│   ├── FileExplorer/   # Explorador de archivos con vista de árbol jerárquica
│   └── Layout/         # Layout principal y navegación
├── main/               # Proceso principal de Electron
│   ├── main.ts         # Configuración de ventana y handlers IPC
│   └── preload.ts      # Bridge seguro entre procesos
├── mcp/                # Arquitectura Model Context Protocol
│   ├── electronMcpServer.ts    # Servidor MCP integrado para Electron (14 herramientas)
│   ├── electronMcpService.ts   # Servicio MCP para comunicación interna
│   └── httpServer.ts          # Servidor HTTP MCP para Claude Desktop
├── renderer/           # Proceso renderer (React app)
│   ├── App.tsx         # Componente raíz de la aplicación
│   ├── index.tsx       # Punto de entrada del renderer
│   ├── index.html      # Template HTML
│   └── styles/         # Estilos globales y temas
├── services/           # Servicios de negocio
│   ├── integratedMcpService.ts # Servicio integrado OpenAI + MCP
│   ├── mcpService.ts          # Cliente MCP con OpenAI Responses API
│   ├── mcpServiceWrapper.ts   # Wrapper seguro para MCP
│   └── openaiService.ts       # Cliente para API de OpenAI (legacy)
├── tools/              # Sistema de herramientas para IA (legacy)
│   ├── llmTools.ts     # Definición de herramientas disponibles
│   ├── toolManager.ts  # Gestor y ejecutor de herramientas
│   └── fileRenamer.ts  # Utilidad para renombrado de archivos
└── types/              # Definiciones de tipos TypeScript
    └── global.d.ts     # Tipos globales y interfaces
```

## Arquitectura de Componentes

### Proceso Principal (Main Process)

- **main.ts**: Gestiona la ventana principal, configuración de seguridad y handlers IPC
- **preload.ts**: Expone APIs seguras al renderer a través de `contextBridge`

### Proceso Renderer (Frontend)

- **App.tsx**: Componente raíz que maneja el estado global y la configuración de OpenAI
- **Layout.tsx**: Layout principal con header, navegación y paneles redimensionables
- **Chat.tsx**: Interfaz de chat con soporte para streaming, límites de tokens y cancelación
- **FileExplorer.tsx**: Vista de árbol jerárquica con iconos por tipo de archivo, cache inteligente y actualización automática

### Arquitectura MCP (Model Context Protocol)

- **ElectronMCPServer**: Servidor MCP integrado que ejecuta herramientas directamente sin transporte de red
- **IntegratedMCPService**: Servicio que combina OpenAI con ElectronMCPService para comunicación interna
- **MCPService**: Cliente MCP que utiliza OpenAI Responses API para integración con servidor HTTP
- **MCPServiceWrapper**: Wrapper seguro para comunicación MCP entre procesos

### Servicios y Herramientas

- **IntegratedMCPService**: Servicio principal que combina OpenAI con capacidades MCP
  - Soporte para modelos GPT-5, GPT-5-mini, GPT-5-nano (recomendados)
  - Límites dinámicos basados en modelo y tier de OpenAI API
  - Sistema de tokens inteligente para procesamiento de PDFs
- **OpenAIService**: Cliente para comunicación con la API de OpenAI (legacy)
  - Modelos soportados: GPT-5 series, GPT-4o series, GPT-4, GPT-3.5-turbo
  - GPT-5 como modelo por defecto (más eficiente y económico)
- **ToolManager**: Sistema singleton para gestión y ejecución de herramientas (legacy)
- **LLMTools**: Conjunto de herramientas que el asistente puede usar (lectura/escritura de archivos, OCR, etc.)

## Sistema de Comunicación IPC

### Handlers Principales

- **Gestión de Archivos**: `select-folder`, `read-directory`, `get-file-stats`
- **Operaciones FS**: `fs-read-text`, `fs-write-text`, `fs-delete`, `fs-copy`, `fs-move`, `fs-mkdir`
- **Procesamiento de Documentos**: `pdf-read`, `pdf-ocr`, `excel-read`, `excel-write`, `excel-modify`
- **OpenAI**: `init-openai`, `send-message-to-openai`, `check-openai-config`
- **MCP Integrado**: `mcp-service-init`, `mcp-service-send-message`, `mcp-service-check-health`, `mcp-service-get-tools`
- **MCP Legacy**: `mcp-call-tool`, `mcp-get-tools`, `mcp-get-tool-documentation`, `mcp-get-openai-functions`

### Flujo de Datos

1. **Renderer → Main**: Solicitudes a través de `ipcRenderer.invoke()`
2. **Main → Renderer**: Respuestas con resultados o errores
3. **MCP Integration**: Comunicación directa con ElectronMCPService sin transporte de red
4. **Seguridad**: Todas las APIs están expuestas de forma controlada via `preload.ts`

## Sistema de Estilos y Temas

### Arquitectura CSS

- **CSS Variables**: Sistema de temas basado en custom properties
- **CSS Global**: Estilos globales con clases CSS tradicionales
- **Responsive Design**: Layout adaptativo con paneles redimensionables

### Temas Disponibles

- **Light Theme**: Tema claro por defecto
- **Dark Theme**: Tema oscuro con variables CSS sobrescritas
- **Persistencia**: Preferencia guardada en `localStorage`

### Variables de Tema

```css
:root {
  /* Colores de fondo */
  --color-bg-0: #f7f8fa; /* Fondo de aplicación */
  --color-bg-1: #ffffff; /* Superficies/tarjetas */

  /* Texto */
  --color-text: #1c1e21; /* Texto principal */
  --color-text-muted: #6b7280; /* Texto secundario */

  /* Botones */
  --btn-primary-bg: #2563eb; /* Botón primario */
  --btn-danger-bg: #dc2626; /* Botón de peligro */

  /* Chat */
  --chat-user-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --chat-assistant-bg: #f3f4f6;
}
```

## Características Técnicas Destacadas

### Seguridad

- **Context Isolation**: Aislamiento completo entre procesos
- **Preload Script**: Bridge seguro para APIs del sistema
- **No Node Integration**: Renderer sin acceso directo a Node.js
- **MCP Security**: Validación automática de parámetros y herramientas

### Performance

- **Lazy Loading**: Carga bajo demanda de componentes
- **Streaming**: Respuestas de IA en tiempo real
- **Debouncing**: Optimización de búsquedas y filtros
- **Folder Cache**: Sistema inteligente de cache para explorador de archivos
- **Auto-refresh**: Actualización automática del árbol de archivos tras operaciones MCP

### Extensibilidad

- **MCP Protocol**: Protocolo estándar de Anthropic para herramientas de IA
- **Plugin System**: Sistema de herramientas modular para IA
- **Tool Manager**: Gestor centralizado de capacidades (legacy)
- **Type Safety**: Tipado completo con TypeScript
- **14 Herramientas MCP**: Conjunto completo de operaciones de archivos y documentos

### Compatibilidad

- **Cross-Platform**: Soporte para Windows, macOS y Linux
- **Web Preview**: Modo de vista previa en navegador
- **File System**: Operaciones nativas del sistema de archivos
- **MCP Standards**: Compatibilidad con Claude Desktop y otros clientes MCP

## Scripts de Desarrollo

```json
{
  "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:main\"",
  "dev:renderer": "webpack serve --mode development",
  "dev:main": "electron src/main/main.ts",
  "build": "webpack --mode production",
  "build:main": "tsc src/main/main.ts --outDir dist",
  "web": "webpack serve --mode development --env web=true",

  "mcp:http-server": "node scripts/start-mcp-server.js"
}
```

## Configuración de Build

### Webpack

- **Modo Desarrollo**: Hot reload y source maps
- **Modo Producción**: Minificación y optimización
- **Modo Web**: Build para preview en navegador

### TypeScript

- **Target**: ES2020
- **Module**: CommonJS para main, ES6 para renderer
- **Strict Mode**: Tipado estricto habilitado
- **JSX**: React JSX transform

## Beneficios de la Arquitectura MCP

### Ventajas sobre el Sistema Anterior

- **Simplificación**: Eliminación de parsing manual de herramientas `[TOOL:name](params)`
- **Estándares**: Uso del protocolo oficial de Anthropic para herramientas de IA
- **Rendimiento**: Reducción de latencia con comunicación directa
- **Mantenibilidad**: Código más limpio sin estados complejos (IDLE, IN_PROGRESS, COMPLETED)
- **Escalabilidad**: Gestión centralizada de herramientas con validación automática

### Herramientas MCP Disponibles (14 total)

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
12. `read_excel` - Lectura de archivos Excel
13. `write_excel` - Escritura de archivos Excel
14. `modify_excel` - Modificación de archivos Excel

## Sistema de Límites de Tokens y Modelos GPT-5

### Modelos Soportados

La aplicación ahora soporta la serie completa de modelos GPT-5 de OpenAI:

- **GPT-5**: Modelo principal más reciente ($1.25/1M input, $10.00/1M output)
- **GPT-5-mini**: Optimizado para tareas simples ($0.25/1M input, $2.00/1M output)  
- **GPT-5-nano**: Ultra-eficiente para procesamiento básico ($0.05/1M input, $0.40/1M output)
- **GPT-4o/GPT-4o-mini**: Modelos anteriores mantenidos para compatibilidad

### Límites Dinámicos por Tier

El sistema implementa límites dinámicos basados en el tier de OpenAI API:

**Tier 1 (Implementación Actual)**:
- GPT-5: 30,000 TPM, 12,000 tokens/mensaje, 25,000 tokens/conversación
- GPT-5-mini/nano: 200,000 TPM, 12,000 tokens/mensaje, 25,000 tokens/conversación

### Sistema Inteligente de Tokens

- **Estimación automática**: ~3 caracteres = 1 token
- **Control por mensaje**: Máximo 12,000 tokens por solicitud
- **Control por conversación**: Máximo 25,000 tokens acumulados
- **Reinicio automático**: Los contadores se reinician al cambiar conversación

### Procesamiento de PDFs Optimizado

- **Fragmentación inteligente**: División automática de documentos grandes
- **Límites adaptativos**: Ajuste según el modelo seleccionado
- **Manejo de errores**: Sugerencias automáticas cuando se exceden límites
- **Acumulación de tokens**: Seguimiento de tokens de todas las herramientas MCP

### Documentación Técnica

Para detalles completos sobre implementación y configuración, consultar:
- `docs/token-limits-and-models.md` - Documentación técnica completa
- `src/services/integratedMcpService.ts` - Implementación principal
- `src/services/openaiService.ts` - Configuración de modelos

Esta arquitectura proporciona una base sólida, escalable y mantenible para el desarrollo continuo de Desktop Helper, siguiendo estándares de la industria y mejorando significativamente la experiencia de desarrollo y usuario.
