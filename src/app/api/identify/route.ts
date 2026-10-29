import { NextRequest } from "next/server";
import sharp from "sharp";
import index from "../../../../data/recognition-index.json";
import catalog from "../../../../data/catalog.json";
import type { CatalogPart } from "@/lib/demo-types";
import {
  reviewWithVision,
  visionConfiguration,
  vectorOnlyVision,
} from "@/lib/vision-matching";
import { embedImage, RawImage } from "../../../../scripts/visual-encoder.mjs";
import { rankCandidates } from "../../../../public/matching.js";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET() {
  return Response.json(
    { ...visionConfiguration(), encoder: "DINOv2-small" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  const started = Date.now();
  const origin = request.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !==
      (request.headers.get("x-forwarded-host") || request.headers.get("host"))
  )
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 4_000_000)
    return Response.json(
      { error: "Use up to two photos under 2 MB each." },
      { status: 413 },
    );
  try {
    const form = await request.formData();
    const images = form.getAll("images");
    if (
      !images.length ||
      images.length > 2 ||
      images.some((f) => !(f instanceof File) || !f.type.startsWith("image/"))
    )
      return Response.json(
        { error: "Upload one or two image files." },
        { status: 400 },
      );
    const platform = form.get("platform");
    const allowed = new Set(
      catalog
        .filter(
          (p) =>
            platform !== "MEP-832A" ||
            ("platform" in p && p.platform === platform),
        )
        .map((p) => p.id),
    );
    const searchIndex = {
      ...index,
      references: index.references.filter((r) => allowed.has(r.partId)),
    };
    const vectors = [];
    const visionImages: Uint8Array[] = [];
    for (const image of images as File[]) {
      if (image.size > 2_000_000)
        return Response.json(
          { error: "Each prepared photo must be under 2 MB." },
          { status: 413 },
        );
      const decoded = await sharp(Buffer.from(await image.arrayBuffer()), {
        limitInputPixels: 24_000_000,
      })
        .rotate()
        .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
        .removeAlpha()
        .toColourspace("srgb")
        .raw()
        .toBuffer({ resolveWithObject: true });
      visionImages.push(
        new Uint8Array(
          await sharp(decoded.data, {
            raw: {
              width: decoded.info.width,
              height: decoded.info.height,
              channels: decoded.info.channels,
            },
          })
            .jpeg({ quality: 88 })
            .toBuffer(),
        ),
      );
      vectors.push(
        await embedImage(
          new RawImage(
            new Uint8ClampedArray(decoded.data),
            decoded.info.width,
            decoded.info.height,
            decoded.info.channels,
          ),
        ),
      );
    }
    const vectorResult = rankCandidates(vectors, searchIndex);
    let match = { ...vectorResult, vision: vectorOnlyVision("not_configured") };
    if (visionConfiguration().configured) {
      try {
        match = {
          ...match,
          ...(await reviewWithVision({
            images: visionImages,
            candidates: vectorResult.candidates,
            catalog: catalog as CatalogPart[],
            signal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(60000),
            ]),
          })),
        };
      } catch (error) {
        console.error("Hosted vision review failed", {
          type: error instanceof Error ? error.name : "Unknown",
        });
        match = {
          ...vectorResult,
          reliable: false,
          vision: vectorOnlyVision("unavailable"),
        };
      }
    }
    return Response.json(
      {
        ...match,
        model: index.model,
        dimensions: index.dimensions,
        searched: allowed.size,
        elapsedMs: Date.now() - started,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Image vector matching failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "Unable to analyze this image. Try a clear JPEG or PNG photo." },
      { status: 422 },
    );
  }
}
