import { get, list, put } from "@vercel/blob";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedData } from "./demo-seed";
import { mergeMutation } from "./workspace-logic";
import type { PendingMutation, WorkspaceData } from "./demo-types";
const root = path.join(process.cwd(), ".demo-data");
export function validWorkspace(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  );
}
function prefix(workspace: string) {
  return `age-scout/workspaces/${workspace}/`;
}
export function storageMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "cloud";
  if (process.env.VERCEL)
    throw new Error(
      "Cloud storage is not configured. Your changes are saved on this device until storage is connected.",
    );
  return "local";
}
export async function readWorkspace(workspace: string): Promise<WorkspaceData> {
  const storage = storageMode();
  let records: PendingMutation[] = [];
  if (storage === "cloud") {
    let cursor: string | undefined;
    do {
      const result = await list({
        prefix: prefix(workspace),
        limit: 1000,
        cursor,
      });
      const batches = await Promise.all(
        result.blobs.map(async (blob) => {
          const result = await get(blob.pathname, {
            access: "private",
            useCache: false,
          });
          if (!result || result.statusCode !== 200) return null;
          return new Response(result.stream).json() as Promise<PendingMutation>;
        }),
      );
      records.push(...batches.filter((x): x is PendingMutation => !!x));
      cursor = result.hasMore ? result.cursor : undefined;
      if (records.length > 5000) break;
    } while (cursor);
  } else {
    const directory = path.join(root, workspace);
    await mkdir(directory, { recursive: true });
    const files = await readdir(directory);
    records = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) =>
          JSON.parse(await readFile(path.join(directory, f), "utf8")),
        ),
    );
  }
  let data: WorkspaceData = { ...structuredClone(seedData), storage };
  for (const mutation of records) data = mergeMutation(data, mutation);
  return data;
}
export async function writeRecord(
  workspace: string,
  mutation: PendingMutation,
) {
  const storage = storageMode();
  const filename = `${mutation.kind}-${mutation.record.id}.json`;
  if (storage === "cloud") {
    try {
      await put(prefix(workspace) + filename, JSON.stringify(mutation), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
      });
    } catch (error) {
      if (!(error instanceof Error && /already exists/i.test(error.message)))
        throw error;
    }
  } else {
    const directory = path.join(root, workspace);
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(
        path.join(directory, filename),
        JSON.stringify(mutation),
        { flag: "wx" },
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  return storage;
}
