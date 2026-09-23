# Geometry-assisted hotspot authoring

`?authoring=1` needs a human clicking the live 3D model. That's still true —
nothing here removes the need to look at the model and think about anatomy.
What it removes is *guessing coordinates blind*: instead of typing numbers,
you pick a pixel from a real rendered view of the actual decoded mesh, and
get back the exact vertex that's visible there.

## Why this exists, and its real limit

These GLBs are single-mesh, single-material, AI-generated (Tripo) assets with
**no semantic sub-part naming** — verified by parsing every model's glTF JSON:
one node, one mesh, one primitive each. There is no metadata anywhere that
says "these vertices are the mitral valve." That means:

- A structure that's a **visible feature of the exterior surface** — a vessel
  stump, a lobe, a groove, an extremal point like an apex — can be identified
  from a real render and placed exactly, with the same confidence as watching
  someone click the live model.
- A structure that's **purely internal** — a valve inside a chamber, a brain
  nucleus buried in the cerebral mass — usually isn't separate geometry at
  all on a single external-surface mesh. No amount of clever geometry
  processing recovers detail the model never had. Placing one of these still
  needs either a human's informed estimate (same as this project's existing
  `mitral` hotspot — see below) or a better source asset.

This is why the original ask — "just read the coordinates off the GLB" —
doesn't fully work: reading real numbers off the mesh is exactly what these
scripts do, but a chunk of the 81 target structures aren't *in* the mesh to
read.

### Confirmed by cross-checking the 35 existing hotspots

Running every existing `position` through `to_hotspot_space.py`'s inverse and
finding its nearest real vertex:

| hotspot | distance to nearest real surface vertex |
| --- | --- |
| `aorta`, `right-atrium`, `left-ventricle` | ~0.02–0.03 (on the surface) |
| `left-atrium`, `right-ventricle` | ~0.13–0.29 (near the surface) |
| `mitral` | ~0.21 (genuinely internal — not on the surface) |

So the existing dataset already mixes raycasted surface points with
hand-estimated internal points. Continuing that mix for new internal
structures is consistent with current practice — it just needs to be a
*visually informed* estimate, anchored to the real geometry around it, not a
number invented with no model open at all.

## Pipeline

```
extract-geometry.mjs   raw GLB → real local-space vertices (three.js
                        GLTFLoader + MeshoptDecoder — the same decoder
                        app/lib/three/loaders.ts uses; these models are
                        EXT_meshopt_compression-compressed, so a generic
                        glTF/JSON reader silently gets this wrong)
dump_json_chunk.mjs     raw GLB → JSON chunk (for the node's translation)
to_hotspot_space.py     reproduces loaders.ts's FIT_SIZE normalization
                        exactly, so output lands in the same space
                        `position` fields are written in
render_views.py         6 gridded orthographic renders + a per-pixel
                        real-vertex-index buffer
pick.py                 pixel you choose on a rendered view → exact real
                        vertex position (or a small neighborhood search if
                        that exact pixel has no point — never fabricated)
extremum.py             analytic min/max along an axis — no picking at
                        all, so no risk of the pixel-picking error below;
                        use this whenever a structure IS an extremum
```

### Requirements

`pip install numpy pillow` (Python side). The extraction step reuses the
project's own `three` dependency, so run it from inside `anatomy-main` with
`node_modules` installed.

### Worked example: heart

```
node scripts/geometry-assist/extract-geometry.mjs public/models/heart.glb /tmp/h.json
node scripts/geometry-assist/dump_json_chunk.mjs public/models/heart.glb /tmp/h.gltf.json
python3 -c "import json,numpy as np; d=json.load(open('/tmp/h.json')); np.save('/tmp/h.npy', np.array(d['positions'],dtype=np.float32).reshape(-1,3))"
python3 scripts/geometry-assist/to_hotspot_space.py /tmp/h.npy /tmp/h.gltf.json /tmp/h-hs.npy
python3 scripts/geometry-assist/extremum.py /tmp/h-hs.npy y min
#  -> { position: [0.486, -1.900, 0.107] }   apex cordis — analytically exact
python3 scripts/geometry-assist/render_views.py /tmp/h-hs.npy /tmp/h
#  -> open /tmp/h-back-grid.png, find the coronary sulcus groove, read off its pixel
python3 scripts/geometry-assist/pick.py /tmp/h-hs.npy /tmp/h back 330 330
#  -> { position: [0.281, 0.280, -0.731] }   coronary sulcus
```

Both values above are real — reproduced from a clean run of this exact
pipeline, not hand-typed.

### A mistake worth knowing about before you trust your own eye

An early manual pick for the heart's apex, eyeballed from the front-view
render, was **0.79 units off** (in a model that spans ~3.8 units — roughly
20% of the whole model's scale) from the true lowest point, because a flat
orthographic silhouette foreshortens near a rounded tip and it's easy to click
early. `extremum.py`'s analytic min-Y is what actually matches the anatomy
(its X sits on the left-ventricle side, which is correct — the apex is formed
mostly by the left ventricle). **Prefer `extremum.py` over eyeballing whenever
a structure is a true extremum; treat any hand-picked pixel as a first draft
to confirm by rotating the live model, not a final answer.**

## What this means for the 81-structure target, organ by organ

Checked by actually rendering and looking, not assumed:

- **Heart** — promising. 6 distinct vessel stumps are visible at the base
  plus a clear coronary sulcus groove and an unambiguous apex. Vessel
  *shapes* are all real and pickable; matching each stump to its specific
  name (pulmonary trunk vs. SVC vs. IVC vs. the ~4 pulmonary veins) from
  static renders alone carries real misidentification risk — six similar
  tubes, no labels. That one step still wants a human rotating the live
  model, even though the coordinates themselves are already real once picked.
- **Brain** — mostly not modeled. Visible: cerebral gyri/sulci, a distinct
  cerebellum, a brainstem stub. Of the 11 candidates, only `occipital`
  (a broad region, same looseness as the existing `frontal`/`parietal`/
  `temporal`) and `brainstem` are directly placeable; `pons`/`medulla` could
  be rough subdivisions along the visible stem's length. `insula`,
  `corpus-callosum`, `thalamus`, `hypothalamus`, `hippocampus`, `amygdala`,
  `pituitary` — 7 of 11 — are not present as separate geometry on a single
  external-surface mesh at all. Placing them would be fabrication.
- **Skin** — better than expected. This is a cross-sectional block, not a
  surface swatch: real hair shafts protrude above the surface, and what look
  like actual follicle bulbs and gland coils are visible embedded in the cut
  face. `hair-shaft`, `hair-bulb`, and likely `sweat-gland`/`sebaceous-gland`
  look genuinely placeable. `stratum-corneum`/`stratum-basale` (cellular
  layers) and `sweat-pore` (a surface-scale opening) are far less certain —
  worth a render before assuming either way.

Kidneys, liver, lungs, intestine, pancreas, eyeball haven't been checked yet
with this tool. Run `render_views.py` on each before authoring — five minutes
per organ tells you what's actually achievable far more reliably than the
target-count table in the candidate list does on its own.

## What this doesn't replace

Confirming *which* named structure a real, correctly-placed point actually is
still benefits from a human's eyes on the live, rotatable, lit model — this
tool is orthographic, unlit, and static. Treat its output as: "here is a real
point on the real surface, at this real position" — a strong starting point,
not a finished, unreviewed answer for the vessel-identity question specifically.
