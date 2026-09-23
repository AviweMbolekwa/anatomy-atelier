import type { HotspotStructure, OrganId } from "./anatomy-data";

export type AuthoredHotspot = HotspotStructure & { label: string; detail: string };

const STORAGE_KEY = "anatomy-atelier:authored-hotspots:v1";
const listeners = new Set<() => void>();
let cache: Partial<Record<OrganId, AuthoredHotspot[]>> | null = null;
let version = 0;

function read(): Partial<Record<OrganId, AuthoredHotspot[]>> {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : {};
    if (raw) version = 1;
  } catch {
    cache = {};
  }
  return cache ?? {};
}

function write(next: Partial<Record<OrganId, AuthoredHotspot[]>>) {
  cache = next;
  version += 1;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

export function getAuthoredHotspots(organId: OrganId): AuthoredHotspot[] {
  return [...(read()[organId] ?? [])];
}

export function getAuthoredSnapshot() {
  read();
  return version;
}
export function getAuthoredSnapshotServer() {
  return 0;
}

export function subscribeAuthored(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveAuthoredHotspot(organId: OrganId, hotspot: AuthoredHotspot) {
  const current = read();
  const list = [...(current[organId] ?? [])].filter((item) => item.id !== hotspot.id);
  list.push(hotspot);
  write({ ...current, [organId]: list });
}

export function removeAuthoredHotspot(organId: OrganId, hotspotId: string) {
  const current = read();
  write({ ...current, [organId]: (current[organId] ?? []).filter((item) => item.id !== hotspotId) });
}

export function clearAuthoredHotspots(organId?: OrganId) {
  if (!organId) {
    write({});
    return;
  }
  const current = read();
  const next = { ...current };
  delete next[organId];
  write(next);
}

export function exportAuthoredHotspots() {
  return JSON.stringify(read(), null, 2);
}
