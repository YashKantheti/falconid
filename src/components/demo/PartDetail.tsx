/* eslint-disable @next/next/no-img-element -- Catalog imagery is pre-sized and includes provenance. */
"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Camera,
  PackagePlus,
  ShieldCheck,
} from "lucide-react";
import type { CatalogPart } from "@/lib/demo-types";
import { Modal } from "./Modal";
export default function PartDetail({
  part,
  onClose,
  onAdd,
}: {
  part: CatalogPart;
  onClose: () => void;
  onAdd: () => void;
}) {
  const [photo, setPhoto] = useState(0),
    [added, setAdded] = useState(false),
    [diagram, setDiagram] = useState(false);
  const current = part.photos[photo] || part.photos[0];
  return (
    <Modal title="Part details" onClose={onClose} wide>
      <div className="detail-grid">
        <div>
          <div className="detail-photo">
            <img
              src={diagram && part.diagram ? part.diagram : current?.path}
              alt={
                diagram
                  ? "Public manual illustrated parts breakdown"
                  : part.name
              }
            />
            <span className="photo-tag">
              <Camera size={13} />
              {diagram ? "Manual illustration" : "Database reference"}
            </span>
          </div>
          <div className="photo-thumbs">
            {part.photos.map((p, i) => (
              <button
                key={p.path}
                aria-label={`View photo ${i + 1}`}
                aria-pressed={!diagram && photo === i}
                onClick={() => {
                  setPhoto(i);
                  setDiagram(false);
                }}
              >
                <img src={p.path} alt={`${part.name} view ${i + 1}`} />
              </button>
            ))}
            {part.diagram && (
              <button
                aria-label="View illustrated parts breakdown"
                aria-pressed={diagram}
                onClick={() => setDiagram(true)}
              >
                <img src={part.diagram} alt="Illustrated parts breakdown" />
              </button>
            )}
          </div>
          <details className="provenance">
            <summary>Sources & photo credits</summary>
            <p>
              {current?.author} · {current?.license}
            </p>
            <p>
              {part.imageProvenance ||
                `${current?.author} · ${current?.license}. ${current?.modified}`}
            </p>
            <a href={current?.sourceUrl} target="_blank" rel="noreferrer">
              View source <ArrowUpRight size={12} />
            </a>
            {part.platform && (
              <p>
                Part identifiers transcribed from the 30 April 2010 public
                joint-service manual. Inventory quantities, prices, bins and
                equipment instances are seeded scenario data. Check current
                authorized records for maintenance use.
              </p>
            )}
          </details>
        </div>
        <div className="detail-info">
          <span className="eyebrow">
            {part.platform || part.category} / {part.id}
          </span>
          <h2>{part.name}</h2>
          <div className="badge-row">
            <span className="badge green">
              <ShieldCheck size={13} />
              {part.partNumber
                ? "Source-linked part record"
                : "Component category"}
            </span>
            {part.platform && <span className="badge">400 Hz · 3 kW TQG</span>}
          </div>
          <p>{part.description}</p>
          <div className="spec-grid">
            <div>
              <span>Part number</span>
              <strong>{part.partNumber || "Not cataloged"}</strong>
            </div>
            <div>
              <span>National Stock Number</span>
              <strong>{part.nsn || "Not cataloged"}</strong>
            </div>
            <div>
              <span>CAGE code</span>
              <strong>{part.cage || "Not cataloged"}</strong>
            </div>
            <div>
              <span>Equipment</span>
              <strong>{part.platform || "General component"}</strong>
            </div>
            <div>
              <span>Available stock</span>
              <strong>{part.inventory.quantity} units</strong>
            </div>
            <div>
              <span>Supply bin</span>
              <strong>{part.inventory.bin}</strong>
            </div>
          </div>
          {part.documents?.length ? (
            <section className="document-section">
              <div className="section-title">
                <h3>
                  <BookOpen size={18} /> Documents
                </h3>
                <span className="badge">{part.documents.length} linked</span>
              </div>
              {part.documents.map((d) => (
                <a
                  className="document-link"
                  key={d.url}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpen size={19} />
                  <div>
                    <small>{d.kind}</small>
                    <strong>{d.title}</strong>
                    <span>{d.code}</span>
                    <p>{d.detail}</p>
                  </div>
                  <ArrowUpRight size={16} />
                </a>
              ))}
            </section>
          ) : (
            <p className="helper">
              Add an equipment-specific part number and source publication to
              enable exact record retrieval for this category.
            </p>
          )}
          <details className="verification-note">
            <summary>Before installation</summary>
            <p>{part.inspection}</p>
            <p>{part.compatibility}</p>
          </details>
          <div className="detail-actions">
            <button
              className="button primary"
              onClick={() => {
                onAdd();
                setAdded(true);
              }}
            >
              {added ? <Check size={17} /> : <PackagePlus size={17} />}{" "}
              {added ? "Added to request" : "Request part"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
