const { ElectronMCPServer } = require('./dist/main/mcp/electronMcpServer.js');

async function testMcpPdfReader() {
    console.log('🔍 Probando lector de PDF usando MCP Server...');
    
    const mcpServer = new ElectronMCPServer();
    const pdfPath = '/Users/jorgecn/dev/desktop-helper/Reckitt_Benckiser_Espana_SL-2100211487.pdf';
    
    try {
        console.log('📄 Probando read_pdf...');
        const result1 = await mcpServer.executeTool({
            name: 'read_pdf',
            arguments: {
                filePath: pdfPath
            }
        });
        
        console.log('✅ read_pdf ejecutado exitosamente');
        console.log('📊 Resultado completo:', result1);
        console.log('📊 Resumen:', {
            success: result1.success,
            contentLength: result1.content ? result1.content.length : 0,
            preview: result1.content ? result1.content.substring(0, 200) + '...' : 'Sin contenido'
        });
        
        console.log('\n📄 Probando read_pdf_smart...');
        const result2 = await mcpServer.executeTool({
            name: 'read_pdf_smart',
            arguments: {
                filePath: pdfPath
            }
        });
        
        console.log('✅ read_pdf_smart ejecutado exitosamente');
        console.log('📊 Resultado completo:', result2);
        console.log('📊 Resumen:', {
            success: result2.success,
            contentLength: result2.content ? result2.content.length : 0,
            preview: result2.content ? result2.content.substring(0, 200) + '...' : 'Sin contenido'
        });
        
        console.log('\n🎉 ¡Todas las pruebas completadas exitosamente!');
        
    } catch (error) {
        console.error('❌ Error durante las pruebas:', error.message);
        console.error('Stack:', error.stack);
    }
}

testMcpPdfReader();