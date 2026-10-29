import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { readFileSync } from "node:fs";
import {
  applyVisionAssessment,
  reviewWithVision,
  type VisionAssessment,
} from "../src/lib/vision-matching.ts";
import type { Candidate, CatalogPart } from "../src/lib/demo-types.ts";
const catalog = JSON.parse(
  readFileSync("data/catalog.json", "utf8"),
) as CatalogPart[];
const candidates: Candidate[] = catalog.slice(0, 3).map((p, i) => ({
  partId: p.id,
  similarity: 0.8 - i * 0.1,
  reference: p.photos[0].path,
  referenceMatch: false,
}));
const assessment: VisionAssessment = {
  selectedPartId: "MEP-FUEL-01",
  rankedPartIds: ["MEP-FUEL-01", "MEP-AIR-01"],
  matchQuality: "strong",
  observedFeatures: ["Cylindrical filter with a threaded opening"],
  visibleMarkings: "33583",
  reason:
    "The captured canister and thread arrangement match the fuel-filter reference.",
};
test("vision may rerank only existing records and preserves measured vector scores", () => {
  const result = applyVisionAssessment(candidates, assessment);
  assert.equal(result.candidates[0].partId, "MEP-FUEL-01");
  assert.equal(result.candidates[0].similarity, candidates[1].similarity);
  assert.equal(result.reliable, true);
  assert.throws(() =>
    applyVisionAssessment(candidates, {
      ...assessment,
      selectedPartId: "invented-nsn",
    }),
  );
});
test("vision abstention cannot become an accepted identification", () => {
  const result = applyVisionAssessment(candidates, {
    ...assessment,
    selectedPartId: "none",
    matchQuality: "none",
  });
  assert.equal(result.reliable, false);
  assert.equal(result.candidates[0].partId, candidates[0].partId);
});
test("OpenRouter adapter sends capture and reference pixels and validates the structured decision", async () => {
  let sent: Record<string, unknown> | undefined;
  const fetchStub = async (_input: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({
      id: "test-response",
      object: "chat.completion",
      created: 1,
      model: "test-vision",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify(assessment) },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });
  };
  const provider = createOpenRouter({
    apiKey: "test-only-not-a-real-key",
    fetch: fetchStub as typeof fetch,
  });
  const image = new Uint8Array(
    readFileSync("public/assets/captures/fuel-filter.jpg"),
  );
  const result = await reviewWithVision({
    images: [image],
    candidates,
    catalog,
    model: provider("test-vision"),
    loadReference: async () => image,
  });
  assert.equal(result.method, "AI vision + vectors");
  assert.equal(result.candidates[0].partId, "MEP-FUEL-01");
  assert.equal(result.vision.status, "applied");
  const serialized = JSON.stringify(sent);
  const messages = sent?.messages as {
    content: { type: string; image_url?: { url: string } }[];
  }[];
  const imageParts = messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((p) => p.type === "image_url");
  assert.equal(imageParts.length, 4);
  assert.ok(
    imageParts.every((p) =>
      p.image_url?.url.startsWith("data:image/jpeg;base64,"),
    ),
  );
  assert.match(serialized, /json_schema/);
  assert.match(serialized, /selectedPartId/);
  assert.equal("nsn" in result, false);
  assert.equal("technicalOrders" in result, false);
});
