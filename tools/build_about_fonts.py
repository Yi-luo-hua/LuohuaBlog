"""Cut the /about page's webfonts and write the @font-face sheet that loads them.

The about page is the only place on the site that uses these two faces:

  Nunito         SIL OFL 1.1 — variable 200..1000, latin + latin-ext
  LXGW WenKai GB SIL OFL 1.1 — Regular + Medium, the whole CJK repertoire

Chinese is far too big to ship in one file, so WenKai is cut into ~100 slices
along Google Fonts' own unicode-range partition for Noto Sans SC, which is
ordered by character frequency. A browser then fetches only the slices that
hold characters the page actually renders — a handful, not the whole font.

The rules are imported with ?url and attached when the about page mounts, so the
~200 @font-face declarations stay out of the bundle every other page loads.

The Google CDN is unreliable from mainland China, where most of this site's
readers are, so every byte is served from our own /fonts/ directory. That is
also why the slicing plan is fetched at build time and baked into the output:
nothing here is fetched at page load.

Run from the repository root, with the two source TTFs alongside:

    python tools/build_about_fonts.py --wenkai-dir <dir holding LXGWWenKaiGB-*.ttf>

Downloads live at https://github.com/lxgw/LxgwWenkaiGB/releases (v1.522).
"""

from __future__ import annotations

import argparse
import hashlib
import pathlib
import re
import subprocess
import sys
import urllib.request

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

# Google publishes Noto Sans SC as ~100 frequency-ordered slices. We borrow the
# partition, not the font: the ranges are a good plan for any CJK face.
SLICE_PLAN_URL = "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400&display=swap"
NUNITO_URL = "https://fonts.googleapis.com/css2?family=Nunito:wght@200..1000&display=swap"
NUNITO_SUBSETS = ("latin", "latin-ext")

WEIGHTS = {"Regular": 400, "Medium": 500}


def fetch(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def parse_faces(css: str) -> list[tuple[str, str, str]]:
    """-> [(label, src url, unicode-range)] in file order.

    Google labels the alphabetic subsets (/* latin */) but leaves the ~97 CJK
    slices uncommented, so a block is matched on its own and the preceding
    comment, when there is one, only supplies the label.
    """
    faces = []
    for match in re.finditer(r"(?:/\*\s*([\w-]+)\s*\*/\s*)?@font-face\s*\{(.*?)\}", css, re.S):
        label, body = match.group(1), match.group(2)
        src = re.search(r"url\((https://[^)\s]+)\)", body)
        rng = re.search(r"unicode-range:\s*([^;]+);", body)
        if src and rng:
            faces.append((label or f"slice-{len(faces)}", src.group(1), rng.group(1).strip()))
    return faces


def subset(src: pathlib.Path, unicodes: str, dest: pathlib.Path) -> int:
    """Cut one slice. Returns the glyph count, so empty slices can be skipped."""
    subprocess.run(
        [sys.executable, "-m", "fontTools.subset", str(src),
         f"--unicodes={unicodes}", "--flavor=woff2", "--layout-features=*",
         "--no-hinting", "--desubroutinize", f"--output-file={dest}"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    from fontTools.ttLib import TTFont
    with TTFont(dest, lazy=True) as f:
        return len(f.getBestCmap())


def content_addressed(path: pathlib.Path) -> pathlib.Path:
    """Fold a hash of the bytes into the name, the way the blog names its images.

    Nothing in public/ is hashed by the bundler, so without this a rebuilt slice
    would keep its old URL and any cache in front of it would keep serving the
    old glyphs.
    """
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:8]
    stem, suffix = path.stem, path.suffix
    final = path.with_name(f"{stem}.{digest}{suffix}")
    path.replace(final)
    return final


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wenkai-dir", required=True, type=pathlib.Path,
                    help="directory holding LXGWWenKaiGB-Regular.ttf and -Medium.ttf")
    ap.add_argument("--root", default=pathlib.Path("."), type=pathlib.Path)
    args = ap.parse_args()

    public = args.root / "main" / "public" / "fonts"
    css_out = args.root / "main" / "src" / "pages" / "aboutFonts.css"
    lxgw_dir, nunito_dir = public / "lxgw", public / "nunito"
    for d in (lxgw_dir, nunito_dir):
        d.mkdir(parents=True, exist_ok=True)
    for stale in list(lxgw_dir.glob("*.woff2")) + list(nunito_dir.glob("*.woff2")):
        stale.unlink()

    rules: list[str] = []

    print("Nunito (latin, latin-ext)")
    for label, url, rng in parse_faces(fetch(NUNITO_URL).decode()):
        if label not in NUNITO_SUBSETS:
            continue
        dest = nunito_dir / f"nunito-{label}.woff2"
        dest.write_bytes(fetch(url))
        dest = content_addressed(dest)
        print(f"  {dest.name:<30} {dest.stat().st_size/1024:6.1f} KB")
        rules.append(
            '@font-face {\n'
            '  font-family: "Nunito";\n'
            '  font-style: normal;\n'
            '  font-weight: 200 1000;\n'
            '  font-display: swap;\n'
            f'  src: url("/fonts/nunito/{dest.name}") format("woff2");\n'
            f'  unicode-range: {rng};\n'
            '}'
        )

    plan = parse_faces(fetch(SLICE_PLAN_URL).decode())
    print(f"\nLXGW WenKai GB — {len(plan)} slices x {len(WEIGHTS)} weights")
    for style, weight in WEIGHTS.items():
        src = args.wenkai_dir / f"LXGWWenKaiGB-{style}.ttf"
        if not src.exists():
            print(f"  !! missing {src}", file=sys.stderr)
            return 1
        kept = total = 0
        for index, (_, _, rng) in enumerate(plan):
            dest = lxgw_dir / f"lxgw-{weight}-{index}.woff2"
            if subset(src, rng.replace(" ", ""), dest) == 0:
                dest.unlink()          # this face covers nothing in that range
                continue
            dest = content_addressed(dest)
            kept += 1
            total += dest.stat().st_size
            rules.append(
                '@font-face {\n'
                '  font-family: "LXGW WenKai";\n'
                '  font-style: normal;\n'
                f'  font-weight: {weight};\n'
                '  font-display: swap;\n'
                f'  src: url("/fonts/lxgw/{dest.name}") format("woff2");\n'
                f'  unicode-range: {rng};\n'
                '}'
            )
        print(f"  {style:<8} weight {weight}   {kept}/{len(plan)} slices   {total/1048576:5.1f} MB")

    css_out.write_text(
        "/* Generated by tools/build_about_fonts.py — do not edit by hand.\n"
        "   Nunito and LXGW WenKai GB are both SIL OFL 1.1. Self-hosted on purpose:\n"
        "   the Google Fonts CDN is unreliable from mainland China, where most of\n"
        "   this site's readers are. */\n\n" + "\n".join(rules) + "\n",
        encoding="utf-8",
    )
    print(f"\n{len(rules)} @font-face rules -> {css_out} ({css_out.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
