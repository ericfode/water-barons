import unittest
from tempfile import TemporaryDirectory
from pathlib import Path

from water_barons.print_and_play import generate_print_and_play


class TestPrintAndPlay(unittest.TestCase):
    def test_generate_print_and_play_creates_file(self):
        with TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "out.html"
            path = generate_print_and_play(out_path)
            self.assertTrue(path.exists())
            text = path.read_text(encoding="utf-8")
            self.assertIn("Glacial Tap", text)


if __name__ == "__main__":
    unittest.main()
