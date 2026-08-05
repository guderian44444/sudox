"""Remove paper backgrounds from friend stickers + dance/faint animations.

Uses edge-seeded flood fill so interior white (panda face, sheep wool, etc.)
stays opaque. Outputs:
  - public/assets/friends/{id}.png           (RGBA stickers)
  - public/assets/friends-dance/{id}_{1-4}.webp
  - public/assets/friends-faint/{id}.webp     (if source present)
"""
from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
SRC_STICKERS = ROOT / "preview" / "friends-set"
SRC_DANCE = ROOT / "preview" / "friends-dance"
SRC_FAINT = ROOT / "preview" / "friends-faint"
OUT_STICKERS = ROOT / "public" / "assets" / "friends"
OUT_DANCE = ROOT / "public" / "assets" / "friends-dance"
OUT_FAINT = ROOT / "public" / "assets" / "friends-faint"

ANIMAL_IDS = [
    "cat", "dog", "mouse", "hamster", "rabbit", "fox", "bear", "panda",
    "koala", "tiger", "lion", "frog", "pig", "cow", "monkey", "chicken",
    "penguin", "whale", "dolphin", "owl", "duck", "horse", "deer", "sheep",
    "otter",
]


def is_background_color(r: int, g: int, b: int) -> bool:
    """Paper / compressed off-white — not black ink, not fur colors."""
    if r < 45 and g < 45 and b < 45:
        return False
    # pure / near white
    if min(r, g, b) >= 242:
        return True
    # warm paper (JPEG / GIF compression)
    if r >= 225 and g >= 222 and b >= 200 and abs(r - g) <= 30 and (r + g + b) >= 680:
        return True
    # cool light gray paper
    if r >= 215 and g >= 215 and b >= 215 and max(r, g, b) - min(r, g, b) <= 28:
        return True
    # very light with slight color cast
    if min(r, g, b) >= 230 and max(r, g, b) >= 245 and max(r, g, b) - min(r, g, b) <= 35:
        return True
    return False


def flood_clear_background(rgba: Image.Image, seed_bottom: bool = True) -> Image.Image:
    im = rgba.convert("RGBA").copy()
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if a < 10 or is_background_color(r, g, b):
            visited[y][x] = True
            q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        if seed_bottom:
            try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r, g, b, a = px[nx, ny]
                if a < 10 or is_background_color(r, g, b):
                    visited[ny][nx] = True
                    q.append((nx, ny))
    return im


def soft_edge_alpha(rgba: Image.Image, radius: int = 1) -> Image.Image:
    """Slightly feather hard cut edges without eating the body."""
    if radius <= 0:
        return rgba
    im = rgba.convert("RGBA")
    # Only clean near-white residual pixels that are already semi-transparent-ish neighbors
    w, h = im.size
    px = im.load()
    # one pass: if nearly white and majority of 4-neighbors are transparent → clear
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8 or not is_background_color(r, g, b):
                continue
            transparent_n = 0
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < 16:
                    transparent_n += 1
            if transparent_n >= 2:
                px[x, y] = (0, 0, 0, 0)
    return im


def process_sticker(src: Path, dest: Path) -> dict:
    with Image.open(src) as im:
        out = soft_edge_alpha(flood_clear_background(im.convert("RGBA")))
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, format="PNG", optimize=True)
    data = list(out.getdata())
    transparent = sum(1 for *_, a in data if a < 16)
    corner = out.getpixel((2, 2))
    center = out.getpixel((out.width // 2, out.height // 2))
    info = {
        "file": dest.name,
        "size": dest.stat().st_size,
        "transparent_ratio": round(transparent / max(1, len(data)), 3),
        "corner_a": corner[3],
        "center_a": center[3],
    }
    if corner[3] > 20:
        raise SystemExit(f"Sticker corner not transparent: {info}")
    if center[3] < 200:
        raise SystemExit(f"Sticker body too transparent: {info}")
    if transparent < len(data) * 0.15:
        raise SystemExit(f"Sticker not enough background removed: {info}")
    return info


def frames_from_image(src: Path) -> tuple[list[Image.Image], list[int]]:
    frames: list[Image.Image] = []
    durations: list[int] = []
    with Image.open(src) as im:
        if getattr(im, "is_animated", False) or getattr(im, "n_frames", 1) > 1:
            for frame in ImageSequence.Iterator(im):
                frames.append(frame.convert("RGBA"))
                durations.append(max(40, int(frame.info.get("duration", 80))))
        else:
            frames.append(im.convert("RGBA"))
            durations.append(100)
    return frames, durations


def save_animated_webp(frames: list[Image.Image], durations: list[int], dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Cap resolution for game toast size
    scaled: list[Image.Image] = []
    for frame in frames:
        f = frame
        if max(f.size) > 220:
            f = f.copy()
            f.thumbnail((220, 220), Image.Resampling.LANCZOS)
        scaled.append(f)
    scaled[0].save(
        dest,
        format="WEBP",
        save_all=True,
        append_images=scaled[1:],
        duration=durations,
        loop=0,
        lossless=False,
        quality=80,
        method=4,
        transparency=0,
    )


def process_animation(src: Path, dest: Path) -> dict:
    frames, durations = frames_from_image(src)
    cleaned = [soft_edge_alpha(flood_clear_background(frame)) for frame in frames]
    save_animated_webp(cleaned, durations, dest)
    sample = cleaned[min(len(cleaned) // 3, len(cleaned) - 1)]
    data = list(sample.getdata())
    transparent = sum(1 for *_, a in data if a < 16)
    corner = sample.getpixel((2, 2))
    # sample a few body-ish points
    cx, cy = sample.width // 2, sample.height // 2
    center = sample.getpixel((cx, cy))
    info = {
        "file": dest.name,
        "size": dest.stat().st_size,
        "frames": len(cleaned),
        "transparent_ratio": round(transparent / max(1, len(data)), 3),
        "corner_a": corner[3],
        "center_a": center[3],
    }
    if corner[3] > 24:
        raise SystemExit(f"Anim corner not transparent: {info}")
    if transparent < len(data) * 0.12:
        raise SystemExit(f"Anim not enough bg removed: {info}")
    return info


def process_stickers(ids: list[str]) -> None:
    print("=== stickers ===")
    for animal_id in ids:
        src = SRC_STICKERS / f"{animal_id}.png"
        if not src.exists():
            print(f"skip missing sticker {animal_id}")
            continue
        dest = OUT_STICKERS / f"{animal_id}.png"
        info = process_sticker(src, dest)
        print(info)


def process_dances(ids: list[str]) -> None:
    print("=== dances ===")
    for animal_id in ids:
        for variant in range(1, 5):
            src = SRC_DANCE / f"{animal_id}_{variant}.gif"
            if not src.exists():
                print(f"skip missing dance {animal_id}_{variant}")
                continue
            dest = OUT_DANCE / f"{animal_id}_{variant}.webp"
            info = process_animation(src, dest)
            print(info)


def process_faints(ids: list[str]) -> None:
    print("=== faints ===")
    OUT_FAINT.mkdir(parents=True, exist_ok=True)
    for animal_id in ids:
        # Prefer GIF/WebP/PNG sources under preview/friends-faint
        candidates = [
            SRC_FAINT / f"{animal_id}.gif",
            SRC_FAINT / f"{animal_id}.webp",
            SRC_FAINT / f"{animal_id}.png",
            SRC_FAINT / f"_{animal_id}.gif",
        ]
        src = next((path for path in candidates if path.exists()), None)
        if not src:
            print(f"skip missing faint {animal_id}")
            continue
        dest = OUT_FAINT / f"{animal_id}.webp"
        info = process_animation(src, dest)
        print(info)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stickers", action="store_true")
    parser.add_argument("--dances", action="store_true")
    parser.add_argument("--faints", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--only", nargs="*", default=None, help="subset of animal ids")
    args = parser.parse_args(argv)

    ids = args.only if args.only else ANIMAL_IDS
    do_all = args.all or not (args.stickers or args.dances or args.faints)
    if do_all or args.stickers:
        process_stickers(ids)
    if do_all or args.dances:
        process_dances(ids)
    if do_all or args.faints:
        process_faints(ids)
    print("done")


if __name__ == "__main__":
    main(sys.argv[1:])
