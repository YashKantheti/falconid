import type { MatchResult } from "./demo-types";
let controller: AbortController | null = null;
export async function identifyPhotos(
  images: Blob[],
  progress: (message: string) => void,
  platform = "MEP-832A",
): Promise<MatchResult> {
  if (controller) throw Error("A photo is already being analyzed.");
  const current = new AbortController();
  controller = current;
  progress("Analyzing photo · searching vectors and reviewing candidates…");
  const form = new FormData();
  form.append("platform", platform);
  images.forEach((image, i) =>
    form.append("images", image, `capture-${i}.jpg`),
  );
  try {
    const response = await fetch("/api/identify", {
      method: "POST",
      body: form,
      signal: current.signal,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "Image matching failed.");
    return result;
  } finally {
    if (controller === current) controller = null;
  }
}
export function cancelRecognition() {
  controller?.abort();
  controller = null;
}
