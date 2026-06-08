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

    def test_nginx_api_snippet_allows_owner_asset_upload_size(self):
        text = SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn('client_max_body_size 10m;', text)

    def test_nginx_api_snippet_is_rewritten_on_redeploy(self):
        text = SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn('SNIP_TMP=$(mktemp)', text)
        self.assertIn('cat >"$SNIP_TMP" <<\'NGX\'', text)
        self.assertIn('run_sudo install -m 0644 "$SNIP_TMP" "$SNIP"', text)
        self.assertNotIn('run_sudo tee "$SNIP" >/dev/null <<\'NGX\'', text)
        self.assertNotIn('if ! run_sudo test -f "$SNIP"; then', text)


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

    def test_syncs_smtp_notification_env_keys(self):
        text = SYNC_ENV_SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn("SMTP_HOST", text)
        self.assertIn("SMTP_PORT", text)
        self.assertIn("SMTP_USER", text)
        self.assertIn("SMTP_PASS", text)
        self.assertIn("SMTP_FROM_NAME", text)
        self.assertIn("MAIL_NOTIFY_TO", text)


if __name__ == "__main__":
    unittest.main()
