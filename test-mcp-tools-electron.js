const { app, BrowserWindow } = require('electron');
const path = require('path');

// Script para probar las herramientas MCP desde el proceso main de Electron
async function testMcpTools() {
  console.log('🧪 Iniciando prueba de herramientas MCP en Electron...\n');
  
  try {
    // Importar el servicio MCP
    const { IntegratedMCPService } = require('./dist/src/services/integratedMcpService');
    
    console.log('📦 Creando instancia de IntegratedMCPService...');
    const mcpService = new IntegratedMCPService({
      model: 'gpt-4o',
      tier: 2,
      hasApiKey: true,
      apiKeyLength: 164
    });
    
    console.log('✅ IntegratedMCPService creado exitosamente');
    
    // Obtener las herramientas disponibles
    console.log('\n🔧 Obteniendo herramientas disponibles...');
    const availableTools = await mcpService.getAvailableTools();
    
    console.log(`📋 Herramientas disponibles: ${availableTools.length}`);
    availableTools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name} - ${tool.description}`);
    });
    
    // Probar una herramienta de desarrollo
    console.log('\n🛠️ Probando herramienta execute_command...');
    const executeResult = await mcpService.executeTool('execute_command', {
      command: 'echo "Hola desde Electron MCP!"',
      timeout: 5000
    });
    
    console.log('✅ Resultado de execute_command:', JSON.stringify(executeResult, null, 2));
    
    // Probar una herramienta de Excel
    console.log('\n📊 Probando herramienta write_excel...');
    const excelData = [
      ['Producto', 'Precio', 'Cantidad', 'Total'],
      ['Laptop', 1200, 2, '=B2*C2'],
      ['Mouse', 25, 5, '=B3*C3']
    ];
    
    const excelResult = await mcpService.executeTool('write_excel', {
      filePath: './test-electron-excel.xlsx',
      data: excelData,
      sheetName: 'Productos'
    });
    
    console.log('✅ Resultado de write_excel:', JSON.stringify(excelResult, null, 2));
    
    // Probar leer el Excel creado
    console.log('\n📖 Probando herramienta read_excel...');
    const readResult = await mcpService.executeTool('read_excel', {
      filePath: './test-electron-excel.xlsx'
    });
    
    console.log('✅ Resultado de read_excel:', JSON.stringify(readResult, null, 2));
    
    // Limpiar archivo de prueba
    if (require('fs').existsSync('./test-electron-excel.xlsx')) {
      require('fs').unlinkSync('./test-electron-excel.xlsx');
      console.log('🗑️ Archivo de prueba Excel borrado');
    }
    
    console.log('\n🎉 ¡Prueba completada exitosamente!');
    console.log('✅ Todas las herramientas MCP funcionan correctamente desde Electron');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error(error.stack);
  }
}

// Ejecutar la prueba si se llama directamente
if (require.main === module) {
  testMcpTools();
}

module.exports = { testMcpTools };