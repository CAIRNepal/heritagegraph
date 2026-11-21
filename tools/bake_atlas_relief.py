#!/usr/bin/env python3
"""Bake the Heritage Atlas basemap: shaded relief and an elevation grid.

Downloads public elevation tiles (AWS Terrain Tiles, Terrarium encoding,
derived from SRTM and other public sources) and writes, under
heritage_graph_ui/public/atlas/:

  nepal-relief.jpg   shaded relief of Nepal, Web Mercator, for L.imageOverlay
  valley-relief.jpg  the same for the Kathmandu Valley, at higher resolution
  relief.json        image bounds, plus elevation grids (metres, uint16,
                     base64) for Nepal (~2 km) and the valley (~200 m) so the
                     page can give any place an altitude without a server

    python tools/bake_atlas_relief.py      # needs numpy and Pillow

Run again only if the extents or resolutions change.
"""

from __future__ import annotations

import base64
import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
OUT = Path(__file__).resolve().parent.parent / "heritage_graph_ui/public/atlas"

# west, east, south, north
NEPAL = (79.8, 88.5, 26.2, 30.6)
VALLEY = (85.20, 85.56, 27.58, 27.80)


def merc_y(lat: float) -> float:
    return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2


_cache: dict[tuple[int, int, int], np.ndarray] = {}


def tile(z: int, x: int, y: int) -> np.ndarray:
    key = (z, x, y)
    if key not in _cache:
        with urllib.request.urlopen(TILE_URL.format(z=z, x=x, y=y), timeout=60) as r:
            a = np.asarray(Image.open(io.BytesIO(r.read())).convert("RGB")).astype(np.float32)
        _cache[key] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
    return _cache[key]


def sample(z: int, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """Elevation (m) at each (lat, lon), nearest pixel of zoom-z tiles."""
    n = 2**z
    fx = (lons + 180) / 360 * n
    fy = np.vectorize(merc_y)(lats) * n
    out = np.zeros(lats.shape, dtype=np.float32)
    tx, ty = fx.astype(int), fy.astype(int)
    for x in np.unique(tx):
        for y in np.unique(ty[tx == x]):
            m = (tx == x) & (ty == y)
            t = tile(z, int(x), int(y))
            px = np.clip(((fx[m] - x) * 256).astype(int), 0, 255)
            py = np.clip(((fy[m] - y) * 256).astype(int), 0, 255)
            out[m] = t[py, px]
    return np.maximum(out, 0)


def relief(box, z: int, width: int, path: Path) -> dict:
    w, e, s, nth = box
    yn, ys = merc_y(nth), merc_y(s)
    height = round(width * (ys - yn) / ((e - w) / 360))
    lons = w + (np.arange(width) + 0.5) / width * (e - w)
    # Rows evenly spaced in Mercator Y, so the image lines up with the map exactly.
    my = yn + (np.arange(height) + 0.5) / height * (ys - yn)
    lats = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * my))))
    LAT, LON = np.meshgrid(lats, lons, indexing="ij")
    el = sample(z, LAT, LON)
    mx = (e - w) / width * 111320 * math.cos(math.radians((s + nth) / 2))
    mys = np.gradient(lats) * -110570
    gy, gx = np.gradient(el)
    gx, gy = gx / mx, gy / mys[:, None]
    slope = np.arctan(np.hypot(gx, gy) * 1.6)
    aspect = np.arctan2(-gx, gy)
    az, alt = math.radians(315), math.radians(45)
    shade = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
    t = np.clip(el / 6000, 0, 1)[..., None]
    low, mid, high = np.array([214, 224, 208]), np.array([226, 224, 214]), np.array([246, 246, 244])
    base = np.where(t < 0.4, low + (mid - low) * (t / 0.4), mid + (high - mid) * ((t - 0.4) / 0.6))
    rgb = np.clip(base * (0.62 + 0.48 * shade[..., None]), 0, 255).astype(np.uint8)
    Image.fromarray(rgb).save(path, "JPEG", quality=74, optimize=True)
    print(f"wrote {path.name} {width}x{height} ({path.stat().st_size // 1024} KB)")
    return {"image": path.name, "bounds": [[s, w], [nth, e]]}


def grid(box, step: float, z: int) -> dict:
    w, e, s, nth = box
    cols = round((e - w) / step) + 1
    rows = round((nth - s) / step) + 1
    lats = nth - np.arange(rows) * step
    lons = w + np.arange(cols) * step
    LAT, LON = np.meshgrid(lats, lons, indexing="ij")
    el = np.clip(np.round(sample(z, LAT, LON)), 0, 65535).astype("<u2")
    print(f"grid {cols}x{rows} at {step}°, {int(el.min())}-{int(el.max())} m")
    return {"west": w, "north": nth, "step": step, "cols": cols, "rows": rows, "metres": base64.b64encode(el.tobytes()).decode()}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {
        "source": "AWS Terrain Tiles (Terrarium), SRTM-derived; border: Natural Earth",
        "nepal": relief(NEPAL, 8, 1600, OUT / "nepal-relief.jpg"),
        "valley": relief(VALLEY, 12, 1600, OUT / "valley-relief.jpg"),
        "elevation": {"nepal": grid(NEPAL, 0.02, 8), "valley": grid(VALLEY, 0.002, 12)},
    }
    (OUT / "relief.json").write_text(json.dumps(meta, separators=(",", ":")) + "\n")
    print(f"wrote relief.json ({(OUT / 'relief.json').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
