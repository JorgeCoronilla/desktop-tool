#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Script para construir la aplicación Windows con firma digital
 */

console.log('🚀 Iniciando build de Windows con firma digital...\n');

// Verificar si existe configuración de firma
const envSigningPath = path.join(__dirname, '..', '.env.signing');
const hasCertConfig = fs.existsSync(envSigningPath);

if (hasCertConfig) {
  console.log('✅ Configuración de firma encontrada');
  
  // Cargar variables de entorno de firma
  require('dotenv').config({ path: envSigningPath });
  
  const certFile = process.env.WIN_CSC_LINK;
  const certPassword = process.env.WIN_CSC_KEY_PASSWORD;
  
  if (certFile && fs.existsSync(certFile) && certPassword) {
    console.log('✅ Certificado válido encontrado');
    console.log(`📁 Certificado: ${certFile}`);
    
    // Configurar variables de entorno para electron-builder
    process.env.WIN_CSC_LINK = certFile;
    process.env.WIN_CSC_KEY_PASSWORD = certPassword;
    
    // Actualizar package.json temporalmente para incluir firma
    updatePackageJsonForSigning(true);
    
  } else {
    console.log('⚠️  Certificado no encontrado o configuración incompleta');
    console.log('   Construyendo sin firma...');
    updatePackageJsonForSigning(false);
  }
} else {
  console.log('⚠️  No se encontró .env.signing');
  console.log('   Construyendo sin firma...');
  updatePackageJsonForSigning(false);
}

try {
  // Ejecutar build
  console.log('\n🔨 Ejecutando electron-builder...');
  execSync('npm run build:win', { stdio: 'inherit' });
  
  console.log('\n✅ Build completado exitosamente!');
  
  // Verificar si el archivo fue firmado
  const exePath = path.join(__dirname, '..', 'release', 'Desktop Helper Setup 1.0.0.exe');
  if (fs.existsSync(exePath)) {
    console.log('\n🔍 Verificando firma...');
    try {
      execSync(`signtool verify /pa "${exePath}"`, { stdio: 'inherit' });
      console.log('✅ Firma verificada correctamente');
    } catch (error) {
      console.log('⚠️  Archivo no firmado (normal si no hay certificado)');
    }
  }
  
} catch (error) {
  console.error('\n❌ Error durante el build:', error.message);
  process.exit(1);
} finally {
  // Restaurar package.json original
  restorePackageJson();
}

/**
 * Actualizar package.json para incluir/excluir firma
 */
function updatePackageJsonForSigning(enableSigning) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Hacer backup
  fs.writeFileSync(packagePath + '.backup', JSON.stringify(packageJson, null, 2));
  
  if (enableSigning) {
    // Agregar configuración de firma
    packageJson.build.win.sign = './scripts/sign-windows.js';
    packageJson.build.win.signtoolOptions = {
      signingHashAlgorithms: ['sha256']
    };
  } else {
    // Remover configuración de firma
    delete packageJson.build.win.sign;
    delete packageJson.build.win.signtoolOptions;
  }
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
}

/**
 * Restaurar package.json original
 */
function restorePackageJson() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const backupPath = packagePath + '.backup';
  
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, packagePath);
    fs.unlinkSync(backupPath);
  }
}