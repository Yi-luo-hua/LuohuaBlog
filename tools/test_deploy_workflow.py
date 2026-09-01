"""Guards for the CI workflow and the server-side deploy assets.

The pull-based deployment this file used to guard belonged to the upstream
template: it targeted a UCloud host, a `taozhiyy-deploy` system user, and
`/var/www/taozhiyy`. None of that exists here. The live site is an Azure VM
deployed by building locally and uploading, so these tests now check that the
UCloud machinery is really gone and that CI still validates every remaining
subproject without touching production secrets.
"""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "deploy.yml"


class DeployWorkflowTests(unittest.TestCase):
    def test_workflow_is_public_repo_safe_ci_only(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("name: Validate LuohuaBlog", text)
        self.assertIn("runs-on: ubuntu-latest", text)
        self.assertIn("pull_request:", text)
        self.assertNotIn("self-hosted", text)
        self.assertNotIn("Deploy on UCloud host", text)
        self.assertNotIn("deploy/self-hosted-deploy.sh", text)

    def test_workflow_does_not_use_server_access_or_production_secrets(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        forbidden = [
            "UCLOUD_HOST",
            "UCLOUD_PORT",
            "UCLOUD_USER",
            "UCLOUD_SSH_KEY",
            "UCLOUD_SUDO_PASSWORD",
            "AZURE_",
            "AUTH_OWNER_PASSWORD",
            "AUTH_OWNER_SECURITY_ANSWER",
            "AGNES_API_KEY",
            "DASHSCOPE_API_KEY",
            "TENCENT_COS_SECRET",
            "OWNER_PUBLISH_GITHUB_TOKEN",
            "SMTP_PASS",
            "SYNC_TRIGGER_TOKEN",
            "ssh-keyscan",
            "scp ",
            "ssh -p",
        ]
        for value in forbidden:
            self.assertNotIn(value, text)

    def test_workflow_builds_every_remaining_project(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("go test ./...", text)
        self.assertIn("CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o acg-api .", text)
        self.assertIn("cd main", text)
        self.assertIn("npm run build", text)
        self.assertIn("cd blog", text)
        self.assertIn("npm run clean", text)

    def test_hexo_post_media_paths_do_not_duplicate_the_blog_root(self):
        posts_dir = ROOT / "blog" / "source" / "_posts"
        posts = list(posts_dir.glob("*.md"))

        self.assertTrue(posts, "the Hexo blog should contain at least one post")
        # Hexo's root is already /blog/, so any absolute path a post writes is
        # resolved under it: /images/x.png becomes /blog/images/x.png. Writing
        # the prefix by hand yields /blog/blog/x.png, which only survives
        # because of a rewrite rule in deploy/nginx-luohua.conf — at the cost
        # of a redirect round trip per asset. Catch every /blog/ prefix, not
        # just the /blog/images/ spelling that happened to slip through once.
        offenders = []
        for post in posts:
            for number, line in enumerate(
                post.read_text(encoding="utf-8").splitlines(), start=1
            ):
                for match in re.finditer(r"(?<![\w:/])/blog/", line):
                    offenders.append(f"{post.name}:{number}: {line.strip()[:100]}")
                    del match
        self.assertEqual(
            offenders,
            [],
            "posts must not prefix paths with /blog/ — Hexo's root adds it:\n"
            + "\n".join(offenders),
        )

        cover = ROOT / "blog" / "source" / "images" / "2026" / "08" / "9a3db927692f-6a8b417000732-1787511152.webp"
        self.assertTrue(cover.is_file(), "the blog test post cover must be versioned")

    def test_post_front_matter_has_no_orphaned_list_items(self):
        """A list item may only follow its own key, never a scalar.

        publish_blog_post re-emits categories/tags in normalized form and drops
        the original key line. It used to keep the lines *under* that key, so
        the orphaned "- item" lines landed after the last scalar and YAML
        folded them into it: gpt-1流程分析.md parsed mathjax as the string
        "true - 深度学习 - transformer - ..." instead of the boolean true.
        """
        key_line = re.compile(r"^([^\s:#][^:]*):\s*(.*)$")
        item_line = re.compile(r"^\s*-\s")
        offenders = []

        for post in (ROOT / "blog" / "source" / "_posts").glob("*.md"):
            lines = post.read_text(encoding="utf-8").splitlines()
            try:
                end = lines.index("---", 1)
            except ValueError:
                continue
            owner = None
            for number, line in enumerate(lines[1:end], start=2):
                if item_line.match(line):
                    if owner is None:
                        offenders.append(f"{post.name}:{number}: 列表项没有归属的键")
                    elif owner[1]:
                        offenders.append(
                            f"{post.name}:{number}: 列表项跟在标量 "
                            f"`{owner[0]}: {owner[1]}` 后面"
                        )
                    continue
                match = key_line.match(line)
                if match:
                    owner = (match.group(1).strip(), match.group(2).strip())

        self.assertEqual(offenders, [], "; ".join(offenders))

    def test_workflow_does_not_reference_the_deleted_build_subsite(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertNotIn("build/**", text)
        self.assertNotIn("build/package-lock.json", text)
        self.assertNotIn("cd build", text)
        self.assertFalse((ROOT / "build").exists(), "the build subsite should be gone")

    def test_workflow_bakes_in_no_foreign_api_origin(self):
        # The browser reaches /api on its own origin, so a validation build must
        # not hardcode an absolute API host — least of all the template author's.
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertNotIn("taozhiyy", text)
        self.assertNotIn("VITE_API_BASE", text)

    def test_upstream_pull_deploy_machinery_is_removed(self):
        removed = [
            ROOT / "deploy" / "pull-deploy.sh",
            ROOT / "deploy" / "install-pull-deploy.sh",
            ROOT / "deploy" / "taozhiyy-pull-deploy.service",
            ROOT / "deploy" / "taozhiyy-pull-deploy.timer",
            ROOT / "deploy" / "PULL_BASED_DEPLOY.md",
            ROOT / "deploy" / "self-hosted-deploy.sh",
            ROOT / "deploy" / "install-github-runner.sh",
            ROOT / "deploy" / "SELF_HOSTED_RUNNER.md",
        ]
        for path in removed:
            self.assertFalse(path.exists(), f"remove obsolete {path.relative_to(ROOT)}")

    def test_site_media_is_versioned_rather_than_borrowed(self):
        # The media under /cos/ was reverse-proxied from the template author's
        # Tencent COS bucket. It now lives in this repository so that rebuilding
        # the server never depends on a third party's storage again.
        #
        # This used to assert a raw file count, which tripped as soon as the
        # template author's gallery photos were deleted. Name the assets the
        # site actually loads instead, so the guard tracks intent rather than
        # ordinary media churn.
        media = ROOT / "assets" / "cos"
        files = [p for p in media.rglob("*") if p.is_file() and p.suffix != ".md"]
        self.assertGreater(len(files), 20, "site media should be committed")

        # feature-*.mp4 曾经在这个清单里；它们连同打不开的影像档案浮层一起删了。
        referenced = [
            media / "AI自动化博客图片" / "main" / "img" / "hero-1.webp",
            media / "AI自动化博客图片" / "main" / "audio" / "loop.mp3",
        ]
        for path in referenced:
            self.assertTrue(path.is_file(), f"missing site media {path.relative_to(ROOT)}")

        self.assertIn("cos", (ROOT / "deploy" / "deploy-azure.sh").read_text(encoding="utf-8"))

    def test_no_source_file_points_at_the_template_authors_bucket(self):
        # aboutPreviewAssets.js names the host on purpose: it rewrites that
        # origin to /cos/. Everything else must be free of it — especially the
        # Vite dev proxy, which used to send local development to that bucket.
        vite_config = (ROOT / "main" / "vite.config.js").read_text(encoding="utf-8")
        nginx_note = (ROOT / "docs" / "AZURE_DEPLOYMENT_HANDOFF.md").read_text(encoding="utf-8")

        self.assertNotIn("tzyy-1330068502", vite_config)
        self.assertIn("VITE_COS_ORIGIN", vite_config)
        self.assertIn("alias /var/www/luohua/cos/", nginx_note)

    def test_azure_deploy_script_is_present_and_matches_the_live_host(self):
        script = (ROOT / "deploy" / "deploy-azure.sh").read_text(encoding="utf-8")

        self.assertIn("/var/www/luohua", script)
        self.assertIn("/opt/acg-api", script)
        self.assertIn("acg-api.service", script)
        self.assertIn("nginx -t", script)
        # The server's .env holds every real secret; a deploy must never ship
        # one from the working tree or overwrite what is already there.
        self.assertNotIn("acg-api/.env", script)

    def test_azure_deploy_keeps_nginx_config_reproducible_and_rolls_back_invalid_changes(self):
        script = (ROOT / "deploy" / "deploy-azure.sh").read_text(encoding="utf-8")

        self.assertIn("deploy/nginx-luohua.conf", script)
        self.assertIn("/tmp/luohua.nginx.new", script)
        self.assertIn("/var/backups/nginx", script)
        self.assertIn("if ! sudo nginx -t", script)
        self.assertIn("if ! sudo systemctl reload nginx", script)
        self.assertIn('sudo install -o root -g root -m 0644 "$backup"', script)
        self.assertIn("sudo systemctl reload nginx", script)

    def test_azure_deploy_targets_the_https_domain_and_preserves_hexo_cache(self):
        script = (ROOT / "deploy" / "deploy-azure.sh").read_text(encoding="utf-8")

        self.assertIn('SITE_HOST="${SITE_HOST:-yiluohua.top}"', script)
        self.assertIn('SITE_APP_HOST="${SITE_APP_HOST:-app.yiluohua.top}"', script)
        self.assertIn('VERIFY_ORIGIN="${VERIFY_ORIGIN:-https://$SITE_HOST}"', script)
        self.assertIn("--retry-all-errors", script)
        self.assertIn("restore_blog_db", script)
        self.assertIn("BLOG_DB_STATE", script)

    def test_nginx_serves_the_domain_over_tls_and_redirects_plain_http(self):
        text = (ROOT / "deploy" / "nginx-luohua.conf").read_text(encoding="utf-8")

        self.assertIn("server_name yiluohua.top www.yiluohua.top app.yiluohua.top", text)
        self.assertIn("listen 443 ssl default_server;", text)
        self.assertIn("/etc/letsencrypt/live/yiluohua.top/fullchain.pem", text)
        self.assertIn("return 308 https://yiluohua.top$request_uri;", text)
        self.assertNotIn("GET|HEAD|OPTIONS", text)

    def test_nginx_cache_policy_separates_hashed_assets_from_refreshable_content(self):
        text = (ROOT / "deploy" / "nginx-luohua.conf").read_text(encoding="utf-8")

        pattern_line = next(
            line for line in text.splitlines()
            if line.strip().startswith('location ~* "^/assets/')
        )
        hashed_asset_pattern = pattern_line.split('"', 2)[1]
        self.assertRegex("/assets/index-DRkgbflv.js", re.compile(hashed_asset_pattern))
        self.assertRegex("/assets/index-C2TXMfmA.css", re.compile(hashed_asset_pattern))
        self.assertNotRegex(
            "/assets/moments/campus-rainbow-2026-06-13.jpg",
            re.compile(hashed_asset_pattern),
        )
        self.assertIn("expires 1y;", text)
        self.assertIn('add_header Cache-Control "public, immutable";', text)
        self.assertNotIn('add_header Cache-Control "public" always;', text)
        self.assertNotIn('add_header Cache-Control "public, immutable" always;', text)
        self.assertIn("expires 1h;", text)
        self.assertIn("expires 30d;", text)
        self.assertIn("location = /sw.js", text)
        self.assertGreaterEqual(
            text.count('add_header Cache-Control "no-cache" always;'),
            3,
        )
        self.assertLess(text.index("expires 1y;"), text.index("location /assets/"))


if __name__ == "__main__":
    unittest.main()
