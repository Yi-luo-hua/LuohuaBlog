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

    def test_sudo_password_is_not_embedded_in_remote_commands(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertNotIn('echo \\"$UCLOUD_SUDO_PASSWORD\\" | sudo -S', text)
        self.assertNotIn("'$UCLOUD_SUDO_PASSWORD'", text)
        self.assertNotIn("PW_Q=$(printf '%q' \"$UCLOUD_SUDO_PASSWORD\")", text)
        self.assertNotIn("export SUDO_PASSWORD=$PW_Q", text)
        self.assertIn("printf 'export SUDO_PASSWORD=%q\\n' \"$UCLOUD_SUDO_PASSWORD\"", text)
        self.assertIn("run_sudo() {", text)

    def test_sudo_password_env_is_sourced_by_remote_bash(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertGreaterEqual(text.count("'bash -se' <<REMOTE"), 4)
        terminators = [line for line in text.splitlines() if line.strip() == "REMOTE"]
        self.assertGreaterEqual(len(terminators), 4)
        for line in terminators:
            self.assertEqual("          REMOTE", line)

    def test_deploy_triggers_sync_with_token_header_only(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertNotIn("curl -sf -X POST --max-time 30 https://taozhiyy.top/api/v1/sync/trigger", text)
        self.assertNotIn("curl -i -X POST --max-time 30 https://taozhiyy.top/api/v1/sync/trigger || true", text)
        self.assertNotIn("curl -X POST --max-time 30 https://taozhiyy.top/api/v1/sync/trigger", text)
        self.assertIn("SYNC_TRIGGER_TOKEN: ${{ secrets.SYNC_TRIGGER_TOKEN }}", text)
        self.assertIn("Trigger protected backend sync", text)
        self.assertIn('if [ -z "$SYNC_TRIGGER_TOKEN" ]; then', text)
        self.assertIn('curl -sf -X POST --max-time 30 -H "X-Sync-Trigger-Token: $SYNC_TRIGGER_TOKEN" https://taozhiyy.top/api/v1/sync/trigger', text)
        self.assertIn("Bilibili covers smoke check", text)
        self.assertIn("covers: ok", text)
        self.assertIn("covers: pending; background sync will retry", text)

    def test_cover_check_logs_backend_diagnostics_on_failure(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("ERROR: Bilibili cover smoke check failed", text)
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
        self.assertIn("LEGACY_COS_SECRET_ID: ${{ secrets.COS_SECRET_ID }}", text)
        self.assertIn("LEGACY_COS_SECRET_KEY: ${{ secrets.COS_SECRET_KEY }}", text)
        self.assertIn("LEGACY_COS_BUCKET: ${{ secrets.COS_BUCKET }}", text)
        self.assertIn("LEGACY_COS_REGION: ${{ secrets.COS_REGION }}", text)
        self.assertIn("printf 'TENCENT_COS_SECRET_ID=%s\\n' \"$TENCENT_COS_SECRET_ID\" >> \"$FRAG\"", text)
        self.assertIn("printf 'TENCENT_COS_SECRET_KEY=%s\\n' \"$TENCENT_COS_SECRET_KEY\" >> \"$FRAG\"", text)
        self.assertIn("printf 'TENCENT_COS_BUCKET=%s\\n' \"$TENCENT_COS_BUCKET\" >> \"$FRAG\"", text)
        self.assertIn("printf 'TENCENT_COS_REGION=%s\\n' \"$TENCENT_COS_REGION\" >> \"$FRAG\"", text)
        self.assertIn("printf 'TENCENT_COS_BASE_URL=%s\\n' \"$TENCENT_COS_BASE_URL\" >> \"$FRAG\"", text)
        self.assertIn('TENCENT_COS_SECRET_ID="${TENCENT_COS_SECRET_ID:-$LEGACY_COS_SECRET_ID}"', text)
        self.assertIn('TENCENT_COS_SECRET_KEY="${TENCENT_COS_SECRET_KEY:-$LEGACY_COS_SECRET_KEY}"', text)
        self.assertIn('TENCENT_COS_BUCKET="${TENCENT_COS_BUCKET:-$LEGACY_COS_BUCKET}"', text)
        self.assertIn('TENCENT_COS_REGION="${TENCENT_COS_REGION:-$LEGACY_COS_REGION}"', text)

    def test_sync_step_includes_smtp_notification_secrets(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("SMTP_HOST: ${{ secrets.SMTP_HOST }}", text)
        self.assertIn("SMTP_PORT: ${{ secrets.SMTP_PORT }}", text)
        self.assertIn("SMTP_USER: ${{ secrets.SMTP_USER }}", text)
        self.assertIn("SMTP_PASS: ${{ secrets.SMTP_PASS }}", text)
        self.assertIn("SMTP_FROM_NAME: ${{ secrets.SMTP_FROM_NAME }}", text)
        self.assertIn("MAIL_NOTIFY_TO: ${{ secrets.MAIL_NOTIFY_TO }}", text)
        self.assertIn("printf 'SMTP_HOST=%s\\n' \"$SMTP_HOST\" >> \"$FRAG\"", text)
        self.assertIn("printf 'SMTP_PORT=%s\\n' \"$SMTP_PORT\" >> \"$FRAG\"", text)
        self.assertIn("printf 'SMTP_USER=%s\\n' \"$SMTP_USER\" >> \"$FRAG\"", text)
        self.assertIn("printf 'SMTP_PASS=%s\\n' \"$SMTP_PASS\" >> \"$FRAG\"", text)
        self.assertIn("printf 'SMTP_FROM_NAME=%s\\n' \"$SMTP_FROM_NAME\" >> \"$FRAG\"", text)
        self.assertIn("printf 'MAIL_NOTIFY_TO=%s\\n' \"$MAIL_NOTIFY_TO\" >> \"$FRAG\"", text)

    def test_sync_step_includes_agnes_image_generation_secrets(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("AGNES_API_KEY: ${{ secrets.AGNES_API_KEY }}", text)
        self.assertIn("AGNES_BASE_URL: ${{ secrets.AGNES_BASE_URL }}", text)
        self.assertIn("AGNES_IMAGE_MODEL: ${{ secrets.AGNES_IMAGE_MODEL }}", text)
        self.assertIn("DASHSCOPE_API_KEY: ${{ secrets.DASHSCOPE_API_KEY }}", text)
        self.assertIn("DASHSCOPE_BASE_URL: ${{ secrets.DASHSCOPE_BASE_URL }}", text)
        self.assertIn("AI_IMAGE_MODEL: ${{ secrets.AI_IMAGE_MODEL }}", text)
        self.assertIn("printf 'AGNES_API_KEY=%s\\n' \"$AGNES_API_KEY\" >> \"$FRAG\"", text)
        self.assertIn("printf 'AGNES_BASE_URL=%s\\n' \"$AGNES_BASE_URL\" >> \"$FRAG\"", text)
        self.assertIn("printf 'AGNES_IMAGE_MODEL=%s\\n' \"$AGNES_IMAGE_MODEL\" >> \"$FRAG\"", text)
        self.assertIn("printf 'DASHSCOPE_API_KEY=%s\\n' \"$DASHSCOPE_API_KEY\" >> \"$FRAG\"", text)
        self.assertIn("printf 'DASHSCOPE_BASE_URL=%s\\n' \"$DASHSCOPE_BASE_URL\" >> \"$FRAG\"", text)
        self.assertIn("printf 'AI_IMAGE_MODEL=%s\\n' \"$AI_IMAGE_MODEL\" >> \"$FRAG\"", text)

    def test_sync_step_includes_sync_trigger_token_secret(self):
        text = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("SYNC_TRIGGER_TOKEN: ${{ secrets.SYNC_TRIGGER_TOKEN }}", text)
        self.assertIn('printf \'SYNC_TRIGGER_TOKEN=%s\\n\' "$SYNC_TRIGGER_TOKEN" >> "$FRAG"', text)
        self.assertIn('[ -z "$SYNC_TRIGGER_TOKEN" ]', text)


if __name__ == "__main__":
    unittest.main()
