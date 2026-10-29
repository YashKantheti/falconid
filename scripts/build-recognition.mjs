import fs from "node:fs/promises";
import { embedImage } from "./visual-encoder.mjs";
import { rankCandidates } from "../public/matching.js";
const catalog = JSON.parse(await fs.readFile("data/catalog.json", "utf8"));
const references = [];
for (const p of catalog)
  for (const photo of p.photos) {
    references.push({
      partId: p.id,
      path: photo.path,
      vector: await embedImage("public" + photo.path),
    });
    console.log(p.id, photo.path);
  }
const index = {
  model: "DINOv2-small",
  revision: "c2bb04a51fab207c420665f1946016107bffc701",
  dimensions: 384,
  dtype: "q8",
  distance: "cosine",
  createdAt: new Date().toISOString(),
  references,
};
await fs.writeFile("data/recognition-index.json", JSON.stringify(index));
await fs.writeFile("public/recognition-index.json", JSON.stringify(index));
const heldOut = [];
for (const part of catalog.filter((p) => p.capturePath)) {
  const vector = await embedImage("public" + part.capturePath);
  const scoped = {
    ...index,
    references: index.references.filter(
      (r) => catalog.find((p) => p.id === r.partId)?.platform === part.platform,
    ),
  };
  const result = rankCandidates([vector], scoped);
  const full = rankCandidates([vector], index);
  heldOut.push({
    fullCatalogPrediction: full.candidates[0].partId,
    scope: part.platform,
    expected: part.id,
    capture: part.capturePath,
    predicted: result.candidates[0].partId,
    similarity: result.candidates[0].similarity,
    margin: result.margin,
    top3: result.candidates.slice(0, 3).map((c) => c.partId),
    accepted: result.reliable,
  });
}
const report = {
  model: index.model,
  dimensions: 384,
  method:
    "All captures encoded independently; cosine search over stored image vectors. Capture images excluded from reference index. Held-out ranking uses explicit equipment context (MEP-832A); full-catalog predictions are also reported.",
  heldOut: {
    total: heldOut.length,
    top1: heldOut.filter((x) => x.expected === x.predicted).length,
    top3: heldOut.filter((x) => x.top3.includes(x.expected)).length,
  },
  cases: heldOut,
  reference: {
    total: references.length,
    top1: references.filter(
      (r) =>
        rankCandidates([r.vector], index).candidates[0].partId === r.partId,
    ).length,
  },
  limitations: [
    "The three field captures and three component reference images are AI-generated illustrations of sourced part records.",
    "This is a small synthetic viewpoint test, not operational accuracy validation.",
    "Visual similarity cannot establish interchangeability; confirm markings, configuration and current authorized publications.",
  ],
};
await fs.writeFile(
  "data/evaluation-report.json",
  JSON.stringify(report, null, 2),
);
await fs.writeFile(
  "public/evaluation-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
// Export the same searchable reference vectors alongside source-linked records in SQLite.
const { execFileSync } = await import("node:child_process");
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
execFileSync("/usr/bin/sqlite3", ["data/catalog.sqlite"], {
  input:
    "DELETE FROM component_vectors;BEGIN;\n" +
    references
      .map(
        (r) =>
          `INSERT INTO component_vectors VALUES(${quote(r.partId)},${quote(r.path)},${quote(index.model)},384,${quote(JSON.stringify(r.vector))});`,
      )
      .join("\n") +
    "\nCOMMIT;",
});
