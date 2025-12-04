#!/usr/bin/env node
/**
 * generate-icon.js
 * 
 * Generates:
 * - app.ico: Multi-resolution Windows app icon (taskbar, window, search)
 * - tray-dark.ico: Small tray icon for dark themes
 * - tray-light.ico: Small tray icon for light themes
 * 
 * Uses png-to-ico to create Windows .ico files from PNG sources
 * 
 * Usage: npm run build:icon
 */

const fs = require('fs');
const path = require('path');

// Try to load png-to-ico
let pngToIco;
try {
  pngToIco = require('png-to-ico');
} catch (e) {
  console.error('❌ png-to-ico not found. Please install: npm install --save-dev png-to-ico');
  console.error('Error:', e.message);
  process.exit(1);
}

const iconDir = path.join(__dirname, '..', 'assets', 'icons');

// Helper to find source PNG
function findSourcePng(candidates) {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        console.log(`✓ Found PNG: ${path.relative(process.cwd(), candidate)}`);
        return candidate;
      }
    } catch (e) {}
  }
  return null;
}

// Helper to generate .ico from PNG
async function generateIco(sourcePath, outputPath, label) {
  try {
    console.log(`🔄 ${label}: Converting PNG to .ico`);
    
    const pngBuffer = fs.readFileSync(sourcePath);
    const icoBuffer = await pngToIco(pngBuffer);
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log(`✅ ${label}: ${path.relative(process.cwd(), outputPath)} (${(icoBuffer.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.error(`❌ ${label} generation failed:`, err.message);
    return false;
  }
}

(async () => {
  try {
    // 1. Generate app.ico (large, multi-res for taskbar/window/search)
    const appIconCandidates = [
      path.join(iconDir, 'Icon', 'Square44x44Logo.targetsize-256.png'),
      path.join(iconDir, 'Icon', 'Square150x150Logo.scale-400.png'),
      path.join(iconDir, 'Icon', 'Square44x44Logo.scale-400.png'),
      path.join(iconDir, 'Icon', 'Square150x150Logo.scale-200.png'),
    ];
    const appSource = findSourcePng(appIconCandidates);
    if (!appSource) {
      console.error('❌ No suitable PNG found for app icon in assets/icons/Icon/');
      process.exit(1);
    }
    
    const appIcoPath = path.join(iconDir, 'app.ico');
    const appSuccess = await generateIco(appSource, appIcoPath, 'App icon');
    if (!appSuccess) process.exit(1);

    // 2. Generate tray icons (small, 16-48px variants)
    const trayIconCandidates = [
      path.join(iconDir, 'Icon', 'Square44x44Logo.targetsize-48.png'),
      path.join(iconDir, 'Icon', 'Square44x44Logo.targetsize-32.png'),
      path.join(iconDir, 'Icon', 'Square44x44Logo.scale-200.png'),
      path.join(iconDir, 'Icon', 'Square44x44Logo.scale-100.png'),
    ];
    const traySource = findSourcePng(trayIconCandidates);
    if (!traySource) {
      console.error('❌ No suitable PNG found for tray icon in assets/icons/Icon/');
      process.exit(1);
    }

    const trayDarkPath = path.join(iconDir, 'tray-dark.ico');
    const trayLightPath = path.join(iconDir, 'tray-light.ico');

    // For now, use the same source for both (you can manually create variations later)
    const trayDarkSuccess = await generateIco(traySource, trayDarkPath, 'Tray icon (dark)');
    const trayLightSuccess = await generateIco(traySource, trayLightPath, 'Tray icon (light)');

    if (!trayDarkSuccess || !trayLightSuccess) {
      console.warn('⚠️  Tray icon generation had issues, but app icon is ready.');
      process.exit(1);
    }

    console.log('\n✅ All icons generated successfully!');
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
})();

