const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando compilación mejorada para Windows...');

// Step 1: Clean previous builds
console.log('🧹 Limpiando compilaciones anteriores...');
try {
  if (fs.existsSync('release')) {
    // Keep only the latest.yml for update checks
    const latestYml = path.join('release', 'latest.yml');
    const latestYmlBackup = fs.existsSync(latestYml) ? fs.readFileSync(latestYml) : null;
    
    execSync('rm -rf release/*', { stdio: 'inherit' });
    
    if (latestYmlBackup) {
      fs.writeFileSync(latestYml, latestYmlBackup);
      console.log('✅ Backup de latest.yml restaurado');
    }
  }
  if (fs.existsSync('dist')) {
    execSync('rm -rf dist', { stdio: 'inherit' });
  }
} catch (error) {
  console.log('⚠️  Error en limpieza (continuando):', error.message);
}

// Step 2: Generate ICO icon if needed
console.log('🎨 Verificando icono...');
try {
  if (!fs.existsSync('assets/icon.ico')) {
    console.log('📦 Generando archivo ICO...');
    execSync('node scripts/generate-icon.js', { stdio: 'inherit' });
  }
} catch (error) {
  console.log('⚠️  Error generando icono:', error.message);
}

// Step 3: Install dependencies
console.log('📦 Verificando dependencias...');
try {
  execSync('npm ci', { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️  Error en dependencias, intentando npm install...');
  execSync('npm install', { stdio: 'inherit' });
}

// Step 4: Build renderer
console.log('🔨 Compilando renderer...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Error compilando renderer:', error.message);
  process.exit(1);
}

// Step 5: Build main process
console.log('🔨 Compilando proceso principal...');
try {
  execSync('npm run build:main', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Error compilando main:', error.message);
  process.exit(1);
}

// Step 6: Build Windows installer
console.log('📦 Creando instalador para Windows...');
try {
  execSync('npx electron-builder --win --publish=never', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Error creando instalador:', error.message);
  process.exit(1);
}

// Step 7: Verify output
console.log('✅ Verificando archivos generados...');
const releaseDir = 'release';
const expectedFiles = [
  'Desktop Helper Setup 1.0.0.exe',
  'Desktop Helper Setup 1.0.0.exe.blockmap',
  'latest.yml'
];

let allFilesPresent = true;
expectedFiles.forEach(file => {
  const filePath = path.join(releaseDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.log(`❌ ${file} - NO ENCONTRADO`);
    allFilesPresent = false;
  }
});

if (allFilesPresent) {
  console.log('\n🎉 ¡Compilación completada exitosamente!');
  console.log('\n📋 Instrucciones para instalación:');
  console.log('1. Desinstala cualquier versión anterior de Desktop Helper');
  console.log('2. Ejecuta "Desktop Helper Setup 1.0.0.exe" como administrador');
  console.log('3. Sigue las instrucciones del instalador');
  console.log('\n💡 Si tienes problemas:');
  console.log('- Usa Revo Uninstaller para limpiar versiones anteriores');
  console.log('- Ejecuta el instalador como administrador');
  console.log('- Desactiva temporalmente el antivirus');
} else {
  console.log('\n❌ Compilación incompleta. Revisa los errores anteriores.');
  process.exit(1);
}