import os
import importlib
import textwrap
from tempfile import NamedTemporaryFile

import pytest

def test_cards_load_from_env_path(monkeypatch):
    sample = textwrap.dedent("""
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
    """)
    with NamedTemporaryFile('w+', delete=False) as tmp:
        tmp.write(sample)
        tmp_path = tmp.name
    monkeypatch.setenv('WATER_BARONS_DATA_FILE', tmp_path)
    import water_barons.cards as cards
    importlib.reload(cards)
    try:
        facilities = cards.get_all_facility_cards()
        assert any(f.name == "Temp Facility" for f in facilities)
        assert cards.ACTIONS_DATA and cards.ACTIONS_DATA[0]['name'] == "Dummy Action"
    finally:
        monkeypatch.delenv('WATER_BARONS_DATA_FILE', raising=False)
        os.remove(tmp_path)
        importlib.reload(cards)
