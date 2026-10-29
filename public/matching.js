// Cosine search over image vectors only. No hashes, filenames, text prompts or sample identifiers.
export function rankCandidates(vectors, index) {
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const groups = new Map();
  for (const ref of index.references) {
    const score =
      vectors.reduce((sum, v) => sum + dot(v, ref.vector), 0) / vectors.length;
    const previous = groups.get(ref.partId);
    if (!previous || score > previous.similarity)
      groups.set(ref.partId, {
        partId: ref.partId,
        similarity: score,
        rankingScore: score,
        reference: ref.path,
        referenceMatch: false,
      });
  }
  const scores = [...groups.values()].sort(
    (a, b) => b.similarity - a.similarity,
  );
  const top = scores[0],
    margin = top ? top.similarity - (scores[1]?.similarity ?? 0) : 0;
  return {
    candidates: scores.slice(0, 5),
    reliable: !!top && top.similarity >= 0.68 && margin >= 0.06,
    method: "AI vector match",
    margin,
  };
}
