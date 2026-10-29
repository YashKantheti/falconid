import { APICallError } from "ai";
import { z } from "zod";
import catalog from "../../../../data/catalog.json";
import { manualLibrary } from "@/lib/manual-corpus";
import {
  answerFromManuals,
  manualChatConfiguration,
} from "@/lib/manual-answer";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
const requestSchema = z.object({
  question: z.string().trim().min(3).max(1600),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(5000),
      }),
    )
    .max(8)
    .default([]),
  documentId: z.enum(["generator-2010", "engine-2000", "all"]).default("all"),
  partId: z.string().max(40).optional(),
});
export async function GET(request: Request) {
  const { corpus } = manualLibrary();
  const partId = new URL(request.url).searchParams.get("part");
  const part = partId ? catalog.find((part) => part.id === partId) : undefined;
  return Response.json(
    {
      ...manualChatConfiguration(),
      context: part
        ? { id: part.id, name: part.name, partNumber: part.partNumber }
        : null,
      documents: corpus.documents.map(
        ({ id, code, title, edition, pages, url }) => ({
          id,
          code,
          title,
          edition,
          pages,
          url,
        }),
      ),
      pages: corpus.documents.reduce((sum, doc) => sum + doc.pages, 0),
      excerpts: corpus.chunks.length,
      indexing: "Searchable PDF text; diagrams and images are not interpreted.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  if (origin) {
    try {
      if (new URL(origin).host !== host)
        return Response.json({ error: "Origin not allowed" }, { status: 403 });
    } catch {
      return Response.json({ error: "Origin not allowed" }, { status: 403 });
    }
  }
  if (Number(request.headers.get("content-length") || 0) > 32000)
    return Response.json(
      { error: "Conversation is too large." },
      { status: 413 },
    );
  try {
    const body = await request.text();
    if (body.length > 32000)
      return Response.json(
        { error: "Conversation is too large." },
        { status: 413 },
      );
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return Response.json(
        { error: "Use a valid question request." },
        { status: 400 },
      );
    }
    const input = requestSchema.safeParse(parsed);
    if (!input.success)
      return Response.json(
        {
          error:
            "Enter a question under 1,600 characters and use a supported manual.",
        },
        { status: 400 },
      );
    if (!manualChatConfiguration().configured)
      return Response.json(
        {
          error:
            "Technical chat is not configured. Add OPENROUTER_API_KEY in the project's server environment.",
        },
        { status: 503 },
      );
    const { question, history, documentId, partId } = input.data;
    const part = partId
      ? catalog.find((part) => part.id === partId)
      : undefined;
    if (partId && !part)
      return Response.json(
        { error: "Unknown component context." },
        { status: 400 },
      );
    const context = part
      ? `${part.name}. Part number ${part.partNumber || "not established"}. ${part.description}`
      : "";
    const previousUser =
      history.filter((message) => message.role === "user").at(-1)?.content ||
      "";
    const previousAssistant =
      history.filter((message) => message.role === "assistant").at(-1)
        ?.content || "";
    const { corpus, search } = manualLibrary();
    const hits = search(question, {
      documentId: documentId === "all" ? undefined : documentId,
      context,
      previousQuestion: previousUser + " " + previousAssistant.slice(0, 1400),
    });
    const answer = await answerFromManuals({
      question,
      history,
      hits,
      documents: corpus.documents,
      context,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(65000)]),
    });
    return Response.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (request.signal.aborted)
      return Response.json({ error: "Question canceled." }, { status: 499 });
    console.error("Technical chat failed", {
      type: error instanceof Error ? error.name : "Unknown",
      statusCode: APICallError.isInstance(error) ? error.statusCode : undefined,
    });
    return Response.json(
      { error: "The document answer could not complete. Please try again." },
      { status: 503 },
    );
  }
}
