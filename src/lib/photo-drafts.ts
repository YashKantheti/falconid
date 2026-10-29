const DB = "age-scout-user-photo-drafts-v2";
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function savePhotoDraft(files: Blob[]) {
  const database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("drafts", "readwrite");
      tx.objectStore("drafts").put(files, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    database.close();
  }
}
export async function loadPhotoDraft(): Promise<Blob[]> {
  const database = await db();
  try {
    return await new Promise((resolve, reject) => {
      const r = database
        .transaction("drafts")
        .objectStore("drafts")
        .get("current");
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  } finally {
    database.close();
  }
}
export async function clearPhotoDraft() {
  const database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("drafts", "readwrite");
      tx.objectStore("drafts").delete("current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    database.close();
  }
}
