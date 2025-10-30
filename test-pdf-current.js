const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function testPdfReading() {
    const pdfPath = '/Users/jorgecn/dev/desktop-helper/Reckitt_Benckiser_Espana_SL-2100211487.pdf';
    
    console.log('🔍 Probando lectura de PDF con pdf-parse...');
    
    try {
        // Verificar que el archivo existe
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ El archivo PDF no existe:', pdfPath);
            return;
        }
        
        console.log('✅ Archivo PDF encontrado');
        
        // Leer el archivo
        const dataBuffer = fs.readFileSync(pdfPath);
        console.log('✅ Archivo leído, tamaño:', dataBuffer.length, 'bytes');
        
        // Parsear con pdf-parse
        console.log('📄 Parseando PDF...');
        const data = await pdfParse(dataBuffer);
        
        console.log('✅ PDF parseado exitosamente');
        console.log('📊 Información del PDF:');
        console.log('  - Páginas:', data.numpages);
        console.log('  - Información:', data.info);
        console.log('  - Metadatos:', data.metadata);
        console.log('  - Versión:', data.version);
        console.log('  - Longitud del texto:', data.text.length);
        
        // Mostrar las primeras 500 caracteres del texto
        console.log('\n📝 Primeros 500 caracteres del texto:');
        console.log(data.text.substring(0, 500));
        console.log('...');
        
    } catch (error) {
        console.error('❌ Error al leer el PDF:', error.message);
        console.error('Stack:', error.stack);
    }
}

testPdfReading();