#!/usr/bin/env node

/**
 * Script de prueba para el servidor MCP de Electron
 * Prueba las herramientas desde el contexto de la aplicación
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Asegurar que la app esté lista
if (app.isReady()) {
  runTest();
} else {
  app.whenReady().then(runTest);
}

async function runTest() {
  console.log('🚀 Iniciando prueba de herramientas MCP en Electron...');
  
  try {
    // Importar el servidor MCP
    const { ElectronMCPServer } = require('./dist/mcp/electronMcpServer.js');
    
    // Crear instancia del servidor
    const mcpServer = new ElectronMCPServer();
    
    console.log('✅ Servidor MCP creado exitosamente');
    
    // Obtener herramientas disponibles
    const availableTools = mcpServer.getAvailableTools();
    console.log('📋 Herramientas disponibles:', availableTools.map(t => t.name));
    
    // Crear archivo de prueba temporal
    const testFile = path.join(__dirname, 'test-electron-mcp.xlsx');
    
    // Test 1: Escribir Excel
    console.log('\n📝 Test 1: Escribiendo archivo Excel...');
    const writeResult = await mcpServer.executeTool({
      name: 'write_excel',
      arguments: {
        filePath: testFile,
        data: [
          ['Nombre', 'Edad', 'Ciudad'],
          ['Juan', 25, 'Madrid'],
          ['María', 30, 'Barcelona']
        ]
      }
    });
    
    if (writeResult.success) {
      console.log('✅ Excel creado exitosamente');
    } else {
      console.log('❌ Error creando Excel:', writeResult.error);
    }
    
    // Test 2: Leer Excel
    console.log('\n📖 Test 2: Leyendo archivo Excel...');
    const readResult = await mcpServer.executeTool({
      name: 'read_excel',
      arguments: {
        filePath: testFile
      }
    });
    
    if (readResult.success) {
      console.log('✅ Excel leído exitosamente');
      console.log('📊 Datos:', readResult.result);
    } else {
      console.log('❌ Error leyendo Excel:', readResult.error);
    }
    
    // Test 3: Modificar Excel
    console.log('\n✏️ Test 3: Modificando archivo Excel...');
    const modifyResult = await mcpServer.executeTool({
      name: 'modify_excel',
      arguments: {
        filePath: testFile,
        modifications: {
          add: [
            { row: 4, data: ['Pedro', 35, 'Valencia'] }
          ],
          update: [
            { row: 2, data: ['Juan Carlos', 26, 'Madrid'] }
          ]
        }
      }
    });
    
    if (modifyResult.success) {
      console.log('✅ Excel modificado exitosamente');
    } else {
      console.log('❌ Error modificando Excel:', modifyResult.error);
    }
    
    // Test 4: Comando de desarrollo
    console.log('\n⚙️ Test 4: Ejecutando comando...');
    const commandResult = await mcpServer.executeTool({
      name: 'execute_command',
      arguments: {
        command: 'echo "Hola desde Electron MCP"',
        blocking: true
      }
    });
    
    if (commandResult.success) {
      console.log('✅ Comando ejecutado exitosamente');
      console.log('📤 Salida:', commandResult.result);
    } else {
      console.log('❌ Error ejecutando comando:', commandResult.error);
    }
    
    // Limpiar
    console.log('\n🧹 Limpiando archivos de prueba...');
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
      console.log('✅ Archivo de prueba eliminado');
    }
    
    console.log('\n🎉 ¡Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
  
  // Salir después de la prueba
  setTimeout(() => {
    app.quit();
  }, 1000);
}