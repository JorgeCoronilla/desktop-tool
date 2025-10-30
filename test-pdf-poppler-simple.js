const pdfPoppler = require('pdf-poppler');
const path = require('path');
const fs = require('fs');

async function testPdfPoppler() {
  console.log('🧪 Probando pdf-poppler directamente...\n');
  
  const pdfPath = '/Users/jorgecn/dev/desktop-helper/Reckitt_Benckiser_Espana_SL-2100211487.pdf';
  
  // Verificar que el archivo existe
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ El archivo PDF no existe:', pdfPath);
    return;
  }
  
  console.log('📄 Archivo PDF encontrado:', pdfPath);
  
  try {
    // Configuración para pdf-poppler
    const options = {
      format: 'text',
      out_dir: '/tmp', // Usar directorio temporal
      out_prefix: 'test_pdf_text',
      page: null // Extraer todas las páginas
    };
    
    console.log('⚙️ Configuración:', options);
    console.log('🔄 Iniciando conversión...');
    
    // Agregar timeout para evitar que se cuelgue
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: La conversión tardó más de 30 segundos')), 30000);
    });
    
    const conversionPromise = pdfPoppler.convert(pdfPath, options);
    
    const textData = await Promise.race([conversionPromise, timeoutPromise]);
    
    console.log('✅ Conversión completada!');
    console.log('📊 Tipo de resultado:', typeof textData);
    console.log('📊 Es array:', Array.isArray(textData));
    
    if (Array.isArray(textData)) {
      console.log('📄 Número de páginas:', textData.length);
      const fullText = textData.join('\n\n');
      console.log('📝 Caracteres totales:', fullText.length);
      console.log('🔤 Primeros 200 caracteres:', fullText.substring(0, 200));
    } else {
      console.log('📝 Caracteres:', textData?.length || 0);
      console.log('🔤 Primeros 200 caracteres:', textData?.substring(0, 200) || 'Sin contenido');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Verificar si poppler-utils está instalado
    console.log('\n🔍 Verificando dependencias del sistema...');
    const { exec } = require('child_process');
    
    exec('which pdftotext', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ pdftotext no encontrado. pdf-poppler requiere poppler-utils.');
        console.log('💡 Para instalar en macOS: brew install poppler');
      } else {
        console.log('✅ pdftotext encontrado en:', stdout.trim());
      }
    });
  }
}

testPdfPoppler().catch(console.error);