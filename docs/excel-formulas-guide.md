# Guía de Fórmulas de Excel

Esta guía describe las nuevas capacidades de manejo de fórmulas de Excel implementadas en Desktop Helper.

## Nuevas Herramientas Disponibles

### 1. `read_excel_with_formulas`

Lee un archivo Excel preservando y calculando las fórmulas.

**Parámetros:**
- `filePath` (string): Ruta al archivo Excel
- `sheetName` (string, opcional): Nombre de la hoja específica
- `calculateFormulas` (boolean, opcional): Si calcular las fórmulas (por defecto: true)

**Respuesta:**
```json
{
  "sheets": ["Hoja1", "Hoja2"],
  "currentSheet": "Hoja1",
  "data": [...],
  "formulaData": [...],
  "formulas": [
    {
      "cell": "D2",
      "formula": "B2*C2",
      "value": 2000
    }
  ],
  "rowCount": 10,
  "formulaCount": 5,
  "calculated": true
}
```

### 2. `add_excel_formulas`

Agrega fórmulas a celdas específicas de un archivo Excel.

**Parámetros:**
- `filePath` (string): Ruta al archivo Excel
- `formulas` (object):
  - `sheetName` (string, opcional): Nombre de la hoja
  - `cellFormulas` (array): Array de objetos con `cell` y `formula`

**Ejemplo:**
```json
{
  "filePath": "ventas.xlsx",
  "formulas": {
    "sheetName": "Ventas",
    "cellFormulas": [
      {"cell": "D2", "formula": "B2*C2"},
      {"cell": "D3", "formula": "B3*C3"},
      {"cell": "D10", "formula": "SUM(D2:D9)"}
    ]
  }
}
```

### 3. `calculate_excel_formulas`

Calcula todas las fórmulas en un archivo Excel y guarda los resultados.

**Parámetros:**
- `filePath` (string): Ruta al archivo Excel
- `sheetName` (string, opcional): Nombre de la hoja específica

**Respuesta:**
```json
{
  "sheetName": "Ventas",
  "rowCount": 10,
  "calculated": true
}
```

### 4. `get_excel_formulas_info`

Obtiene información detallada sobre las fórmulas en un archivo Excel.

**Parámetros:**
- `filePath` (string): Ruta al archivo Excel
- `sheetName` (string, opcional): Nombre de la hoja específica

**Respuesta:**
```json
{
  "sheetName": "Ventas",
  "formulas": [
    {
      "cell": "D2",
      "formula": "B2*C2",
      "value": 2000,
      "type": "number",
      "dependencies": ["B2", "C2"]
    }
  ],
  "formulaCount": 5,
  "formulaTypes": {
    "formula": 5
  },
  "totalCells": 100,
  "formulaPercentage": "5.00"
}
```

## Casos de Uso Comunes

### 1. Análisis de Datos con Fórmulas

```javascript
// Leer archivo con fórmulas calculadas
const result = await readExcelWithFormulas({
  filePath: "ventas.xlsx",
  sheetName: "Ventas",
  calculateFormulas: true
});

console.log(`Encontradas ${result.formulaCount} fórmulas`);
result.formulas.forEach(f => {
  console.log(`${f.cell}: ${f.formula} = ${f.value}`);
});
```

### 2. Crear Reportes Automáticos

```javascript
// Agregar fórmulas de cálculo automático
await addExcelFormulas({
  filePath: "reporte.xlsx",
  formulas: {
    sheetName: "Resumen",
    cellFormulas: [
      {"cell": "E2", "formula": "SUM(B2:D2)"},
      {"cell": "E3", "formula": "SUM(B3:D3)"},
      {"cell": "E10", "formula": "SUM(E2:E9)"},
      {"cell": "F10", "formula": "AVERAGE(E2:E9)"}
    ]
  }
});
```

### 3. Auditoría de Fórmulas

```javascript
// Obtener información detallada de fórmulas
const info = await getExcelFormulasInfo({
  filePath: "presupuesto.xlsx",
  sheetName: "Cálculos"
});

console.log(`Porcentaje de celdas con fórmulas: ${info.formulaPercentage}%`);
info.formulas.forEach(f => {
  console.log(`${f.cell} depende de: ${f.dependencies.join(', ')}`);
});
```

## Funciones de Excel Soportadas

La implementación utiliza `xlsx-calc` que soporta una amplia gama de funciones de Excel:

### Funciones Matemáticas
- `SUM`, `AVERAGE`, `COUNT`, `MAX`, `MIN`
- `ROUND`, `ROUNDUP`, `ROUNDDOWN`
- `ABS`, `SQRT`, `POWER`

### Funciones Lógicas
- `IF`, `AND`, `OR`, `NOT`
- `IFERROR`, `ISBLANK`, `ISNUMBER`

### Funciones de Texto
- `CONCATENATE`, `LEFT`, `RIGHT`, `MID`
- `LEN`, `UPPER`, `LOWER`, `TRIM`

### Funciones de Fecha
- `TODAY`, `NOW`, `DATE`, `TIME`
- `YEAR`, `MONTH`, `DAY`

### Funciones de Búsqueda
- `VLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH`

## Limitaciones

1. **Funciones Avanzadas**: Algunas funciones muy específicas de Excel pueden no estar soportadas
2. **Referencias Externas**: No se soportan referencias a otros archivos
3. **Macros**: No se ejecutan macros de VBA
4. **Gráficos**: Los gráficos no se procesan, solo los datos

## Manejo de Errores

Las herramientas manejan errores comunes:

- **Archivo no encontrado**: Se reporta error claro
- **Fórmulas inválidas**: Se registra advertencia pero continúa
- **Referencias circulares**: Se detectan y reportan
- **Celdas inexistentes**: Se crean automáticamente si es necesario

## Ejemplos Prácticos

### Crear un Archivo de Ventas con Fórmulas

```javascript
// 1. Crear datos base
const data = [
  ['Producto', 'Precio', 'Cantidad', 'Total'],
  ['Laptop', 1000, 2, null],
  ['Mouse', 25, 5, null],
  ['Teclado', 75, 3, null]
];

// 2. Agregar fórmulas de cálculo
await addExcelFormulas({
  filePath: "ventas.xlsx",
  formulas: {
    cellFormulas: [
      {"cell": "D2", "formula": "B2*C2"},
      {"cell": "D3", "formula": "B3*C3"},
      {"cell": "D4", "formula": "B4*C4"},
      {"cell": "D5", "formula": "SUM(D2:D4)"}
    ]
  }
});

// 3. Leer resultados calculados
const result = await readExcelWithFormulas({
  filePath: "ventas.xlsx"
});
```

Esta implementación proporciona un manejo robusto y completo de fórmulas de Excel, permitiendo automatizar cálculos complejos y análisis de datos directamente desde Desktop Helper.