from pathlib import Path
import unittest


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "deploy" / "remote-install-acg-api.sh"


class RemoteInstallAcgApiTests(unittest.TestCase):
    def test_waits_for_acg_api_to_become_active(self):
        text = SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn("wait_for_service_active()", text)
        self.assertIn('state="$(run_sudo systemctl is-active "$service" || true)"', text)
        self.assertIn('"$service is $state; waiting..."', text)
        self.assertIn("wait_for_service_active acg-api 30 1", text)
        self.assertNotIn("run_sudo systemctl is-active acg-api\n", text)

    def test_logs_acg_api_status_and_journal_when_wait_fails(self):
        text = SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertIn('systemctl --no-pager --full status "$service"', text)
        self.assertIn('journalctl -u "$service" -n 80 --no-pager', text)


if __name__ == "__main__":
    unittest.main()
