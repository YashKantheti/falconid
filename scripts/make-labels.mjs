import QRCode from "qrcode";
import fs from "node:fs/promises";
const ids = [
  "AGE-044",
  "AGE-012",
  "AGE-028",
  "AGE-007",
  "AGE-031",
  "AGE-019",
  ...JSON.parse(await fs.readFile("data/seeds.json", "utf8")).map((p) => p.id),
];
await fs.mkdir("public/labels", { recursive: true });
for (const id of ids) {
  const svg = await QRCode.toString(id, {
    type: "svg",
    margin: 2,
    width: 200,
    color: { dark: "#203c31", light: "#ffffff" },
  });
  await fs.writeFile(`public/labels/${id}.svg`, svg);
}
console.log("QR labels", ids.length);
