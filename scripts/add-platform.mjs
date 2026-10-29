import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const catalog = JSON.parse(
  await fs.readFile("data/catalog.json", "utf8"),
).filter((p) => !p.id.startsWith("MEP-"));
const manual =
  "https://www.radiomanual.info/schemi/Surplus_Accessories/MEP-831A_MEP-832A_serv_user_TM9-6115-639-13P_2010.pdf";
const to = "TO 35C2-3-386-51W/IPB";
const definitions = [
  {
    id: "MEP-AIR-01",
    name: "Air cleaner filter element",
    partNumber: "114250-12581",
    nsn: "2940-01-310-4495",
    cage: "0AK42",
    slug: "air-filter",
    figure: 26,
    item: 6,
    wp: "0117",
    page: 449,
    serviceWp: "0061",
    servicePage: 261,
    description:
      "Annular intake filter element in the MEP-831A / MEP-832A air cleaner assembly. The illustrated parts list identifies item 6 under group 0606.",
  },
  {
    id: "MEP-FUEL-01",
    name: "Fuel filter element",
    partNumber: "33583",
    nsn: "4330-01-374-9147",
    cage: "79396",
    slug: "fuel-filter",
    figure: 25,
    item: 7,
    wp: "0116",
    page: 445,
    serviceWp: "0060",
    servicePage: 259,
    description:
      "Replaceable fluid filter element within the fuel filter / water separator assembly. The illustrated parts list identifies item 7 under group 0605.",
  },
  {
    id: "MEP-OIL-01",
    name: "Oil pump strainer",
    partNumber: "114250-35070",
    nsn: "2815-01-353-7523",
    cage: "0GUY0",
    slug: "oil-strainer",
    figure: 36,
    item: 2,
    wp: "0129",
    page: 495,
    serviceWp: "0073",
    servicePage: 291,
    description:
      "Engine lubrication strainer identified as item 2 in the oil filter assembly, group 0804, for the 3 kW tactical quiet generator.",
  },
];
const parts = definitions.map((d, i) => ({
  id: d.id,
  name: d.name,
  category: "MEP-832A components",
  description: d.description,
  inspection:
    "Compare the physical form, markings and equipment configuration with the illustrated parts list. Verify the current authorized publication before installation.",
  photos: [
    {
      path: `/assets/components/${d.slug}.jpg`,
      title: d.name + " · reference view",
      sourceUrl: manual + "#page=" + (d.page - 1),
      originalUrl: "",
      author: "FalconID · AI-generated illustration",
      license: "Generated image",
      licenseUrl: "/image-provenance.json",
      modified:
        "Illustrative interpretation of the public manual diagram; not an OEM photograph or dimensionally validated model.",
      description: d.description,
    },
  ],
  inventory: {
    quantity: [12, 8, 4][i],
    bin: `AGE-B${i + 1}-04`,
    unitPrice: [24.5, 18.75, 32][i],
    updatedAt: "2026-10-29T04:00:00.000Z",
  },
  nsn: d.nsn,
  partNumber: d.partNumber,
  cage: d.cage,
  compatibility: "Listed for MEP-831A / MEP-832A in the 30 April 2010 manual",
  platform: "MEP-832A",
  capturePath: `/assets/captures/${d.slug}.jpg`,
  diagram: `/assets/components/${d.slug}-diagram.jpg`,
  imageProvenance:
    "AI-generated component and capture images, based on public manual illustrations. Physical geometry and visual identification have not been validated against manufacturer samples.",
  sourceUrl: manual + "#page=" + d.page,
  documents: [
    {
      title: "Illustrated parts breakdown",
      code: to,
      detail: `WP ${d.wp} · Figure ${d.figure} · Item ${d.item} · PDF page ${d.page}`,
      kind: "Parts identification",
      url: manual + "#page=" + d.page,
    },
    {
      title:
        d.name === "Air cleaner filter element"
          ? "Air cleaner assembly maintenance"
          : d.name === "Fuel filter element"
            ? "Fuel filter / water separator maintenance"
            : "Oil filter maintenance",
      code: `TM 9-6115-639-13&P · WP ${d.serviceWp}`,
      detail: `Inspection, removal and replacement · PDF page ${d.servicePage}`,
      kind: "Maintenance reference",
      url: manual + "#page=" + d.servicePage,
    },
    {
      title: "Operator & field maintenance manual",
      code: to,
      detail:
        "30 April 2010 edition · Air Force / Army / Marine Corps · Distribution A",
      kind: "Technical Order",
      url: manual + "#page=1",
    },
  ],
}));
for (const p of catalog) {
  p.description = p.description.replace(
    " · illustrative component category.",
    " component.",
  );
  p.inventory.bin = p.inventory.bin.replace("DEMO-", "AGE-");
}
for (const part of parts) {
  if (part.id !== "MEP-FUEL-01")
    part.documents.push({
      title:
        part.id === "MEP-AIR-01"
          ? "L70AE-DEGFR air cleaner maintenance"
          : "L70AE-DEGFR oil filter maintenance",
      code: "TO 38G1-128-2 / TM 9-2815-257-24",
      detail:
        part.id === "MEP-AIR-01"
          ? "1 November 2000 edition · Para. 3-16 · PDF page 48"
          : "1 November 2000 edition · Para. 3-18 · PDF page 53",
      kind: "Engine Technical Order",
      url:
        "https://www.liberatedmanuals.com/TM-9-2815-257-24.pdf#page=" +
        (part.id === "MEP-AIR-01" ? 48 : 53),
    });
}
const all = [...parts, ...catalog];
await fs.writeFile("data/catalog.json", JSON.stringify(all, null, 2));
await fs.writeFile("public/catalog.json", JSON.stringify(all));
const q = (x) => "'" + String(x ?? "").replaceAll("'", "''") + "'";
const sql =
  `DROP TABLE IF EXISTS component_vectors;DROP TABLE IF EXISTS documents;DROP TABLE IF EXISTS photos;DROP TABLE IF EXISTS demo_inventory;DROP TABLE IF EXISTS parts;CREATE TABLE parts(id TEXT PRIMARY KEY,name TEXT,category TEXT,nsn TEXT,part_number TEXT,cage TEXT,platform TEXT,record_json TEXT);CREATE TABLE photos(part_id TEXT,path TEXT,source_url TEXT,author TEXT);CREATE TABLE documents(part_id TEXT,title TEXT,code TEXT,detail TEXT,url TEXT);CREATE TABLE component_vectors(part_id TEXT,path TEXT,model TEXT,dimensions INTEGER,vector_json TEXT);BEGIN;\n` +
  all
    .map(
      (p) =>
        `INSERT INTO parts VALUES(${[p.id, p.name, p.category, p.nsn, p.partNumber, p.cage, p.platform, JSON.stringify(p)].map(q)});\n` +
        p.photos
          .map(
            (f) =>
              `INSERT INTO photos VALUES(${[p.id, f.path, f.sourceUrl, f.author].map(q)});\n`,
          )
          .join("") +
        (p.documents || [])
          .map(
            (d) =>
              `INSERT INTO documents VALUES(${[p.id, d.title, d.code, d.detail, d.url].map(q)});\n`,
          )
          .join(""),
    )
    .join("") +
  "COMMIT;";
await fs.writeFile("data/catalog.sql", sql);
execFileSync("/usr/bin/sqlite3", ["data/catalog.sqlite"], { input: sql });
await fs.writeFile(
  "public/photo-credits.json",
  JSON.stringify(
    all.flatMap((p) => p.photos.map((f) => ({ partId: p.id, ...f }))),
    null,
    2,
  ),
);
console.log(
  "Catalog:",
  all.length,
  "records; sourced MEP components:",
  parts.length,
);
