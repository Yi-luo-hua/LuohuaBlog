"""The about page's webfonts are generated, so nothing in the editor catches a
half-finished build. These tests pin the three ways it can silently break:
a rule pointing at a file that was never written, a face the page no longer
asks for, and a stray file nothing references."""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
FONT_CSS = ROOT / "main" / "src" / "pages" / "aboutFonts.css"
PAGE_CSS = ROOT / "main" / "src" / "pages" / "AboutSitePage.css"
PUBLIC = ROOT / "main" / "public"

# Nunito carries the Latin, WenKai the Chinese; the page names them in that
# order so each script is drawn by the face that was chosen for it.
FAMILIES = ("Nunito", "LXGW WenKai")


def font_rules():
    css = FONT_CSS.read_text(encoding="utf-8")
    return re.findall(r"@font-face\s*\{(.*?)\}", css, re.S)


def referenced_urls():
    return set(re.findall(r'url\("(/fonts/[^"]+)"\)', FONT_CSS.read_text(encoding="utf-8")))


class AboutFontsTests(unittest.TestCase):
    def test_every_rule_points_at_a_file_that_exists(self):
        missing = [url for url in referenced_urls()
                   if not (PUBLIC / url.lstrip("/")).is_file()]
        self.assertEqual([], missing, "aboutFonts.css names woff2 files that were never built")

    def test_no_font_file_is_shipped_without_a_rule_to_load_it(self):
        referenced = referenced_urls()
        orphans = [
            "/" + path.relative_to(PUBLIC).as_posix()
            for directory in ("fonts/lxgw", "fonts/nunito")
            for path in sorted((PUBLIC / directory).glob("*.woff2"))
            if "/" + path.relative_to(PUBLIC).as_posix() not in referenced
        ]
        self.assertEqual([], orphans, "these woff2 files are deployed but never loaded")

    def test_every_rule_carries_a_unicode_range_so_slices_stay_lazy(self):
        # Without unicode-range a browser downloads every slice on the first
        # Chinese character, which is the whole point of slicing it up.
        without = [rule for rule in font_rules() if "unicode-range" not in rule]
        self.assertEqual([], without, "a @font-face without unicode-range defeats the slicing")

    def test_both_weights_of_the_chinese_face_are_present(self):
        weights = {
            match.group(1)
            for rule in font_rules() if "LXGW WenKai" in rule
            for match in [re.search(r"font-weight:\s*(\d+)", rule)] if match
        }
        self.assertEqual({"400", "500"}, weights)

    def test_the_page_asks_for_the_faces_that_were_built(self):
        page = PAGE_CSS.read_text(encoding="utf-8")
        stack = re.search(r"\.about-desk-page\s*\{.*?font-family:([^;]+);", page, re.S)
        self.assertIsNotNone(stack, "the about page no longer sets a font-family")
        for family in FAMILIES:
            self.assertIn(family, stack.group(1))

    def test_synthesis_is_off_so_wenkai_is_not_faked_into_a_bold(self):
        # WenKai ships Regular and Medium only. This file asks for weights up to
        # 900; without this the browser smears Medium into a fake bold.
        page = PAGE_CSS.read_text(encoding="utf-8")
        self.assertRegex(page, r"font-synthesis-weight:\s*none")


if __name__ == "__main__":
    unittest.main()
