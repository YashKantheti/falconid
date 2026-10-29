import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  requestStatus,
  noteStatus,
  mergeMutation,
} from "../src/lib/workspace-logic.ts";
import { seedData } from "../src/lib/demo-seed.ts";
import type { WorkspaceData, Activity } from "../src/lib/demo-types.ts";
test("request status never regresses when events arrive out of order", () => {
  const r = seedData.requests[0];
  const events: Activity[] = [
    {
      id: "2",
      target: "request",
      targetId: r.id,
      action: "Ready",
      author: "Demo",
      createdAt: "2026-10-28T12:20:00Z",
    },
    {
      id: "1",
      target: "request",
      targetId: r.id,
      action: "Acknowledged",
      author: "Demo",
      createdAt: "2026-10-28T12:10:00Z",
    },
  ];
  assert.equal(requestStatus(r, events), "Ready");
});
test("queued request retries do not duplicate a saved request", () => {
  const data: WorkspaceData = {
    ...structuredClone(seedData),
    storage: "local",
  };
  const mutation = { kind: "request" as const, record: seedData.requests[0] };
  assert.equal(
    mergeMutation(data, mutation).requests.length,
    data.requests.length,
  );
});
test("acknowledgment does not resolve a hazard; reopening preserves acknowledgments", () => {
  const n = seedData.notes[0],
    base = { target: "note" as const, targetId: n.id, author: "Demo" };
  const events: Activity[] = [
    {
      ...base,
      id: "1",
      createdAt: "2026-10-28T11:00:00Z",
      action: "Acknowledged",
    },
    { ...base, id: "2", createdAt: "2026-10-28T12:00:00Z", action: "Resolved" },
    { ...base, id: "3", createdAt: "2026-10-28T13:00:00Z", action: "Reopened" },
  ];
  assert.deepEqual(noteStatus(n, events), {
    resolved: false,
    acknowledged: ["Demo"],
  });
});
test("catalog keeps source-linked generator records distinct from general categories", () => {
  const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
  assert.equal(catalog.length, 103);
  assert.equal(new Set(catalog.map((p: { id: string }) => p.id)).size, 103);
  const sourced = catalog.filter(
    (p: { platform?: string }) => p.platform === "MEP-832A",
  );
  assert.equal(sourced.length, 3);
  assert.deepEqual(
    sourced.map((p: { partNumber: string }) => p.partNumber),
    ["114250-12581", "33583", "114250-35070"],
  );
  for (const p of catalog) {
    assert.ok(p.photos.length > 0);
    for (const photo of p.photos)
      assert.ok(existsSync("public" + photo.path), photo.path);
    if (p.platform) {
      assert.match(p.nsn, /^\d{4}-\d{2}-\d{3}-\d{4}$/);
      assert.ok(p.documents.length >= 3);
      assert.ok(p.imageProvenance.includes("AI-generated"));
      assert.ok(existsSync("public" + p.capturePath));
      assert.ok(
        p.documents.every((d: { url: string }) =>
          /https:\/\/(www\.)?(radiomanual.info|liberatedmanuals.com)\//.test(
            d.url,
          ),
        ),
      );
    } else {
      assert.equal(p.nsn, null);
      assert.equal(p.partNumber, null);
      for (const photo of p.photos) {
        assert.match(photo.sourceUrl, /^https:\/\/commons.wikimedia.org\//);
        assert.ok(photo.author);
        assert.match(photo.license, /CC BY|CC0|Public domain/);
      }
    }
  }
});
