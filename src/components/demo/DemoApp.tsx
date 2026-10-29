/* eslint-disable @next/next/no-img-element -- Locally curated catalog photographs retain their original aspect ratio and attribution. */
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Cloud,
  CloudOff,
  Download,
  ExternalLink,
  Filter,
  Link2,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Minus,
  Package,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  SlidersHorizontal,
  Trash2,
  Truck,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import catalogData from "../../../data/catalog.json";
import type {
  Activity,
  Asset,
  CatalogPart,
  Handover,
  ScanRecord,
  SupplyRequest,
} from "@/lib/demo-types";
import { REQUEST_STATUSES } from "@/lib/demo-types";
import { assets } from "@/lib/demo-seed";
import { noteStatus, requestStatus } from "@/lib/workspace-logic";
import { useDemoWorkspace } from "@/hooks/useDemoWorkspace";
import { BRAND } from "@/lib/branding";
import IdentifyPanel from "./IdentifyPanel";
import PartDetail from "./PartDetail";
import { Modal } from "./Modal";
const catalog = catalogData as CatalogPart[];
const nav = [
  { id: "identify", name: "Identify", icon: ScanLine },
  { id: "catalog", name: "Parts", icon: Boxes },
  { id: "fleet", name: "Equipment", icon: Wrench },
  { id: "requests", name: "Requests", icon: ClipboardList },
  { id: "handover", name: "Handover", icon: MessageSquare },
] as const;
type Tab = (typeof nav)[number]["id"];
const date = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function PartCard({
  part,
  onOpen,
  onAdd,
}: {
  part: CatalogPart;
  onOpen: () => void;
  onAdd: () => void;
}) {
  return (
    <article className="part-card">
      <button
        className="part-image"
        aria-label={`View ${part.name}`}
        onClick={onOpen}
      >
        {part.photos[0] && (
          <img src={part.photos[0].path} alt={part.name} loading="lazy" />
        )}
        <span>{part.id}</span>
      </button>
      <div className="part-card-info">
        <span className="eyebrow">{part.category}</span>
        <button className="part-name" onClick={onOpen}>
          {part.name}
          <ArrowUpRight size={15} />
        </button>
        <div className="part-card-bottom">
          <span className={part.inventory.quantity ? "stock" : "stock empty"}>
            <i />
            {part.inventory.quantity
              ? `${part.inventory.quantity} in stock`
              : "Out of stock"}
          </span>
          <button
            className="icon-button"
            aria-label={`Add ${part.name} to request`}
            onClick={onAdd}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <Package size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export default function DemoApp() {
  const ws = useDemoWorkspace();
  const { data, queue, cart } = ws;
  const [tab, setTab] = useState<Tab>("identify"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All categories"),
    [stockOnly, setStockOnly] = useState(false),
    [selected, setSelected] = useState<CatalogPart | null>(null),
    [toast, setToast] = useState(""),
    [asset, setAsset] = useState<Asset | null>(null),
    [requestOpen, setRequestOpen] = useState(false),
    [noteOpen, setNoteOpen] = useState(false),
    [noteAsset, setNoteAsset] = useState(""),
    [aboutOpen, setAboutOpen] = useState(false),
    [noteFilter, setNoteFilter] = useState("All"),
    [noteQuery, setNoteQuery] = useState(""),
    [evaluation, setEvaluation] = useState<{
      heldOut: { total: number; top1: number; top3: number };
      reference: { total: number; top1: number };
      limitations: string[];
    } | null>(null),
    [offlineSaving, setOfflineSaving] = useState(false);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    void fetch("/evaluation-report.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setEvaluation)
      .catch(() => {});
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  const navigate = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const add = (p: CatalogPart) => {
    try {
      ws.addToCart(p.id, p.name);
      notify(`${p.name} added to your supply request`);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const confirm = (record: ScanRecord) => {
    try {
      ws.mutate({ kind: "scan", record });
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const activity = (
    target: "request" | "note",
    targetId: string,
    action: Activity["action"],
  ) => {
    try {
      ws.mutate({
        kind: "event",
        record: {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          target,
          targetId,
          action,
          author: target === "request" ? "Prod Shop" : "AGE Team",
        },
      });
      notify(`${action} · saved on this device, syncing to the workspace`);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const activeRequests = data.requests.filter(
    (r) => requestStatus(r, data.events) !== "Delivered",
  );
  const filtered = useMemo(
    () =>
      catalog.filter(
        (p) =>
          (category === "All categories" || p.category === category) &&
          (!stockOnly || p.inventory.quantity > 0) &&
          (
            p.name +
            " " +
            p.id +
            " " +
            p.category +
            " " +
            (p.partNumber || "") +
            " " +
            (p.nsn || "")
          )
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [category, stockOnly, query],
  );
  const visibleNotes = data.notes.filter(
    (n) =>
      (noteFilter === "All" ||
        (noteFilter === "Resolved"
          ? noteStatus(n, data.events).resolved
          : n.type === noteFilter && !noteStatus(n, data.events).resolved)) &&
      (n.title + " " + n.body + " " + n.assetId + " " + n.owner)
        .toLowerCase()
        .includes(noteQuery.toLowerCase()),
  );
  async function share() {
    try {
      await navigator.clipboard.writeText(ws.shareLink());
      notify(
        "Workspace link copied. Anyone with this link can view and edit this workspace.",
      );
    } catch {
      notify(
        "Clipboard unavailable. Copy the workspace URL from Sources & system.",
      );
    }
  }
  async function saveOffline() {
    if (!("caches" in window)) {
      notify("Offline storage is unavailable in this browser.");
      return;
    }
    setOfflineSaving(true);
    try {
      const cache = await caches.open("falconid-v6-catalog");
      const urls = [
        "/",
        "/catalog.json",
        "/photo-credits.json",
        "/evaluation-report.json",
        ...catalog.map((p) => p.photos[0]?.path).filter(Boolean),
      ];
      for (let i = 0; i < urls.length; i += 5)
        await Promise.all(
          urls.slice(i, i + 5).map(async (url) => {
            const response = await fetch(url);
            if (!response.ok)
              throw Error("A catalog file could not be cached. Please retry.");
            await cache.put(url, response);
          }),
        );
      notify(
        "Catalog and reference photos saved for offline browsing. AI image matching requires connectivity.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setOfflineSaving(false);
    }
  }
  function requestCard(r: SupplyRequest) {
    const status = requestStatus(r, data.events),
      next = REQUEST_STATUSES[REQUEST_STATUSES.indexOf(status) + 1];
    return (
      <article className="request-card" key={r.id}>
        <div className="request-card-head">
          <div>
            <span className="eyebrow">{r.number}</span>
            <h3>{r.items.map((i) => i.name).join(", ")}</h3>
          </div>
          <Pill
            tone={
              status === "Delivered"
                ? "green"
                : r.priority === "Urgent"
                  ? "orange"
                  : "neutral"
            }
          >
            {status}
          </Pill>
        </div>
        <div className="request-meta">
          <span>
            <MapPin size={14} />
            {r.location}
          </span>
          <span>
            <Wrench size={14} />
            {r.assetId || "Unassigned"}
          </span>
          <span>
            <Clock3 size={14} />
            {date(r.createdAt)}
          </span>
        </div>
        <div className="request-line-items">
          {r.items.map((i) => (
            <span key={i.partId}>
              {i.qty} × {i.name}
            </span>
          ))}
        </div>
        <div className="request-progress">
          {REQUEST_STATUSES.map((s, i) => (
            <div
              key={s}
              className={
                i <= REQUEST_STATUSES.indexOf(status) ? "complete" : ""
              }
            >
              <i>
                {i < REQUEST_STATUSES.indexOf(status) ? (
                  <Check size={11} />
                ) : (
                  i + 1
                )}
              </i>
              <span>{s}</span>
            </div>
          ))}
        </div>
        <div className="request-footer">
          <small>
            {r.requester} · {r.priority}
          </small>
          {next && (
            <button
              className="button secondary compact"
              disabled={queue.some(
                (q) =>
                  q.kind === "event" &&
                  "targetId" in q.record &&
                  q.record.targetId === r.id,
              )}
              onClick={() => activity("request", r.id, next)}
            >
              Mark {next.toLowerCase()} <ArrowRight size={14} />
            </button>
          )}
        </div>
        {data.events.filter(
          (e) => e.target === "request" && e.targetId === r.id,
        ).length > 0 && (
          <details className="request-history">
            <summary>View status history</summary>
            {data.events
              .filter((e) => e.target === "request" && e.targetId === r.id)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              .map((e) => (
                <p key={e.id}>
                  {e.action} · {e.author} · {date(e.createdAt)}
                </p>
              ))}
          </details>
        )}
      </article>
    );
  }
  function noteCard(n: Handover) {
    const state = noteStatus(n, data.events);
    return (
      <article
        className={`note-card ${state.resolved ? "resolved" : ""}`}
        key={n.id}
      >
        <div className="note-header">
          <Pill
            tone={
              state.resolved
                ? "green"
                : n.type === "Hazard"
                  ? "orange"
                  : "neutral"
            }
          >
            {state.resolved ? "Resolved" : n.type}
          </Pill>
          <span>{n.assetId || "Team-wide"}</span>
        </div>
        <h3>{n.title}</h3>
        <p>{n.body}</p>
        <div className="note-owner">
          <span className="avatar">{n.owner.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{n.owner}</strong>
            <small>
              Owner · {n.author} · {date(n.createdAt)}
            </small>
          </div>
        </div>
        {state.acknowledged.length > 0 && (
          <p className="acknowledged">
            <CheckCheck size={14} /> Acknowledged by{" "}
            {state.acknowledged.join(", ")}
          </p>
        )}
        <div className="note-actions">
          <button
            className="text-button"
            disabled={state.acknowledged.includes("AGE Team")}
            onClick={() => activity("note", n.id, "Acknowledged")}
          >
            <CheckCheck size={15} /> Acknowledge
          </button>
          <button
            className="text-button"
            onClick={() =>
              activity("note", n.id, state.resolved ? "Reopened" : "Resolved")
            }
          >
            {state.resolved ? <RefreshCw size={14} /> : <Check size={14} />}{" "}
            {state.resolved ? "Reopen" : "Resolve"}
          </button>
        </div>
      </article>
    );
  }
  return (
    <div className="app-shell">
      <header className="simple-header">
        <div className="header-inner">
          <a
            className="simple-brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("identify");
            }}
          >
            <img src="/falconid-mark.svg" width={30} height={30} alt="" />
            <span>{BRAND.name}</span>
          </a>
          <nav className="simple-nav" aria-label="Main navigation">
            {nav.map((n) => (
              <button
                key={n.id}
                aria-current={tab === n.id ? "page" : undefined}
                className={tab === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                {n.name}
                {n.id === "requests" && activeRequests.length > 0 && (
                  <span>{activeRequests.length}</span>
                )}
              </button>
            ))}
          </nav>
          <details className="workspace-menu">
            <summary aria-label="Workspace options">
              <SlidersHorizontal size={20} />
            </summary>
            <div className="workspace-menu-content">
              <button onClick={() => void ws.sync()}>
                {ws.syncing ? (
                  <RefreshCw size={16} className="spin" />
                ) : ws.online ? (
                  <Cloud size={16} />
                ) : (
                  <WifiOff size={16} />
                )}{" "}
                {ws.syncing
                  ? "Syncing…"
                  : queue.length
                    ? `${queue.length} changes pending`
                    : ws.error
                      ? "Retry sync"
                      : ws.online
                        ? "Workspace synced"
                        : "Offline"}
              </button>
              <button onClick={() => void share()} disabled={!ws.workspace}>
                <Link2 size={16} /> Share workspace
              </button>
              <button onClick={() => setAboutOpen(true)}>
                <CircleHelp size={16} /> About & sources
              </button>
            </div>
          </details>
        </div>
      </header>
      <div className="main-shell">
        {!ws.online && (
          <div className="offline-banner">
            <WifiOff size={16} /> You’re offline. Changes are saved on this
            device and will sync when connectivity returns.
          </div>
        )}
        {ws.error && ws.online && (
          <div className="offline-banner">
            <CloudOff size={16} />
            <span>{ws.error}</span>
            <button className="text-button" onClick={() => void ws.sync()}>
              Retry sync
            </button>
          </div>
        )}
        <main
          className={`content ${tab === "identify" ? "identify-content" : ""}`}
        >
          <div className="page-heading">
            <div>
              <h1>
                {
                  (
                    {
                      identify: BRAND.tagline,
                      catalog: "Parts",
                      fleet: "Equipment",
                      requests: "Requests",
                      handover: "Handover",
                    } as const
                  )[tab]
                }
              </h1>
              <p>
                {
                  (
                    {
                      identify: "Identify a component from a photo.",
                      catalog: "Search by name, part number or NSN.",
                      fleet: "Parts, requests and notes for each asset.",
                      requests: "Track your parts from request to delivery.",
                      handover: "What the next shift needs to know.",
                    } as const
                  )[tab]
                }
              </p>
            </div>
            {tab === "catalog" ? (
              <button
                className="button primary"
                onClick={() => {
                  navigate("identify");
                }}
              >
                <ScanLine size={18} /> Identify a part <ArrowRight size={17} />
              </button>
            ) : tab === "requests" ? (
              <button
                className="button primary"
                onClick={() => setRequestOpen(true)}
              >
                <Plus size={18} /> New request{" "}
                {cart.length > 0 && (
                  <span className="button-count">{cart.length}</span>
                )}
              </button>
            ) : tab === "handover" ? (
              <button
                className="button primary"
                onClick={() => {
                  setNoteAsset("");
                  setNoteOpen(true);
                }}
              >
                <Plus size={18} /> Add handover
              </button>
            ) : null}
          </div>
          {tab === "catalog" && (
            <>
              <div className="catalog-toolbar">
                <label className="search-field">
                  <Search size={19} />
                  <input
                    aria-label="Search catalog"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search parts"
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <label className="category-filter">
                  <Filter size={16} />
                  <select
                    aria-label="Filter by category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>All categories</option>
                    {[...new Set(catalog.map((p) => p.category))].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <button
                  className={`button secondary ${stockOnly ? "selected" : ""}`}
                  aria-pressed={stockOnly}
                  onClick={() => setStockOnly(!stockOnly)}
                >
                  <SlidersHorizontal size={16} /> In stock only
                </button>
              </div>
              <div className="catalog-meta">
                <span>
                  {filtered.length} {filtered.length === 1 ? "part" : "parts"}
                </span>
                <button
                  className="text-button"
                  disabled={offlineSaving}
                  onClick={() => void saveOffline()}
                >
                  {offlineSaving ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <ArrowDownToLine size={14} />
                  )}{" "}
                  {offlineSaving ? "Saving catalog…" : "Save catalog offline"}
                </button>
              </div>
              {filtered.length ? (
                <div className="part-grid">
                  {filtered.map((p) => (
                    <PartCard
                      key={p.id}
                      part={p}
                      onOpen={() => setSelected(p)}
                      onAdd={() => add(p)}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  title="No parts found"
                  text="Try another name or reset your category and stock filters."
                />
              )}
            </>
          )}
          {tab === "identify" && (
            <IdentifyPanel
              catalog={catalog}
              onInspect={setSelected}
              onConfirm={confirm}
              notify={notify}
            />
          )}
          {tab === "fleet" && (
            <>
              <div className="section-heading">
                <span className="muted">{assets.length} equipment records</span>
                <Pill>
                  <QrCode size={13} /> QR labels included
                </Pill>
              </div>
              <div className="asset-grid">
                {assets.map((a, i) => {
                  const notes = data.notes.filter(
                      (n) =>
                        n.assetId === a.id &&
                        !noteStatus(n, data.events).resolved,
                    ),
                    scans = data.scans.filter((s) => s.assetId === a.id);
                  return (
                    <button
                      className="asset-card"
                      key={a.id}
                      onClick={() => setAsset(a)}
                    >
                      <div className="asset-card-top">
                        <span className="asset-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Pill
                          tone={a.condition === "Ready" ? "green" : "orange"}
                        >
                          {a.condition}
                        </Pill>
                      </div>
                      <Wrench size={33} strokeWidth={1.5} />
                      <span className="eyebrow">{a.id}</span>
                      <h3>{a.name}</h3>
                      <p>
                        <MapPin size={14} />
                        {a.location}
                      </p>
                      <div className="asset-card-foot">
                        <span>
                          {notes.length} open notes · {scans.length} confirmed
                          categories
                        </span>
                        <ArrowUpRight size={17} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {tab === "requests" && (
            <>
              <div className="request-summary">
                <div>
                  <Package size={20} />
                  <span>
                    <strong>
                      {cart.reduce((s, i) => s + i.qty, 0)} items in your draft
                    </strong>
                    <small>
                      Draft items stay on this device until you submit.
                    </small>
                  </span>
                </div>
                <button
                  className="button secondary"
                  onClick={() => setRequestOpen(true)}
                >
                  Review draft <ArrowRight size={15} />
                </button>
              </div>
              <div className="section-heading">
                <h2>Request history</h2>
                <span className="muted">
                  {data.requests.length} requests · Prod Shop
                </span>
              </div>
              <div className="request-list">
                {data.requests.length ? (
                  data.requests.map(requestCard)
                ) : (
                  <Empty
                    title="No requests yet"
                    text="Add a catalog part and submit your first supply request."
                  />
                )}
              </div>
            </>
          )}
          {tab === "handover" && (
            <>
              <div className="handover-toolbar">
                <div className="filter-tabs">
                  {["All", "Hazard", "Pass-down", "General", "Resolved"].map(
                    (f) => (
                      <button
                        key={f}
                        className={noteFilter === f ? "selected" : ""}
                        onClick={() => setNoteFilter(f)}
                      >
                        {f === "All" ? "All notes" : f}
                      </button>
                    ),
                  )}
                </div>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search handover notes"
                    placeholder="Search notes, assets, owners…"
                    value={noteQuery}
                    onChange={(e) => setNoteQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="note-grid">
                {visibleNotes.length ? (
                  visibleNotes.map(noteCard)
                ) : (
                  <Empty
                    title="No matching notes"
                    text="Try another filter, or add a new handover note."
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>
      {cart.length > 0 && tab !== "requests" && (
        <button
          className="floating-cart"
          onClick={() => {
            navigate("requests");
            setRequestOpen(true);
          }}
        >
          <Package size={18} />
          <span>Request draft</span>
          <b>{cart.reduce((s, i) => s + i.qty, 0)}</b>
          <ArrowRight size={16} />
        </button>
      )}
      {selected && (
        <PartDetail
          key={selected.id}
          part={selected}
          onClose={() => setSelected(null)}
          onAdd={() => add(selected)}
        />
      )}
      {requestOpen && (
        <RequestForm
          cart={cart}
          onClose={() => setRequestOpen(false)}
          onChange={ws.updateCart}
          onCatalog={() => {
            setRequestOpen(false);
            navigate("catalog");
          }}
          onSubmit={(r) => {
            ws.mutate({ kind: "request", record: r });
            ws.updateCart([]);
            setRequestOpen(false);
            navigate("requests");
            notify(
              "Request saved with a request number. It will sync to the workspace.",
            );
          }}
        />
      )}
      {noteOpen && (
        <NoteForm
          assetId={noteAsset}
          onClose={() => setNoteOpen(false)}
          onSubmit={(n) => {
            ws.mutate({ kind: "note", record: n });
            setNoteOpen(false);
            notify("Handover saved. It will sync to the shared workspace.");
          }}
        />
      )}
      {asset && (
        <Modal
          title={`${asset.id} · Equipment record`}
          onClose={() => setAsset(null)}
          wide
        >
          <div className="asset-detail-header">
            <div>
              <span className="eyebrow">SIMULATED EQUIPMENT RECORD</span>
              <h2>{asset.name}</h2>
              <p>
                {asset.location} · {asset.serial}
              </p>
              <Pill tone={asset.condition === "Ready" ? "green" : "orange"}>
                {asset.condition}
              </Pill>
            </div>
            <div className="asset-qr">
              <img
                src={`/labels/${asset.id}.svg`}
                alt={`QR code for asset ${asset.id}`}
              />
              <a href={`/labels/${asset.id}.svg`} download>
                <Download size={12} /> Download label
              </a>
            </div>
          </div>
          <div className="section-heading">
            <h3>Related parts</h3>
            <span className="muted">Associated components</span>
          </div>
          <div className="asset-parts">
            {asset.partIds.map((id) => {
              const p = catalog.find((p) => p.id === id)!;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setSelected(p);
                    setAsset(null);
                  }}
                >
                  <img src={p.photos[0]?.path} alt={p.name} />
                  <strong>{p.name}</strong>
                  <small>{p.id}</small>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
          <div className="section-heading">
            <h3>Linked component history</h3>
            <Pill>
              {data.scans.filter((s) => s.assetId === asset.id).length} records
            </Pill>
          </div>
          {data.scans.filter((s) => s.assetId === asset.id).length ? (
            data.scans
              .filter((s) => s.assetId === asset.id)
              .map((s) => (
                <div className="timeline-row" key={s.id}>
                  <Check size={16} />
                  <div>
                    <strong>
                      {catalog.find((p) => p.id === s.partId)?.name}
                    </strong>
                    <small>
                      {s.method} · Linked part · {date(s.createdAt)}
                    </small>
                  </div>
                </div>
              ))
          ) : (
            <p className="muted">
              Identify and confirm a component to begin this asset’s history.
            </p>
          )}
          <div className="section-heading">
            <h3>Supply requests</h3>
          </div>
          {data.requests.filter((r) => r.assetId === asset.id).map(requestCard)}
          <div className="section-heading">
            <h3>Handover notes</h3>
            <button
              className="button secondary compact"
              onClick={() => {
                setNoteAsset(asset.id);
                setAsset(null);
                setNoteOpen(true);
              }}
            >
              <Plus size={14} /> Add note
            </button>
          </div>
          <div className="note-grid asset-notes">
            {data.notes.filter((n) => n.assetId === asset.id).map(noteCard)}
          </div>
        </Modal>
      )}
      {aboutOpen && (
        <Modal
          title={`About ${BRAND.name}`}
          onClose={() => setAboutOpen(false)}
        >
          <div className="simple-about">
            <p>
              <strong>{BRAND.tagline}</strong>
            </p>
            <p>AI-assisted part lookup for aerospace ground equipment.</p>
            <details>
              <summary>Data & sources</summary>
              <p>
                The three MEP-832A part records come from the 30 April 2010
                public manual, Air Force TO 35C2-3-386-51W/IPB. Check current
                authorized publications and the equipment configuration before
                maintenance.
              </p>
              <a href={catalog[0].sourceUrl} target="_blank" rel="noreferrer">
                Source manual <ExternalLink size={13} />
              </a>
              <p>
                The catalog combines real product photos and labeled AI
                illustrations. Inventory, prices, bins and initial activity are
                seeded scenario records.
              </p>
              <a href="/photo-credits.json" target="_blank" rel="noreferrer">
                Photo credits <ExternalLink size={13} />
              </a>
              <a href="/image-provenance.json" target="_blank" rel="noreferrer">
                Generated-image provenance <ExternalLink size={13} />
              </a>
            </details>
            <details>
              <summary>Matching & photo privacy</summary>
              <p>
                Image vectors find candidate parts. OpenRouter reviews the photo
                against their reference views. Part identifiers and documents
                come from the database.
              </p>
              <p>
                Photos are sent to OpenRouter for review. The matching endpoint
                does not save them; local drafts stay on your device. Matching
                requires an internet connection.
              </p>
              {evaluation && (
                <p>
                  The recorded test matched {evaluation.heldOut.top1} of{" "}
                  {evaluation.heldOut.total} separate generated captures in the
                  MEP-832A library. This small synthetic test is not operational
                  accuracy validation.
                </p>
              )}
              <a
                href="/evaluation-report.json"
                target="_blank"
                rel="noreferrer"
              >
                Matching evaluation <ExternalLink size={13} />
              </a>
            </details>
            <details>
              <summary>Workspace & offline access</summary>
              <p>
                Requests, notes and linked records sync to private cloud
                storage. Anyone with this workspace link can view and edit its
                records.
              </p>
              <input
                className="share-link"
                readOnly
                aria-label="Workspace sharing link"
                value={ws.workspace ? ws.shareLink() : ""}
              />
              <button className="text-button" onClick={() => void share()}>
                <Link2 size={14} /> Copy workspace link
              </button>
              <button
                className="button secondary"
                disabled={offlineSaving}
                onClick={() => void saveOffline()}
              >
                {offlineSaving
                  ? "Saving…"
                  : "Save catalog for offline browsing"}
              </button>
            </details>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function RequestForm({
  cart,
  onChange,
  onClose,
  onCatalog,
  onSubmit,
}: {
  cart: ReturnType<typeof useDemoWorkspace>["cart"];
  onChange: ReturnType<typeof useDemoWorkspace>["updateCart"];
  onClose: () => void;
  onCatalog: () => void;
  onSubmit: (r: SupplyRequest) => void;
}) {
  const [assetId, setAssetId] = useState("AGE-044"),
    [requester, setRequester] = useState("Day shift"),
    [location, setLocation] = useState(assets[0].location),
    [priority, setPriority] = useState<"Routine" | "Urgent">("Routine"),
    [error, setError] = useState("");
  return (
    <Modal title="Review supply request" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!cart.length) {
            setError("Add at least one catalog part.");
            return;
          }
          try {
            const id = crypto.randomUUID();
            onSubmit({
              id,
              number: `AGE-${id.slice(0, 8).toUpperCase()}`,
              createdAt: new Date().toISOString(),
              requester,
              assetId,
              location,
              priority,
              items: cart,
            });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="notice">
          <Truck size={19} />
          <span>
            Save this request to the shared workspace and track its supply
            status through delivery.
          </span>
        </div>
        <div className="cart-items">
          {cart.map((item) => (
            <div className="cart-item" key={item.partId}>
              <img
                src={catalog.find((p) => p.id === item.partId)?.photos[0]?.path}
                alt={item.name}
              />
              <div>
                <strong>{item.name}</strong>
                <small>{item.partId} · Component record</small>
              </div>
              <div className="quantity-control">
                <button
                  type="button"
                  aria-label={`Decrease ${item.name}`}
                  onClick={() =>
                    onChange(
                      cart.map((x) =>
                        x.partId === item.partId
                          ? { ...x, qty: Math.max(1, x.qty - 1) }
                          : x,
                      ),
                    )
                  }
                >
                  <Minus size={14} />
                </button>
                <span>{item.qty}</span>
                <button
                  type="button"
                  aria-label={`Increase ${item.name}`}
                  onClick={() =>
                    onChange(
                      cart.map((x) =>
                        x.partId === item.partId
                          ? { ...x, qty: Math.min(999, x.qty + 1) }
                          : x,
                      ),
                    )
                  }
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${item.name}`}
                onClick={() =>
                  onChange(cart.filter((x) => x.partId !== item.partId))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="text-button" onClick={onCatalog}>
          <Plus size={15} /> Add parts from catalog
        </button>
        <div className="form-grid">
          <label>
            Requester
            <input
              required
              maxLength={100}
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
            />
          </label>
          <label>
            Equipment
            <select
              value={assetId}
              onChange={(e) => {
                setAssetId(e.target.value);
                setLocation(
                  assets.find((a) => a.id === e.target.value)!.location,
                );
              }}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination
            <input
              required
              maxLength={150}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as "Routine" | "Urgent")
              }
            >
              <option>Routine</option>
              <option>Urgent</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <span>
            {cart.reduce((s, i) => s + i.qty, 0)} items · inventory snapshot
          </span>
          <button className="button primary" disabled={!cart.length}>
            <Check size={17} /> Submit request
          </button>
        </div>
      </form>
    </Modal>
  );
}
function NoteForm({
  assetId: initialAsset,
  onClose,
  onSubmit,
}: {
  assetId: string;
  onClose: () => void;
  onSubmit: (n: Handover) => void;
}) {
  const [assetId, setAssetId] = useState(initialAsset),
    [type, setType] = useState<Handover["type"]>("Pass-down"),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [owner, setOwner] = useState("Day shift"),
    [author, setAuthor] = useState("AGE Team"),
    [error, setError] = useState("");
  return (
    <Modal title="Add a shift handover" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSubmit({
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              assetId,
              type,
              title,
              body,
              owner,
              author,
            });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Handover["type"])}
            >
              <option>Pass-down</option>
              <option>Hazard</option>
              <option>General</option>
            </select>
          </label>
          <label>
            Equipment
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            >
              <option value="">Team-wide</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Title
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What should the next shift know?"
            />
          </label>
          <label className="full">
            Details
            <textarea
              required
              maxLength={3000}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the issue, current status, and next action."
            />
          </label>
          <label>
            Owner / next shift
            <input
              required
              maxLength={100}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </label>
          <label>
            Author
            <input
              required
              maxLength={100}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <span>Shared with this workspace</span>
          <button className="button primary">
            <Check size={17} /> Save handover
          </button>
        </div>
      </form>
    </Modal>
  );
}
