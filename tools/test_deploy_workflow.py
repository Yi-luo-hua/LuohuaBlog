from pathlib import Path
import unittest


WORKFLOW_PATH = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "deploy.yml"


class DeployWorkflowTests(unittest.TestCase):
    def test_switch_step_uses_reload_or_restart_for_nginx(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("systemctl reload-or-restart nginx", text)
        self.assertNotIn("systemctl reload nginx", text)

    def test_switch_step_logs_nginx_status_on_failure(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("ERROR: nginx reload-or-restart failed", text)
        self.assertIn("systemctl --no-pager --full status nginx", text)
        self.assertIn("systemctl --no-pager --full status nginx || true", text)
        self.assertIn("=== nginx processes ===", text)
        self.assertIn("ps aux | grep '[n]ginx' || true", text)
        self.assertIn("=== listening ports ===", text)
        self.assertIn("if command -v ss >/dev/null 2>&1; then ss -tlnp; else netstat -tlnp; fi", text)
        self.assertIn("grep -E ':(80|443)[[:space:]]' || true", text)
        self.assertIn("journalctl -u nginx -n 200 --no-pager", text)
        self.assertIn("journalctl -u nginx -n 200 --no-pager || true", text)
        self.assertIn("dmesg 2>&1 | tail -50 || true", text)

    def test_sync_trigger_logs_backend_diagnostics_on_failure(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("ERROR: Bilibili sync trigger failed", text)
        self.assertIn("curl -i -X POST --max-time 30 https://taozhiyy.top/api/v1/sync/trigger || true", text)
        self.assertIn("systemctl --no-pager --full status acg-api", text)
        self.assertIn("journalctl -u acg-api -n 120 --no-pager", text)
        self.assertIn("grep -E ':(8787)[[:space:]]' || true", text)
        self.assertIn("curl -i --max-time 10 http://127.0.0.1:8787/api/v1/health || true", text)

    def test_sync_step_includes_owner_publish_github_secrets(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("OWNER_PUBLISH_GITHUB_TOKEN: ${{ secrets.OWNER_PUBLISH_GITHUB_TOKEN }}", text)
        self.assertIn("OWNER_PUBLISH_GITHUB_OWNER: ${{ secrets.OWNER_PUBLISH_GITHUB_OWNER }}", text)
        self.assertIn("OWNER_PUBLISH_GITHUB_REPO: ${{ secrets.OWNER_PUBLISH_GITHUB_REPO }}", text)
        self.assertIn("OWNER_PUBLISH_GITHUB_BRANCH: ${{ secrets.OWNER_PUBLISH_GITHUB_BRANCH }}", text)
        self.assertIn("printf 'OWNER_PUBLISH_GITHUB_TOKEN=%s\\n' \"$OWNER_PUBLISH_GITHUB_TOKEN\" >> \"$FRAG\"", text)
        self.assertIn("printf 'OWNER_PUBLISH_GITHUB_OWNER=%s\\n' \"$OWNER_PUBLISH_GITHUB_OWNER\" >> \"$FRAG\"", text)
        self.assertIn("printf 'OWNER_PUBLISH_GITHUB_REPO=%s\\n' \"$OWNER_PUBLISH_GITHUB_REPO\" >> \"$FRAG\"", text)
        self.assertIn("printf 'OWNER_PUBLISH_GITHUB_BRANCH=%s\\n' \"$OWNER_PUBLISH_GITHUB_BRANCH\" >> \"$FRAG\"", text)

    def test_sync_step_includes_cos_secrets(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("TENCENT_COS_SECRET_ID: ${{ secrets.TENCENT_COS_SECRET_ID }}", text)
        self.assertIn("TENCENT_COS_SECRET_KEY: ${{ secrets.TENCENT_COS_SECRET_KEY }}", text)
        self.assertIn("TENCENT_COS_BUCKET: ${{ secrets.TENCENT_COS_BUCKET }}", text)
        self.assertIn("TENCENT_COS_REGION: ${{ secrets.TENCENT_COS_REGION }}", text)
        self.assertIn("TENCENT_COS_BASE_URL: ${{ secrets.TENCENT_COS_BASE_URL }}", text)
        self.assertIn("printf 'TENCENT_COS_SECRET_ID=%s\\n' \"$TENCENT_COS_SECRET_ID\" >> \"$FRAG\"", text)
        self.assertIn("printf 'TENCENT_COS_SECRET_KEY=%s\\n' \"$TENCENT_COS_SECRET_KEY\" >> \"$FRAG\"", text)
        self.assertIn("printf 'TENCENT_COS_BUCKET=%s\\n' \"$TENCENT_COS_BUCKET\" >> \"$FRAG\"", text)
        self.assertIn("printf 'TENCENT_COS_REGION=%s\\n' \"$TENCENT_COS_REGION\" >> \"$FRAG\"", text)
        self.assertIn("printf 'TENCENT_COS_BASE_URL=%s\\n' \"$TENCENT_COS_BASE_URL\" >> \"$FRAG\"", text)


if __name__ == "__main__":
    unittest.main()
