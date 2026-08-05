"""Convert preview/friends-faint/_*.mp4 → transparent webp + gif."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from importlib.machinery import SourceFileLoader

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
mod = SourceFileLoader("friends_t", str(ROOT / "scripts" / "make-friends-transparent.py")).load_module()
SRC = ROOT / "preview" / "friends-faint"
OUT = ROOT / "public" / "assets" / "friends-faint"


def convert(animal: str) -> dict:
    mp4 = SRC / f"_{animal}.mp4"
    if not mp4.exists():
        raise FileNotFoundError(mp4)
    raw = SRC / f"_{animal}.tmp.gif"
    dest = OUT / f"{animal}.webp"
    gif_out = SRC / f"{animal}.gif"
    frame_qa = SRC / f"{animal}_frame.png"
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-ss", "0", "-t", "2.8",
            "-i", str(mp4),
            "-vf", "fps=12,scale=200:-1:flags=lanczos",
            str(raw),
        ],
        check=True,
        capture_output=True,
    )
    frames: list[Image.Image] = []
    durs: list[int] = []
    with Image.open(raw) as im:
        for fr in ImageSequence.Iterator(im):
            frames.append(mod.soft_edge_alpha(mod.flood_clear_background(fr.convert("RGBA"))))
            durs.append(max(50, int(fr.info.get("duration", 80))))
    raw.unlink(missing_ok=True)
    mod.save_animated_webp(frames, durs, dest)
    mid = frames[min(14, len(frames) - 1)]
    mid.save(frame_qa)
    frames[0].save(gif_out, save_all=True, append_images=frames[1:], duration=durs, loop=0, disposal=2)
    info = {
        "animal": animal,
        "frames": len(frames),
        "kb": dest.stat().st_size // 1024,
        "corner_a": frames[0].getpixel((2, 2))[3],
    }
    print(info)
    return info


def main() -> None:
    animals = sys.argv[1:] if len(sys.argv) > 1 else [
        p.name[1:-4] for p in sorted(SRC.glob("_*.mp4"))
    ]
    for animal in animals:
        convert(animal)


if __name__ == "__main__":
    main()
