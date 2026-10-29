import { createHmac, randomInt } from "node:crypto";
import { isIP } from "node:net";
import { list, put } from "@vercel/blob";

export class ManualRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("Chat request limit reached. Please try again later.");
    this.retryAfter = retryAfter;
  }
}
export type QuotaStore = {
  paths(prefix: string, limit: number): Promise<string[]>;
  create(path: string, expires: number): Promise<boolean>;
};
const cloudStore: QuotaStore = {
  async paths(prefix, limit) {
    const result = await list({ prefix, limit });
    return result.blobs.map((blob) => blob.pathname);
  },
  async create(path, expires) {
    try {
      await put(path, JSON.stringify({ expires }), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
      });
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        /already exists|already_exist|precondition/i.test(error.message)
      )
        return false;
      throw error;
    }
  },
};
// Development only. Production always uses the shared store and fails closed on outages.
const developmentSlots = new Map<string, number>();
const developmentStore: QuotaStore = {
  async paths(prefix) {
    const now = Date.now();
    for (const [path, expiry] of developmentSlots)
      if (expiry < now) developmentSlots.delete(path);
    return [...developmentSlots.keys()].filter((path) =>
      path.startsWith(prefix),
    );
  },
  async create(path, expires) {
    if (developmentSlots.has(path)) return false;
    developmentSlots.set(path, expires);
    return true;
  },
};

export async function claimQuotaSlot(
  store: QuotaStore,
  prefix: string,
  limit: number,
  expires: number,
  now = Date.now(),
) {
  const occupied = new Set(await store.paths(prefix, limit));
  const free = Array.from(
    { length: limit },
    (_value, index) => `${prefix}${index}.json`,
  ).filter((path) => !occupied.has(path));
  for (let attempt = 0; free.length && attempt < 8; attempt++) {
    const index = randomInt(free.length);
    const [candidate] = free.splice(index, 1);
    // Create-only writes enforce the limit even when separate instances read the same free slot.
    if (await store.create(candidate, expires)) return;
  }
  throw new ManualRateLimitError(
    Math.max(1, Math.ceil((expires - now) / 1000)),
  );
}
function configuredLimit(name: string, fallback: number) {
  if (!process.env[name]) return fallback;
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value < 1 || value > 1000)
    throw Error("Invalid manual chat limit configuration");
  return value;
}
export function manualLimitSettings() {
  return {
    minute: configuredLimit("MANUAL_CHAT_IP_MINUTE_LIMIT", 8),
    hour: configuredLimit("MANUAL_CHAT_IP_HOUR_LIMIT", 40),
    day: configuredLimit("MANUAL_CHAT_GLOBAL_DAILY_LIMIT", 200),
  };
}
export function manualClientIdentity(request: Request, key: Buffer) {
  // Vercel overwrites its forwarded IP headers. Never use an arbitrary user-supplied ID/cookie for quotas.
  const raw = process.env.VERCEL
    ? (
        request.headers.get("x-vercel-forwarded-for") ||
        request.headers.get("x-forwarded-for") ||
        ""
      )
        .split(",")[0]
        .trim()
    : "development";
  const address = raw === "development" || isIP(raw) ? raw : "unknown";
  return createHmac("sha256", key)
    .update("manual-quota:" + address)
    .digest("hex")
    .slice(0, 32);
}
export async function consumeManualQuota(request: Request, key: Buffer) {
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN)
    throw Error("Shared manual chat limits are unavailable");
  const store = process.env.BLOB_READ_WRITE_TOKEN
    ? cloudStore
    : developmentStore;
  const now = Date.now(),
    client = manualClientIdentity(request, key),
    limits = manualLimitSettings();
  const windows = [
    { name: `client/${client}/minute`, duration: 60000, limit: limits.minute },
    { name: `client/${client}/hour`, duration: 3600000, limit: limits.hour },
    { name: "global/day", duration: 86400000, limit: limits.day },
  ];
  for (const window of windows) {
    const bucket = Math.floor(now / window.duration),
      expires = (bucket + 1) * window.duration;
    await claimQuotaSlot(
      store,
      `falconid/manual-chat-quotas/v1/${window.name}/${bucket}/`,
      window.limit,
      expires,
      now,
    );
  }
}
