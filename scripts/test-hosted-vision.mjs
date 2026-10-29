import fs from "node:fs/promises";
import assert from "node:assert/strict";
import sharp from "sharp";
const base = process.env.TEST_URL || "https://age-scout-demo.vercel.app";
const config = await (await fetch(base + "/api/identify")).json();
assert.equal(config.configured, true, "Hosted AI is not configured");
const cases = [
  {
    file: "work/upload-pack/fuel-filter-fleetfilter.jpg",
    expected: "MEP-FUEL-01",
  },
  { file: "work/upload-pack/air-filter-altrad.jpg", expected: "MEP-AIR-01" },
  { file: "public/assets/captures/oil-strainer.jpg", expected: "MEP-OIL-01" },
  { file: "public/catalog/DEMO-001-0.jpg", expected: "none" },
];
const results = [];
for (const item of cases) {
  const bytes = await sharp(item.file)
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#fff" })
    .jpeg({ quality: 90 })
    .toBuffer();
  const body = new FormData();
  body.append("platform", "MEP-832A");
  body.append(
    "images",
    new Blob([bytes], { type: "image/jpeg" }),
    "uploaded-image.jpg",
  );
  const response = await fetch(base + "/api/identify", {
    method: "POST",
    body,
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.vision?.status, "applied", JSON.stringify(result));
  assert.equal(result.method, "AI vision + vectors");
  const record = {
    file: item.file,
    expected: item.expected,
    selected: result.vision.selectedPartId,
    first: result.candidates[0]?.partId,
    quality: result.vision.matchQuality,
    provider: result.vision.provider,
    model: result.vision.model,
    reason: result.vision.reason,
    observedFeatures: result.vision.observedFeatures,
    elapsedMs: result.elapsedMs,
    usage: result.visionUsage,
  };
  results.push(record);
  console.log(JSON.stringify(record));
  await fs.writeFile(
    "work/hosted-vision-results.json",
    JSON.stringify(
      { url: base, checkedAt: new Date().toISOString(), results },
      null,
      2,
    ),
  );
  assert.equal(result.vision.selectedPartId, item.expected, item.file);
  if (item.expected === "none") assert.equal(result.reliable, false);
}
console.log("Hosted vision verification passed.");
