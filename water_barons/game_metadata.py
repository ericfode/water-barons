import os
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib

_DATA_FILE = Path(__file__).with_name("game_metadata.toml")

with open(_DATA_FILE, "rb") as f:
    _RAW = tomllib.load(f)

DEMAND_SEGMENTS_DATA = _RAW.get("demand_segments", [])
IMPACT_TRACKS_DATA = _RAW.get("impact_tracks", [])
THRESHOLD_EFFECT_DESCRIPTIONS = _RAW.get("threshold_effect_descriptions", {})
