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

    def test_blog_scripts_tolerate_removed_navigation(self):
        theme_config = self.read("blog/_config.butterfly.yml")
        main_js = self.read("blog/themes/butterfly/source/js/main.js")
        utils_js = self.read("blog/themes/butterfly/source/js/utils.js")

        self.assertIn("search:\n  # Choose: algolia_search / local_search / docsearch", theme_config)
        self.assertIn("  use:\n  placeholder:", theme_config)
        self.assertIn("fireworks:\n  enable: false", theme_config)
        self.assertIn("if (!$nav || !blogInfo || !menus) return", main_js)
        self.assertIn("if (!ele) return", utils_js)

    def test_blog_avoids_noisy_external_effect_assets(self):
        theme_config = self.read("blog/_config.butterfly.yml")
        local_asset_script = self.read("blog/scripts/local_tag_plugin_assets.js")

        self.assertIn("activate_power_mode:\n  enable: false", theme_config)
        self.assertIn("canvas_ribbon:\n  enable: false", theme_config)
        self.assertIn("canvas_fluttering_ribbon:\n  enable: false", theme_config)
        self.assertIn("canvas_nest:\n  enable: false", theme_config)
        self.assertIn("    iconfont:", theme_config)
        self.assertIn("    carousel:", theme_config)
        self.assertIn("    anima: css/vendor/font-awesome-animation.min.css", theme_config)
        self.assertIn("    tag_plugins_css: css/vendor/tag_plugins.css", theme_config)
        self.assertNotIn("font_2032782_8d5kxvn09md.js", theme_config)
        self.assertNotIn("carousel-touch.js", theme_config)
        self.assertIn("hexo-butterfly-tag-plugins-plus", local_asset_script)
        self.assertIn("font-awesome-animation.min.css", local_asset_script)
        self.assertIn("tag_plugins.css", local_asset_script)


if __name__ == "__main__":
    unittest.main()
