#!/usr/bin/env python3
"""
Orthographic point-cloud renderer for a hotspot-space vertex array (no
triangles, no lighting — a depth-shaded point splat). Dense enough at
~200-300k points to read as a solid surface at 760px, which is all this needs
to be: a way to *see* the real geometry well enough to pick a landmark.

Also writes a per-view <name>-idx.npy: for every pixel, the index of the real
vertex that's visible there (the z-buffer winner). pick.py uses this to turn
a pixel you choose into an exact, real 3D coordinate — never a guess.

Usage: python3 render_views.py <hotspot_space_verts.npy> <out_prefix>
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

def render(verts, axis_from, axis_up, size=760, point_radius=1):
    forward = np.array(axis_from, dtype=np.float32); forward /= np.linalg.norm(forward)
    up = np.array(axis_up, dtype=np.float32)
    right = np.cross(up, forward); right /= np.linalg.norm(right)
    up2 = np.cross(forward, right)

    x, y, z = verts @ right, verts @ up2, verts @ forward

    pad = 0.06
    xr, yr = (x.max() - x.min()) or 1, (y.max() - y.min()) or 1
    scale = (1 - 2 * pad) * size / max(xr, yr)
    cx = size / 2 - scale * (x.min() + x.max()) / 2
    cy = size / 2 - scale * (y.min() + y.max()) / 2
    px = (x * scale + cx).astype(np.int32)
    py = (size - (y * scale + cy)).astype(np.int32)

    zbuf = np.full((size, size), -np.inf, dtype=np.float32)
    img = np.zeros((size, size), dtype=np.uint8)
    idxbuf = np.full((size, size), -1, dtype=np.int32)

    vidx = np.arange(len(verts))
    valid = (px >= 0) & (px < size) & (py >= 0) & (py < size)
    px, py, z, vidx = px[valid], py[valid], z[valid], vidx[valid]
    zmin, zmax = z.min(), z.max()
    shade = ((z - zmin) / (zmax - zmin + 1e-9) * 200 + 55).astype(np.uint8)

    for dx in range(-point_radius, point_radius + 1):
        for dy in range(-point_radius, point_radius + 1):
            qx, qy = np.clip(px + dx, 0, size - 1), np.clip(py + dy, 0, size - 1)
            better = z > zbuf[qy, qx]
            zbuf[qy[better], qx[better]] = z[better]
            img[qy[better], qx[better]] = shade[better]
            idxbuf[qy[better], qx[better]] = vidx[better]

    out = np.full((size, size, 3), 24, dtype=np.uint8)
    mask = img > 0
    out[mask] = np.stack([img[mask]] * 3, axis=-1)
    return Image.fromarray(out), idxbuf

VIEWS = {
    "front": ((0, 0, 1), (0, 1, 0)), "back": ((0, 0, -1), (0, 1, 0)),
    "left": ((-1, 0, 0), (0, 1, 0)), "right": ((1, 0, 0), (0, 1, 0)),
    "top": ((0, 1, 0), (0, 0, -1)), "bottom": ((0, -1, 0), (0, 0, 1)),
}

def add_grid(img, step=50):
    img = img.copy()
    draw = ImageDraw.Draw(img)
    size = img.size[0]
    for i in range(0, size, step):
        draw.line([(i, 0), (i, size)], fill=(255, 80, 80), width=1)
        draw.line([(0, i), (size, i)], fill=(255, 80, 80), width=1)
        draw.text((i + 2, 2), str(i), fill=(255, 220, 80))
        draw.text((2, i + 2), str(i), fill=(255, 220, 80))
    return img

if __name__ == "__main__":
    verts_path, out_prefix = sys.argv[1], sys.argv[2]
    verts = np.load(verts_path)
    for name, (fwd, up) in VIEWS.items():
        img, idxbuf = render(verts, fwd, up)
        img.save(f"{out_prefix}-{name}.png")
        add_grid(img).save(f"{out_prefix}-{name}-grid.png")
        np.save(f"{out_prefix}-{name}-idx.npy", idxbuf)
    print(f"wrote 6 views (+ gridded + index buffers) for {out_prefix}")
