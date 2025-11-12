/**
 * Script para probar las herramientas MCP desde la interfaz web
 * Se ejecuta en el navegador
 */

// Función para probar herramientas desde la consola del navegador
async function testTools() {
  console.log('🚀 Iniciando prueba de herramientas desde la interfaz web...');
  
  try {
    // Test 1: Obtener herramientas disponibles
    console.log('📋 Test 1: Obteniendo herramientas disponibles...');
    const response = await fetch('http://localhost:4000/api/mcp/tools');
    const tools = await response.json();
    console.log('✅ Herramientas disponibles:', tools.map(t => t.name));
    
    // Test 2: Escribir Excel
    console.log('\n📝 Test 2: Escribiendo archivo Excel...');
    const writeResponse = await fetch('http://localhost:4000/api/mcp/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'write_excel',
        arguments: {
          filePath: './test-web-excel.xlsx',
          data: [
            ['Producto', 'Precio', 'Stock'],
            ['Laptop', 999.99, 15],
            ['Mouse', 29.99, 50],
            ['Teclado', 79.99, 25]
          ]
        }
      })
    });
    
    const writeResult = await writeResponse.json();
    if (writeResult.success) {
      console.log('✅ Excel creado exitosamente');
    } else {
      console.log('❌ Error creando Excel:', writeResult.error);
    }
    
    // Test 3: Leer Excel
    console.log('\n📖 Test 3: Leyendo archivo Excel...');
    const readResponse = await fetch('http://localhost:4000/api/mcp/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'read_excel',
        arguments: {
          filePath: './test-web-excel.xlsx'
        }
      })
    });
    
    const readResult = await readResponse.json();
    if (readResult.success) {
      console.log('✅ Excel leído exitosamente');
      console.log('📊 Datos:', readResult.result);
    } else {
      console.log('❌ Error leyendo Excel:', readResult.error);
    }
    
    // Test 4: Modificar Excel
    console.log('\n✏️ Test 4: Modificando archivo Excel...');
    const modifyResponse = await fetch('http://localhost:4000/api/mcp/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'modify_excel',
        arguments: {
          filePath: './test-web-excel.xlsx',
          modifications: {
            add: [
              { row: 5, data: ['Monitor', 299.99, 20] }
            ],
            update: [
              { row: 2, data: ['Laptop Gaming', 1299.99, 10] }
            ]
          }
        }
      })
    });
    
    const modifyResult = await modifyResponse.json();
    if (modifyResult.success) {
      console.log('✅ Excel modificado exitosamente');
    } else {
      console.log('❌ Error modificando Excel:', modifyResult.error);
    }
    
    // Test 5: Ejecutar comando
    console.log('\n⚙️ Test 5: Ejecutando comando...');
    const commandResponse = await fetch('http://localhost:4000/api/mcp/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'execute_command',
        arguments: {
          command: 'echo "¡Hola desde la interfaz web!"',
          blocking: true
        }
      })
    });
    
    const commandResult = await commandResponse.json();
    if (commandResult.success) {
      console.log('✅ Comando ejecutado exitosamente');
      console.log('📤 Salida:', commandResult.result);
    } else {
      console.log('❌ Error ejecutando comando:', commandResult.error);
    }
    
    console.log('\n🎉 ¡Prueba completada!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

// Instrucciones para el usuario
console.log(`
🎯 Instrucciones para probar las herramientas:

1. Abre la consola del navegador (F12)
2. Copia y pega el código de esta función
3. Ejecuta: await testTools()

O simplemente ejecuta: await testTools()
`);

// Ejecutar automáticamente si se carga este script
if (typeof window !== 'undefined') {
  window.testTools = testTools;
  console.log('🚀 Función testTools() disponible en la consola del navegador');
}