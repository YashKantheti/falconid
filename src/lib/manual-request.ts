import { z } from "zod";

export const manualRequestSchema = z
  .object({
    question: z.string().trim().min(3).max(1600),
    // Legacy clients may send an empty array. Unsigned conversation content is never accepted.
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(5000),
        }),
      )
      .max(0)
      .default([]),
    conversationToken: z.string().max(20000).optional(),
    documentId: z.enum(["generator-2010", "engine-2000", "all"]).default("all"),
    partId: z.string().max(40).optional(),
  })
  .strict();

export class ManualBodyTooLarge extends Error {}
export async function readLimitedManualBody(request: Request, maximum = 32000) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new ManualBodyTooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
