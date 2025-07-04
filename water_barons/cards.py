from water_barons.game_entities import (
    FacilityCard, DistributionCard, UpgradeCard, WhimCard, GlobalEventCard,
    TrackColor
)

# --- Facility Cards ---
FACILITIES_DATA = [
    {
        "name": "Glacial Tap", "cost": 5, "base_output": 3,
        "impact_profile": {TrackColor.GREY: 1, TrackColor.PINK: 1},
        "tags": ["ARCTIC", "LIMITED 2"], "description": "Taps into ancient glaciers."
    },
    {
        "name": "Greywater Loop", "cost": 3, "base_output": 2,
        "impact_profile": {TrackColor.GREEN: 1}, # Original: +1 TOX, -1 μP. -1 uP needs special handling.
        "tags": ["RECYCLING"], "description": "Recycles wastewater. Reduces Microplastics."
        # Note: The "-1 μP" is an effect that needs to be modeled, perhaps as a negative impact or a special ability.
        # For now, impact_profile only handles positive additions. We can add a 'mitigation_profile' later.
    },
    {
        "name": "Aquifer Well", "cost": 4, "base_output": 4,
        "impact_profile": {TrackColor.BLUE: 2},
        "tags": ["GROUNDWATER"], "description": "Standard well drawing from aquifers."
    },
    {
        "name": "Desalination Plant", "cost": 7, "base_output": 5,
        "impact_profile": {TrackColor.GREY: 2, TrackColor.GREEN: 1}, # High energy, some brine/chem discharge
        "tags": ["COASTAL", "HIGH_ENERGY"], "description": "Converts seawater to freshwater."
    },
    {
        "name": "Cloud Harvester", "cost": 6, "base_output": 2,
        "impact_profile": {TrackColor.GREY: 1}, # Energy for atmospheric condensation
        "tags": ["ATMOSPHERIC"], "description": "Collects water vapor from the air."
    },
    {
        "name": "Fog Net Array", "cost": 3, "base_output": 1,
        "impact_profile": {}, # Minimal direct impact
        "tags": ["PASSIVE", "COASTAL"], "description": "Passively collects water from fog."
    }
]

# --- Distribution Cards ---
DISTRIBUTION_DATA = [
    {
        "name": "Plastic Bottles", "cost": 1,
        "description": "Cheap, adds +1 μP per 2 cubes sold.",
        "impact_modifier": {"μP_per_cubes_sold": {"impact": TrackColor.PINK, "amount": 1, "per_cubes": 2}}
    },
    {
        "name": "Drone Drops", "cost": 3,
        "description": "Fancy, +1 CO₂e per cube, draws extra Whim next round.",
        "impact_modifier": {"CO2e_per_cube_sold": {"impact": TrackColor.GREY, "amount": 1, "per_cubes": 1}},
        "special_effect": "draw_extra_whim_next_round"
    },
    {
        "name": "Smart-Pipe Network", "cost": 5,
        "description": "Efficient, high upfront cost, low ongoing impact.",
        "impact_modifier": {} # Minimal operational impact
    },
    {
        "name": "Aluminum Cans", "cost": 2,
        "description": "Recyclable alternative to plastic, +1 CO₂e per 3 cubes sold (production energy).",
        "impact_modifier": {"CO2e_per_cubes_sold": {"impact": TrackColor.GREY, "amount": 1, "per_cubes": 3}}
    }
]

# --- Upgrade/Mitigation Cards ---
UPGRADES_DATA = [
    {
        "name": "Microplastic Filter", "cost": 4, "description": "Facility upgrade. Reduces μP per Flow.",
        "effect_description": "Apply_to_facility: reduce_impact_per_flow(TrackColor.PINK, 1)",
        "type": "FACILITY_UPGRADE"
    },
    {
        "name": "Bioplastic Seal", "cost": 3, "description": "Route upgrade, remove 1 μP after selling with this route.",
        "effect_description": "Apply_to_route: on_sell_remove_impact(TrackColor.PINK, 1)", # This effect needs specific handling during sales impact calculation
        "type": "ROUTE_UPGRADE"
    },
    {
        "name": "Algae Carbon Sink", "cost": 5, "description": "Facility tag. At Cleanup, move 1 CO₂e cube from track to supply.",
        "effect_description": "Passive_facility_effect: at_cleanup_reduce_global_impact(TrackColor.GREY, 1)", # Needs a new "cleanup" step for these effects
        "type": "FACILITY_TAG"
    },
    {
        "name": "Aquifer Recharge Tech", "cost": 6, "description": "R&D Passive. Reduce DEP impact from all your Wells by 1.",
        "effect_description": "Global_player_passive: reduce_facility_impact_type('Well', TrackColor.BLUE, 1)", # Parsed in _get_passive_player_impact_reduction
        "type": "R&D"
    },
    {
        "name": "Eco-Solar Upgrade", "cost": 4, "description": "Facility Upgrade. Reduces CO2e impact from target facility by 1.",
        "effect_description": "Apply_to_facility: reduce_impact_per_flow(TrackColor.GREY, 1)",
        "type": "FACILITY_UPGRADE"
    },
    {
        "name": "Nano-Resin Cleaners", "cost": 5, "description": "Facility Upgrade. Reduces TOX impact from target facility by 1.",
        "effect_description": "Apply_to_facility: reduce_impact_per_flow(TrackColor.GREEN, 1)",
        "type": "FACILITY_UPGRADE"
    }
]

# --- Whim Cards ---
WHIMS_DATA = [
    {
        "name": "Glitterwave Fashion", "trigger_condition": "μP < 5",
        "pre_round_effect": "DemandSegment:Connoisseurs:current_demand:+2",
        "demand_shift": {}, # Incorporated into pre-round for this structure
        "post_round_fallout": "GlobalImpact:PINK:+2"
    },
    {
        "name": "Doomscroll Detox", "trigger_condition": "CO₂e >= 6",
        "pre_round_effect": "DemandSegment:Frugalists:current_price:+1", # Panic hoarding
        "demand_shift": {},
        "post_round_fallout": "GlobalImpact:GREY:-1" # Viral eco-challenge
    },
    {
        "name": "Heatwave Hysteria", "trigger_condition": "CO₂e >= 7", # Different from Global Event trigger
        "pre_round_effect": "AllSegments:current_demand:+1", # General thirst
        "demand_shift": {},
        "post_round_fallout": "GlobalImpact:GREY:+1" # AC units go brrr
    },
    {
        "name": "Sustainable Sipping", "trigger_condition": "DEP < 4",
        "pre_round_effect": "DemandSegment:Eco-Elites:current_price:+1", # Willing to pay more for sustainable
        "demand_shift": {},
        "post_round_fallout": "PlayerEffect:EcoEliteBuyers:GainReputation:1" # Reward players who sold to Eco-Elites
    }
]

# --- Global Event Tiles ---
GLOBAL_EVENTS_DATA = [
    {
        "name": "Aquifer Collapse", "trigger_track": TrackColor.BLUE, "trigger_threshold": 8, # DEP Level 8+
        "effect_description": "All 'Well' type facilities output halved until Depletion <= 6. New Wells cannot be built."
    },
    {
        "name": "Heatwave Frenzy", "trigger_track": TrackColor.GREY, "trigger_threshold": 9, # CO2e Level 9+
        "effect_description": "Double demand across all segments. All facilities Flow –1 (overheat)."
    },
    {
        "name": "Microplastic Revelation", "trigger_track": TrackColor.PINK, "trigger_threshold": 8, # μP Level 8+
        "effect_description": "All 'Plastic Bottles' routes instantly add +3 μP then flip face-down (cannot be used)."
    },
    {
        "name": "Mass Recall", "trigger_track": TrackColor.GREEN, "trigger_threshold": 10, # TOX Level 10
        "effect_description": "All unsold Water cubes are immediately discarded. No sales this round from tainted supply."
    },
    # Adding a few more as per the component list (8 total mentioned)
    {
        "name": "Energy Crisis", "trigger_track": TrackColor.GREY, "trigger_threshold": 7,
        "effect_description": "Cost of 'Flow' action for energy-heavy facilities (Desal, Drone) increases by 1 CredCoin."
    },
    {
        "name": "Plastic Blight", "trigger_track": TrackColor.PINK, "trigger_threshold": 6,
        "effect_description": "Facilities with 'Plastic' in their components (hypothetical) or Plastic Bottle routes suffer -1 output/efficiency."
    },
    {
        "name": "Dustbowl Proclamation", "trigger_track": TrackColor.BLUE, "trigger_threshold": 6, # Earlier than full collapse
        "effect_description": "Cost to build new 'Well' or 'River Diversion' (hypothetical) facilities increases by 2 CredCoin."
    },
    {
        "name": "Toxic Algae Bloom", "trigger_track": TrackColor.GREEN, "trigger_threshold": 7, # Earlier than mass recall
        "effect_description": "Water from 'Coastal' tagged facilities costs +1 CredCoin for players to produce (extra filtering)."
    }
]


def get_all_facility_cards() -> list[FacilityCard]:
    cards = []
    for data in FACILITIES_DATA:
        # The original design doc says "6 distinct types x3 each" = 18 cards
        # For now, just creating one of each for easier testing of variety
        # Duplication can be handled when building the actual decks in GameState
        cards.append(FacilityCard(name=data["name"], cost=data["cost"], base_output=data["base_output"],
                                  impact_profile=data["impact_profile"], tags=data.get("tags", [])))
    return cards * 3 # Multiply to get 18 cards as per spec

def get_all_distribution_cards() -> list[DistributionCard]:
    cards = []
    for data in DISTRIBUTION_DATA:
        cards.append(DistributionCard(name=data["name"], cost=data["cost"], description=data["description"],
                                      impact_modifier=data.get("impact_modifier"), special_effect=data.get("special_effect")))
    return cards * 3 # 4 types x 3 each = 12 cards

def get_all_upgrade_cards() -> list[UpgradeCard]:
    cards = []
    for data in UPGRADES_DATA:
        cards.append(UpgradeCard(name=data["name"], cost=data["cost"], description=data["description"],
                                 effect_description=data["effect_description"], type=data.get("type", "GENERIC_UPGRADE")))
    # Assuming 8 unique types as per doc, so 8 * 3 = 24. Current data has 6.
    # To match 24 cards:
    num_unique_upgrades = len(UPGRADES_DATA)
    if num_unique_upgrades > 0:
        # Multiply each unique card to simulate having 3 copies of each of the 8 distinct types.
        # If we have 6 unique, we make 4 copies of each to get 24.
        # Better: ensure UPGRADES_DATA has 8 unique items, then multiply by 3.
        # For now, if we have 6 unique, we'll make 24 by doing 6 * 4.
        copies_per_unique = (24 // num_unique_upgrades) if num_unique_upgrades > 0 else 1
        full_set = []
        for card_obj in cards: # cards list currently has one of each unique
            full_set.extend([card_obj] * copies_per_unique) # This is not quite right if UPGRADES_DATA < 8
                                                            # it should be card_obj * 3 if UPGRADES_DATA has 8 items.
        # Correcting logic for "8 types x 3 each"
        # The list 'cards' contains one of each unique type defined in UPGRADES_DATA.
        # If we assume UPGRADES_DATA is the complete list of unique types (e.g. 8 types),
        # then we just need 3 copies of each.
        final_cards = []
        for card_obj in cards: # 'cards' has one of each from UPGRADES_DATA
            final_cards.extend([
                UpgradeCard(name=card_obj.name, cost=card_obj.cost, description=card_obj.description,
                            effect_description=card_obj.effect_description, type=card_obj.type)
                for _ in range(3) # Create 3 distinct objects for each type
            ])
        return final_cards
        # This ensures we have 3 actual objects for each of the unique types defined.
        # If UPGRADES_DATA has 6 items, this results in 18 cards. If it had 8, it'd be 24.
    return []


def get_all_whim_cards() -> list[WhimCard]:
    cards = []
    for data in WHIMS_DATA:
        cards.append(WhimCard(name=data["name"], trigger_condition=data["trigger_condition"],
                              pre_round_effect=data["pre_round_effect"], demand_shift=data["demand_shift"],
                              post_round_fallout=data["post_round_fallout"]))
    # 24 unique whims x 2 copies each = 48 cards
    # Current unique whims: len(WHIMS_DATA). Need 24 unique.
    # For now, we'll duplicate the existing ones to reach near 48 if needed, or assume more are defined.
    num_unique_whims = len(WHIMS_DATA)
    if num_unique_whims > 0 :
        repeats_needed = 24 // num_unique_whims if num_unique_whims > 0 else 0
        full_set = cards * repeats_needed
        # if we need more to reach 24 unique types for x2 copies.
        # This part needs actual unique card data.
        # For now, just double what we have if aiming for "x2 copies each"
        final_cards = []
        for _ in range(2): # x2 copies each
            final_cards.extend(cards)
        # This will be more like WHIMS_DATA * (48 / len(WHIMS_DATA)) if all whims are unique
        # For now, just 2 copies of the defined ones.
        return final_cards * ( (24 // num_unique_whims if num_unique_whims > 0 else 1 ) * 2) # ensure we have enough cards for 48 total
    return []


def get_all_global_event_tiles() -> list[GlobalEventCard]:
    return [GlobalEventCard(name=data["name"], trigger_track=data["trigger_track"],
                            trigger_threshold=data["trigger_threshold"], effect_description=data["effect_description"])
            for data in GLOBAL_EVENTS_DATA]


if __name__ == '__main__':
    # Test card creation
    facilities = get_all_facility_cards()
    distributions = get_all_distribution_cards()
    upgrades = get_all_upgrade_cards()
    whims = get_all_whim_cards()
    events = get_all_global_event_tiles()

    print(f"Generated {len(facilities)} facility cards. First: {facilities[0] if facilities else 'None'}")
    print(f"Generated {len(distributions)} distribution cards. First: {distributions[0] if distributions else 'None'}")
    print(f"Generated {len(upgrades)} upgrade cards. First: {upgrades[0] if upgrades else 'None'}")
    print(f"Generated {len(whims)} whim cards. First: {whims[0] if whims else 'None'}")
    print(f"Generated {len(events)} global event tiles. First: {events[0] if events else 'None'}")

    # Example of Greywater Loop's special property (conceptual)
    greywater = next((f for f in facilities if f.name == "Greywater Loop"), None)
    if greywater:
        # This shows we need a way to model negative impact or mitigation directly on the card
        print(f"\nNote on Greywater Loop: {greywater.description}")
        # This could be handled by adding a `mitigation_profile: Dict[TrackColor, int]` to FacilityCard
        # or special logic during the Flow action.
        # For now, its impact_profile is just {TrackColor.GREEN: 1}.
        # The "-1 μP" effect would be:
        # player.impact_storage[TrackColor.PINK] -= 1 (or similar) when Flowing.

    # Example of Drone Drops special effect
    drones = next((d for d in distributions if d.name == "Drone Drops"), None)
    if drones:
        print(f"\nDrone Drops special effect: {drones.special_effect}")

    # Example of Whim card effect parsing (conceptual)
    glitter_whim = next((w for w in whims if w.name == "Glitterwave Fashion"), None)
    if glitter_whim:
        print(f"\nGlitterwave Fashion pre-round: {glitter_whim.pre_round_effect}")
        # This string would need to be parsed by game logic, e.g.:
        # parts = glitter_whim.pre_round_effect.split(':') -> ["DemandSegment", "Connoisseurs", "current_demand", "+2"]
        # entity_type, entity_name, attribute_to_change, change_value = parts
        # change_value_int = int(change_value)
        # game_state.demand_segments[entity_name].current_demand += change_value_int
        print(f"Glitterwave Fashion post-round: {glitter_whim.post_round_fallout}")
        # parts = glitter_whim.post_round_fallout.split(':') -> ["GlobalImpact", "PINK", "+2"]
        # game_state.add_global_impact(TrackColor.PINK, 2)

    # Check total whim cards
    # Target: 24 unique whims x 2 copies each = 48 cards
    # Current unique whims defined: len(WHIMS_DATA)
    # We need to either define more unique whims or adjust the multiplication
    # The current get_all_whim_cards() makes 2 copies of the *defined* unique whims.
    # If len(WHIMS_DATA) is 4, we get 4 * 2 = 8 cards.
    # To get 48, if we have N unique whims, we need 48/N copies of each.
    # Or, more simply, ensure WHIMS_DATA has 24 unique entries, then duplicate.
    # The current logic `final_cards * ( (24 // num_unique_whims) * 2)` is a bit complex.
    # Simpler: define 24 unique whims, then `return all_unique_whims * 2`.
    # For now, `get_all_whim_cards` will produce `len(WHIMS_DATA) * 2 * (24 // len(WHIMS_DATA))` which aims for 48 if len(WHIMS_DATA) is a divisor of 24.
    # Example: If 4 unique whims: 4 * 2 * (24 // 4) = 8 * 6 = 48 cards. This seems correct.
    print(f"Number of unique whims defined: {len(WHIMS_DATA)}")
    print(f"Total whim cards generated by get_all_whim_cards(): {len(get_all_whim_cards())}")
