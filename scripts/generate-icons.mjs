import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public/icons", { recursive: true });

const SOURCE = "public/icons/icon.svg";
const BRAND_BG = "#0F1E36";
const render = (size) => sharp(SOURCE, { density: 384 }).resize(size, size).png();

// Standard icons: the logo keeps its own rounded background.
for (const { size, out } of [
  { size: 192, out: "public/icons/icon-192.png" },
  { size: 512, out: "public/icons/icon-512.png" },
]) {
  await render(size).toFile(out);
  console.log(`generated ${out}`);
}

// Maskable icons are cropped to the launcher's shape, so the artwork is
// re-centred on a full-bleed square and shrunk inside the 80% safe circle.
const CANVAS = 1024;
const artwork = await render(Math.round(CANVAS * 0.78)).toBuffer();
const maskable = await sharp({
  create: { width: CANVAS, height: CANVAS, channels: 4, background: BRAND_BG },
})
  .composite([{ input: artwork, gravity: "center" }])
  .png()
  .toBuffer();

for (const { size, out } of [
  { size: 512, out: "public/icons/maskable-512.png" },
  // iOS applies its own mask, so it wants a full-bleed square too.
  { size: 180, out: "public/icons/apple-touch-icon.png" },
]) {
  await sharp(maskable).resize(size, size).png().toFile(out);
  console.log(`generated ${out}`);
}

await render(64).toFile("src/app/icon.png");
console.log("generated src/app/icon.png");
