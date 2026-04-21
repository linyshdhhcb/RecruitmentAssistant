const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const { default: pngToIco } = await import("png-to-ico");
  const { default: sharp } = await import("sharp");

  const root = path.join(__dirname, "..");
  const src = path.join(root, "src", "assets", "icon.png");
  const outDir = path.join(root, "build");
  const out = path.join(outDir, "icon.ico");
  const tmpPng = path.join(outDir, "icon-square.png");

  if (!fs.existsSync(src)) {
    throw new Error(`icon not found: ${src}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  // Ensure a square PNG for ICO generation.
  await sharp(src)
    .resize(256, 256, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(tmpPng);

  const buffer = await pngToIco(tmpPng);
  fs.writeFileSync(out, buffer);
  process.stdout.write(`Generated ${out}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

