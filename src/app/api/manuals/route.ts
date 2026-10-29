import { APICallError } from "ai";
import {
  manualRequestSchema,
  ManualBodyTooLarge,
  readLimitedManualBody,
} from "@/lib/manual-request";
import catalog from "../../../../data/catalog.json";
import { manualLibrary } from "@/lib/manual-corpus";
import {
  answerFromManuals,
  manualChatConfiguration,
} from "@/lib/manual-answer";
import { classifyManualScope } from "@/lib/manual-scope";
import { guardedManualChat } from "@/lib/manual-service";
import { consumeManualQuota, ManualRateLimitError } from "@/lib/manual-limits";
import {
  manualSigningKey,
  ManualSessionError,
  nextManualHistory,
  readManualHistory,
  signManualHistory,
} from "@/lib/manual-session";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
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
      scope:
        "Equipment-manual questions only. Coding and general-purpose requests are restricted.",
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
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  if (origin) {
    try {
      if (new URL(origin).host !== host)
        return Response.json({ error: "Origin not allowed" }, { status: 403 });
    } catch {
      return Response.json({ error: "Origin not allowed" }, { status: 403 });
    }
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return Response.json({ error: "Use application/json." }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 32000)
    return Response.json(
      { error: "Conversation is too large." },
      { status: 413 },
    );
  try {
    const body = await readLimitedManualBody(request);
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
    const input = manualRequestSchema.safeParse(parsed);
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
    const { question, documentId, partId, conversationToken } = input.data;
    const key = manualSigningKey();
    const history = readManualHistory(conversationToken, key);
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
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(65000),
    ]);
    const answer = await guardedManualChat(
      { question, history, context },
      {
        consumeQuota: () => consumeManualQuota(request, key),
        scopeAllowed: () =>
          classifyManualScope({ question, history, context, signal }),
        answer: () => {
          const { corpus, search } = manualLibrary();
          const hits = search(question, {
            documentId: documentId === "all" ? undefined : documentId,
            context,
            previousQuestion:
              previousUser + " " + previousAssistant.slice(0, 1400),
          });
          return answerFromManuals({
            question,
            history,
            hits,
            documents: corpus.documents,
            context,
            signal,
          });
        },
      },
    );
    const nextToken =
      answer.status === "restricted"
        ? conversationToken
        : signManualHistory(nextManualHistory(history, question, answer), key);
    return Response.json(
      { ...answer, conversationToken: nextToken },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ManualBodyTooLarge)
      return Response.json(
        { error: "Conversation is too large." },
        { status: 413 },
      );
    if (error instanceof ManualSessionError)
      return Response.json(
        { error: error.message, code: "SESSION_INVALID" },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof ManualRateLimitError)
      return Response.json(
        { error: error.message, code: "CHAT_RATE_LIMIT" },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfter),
            "Cache-Control": "no-store",
          },
        },
      );
    if (request.signal.aborted)
      return Response.json({ error: "Question canceled." }, { status: 499 });
    console.error("Technical chat failed", {
      type: error instanceof Error ? error.name : "Unknown",
      statusCode: APICallError.isInstance(error) ? error.statusCode : undefined,
    });
    return Response.json(
      {
        error:
          "The protected document chat could not complete. Please try again later.",
      },
      { status: 503 },
    );
  }
}
