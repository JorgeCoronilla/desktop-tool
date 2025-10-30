# 🔐 Firma Digital para Windows

## ¿Por qué firmar tu aplicación?

### Sin firma digital:
- ❌ Windows muestra "Editor desconocido"
- ❌ SmartScreen bloquea o advierte sobre la aplicación
- ❌ Los antivirus pueden marcarla como sospechosa
- ❌ Los usuarios dudan en instalar la aplicación

### Con firma digital:
- ✅ Windows muestra tu nombre/empresa como editor verificado
- ✅ Sin advertencias de seguridad
- ✅ Mayor confianza del usuario
- ✅ Distribución profesional

## 📋 Tipos de Certificados

### 1. 🏆 Extended Validation (EV) - RECOMENDADO
- **Costo**: $300-500/año
- **Validación**: Máxima (verificación legal completa)
- **Beneficios**: 
  - Sin advertencias de SmartScreen desde el primer día
  - Máxima confianza del usuario
  - Reputación inmediata
- **Requisitos**: Empresa registrada legalmente
- **Proveedores**: DigiCert, Sectigo, GlobalSign

### 2. 💼 Organization Validation (OV)
- **Costo**: $100-300/año
- **Validación**: Media (verificación de organización)
- **Beneficios**: Más económico, firma válida
- **Desventajas**: Necesita tiempo para construir reputación
- **Proveedores**: Sectigo, DigiCert, Comodo

### 3. 🔧 Self-Signed (Solo desarrollo)
- **Costo**: Gratis
- **Uso**: Testing interno únicamente
- **Desventajas**: Windows mostrará advertencias

## 🛠️ Configuración

### Paso 1: Obtener Certificado

#### Para EV/OV (Recomendado):
1. **DigiCert** (Premium): https://www.digicert.com/code-signing/
2. **Sectigo** (Económico): https://sectigo.com/ssl-certificates-tls/code-signing
3. **GlobalSign**: https://www.globalsign.com/code-signing-certificate

#### Proceso de compra:
1. Selecciona el tipo de certificado (EV recomendado)
2. Proporciona información de tu empresa
3. Completa la validación (puede tomar 1-7 días)
4. Descarga el certificado en formato `.p12` o `.pfx`

### Paso 2: Configurar Variables de Entorno

1. Copia el archivo de ejemplo:
```bash
cp .env.signing.example .env.signing
```

2. Edita `.env.signing`:
```bash
# Ruta al certificado
WIN_CSC_LINK=./certificates/mi-certificado.p12

# Contraseña del certificado
WIN_CSC_KEY_PASSWORD=mi-contraseña-secreta

# URL del timestamp server
WIN_TIMESTAMP_URL=http://timestamp.digicert.com

# Información de la empresa
COMPANY_URL=https://mi-empresa.com
COMPANY_NAME=Mi Empresa SL
```

### Paso 3: Colocar el Certificado

1. Coloca tu archivo `.p12` o `.pfx` en la carpeta `certificates/`
2. Asegúrate de que la ruta en `WIN_CSC_LINK` sea correcta

### Paso 4: Construir con Firma

```bash
# Cargar variables de entorno y construir
source .env.signing && npm run build:win
```

## 🔧 Comandos Útiles

### Verificar firma existente:
```bash
signtool verify /pa "ruta/al/archivo.exe"
```

### Ver detalles del certificado:
```bash
signtool verify /v /pa "ruta/al/archivo.exe"
```

### Firmar manualmente:
```bash
signtool sign /f "certificado.p12" /p "contraseña" /tr "http://timestamp.digicert.com" /td sha256 /fd sha256 "archivo.exe"
```

## 🚨 Seguridad

### ⚠️ IMPORTANTE:
- **NUNCA** subas certificados o contraseñas a Git
- Mantén el archivo `.p12/.pfx` en lugar seguro
- Usa contraseñas fuertes para el certificado
- Considera usar Azure Key Vault o HSM para certificados EV

### Archivos protegidos por .gitignore:
- `certificates/`
- `*.p12`, `*.pfx`
- `.env.signing`

## 🔍 Verificación

### Después de firmar, verifica:

1. **Propiedades del archivo**: Click derecho → Propiedades → Firmas digitales
2. **SmartScreen**: Intenta descargar y ejecutar en Windows limpio
3. **Antivirus**: Escanea con diferentes antivirus

### Señales de éxito:
- ✅ Aparece tu nombre/empresa en "Editor"
- ✅ Sin advertencias de SmartScreen
- ✅ Certificado válido en propiedades

## 🐛 Solución de Problemas

### Error: "signtool not found"
```bash
# Instalar Windows SDK
# O agregar a PATH: C:\Program Files (x86)\Windows Kits\10\bin\x64\
```

### Error: "Certificate not found"
- Verifica la ruta en `WIN_CSC_LINK`
- Asegúrate de que el archivo `.p12/.pfx` existe
- Verifica la contraseña en `WIN_CSC_KEY_PASSWORD`

### Error: "Timestamp server unreachable"
- Verifica conexión a internet
- Prueba otro servidor de timestamp:
  - `http://timestamp.digicert.com`
  - `http://timestamp.sectigo.com`
  - `http://timestamp.globalsign.com`

### SmartScreen sigue mostrando advertencias:
- Normal para certificados OV nuevos
- Se resuelve automáticamente con el tiempo y descargas
- Los certificados EV no tienen este problema

## 📊 Costos Aproximados (2025)

| Proveedor | OV | EV |
|-----------|----|----|
| DigiCert | $200/año | $400/año |
| Sectigo | $100/año | $300/año |
| GlobalSign | $150/año | $350/año |

## 🎯 Recomendación

Para aplicaciones comerciales:
1. **Usa certificado EV** si tienes presupuesto
2. **Sectigo OV** como alternativa económica
3. **Nunca distribuyas** sin firma digital

Para desarrollo:
1. Usa el certificado self-signed automático
2. Solo para testing interno
3. Cambia a certificado real antes de distribuir