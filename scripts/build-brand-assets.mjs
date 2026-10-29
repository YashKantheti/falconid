import fs from "node:fs/promises";
import sharp from "sharp";

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#172e48"/><path d="M25 14h30L43 27H32l-4 9h16L32 47h-9l-5 9H8z" fill="#fff"/></svg>`;
await fs.writeFile("public/falconid-mark.svg", mark + "\n");
await fs.writeFile("src/app/icon.svg", mark + "\n");
for (const size of [192, 512]) {
  await sharp(Buffer.from(mark))
    .resize(size, size)
    .png()
    .toFile(`public/falconid-icon-${size}.png`);
}
await sharp(Buffer.from(mark))
  .resize(180, 180)
  .png()
  .toFile("src/app/apple-icon.png");

const png = await sharp(Buffer.from(mark)).resize(64, 64).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 64;
header[7] = 64;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await fs.writeFile("src/app/favicon.ico", Buffer.concat([header, png]));

const share = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f6f8fb"/><g transform="translate(88 110) scale(1.75)"><rect width="64" height="64" rx="16" fill="#172e48"/><path d="M25 14h30L43 27H32l-4 9h16L32 47h-9l-5 9H8z" fill="#fff"/></g><text x="88" y="350" font-family="Arial, Helvetica, sans-serif" font-size="100" font-weight="700" letter-spacing="-5" fill="#172e48">FalconID</text><text x="92" y="430" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#576779">From photo to part.</text></svg>`;
await sharp(Buffer.from(share)).png().toFile("public/falconid-share.png");
console.log("FalconID icons and share preview generated.");
