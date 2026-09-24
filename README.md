# Anatomy Atelier

An interactive 3D anatomy atlas. Nine organs render as real GLB specimens you
can rotate, cross-section, isolate and label, wrapped in an illustrated study
environment available in English, isiXhosa, isiZulu and Afrikaans.

Built with Next.js 16 (App Router, RSC) and three.js, deployed to Cloudflare
Workers via [vinext](https://www.npmjs.com/package/vinext).

---

## Requirements

- **Node.js 22.13 or newer.** The version is pinned in `.nvmrc`; run `nvm install`
  from the project root to match it. `npm run check:node` enforces it, and runs
  automatically before `dev`, `build` and `test`.

## Getting started

```bash
nvm install          # or ensure Node >=22.13 some other way
npm install
npm run dev          # http://localhost:5173/en
```

The root path redirects to a locale, so always visit a localized route such as
`/en`, `/xh`, `/zu` or `/af`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local dev server through the Cloudflare Vite plugin |
| `npm run build` | Production build (Worker + client assets) |
| `npm start` | Serve the production build locally |
| `npm test` | Fast unit/data/i18n suite — no build required |
| `npm run test:build` | SSR smoke tests; runs a full build first |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run check:node` | Verify the running Node version |
| `npm run i18n:audit` | Report translation drift across all locales |
| `npm run i18n:export` | Export dictionaries for external translation |

## Architecture

```
app/
  [locale]/            Localized routes — layout owns metadata, page mounts the app
  components/
    AnatomyApp.tsx     Shell: library, info panel, learning cards, panels, lessons
    OrganViewer.tsx    React surface around the 3D viewer — tools, quiz, states
  lib/
    anatomy-data.ts    STRUCTURE ONLY — ids, TA terms, hotspot coords, systems, sources
    storage.ts         Backend-agnostic store — sync reads, async flush, swappable
    progress.ts        Per-structure mastery + SM-2-lite review scheduling
    quiz-engine.ts     Generates identify/reverse/describe questions from data
    search.ts          Ranked search across organs AND structures
    local-store.ts     Saved organs, notes, and the V1 best-score migration
    use-modal-a11y.ts  Focus trap / Escape / focus restoration for dialogs
    three/
      viewer.ts        Scene, camera, tools, render-on-demand loop
      loaders.ts       GLB loading, material normalisation, LRU cache
      hotspots.ts      In-scene label dots, occlusion fading, quiz flashes
      dispose.ts       Deep GPU resource disposal
  i18n/
    config.ts          Locale list, direction, script group
    types.ts           Dictionary shapes
    dictionaries.ts    Per-locale dynamic imports
    extra.ts           Kids-feature and panel strings, every locale in one file
    merge.ts           Joins structure + prose into the shape components consume
    ui/<locale>.ts     Interface copy
    organs/<locale>.ts Organ prose
public/
  models/<organ>.glb   The 3D specimens
  anatomy/<organ>/     Illustrations: thumb, organ, microscopic, compare, location
```

### The structure / prose split

`app/lib/anatomy-data.ts` holds everything that is locale-independent: organ ids,
Terminologia Anatomica terms, hotspot coordinates, colours, model paths, system
membership, related organs and citations. Translatable prose lives only in
`app/i18n/organs/<locale>.ts`, keyed by the same ids. `merge.ts` joins them, so
components never know a translation layer exists — and a missing hotspot
translation falls back to the Latin TA term rather than rendering blank.

### Rendering

The viewer draws on demand: the loop only renders when something actually moved,
which keeps an idle specimen at near-zero GPU cost. Hotspot dots live *in* the
scene as sprites rather than as DOM overlays, so occlusion comes from the depth
buffer plus a per-frame facing test instead of raycasting the mesh every frame.
Organ switches fade through a depth prepass so a transparent mesh still resolves
to one surface. Loaded organs are kept in a small LRU cache, and hovering an
entry in the library prefetches its GLB.

## Features

- **Explore** — orbit, zoom, isolate, cross-section, wireframe layers, and a
  Reset that genuinely returns every one of those to its opening state.
- **Systems** — browse all nine organs grouped by the eight body systems.
- **Lessons** — a four-step guided flow per organ: overview → structures →
  clinical relevance → sources.
- **Labelling quiz** — the 3D quiz asks for each structure once, marks the real
  answer on a miss, and records progress per structure.
- **Mastery & review** — every structure carries its own mastery score and
  review date; structures due for review lead the next round.
- **Library & notes** — bookmark organs and keep per-organ study notes; both
  persist in `localStorage` on the device.
- **Related organs** — cross-navigate along real anatomical relationships.
- **See it in your room (AR)** — places the organ on a real table at life size
  (`arSizes` in `anatomy-data.ts`; the eye and skin are labelled as enlarged).
  Android Chrome uses a WebXR `immersive-ar` session with hit-testing; iPhone and
  iPad get AR Quick Look with a USDZ generated from the same GLB, simplified to
  ~50k triangles first so it opens quickly. Desktop explains it needs a phone or
  tablet. WebXR requires HTTPS, so test on a deployed URL, not a LAN `http://` one.
- **Read aloud** — a speaker button on organ descriptions, facts, lessons and the
  question of the day, with the spoken word highlighted. Uses the device’s own
  voices (Web Speech API), and only appears when there is a voice for the page’s
  language — so isiXhosa and isiZulu aren’t read in the wrong accent where no
  voice exists. Recorded native-speaker audio is the planned fallback.

## The learning engine

Progress is tracked per **structure** (`organId:hotspotId`), not per organ. A
best score records one good round; it can't answer "what should I study next?".
Each structure accumulates attempts, accuracy, a streak, an SM-2 ease factor and
a due date.

Mastery is deliberately not raw accuracy — a structure answered correctly once
is not learned. It weights streak (0.5), accuracy (0.3) and scheduled interval
(0.2), so reaching mastery requires repeated recall spread over time.

Scheduling is **SM-2-lite**. Full SM-2 grades each answer 0–5, which needs a
confidence prompt after every question; that's too much friction for a labelling
quiz, so quality is derived from what the interaction already knows — whether
the answer was right, and whether it was right first time. A miss returns the
structure to the current session; successes step 1 → 3 days, then scale by ease.

`storage.ts` exists so this can outlive `localStorage`. The backend interface is
async (D1 is; localStorage pretends to be), reads are served synchronously from
an in-memory cache so `useSyncExternalStore` works, and writes flush behind a
serialised queue. Adding accounts means implementing one interface and calling
`store.setBackend()` — no call-site changes.

### Quiz modes

All three generate from existing data, with distractors drawn from the same
organ (or the same body system when an organ has too few structures):

| Mode | Prompt | Answer |
| --- | --- | --- |
| `identify` | A structure name | Click it on the 3D model |
| `reverse` | A highlighted structure | Pick its name from four options |
| `describe` | The structure's description | Pick the structure |

Modes that would need new per-structure prose (function, spatial relationships)
are deliberately absent: every such field costs a translation per locale.

## Accessibility

- Dialogs trap focus, close on `Escape`, and restore focus to whatever opened them.
- Every hotspot is reachable from the keyboard: the structure index is a list of
  real buttons that select the same structure a click on the dot would, and
  `↑`/`↓` step through structures while the canvas has focus (`←`/`→` rotate).
- All locales set `lang` and `dir`; layout uses logical properties throughout,
  and a test fails the build on a single-sided `left`/`right` that would break RTL.
- Loading, error and empty states are announced (`role="status"` / `role="alert"`).
- Animation is suppressed under `prefers-reduced-motion`.

## Content & sources

Medical content is written against, and cites, these references per organ
(surfaced in the final step of each lesson):

- [OpenStax, *Anatomy & Physiology 2e*](https://openstax.org/details/books/anatomy-and-physiology-2e)
- [Terminologia Anatomica (FIPAT, 2nd ed.)](https://ta2viewer.openanatomy.org/)
- [MedlinePlus](https://medlineplus.gov/)

This is a learning tool, not clinical guidance.

## Adding an organ

1. Drop `public/models/<id>.glb` and the five illustrations under
   `public/anatomy/<id>/`.
2. Add the entry to `organStructures` in `app/lib/anatomy-data.ts`, including
   `systemId`, `relatedOrganIds` and `references`.
3. Add its id to the `OrganId` union.
4. Add prose to every `app/i18n/organs/<locale>.ts` file (en, xh, zu, af).
5. Run `npm test` — the suite fails on a missing GLB, missing artwork, an
   unknown system, a dangling related id, or an untranslated hotspot.

To place hotspots, open the viewer with `?authoring=1` and click the model: it
prints a ready-to-paste coordinate line for each point you sample.

## Testing

`npm test` runs without a build and covers data integrity (every GLB and image
actually exists, hotspots are well-formed, systems and citations are
consistent), i18n parity across all locales, the persistence layer, and
static accessibility/responsive checks on the components and stylesheet.
`npm run test:build` additionally builds and server-renders the app.

## Deployment

Cloudflare Workers via Wrangler (`npm run build` produces `dist/`), with
`vercel.json` retained for preview deploys. `NEXT_PUBLIC_SITE_URL` sets the
absolute origin used for Open Graph tags.

## Hotspot authoring (`?authoring=1`)

The V2 content expansion includes a guided hotspot authoring workflow for the existing 9 GLB models. It deliberately does not invent 3D coordinates: the author clicks the real mesh and the viewer raycasts the exact point into pivot space.

Run the production server, then open `/en?authoring=1` (for example `http://localhost:3000/en?authoring=1`). The authoring panel shows the next structure to place. Click the corresponding anatomical area on the model. The sampled coordinate and structure content are saved to browser local storage. The next candidate then becomes active.

Each organ has enough candidates to reach 15 active structures. After authoring, refresh the page so the newly saved structures are included in normal exploration, search, quizzes and mastery. The `export` button copies all locally authored hotspot records as JSON for committing into the source data later.

Two things authored hotspots do **not** yet get, unlike the original 35: a translated label in the other 11 locales (the candidate's English label/detail renders as-is everywhere until it's exported and added to each `organs/<locale>.ts`), and a home in `anatomy-data.ts` — they live in this browser's `localStorage` only, so `export` → merging into the source files is a required step, not an optional one.
