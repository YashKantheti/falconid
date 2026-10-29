import type { ManualCorpus, ManualHit } from "./manual-types.ts";

const stop = new Set(
  "a an and are as at be been by can could do does for from has have how i if in into is it its me of on or our please should that the their them there these they this those to us was we what when where which who why will with would you your".split(
    " ",
  ),
);
function stem(word: string) {
  if (/\d/.test(word) || word.length < 5) return word;
  return word.replace(/ies$/, "y").replace(/(?:ing|ed|s)$/, "");
}
export function manualTokens(text: string) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((word) => !stop.has(word) && word.length > 1)
    .map(stem);
}
const synonyms: [RegExp, string][] = [
  [/\bstrainer\b/i, "oil filter mesh"],
  [/\bair (?:filter|cleaner)\b/i, "air cleaner element intake"],
  [/\bfuel filter\b/i, "fuel filter water separator element"],
  [/\b(?:inspect|inspection|check)\b/i, "inspection damage leakage"],
  [/\b(?:clean|cleaning)\b/i, "clean cleaning dirt residue"],
  [/\b(?:warning|alarm|indicator)\b/i, "indicator malfunction troubleshooting"],
  [/\bo[ -]?ring\b/i, "ring gasket seal"],
];

export function createManualSearch(corpus: ManualCorpus) {
  const terms = corpus.chunks.map((chunk) => {
    const counts = new Map<string, number>();
    for (const word of manualTokens(chunk.heading + "\n" + chunk.text))
      counts.set(word, (counts.get(word) || 0) + 1);
    return counts;
  });
  const lengths = terms.map((counts) =>
    Array.from(counts.values()).reduce((a, b) => a + b, 0),
  );
  const average = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const frequency = new Map<string, number>();
  terms.forEach((counts) =>
    counts.forEach((_n, word) =>
      frequency.set(word, (frequency.get(word) || 0) + 1),
    ),
  );

  return function search(
    question: string,
    options: {
      documentId?: string;
      context?: string;
      previousQuestion?: string;
      limit?: number;
    } = {},
  ): ManualHit[] {
    const weights = new Map<string, number>();
    const add = (text: string, weight: number) => {
      for (const token of new Set(manualTokens(text)))
        weights.set(token, (weights.get(token) || 0) + weight);
    };
    add(question, 2);
    for (const [pattern, expansion] of synonyms)
      if (pattern.test(question)) add(expansion, 0.45);
    if (options.context) add(options.context, 0.8);
    if (
      options.previousQuestion &&
      (manualTokens(question).length < 8 ||
        /\b(it|that|this|those|them|its)\b/i.test(question))
    ) {
      add(options.previousQuestion, 0.8);
      for (const [pattern, expansion] of synonyms)
        if (pattern.test(options.previousQuestion)) add(expansion, 0.4);
    }

    const scored = corpus.chunks
      .map((chunk, index) => {
        if (options.documentId && chunk.documentId !== options.documentId)
          return { index, score: 0 };
        let score = 0;
        weights.forEach((weight, word) => {
          const tf = terms[index].get(word) || 0;
          if (!tf) return;
          const df = frequency.get(word) || 0;
          const idf = Math.log(
            1 + (corpus.chunks.length - df + 0.5) / (df + 0.5),
          );
          score +=
            (weight * idf * (tf * 2.2)) /
            (tf + 1.2 * (0.25 + (0.75 * lengths[index]) / average));
        });
        // Preserve exact identifiers and multi-word component names over generic maintenance words.
        const content = (chunk.heading + " " + chunk.text)
          .toLowerCase()
          .replace(/\s+/g, " ");
        const identifiers =
          (question + " " + (options.context || "")).match(
            /\b(?:\d[\d-]{3,}|\d{4}-\d+)\b/g,
          ) || [];
        for (const id of identifiers)
          if (content.includes(id.toLowerCase())) score += 18;
        for (const phrase of [
          "oil filter",
          "fuel filter",
          "air cleaner",
          "low oil pressure",
          "fuel injector",
          "valve clearance",
        ]) {
          if (
            question.toLowerCase().includes(phrase) &&
            content.includes(phrase)
          )
            score += 6;
        }
        if (
          /part number|\bnsn\b|stock number/i.test(question) &&
          /smr code/.test(content) &&
          /fuel|air|oil/.test(question) &&
          /fuel|air|oil/.test(content)
        )
          score += 12;
        if (chunk.indexPage) score *= 0.35;
        return { index, score };
      })
      .filter((hit) => hit.score > 1)
      .sort((a, b) => b.score - a.score);

    const limit = options.limit || 12;
    const chosen: ManualHit[] = [];
    const seen = new Set<string>();
    const addChunk = (index: number, score: number) => {
      const chunk = corpus.chunks[index];
      if (!chunk || seen.has(chunk.id) || chosen.length >= limit) return;
      if (options.documentId && chunk.documentId !== options.documentId) return;
      seen.add(chunk.id);
      chosen.push({ ...chunk, score });
    };
    // Reserve space for adjacent page context so warnings and continued procedures travel together.
    for (const hit of scored.slice(0, 8)) addChunk(hit.index, hit.score);
    for (const hit of scored.slice(0, 3)) {
      const chunk = corpus.chunks[hit.index];
      for (const offset of [-1, 1]) {
        const neighbor = corpus.chunks.findIndex(
          (candidate) =>
            candidate.documentId === chunk.documentId &&
            candidate.page === chunk.page + offset,
        );
        if (neighbor >= 0) addChunk(neighbor, hit.score * 0.4);
      }
    }
    for (const hit of scored) addChunk(hit.index, hit.score);
    return chosen;
  };
}
