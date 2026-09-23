#!/usr/bin/env python3
"""
Analytic extremal-point queries — no pixel-picking, no visual judgement, so
no risk of the ~0.8-unit error a hand-picked pixel can carry (see README).
Prefer this over pick.py whenever a structure IS the extremum of some axis —
apex cordis (min Y), an organ's most lateral point, etc.

Usage: python3 extremum.py <hotspot_space_verts.npy> <axis:x|y|z> <min|max>
"""
import sys
import numpy as np

verts_path, axis, which = sys.argv[1], sys.argv[2], sys.argv[3]
hs = np.load(verts_path)
col = {"x": 0, "y": 1, "z": 2}[axis]
i = hs[:, col].argmin() if which == "min" else hs[:, col].argmax()
pos = hs[i]
print(f'{{ position: [{pos[0]:.3f}, {pos[1]:.3f}, {pos[2]:.3f}] }}  // {which}({axis}) — analytically exact, no picking involved')
