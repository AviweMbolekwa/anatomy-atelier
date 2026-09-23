#!/usr/bin/env python3
"""
Resolves a pixel you choose (from a -grid.png) to the real, exact 3D vertex
visible there — the same information a raycast in the browser would give you.
If the exact pixel has no vertex (a gap in the point splat), it searches a
small growing neighborhood rather than fabricating a position.

Usage: python3 pick.py <hotspot_space_verts.npy> <out_prefix> <view> <x> <y>
"""
import sys
import numpy as np

def pick(verts_path, out_prefix, view, x, y):
    hs = np.load(verts_path)
    idx = np.load(f"{out_prefix}-{view}-idx.npy")
    vi = int(idx[y, x])
    if vi < 0:
        for r in range(1, 20):
            ys, xs = np.mgrid[max(0, y - r):y + r + 1, max(0, x - r):x + r + 1]
            vals = idx[np.clip(ys, 0, idx.shape[0]-1), np.clip(xs, 0, idx.shape[1]-1)]
            filled = vals[vals >= 0]
            if len(filled):
                vi = int(filled[0])
                break
    if vi < 0:
        raise SystemExit(f"no vertex found near ({x},{y}) on view '{view}'")
    return hs[vi]

if __name__ == "__main__":
    verts_path, out_prefix, view, x, y = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
    pos = pick(verts_path, out_prefix, view, x, y)
    print(f'{{ position: [{pos[0]:.3f}, {pos[1]:.3f}, {pos[2]:.3f}] }}  // {view} ({x},{y}) -> real mesh vertex')
