/**
 * Storage abstraction for anything that has to outlive a session.
 *
 * Progress is the reason this exists. Once a learner's mastery and review
 * schedule matter, losing them to a cleared browser is the difference between
 * someone returning tomorrow and someone not. `localStorage` is the only
 * backend today, but the moment accounts land this needs to be D1 — and that
 * move should not mean rewriting every call site.
 *
 * The shape that makes both possible:
 *  - the backend is async (D1 is; localStorage pretends to be),
 *  - reads in components are sync, served from an in-memory cache,
 *  - writes update the cache immediately and flush to the backend after.
 *
 * That keeps `useSyncExternalStore` usable — it needs a synchronous snapshot —
 * while leaving room for a backend that talks over the network.
 */

export type StorageBackend = {
  /** Every key/value this backend holds, read once at hydration. */
  load(): Promise<Record<string, string>>;
  save(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

/** The default backend: this device, this browser. */
export const localStorageBackend: StorageBackend = {
  async load() {
    if (typeof window === "undefined" || !("localStorage" in window)) return {};
    const out: Record<string, string> = {};
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key?.startsWith(NAMESPACE)) continue;
        const value = window.localStorage.getItem(key);
        if (value !== null) out[key] = value;
      }
    } catch {
      // Private browsing or disabled storage: start empty rather than throw.
    }
    return out;
  },
  async save(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota exceeded — the session keeps working, it just won't persist.
    }
  },
  async remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Same as above.
    }
  },
};

export const NAMESPACE = "anatomy-atelier:";

/**
 * A synchronous-read cache over an async backend, with change notification
 * for `useSyncExternalStore`.
 */
export class Store {
  private cache = new Map<string, string>();
  private listeners = new Set<() => void>();
  private hydrated = false;
  private backend: StorageBackend;
  /** Serialises flushes so two quick writes can't land out of order. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(backend: StorageBackend = localStorageBackend) {
    this.backend = backend;
  }

  /** Swaps the backend at runtime — how a sign-in would migrate to D1. */
  setBackend(backend: StorageBackend) {
    this.backend = backend;
    this.hydrated = false;
    this.cache.clear();
    void this.hydrate();
  }

  async hydrate() {
    if (this.hydrated) return;
    this.hydrated = true;
    const data = await this.backend.load();
    for (const [key, value] of Object.entries(data)) this.cache.set(key, value);
    this.emit();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    // First subscriber triggers hydration; on the server nobody subscribes.
    void this.hydrate();
    return () => void this.listeners.delete(listener);
  };

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  getRaw(key: string): string | null {
    return this.cache.get(NAMESPACE + key) ?? null;
  }

  get<T>(key: string, fallback: T): T {
    const raw = this.getRaw(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown) {
    const full = NAMESPACE + key;
    const serialised = JSON.stringify(value);
    this.cache.set(full, serialised);
    this.emit();
    this.queue = this.queue.then(() => this.backend.save(full, serialised)).catch(() => {});
  }

  remove(key: string) {
    const full = NAMESPACE + key;
    this.cache.delete(full);
    this.emit();
    this.queue = this.queue.then(() => this.backend.remove(full)).catch(() => {});
  }

  /** Test seam: waits for every queued write to settle. */
  async flush() {
    await this.queue;
  }
}

export const store = new Store();
