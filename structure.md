# Desktop Helper - Estructura Técnica

## Descripción General

Desktop Helper es una aplicación de escritorio construida con **Electron** que combina un explorador de archivos inteligente con un asistente de IA. La aplicación utiliza una arquitectura moderna basada en React y TypeScript, con comunicación IPC entre procesos para operaciones del sistema de archivos.

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
│   ├── FileExplorer/   # Explorador de archivos con vista de árbol
│   └── Layout/         # Layout principal y navegación
├── main/               # Proceso principal de Electron
│   ├── main.ts         # Configuración de ventana y handlers IPC
│   └── preload.ts      # Bridge seguro entre procesos
├── renderer/           # Proceso renderer (React app)
│   ├── App.tsx         # Componente raíz de la aplicación
│   ├── index.tsx       # Punto de entrada del renderer
│   ├── index.html      # Template HTML
│   └── styles/         # Estilos globales y temas
├── services/           # Servicios de negocio
│   └── openaiService.ts # Cliente para API de OpenAI
├── tools/              # Sistema de herramientas para IA
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
- **FileExplorer.tsx**: Vista de árbol jerárquica con iconos por tipo de archivo

### Servicios y Herramientas
- **OpenAIService**: Cliente para comunicación con la API de OpenAI
- **ToolManager**: Sistema singleton para gestión y ejecución de herramientas
- **LLMTools**: Conjunto de herramientas que el asistente puede usar (lectura/escritura de archivos, OCR, etc.)

## Sistema de Comunicación IPC

### Handlers Principales
- **Gestión de Archivos**: `select-folder`, `read-directory`, `get-file-stats`
- **Operaciones FS**: `fs-read-text`, `fs-write-text`, `fs-delete`, `fs-copy`, `fs-move`, `fs-mkdir`
- **Procesamiento de Documentos**: `pdf-read`, `pdf-ocr`, `excel-read`, `excel-write`, `excel-modify`
- **OpenAI**: `init-openai`, `send-message-to-openai`, `check-openai-config`

### Flujo de Datos
1. **Renderer → Main**: Solicitudes a través de `ipcRenderer.invoke()`
2. **Main → Renderer**: Respuestas con resultados o errores
3. **Seguridad**: Todas las APIs están expuestas de forma controlada via `preload.ts`

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
  --color-bg-0: #f7f8fa;    /* Fondo de aplicación */
  --color-bg-1: #ffffff;    /* Superficies/tarjetas */
  
  /* Texto */
  --color-text: #1c1e21;         /* Texto principal */
  --color-text-muted: #6b7280;   /* Texto secundario */
  
  /* Botones */
  --btn-primary-bg: #2563eb;     /* Botón primario */
  --btn-danger-bg: #dc2626;      /* Botón de peligro */
  
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

### Performance
- **Lazy Loading**: Carga bajo demanda de componentes
- **Streaming**: Respuestas de IA en tiempo real
- **Debouncing**: Optimización de búsquedas y filtros

### Extensibilidad
- **Plugin System**: Sistema de herramientas modular para IA
- **Tool Manager**: Gestor centralizado de capacidades
- **Type Safety**: Tipado completo con TypeScript

### Compatibilidad
- **Cross-Platform**: Soporte para Windows, macOS y Linux
- **Web Preview**: Modo de vista previa en navegador
- **File System**: Operaciones nativas del sistema de archivos

## Scripts de Desarrollo

```json
{
  "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:main\"",
  "dev:renderer": "webpack serve --mode development",
  "dev:main": "electron src/main/main.ts",
  "build": "webpack --mode production",
  "build:main": "tsc src/main/main.ts --outDir dist",
  "web": "webpack serve --mode development --env web=true"
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

Esta arquitectura proporciona una base sólida, escalable y mantenible para el desarrollo continuo de Desktop Helper.