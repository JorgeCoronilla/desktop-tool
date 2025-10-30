const { ElectronMCPServer } = require('./dist/main/mcp/electronMcpServer.js');

async function testPdfReading() {
  console.log('🧪 Iniciando prueba de lectura de PDF con pdf-poppler...\n');
  
  const mcpServer = new ElectronMCPServer();
  
  const pdfPath = '/Users/jorgecn/dev/desktop-helper/Reckitt_Benckiser_Espana_SL-2100211487.pdf';
  
  try {
    console.log('📄 Probando read_pdf...');
    const result = await mcpServer.executeTool({
      name: 'read_pdf',
      arguments: { filePath: pdfPath }
    });
    
    if (result.success) {
      console.log('✅ read_pdf exitoso!');
      console.log(`📊 Páginas: ${result.result.metadata?.totalPages || 'N/A'}`);
      console.log(`📝 Caracteres extraídos: ${result.result.text?.length || 0}`);
      console.log(`🔤 Primeros 200 caracteres: "${result.result.text?.substring(0, 200)}..."`);
    } else {
      console.log('❌ read_pdf falló:', result.error);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    console.log('📄 Probando read_pdf_smart con estrategia "preview"...');
    const smartResult = await mcpServer.executeTool({
      name: 'read_pdf_smart',
      arguments: { 
        filePath: pdfPath,
        strategy: 'preview',
        maxCharacters: 1000
      }
    });
    
    if (smartResult.success) {
      console.log('✅ read_pdf_smart exitoso!');
      console.log(`📊 Páginas: ${smartResult.result.metadata?.totalPages || 'N/A'}`);
      console.log(`📝 Caracteres extraídos: ${smartResult.result.text?.length || 0}`);
      console.log(`🔤 Contenido preview: "${smartResult.result.text?.substring(0, 500)}..."`);
    } else {
      console.log('❌ read_pdf_smart falló:', smartResult.error);
    }
    
  } catch (error) {
    console.error('💥 Error durante la prueba:', error.message);
  }
}

testPdfReading().catch(console.error);