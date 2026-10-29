import fs from "node:fs/promises";
import path from "node:path";
const revision = "c2bb04a51fab207c420665f1946016107bffc701";
for (const file of [
  "config.json",
  "preprocessor_config.json",
  "onnx/model_quantized.onnx",
]) {
  const target = path.join("models/dinov2-small", file);
  try {
    await fs.access(target);
    continue;
  } catch {}
  await fs.mkdir(path.dirname(target), { recursive: true });
  console.log("Preparing pinned DINOv2 encoder:", file);
  const response = await fetch(
    `https://huggingface.co/Xenova/dinov2-small/resolve/${revision}/${file}`,
  );
  if (!response.ok) throw Error(`Model preparation failed: ${response.status}`);
  await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
}
console.log("Server image encoder ready (384-dimensional vectors).");
