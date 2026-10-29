import { readFileSync } from "node:fs";
import path from "node:path";
import { createManualSearch } from "./manual-search.ts";
import type { ManualCorpus } from "./manual-types.ts";

let cached:
  | { corpus: ManualCorpus; search: ReturnType<typeof createManualSearch> }
  | undefined;
export function manualLibrary() {
  if (!cached) {
    const corpus = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "data/technical-manuals.json"),
        "utf8",
      ),
    ) as ManualCorpus;
    cached = { corpus, search: createManualSearch(corpus) };
  }
  return cached;
}
