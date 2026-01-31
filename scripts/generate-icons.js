// Script to generate ICO file from PNG logo
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../resources/icons/icon.png');
const outputPath = path.join(__dirname, '../resources/icons/icon.ico');

async function generateIco() {
  try {
    const buf = await pngToIco(inputPath);
    fs.writeFileSync(outputPath, buf);
    console.log('Generated icon.ico successfully');
  } catch (error) {
    console.error('Failed to generate ICO:', error);
    process.exit(1);
  }
}

generateIco();
