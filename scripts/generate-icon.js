const fs = require('fs');
const path = require('path');

// Simple ICO generator from SVG
// This creates a basic ICO file structure for the installer

function createSimpleIco() {
  const icoPath = path.join(__dirname, '../assets/icon.ico');
  
  // Create a minimal ICO file header
  // This is a simplified approach - in production you'd use a proper ICO library
  const icoHeader = Buffer.from([
    0x00, 0x00, // Reserved
    0x01, 0x00, // Type (1 = ICO)
    0x01, 0x00, // Number of images
    // Image directory entry
    0x20, // Width (32px)
    0x20, // Height (32px)
    0x00, // Color count
    0x00, // Reserved
    0x01, 0x00, // Color planes
    0x20, 0x00, // Bits per pixel
    0x00, 0x04, 0x00, 0x00, // Image size (1024 bytes)
    0x16, 0x00, 0x00, 0x00  // Image offset
  ]);

  // Create a simple 32x32 RGBA bitmap data
  const imageSize = 32 * 32 * 4; // 32x32 pixels, 4 bytes per pixel (RGBA)
  const imageData = Buffer.alloc(imageSize);
  
  // Fill with a simple gradient pattern (purple to blue)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const offset = (y * 32 + x) * 4;
      const centerX = 16, centerY = 16;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (distance <= 15) {
        // Purple gradient
        imageData[offset] = Math.floor(79 + (124 - 79) * (x / 32));     // R
        imageData[offset + 1] = Math.floor(70 + (58 - 70) * (x / 32));  // G
        imageData[offset + 2] = Math.floor(229 + (237 - 229) * (x / 32)); // B
        imageData[offset + 3] = 255; // A (fully opaque)
      } else {
        // Transparent
        imageData[offset] = 0;
        imageData[offset + 1] = 0;
        imageData[offset + 2] = 0;
        imageData[offset + 3] = 0;
      }
    }
  }

  // Combine header and image data
  const icoFile = Buffer.concat([icoHeader, imageData]);
  
  try {
    fs.writeFileSync(icoPath, icoFile);
    console.log('✅ Icon ICO file generated successfully at:', icoPath);
    return true;
  } catch (error) {
    console.error('❌ Error generating ICO file:', error);
    return false;
  }
}

// Run the generator
if (require.main === module) {
  createSimpleIco();
}

module.exports = { createSimpleIco };