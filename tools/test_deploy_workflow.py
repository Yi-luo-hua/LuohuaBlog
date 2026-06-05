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

        self.assertIn("systemctl --no-pager --full status nginx", text)
        self.assertIn("journalctl -u nginx -n 100 --no-pager", text)


if __name__ == "__main__":
    unittest.main()
