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


if __name__ == "__main__":
    unittest.main()
