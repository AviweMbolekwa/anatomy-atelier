#!/usr/bin/env python3
"""
Builds public/models/stomach.glb procedurally: no 3D-generator licence, no
download, fully reproducible (fixed seed).

The stomach is a hollow, mostly planar sac, which makes it one of the few
organs a sweep can describe honestly: a J-shaped centreline from the fundus
dome down the body and antrum, through the narrow pylorus into the
duodenum's C-loop, with an elliptical cross-section that bulges on the
greater curvature. The oesophagus is a second sweep that enters at the
cardia. Colour and surface detail (mottling, the vessel arcades along both
curvatures) are painted into a texture rather than modelled.

Front view is +z, patient's left is +x — the same orientation the other
specimens use, so the stomach sits the way it would in the body.

Usage: python3 scripts/procedural/stomach.py [out.glb]
Requires numpy and Pillow.
"""
import io
import json
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RNG = np.random.default_rng(7)
TEX = 2048

# ---------------------------------------------------------------- centrelines
# x, y, z, in-plane half-width, depth half-width
STOMACH = np.array([
    [0.30, 1.30, -0.10, 0.50, 0.40],   # fundus dome
    [0.55, 0.95, -0.05, 0.62, 0.45],
    [0.68, 0.40, 0.00, 0.62, 0.44],    # body
    [0.58, -0.15, 0.05, 0.58, 0.42],
    [0.25, -0.55, 0.10, 0.50, 0.38],
    [-0.20, -0.68, 0.10, 0.40, 0.33],  # antrum
    [-0.55, -0.55, 0.08, 0.29, 0.26],
    [-0.78, -0.42, 0.05, 0.16, 0.15],  # pylorus
    [-0.95, -0.48, 0.02, 0.21, 0.20],  # duodenal bulb
    [-1.12, -0.75, 0.00, 0.19, 0.19],
    [-1.12, -1.10, -0.02, 0.19, 0.19],
    [-0.90, -1.32, -0.02, 0.19, 0.19],
    [-0.60, -1.38, 0.00, 0.19, 0.19],  # cut end
])
PYLORUS_INDEX = 7

OESOPHAGUS = np.array([
    [-0.15, 2.00, -0.05, 0.13, 0.13],
    [-0.10, 1.55, -0.05, 0.13, 0.13],
    [0.00, 1.18, -0.03, 0.15, 0.15],
    [0.14, 0.98, -0.02, 0.21, 0.20],   # flares into the cardia
    [0.32, 0.80, 0.00, 0.26, 0.24],    # buried inside the body
])


def catmull_rom(points, samples):
    """Uniform Catmull-Rom through every control row, resampled by arc length."""
    pts = np.vstack([2 * points[0] - points[1], points, 2 * points[-1] - points[-2]])
    dense = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for t in np.linspace(0, 1, 60, endpoint=False):
            t2, t3 = t * t, t * t * t
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                                + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    dense.append(points[-1])
    dense = np.array(dense)
    seg = np.linalg.norm(np.diff(dense[:, :3], axis=0), axis=1)
    arc = np.concatenate([[0], np.cumsum(seg)])
    target = np.linspace(0, arc[-1], samples)
    out = np.stack([np.interp(target, arc, dense[:, k]) for k in range(dense.shape[1])], axis=1)
    # arc-length fraction where each control point lands, for texture painting
    knots = [np.interp(np.argmin(np.linalg.norm(dense[:, :3] - p[:3], axis=1)), np.arange(len(arc)), arc) / arc[-1]
             for p in points]
    return out, arc[-1], np.array(knots)


def frames(center):
    tangent = np.gradient(center, axis=0)
    tangent /= np.linalg.norm(tangent, axis=1, keepdims=True)
    normal = np.stack([-tangent[:, 1], tangent[:, 0], np.zeros(len(tangent))], axis=1)
    normal /= np.linalg.norm(normal, axis=1, keepdims=True)
    binormal = np.cross(tangent, normal)
    binormal /= np.linalg.norm(binormal, axis=1, keepdims=True)
    normal = np.cross(binormal, tangent)
    return tangent, normal, binormal


def organic(p, amplitude):
    """Smooth low-frequency wobble so the surface isn't machine-perfect."""
    rng = np.random.default_rng(11)
    total = np.zeros(len(p))
    for _ in range(6):
        k = rng.normal(size=3)
        k = k / np.linalg.norm(k) * rng.uniform(1.5, 4.0)
        total += np.sin(p @ k + rng.uniform(0, 2 * np.pi))
    return total / 6 * amplitude


def sweep(rows, samples, ring, v0, v1, dome_fraction=0.0, bulge_until=None, open_end=True, open_start=False):
    """Positions, uvs and triangle indices for one swept tube (+ lips on open ends)."""
    line, length, knots = catmull_rom(rows, samples)
    center, width, depth = line[:, :3], line[:, 3], line[:, 4]
    tangent, normal, binormal = frames(center)
    s = np.linspace(0, 1, samples)

    if dome_fraction:
        d = np.clip(s / dome_fraction, 0, 1)
        dome = np.sqrt(1 - (1 - d) ** 2)
        width, depth = width * dome, depth * dome

    phi = np.linspace(0, 2 * np.pi, ring + 1)            # seam at the back
    a = phi - np.pi / 2
    cos_a, sin_a = np.cos(a), np.sin(a)
    positions = np.zeros((samples, ring + 1, 3))
    for i in range(samples):
        w = np.full(ring + 1, width[i])
        if bulge_until is not None and s[i] < bulge_until:
            fade = 1 - np.clip((s[i] - bulge_until + 0.08) / 0.08, 0, 1)
            w = w * (1 + 0.16 * fade * np.clip(cos_a, 0, None))   # greater curvature
            w = w * (1 - 0.10 * fade * np.clip(-cos_a, 0, None))  # flatter lesser curvature
        positions[i] = (center[i] + normal[i] * (w * cos_a)[:, None]
                        + binormal[i] * (depth[i] * sin_a)[:, None])
    flat = positions.reshape(-1, 3)
    radial = flat - np.repeat(center, ring + 1, axis=0)
    radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
    flat += radial * organic(flat, 0.018)[:, None]
    positions = flat.reshape(samples, ring + 1, 3)

    uv = np.zeros((samples, ring + 1, 2))
    uv[..., 0] = s[:, None]
    uv[..., 1] = v0 + (v1 - v0) * (phi / (2 * np.pi))[None, :]

    verts, uvs, tris = [positions.reshape(-1, 3)], [uv.reshape(-1, 2)], []
    stride = ring + 1
    for i in range(samples - 1):
        for j in range(ring):
            a0, b0 = i * stride + j, (i + 1) * stride + j
            tris.append([a0, a0 + 1, b0])
            tris.append([a0 + 1, b0 + 1, b0])
    count = samples * stride

    def lip(index, inward):
        """Rim + short recessed inner wall + dark floor, so a cut end reads as a tube."""
        nonlocal count
        rim = positions[index]
        c = center[index]
        direction = -tangent[index] if inward < 0 else tangent[index]
        rings = [rim + (c - rim) * 0.22,                          # rim face
                 rim + (c - rim) * 0.22 + direction * 0.10,       # inner wall
                 np.repeat(c[None] + direction * 0.10, ring + 1, axis=0)]
        start = count
        for r in rings:
            verts.append(r)
            uvs.append(np.column_stack([np.full(ring + 1, s[index]), uv[index, :, 1]]))
            count += ring + 1
        base = index * stride
        layers = [base, start, start + stride, start + 2 * stride]
        for k in range(3):
            for j in range(ring):
                p, q = layers[k] + j, layers[k + 1] + j
                # winding faces the opening, whichever end this is
                if inward > 0:
                    tris.append([p, q, p + 1]); tris.append([p + 1, q, q + 1])
                else:
                    tris.append([p, p + 1, q]); tris.append([p + 1, q + 1, q])

    if open_end:
        lip(samples - 1, inward=-1)
    if open_start:
        lip(0, inward=1)
    return np.vstack(verts), np.vstack(uvs), np.array(tris), knots


# ------------------------------------------------------------------- texture
def value_noise(width, height, cells, rng):
    """Value noise that wraps vertically, so the seam down the back is invisible."""
    rows = max(2, int(round(cells * height / width)))
    grid = rng.random((rows, cells + 1))
    grid = np.vstack([grid[-2:], grid, grid[:3]])          # wrap for the bicubic kernel
    img = Image.fromarray((grid * 255).astype(np.uint8))
    scale = height / rows
    big = img.resize((width, int(round(len(grid) * scale))), Image.BICUBIC)
    top = int(round(2 * scale))
    return np.asarray(big, dtype=np.float32)[top:top + height] / 255


def paint(knots_main, main_height):
    rng = np.random.default_rng(3)
    h = TEX
    vm = main_height  # rows [0, vm) belong to the stomach + duodenum sweep

    def band(rows):
        n = (value_noise(h, rows, 8, rng) * 0.5 + value_noise(h, rows, 32, rng) * 0.3
             + value_noise(h, rows, 128, rng) * 0.2)
        fine = value_noise(h, rows, 384, rng)
        return n, fine

    n_main, f_main = band(vm)
    n_oes, f_oes = band(h - vm)
    n, fine = np.vstack([n_main, n_oes]), np.vstack([f_main, f_oes])
    base = np.array([210, 92, 88], np.float32)
    light = np.array([240, 148, 136], np.float32)
    dark = np.array([168, 52, 56], np.float32)
    col = base + (light - base) * np.clip(n - 0.45, 0, 1)[..., None] * 1.7 \
        - (base - dark) * np.clip(0.45 - n, 0, 1)[..., None] * 1.5
    col += (fine[..., None] - 0.5) * 18
    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
    height = Image.fromarray((fine * 70).astype(np.uint8))
    draw, hdraw = ImageDraw.Draw(img), ImageDraw.Draw(height)
    stomach_end = knots_main[PYLORUS_INDEX]

    def walk(x, y, dx, dy, steps, width, colour, wobble=0.35, taper=0.985, branch=0.0, depth=0):
        for _ in range(steps):
            ang = np.arctan2(dy, dx) + rng.normal(0, wobble)
            dx, dy = np.cos(ang), np.sin(ang)
            nx, ny = x + dx * 9, y + dy * 9
            if not (0 <= ny < vm and 0 <= nx < h):
                return
            draw.line([x, y, nx, ny], fill=colour, width=max(1, int(width)))
            hdraw.line([x, y, nx, ny], fill=255, width=max(1, int(width)))
            x, y, width = nx, ny, width * taper
            if width < 0.8:
                return
            if depth < 3 and rng.random() < branch:
                side = 1 if rng.random() < 0.5 else -1
                walk(x, y, np.cos(ang + side * 1.0), np.sin(ang + side * 1.0), steps // 2,
                     width * 0.65, colour, wobble, taper, branch * 0.7, depth + 1)

    artery, vein, capillary = (190, 30, 36), (112, 70, 146), (198, 70, 70)
    # faint capillary net everywhere
    for _ in range(220):
        walk(rng.uniform(0, h), rng.uniform(0, vm), *rng.normal(size=2), 10, 1.3, capillary, 0.5, 0.96)
    # arcades along both curvatures (v=0.25 greater, v=0.75 lesser), stomach part only
    for v_line, reach in ((0.25, 0.22), (0.75, 0.16)):
        y0 = v_line * vm
        xs = np.linspace(0.06 * h, stomach_end * h, 70)
        ys = y0 + np.cumsum(rng.normal(0, 2.2, len(xs)))
        for colour, offset, width in ((vein, 14, 7), (artery, 0, 8)):
            draw.line(list(zip(xs, ys + offset)), fill=colour, width=width)
            hdraw.line(list(zip(xs, ys + offset)), fill=255, width=width)
        # branches wrapping toward the front and back faces
        for x, y in zip(xs[::3], ys[::3]):
            for side in (-1, 1):
                colour = artery if rng.random() < 0.7 else vein
                walk(x, y + (14 if colour == vein else 0), rng.normal(0, 0.3), side,
                     int(reach * vm / 9), 7.0, colour, 0.18, 0.982, 0.09)
    # a few vessels on the duodenum and oesophagus
    for _ in range(14):
        walk(rng.uniform(stomach_end * h, h), rng.uniform(0, vm), 1, rng.normal(0, 0.4), 30, 3.5, artery, 0.3, 0.97, 0.05)
    for _ in range(10):
        walk(rng.uniform(0, h), rng.uniform(vm, h), 1, rng.normal(0, 0.2), 40, 3.0,
             artery if rng.random() < 0.6 else vein, 0.2, 0.98, 0.0)

    img = img.filter(ImageFilter.GaussianBlur(0.8))
    height = height.filter(ImageFilter.GaussianBlur(2.2))
    # tangent-space normal map from the height field
    hf = np.asarray(height, np.float32) / 255
    gy, gx = np.gradient(hf)
    strength = 6.0
    nrm = np.dstack([-gx * strength, gy * strength, np.ones_like(hf)])
    nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    normal_img = Image.fromarray(((nrm * 0.5 + 0.5) * 255).astype(np.uint8))
    return img, normal_img


# ---------------------------------------------------------------------- glTF
def vertex_normals(pos, tris):
    n = np.zeros_like(pos)
    face = np.cross(pos[tris[:, 1]] - pos[tris[:, 0]], pos[tris[:, 2]] - pos[tris[:, 0]])
    for k in range(3):
        np.add.at(n, tris[:, k], face)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def weld_seams(pos, nrm):
    """Average normals across duplicated seam vertices so no lighting crease shows."""
    keys = np.round(pos, 5)
    _, inverse = np.unique(keys, axis=0, return_inverse=True)
    inverse = inverse.reshape(-1)
    summed = np.zeros((inverse.max() + 1, 3))
    np.add.at(summed, inverse, nrm)
    out = summed[inverse]
    return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-12)


def jpeg(img, quality):
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def write_glb(path, pos, nrm, uv, tris, color_jpg, normal_jpg):
    blobs, views, accessors = [], [], []

    def add(data, target=None):
        offset = sum(len(b) for b in blobs)
        pad = (-len(data)) % 4
        blobs.append(data + b"\0" * pad)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        views.append(view)
        return len(views) - 1

    def accessor(array, ctype, kind, target, minmax=False):
        view = add(array.tobytes(), target)
        acc = {"bufferView": view, "componentType": ctype, "count": len(array), "type": kind}
        if minmax:
            acc["min"], acc["max"] = array.min(axis=0).tolist(), array.max(axis=0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    p = accessor(pos.astype(np.float32), 5126, "VEC3", 34962, True)
    n = accessor(nrm.astype(np.float32), 5126, "VEC3", 34962)
    t = accessor(uv.astype(np.float32), 5126, "VEC2", 34962)
    index_type = (np.uint16, 5123) if len(pos) < 65536 else (np.uint32, 5125)
    i = accessor(tris.reshape(-1).astype(index_type[0]), index_type[1], "SCALAR", 34963)
    c_view, n_view = add(color_jpg), add(normal_jpg)

    gltf = {
        "asset": {"version": "2.0", "generator": "anatomy-atelier scripts/procedural/stomach.py"},
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "stomach"}],
        "meshes": [{"name": "stomach", "primitives": [{
            "attributes": {"POSITION": p, "NORMAL": n, "TEXCOORD_0": t}, "indices": i, "material": 0}]}],
        "materials": [{"name": "stomach-serosa",
                       "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0,
                                                "roughnessFactor": 0.48},
                       "normalTexture": {"index": 1, "scale": 0.8}}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 33071}],
        "images": [{"bufferView": c_view, "mimeType": "image/jpeg"}, {"bufferView": n_view, "mimeType": "image/jpeg"}],
        "textures": [{"sampler": 0, "source": 0}, {"sampler": 0, "source": 1}],
        "accessors": accessors, "bufferViews": views,
        "buffers": [{"byteLength": sum(len(b) for b in blobs)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    binary = b"".join(blobs)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


def build(out):
    main_v = 0.75  # texture rows for the stomach sweep; the rest is the oesophagus
    v1, uv1, t1, knots = sweep(STOMACH, 360, 96, 0.0, main_v, dome_fraction=0.09,
                               bulge_until=0.58, open_end=True)
    v2, uv2, t2, _ = sweep(OESOPHAGUS, 90, 48, main_v, 1.0, open_end=False, open_start=True)
    pos = np.vstack([v1, v2])
    uv = np.vstack([uv1, uv2])
    tris = np.vstack([t1, t2 + len(v1)])
    nrm = weld_seams(pos, vertex_normals(pos, tris))
    color, normal = paint(knots, int(main_v * TEX))
    write_glb(out, pos, nrm, uv, tris, jpeg(color, 86), jpeg(normal, 90))
    print(f"{out}: {len(pos)} vertices, {len(tris)} triangles")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "public/models/stomach.glb")
