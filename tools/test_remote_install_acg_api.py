from pathlib import Path
import unittest


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "deploy" / "remote-install-acg-api.sh"
SYNC_ENV_SCRIPT_PATH = Path(__file__).resolve().parents[1] / "deploy" / "sync-auth-env.sh"


class RemoteInstallAcgApiTests(unittest.TestCase):
    def test_waits_for_acg_api_to_become_active(self):
        text = SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn("wait_for_service_active()", text)
        self.assertIn("wait_for_http_ready()", text)
        self.assertIn('state="$(run_sudo systemctl is-active "$service" || true)"', text)
        self.assertIn('"$service is $state; waiting..."', text)
        self.assertIn("wait_for_service_active acg-api 30 1", text)
        self.assertIn("wait_for_http_ready http://127.0.0.1:8787/api/v1/health 30 1", text)
        self.assertNotIn("run_sudo systemctl is-active acg-api\n", text)

    def test_logs_acg_api_status_and_journal_when_wait_fails(self):
        text = SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn('systemctl --no-pager --full status "$service"', text)
        self.assertIn('journalctl -u "$service" -n 80 --no-pager', text)
        self.assertIn("grep -E ':(8787)[[:space:]]' || true", text)


class SyncAuthEnvTests(unittest.TestCase):
    def test_waits_for_acg_api_after_env_restart(self):
        text = SYNC_ENV_SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn("wait_for_service_active()", text)
        self.assertIn("wait_for_http_ready()", text)
        self.assertIn("if run_sudo systemctl restart acg-api", text)
        self.assertIn("wait_for_service_active acg-api 30 1", text)
        self.assertIn("wait_for_http_ready http://127.0.0.1:8787/api/v1/health 30 1", text)
        self.assertIn('systemctl --no-pager --full status "$service"', text)
        self.assertIn('journalctl -u "$service" -n 80 --no-pager', text)

    def test_syncs_owner_publish_github_env_keys(self):
        text = SYNC_ENV_SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn("OWNER_PUBLISH_GITHUB_TOKEN", text)
        self.assertIn("OWNER_PUBLISH_GITHUB_OWNER", text)
        self.assertIn("OWNER_PUBLISH_GITHUB_REPO", text)
        self.assertIn("OWNER_PUBLISH_GITHUB_BRANCH", text)

    def test_syncs_cos_env_keys(self):
        text = SYNC_ENV_SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn("TENCENT_COS_SECRET_ID", text)
        self.assertIn("TENCENT_COS_SECRET_KEY", text)
        self.assertIn("TENCENT_COS_BUCKET", text)
        self.assertIn("TENCENT_COS_REGION", text)
        self.assertIn("TENCENT_COS_BASE_URL", text)


if __name__ == "__main__":
    unittest.main()
