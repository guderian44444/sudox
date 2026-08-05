"""Garden-eel peek WebP with real alpha.

Eels touch the bottom edge, so background flood must NOT seed from the bottom
(or white body stripes would be eaten). Seeds top + left/right only.
"""
from __future__ import annotations

import subprocess
from collections import deque
from pathlib import Path

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
DANCE = ROOT / "preview" / "friends-dance"
PUB = ROOT / "public" / "assets"
PREVIEW = ROOT / "preview"


def is_background_color(r: int, g: int, b: int) -> bool:
    """True for paper / compressed white-ish background, not orange/black ink."""
    # black outline
    if r < 40 and g < 40 and b < 40:
        return False
    # orange body (garden eel orange)
    if r > 180 and g > 60 and g < 210 and b < 120:
        return False
    # pure / near white
    if min(r, g, b) >= 245:
        return True
    # compressed off-white / warm paper (high R&G, B may drop)
    if r >= 230 and g >= 230 and b >= 160 and abs(r - g) <= 25:
        return True
    # light cool paper
    if r >= 210 and g >= 210 and b >= 210 and max(r, g, b) - min(r, g, b) <= 40:
        return True
    return False


def flood_clear_background(rgba: Image.Image) -> Image.Image:
    im = rgba.convert("RGBA").copy()
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if a < 8 or is_background_color(r, g, b):
            visited[y][x] = True
            q.append((x, y))

    # Seed TOP edge and upper sides only — never bottom (eel emerges there).
    for x in range(w):
        try_seed(x, 0)
    for y in range(min(h // 3, 24)):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r, g, b, a = px[nx, ny]
                if a < 8 or is_background_color(r, g, b):
                    visited[ny][nx] = True
                    q.append((nx, ny))
    return im


def process(mp4: Path, dest: Path) -> dict:
    raw = dest.with_suffix(".tmp.gif")
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-ss", "0", "-t", "2.4",
            "-i", str(mp4),
            "-vf", "fps=12,scale=96:-1:flags=lanczos",
            str(raw),
        ],
        check=True,
        capture_output=True,
    )

    frames: list[Image.Image] = []
    durations: list[int] = []
    with Image.open(raw) as im:
        for frame in ImageSequence.Iterator(im):
            frames.append(flood_clear_background(frame.convert("RGBA")))
            durations.append(max(40, int(frame.info.get("duration", 80))))
    try:
        raw.unlink(missing_ok=True)
    except OSError:
        pass

    frames[0].save(
        dest,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        lossless=True,
        quality=80,
        method=4,
    )

    sample = frames[min(5, len(frames) - 1)]
    data = list(sample.getdata())
    transparent = sum(1 for *_, a in data if a < 16)
    corner = sample.getpixel((0, 0))
    center = sample.getpixel((sample.width // 2, sample.height // 3))
    sample.save(PREVIEW / f"{dest.stem}-final.png")
    info = {
        "name": dest.name,
        "size": dest.stat().st_size,
        "frames": len(frames),
        "transparent": transparent,
        "total": len(data),
        "corner": corner,
        "center": center,
    }
    print(info)
    opaque = info["total"] - transparent
    if corner[3] > 16:
        raise SystemExit(f"Corner not transparent: {info}")
    if transparent < info["total"] * 0.2:
        raise SystemExit(f"Too few transparent pixels: {info}")
    if opaque < 200:
        raise SystemExit(f"Eel body mostly gone: {info}")
    info["opaque"] = opaque
    return info


def main() -> None:
    process(DANCE / "_eel_orange.mp4", PUB / "eel-orange.webp")
    process(DANCE / "_eel_white.mp4", PUB / "eel-white.webp")
    print("done")


if __name__ == "__main__":
    main()
