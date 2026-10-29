import fs from "node:fs/promises";
const catalog = JSON.parse(await fs.readFile("data/catalog.json", "utf8"));
const additions = JSON.parse(
  await fs.readFile("data/internet-reference-sources.json", "utf8"),
);
for (const item of additions) {
  const part = catalog.find((p) => p.id === item.partId);
  const photo = {
    path: item.path,
    title: part.name + " · internet reference",
    sourceUrl: item.source,
    originalUrl: item.url,
    author: item.author,
    license: "Rights retained by source owner",
    licenseUrl: item.source,
    modified:
      "Resized for the component database; original watermark preserved.",
    description: "Product photograph listed for part " + item.partNumber + ".",
  };
  part.photos = [photo, ...part.photos.filter((p) => p.path !== item.path)];
  part.imageProvenance =
    "Real product reference: " +
    item.author +
    ". Additional AI-generated reference views are labeled in their photo credits. Identifiers come from the cited public manual; visual similarity does not establish interchangeability.";
}
await fs.writeFile("data/catalog.json", JSON.stringify(catalog, null, 2));
await fs.writeFile("public/catalog.json", JSON.stringify(catalog));
await fs.writeFile(
  "public/photo-credits.json",
  JSON.stringify(
    catalog.flatMap((p) =>
      p.photos.map((photo) => ({ partId: p.id, ...photo })),
    ),
    null,
    2,
  ),
);
const { execFileSync } = await import("node:child_process");
const q = (x) => "'" + String(x ?? "").replaceAll("'", "''") + "'";
execFileSync("/usr/bin/sqlite3", ["data/catalog.sqlite"], {
  input:
    "BEGIN;\n" +
    catalog
      .filter((p) => p.platform)
      .map(
        (p) =>
          `UPDATE parts SET record_json=${q(JSON.stringify(p))} WHERE id=${q(p.id)};DELETE FROM photos WHERE part_id=${q(p.id)};\n` +
          p.photos
            .map(
              (f) =>
                `INSERT INTO photos VALUES(${[p.id, f.path, f.sourceUrl, f.author].map(q)});`,
            )
            .join("\n"),
      )
      .join("\n") +
    "\nCOMMIT;",
});
console.log("Added", additions.length, "real internet reference photos.");
