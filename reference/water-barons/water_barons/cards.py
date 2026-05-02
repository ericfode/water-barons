import os
from pathlib import Path

try:
    import tomllib  # Python 3.11+
except ModuleNotFoundError:  # pragma: no cover - fallback for older Python
    import tomli as tomllib
from water_barons.game_entities import (
    FacilityCard, DistributionCard, UpgradeCard, WhimCard, GlobalEventCard,
    TrackColor
)

_DATA_FILE = Path(
    os.getenv("WATER_BARONS_DATA_FILE", Path(__file__).with_name("game_content.toml"))
)

with open(_DATA_FILE, "rb") as f:
    _RAW_DATA = tomllib.load(f)

FACILITIES_DATA = _RAW_DATA.get("facilities", [])
DISTRIBUTION_DATA = _RAW_DATA.get("distributions", [])
UPGRADES_DATA = _RAW_DATA.get("upgrades", [])
WHIMS_DATA = _RAW_DATA.get("whims", [])
GLOBAL_EVENTS_DATA = _RAW_DATA.get("global_events", [])
ACTIONS_DATA = _RAW_DATA.get("actions", [])

def _convert_profile(profile_dict: dict) -> dict:
    return {TrackColor[key]: value for key, value in profile_dict.items()}

def get_all_facility_cards() -> list[FacilityCard]:
    cards: list[FacilityCard] = []
    for data in FACILITIES_DATA:
        impact_profile = _convert_profile(data.get("impact_profile", {}))
        card = FacilityCard(
            name=data["name"],
            cost=data["cost"],
            base_output=data["base_output"],
            impact_profile=impact_profile,
            tags=data.get("tags", []),
        )
        cards.extend([card] * int(data.get("copies", 1)))
    return cards

def get_all_distribution_cards() -> list[DistributionCard]:
    cards: list[DistributionCard] = []
    for data in DISTRIBUTION_DATA:
        impact_mod = {}
        for key, details in data.get("impact_modifier", {}).items():
            mod = details.copy()
            if "impact" in mod:
                mod["impact"] = TrackColor[mod["impact"]]
            impact_mod[key] = mod
        card = DistributionCard(
            name=data["name"],
            cost=data["cost"],
            description=data["description"],
            impact_modifier=impact_mod,
            special_effect=data.get("special_effect"),
        )
        cards.extend([card] * int(data.get("copies", 1)))
    return cards

def get_all_upgrade_cards() -> list[UpgradeCard]:
    cards: list[UpgradeCard] = []
    for data in UPGRADES_DATA:
        card = UpgradeCard(
            name=data["name"],
            cost=data["cost"],
            description=data["description"],
            effect_description=data["effect_description"],
            type=data.get("type", "GENERIC_UPGRADE"),
        )
        cards.extend([card] * int(data.get("copies", 1)))
    return cards

def get_all_whim_cards() -> list[WhimCard]:
    cards: list[WhimCard] = []
    for data in WHIMS_DATA:
        card = WhimCard(
            name=data["name"],
            trigger_condition=data["trigger_condition"],
            pre_round_effect=data["pre_round_effect"],
            demand_shift=data.get("demand_shift", {}),
            post_round_fallout=data["post_round_fallout"],
        )
        cards.extend([card] * int(data.get("copies", 1)))
    return cards

def get_all_global_event_tiles() -> list[GlobalEventCard]:
    cards = []
    for data in GLOBAL_EVENTS_DATA:
        card = GlobalEventCard(
            name=data["name"],
            trigger_track=TrackColor[data["trigger_track"]],
            trigger_threshold=data["trigger_threshold"],
            effect_description=data["effect_description"],
        )
        cards.append(card)
    return cards

# ACTIONS_DATA is exported for external use
