from enum import Enum, auto
from typing import List, Dict, Optional

class TrackColor(Enum):
    PINK = auto()    # μP – Microplastics
    GREY = auto()    # CO₂e – Carbon Intensity
    BLUE = auto()    # DEP – Depletion
    GREEN = auto()   # TOX – Chemical Residue

class CardType(Enum):
    FACILITY = auto()
    DISTRIBUTION = auto()
    UPGRADE = auto()
    WHIM = auto()
    GLOBAL_EVENT = auto()

class Card:
    """Base class for all cards in the game."""
    def __init__(self, name: str, card_type: CardType, cost: int = 0, description: str = ""):
        self.name = name
        self.card_type = card_type
        self.cost = cost
        self.description = description

    def __repr__(self):
        return f"{self.__class__.__name__}({self.name}, Cost: {self.cost})"

class FacilityCard(Card):
    """Represents a facility that produces water."""
    def __init__(self, name: str, cost: int, base_output: int, impact_profile: Dict[TrackColor, int], tags: List[str] = None):
        super().__init__(name, CardType.FACILITY, cost)
        self.base_output = base_output
        self.impact_profile = impact_profile # e.g., {TrackColor.GREY: 1, TrackColor.PINK: 1}
        self.tags = tags if tags else []
        self.upgrades: List[UpgradeCard] = []

class DistributionCard(Card):
    """Represents a distribution method for water."""
    def __init__(self, name: str, cost: int, description: str, impact_modifier: Optional[Dict[str, int]] = None, special_effect: Optional[str] = None): # Added special_effect parameter
        super().__init__(name, CardType.DISTRIBUTION, cost, description)
        self.impact_modifier = impact_modifier if impact_modifier else {}
        self.is_active = True # For effects like Microplastic Revelation
        self.special_effect = special_effect
        # The logic for setting Drone Drops' special_effect can remain if special_effect param is None,
        # or be overridden if special_effect is provided.
        # For consistency, if data provides it, it should be used.
        # The cards.py already passes data.get("special_effect"), so this direct assignment might be redundant
        # if the data always contains it for Drone Drops.
        # if name == "Drone Drops" and self.special_effect is None:
        #     self.special_effect = "draw_extra_whim_next_round"


class UpgradeCard(Card):
    """Represents an upgrade or mitigation that can be applied."""
    def __init__(self, name: str, cost: int, description: str, effect_description: str, type: str = "GENERIC_UPGRADE"): # Added type
        super().__init__(name, CardType.UPGRADE, cost, description)
        self.effect_description = effect_description
        self.type = type # e.g., "FACILITY_UPGRADE", "ROUTE_UPGRADE", "R&D", "FACILITY_TAG"
        self.target_route_slot: Optional[int] = None # For route-specific upgrades if needed

class WhimCard(Card):
    """Represents a Whim card that affects demand and game conditions."""
    def __init__(self, name: str, trigger_condition: str, pre_round_effect: str, demand_shift: Dict[str, int], post_round_fallout: str):
        super().__init__(name, CardType.WHIM, 0) # Whims are drafted, not bought
        self.trigger_condition = trigger_condition # e.g., "μP < 5"
        self.pre_round_effect = pre_round_effect
        self.demand_shift = demand_shift # e.g., {"Connoisseurs_demand": 2}
        self.post_round_fallout = post_round_fallout # e.g., "Add +2 μP overall"

class GlobalEventCard(Card):
    """Represents a Global Event tile."""
    def __init__(self, name: str, trigger_track: TrackColor, trigger_threshold: int, effect_description: str):
        super().__init__(name, CardType.GLOBAL_EVENT, 0)
        self.trigger_track = trigger_track
        self.trigger_threshold = trigger_threshold
        self.effect_description = effect_description

class Player:
    """Represents a player in the game."""
    def __init__(self, name: str):
        self.name = name
        self.cred_coin: int = 10 # Starting cash, placeholder
        self.facilities: List[Optional[FacilityCard]] = [None] * 3
        self.distribution_routes: List[Optional[DistributionCard]] = [None] * 2
        self.r_and_d: List[UpgradeCard] = [] # Passive techs
        self.impact_storage: Dict[TrackColor, int] = {track: 0 for track in TrackColor}
        self.total_impact_contributed: Dict[TrackColor, int] = {track: 0 for track in TrackColor} # For tie-breaking
        self.futures_tokens: List[FutureToken] = [] # Max 3 (track-based futures)
        self.event_options: List[EventOption] = [] # For event-based futures
        self.reputation_stars: int = 0
        self.hand_cards: List[Card] = [] # Could be used for drafting or holding unbuilt facilities
        # self.water_cubes_produced: int = 0 # Replaced by water_batches
        self.water_batches: List[Dict[str, any]] = []
        # Each dict: {'facility_name': str, 'facility_tags': List[str],
        #             'base_impact_profile': Dict[TrackColor, int], 'quantity': int,
        #             'production_round': int}
        self.triggered_global_events: int = 0
        self.draw_extra_whim_flag: bool = False # For Drone Drops effect
        self.routes_built_this_game: set[str] = set() # For Diversity Bonus

    def get_total_water_produced(self) -> int:
        """Calculates total water available from all batches."""
        return sum(batch['quantity'] for batch in self.water_batches)

    def __repr__(self):
        return f"Player({self.name}, CC: {self.cred_coin}, Rep: {self.reputation_stars}, Water: {self.get_total_water_produced()})"

class DemandSegment:
    """Represents a customer demand segment."""
    def __init__(self, name: str, base_demand: int, base_price: int, values_description: str):
        self.name = name
        self.current_demand = base_demand
        self.current_price = base_price
        self.values_description = values_description # e.g., "Cheapest litre wins"
        # Add conditions like μP <= 4 & CO₂e <= 5 for Eco-Elites, etc.

    def __repr__(self):
        return f"DemandSegment({self.name}, Demand: {self.current_demand}, Price: {self.current_price})"

class FutureToken:
    """Represents a futures token in the Aqua-Futures Market."""
    def __init__(self, track: TrackColor, is_long: bool, purchase_price: int = 2):
        self.track = track
        self.is_long = is_long # True for Long, False for Short
        self.purchase_price = purchase_price
        self.matures_at_increase: Optional[int] = 2 if is_long else None # Increase of >= 2 steps
        self.matures_at_decrease: Optional[int] = 2 if not is_long else None # Decrease of >=2 steps
        self.payout = 5

    def __repr__(self):
        return f"FutureToken({'Long' if self.is_long else 'Short'} {self.track.name}, Cost: {self.purchase_price})"

class EventOption:
    """Represents an Event Option in the Aqua-Futures Market (Advanced Variant)."""
    def __init__(self, event_name: str, purchase_price: int = 4, payout: int = 10):
        self.event_name = event_name # Name of the GlobalEventCard it's tied to
        self.purchase_price = purchase_price
        self.payout = payout
        self.has_matured: bool = False

    def __repr__(self):
        return f"EventOption({self.event_name}, Cost: {self.purchase_price}, Payout: {self.payout})"


# Example Usage (won't be run directly here, but for conceptualization)
if __name__ == '__main__':
    glacial_tap = FacilityCard("Glacial Tap", 5, 3, {TrackColor.GREY: 1, TrackColor.PINK: 1}, ["ARCTIC", "LIMITED 2"])
    plastic_bottles = DistributionCard("Plastic Bottles", 2, "Cheap, adds +1 μP per 2 cubes sold.", {"μP_per_2_cubes_sold": 1})
    bioplastic_seal = UpgradeCard("Bioplastic Seal", 3, "Route upgrade, remove 1 μP after selling.", "Removes 1 μP")
    glitterwave = WhimCard("Glitterwave Fashion", "μP < 5", "+2 Demand from Connoisseurs", {"Connoisseurs_demand": 2}, "Add +2 μP overall.")
    heatwave = GlobalEventCard("Heatwave Frenzy", TrackColor.GREY, 9, "Double demand, facilities overheat (Flow –1 per source).")

    player1 = Player("AquaCorp")
    player1.facilities[0] = glacial_tap
    player1.distribution_routes[0] = plastic_bottles
    player1.cred_coin -= (glacial_tap.cost + plastic_bottles.cost)
    player1.impact_storage[TrackColor.GREY] += glacial_tap.impact_profile.get(TrackColor.GREY,0)


    frugalists = DemandSegment("Frugalists", 4, 1, "Cheapest litre wins")

    print(glacial_tap)
    print(plastic_bottles)
    print(bioplastic_seal)
    print(glitterwave)
    print(heatwave)
    print(player1)
    print(frugalists)
    print(player1.impact_storage)
