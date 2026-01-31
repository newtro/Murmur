// Script to create a tray icon
// This creates a simple 16x16 microphone icon

const fs = require('fs');
const path = require('path');

// Simple 16x16 PNG icon (microphone symbol) - base64 encoded
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADESURBVDiNtZMxCsJAEEX/JFZewNrCwtrGwsLSwsbCm3gCL2BhZ2FjYWFhYWFhYZELCGJhYSV2QhITNYGAH4ZZmPdnZndXeF9wX1BI74FeGAIW0AIaoAZUgCqgApSAIlAA8kAOyAIZIE2y6wP8b4CY7wEB4BvYAxZAGZgDYyAFDIEBkCAZ9gH+N4DaHwNWwA5YAgtgBoSAOhAHekAXaAPNT4BPAJ6O8wm4AM7AGjgBe+AAnIEjcAASwJVk2QPy1wfY/8MdVX0Amd4uY74AAAAASUVORK5CYII=';

// Create a simple ICO file header + PNG data
// ICO format: ICONDIR header + ICONDIRENTRY + PNG data

function createIco(pngData) {
  const png = Buffer.from(pngData, 'base64');

  // ICONDIR (6 bytes)
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);    // Reserved (must be 0)
  iconDir.writeUInt16LE(1, 2);    // Image type: 1 for ICO
  iconDir.writeUInt16LE(1, 4);    // Number of images

  // ICONDIRENTRY (16 bytes)
  const iconDirEntry = Buffer.alloc(16);
  iconDirEntry.writeUInt8(16, 0);       // Width (16 = 256, 0 in ICO means 256, but we use 16)
  iconDirEntry.writeUInt8(16, 1);       // Height
  iconDirEntry.writeUInt8(0, 2);        // Color palette (0 = no palette)
  iconDirEntry.writeUInt8(0, 3);        // Reserved
  iconDirEntry.writeUInt16LE(1, 4);     // Color planes
  iconDirEntry.writeUInt16LE(32, 6);    // Bits per pixel
  iconDirEntry.writeUInt32LE(png.length, 8);    // Size of image data
  iconDirEntry.writeUInt32LE(22, 12);   // Offset to image data (6 + 16 = 22)

  return Buffer.concat([iconDir, iconDirEntry, png]);
}

// Ensure directory exists
const iconsDir = path.join(__dirname, '..', 'resources', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create ICO file
const icoBuffer = createIco(pngBase64);
const icoPath = path.join(iconsDir, 'tray-icon.ico');
fs.writeFileSync(icoPath, icoBuffer);
console.log('Created:', icoPath);

// Also save the PNG for other uses
const pngPath = path.join(iconsDir, 'tray-icon.png');
fs.writeFileSync(pngPath, Buffer.from(pngBase64, 'base64'));
console.log('Created:', pngPath);

console.log('Icons created successfully!');
