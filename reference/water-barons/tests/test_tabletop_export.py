import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from water_barons.tabletop_simulator import export_to_tts


class TestTabletopExport(unittest.TestCase):
    def test_export_creates_file_with_cards(self):
        with TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "export.json"
            export_to_tts(out_path)
            self.assertTrue(out_path.exists())
            with out_path.open() as f:
                data = json.load(f)
            self.assertIn("facilities", data)
            self.assertGreater(len(data["facilities"]), 0)
            self.assertIn("whims", data)
            self.assertGreater(len(data["whims"]), 0)


if __name__ == '__main__':
    unittest.main()
