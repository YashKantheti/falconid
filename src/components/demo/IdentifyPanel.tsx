/* eslint-disable @next/next/no-img-element -- Curated local photographs are already resized; preserve source aspect ratios and attribution. */
/* eslint-disable react-hooks/set-state-in-effect -- Restore browser photo drafts after hydration. */
"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  CircleHelp,
  ImagePlus,
  LoaderCircle,
  ScanText,
  Search,
  Sparkles,
  X,
  RotateCcw,
  AlertTriangle,
  QrCode,
} from "lucide-react";
import type { CatalogPart, MatchResult, ScanRecord } from "@/lib/demo-types";
import { assets } from "@/lib/demo-seed";
import { cancelRecognition, identifyPhotos } from "@/lib/recognition";
import {
  clearPhotoDraft,
  loadPhotoDraft,
  savePhotoDraft,
} from "@/lib/photo-drafts";
type BarcodeDetectorType = {
  detect: (source: ImageBitmap) => Promise<{ rawValue: string }[]>;
};
declare global {
  interface Window {
    BarcodeDetector?: new (options: {
      formats: string[];
    }) => BarcodeDetectorType;
  }
}
async function prepareImage(blob: Blob): Promise<Blob> {
  if (blob.size > 20 * 1024 * 1024)
    throw Error("Choose an image smaller than 20 MB.");
  // Ordinary uploads can be decoded and normalized by the server's image library.
  // Avoid making browser ImageBitmap support a prerequisite for submitting a JPEG.
  if (blob.size <= 1_800_000) return blob;
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      1200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw Error("Unable to prepare photo");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Unable to prepare photo"))),
        "image/jpeg",
        0.9,
      ),
    );
  } catch {
    throw Error(
      "This browser could not read the image. Try a JPEG or PNG export.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export default function IdentifyPanel({
  catalog,
  onInspect,
  onConfirm,
  notify,
}: {
  catalog: CatalogPart[];
  onInspect: (part: CatalogPart) => void;
  onConfirm: (record: ScanRecord) => void;
  notify: (s: string) => void;
}) {
  const [visionReady, setVisionReady] = useState<boolean | null>(null);
  const [images, setImages] = useState<Blob[]>([]),
    [previews, setPreviews] = useState<string[]>([]),
    [result, setResult] = useState<MatchResult | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [camera, setCamera] = useState(false),
    [assetId, setAssetId] = useState("AGE-044"),
    [query, setQuery] = useState(""),
    [ocrText, setOcrText] = useState(""),
    [scope, setScope] = useState("MEP-832A"),
    [mode, setMode] = useState<"photo" | "lookup">("photo"),
    [method, setMethod] = useState<ScanRecord["method"]>("Manual lookup");
  const input = useRef<HTMLInputElement>(null),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    mounted = useRef(true),
    operation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    void fetch("/api/identify")
      .then((r) => (r.ok ? r.json() : null))
      .then((config) => {
        if (mounted.current) setVisionReady(Boolean(config?.configured));
      })
      .catch(() => {
        if (mounted.current) setVisionReady(false);
      });
    void loadPhotoDraft()
      .then((files) => {
        if (mounted.current && files.length) setImages(files);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      cancelRecognition();
    };
  }, []);
  useEffect(() => {
    const urls = images.map((x) => URL.createObjectURL(x));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [images]);
  async function addImages(files: FileList | null) {
    if (!files) return;
    setError("");
    try {
      const prepared = await Promise.all(
        Array.from(files)
          .slice(0, 2)
          .map((file) => {
            if (!file.type.startsWith("image/"))
              throw Error("Choose a JPEG, PNG, WebP or other supported image.");
            return prepareImage(file);
          }),
      );
      const next = [...images, ...prepared].slice(-2);
      await savePhotoDraft(next);
      setImages(next);
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image preparation failed");
    }
  }
  async function startCamera() {
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 } },
        audio: false,
      });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setCamera(true);
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play();
        }
      });
    } catch {
      setError(
        "Camera access is unavailable. Allow camera access in your browser settings or upload a photo.",
      );
    }
  }
  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  }
  async function capture() {
    const v = video.current;
    if (!v?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.9),
    );
    stopCamera();
    if (blob) {
      const next = [...images, blob].slice(-2);
      await savePhotoDraft(next);
      setImages(next);
      setResult(null);
    }
  }
  async function analyze() {
    if (!images.length) return;
    const token = ++operation.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const match = await identifyPhotos(images, setProgress, scope);
      if (mounted.current && token === operation.current) setResult(match);
    } catch (e) {
      if (mounted.current && token === operation.current)
        setError(e instanceof Error ? e.message : "Photo analysis failed");
    } finally {
      if (mounted.current && token === operation.current) setBusy(false);
    }
  }
  async function readLabel() {
    if (!images.length) return;
    setBusy(true);
    setError("");
    setProgress("Loading nameplate reader…");
    let worker: Awaited<
      ReturnType<(typeof import("tesseract.js"))["createWorker"]>
    > | null = null;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (p) => {
          if (mounted.current)
            setProgress(`${p.status} · ${Math.round(p.progress * 100)}%`);
        },
      });
      const { data } = await worker.recognize(images[images.length - 1]);
      if (mounted.current) {
        setOcrText(data.text.trim());
        setMode("lookup");
        setMethod("Manual lookup");
        const code = data.text.match(/DEMO[-\s]?\d{3}/i)?.[0];
        setQuery(code?.replace(/\s/, "-") || "");
        if (!data.text.trim())
          setError(
            "No readable text found. Try a closer, well-lit label photo.",
          );
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "Nameplate reader unavailable. Type the visible text into search.",
        );
    } finally {
      await worker?.terminate();
      if (mounted.current) setBusy(false);
    }
  }
  async function readBarcode() {
    if (!images.length) return;
    if (!window.BarcodeDetector) {
      setMode("lookup");
      setError(
        "Barcode detection is unavailable in this browser. Enter the printed DEMO ID or part name below.",
      );
      return;
    }
    setError("");
    try {
      const bitmap = await createImageBitmap(images[images.length - 1]);
      const detector = new window.BarcodeDetector({
        formats: ["qr_code", "code_128", "data_matrix"],
      });
      const found = await detector.detect(bitmap);
      bitmap.close();
      if (!found.length)
        throw Error(
          "No readable barcode found. Try a closer photo or enter the printed ID.",
        );
      const code = found[0].rawValue.match(/DEMO-\d{3}|AGE-\d{3}/i)?.[0];
      setQuery(code || found[0].rawValue);
      setMethod("Barcode");
      setMode("lookup");
      if (code?.startsWith("AGE-")) {
        setAssetId(code);
        setQuery("");
        notify(`Asset ${code} selected. Identify a part to attach it.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Barcode could not be read");
    }
  }
  function confirm(part: CatalogPart, source: ScanRecord["method"]) {
    onConfirm({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      assetId,
      partId: part.id,
      method: source,
      confirmed: true,
    });
    notify(`Part record linked to ${assetId}.`);
  }
  function renderMatch(
    candidate: MatchResult["candidates"][number],
    primary: boolean,
  ) {
    const part = catalog.find((p) => p.id === candidate.partId);
    if (!part) return null;
    const photo =
      part.photos.find((p) => p.path === candidate.reference) || part.photos[0];
    return (
      <article
        className={primary ? "primary-match" : "alternate-match"}
        key={part.id}
      >
        <div className="match-photo">
          <img src={photo?.path} alt={part.name} />
        </div>
        <div className="match-info">
          <span className="match-platform">
            {part.platform || part.category}
          </span>
          <h2>{part.name}</h2>
          <p className="match-number">
            {part.partNumber ? `P/N ${part.partNumber}` : "Component category"}
          </p>
          {primary && part.nsn && <p className="match-nsn">NSN {part.nsn}</p>}
          <div className="match-actions">
            <button
              className={primary ? "button primary" : "text-button"}
              onClick={() => onInspect(part)}
            >
              {primary ? "Part details & documents" : "View part"}
              <ArrowRight size={16} />
            </button>
            <button
              className="text-button"
              onClick={() => confirm(part, result!.method)}
            >
              {primary ? "Link to equipment" : "Use this match"}
            </button>
          </div>
        </div>
      </article>
    );
  }
  const matches = query.trim()
    ? catalog
        .filter((p) =>
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
            .includes(query.toLowerCase().trim()),
        )
        .slice(0, 12)
    : [];
  return (
    <div className={`identify-layout ${result ? "has-result" : "is-empty"}`}>
      <section className="panel scan-panel">
        <div className="capture-header">
          <span>
            <Camera size={18} /> Photo
          </span>
          <small>
            {visionReady
              ? "AI enabled"
              : visionReady === false
                ? "Image search"
                : "Connecting…"}
          </small>
        </div>
        <details className="equipment-context">
          <summary>
            <span>Equipment</span>
            <strong>
              {assets.find((a) => a.id === assetId)?.name || "Choose equipment"}
            </strong>
          </summary>
          <div>
            <label>
              Attach to
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search in
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setResult(null);
                }}
              >
                <option value="MEP-832A">MEP-832A components</option>
                <option value="all">All parts (103)</option>
              </select>
            </label>
          </div>
        </details>
        {mode === "lookup" && (
          <button
            className="text-button back-to-photo"
            onClick={() => setMode("photo")}
          >
            <Camera size={16} /> Back to photo
          </button>
        )}
        {mode === "photo" ? (
          <>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addImages(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            {camera ? (
              <div className="camera-view">
                <video ref={video} autoPlay playsInline muted />
                <div className="camera-target" />
                <button
                  className="camera-close icon-button"
                  aria-label="Close camera"
                  onClick={stopCamera}
                >
                  <X />
                </button>
                <button
                  className="button primary capture-button"
                  onClick={() => void capture()}
                >
                  <Camera size={18} /> Capture photo
                </button>
              </div>
            ) : images.length ? (
              <div
                className={`scan-previews ${images.length === 2 ? "two" : ""}`}
              >
                {previews.map((url, i) => (
                  <div key={url}>
                    <img src={url} alt={`Part photo ${i + 1}`} />
                    <button
                      className="icon-button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => {
                        const next = images.filter((_, n) => n !== i);
                        setImages(next);
                        setResult(null);
                        void savePhotoDraft(next);
                      }}
                      disabled={busy}
                    >
                      <X size={16} />
                    </button>
                    <span>ANGLE {i + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="upload-zone">
                <div className="upload-icon">
                  <Camera size={34} strokeWidth={1.4} />
                </div>
                <h2>Add a photo</h2>
                <p>Keep one component in the frame.</p>
                <div className="upload-actions">
                  <button
                    className="button primary"
                    onClick={() => input.current?.click()}
                  >
                    <ImagePlus size={17} /> Choose photo
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => void startCamera()}
                  >
                    <Camera size={17} /> Use camera
                  </button>
                </div>
                <small>JPEG, PNG or WebP · up to 20 MB</small>
              </div>
            )}
            {!camera && images.length > 0 && (
              <div className="capture-tools">
                <button
                  className="button secondary"
                  onClick={() => input.current?.click()}
                  disabled={busy}
                >
                  <ImagePlus size={17} />
                  {images.length ? "Add angle" : "Choose photo"}
                </button>
                <button
                  className="button secondary"
                  onClick={() => void startCamera()}
                  disabled={busy}
                >
                  <Camera size={17} /> Use camera
                </button>
                {images.length > 0 && (
                  <button
                    className="icon-button"
                    aria-label="Clear photos"
                    disabled={busy}
                    onClick={() => {
                      setImages([]);
                      setResult(null);
                      void clearPhotoDraft();
                    }}
                  >
                    <RotateCcw size={17} />
                  </button>
                )}
              </div>
            )}
            {images.length > 0 && (
              <>
                <button
                  className="button primary match-button"
                  disabled={busy}
                  aria-label={busy ? progress : "Find match"}
                  aria-busy={busy}
                  onClick={() => void analyze()}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Sparkles size={18} />
                  )}{" "}
                  {busy ? "Finding a match…" : "Find match"}
                  {!busy && <ArrowRight size={18} />}
                </button>
                {busy ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      operation.current++;
                      cancelRecognition();
                      setBusy(false);
                      setProgress("");
                    }}
                  >
                    Cancel photo matching
                  </button>
                ) : (
                  <details className="secondary-tools">
                    <summary>More options</summary>
                    <div>
                      <button onClick={() => void readLabel()}>
                        <ScanText size={16} /> Read nameplate
                      </button>
                      <button onClick={() => void readBarcode()}>
                        <QrCode size={16} /> Read barcode / QR
                      </button>
                    </div>
                  </details>
                )}
              </>
            )}
            <div className="scan-footer">
              <button className="text-button" onClick={() => setMode("lookup")}>
                Search by name or number
              </button>
              <details className="photo-privacy">
                <summary>Photo privacy</summary>
                <p>
                  Photos and candidate references are sent to OpenRouter for AI
                  review. Drafts stay on this device.
                </p>
              </details>
            </div>
          </>
        ) : (
          <div className="lookup">
            <label className="search-field">
              <Search size={18} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setMethod("Manual lookup");
                }}
                placeholder="Part name, part number or NSN"
                aria-label="Search by part name, part number or NSN"
              />
            </label>
            {ocrText && (
              <div className="ocr-result">
                <span className="eyebrow">Text read from your image</span>
                <p>{ocrText}</p>
                <small>
                  Search the printed part number or NSN in the linked component
                  catalog.
                </small>
              </div>
            )}
            {matches.map((p) => (
              <div className="lookup-result" key={p.id}>
                <img src={p.photos[0]?.path} alt={p.name} />
                <button onClick={() => onInspect(p)}>
                  <strong>{p.name}</strong>
                  <small>
                    {p.id} · {p.category}
                  </small>
                </button>
                <button
                  className="button secondary compact"
                  onClick={() => confirm(p, method)}
                >
                  <Check size={15} /> Confirm
                </button>
              </div>
            ))}
            {query && !matches.length && (
              <div className="empty-state">
                <Search />
                <h3>No catalog match</h3>
                <p>Try the component name, part number or full NSN.</p>
              </div>
            )}
            {!query && (
              <div className="lookup-hint">
                <QrCode size={36} />
                <h3>Search parts</h3>
                <p>Enter a name, part number or NSN.</p>
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}
      </section>
      {result && (
        <aside className="identify-side">
          <section className="panel candidates">
            <div
              className={`match-status ${result.reliable ? "matched" : "review"}`}
            >
              {result.reliable ? <Check size={15} /> : <CircleHelp size={15} />}
              <span>
                {result.vision?.selectedPartId === "none"
                  ? "No clear match"
                  : result.reliable
                    ? "Suggested match"
                    : "Review this match"}
              </span>
            </div>
            {!result.reliable && (
              <p className="match-guidance">
                {result.vision?.selectedPartId === "none"
                  ? "Try a clearer photo or another angle."
                  : "Check the part’s markings before using this match."}
              </p>
            )}
            {result.candidates.slice(0, 1).map((c) => renderMatch(c, true))}
            {result.vision && result.vision.status !== "applied" && (
              <div className="notice">
                <AlertTriangle size={16} />
                <span>
                  AI review is unavailable. Showing image-search results.
                </span>
              </div>
            )}
            {result.candidates.length > 1 && (
              <details className="other-matches">
                <summary>
                  Other matches{" "}
                  <span>{Math.min(result.candidates.length - 1, 2)}</span>
                </summary>
                {result.candidates
                  .slice(1, 3)
                  .map((c) => renderMatch(c, false))}
              </details>
            )}
            <details className="matching-details">
              <summary>How this was matched</summary>
              {result.vision?.reason && <p>{result.vision.reason}</p>}
              {result.vision?.observedFeatures?.length ? (
                <ul>
                  {result.vision.observedFeatures.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
              {result.vision?.visibleMarkings && (
                <p>Markings: {result.vision.visibleMarkings}</p>
              )}
              <dl>
                <div>
                  <dt>Visual review</dt>
                  <dd>
                    {result.vision?.status === "applied"
                      ? result.vision.model
                      : "Not applied"}
                  </dd>
                </div>
                <div>
                  <dt>Image search</dt>
                  <dd>
                    {result.model} · {result.dimensions} dimensions
                  </dd>
                </div>
                <div>
                  <dt>Similarity</dt>
                  <dd>
                    {result.candidates[0]?.similarity.toFixed(3)} ·{" "}
                    {result.searched} records
                  </dd>
                </div>
              </dl>
              <p className="helper">
                Identifiers and documents come from the database. Similarity is
                a ranking score, not a probability.
              </p>
            </details>
          </section>
        </aside>
      )}
    </div>
  );
}
