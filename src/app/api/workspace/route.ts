import {
  readWorkspace,
  validWorkspace,
  writeRecord,
} from "@/lib/workspace-storage";
import type { PendingMutation } from "@/lib/demo-types";
import { assets } from "@/lib/demo-seed";
import { REQUEST_STATUSES } from "@/lib/demo-types";
import { requestStatus } from "@/lib/workspace-logic";
import catalog from "../../../../data/catalog.json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (x: unknown, min = 1, max = 200): x is string =>
  typeof x === "string" && x.trim().length >= min && x.length <= max;
const asset = (x: unknown) => x === "" || assets.some((a) => a.id === x);
export async function GET(request: Request) {
  const workspace = new URL(request.url).searchParams.get("workspace");
  if (!validWorkspace(workspace))
    return Response.json(
      { error: "A valid workspace link is required." },
      { status: 400 },
    );
  try {
    return Response.json(await readWorkspace(workspace), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Storage unavailable" },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const expectedHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  if (origin && new URL(origin).host !== expectedHost)
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  const body = await request.text();
  if (body.length > 20000)
    return Response.json({ error: "Request is too large." }, { status: 413 });
  try {
    const { workspace, mutation } = JSON.parse(body) as {
      workspace: string;
      mutation: PendingMutation;
    };
    if (
      !validWorkspace(workspace) ||
      !mutation ||
      !["request", "note", "event", "scan"].includes(mutation.kind)
    )
      return Response.json(
        { error: "Invalid workspace or record type." },
        { status: 400 },
      );
    const r = mutation.record;
    if (
      !r ||
      !uuid.test(r.id) ||
      !text(r.createdAt) ||
      !Number.isFinite(Date.parse(r.createdAt))
    )
      throw Error("Invalid record.");
    const existingData = await readWorkspace(workspace);
    const collection = (
      {
        request: "requests",
        note: "notes",
        event: "events",
        scan: "scans",
      } as const
    )[mutation.kind];
    if (existingData[collection].some((item) => item.id === r.id))
      return Response.json({
        ok: true,
        storage: existingData.storage,
        duplicate: true,
      });
    if (mutation.kind === "request") {
      const r = mutation.record as import("@/lib/demo-types").SupplyRequest;
      if (
        !text(r.requester) ||
        !asset(r.assetId) ||
        !text(r.location) ||
        !["Routine", "Urgent"].includes(r.priority) ||
        !Array.isArray(r.items) ||
        !r.items.length ||
        r.items.length > 100 ||
        r.items.some(
          (i) =>
            !catalog.some((p) => p.id === i.partId) ||
            !Number.isInteger(i.qty) ||
            i.qty < 1 ||
            i.qty > 999,
        )
      )
        throw Error("Check the request fields and quantities.");
      r.items = r.items.map((i) => ({
        ...i,
        name: catalog.find((p) => p.id === i.partId)!.name,
      }));
      r.number = `AGE-${r.id.slice(0, 8).toUpperCase()}`;
    }
    if (mutation.kind === "note") {
      const r = mutation.record as import("@/lib/demo-types").Handover;
      if (
        !text(r.author) ||
        !asset(r.assetId) ||
        !text(r.title, 1, 160) ||
        !text(r.body, 1, 3000) ||
        !text(r.owner) ||
        !["Hazard", "Pass-down", "General"].includes(r.type)
      )
        throw Error("Check the handover fields.");
    }
    if (mutation.kind === "scan") {
      const r = mutation.record as import("@/lib/demo-types").ScanRecord;
      if (
        !asset(r.assetId) ||
        !catalog.some((p) => p.id === r.partId) ||
        r.confirmed !== true ||
        ![
          "Photo candidate",
          "Reference photo",
          "AI vector match",
          "AI vision + vectors",
          "Manual lookup",
          "Barcode",
        ].includes(r.method)
      )
        throw Error("Invalid confirmed scan.");
    }
    if (mutation.kind === "event") {
      const r = mutation.record as import("@/lib/demo-types").Activity;
      if (!text(r.author) || !text(r.targetId))
        throw Error("Invalid activity.");
      const data = existingData;
      if (r.target === "request") {
        const req = data.requests.find((q) => q.id === r.targetId);
        if (!req) throw Error("Request not found.");
        const step = REQUEST_STATUSES.indexOf(r.action as never),
          current = REQUEST_STATUSES.indexOf(requestStatus(req, data.events));
        if (step >= 0 && step <= current)
          return Response.json({
            ok: true,
            storage: existingData.storage,
            alreadyAdvanced: true,
          });
        if (step !== current + 1)
          throw Error(
            "Refresh the request before advancing to its next status.",
          );
      } else if (r.target === "note") {
        if (
          !data.notes.some((n) => n.id === r.targetId) ||
          !["Acknowledged", "Resolved", "Reopened"].includes(r.action)
        )
          throw Error("Invalid note action.");
      } else throw Error("Invalid activity target.");
    }
    // Idempotent IDs preserve queued records on retry. Server receipt time is authoritative for activity ordering.
    r.createdAt = new Date().toISOString();
    const storage = await writeRecord(workspace, mutation);
    return Response.json({ ok: true, storage, mutation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    const unavailable = /storage|token|blob|Cloud/i.test(message);
    return Response.json(
      { error: message },
      { status: unavailable ? 503 : 400 },
    );
  }
}
