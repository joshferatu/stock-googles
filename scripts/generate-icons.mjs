import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public/icons", { recursive: true });

const targets = [
  { src: "public/icons/icon.svg", size: 192, out: "public/icons/icon-192.png" },
  { src: "public/icons/icon.svg", size: 512, out: "public/icons/icon-512.png" },
  { src: "public/icons/maskable.svg", size: 512, out: "public/icons/maskable-512.png" },
  { src: "public/icons/maskable.svg", size: 180, out: "public/icons/apple-touch-icon.png" },
];

for (const target of targets) {
  await sharp(target.src, { density: 384 }).resize(target.size, target.size).png().toFile(target.out);
  console.log(`generated ${target.out}`);
}

await sharp("public/icons/icon.svg", { density: 384 })
  .resize(64, 64)
  .png()
  .toFile("src/app/icon.png");
console.log("generated src/app/icon.png");
