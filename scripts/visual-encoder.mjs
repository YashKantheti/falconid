import path from "node:path";
import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";
// The database and every captured image use the same pinned encoder and preprocessing.
env.allowRemoteModels = false;
env.localModelPath = path.join(process.cwd(), "models/");
let ready;
function load() {
  return (ready ??= Promise.all([
    AutoProcessor.from_pretrained("dinov2-small"),
    AutoModel.from_pretrained("dinov2-small", {
      dtype: "q8",
      device: "cpu",
      session_options: { intra_op_num_threads: 2, inter_op_num_threads: 1 },
    }),
  ]).catch((error) => {
    ready = undefined;
    throw error;
  }));
}
export async function embedImage(source) {
  const [processor, model] = await load();
  const image =
    typeof source === "string" ? await RawImage.read(source) : source;
  const output = await model(await processor(image));
  // DINOv2 CLS token: 384 dimensions. Normalize for cosine nearest-neighbor search.
  const vector = Array.from(output.last_hidden_state.data.slice(0, 384));
  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm) || norm === 0)
    throw Error("Invalid image embedding");
  return vector.map((value) => value / norm);
}
export { RawImage };
