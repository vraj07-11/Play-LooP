import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ICON_SVG = path.join(ROOT, 'public/icon-maskable.svg');
const RES_DIR = path.join(ROOT, 'android/app/src/main/res');

const MIPMAP_SIZES = [
  { folder: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
  { folder: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
  { folder: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
  { folder: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
  { folder: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
];

const SPLASH_SIZES = [
  { folder: 'drawable', width: 480, height: 800 },
  { folder: 'drawable-land-mdpi', width: 480, height: 320 },
  { folder: 'drawable-land-hdpi', width: 800, height: 480 },
  { folder: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { folder: 'drawable-land-xxhdpi', width: 1600, height: 960 },
  { folder: 'drawable-land-xxxhdpi', width: 1920, height: 1080 },
  { folder: 'drawable-port-mdpi', width: 320, height: 480 },
  { folder: 'drawable-port-hdpi', width: 480, height: 800 },
  { folder: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { folder: 'drawable-port-xxhdpi', width: 960, height: 1600 },
  { folder: 'drawable-port-xxxhdpi', width: 1080, height: 1920 },
];

async function generate() {
  console.log('Generating Android icons from public/icon-maskable.svg...');

  // 1. Generate Mipmap Icons
  for (const m of MIPMAP_SIZES) {
    const dir = path.join(RES_DIR, m.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.png
    await sharp(ICON_SVG)
      .resize(m.iconSize, m.iconSize)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png
    await sharp(ICON_SVG)
      .resize(m.iconSize, m.iconSize)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (for adaptive icons)
    await sharp(ICON_SVG)
      .resize(m.fgSize, m.fgSize)
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`Generated ${m.folder} (${m.iconSize}x${m.iconSize}, fg: ${m.fgSize}x${m.fgSize})`);
  }

  // 2. Set ic_launcher_background color to #000000
  const bgXmlPath = path.join(RES_DIR, 'values/ic_launcher_background.xml');
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n`;
  fs.writeFileSync(bgXmlPath, bgXml, 'utf8');

  // 3. Remove leftover vector override in drawable-v24 if present
  const vectorFg = path.join(RES_DIR, 'drawable-v24/ic_launcher_foreground.xml');
  if (fs.existsSync(vectorFg)) {
    fs.unlinkSync(vectorFg);
    console.log('Removed default vector ic_launcher_foreground.xml');
  }

  const vectorBg = path.join(RES_DIR, 'drawable/ic_launcher_background.xml');
  if (fs.existsSync(vectorBg)) {
    fs.unlinkSync(vectorBg);
    console.log('Removed default vector ic_launcher_background.xml');
  }

  // 4. Ensure adaptive icon XMLs point to mipmap
  const anyDpi = path.join(RES_DIR, 'mipmap-anydpi-v26');
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
  fs.writeFileSync(path.join(anyDpi, 'ic_launcher.xml'), adaptiveXml, 'utf8');
  fs.writeFileSync(path.join(anyDpi, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

  // 5. Generate Splash Screens
  console.log('Generating Splash screens...');
  for (const s of SPLASH_SIZES) {
    const dir = path.join(RES_DIR, s.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const logoSize = Math.round(Math.min(s.width, s.height) * 0.4);
    const logoBuffer = await sharp(ICON_SVG)
      .resize(logoSize, logoSize)
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: s.width,
        height: s.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([{ input: logoBuffer, gravity: 'center' }])
      .png()
      .toFile(path.join(dir, 'splash.png'));
  }

  console.log('Done! All Android app icons and splash screens updated to Play-LooP branding.');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
