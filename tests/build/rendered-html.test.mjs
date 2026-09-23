// Requires a production build first (`npm run build`), which is why this
// lives outside `tests/*.test.mjs` and is only run via `npm run test:build`.
// The fast unit suite (`npm test`) never needs a build and should stay that
// way — this file is for pre-deploy validation.
import assert from "node:assert/strict";
import test from "node:test";

async function render(path) {
  const workerUrl = new URL("../../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the English Anatomy Atelier page, not the old starter skeleton", async () => {
  const response = await render("/en");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Anatomy Atelier/);
  assert.match(html, /<html[^>]*lang="en"/i);
  // The old vinext-starter skeleton must be gone for good.
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("an unknown locale segment 404s instead of silently falling back", async () => {
  const response = await render("/xx");
  assert.equal(response.status, 404);
});

for (const code of ["en", "es", "ja", "ar"]) {
  test(`locale "${code}" renders with the right <html lang> and dir`, async () => {
    const response = await render(`/${code}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<html[^>]*lang="${code}"`, "i"));
    if (code === "ar") assert.match(html, /dir="rtl"/i);
  });
}
