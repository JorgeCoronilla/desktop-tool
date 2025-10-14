const fs = require('fs');
const path = require('path');

// PDF Parse initialization (v2.3.0 API)
let PDFParseClass = null;

async function initializePdfParse() {
  if (!PDFParseClass) {
    const pdfParseModule = await import('pdf-parse');
    // En v2.3.0, necesitamos la clase PDFParse
    PDFParseClass = pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse;
  }
  return PDFParseClass;
}

async function testPdfReading() {
  console.log('🔍 Testing PDF reading functionality...');
  
  const pdfPath = '/Users/jorgecn/dev/desktop-helper/UNKNOWN-200625.pdf';
  
  try {
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ PDF file not found:', pdfPath);
      return { success: false, error: 'File not found' };
    }
    
    console.log('✅ PDF file found:', pdfPath);
    
    // Test 1: Basic PDF reading with pdf-parse
    console.log('\n📖 Test 1: Basic PDF reading with pdf-parse...');
    await initializePdfParse();
    
    const dataBuffer = fs.readFileSync(pdfPath);
    console.log(`✅ PDF file read into buffer, size: ${dataBuffer.length} bytes`);
    
    // Check PDF header
    const header = dataBuffer.slice(0, 4).toString();
    console.log(`✅ PDF header: ${header}`);
    
    // Initialize pdf-parse if not available
    if (!PDFParseClass) {
      await initializePdfParse();
    }
    
    try {
      // Usar la nueva API de pdf-parse v2.3.0
      const parser = new PDFParseClass({ data: dataBuffer });
      let parsed;
      try {
        parsed = await parser.getText();
        console.log('✅ PDF parsed successfully');
        console.log(`📄 Pages: ${parsed.total || parsed.numpages || 1}`);
        console.log(`📝 Text length: ${parsed.text.length} characters`);
        console.log(`📋 Text preview: ${parsed.text.substring(0, 200)}...`);
        
        if (parsed.text.trim().length === 0) {
          console.log('⚠️  No text found in PDF - may need OCR');
          throw new Error('No text found in PDF');
        }
        
        return { success: true, text: parsed.text, pages: parsed.total || parsed.numpages || 1 };
      } finally {
        // Limpiar el parser
        if (parser && typeof parser.destroy === 'function') {
          await parser.destroy();
        }
      }
    } catch (pdfError) {
      console.log(`❌ PDF parsing error: ${pdfError.message}`);
      console.log('⚠️  PDF parsing failed - trying OCR...');
      
      try {
        // Test 2: OCR with pdf2pic + tesseract
        console.log('\n🔍 Test 2: OCR with pdf2pic + tesseract...');
          
        const { fromPath: pdfToPicFromPath } = await import('pdf2pic');
        const { createWorker } = await import('tesseract.js');
        
        const tmpDir = path.join(__dirname, 'temp-ocr-test');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        
        console.log('✅ Temp directory created:', tmpDir);
        
        const converter = pdfToPicFromPath(pdfPath, {
          density: 144,
          saveFilename: 'test-page',
          savePath: tmpDir,
          format: 'png',
          width: 2048,
          height: 2048
        });
        
        console.log('✅ PDF2Pic converter created');
        
        const result = await converter(1, { responseType: 'image' });
        console.log('✅ PDF converted to image:', result.path);
        
        const worker = await createWorker('eng');
        console.log('✅ Tesseract worker created');
        
        const { data: { text } } = await worker.recognize(result.path);
        await worker.terminate();
        
        console.log('✅ OCR completed');
        console.log('📝 OCR text length:', text.length);
        console.log('📋 OCR text preview:', text.substring(0, 200) + '...');
        
        // Cleanup
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log('✅ Temp directory cleaned up');
        
        return { success: true, text, pages: 1, method: 'OCR' };
      } catch (ocrError) {
        console.error('❌ OCR Error:', ocrError.message);
        return { success: false, error: `PDF parsing failed: ${pdfError.message}, OCR failed: ${ocrError.message}` };
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the test
testPdfReading()
  .then(result => {
    console.log('\n🎯 Final result:', result);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error);
  });