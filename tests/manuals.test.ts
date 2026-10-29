import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createManualSearch } from "../src/lib/manual-search.ts";
import {
  answerFromManuals,
  validateCitedAnswer,
  verifyManualSupport,
  type CitedDraft,
} from "../src/lib/manual-answer.ts";
import type { ManualCorpus, ManualHit } from "../src/lib/manual-types.ts";

const corpus = JSON.parse(
  readFileSync("data/technical-manuals.json", "utf8"),
) as ManualCorpus;
const search = createManualSearch(corpus);
const fuel = {
  ...corpus.chunks.find((chunk) => chunk.id === "generator-2010-p445-c0")!,
  score: 1,
} as ManualHit;
const quote = fuel.text.split("\n").find((line) => line.includes("33583"))!;
const draft: CitedDraft = {
  status: "answered",
  paragraphs: [
    {
      text: "The fuel filter element is listed as part number 33583, NSN 4330-01-374-9147, in item 7 of the parts table.",
      citations: [{ sourceId: fuel.id, quote }],
    },
  ],
};

test("retrieval finds real inspection and identifier pages, keeps scope, and resolves follow-ups", () => {
  assert.ok(
    search("How do I inspect the oil strainer?")
      .slice(0, 4)
      .some((hit) => hit.page === 291 && hit.documentId === "generator-2010"),
  );
  assert.ok(
    search("What is the NSN of 33583?")
      .slice(0, 3)
      .some((hit) => hit.page === 445),
  );
  assert.ok(
    search("Which fuel filter part number is listed for MEP-832A?", {
      context: "Fuel filter element 33583",
    })
      .slice(0, 3)
      .some((hit) => hit.page === 445),
  );
  const followup = search("How do I replace its O-ring?", {
    previousQuestion:
      "How do I inspect the oil strainer? Inspect the oil filter mesh material and clean out dirt and residue.",
  });
  assert.ok(
    followup
      .slice(0, 3)
      .some((hit) => hit.page === 53 && hit.documentId === "engine-2000"),
  );
  assert.ok(
    search("air cleaner inspection", { documentId: "engine-2000" }).every(
      (hit) => hit.documentId === "engine-2000",
    ),
  );
});

test("citations use physical PDF pages and exact excerpts from the source, not model-written URLs", () => {
  const answer = validateCitedAnswer(draft, [fuel], corpus.documents);
  assert.equal(answer.status, "answered");
  assert.equal(answer.sources[0].page, 445);
  assert.equal(answer.sources[0].printedPage, "0116-3/(4 blank)");
  assert.ok(answer.sources[0].url.endsWith("#page=445"));
  assert.equal(answer.paragraphs[0].citations[0], answer.sources[0].id);
  assert.ok(answer.sources[0].quote.includes("33583"));
});

test("fabricated citations, altered quotes and unsupported paragraphs fail closed", () => {
  for (const citations of [
    [{ sourceId: "invented-page", quote }],
    [
      {
        sourceId: fuel.id,
        quote: "The manual specifies a made-up torque of 900 Nm.",
      },
    ],
    [],
  ]) {
    const result = validateCitedAnswer(
      {
        status: "answered",
        paragraphs: [{ text: "Unsupported answer", citations }],
      },
      [fuel],
      corpus.documents,
    );
    assert.equal(result.status, "insufficient");
    assert.equal(result.sources.length, 0);
  }
});

function stubModel(outputs: unknown[], sent: unknown[] = []) {
  const provider = createOpenRouter({
    apiKey: "test-only-not-a-real-key",
    fetch: (async (_input: unknown, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      const output = outputs.shift();
      if (!output) throw Error("Unexpected extra provider request");
      return Response.json({
        id: "manual-test",
        object: "chat.completion",
        created: 1,
        model: "test-manuals",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(output) },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
      });
    }) as typeof fetch,
  });
  return provider("test-manuals");
}

test("a real quote cannot legitimize a mismatched answer claim", async () => {
  const answer = validateCitedAnswer(draft, [fuel], corpus.documents);
  answer.paragraphs[0].text = "The fuel filter NSN is 9999-00-000-0000.";
  const checked = await verifyManualSupport(
    answer,
    stubModel([{ supported: [false] }]),
  );
  assert.equal(checked.status, "insufficient");
  assert.equal(checked.sources.length, 0);
});

test("the provider receives retrieved text and a separate support check before a cited answer is returned", async () => {
  const sent: unknown[] = [];
  const answer = await answerFromManuals({
    question: "What is the NSN of 33583?",
    history: [],
    hits: [fuel],
    documents: corpus.documents,
    model: stubModel([draft, { supported: [true] }], sent),
  });
  assert.equal(sent.length, 2);
  assert.equal(answer.status, "answered");
  assert.equal(answer.sources[0].page, 445);
  assert.match(JSON.stringify(sent[0]), /4330-01-374-9147/);
  assert.match(JSON.stringify(sent[1]), /strict technical citation verifier/);
  assert.equal(
    (
      await answerFromManuals({
        question: "unsupported",
        history: [],
        hits: [],
        documents: corpus.documents,
      })
    ).status,
    "insufficient",
  );
});
