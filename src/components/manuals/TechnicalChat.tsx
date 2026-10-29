/* eslint-disable @next/next/no-img-element -- Local FalconID wordmark. */
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  LoaderCircle,
  Plus,
  Square,
  X,
} from "lucide-react";
import { BRAND } from "@/lib/branding";
import type {
  ManualAnswer,
  ManualCitation,
  ManualDocument,
  ManualMessage,
} from "@/lib/manual-types";
import { Modal } from "@/components/demo/Modal";

type Library = {
  configured: boolean;
  pages: number;
  excerpts: number;
  indexing: string;
  documents: Pick<
    ManualDocument,
    "id" | "code" | "title" | "edition" | "pages" | "url"
  >[];
  context: { id: string; name: string; partNumber: string | null } | null;
};
type Turn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: ManualAnswer };

export default function TechnicalChat() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [context, setContext] = useState<Library["context"]>(null);
  const [scope, setScope] = useState("all");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<ManualCitation | null>(null);
  const controller = useRef<AbortController | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const part = new URL(window.location.href).searchParams.get("part");
    void fetch(
      "/api/manuals" + (part ? "?part=" + encodeURIComponent(part) : ""),
    )
      .then(async (response) => {
        if (!response.ok)
          throw Error("The manual library could not load. Refresh to retry.");
        return response.json() as Promise<Library>;
      })
      .then((result) => {
        if (active) {
          setLibrary(result);
          setContext(result.context);
        }
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Manual library unavailable.",
          );
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!turns.length) return;
    bottom.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "end",
    });
  }, [turns, busy]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || busy || !library?.configured) return;
    const request = new AbortController();
    controller.current = request;
    const id = crypto.randomUUID();
    const history: ManualMessage[] = turns.slice(-8).map((turn) => ({
      role: turn.role,
      content:
        turn.role === "user"
          ? turn.text
          : turn.answer.paragraphs
              .map((paragraph) => paragraph.text)
              .join("\n")
              .slice(0, 4500),
    }));
    setTurns((previous) => [...previous, { id, role: "user", text: trimmed }]);
    setQuestion("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/manuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history,
          documentId: scope,
          partId: context?.id,
        }),
        signal: request.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.error || "The answer could not complete. Try again.",
        );
      setTurns((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          answer: result as ManualAnswer,
        },
      ]);
    } catch (error) {
      setTurns((previous) => previous.filter((turn) => turn.id !== id));
      setQuestion(trimmed);
      if (!request.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "The answer could not complete.",
        );
    } finally {
      controller.current = null;
      setBusy(false);
      composer.current?.focus();
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }
  const suggestions = context
    ? [
        `What do the manuals say about the ${context.name.toLowerCase()}?`,
        `How should the ${context.name.toLowerCase()} be inspected?`,
        `Which identifiers are listed for part ${context.partNumber || context.name}?`,
      ]
    : [
        "How do I inspect the oil strainer?",
        "What is the NSN of fuel filter 33583?",
        "What does the low oil pressure indicator mean?",
      ];

  return (
    <div className="manual-chat-page">
      <header className="manual-chat-header">
        <Link href="/" className="simple-brand">
          <img src="/falconid-mark.svg" width={29} height={29} alt="" />
          {BRAND.name}
        </Link>
        <span className="manual-header-label">Technical chat</span>
        <Link href="/identify" className="manual-back">
          <ArrowLeft size={14} /> Identify a part
        </Link>
      </header>
      <main
        className={`manual-chat-main ${turns.length ? "has-conversation" : ""}`}
      >
        <div className="manual-chat-toolbar">
          <label>
            <BookOpen size={15} />
            <span className="sr-only">Search in manual</span>
            <select
              aria-label="Search in manual"
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              disabled={busy}
            >
              <option value="all">All indexed manuals</option>
              {library?.documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.code}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setTurns([]);
              setQuestion("");
              setError("");
              composer.current?.focus();
            }}
            disabled={busy || !turns.length}
          >
            <Plus size={15} /> New chat
          </button>
        </div>
        {context && (
          <div className="manual-context">
            <span>
              About <strong>{context.name}</strong>
              {context.partNumber && ` · P/N ${context.partNumber}`}
            </span>
            <button
              aria-label="Clear part context"
              onClick={() => setContext(null)}
              disabled={busy}
            >
              <X size={13} />
            </button>
          </div>
        )}
        {!turns.length ? (
          <div className="manual-welcome">
            <div className="manual-welcome-icon">
              <BookOpen size={27} strokeWidth={1.3} />
            </div>
            <h1>Ask the manuals.</h1>
            <p>Find an answer. See the evidence.</p>
            <div className="manual-suggestions">
              {suggestions.map((text) => (
                <button
                  key={text}
                  onClick={() => void ask(text)}
                  disabled={!library?.configured || busy}
                >
                  {text}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="manual-conversation"
            role="log"
            aria-label="Technical manual conversation"
            aria-live="polite"
            aria-relevant="additions"
          >
            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.id} className="manual-user-turn">
                  <span className="sr-only">Your question: </span>
                  {turn.text}
                </div>
              ) : (
                <article key={turn.id} className="manual-answer-turn">
                  <div className="manual-answer-label">
                    <img
                      src="/falconid-mark.svg"
                      width={20}
                      height={20}
                      alt=""
                    />{" "}
                    FalconID{" "}
                    <span>
                      {turn.answer.status === "answered" ? (
                        <>
                          <Check size={11} /> Cited answer
                        </>
                      ) : (
                        "Evidence not established"
                      )}
                    </span>
                  </div>
                  {turn.answer.paragraphs.map((paragraph, index) => (
                    <p key={index}>
                      {paragraph.text}
                      {paragraph.citations.map((id) => (
                        <button
                          className="manual-inline-cite"
                          key={id}
                          aria-label={`Read evidence ${id}`}
                          onClick={() =>
                            setSource(
                              turn.answer.sources.find(
                                (source) => source.id === id,
                              ) || null,
                            )
                          }
                        >
                          {id}
                        </button>
                      ))}
                    </p>
                  ))}
                  {turn.answer.sources.length > 0 && (
                    <div
                      className="manual-source-list"
                      aria-label="Answer sources"
                    >
                      {turn.answer.sources.map((source) => (
                        <button
                          key={source.id}
                          onClick={() => setSource(source)}
                          aria-label={`Evidence ${source.id}: ${source.code}, PDF page ${source.page}`}
                        >
                          <span>{source.id}</span>
                          <div>
                            <strong>{source.code}</strong>
                            <small>
                              PDF p. {source.page}
                              {source.printedPage
                                ? ` · ${source.printedPage}`
                                : ""}
                            </small>
                          </div>
                          <FileText size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ),
            )}
          </div>
        )}
        {busy && (
          <div className="manual-working" role="status">
            <LoaderCircle size={15} className="spin" /> Searching the manuals
            and checking cited evidence…
          </div>
        )}
        <div ref={bottom} />
        <div className="manual-composer-wrap">
          {error && (
            <div className="manual-chat-error" role="alert">
              {error}
            </div>
          )}
          {library && !library.configured && (
            <div className="manual-chat-error" role="status">
              Technical chat needs a server-side OpenRouter connection.
            </div>
          )}
          <form className="manual-composer" onSubmit={submit}>
            <textarea
              ref={composer}
              aria-label="Ask a question about the technical manuals"
              placeholder={
                context
                  ? `Ask about the ${context.name.toLowerCase()}…`
                  : "Ask about a part, procedure, or specification…"
              }
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void ask(question);
                }
              }}
              rows={2}
              maxLength={1600}
              disabled={busy}
            />
            <div className="manual-composer-bottom">
              <span>
                <FileText size={12} />
                {library
                  ? `${library.documents.length} manuals · ${library.pages} PDF pages`
                  : "Connecting to manual library…"}
              </span>
              {busy ? (
                <button
                  type="button"
                  className="manual-send"
                  aria-label="Stop answering"
                  onClick={() => controller.current?.abort()}
                >
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="manual-send"
                  aria-label="Send question"
                  disabled={!library?.configured || question.trim().length < 3}
                >
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </form>
          <p className="manual-privacy">
            Questions and excerpts are sent to OpenRouter. Chat stays in this
            tab.
          </p>
          <details className="manual-library-details">
            <summary>Indexed publications & coverage</summary>
            <p>
              {library?.indexing ||
                "Searchable text from public technical publications."}{" "}
              Check the current authorized edition before maintenance.
            </p>
            {library?.documents.map((doc) => (
              <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer">
                <strong>{doc.code}</strong>
                <span>
                  {doc.title} · {doc.edition} · {doc.pages} PDF pages
                </span>
                <ArrowUpRight size={13} />
              </a>
            ))}
          </details>
        </div>
      </main>
      {source && (
        <Modal title="Source evidence" onClose={() => setSource(null)} wide>
          <div className="manual-evidence">
            <div className="manual-evidence-heading">
              <BookOpen size={18} />
              <div>
                <h3>{source.code}</h3>
                <p>{source.title}</p>
              </div>
            </div>
            <div className="manual-evidence-location">
              <span>
                PDF page <strong>{source.page}</strong>
              </span>
              {source.printedPage && (
                <span>
                  Printed page <strong>{source.printedPage}</strong>
                </span>
              )}
              <span>{source.edition}</span>
            </div>
            <blockquote>{source.quote}</blockquote>
            <a
              className="button primary"
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              Open original PDF at page {source.page} <ArrowUpRight size={15} />
            </a>
            <details>
              <summary>Read the retrieved passage</summary>
              <p className="manual-excerpt">{source.excerpt}</p>
            </details>
            <p className="manual-evidence-note">
              The quoted text was checked against the indexed PDF text. PDF page
              numbers count from the cover; printed page labels may differ.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
