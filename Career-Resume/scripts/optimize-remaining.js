const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = 'C:\\Users\\ynlee\\Downloads\\template1\\public\\images';

const errorFiles = [
  '0\\cluster 1\\bg image\\PX05.jpg',
  '0\\cluster 2\\영상 01.jpeg',
  '0\\cluster 2\\이안4.jpg',
  '0\\crew profile\\남 10.jpg',
  '0\\crew profile\\남 12.jpg',
  '0\\crew profile\\남 2.jpg',
  '0\\crew profile\\남 3.jpg',
  '0\\crew profile\\남 13.jpg',
  '0\\crew profile\\남 5.jpg',
  '0\\crew profile\\남 4.jpg',
  '0\\crew profile\\남 6.jpg',
  '0\\crew profile\\여 11.jpg',
  '0\\crew profile\\남 7.jpg',
  '0\\crew profile\\여 3.jpg',
  '0\\crew profile\\여 2.jpg',
  '0\\crew profile\\여 5.jpg',
  '0\\crew profile\\여 6.jpg',
  '0\\crew profile\\여 8.jpg',
  '0\\crew profile\\여 1.jpg',
  '0\\crew profile\\이안4.jpg'
];

let totalOriginalSize = 0;
let totalOptimizedSize = 0;
let processedCount = 0;
let errorCount = 0;

async function optimizeImage(relativePath) {
  const filePath = path.join(imagesDir, relativePath);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`✗ File not found: ${relativePath}`);
      errorCount++;
      return;
    }

    const originalSize = fs.statSync(filePath).size;
    const ext = path.extname(filePath).toLowerCase();

    // Read file into buffer first to avoid path issues
    const inputBuffer = fs.readFileSync(filePath);
    let outputBuffer;

    if (ext === '.jpg' || ext === '.jpeg') {
      outputBuffer = await sharp(inputBuffer)
        .jpeg({
          quality: 80,
          mozjpeg: true
        })
        .toBuffer();
    } else if (ext === '.png') {
      outputBuffer = await sharp(inputBuffer)
        .png({
          quality: 80,
          compressionLevel: 9,
          palette: true
        })
        .toBuffer();
    }

    if (outputBuffer && outputBuffer.length < originalSize) {
      fs.writeFileSync(filePath, outputBuffer);
      const newSize = outputBuffer.length;
      const saved = originalSize - newSize;
      const percent = ((saved / originalSize) * 100).toFixed(1);

      totalOriginalSize += originalSize;
      totalOptimizedSize += newSize;
      processedCount++;

      console.log(`✓ ${relativePath}: ${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB (-${percent}%)`);
    } else {
      totalOriginalSize += originalSize;
      totalOptimizedSize += originalSize;
      console.log(`○ ${relativePath}: Already optimized or no improvement`);
    }
  } catch (err) {
    errorCount++;
    console.error(`✗ Error: ${relativePath} - ${err.message}`);
  }
}

async function main() {
  console.log('🚀 Optimizing remaining files...\n');

  for (const file of errorFiles) {
    await optimizeImage(file);
  }

  console.log('\n========== Results ==========');
  console.log(`Total processed: ${processedCount}`);
  console.log(`Errors/Not found: ${errorCount}`);
  console.log(`Original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Optimized size: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total saved: ${((totalOriginalSize - totalOptimizedSize) / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
