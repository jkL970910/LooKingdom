import sharp from "sharp";
import { readdir } from "node:fs/promises";
import path from "node:path";
const directory = path.join(process.cwd(), "public", "art");
for (const file of await readdir(directory)) {
  if (!file.endsWith(".png")) continue;
  const result = await sharp(path.join(directory, file))
    .webp({ quality: 88, effort: 6 })
    .toFile(path.join(directory, file.replace(".png", ".webp")));
  console.log(`${file} → WebP: ${Math.round(result.size / 1024)} KB`);
}
