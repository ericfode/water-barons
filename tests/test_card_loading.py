import os
import importlib
import textwrap
from tempfile import NamedTemporaryFile

from unittest.mock import patch
import unittest


class TestCardLoading(unittest.TestCase):
    def test_cards_load_from_env_path(self):
        sample = textwrap.dedent(
            """
            [[facilities]]
            name = "Temp Facility"
            cost = 1
            base_output = 1
            copies = 1
            impact_profile = {GREY = 1}

            [[actions]]
            name = "Dummy Action"
            method = "action_dummy"
            description = "dummy"
            """
        )
        with NamedTemporaryFile("w+", delete=False) as tmp:
            tmp.write(sample)
            tmp_path = tmp.name
        with patch.dict(os.environ, {"WATER_BARONS_DATA_FILE": tmp_path}):
            import water_barons.cards as cards
            importlib.reload(cards)
            facilities = cards.get_all_facility_cards()
            self.assertTrue(any(f.name == "Temp Facility" for f in facilities))
            self.assertTrue(
                cards.ACTIONS_DATA and cards.ACTIONS_DATA[0]["name"] == "Dummy Action"
            )

        importlib.reload(cards)
        os.remove(tmp_path)
