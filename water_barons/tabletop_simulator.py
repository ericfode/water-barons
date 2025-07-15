"""Simplistic export of Water Barons data for Tabletop Simulator.

This module does not implement a full Tabletop Simulator mod.
Instead, it provides a helper to export card metadata in a JSON
format that could be further processed to build a mod manually.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from .cards import (
    get_all_facility_cards,
    get_all_distribution_cards,
    get_all_upgrade_cards,
    get_all_whim_cards,
    get_all_global_event_tiles,
)
from .game_entities import TrackColor, CardType


def export_to_tts(output_path: str | Path) -> None:
    """Export card data to a simplified Tabletop Simulator JSON file."""

    def _convert(obj):
        if isinstance(obj, (TrackColor, CardType)):
            return obj.name
        if isinstance(obj, dict):
            return {k.name if isinstance(k, TrackColor) else k: _convert(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_convert(v) for v in obj]
        return obj

    data: Dict[str, List[Dict]] = {
        "facilities": [_convert(c.__dict__) for c in get_all_facility_cards()],
        "distribution": [_convert(c.__dict__) for c in get_all_distribution_cards()],
        "upgrades": [_convert(c.__dict__) for c in get_all_upgrade_cards()],
        "whims": [_convert(c.__dict__) for c in get_all_whim_cards()],
        "global_events": [_convert(c.__dict__) for c in get_all_global_event_tiles()],
    }
    Path(output_path).write_text(json.dumps(data, indent=2))


if __name__ == "__main__":
    export_to_tts("tabletop_export.json")
    print("Exported game data to tabletop_export.json")
