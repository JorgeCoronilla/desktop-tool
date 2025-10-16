const XLSX = require('xlsx');
const xlsxCalc = require('xlsx-calc');

console.log('🧪 Iniciando pruebas completas de fórmulas de Excel...\n');

// Test 1: Crear archivo con fórmulas complejas
function createComplexExcelFile() {
  console.log('📊 Test 1: Creando archivo Excel con fórmulas complejas...');
  
  const workbook = XLSX.utils.book_new();
  
  // Datos de ventas por trimestre
  const salesData = [
    ['Producto', 'Q1', 'Q2', 'Q3', 'Q4', 'Total Anual', 'Promedio', 'Max Trimestre'],
    ['Laptops', 1000, 1200, 1100, 1300, '=SUM(B2:E2)', '=AVERAGE(B2:E2)', '=MAX(B2:E2)'],
    ['Tablets', 800, 900, 850, 950, '=SUM(B3:E3)', '=AVERAGE(B3:E3)', '=MAX(B3:E3)'],
    ['Smartphones', 1500, 1600, 1550, 1700, '=SUM(B4:E4)', '=AVERAGE(B4:E4)', '=MAX(B4:E4)'],
    ['Accesorios', 300, 350, 320, 380, '=SUM(B5:E5)', '=AVERAGE(B5:E5)', '=MAX(B5:E5)'],
    ['', '', '', '', '', '', '', ''],
    ['TOTALES', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)', '=SUM(F2:F5)', '=AVERAGE(F2:F5)', '=MAX(F2:F5)'],
    ['', '', '', '', '', '', '', ''],
    ['Análisis', '', '', '', '', '', '', ''],
    ['Mejor Trimestre', '=INDEX(B1:E1,MATCH(MAX(B7:E7),B7:E7,0))', '', '', '', '', '', ''],
    ['Crecimiento Q4 vs Q1', '=((E7-B7)/B7)*100', '% de crecimiento', '', '', '', '', ''],
    ['Producto Top', '=INDEX(A2:A5,MATCH(MAX(F2:F5),F2:F5,0))', '', '', '', '', '', '']
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(salesData);
  
  // Agregar fórmulas manualmente para preservarlas
  const formulas = [
    // Totales por producto
    { cell: 'F2', formula: 'SUM(B2:E2)' },
    { cell: 'G2', formula: 'AVERAGE(B2:E2)' },
    { cell: 'H2', formula: 'MAX(B2:E2)' },
    { cell: 'F3', formula: 'SUM(B3:E3)' },
    { cell: 'G3', formula: 'AVERAGE(B3:E3)' },
    { cell: 'H3', formula: 'MAX(B3:E3)' },
    { cell: 'F4', formula: 'SUM(B4:E4)' },
    { cell: 'G4', formula: 'AVERAGE(B4:E4)' },
    { cell: 'H4', formula: 'MAX(B4:E4)' },
    { cell: 'F5', formula: 'SUM(B5:E5)' },
    { cell: 'G5', formula: 'AVERAGE(B5:E5)' },
    { cell: 'H5', formula: 'MAX(B5:E5)' },
    
    // Totales por trimestre
    { cell: 'B7', formula: 'SUM(B2:B5)' },
    { cell: 'C7', formula: 'SUM(C2:C5)' },
    { cell: 'D7', formula: 'SUM(D2:D5)' },
    { cell: 'E7', formula: 'SUM(E2:E5)' },
    { cell: 'F7', formula: 'SUM(F2:F5)' },
    { cell: 'G7', formula: 'AVERAGE(F2:F5)' },
    { cell: 'H7', formula: 'MAX(F2:F5)' },
    
    // Análisis avanzado
    { cell: 'B10', formula: 'INDEX(B1:E1,MATCH(MAX(B7:E7),B7:E7,0))' },
    { cell: 'B11', formula: '((E7-B7)/B7)*100' },
    { cell: 'B12', formula: 'INDEX(A2:A5,MATCH(MAX(F2:F5),F2:F5,0))' }
  ];
  
  formulas.forEach(f => {
    if (!worksheet[f.cell]) worksheet[f.cell] = {};
    worksheet[f.cell].f = f.formula;
  });
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas');
  
  // Calcular fórmulas
  try {
    xlsxCalc(workbook);
    console.log('✅ Fórmulas calculadas exitosamente');
  } catch (error) {
    console.log('❌ Error calculando fórmulas:', error.message);
  }
  
  // Guardar archivo
  XLSX.writeFile(workbook, 'test-complex-formulas.xlsx');
  console.log('📁 Archivo guardado: test-complex-formulas.xlsx');
  
  return { workbook, worksheet, formulas };
}

// Test 2: Analizar fórmulas en el archivo
function analyzeFormulas(worksheet) {
  console.log('\n🔍 Test 2: Analizando fórmulas en el archivo...');
  
  const formulas = [];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      if (cell && cell.f) {
        const dependencies = cell.f.match(/[A-Z]+[0-9]+/g) || [];
        formulas.push({
          cell: cellAddress,
          formula: cell.f,
          value: cell.v,
          type: typeof cell.v,
          dependencies: [...new Set(dependencies)]
        });
      }
    }
  }
  
  console.log(`📊 Total de fórmulas encontradas: ${formulas.length}`);
  console.log('\n📋 Detalle de fórmulas:');
  
  formulas.forEach((f, index) => {
    console.log(`${index + 1}. ${f.cell}: ${f.formula} = ${f.value}`);
    if (f.dependencies.length > 0) {
      console.log(`   📎 Depende de: ${f.dependencies.join(', ')}`);
    }
  });
  
  // Estadísticas
  const formulaTypes = formulas.reduce((acc, f) => {
    if (f.formula.includes('SUM')) acc.SUM = (acc.SUM || 0) + 1;
    if (f.formula.includes('AVERAGE')) acc.AVERAGE = (acc.AVERAGE || 0) + 1;
    if (f.formula.includes('MAX')) acc.MAX = (acc.MAX || 0) + 1;
    if (f.formula.includes('INDEX')) acc.INDEX = (acc.INDEX || 0) + 1;
    if (f.formula.includes('MATCH')) acc.MATCH = (acc.MATCH || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📈 Estadísticas de funciones:');
  Object.entries(formulaTypes).forEach(([func, count]) => {
    console.log(`   ${func}: ${count} usos`);
  });
  
  return formulas;
}

// Test 3: Verificar cálculos
function verifyCalculations(worksheet) {
  console.log('\n✅ Test 3: Verificando cálculos...');
  
  const testCases = [
    { cell: 'F2', expected: 4600, description: 'Total Laptops (Q1-Q4)' },
    { cell: 'F3', expected: 3500, description: 'Total Tablets (Q1-Q4)' },
    { cell: 'B7', expected: 3600, description: 'Total Q1 todos productos' },
    { cell: 'F7', expected: 15200, description: 'Total anual todos productos' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(test => {
    const cell = worksheet[test.cell];
    const actual = cell ? cell.v : null;
    
    if (actual === test.expected) {
      console.log(`✅ ${test.description}: ${actual} (correcto)`);
      passed++;
    } else {
      console.log(`❌ ${test.description}: esperado ${test.expected}, obtenido ${actual}`);
      failed++;
    }
  });
  
  console.log(`\n📊 Resultados: ${passed} pasaron, ${failed} fallaron`);
  return { passed, failed };
}

// Ejecutar todas las pruebas
async function runAllTests() {
  try {
    const { workbook, worksheet, formulas } = createComplexExcelFile();
    const analyzedFormulas = analyzeFormulas(worksheet);
    const testResults = verifyCalculations(worksheet);
    
    console.log('\n🎉 Resumen de pruebas:');
    console.log(`📁 Archivo creado con ${formulas.length} fórmulas`);
    console.log(`🔍 ${analyzedFormulas.length} fórmulas analizadas`);
    console.log(`✅ ${testResults.passed}/${testResults.passed + testResults.failed} verificaciones pasaron`);
    
    if (testResults.failed === 0) {
      console.log('\n🎊 ¡Todas las pruebas pasaron exitosamente!');
      console.log('🚀 Las funcionalidades de fórmulas de Excel están funcionando correctamente.');
    } else {
      console.log('\n⚠️  Algunas pruebas fallaron. Revisar implementación.');
    }
    
  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  }
}

// Ejecutar pruebas
runAllTests();