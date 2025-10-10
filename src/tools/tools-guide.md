# Guía de Herramientas para LLM

## Herramientas Genéricas de Sistema de Archivos

### `list_files_by_criteria`
**Descripción**: Lista archivos en un directorio con criterios de filtrado flexibles.

**Parámetros**:
- `dirPath` (string): Ruta del directorio a listar
- `options` (object, opcional): Criterios de filtrado

**Opciones de filtrado**:
```javascript
{
  includeDirectories: boolean,    // Incluir directorios (default: true)
  includeFiles: boolean,          // Incluir archivos (default: true)
  extensions: string[],           // Extensiones a incluir (ej: ['.pdf', '.txt'])
  excludeExtensions: string[],    // Extensiones a excluir (ej: ['.pdf'])
  namePattern: string,            // Patrón regex para nombres
  excludeNamePattern: string      // Patrón regex para excluir nombres
}
```

**Ejemplos de uso**:
```javascript
// Listar solo archivos no PDF
list_files_by_criteria('/ruta/directorio', {
  includeFiles: true,
  includeDirectories: false,
  excludeExtensions: ['.pdf']
})

// Listar solo archivos PDF
list_files_by_criteria('/ruta/directorio', {
  includeFiles: true,
  includeDirectories: false,
  extensions: ['.pdf']
})

// Listar archivos que contengan "temp" en el nombre
list_files_by_criteria('/ruta/directorio', {
  includeFiles: true,
  includeDirectories: false,
  namePattern: 'temp'
})
```

### `delete_multiple_items`
**Descripción**: Elimina múltiples archivos o directorios de una vez.

**Parámetros**:
- `paths` (array): Array de strings con las rutas completas a eliminar

**Ejemplo de uso**:
```javascript
delete_multiple_items([
  '/ruta/archivo1.txt',
  '/ruta/archivo2.doc',
  '/ruta/directorio'
])
```

## Flujo Recomendado para Tareas Comunes

### Eliminar archivos no PDF de una carpeta:
1. Usar `list_files_by_criteria` con `excludeExtensions: ['.pdf']`
2. Extraer las rutas de los archivos del resultado
3. Usar `delete_multiple_items` con el array de rutas

### Buscar archivos por tipo:
1. Usar `list_files_by_criteria` con `extensions: ['.ext1', '.ext2']`
2. Procesar los resultados según sea necesario

### Limpiar archivos temporales:
1. Usar `list_files_by_criteria` con `namePattern: 'temp|tmp|cache'`
2. Usar `delete_multiple_items` para eliminar los encontrados

## Ventajas del Enfoque Genérico

1. **Flexibilidad**: Una sola herramienta puede manejar múltiples casos de uso
2. **Composabilidad**: El LLM puede combinar criterios para casos complejos
3. **Eficiencia**: Menos herramientas específicas que mantener
4. **Escalabilidad**: Fácil agregar nuevos criterios de filtrado