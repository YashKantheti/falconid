import fs from "node:fs/promises";
import sharp from "sharp";
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const sources = JSON.parse(await fs.readFile("work/upload-pack/sources.json"));
const cases = [
  {
    file: "air-filter-altrad.jpg",
    expected: "MEP-AIR-01",
    type: "Internet photograph",
  },
  {
    file: "fuel-filter-fleetfilter.jpg",
    expected: "MEP-FUEL-01",
    type: "Internet photograph",
  },
  {
    file: "oil-strainer-view-b.jpg",
    expected: "MEP-OIL-01",
    type: "Internet photograph, packaged component",
  },
  ...["air-filter", "fuel-filter", "oil-strainer"].map((slug, i) => ({
    file: "public/assets/captures/" + slug + ".jpg",
    expected: ["MEP-AIR-01", "MEP-FUEL-01", "MEP-OIL-01"][i],
    type: "AI-generated field capture",
  })),
];
const results = [];
for (const item of cases) {
  const path = item.file.startsWith("public/")
    ? item.file
    : "work/upload-pack/" + item.file;
  const bytes = await sharp(path)
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#fff" })
    .jpeg({ quality: 90 })
    .toBuffer();
  const form = new FormData();
  form.append("platform", "MEP-832A");
  form.append(
    "images",
    new Blob([bytes], { type: "image/jpeg" }),
    "camera-upload.jpg",
  );
  const response = await fetch(base + "/api/identify", {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.candidates[0].partId, item.expected, item.file);
  results.push({
    ...item,
    predicted: result.candidates[0].partId,
    similarity: result.candidates[0].similarity,
    reliable: result.reliable,
    elapsedMs: result.elapsedMs,
    source: sources.find((s) => s.file === item.file)?.source,
  });
}
const report = {
  url: base,
  checkedAt: new Date().toISOString(),
  scope: "MEP-832A",
  note: "Internet upload images are excluded from the reference index. Separate product photographs/views are indexed. Similarity is not calibrated confidence; low-confidence candidates require review.",
  results,
};
await fs.writeFile(
  "work/upload-pack/test-results.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
