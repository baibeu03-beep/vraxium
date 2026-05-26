const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../public/images');

let totalOriginalSize = 0;
let totalOptimizedSize = 0;
let processedCount = 0;
let errorCount = 0;

async function getAllImages(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...await getAllImages(fullPath));
    } else if (/\.(png|jpg|jpeg)$/i.test(item)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function optimizeImage(filePath) {
  try {
    const originalSize = fs.statSync(filePath).size;
    const ext = path.extname(filePath).toLowerCase();

    let outputBuffer;

    if (ext === '.png') {
      outputBuffer = await sharp(filePath)
        .png({
          quality: 80,
          compressionLevel: 9,
          palette: true
        })
        .toBuffer();
    } else if (ext === '.jpg' || ext === '.jpeg') {
      outputBuffer = await sharp(filePath)
        .jpeg({
          quality: 80,
          mozjpeg: true
        })
        .toBuffer();
    }

    // Only save if the optimized version is smaller
    if (outputBuffer && outputBuffer.length < originalSize) {
      fs.writeFileSync(filePath, outputBuffer);
      const newSize = outputBuffer.length;
      const saved = originalSize - newSize;
      const percent = ((saved / originalSize) * 100).toFixed(1);

      totalOriginalSize += originalSize;
      totalOptimizedSize += newSize;
      processedCount++;

      if (saved > 10000) { // Only log if saved more than 10KB
        console.log(`✓ ${path.relative(imagesDir, filePath)}: ${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB (-${percent}%)`);
      }
    } else {
      totalOriginalSize += originalSize;
      totalOptimizedSize += originalSize;
    }
  } catch (err) {
    errorCount++;
    console.error(`✗ Error: ${path.relative(imagesDir, filePath)} - ${err.message}`);
  }
}

async function main() {
  console.log('🔍 Finding images...');
  const images = await getAllImages(imagesDir);
  console.log(`📁 Found ${images.length} images\n`);

  console.log('🚀 Optimizing images...\n');

  // Process in batches of 10 for better performance
  const batchSize = 10;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    await Promise.all(batch.map(img => optimizeImage(img)));

    // Progress indicator
    const progress = Math.min(i + batchSize, images.length);
    process.stdout.write(`\rProgress: ${progress}/${images.length} (${((progress/images.length)*100).toFixed(0)}%)`);
  }

  console.log('\n\n========== Results ==========');
  console.log(`Total images processed: ${processedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Optimized size: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total saved: ${((totalOriginalSize - totalOptimizedSize) / 1024 / 1024).toFixed(2)} MB (${(((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100).toFixed(1)}%)`);
}

main().catch(console.error);
