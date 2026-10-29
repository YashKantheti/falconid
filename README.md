# FalconID

*From photo to part.*

Live app: [falconid.vercel.app](https://falconid.vercel.app).

Source: [YashKantheti/falconid](https://github.com/YashKantheti/falconid).

## Branding

The product name, tagline and public URL are defined in `src/lib/branding.ts`. Run `node scripts/build-brand-assets.mjs` to rebuild the FalconID icon set and social share image. Existing browser and cloud storage identifiers remain compatible with earlier versions so the rebrand does not reset saved workspaces or photo drafts.

AI visual component matching for aerospace ground equipment. The focused workflow uses the MEP-832A 3 kW / 400 Hz tactical quiet generator and three source-linked component records, alongside 100 general component categories.

## Run

The public home page is a scroll-controlled 3D generator assembly built with Three.js. The gear rotates, aligns and seats as the visitor scrolls; rendering pauses when the scene is out of view. The illustration is an artistic assembly study, not a dimensionally validated equipment model. A static/SVG fallback, reduced-motion layout and keyboard skip link keep the page usable without animation. The 3D module loads separately from the identification app.

The identification workspace lives at `/identify`. Existing `/?workspace=...` sharing links redirect there with the same workspace UUID. Installed app shortcuts open `/identify`, and offline navigation caches the landing page and workspace separately.

Node 22+ (Vercel Node 24):

```
npm ci
npm run prebuild
npm run dev
```

`npm run build` prepares a pinned DINOv2-small q8 model then builds Next.js with webpack. Set `OPENROUTER_API_KEY` in Vercel Production to enable hosted AI vision review. The key stays server-side. The DINOv2 encoder runs in the Node server using ONNX Runtime. Browser captures are resized, sent to `/api/identify`, decoded and encoded; the endpoint does not persist photos. Local drafts use IndexedDB.

## Hosted AI visual review

After vector retrieval, the app sends the captured photo and up to five candidate reference images to OpenRouter through AI SDK 7. The vision model compares visible features, reads markings, selects a candidate ID or abstains, and explains its reasoning in a validated structured response. It cannot create new part identifiers or document records. `OPENROUTER_VISION_MODEL` optionally overrides the default `openai/gpt-6.1-terra` model, verified against the current OpenRouter catalog.

The API returns the actual provider/model and whether vision ran. If the key is missing or a provider request fails, results are explicitly labeled as vector-only. Captures and reference views are transmitted to the configured provider for review; the matching endpoint does not persist photos.

## Technical manual chat

`/manuals` answers questions from two indexed public publications: TO 35C2-3-386-51W/IPB (30 April 2010, 616 PDF pages) and TO 38G1-128-2 (1 November 2000, 155 PDF pages). The server searches page-bound PDF text using BM25, identifier boosts and adjacent-page context, then asks the existing OpenRouter connection for a structured answer. `OPENROUTER_CHAT_MODEL` optionally overrides the text model.

Every answer paragraph must cite retrieved source IDs with exact contiguous quotes. The server validates those quotes against the extracted text and derives page links from its own publication metadata. A separate model call checks whether the cited evidence supports the answer's technical claims before the answer is displayed. Missing evidence, fabricated quotes, or failed support checks produce an explicit insufficient-evidence answer. Questions and history are not saved by the app; they and the retrieved public passages are sent to OpenRouter.

The source viewer distinguishes physical PDF-page numbers from printed page labels and exposes the exact quote, retrieved passage, publication edition, and original PDF link. Component records can open a context-specific chat. The library covers extracted text, not OCR or interpretation of diagrams, and these indexed editions are not a claim of current authorized maintenance guidance.

The checked-in `data/technical-manuals.json` contains publication checksums and page-level excerpts. To rebuild it, install `pypdf`, place the two cited source PDFs in `work/research/mep-832a-2010.pdf` and `work/research/l70ae-2000.pdf`, then run `python3 scripts/index-technical-manuals.py`. PDF parsing is an ingestion task; production requests use the prebuilt index.

## Image matching architecture

Both indexing and inference use `scripts/visual-encoder.mjs`: DINOv2-small, revision `c2bb04a51fab207c420665f1946016107bffc701`, 384-dimensional normalized CLS embeddings. `public/matching.js` computes cosine similarity against reference image vectors, groups by component and returns nearest records. No hashes, filename IDs, prompt labels or sample IDs determine the match. The interface accepts camera captures and user uploads; it does not offer preloaded sample-photo buttons. Equipment-library context is an explicit filter selected by the user.

The MEP-832A scope contains three sourced records. Full-library scope searches 103 records (149 reference images). General categories are not exact manufacturer-part mappings. The record supplies part identifiers and document links; AI does not invent publications or identifiers. Similarity is not calibrated confidence.

## Source records and imagery

MEP-832A identifiers are transcribed from the publicly released 30 April 2010 manual: Air Force TO 35C2-3-386-51W/IPB / Army TM 9-6115-639-13&P. The manual is hosted at https://www.radiomanual.info/schemi/Surplus_Accessories/MEP-831A_MEP-832A_serv_user_TM9-6115-639-13P_2010.pdf .

- Air cleaner element: P/N 114250-12581, NSN 2940-01-310-4495; WP 0117, Figure 26, item 6, PDF page 449.
- Fuel filter element: P/N 33583, NSN 4330-01-374-9147; WP 0116, Figure 25, item 7, PDF page 445.
- Oil pump strainer: P/N 114250-35070, NSN 2815-01-353-7523; WP 0129, Figure 36, item 2, PDF page 495.

The three MEP-832A entries include real internet product reference photos with original-source credits. Additional component illustrations, the generator hero and separate field captures are AI-generated and informed by manual diagrams. They are not OEM photographs or validated geometry. Prompts and asset paths: `public/image-provenance.json`. The remaining general-component images are sourced photographs with attribution in `public/photo-credits.json`. Inventory, prices, bins, equipment instances and initial activity are seeded scenario data. Current authorized maintenance publications and physical configuration must be checked separately.

## Rebuild data

```
npm run catalog:build
npm run catalog:encode
```

The SQLite export includes component records, photos, document references and image vectors. `data/recognition-index.json` is the runtime vector index. Captures are excluded from reference embeddings. `public/evaluation-report.json` reports the small synthetic viewpoint test, including focused and full-library predictions. All three captures rank first within their explicit MEP-832A scope; two rank second in the unscoped library. This is not an operational accuracy claim.

## Workspace

Requests, notes, transitions and linked records persist as append-only records in a private Vercel Blob store, isolated by a random workspace UUID. `BLOB_READ_WRITE_TOKEN` is configured through the Vercel integration. Never expose it to clients. Development uses `.demo-data/` when no token is present. Anyone with a workspace link can edit that workspace. Requests are internal workspace records, not external military supply-system submissions.

## Verify

```
npm run lint
npx tsc --noEmit
npm test
node scripts/test-captures.mjs
npm run build
```

`TEST_URL=https://... node scripts/test-captures.mjs` verifies deployed image upload → embedding → vector search → correct component, with an arbitrary upload filename and invalid-image handling. Vercel bundles pinned model files through output tracing; prebuild downloads weights from the pinned revision. Both the Air Force palette and component/document workflow have responsive layouts.
