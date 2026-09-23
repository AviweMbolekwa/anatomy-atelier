#!/usr/bin/env python3
"""
Reproduces the exact normalization app/lib/three/loaders.ts applies after
loading a model:

    box = Box3().setFromObject(model)         # world-space bbox of the scene
    scale = FIT_SIZE / max(box.size)
    model.position = -box.center * scale
    model.scale = scale

Hotspots are children of the same pivot the (now-transformed) model sits in,
so a real vertex, transformed the same way, lands in exactly the coordinate
space `position` fields are written in.

Usage: python3 to_hotspot_space.py <verts.npy> <model.gltf.json> <out.npy>
  where verts.npy came from extract-geometry.mjs (via geometry_io.load_json)
  and model.gltf.json is the model's JSON chunk (see dump_json_chunk.mjs).
"""
import json
import sys
import numpy as np

FIT_SIZE = 3.8  # must match app/lib/three/loaders.ts

def node_translation(gltf_json_path):
    j = json.load(open(gltf_json_path))
    node = j["nodes"][0]
    if len(j["nodes"]) != 1:
        print(f"warning: expected 1 node, found {len(j['nodes'])} — using node 0", file=sys.stderr)
    return np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)

def to_hotspot_space(verts_local, node_trans):
    v_nodespace = verts_local + node_trans
    mn, mx = v_nodespace.min(axis=0), v_nodespace.max(axis=0)
    size, center = mx - mn, (mn + mx) / 2
    scale = FIT_SIZE / max(size.max(), 0.001)
    return (v_nodespace - center) * scale

if __name__ == "__main__":
    verts_path, gltf_json_path, out_path = sys.argv[1:4]
    verts = np.load(verts_path).astype(np.float64)
    hs = to_hotspot_space(verts, node_translation(gltf_json_path))
    print("hotspot-space bbox:", hs.min(axis=0).round(3), "to", hs.max(axis=0).round(3))
    np.save(out_path, hs)
