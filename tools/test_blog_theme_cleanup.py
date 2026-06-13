from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class BlogThemeCleanupTests(unittest.TestCase):
    def read(self, path: str) -> str:
        return (ROOT / path).read_text(encoding="utf-8")

    def test_butterfly_header_nav_is_removed(self):
        nav_template = self.read("blog/themes/butterfly/layout/includes/header/nav.pug")

        self.assertNotIn("nav#nav", nav_template)
        self.assertNotIn("#menus", nav_template)
        self.assertNotIn("includes/header/menu_item", nav_template)

    def test_blog_identity_and_sidebar_cards_are_minimal(self):
        hexo_config = self.read("blog/_config.yml")
        theme_config = self.read("blog/_config.butterfly.yml")
        author_template = self.read(
            "blog/themes/butterfly/layout/includes/widget/card_author.pug"
        )
        author_card = theme_config[
            theme_config.index("  card_author:") : theme_config.index("  card_announcement:")
        ]

        self.assertIn("author: Taozhiyo", hexo_config)
        self.assertNotIn("author: bistutzyy", hexo_config)
        self.assertIn("menu: false", theme_config)
        self.assertIn("social: false", theme_config)
        self.assertIn("card_webinfo:\n    enable: false", theme_config)
        self.assertIn("button:\n      enable: false", author_card)
        self.assertNotIn("Follow Me", author_card)
        self.assertNotIn("https://github.com/bistutzyy", author_card)
        self.assertNotIn("mailto:173236231@qq.com", author_card)
        self.assertNotIn(".site-data", author_template)


if __name__ == "__main__":
    unittest.main()
