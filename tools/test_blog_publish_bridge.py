"""Guards for the Obsidian -> blog publishing bridge.

Images used to be POSTed to a third-party image host and referenced by the URL
it returned, which put every picture in the blog outside this project's control
and left no local copy. They are committed into the repository now, so these
tests pin down the parts that would silently undo that.
"""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "integrations" / "claudian-blog-mcp" / "server.mjs"


class BlogPublishBridgeTests(unittest.TestCase):
    def setUp(self):
        self.source = SERVER.read_text(encoding="utf-8")

    def test_targets_the_current_repository(self):
        # The repository was renamed from taozhiyy to LuohuaBlog; publishing to
        # the old default would 404 against a repository that no longer exists.
        self.assertIn('BLOG_GITHUB_REPO || "LuohuaBlog"', self.source)
        self.assertNotIn('"taozhiyy"', self.source)

    def test_does_not_post_images_to_a_third_party_host(self):
        for gone in ("scdn.io", "BLOG_IMAGE_HOST_ENDPOINT", "uploadImage", "FormData"):
            self.assertNotIn(gone, self.source, f"{gone} should be gone")

    def test_commits_images_into_the_blog_source_tree(self):
        self.assertIn('blogImageDir = "blog/source/images"', self.source)
        self.assertIn('blogImagePrefix = "/blog/images"', self.source)
        self.assertIn("commitLocalAssets", self.source)

    def test_image_names_are_content_addressed_so_republishing_is_idempotent(self):
        self.assertIn("createHash", self.source)
        self.assertIn("repoFileExists", self.source)

    def test_hexo_still_copies_that_directory_verbatim(self):
        # blog/source/images only reaches the site because Hexo copies files it
        # cannot render. Turning on post_asset_folder or adding a skip_render /
        # exclude rule for images would break every published image silently.
        config = (ROOT / "blog" / "_config.yml").read_text(encoding="utf-8")

        self.assertIn("post_asset_folder: false", config)
        for line in config.splitlines():
            # Only the top-level keys govern which files get copied; the
            # indented exclude under external_link is about link rendering.
            if line[:1].isspace() or not line.startswith(("skip_render:", "exclude:", "ignore:")):
                continue
            value = line.split(":", 1)[1].strip().strip("'\"")
            self.assertEqual(
                value, "",
                f"{line.strip()} must stay empty or blog/source/images stops being copied",
            )

    def test_supports_automatic_deployment_by_default(self):
        readme = (ROOT / "integrations" / "claudian-blog-mcp" / "README.md").read_text(encoding="utf-8")

        self.assertIn("deploy-azure.sh blog", self.source)
        self.assertIn("runDeployBlog", self.source)
        self.assertIn("syncLocalFilesystem", self.source)
        self.assertIn("deploy-azure.sh blog", readme)

    def test_supports_article_update_and_deletion(self):
        readme = (ROOT / "integrations" / "claudian-blog-mcp" / "README.md").read_text(encoding="utf-8")

        self.assertIn("delete_blog_post", self.source)
        self.assertIn("deleteNote", self.source)
        self.assertIn("getFileShaFromGitHub", self.source)
        self.assertIn("delete_blog_post", readme)


if __name__ == "__main__":
    unittest.main()
