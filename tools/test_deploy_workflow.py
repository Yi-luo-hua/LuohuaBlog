"""Guards for the CI workflow and the server-side deploy assets.

The pull-based deployment this file used to guard belonged to the upstream
template: it targeted a UCloud host, a `taozhiyy-deploy` system user, and
`/var/www/taozhiyy`. None of that exists here. The live site is an Azure VM
deployed by building locally and uploading, so these tests now check that the
UCloud machinery is really gone and that CI still validates every remaining
subproject without touching production secrets.
"""

from pathlib import Path
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
        media = ROOT / "assets" / "cos"
        files = [p for p in media.rglob("*") if p.is_file() and p.suffix != ".md"]

        self.assertGreater(len(files), 50, "site media should be committed")
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


if __name__ == "__main__":
    unittest.main()
