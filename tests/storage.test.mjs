import assert from "node:assert/strict";
import test from "node:test";
import { Store, NAMESPACE } from "../app/lib/storage.ts";

function fakeBackend(seed = {}) {
  const data = new Map(Object.entries(seed));
  const calls = { save: 0, remove: 0, load: 0 };
  return {
    calls,
    data,
    async load() { calls.load += 1; return Object.fromEntries(data); },
    async save(key, value) { calls.save += 1; data.set(key, value); },
    async remove(key) { calls.remove += 1; data.delete(key); },
  };
}

test("reads are synchronous once hydrated", async () => {
  const backend = fakeBackend({ [`${NAMESPACE}greeting`]: JSON.stringify("hi") });
  const store = new Store(backend);
  await store.hydrate();
  assert.equal(store.get("greeting", null), "hi");
});

test("an unhydrated store returns the fallback rather than throwing", () => {
  const store = new Store(fakeBackend());
  assert.deepEqual(store.get("missing", []), []);
});

test("writes are visible immediately and flushed to the backend after", async () => {
  const backend = fakeBackend();
  const store = new Store(backend);
  await store.hydrate();

  store.set("count", 3);
  assert.equal(store.get("count", 0), 3, "the write must be readable before the flush lands");

  await store.flush();
  assert.equal(backend.data.get(`${NAMESPACE}count`), "3");
});

test("subscribers are notified on write and on remove", async () => {
  const store = new Store(fakeBackend());
  await store.hydrate();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });

  store.set("a", 1);
  store.remove("a");
  assert.ok(notifications >= 2, "both a write and a remove should notify");

  unsubscribe();
  const before = notifications;
  store.set("b", 2);
  assert.equal(notifications, before, "an unsubscribed listener must not be called");
});

test("corrupt JSON falls back instead of throwing", async () => {
  const backend = fakeBackend({ [`${NAMESPACE}broken`]: "{not json" });
  const store = new Store(backend);
  await store.hydrate();
  assert.deepEqual(store.get("broken", { ok: true }), { ok: true });
});

test("only namespaced keys are loaded, so the app ignores other apps' storage", async () => {
  const backend = fakeBackend({ [`${NAMESPACE}mine`]: '"yes"', "someone-else": '"no"' });
  const store = new Store(backend);
  await store.hydrate();
  assert.equal(store.get("mine", null), "yes");
  assert.equal(store.getRaw("someone-else"), null);
});

test("writes are serialised so two quick writes land in order", async () => {
  const backend = fakeBackend();
  const store = new Store(backend);
  await store.hydrate();
  store.set("x", 1);
  store.set("x", 2);
  await store.flush();
  assert.equal(backend.data.get(`${NAMESPACE}x`), "2", "the last write must win at the backend too");
});

test("swapping the backend re-hydrates from the new source", async () => {
  const store = new Store(fakeBackend({ [`${NAMESPACE}v`]: '"local"' }));
  await store.hydrate();
  assert.equal(store.get("v", null), "local");

  store.setBackend(fakeBackend({ [`${NAMESPACE}v`]: '"server"' }));
  await store.hydrate();
  assert.equal(store.get("v", null), "server", "this is the path a sign-in would take");
});

test("a failing backend does not surface as an unhandled rejection", async () => {
  const store = new Store({
    async load() { return {}; },
    async save() { throw new Error("network down"); },
    async remove() { throw new Error("network down"); },
  });
  await store.hydrate();
  store.set("x", 1);
  await assert.doesNotReject(() => store.flush());
  assert.equal(store.get("x", null), 1, "the in-memory value survives a failed flush");
});
