from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
COS_HOST = "tzyy-1330068502.cos.ap-beijing.myqcloud.com"

# aboutPreviewAssets.js is allowed to name the COS host because naming it is the
# whole point of the module: it rewrites that origin to the same-origin /cos/
# proxy in the about-preview markup. Its test file asserts on the same constant.
# Every other frontend file must go through /cos/ so assets follow the site's
# own origin instead of reaching a third-party host directly.
ALLOWED = {
    "main/src/pages/aboutPreviewAssets.js",
    "main/src/pages/aboutPreviewAssets.test.js",
}


class FrontendAssetProxyTests(unittest.TestCase):
    def test_frontend_uses_same_origin_cos_proxy(self):
        checked_paths = [ROOT / "main" / "index.html"]
        checked_paths.extend((ROOT / "main" / "src").rglob("*"))

        offenders = []
        for path in checked_paths:
            if not path.is_file() or path.suffix not in {".html", ".js", ".jsx", ".ts", ".tsx"}:
                continue
            relative = path.relative_to(ROOT).as_posix()
            if relative in ALLOWED:
                continue
            if COS_HOST in path.read_text(encoding="utf-8"):
                offenders.append(relative)

        self.assertEqual([], offenders, "frontend assets should use /cos/ instead of direct COS URLs")

    def test_the_allowed_files_still_exist_and_still_rewrite_to_the_proxy(self):
        # If the exception outlives the reason for it, the allowlist silently
        # stops protecting anything — so pin the reason down.
        source = (ROOT / "main" / "src" / "pages" / "aboutPreviewAssets.js").read_text(encoding="utf-8")

        self.assertIn(COS_HOST, source)
        self.assertIn('"/cos/"', source)


if __name__ == "__main__":
    unittest.main()
