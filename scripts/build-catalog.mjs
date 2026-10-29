import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const seeds = JSON.parse(await fs.readFile("data/seeds.json", "utf8"));
let manifest = JSON.parse(
  await fs.readFile("data/download-manifest.json", "utf8"),
);
const excluded = [
  "Miba Journal Bearing.jpg",
  "Pillow-block-bearing.jpg",
  "Coiled spring pin.JPG",
  "Sprocket22.jpg",
  "Tapered-roller-bearing din720 ex.png",
  "Tapered-roller-bearing din720 120.png",
  "Sprocket16.png",
  "Solenoid-1.png",
  "UJoint1.png",
  "Automobile starter 2.JPG",
  "Crimping tool 04.jpg",
];
manifest = manifest.filter((p) => !excluded.includes(p.title));
const functions = {
  Fasteners:
    "Used to join, retain, or secure mechanical assemblies. Confirm dimensions, thread or pin size, material and grade before choosing an exact replacement.",
  "Motion & drive":
    "Used in mechanical motion, load support, or power transmission. Confirm dimensions, load rating and the equipment-specific specification before choosing an exact replacement.",
  "Fluid & pneumatic":
    "Used in a fluid or air system. Confirm size, connection type, pressure, temperature and fluid compatibility before choosing an exact replacement.",
  Electrical:
    "Used in an electrical or sensing assembly. Confirm voltage, current, pinout and equipment-specific rating before choosing an exact replacement.",
};
const checks = {
  Fasteners:
    "Photograph the head and thread. Measure diameter, pitch and length; check markings and retention features.",
  "Motion & drive":
    "Photograph both faces and the markings. Check bore diameter, outer dimensions, tooth count or bearing designation.",
  "Fluid & pneumatic":
    "Photograph ports and the label. Check connector size, operating pressure and seal material. Never infer a pressure rating from appearance.",
  Electrical:
    "Photograph the label and terminals. Record voltage, current, polarity and connector pin count. Shape alone does not establish interchangeability.",
};
const catalog = seeds.map((p, i) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  description: `${p.name} · illustrative component category. ${functions[p.category]}`,
  inspection: checks[p.category],
  photos: manifest
    .filter((x) => x.partId === p.id)
    .sort((a, b) => {
      const prefer = [
        "Rusty carriage bolt.jpg",
        "Assorted Doppelmayr glacier bushings.jpg",
        "Hex nut.JPG",
        "Stud bolt 1.jpg",
        "Grower01.jpg",
        "Bujía Bosch Yttrium Super Plus.JPG",
        "Optima Druckminderer 315-4516.jpg",
        "Glowplug.jpg",
        "Valve.jpg",
        "Ressort de compression.jpg",
        "Arctic cooling fan Pro TC 20060621.jpg",
        "2001 honda accord timing belt-terabass.jpg",
      ];
      return (
        (prefer.includes(b.title) ? 1 : 0) -
          (prefer.includes(a.title) ? 1 : 0) || a.index - b.index
      );
    })
    .map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Strip ingestion-only fields from public photo credits.
      ({ partId, name, index, categories, ...photo }) => photo,
    ),
  inventory: {
    quantity: i % 11 === 0 ? 0 : 5 + ((i * 7) % 40),
    bin: `DEMO-${p.category[0]}${String(Math.floor(i / 10) + 1).padStart(2, "0")}-${String((i % 10) + 1).padStart(2, "0")}`,
    unitPrice: Number((4.25 + ((i * 17.39) % 480)).toFixed(2)),
    updatedAt: "2026-10-28T12:00:00.000Z",
  },
  nsn: null,
  partNumber: null,
  compatibility: "Unverified",
  sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replaceAll(" ", "_"))}`,
}));
await fs.writeFile("data/catalog.json", JSON.stringify(catalog, null, 2));
await fs.writeFile("public/catalog.json", JSON.stringify(catalog));
const q = (x) => "'" + String(x ?? "").replaceAll("'", "''") + "'";
let sql = `PRAGMA foreign_keys=ON;\nCREATE TABLE IF NOT EXISTS parts(id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,inspection TEXT NOT NULL,source_url TEXT,nsn TEXT,part_number TEXT,compatibility TEXT NOT NULL);\nCREATE TABLE IF NOT EXISTS photos(id INTEGER PRIMARY KEY,part_id TEXT NOT NULL REFERENCES parts(id),path TEXT NOT NULL,source_url TEXT NOT NULL,author TEXT NOT NULL,license TEXT NOT NULL,license_url TEXT,title TEXT,modifications TEXT);\nCREATE TABLE IF NOT EXISTS demo_inventory(part_id TEXT PRIMARY KEY REFERENCES parts(id),quantity INTEGER NOT NULL,bin TEXT NOT NULL,unit_price REAL NOT NULL,updated_at TEXT NOT NULL,is_simulated INTEGER NOT NULL DEFAULT 1);\nBEGIN;\nDELETE FROM photos;DELETE FROM demo_inventory;DELETE FROM parts;\n`;
for (const p of catalog) {
  sql += `INSERT INTO parts VALUES(${[p.id, p.name, p.category, p.description, p.inspection, p.sourceUrl].map(q).join(",")},NULL,NULL,'Unverified');\nINSERT INTO demo_inventory VALUES(${q(p.id)},${p.inventory.quantity},${q(p.inventory.bin)},${p.inventory.unitPrice},${q(p.inventory.updatedAt)},1);\n`;
  for (const f of p.photos)
    sql += `INSERT INTO photos(part_id,path,source_url,author,license,license_url,title,modifications) VALUES(${[p.id, f.path, f.sourceUrl, f.author, f.license, f.licenseUrl, f.title, f.modified].map(q).join(",")});\n`;
}
sql += "COMMIT;\n";
await fs.writeFile("data/catalog.sql", sql);
execFileSync("/usr/bin/sqlite3", ["data/catalog.sqlite"], { input: sql });
await fs.writeFile(
  "public/photo-credits.json",
  JSON.stringify(
    catalog.flatMap((p) =>
      p.photos.map((f) => ({ partId: p.id, part: p.name, ...f })),
    ),
    null,
    2,
  ),
);
console.log(
  "Catalog",
  catalog.length,
  "photos",
  catalog.reduce((s, p) => s + p.photos.length, 0),
  "missing",
  catalog.filter((p) => !p.photos.length).map((p) => p.name),
);
