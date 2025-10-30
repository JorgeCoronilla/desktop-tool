const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Script de firma para Windows
 * Soporta certificados EV, OV y self-signed
 */

async function signWindows(configuration) {
  const { path: filePath, hash, name, productName } = configuration;
  
  console.log(`🔐 Firmando: ${filePath}`);
  
  // Configuración del certificado desde variables de entorno
  const certFile = process.env.WIN_CSC_LINK; // Ruta al archivo .p12/.pfx
  const certPassword = process.env.WIN_CSC_KEY_PASSWORD; // Contraseña del certificado
  const timestampUrl = process.env.WIN_TIMESTAMP_URL || 'http://timestamp.digicert.com';
  
  // Verificar si tenemos certificado
  if (!certFile || !fs.existsSync(certFile)) {
    console.warn('⚠️  No se encontró certificado. Saltando firma...');
    console.warn('   Para firmar, configura:');
    console.warn('   - WIN_CSC_LINK: ruta al archivo .p12/.pfx');
    console.warn('   - WIN_CSC_KEY_PASSWORD: contraseña del certificado');
    return;
  }
  
  try {
    // Comando signtool para Windows
    const signCommand = [
      'signtool',
      'sign',
      '/f', `"${certFile}"`,
      '/p', `"${certPassword}"`,
      '/tr', timestampUrl,
      '/td', 'sha256',
      '/fd', 'sha256',
      '/d', `"${productName}"`,
      '/du', 'https://tu-sitio-web.com', // Cambia por tu URL
      `"${filePath}"`
    ].join(' ');
    
    console.log('🔧 Ejecutando signtool...');
    execSync(signCommand, { stdio: 'inherit' });
    console.log('✅ Firma completada exitosamente');
    
    // Verificar la firma
    const verifyCommand = `signtool verify /pa "${filePath}"`;
    execSync(verifyCommand, { stdio: 'inherit' });
    console.log('✅ Firma verificada correctamente');
    
  } catch (error) {
    console.error('❌ Error durante la firma:', error.message);
    
    // Si falla, intentar con certificado self-signed para desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Intentando con certificado self-signed...');
      await createSelfSignedCert(filePath, productName);
    } else {
      throw error;
    }
  }
}

/**
 * Crear certificado self-signed para desarrollo
 */
async function createSelfSignedCert(filePath, productName) {
  try {
    const certName = 'Desktop Helper Development';
    
    // Crear certificado self-signed (requiere PowerShell en Windows)
    const createCertCommand = `
      powershell -Command "
        $cert = New-SelfSignedCertificate -Subject 'CN=${certName}' -Type CodeSigning -CertStoreLocation Cert:\\CurrentUser\\My
        Export-PfxCertificate -Cert $cert -FilePath './temp-cert.pfx' -Password (ConvertTo-SecureString -String 'temp123' -Force -AsPlainText)
      "
    `;
    
    console.log('🔧 Creando certificado temporal...');
    execSync(createCertCommand, { stdio: 'inherit' });
    
    // Firmar con el certificado temporal
    const signCommand = [
      'signtool',
      'sign',
      '/f', '"./temp-cert.pfx"',
      '/p', '"temp123"',
      '/fd', 'sha256',
      '/d', `"${productName}"`,
      `"${filePath}"`
    ].join(' ');
    
    execSync(signCommand, { stdio: 'inherit' });
    console.log('✅ Firmado con certificado temporal (solo para desarrollo)');
    
    // Limpiar certificado temporal
    if (fs.existsSync('./temp-cert.pfx')) {
      fs.unlinkSync('./temp-cert.pfx');
    }
    
  } catch (error) {
    console.warn('⚠️  No se pudo crear certificado self-signed:', error.message);
    console.warn('   La aplicación se construirá sin firma');
  }
}

module.exports = signWindows;