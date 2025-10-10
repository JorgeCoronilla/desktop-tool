# Documentación de Diseño - Desktop Helper

## Descripción General

Desktop Helper es una aplicación de escritorio con una interfaz moderna y minimalista que combina un explorador de archivos con un asistente de IA. El diseño prioriza la funcionalidad y la claridad, utilizando un sistema de temas claro/oscuro y una arquitectura visual basada en paneles.

## Sistema de Colores

### Variables CSS Globales

La aplicación utiliza un sistema de variables CSS que permite el cambio dinámico entre temas:

#### Tema Base (Claro)
```css
:root {
  /* Fondos */
  --color-bg-0: #ffffff;      /* Fondo principal */
  --color-bg-1: #f8f9fa;      /* Fondo secundario */
  --color-bg-2: #e9ecef;      /* Fondo terciario */
  
  /* Textos */
  --color-text: #212529;      /* Texto principal */
  --color-text-muted: #6c757d; /* Texto secundario */
  
  /* Bordes */
  --color-border: #dee2e6;    /* Bordes generales */
  
  /* Botones Primarios */
  --btn-primary-bg: #007bff;
  --btn-primary-text: #ffffff;
  --btn-primary-hover-bg: #0056b3;
  
  /* Botones Secundarios */
  --btn-secondary-bg: #6c757d;
  --btn-secondary-text: #ffffff;
  --btn-secondary-hover-bg: #545b62;
  
  /* Botones de Peligro */
  --btn-danger-bg: #dc3545;
  --btn-danger-text: #ffffff;
  --btn-danger-hover-bg: #c82333;
}
```

#### Tema Oscuro
```css
[data-theme="dark"] {
  --color-bg-0: #1a1a1a;
  --color-bg-1: #2d2d2d;
  --color-bg-2: #404040;
  --color-text: #e1e4e8;
  --color-text-muted: #8b949e;
  --color-border: #30363d;
}
```

### Colores Específicos de Componentes

#### Chat
- **Mensajes del Usuario**: `#e3f2fd` (fondo), `#1976d2` (texto)
- **Mensajes del Asistente**: `#f5f5f5` (fondo), `#333333` (texto)
- **Sombras**: `0 2px 8px rgba(0, 0, 0, 0.1)`

#### Explorador de Archivos
- **Carpetas**: `#f9c23c` (icono dorado)
- **Hover**: Transformación `translateX(2px)` con fondo de hover
- **Botones de Expansión**: `#8b949e` con hover a `#e1e4e8`

## Tipografía

### Fuente Principal
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Jerarquía Tipográfica
- **Títulos de Sección**: `font-weight: 600`, `line-height: 40px`
- **Texto Principal**: `font-size: 14px`, `font-weight: 500`
- **Texto Secundario**: `font-size: 12px`, `font-weight: 400`
- **Mensajes de Chat**: `font-size: 14px`, `line-height: 1.5`

## Layout y Estructura

### Arquitectura de Paneles

La aplicación utiliza un layout de grid CSS con tres áreas principales:

```css
.layout-container {
  display: grid;
  grid-template-areas:
    "header header"
    "chat files";
  grid-template-rows: 40px 1fr;
  grid-template-columns: 1fr 300px;
  height: 100vh;
}
```

#### Componentes del Layout:
1. **Header** (`40px` altura): Barra superior con controles globales
2. **Panel de Chat** (flexible): Área principal de conversación
3. **Panel de Archivos** (`300px` ancho): Explorador de archivos lateral

### Dimensiones y Espaciado

- **Padding estándar**: `8px`, `12px`, `16px`
- **Bordes redondeados**: `6px` (elementos pequeños), `12px` (burbujas de chat)
- **Alturas fijas**: Header `40px`, botones `44px`
- **Gaps**: `8px` entre elementos relacionados

## Componentes de UI

### Botones

#### Botón Primario
```css
.send-button {
  background-color: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  border-radius: 6px;
  padding: 12px 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
```

#### Estados de Botones
- **Normal**: Colores base del tema
- **Hover**: Cambio de color de fondo
- **Disabled**: Opacidad reducida, cursor no permitido
- **Danger**: Variante roja para acciones destructivas

### Inputs y Formularios

#### Textarea de Chat
```css
.message-input {
  width: 100%;
  min-height: 88px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  resize: vertical;
  font-family: inherit;
}
```

#### Input de Tokens
```css
.token-input {
  width: 90px;
  background-color: var(--color-bg-1);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px;
  font-size: 14px;
}
```

### Elementos de Lista

#### Items del Explorador de Archivos
```css
.file-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 6px;
  margin: 2px 0;
  min-height: 32px;
}

.file-item:hover {
  background-color: var(--file-item-hover-bg);
  transform: translateX(2px);
}
```

## Experiencia de Usuario (UX)

### Flujos de Interacción

#### 1. Flujo Principal de Chat
1. **Inicio**: Estado vacío con mensaje de bienvenida
2. **Selección de Carpeta**: Usuario selecciona directorio de trabajo
3. **Conversación**: Intercambio de mensajes con el asistente
4. **Feedback Visual**: Indicadores de carga y estados

#### 2. Navegación de Archivos
1. **Exploración**: Click en carpetas para expandir/contraer
2. **Selección**: Click en archivos para operaciones
3. **Feedback**: Hover effects y transformaciones visuales

#### 3. Gestión de Tokens
1. **Configuración**: Input numérico para límite de tokens
2. **Validación**: Rango 100-4096 con pasos de 50
3. **Persistencia**: Valor mantenido durante la sesión

### Estados de la Aplicación

#### Estados del Chat
- **Vacío**: Mensaje de bienvenida centrado
- **Conversación**: Lista de mensajes con scroll automático
- **Cargando**: Indicador "Pensando..." con puntos animados
- **Scroll**: Botón flotante "Ir al final" cuando no está en el bottom

#### Estados del Explorador
- **Vacío**: Mensaje informativo centrado
- **Cargando**: Indicador de carga centrado
- **Poblado**: Lista de archivos y carpetas
- **Expandido**: Vista de árbol con indentación

## Patrones de Diseño

### 1. Sistema de Temas
- Variables CSS para cambio dinámico de colores
- Soporte automático para preferencias del sistema
- Consistencia visual entre componentes

### 2. Feedback Visual
- **Transiciones**: `0.2s ease` para cambios suaves
- **Hover Effects**: Cambios de color y transformaciones
- **Estados de Carga**: Indicadores claros de progreso

### 3. Responsive Design
- Layout flexible con grid CSS
- Componentes que se adaptan al contenido
- Scroll independiente por panel

### 4. Accesibilidad
- Contraste adecuado entre colores
- Labels y títulos descriptivos
- Navegación por teclado (Enter, Shift+Enter)
- Estados de focus visibles

## Componentes Reutilizables

### 1. Empty State
```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 32px 20px;
  font-size: 14px;
  line-height: 1.5;
}
```

### 2. Loading Indicator
```css
.loading-indicator {
  align-self: flex-start;
  background-color: var(--chat-assistant-bg);
  color: var(--chat-assistant-text);
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
}
```

### 3. Scroll to Bottom Button
```css
.scrollToBottomButton {
  position: absolute;
  right: 16px;
  bottom: 16px;
  background-color: var(--btn-primary-bg);
  border-radius: 999px;
  padding: 8px 12px;
  box-shadow: var(--chat-bubble-shadow);
}
```

## Animaciones y Transiciones

### Transiciones Estándar
- **Duración**: `0.2s`
- **Easing**: `ease`
- **Propiedades**: `all` para cambios generales

### Efectos Específicos
- **File Item Hover**: `translateX(2px)` para efecto de deslizamiento
- **Button Hover**: Cambios de color suaves
- **Expand Button**: `scale(1.1)` en hover

## Iconografía

### Sistema de Iconos
- **Carpetas**: Emoji `📁` con color dorado `#f9c23c`
- **Archivos**: Iconos por defecto del sistema
- **Expansión**: Caracteres Unicode `▶` y `▼`
- **Navegación**: Flecha `↓` para scroll to bottom

### Tamaños de Iconos
- **Archivos**: `18x18px`
- **Expansión**: `14x14px`
- **Botones**: `16px` font-size

## Consideraciones de Rendimiento

### Optimizaciones CSS
- Variables CSS para evitar repetición
- Transiciones solo en propiedades necesarias
- Uso eficiente de flexbox y grid

### Scroll Performance
- Scroll independiente por contenedor
- Auto-scroll inteligente basado en posición
- Threshold de 120px para detección de "near bottom"

## Mejores Prácticas

### 1. Consistencia Visual
- Uso sistemático de variables CSS
- Espaciado coherente en toda la aplicación
- Jerarquía tipográfica clara

### 2. Usabilidad
- Feedback inmediato en interacciones
- Estados claros para todas las acciones
- Navegación intuitiva

### 3. Mantenibilidad
- Separación clara entre estructura y estilo
- Nomenclatura descriptiva de clases CSS
- Documentación inline en código crítico

Esta documentación de diseño complementa la documentación técnica (`structure.md`) y la documentación de producto (`product.md`), proporcionando una guía completa para el desarrollo y mantenimiento de la interfaz de usuario de Desktop Helper.