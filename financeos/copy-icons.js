import fs from 'fs';
import path from 'path';

const srcImage = path.join(process.cwd(), 'src/assets/images/financeos_logo_1781231196726.jpg');
const publicDir = path.join(process.cwd(), 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

try {
  if (fs.existsSync(srcImage)) {
    fs.copyFileSync(srcImage, path.join(publicDir, 'icon-192.png'));
    fs.copyFileSync(srcImage, path.join(publicDir, 'icon-512.png'));
    console.log('Successfully copied icons to public folder.');
  } else {
    // Fallback: create a dummy solid placeholder if file is missing (unlikely, but safe)
    console.warn('Source image not found for copy');
  }
} catch (err) {
  console.error('Error copying icons:', err);
}
