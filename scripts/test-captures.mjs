import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const catalog = JSON.parse(await fs.readFile("data/catalog.json", "utf8"));
const tests = [];
for (const p of catalog.filter((p) => p.capturePath)) {
  const form = new FormData();
  form.append(
    "images",
    new Blob([await fs.readFile("public" + p.capturePath)], {
      type: "image/jpeg",
    }),
    "unlabeled-camera-upload.jpg",
  );
  form.append("platform", "MEP-832A");
  const response = await fetch(base + "/api/identify", {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.method, "AI vector match");
  assert.equal(result.dimensions, 384);
  assert.equal(result.candidates[0].partId, p.id);
  assert.equal(result.searched, 3);
  tests.push({
    part: p.id,
    similarity: result.candidates[0].similarity,
    elapsedMs: result.elapsedMs,
  });
}
const invalid = await fetch(base + "/api/identify", {
  method: "POST",
  body: new FormData(),
});
assert.equal(invalid.status, 400);
console.log(
  JSON.stringify(
    { url: base, captures: tests, invalidUploadRejected: true },
    null,
    2,
  ),
);
