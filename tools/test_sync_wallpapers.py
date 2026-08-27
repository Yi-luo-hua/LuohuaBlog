import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import sync_wallpapers


class SyncWallpapersTests(unittest.TestCase):
    def test_default_source_is_set(self):
        self.assertEqual(str(sync_wallpapers.DEFAULT_SOURCE), r"F:\图\表情包壁纸\壁纸插图")

    @patch("sync_wallpapers.ingest")
    def test_sync_skips_deploy_when_no_new_photos(self, mock_ingest):
        mock_ingest.return_value = 0
        res = sync_wallpapers.sync_wallpapers(
            source_dir=Path(__file__).parent,
            dry_run=False,
        )
        self.assertEqual(res, 0)
        mock_ingest.assert_called_once()

    @patch("sync_wallpapers.run_cmd")
    @patch("sync_wallpapers.ingest")
    def test_sync_executes_commit_and_deploy_when_new_photos_found(self, mock_ingest, mock_run_cmd):
        mock_ingest.return_value = 3
        res = sync_wallpapers.sync_wallpapers(
            source_dir=Path(__file__).parent,
            dry_run=False,
            no_commit=False,
            no_deploy=False,
        )
        self.assertEqual(res, 0)
        self.assertEqual(mock_run_cmd.call_count, 4)  # git add, git commit, git push, deploy-azure


if __name__ == "__main__":
    unittest.main()
