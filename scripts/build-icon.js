#!/usr/bin/env node
// Build the Windows .ico from the canonical SVG.
// Outputs:
//   branding/icon.ico       (Windows multi-res)
//   branding/icon-256.png   (also useful for marketing)

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico").default || require("png-to-ico");

const SRC = path.join(__dirname, "..", "branding", "logo-A-bold.svg");
const OUT_DIR = path.join(__dirname, "..", "branding");
const SIZES = [16, 24, 32, 48, 64, 128, 256];

(async () => {
  const svg = fs.readFileSync(SRC);
  const buffers = [];
  for (const size of SIZES) {
    const png = await sharp(svg).resize(size, size).png().toBuffer();
    buffers.push(png);
    if (size === 256) fs.writeFileSync(path.join(OUT_DIR, "icon-256.png"), png);
    console.log(`▸ rendered ${size}x${size}`);
  }
  const ico = await pngToIco(buffers);
  const icoPath = path.join(OUT_DIR, "icon.ico");
  fs.writeFileSync(icoPath, ico);
  console.log(`✓ wrote ${icoPath} (${ico.length} bytes)`);
})();
