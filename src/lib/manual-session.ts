import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ManualAnswer, ManualMessage } from "./manual-types.ts";

const TTL = 30 * 60 * 1000;
const payloadSchema = z
  .object({
    audience: z.literal("falconid-manual-chat-v1"),
    expires: z.number().int(),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(2000),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();
export class ManualSessionError extends Error {}

export function manualSigningKey() {
  const secret =
    process.env.MANUAL_CHAT_SIGNING_SECRET ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    (!process.env.VERCEL ? process.env.OPENROUTER_API_KEY : undefined);
  if (!secret) throw Error("Manual chat protection is not configured");
  return createHmac("sha256", secret)
    .update("falconid-manual-chat-signing-v1")
    .digest();
}
export function signManualHistory(
  messages: ManualMessage[],
  key: Buffer,
  now = Date.now(),
) {
  const payload = Buffer.from(
    JSON.stringify({
      audience: "falconid-manual-chat-v1",
      expires: now + TTL,
      messages: messages
        .slice(-6)
        .map((message) => ({
          role: message.role,
          content: message.content.slice(0, 2000),
        })),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", key)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}
export function readManualHistory(
  token: string | undefined,
  key: Buffer,
  now = Date.now(),
): ManualMessage[] {
  if (!token) return [];
  if (token.length > 20000)
    throw new ManualSessionError("Invalid chat session. Start a new chat.");
  const parts = token.split(".");
  if (parts.length !== 2)
    throw new ManualSessionError("Invalid chat session. Start a new chat.");
  const expected = createHmac("sha256", key).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], "base64url");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new ManualSessionError("Invalid chat session. Start a new chat.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new ManualSessionError("Invalid chat session. Start a new chat.");
  }
  const payload = payloadSchema.safeParse(parsed);
  if (
    !payload.success ||
    payload.data.expires <= now ||
    payload.data.expires > now + TTL + 60000
  )
    throw new ManualSessionError("Chat session expired. Start a new chat.");
  return payload.data.messages;
}
export function nextManualHistory(
  history: ManualMessage[],
  question: string,
  answer: ManualAnswer,
) {
  if (answer.status === "restricted") return history;
  return [
    ...history,
    { role: "user" as const, content: question },
    {
      role: "assistant" as const,
      content: answer.paragraphs.map((paragraph) => paragraph.text).join("\n"),
    },
  ];
}
