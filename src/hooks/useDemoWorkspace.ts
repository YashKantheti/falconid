/* eslint-disable react-hooks/set-state-in-effect -- Hydrate browser-only persisted workspace after the server render. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { seedData } from "@/lib/demo-seed";
import { mergeMutation } from "@/lib/workspace-logic";
import type {
  PendingMutation,
  SupplyItem,
  WorkspaceData,
} from "@/lib/demo-types";
const empty = (): WorkspaceData => ({
  ...structuredClone(seedData),
  storage: "local",
});
export function useDemoWorkspace() {
  const [workspace, setWorkspace] = useState("");
  const [data, setData] = useState<WorkspaceData>(empty);
  const [queue, setQueue] = useState<PendingMutation[]>([]);
  const [cart, setCart] = useState<SupplyItem[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("");
  const current = useRef({
    workspace: "",
    data: empty(),
    queue: [] as PendingMutation[],
    cart: [] as SupplyItem[],
  });
  const busy = useRef(false);
  const persist = useCallback(() => {
    const s = current.current;
    localStorage.setItem(
      `age-scout:v2:${s.workspace}`,
      JSON.stringify({ data: s.data, queue: s.queue, cart: s.cart }),
    );
  }, []);
  const sync = useCallback(async () => {
    const s = current.current;
    if (!s.workspace || busy.current || !navigator.onLine) return;
    busy.current = true;
    setSyncing(true);
    try {
      while (s.queue.length) {
        const mutation = s.queue[0];
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace: s.workspace, mutation }),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Unable to sync changes");
        s.queue = s.queue.filter((q) => q.record.id !== mutation.record.id);
        setQueue([...s.queue]);
        persist();
      }
      const response = await fetch(`/api/workspace?workspace=${s.workspace}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Workspace unavailable");
      let next = result as WorkspaceData;
      for (const q of s.queue) next = mergeMutation(next, q);
      s.data = next;
      setData(next);
      persist();
      setError("");
      setLastSync(new Date().toISOString());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sync unavailable. Changes remain on this device.",
      );
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [persist]);
  useEffect(() => {
    const fromUrl = new URL(location.href).searchParams.get("workspace");
    const valid = (id: string | null) =>
      !!id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      );
    const stored = localStorage.getItem("age-scout:workspace");
    const id = valid(fromUrl)
      ? fromUrl!
      : valid(stored)
        ? stored!
        : crypto.randomUUID();
    localStorage.setItem("age-scout:workspace", id);
    let cached;
    try {
      cached = JSON.parse(localStorage.getItem(`age-scout:v2:${id}`) || "null");
    } catch {}
    current.current = {
      workspace: id,
      data: cached?.data || empty(),
      queue: cached?.queue || [],
      cart: cached?.cart || [],
    };
    setWorkspace(id);
    setData(current.current.data);
    setQueue(current.current.queue);
    setCart(current.current.cart);
    setOnline(navigator.onLine);
    void sync();
    const onOnline = () => {
      setOnline(true);
      void sync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = setInterval(() => void sync(), 20000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [sync]);
  const mutate = useCallback(
    (mutation: PendingMutation) => {
      const s = current.current;
      const previous = { data: s.data, queue: s.queue };
      s.data = mergeMutation(s.data, mutation);
      s.queue = [...s.queue, mutation];
      try {
        persist();
      } catch {
        s.data = previous.data;
        s.queue = previous.queue;
        throw Error("Device storage is full. Your change was not saved.");
      }
      setData(s.data);
      setQueue([...s.queue]);
      void sync();
    },
    [persist, sync],
  );
  const updateCart = useCallback(
    (items: SupplyItem[]) => {
      const s = current.current,
        previous = s.cart;
      s.cart = items;
      try {
        persist();
      } catch {
        s.cart = previous;
        throw Error("Device storage is full. Your cart was not saved.");
      }
      setCart(items);
    },
    [persist],
  );
  const addToCart = useCallback(
    (partId: string, name: string) => {
      const s = current.current;
      const found = s.cart.find((x) => x.partId === partId);
      updateCart(
        found
          ? s.cart.map((x) =>
              x.partId === partId ? { ...x, qty: Math.min(999, x.qty + 1) } : x,
            )
          : [...s.cart, { partId, name, qty: 1 }],
      );
    },
    [updateCart],
  );
  const shareLink = useCallback(() => {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("workspace", current.current.workspace);
    url.hash = "";
    return url.href;
  }, []);
  return {
    workspace,
    data,
    queue,
    cart,
    online,
    syncing,
    error,
    lastSync,
    mutate,
    sync,
    updateCart,
    addToCart,
    shareLink,
  };
}
