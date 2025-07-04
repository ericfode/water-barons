from typing import List, Dict, Optional
from water_barons.game_entities import TrackColor, Player, Card, WhimCard, GlobalEventCard, DemandSegment, FacilityCard, DistributionCard, UpgradeCard

class ImpactTrack:
    """Represents one of the four global impact tracks."""
    def __init__(self, name: str, color: TrackColor, flavor_text: str):
        self.name = name
        self.color = color
        self.flavor_text = flavor_text
        self.level: int = 0
        self.max_level: int = 10
        self.thresholds: Dict[int, str] = {} # e.g., {6: "CO2_Level_6_Effect", 9: "Heatwave_Event_Trigger"}
        self.global_event_on_max: Optional[str] = None # Name of global event if this track maxes out

    def add_impact(self, amount: int) -> bool:
        """Adds impact to the track. Returns True if a threshold was crossed."""
        crossed_threshold = False
        old_level = self.level
        self.level = min(self.max_level, self.level + amount)
        # Check if any new thresholds were crossed
        for threshold_level in self.thresholds:
            if old_level < threshold_level <= self.level:
                crossed_threshold = True
                # Logic to trigger effect can be handled by GameState or GameLogic
        return crossed_threshold

    def reduce_impact(self, amount: int):
        self.level = max(0, self.level - amount)

    def __repr__(self):
        return f"ImpactTrack({self.name}, Level: {self.level}/{self.max_level})"

class GameState:
    """Holds the entire state of the game."""
    def __init__(self, num_players: int, player_names: List[str]):
        self.players: List[Player] = [Player(name) for name in player_names]
        self.current_player_index: int = 0
        self.round_number: int = 1

        self.impact_tracks: Dict[TrackColor, ImpactTrack] = {
            TrackColor.PINK: ImpactTrack("Microplastics (μP)", TrackColor.PINK, "Invisible glitter choking fish & fetuses"),
            TrackColor.GREY: ImpactTrack("Carbon Intensity (CO₂e)", TrackColor.GREY, "Energy burnt desalinating & droning"),
            TrackColor.BLUE: ImpactTrack("Depletion (DEP)", TrackColor.BLUE, "Falling aquifers & riverbeds"),
            TrackColor.GREEN: ImpactTrack("Chemical Residue (TOX)", TrackColor.GREEN, "PFAS & cleaning reagents"),
        }
        self._initialize_track_thresholds()

        self.facility_deck: List[FacilityCard] = []
        self.distribution_deck: List[DistributionCard] = []
        self.upgrade_deck: List[UpgradeCard] = []
        self.whim_deck_source: List[WhimCard] = [] # All available Whim cards
        self.crowd_deck: List[WhimCard] = []
        self.whim_discard_pile: List[WhimCard] = [] # Face-up history
        self.global_event_tiles_available: List[GlobalEventCard] = []
        self.global_event_tiles_active: List[GlobalEventCard] = [] # Events that have triggered

        self.demand_segments: Dict[str, DemandSegment] = {
            "Frugalists": DemandSegment("Frugalists", 4, 1, "Cheapest litre wins"),
            "Convenientists": DemandSegment("Convenientists", 3, 2, "Buy only if Route includes Plastic or Drone"),
            "Eco-Elites": DemandSegment("Eco-Elites", 2, 3, "Demand μP ≤ 4 & CO₂e ≤ 5"),
            "Connoisseurs": DemandSegment("Connoisseurs", 1, 4, "Reject TOX ≥ 7; pay +1 for Glacial source"),
        }

        self.aqua_futures_market_open: bool = True # Or some other mechanism
        self.uninhaitable: bool = False
        self.game_log: List[str] = [] # For recording significant events
        self.game_wide_counters: Dict[str, int] = {
            "GlacialTap_built": 0,
        }

        # For tracking changes and effects within a round
        self.track_levels_at_round_start: Dict[TrackColor, int] = {}
        self.previously_active_events_this_round: set[GlobalEventCard] = set()
        self.active_threshold_effects: set[str] = set() # Stores keys of active non-event threshold effects
        self.round_sales_to_eco_elites: set[str] = set() # Player names who sold to Eco-Elites this round

        # Store base definitions for resetting demand segments
        self.demand_segments_base_definitions: Dict[str, Dict] = {
            name: {'base_demand': seg.current_demand, 'base_price': seg.current_price}
            for name, seg in self.demand_segments.items()
        }
        # Descriptions for threshold effects (non-Global Event static effects)
        self.threshold_effect_descriptions: Dict[str, str] = {
            "CO2_Level_6_Effect": "+1 CredCoin cost on all energy-heavy actions.",
            "DEP_Level_5_Effect": "Wells output –1.",
            "TOX_Level_7_Effect": "Connoisseur segment refuses non-filtered water.",
        }


    def _initialize_track_thresholds(self):
        # These are keys that map to self.threshold_effect_descriptions
        # μP – Microplastics
        self.impact_tracks[TrackColor.PINK].thresholds = {
             # Level 8: Microplastic Revelation Global Event (handled by GlobalEventCard trigger)
        }
        # CO₂e – Carbon Intensity
        self.impact_tracks[TrackColor.GREY].thresholds = {
            6: "CO2_Level_6_Effect",
            # Level 9: Heatwave Event (handled by GlobalEventCard trigger)
        }
        # DEP – Depletion
        self.impact_tracks[TrackColor.BLUE].thresholds = {
            5: "DEP_Level_5_Effect",
            # Level 8: Dustbowl Event (handled by GlobalEventCard trigger)
        }
        # TOX – Chemical Residue
        self.impact_tracks[TrackColor.GREEN].thresholds = {
            7: "TOX_Level_7_Effect",
            # Level 10: Mass Recall (handled by GlobalEventCard trigger)
        }

    def get_current_player(self) -> Player:
        return self.players[self.current_player_index]

    def next_player(self):
        self.current_player_index = (self.current_player_index + 1) % len(self.players)

    def add_global_impact(self, track_color: TrackColor, amount: int):
        """Adds impact from a player's storage or direct action to a global track."""
        track = self.impact_tracks[track_color]
        if track.add_impact(amount):
            # Potentially trigger threshold effects here or in a dedicated check phase
            self.game_log.append(f"Track {track.name} crossed a threshold, now at {track.level}.")

        # Check for Global Event triggers based on specific card definitions
        for event_card in self.global_event_tiles_available:
            if event_card.trigger_track == track_color and track.level >= event_card.trigger_threshold:
                self.trigger_global_event(event_card)
                # Potentially remove event card from available if it's a one-time trigger for that level
                # Or move to active events. This logic will be refined.

    def trigger_global_event(self, event_card: GlobalEventCard):
        if event_card not in self.global_event_tiles_active:
            self.global_event_tiles_active.append(event_card)
            # self.global_event_tiles_available.remove(event_card) # If they are unique and one-time
            self.game_log.append(f"GLOBAL EVENT TRIGGERED: {event_card.name} - {event_card.effect_description}")
            # Apply immediate effects of the global event. This will need more detailed logic.
            # For now, just logging.

    def check_for_uninhabitable(self):
        """Checks if three impact tracks are at max level."""
        maxed_out_tracks = 0
        for track in self.impact_tracks.values():
            if track.level >= track.max_level:
                maxed_out_tracks += 1

        if maxed_out_tracks >= 3:
            self.uninhaitable = True
            self.game_log.append("PLANET UNINHABITABLE! Proceeding to Final Scoring.")
            # End game logic will be handled elsewhere

    def __repr__(self):
        return (f"GameState(Round: {self.round_number}, Player: {self.get_current_player().name}, "
                f"Tracks: {[str(t) for t in self.impact_tracks.values()]})")

if __name__ == '__main__':
    gs = GameState(num_players=2, player_names=["Alice", "Bob"])
    print(gs)
    gs.add_global_impact(TrackColor.PINK, 3)
    gs.add_global_impact(TrackColor.GREY, 6) # Crosses threshold
    print(gs.impact_tracks[TrackColor.GREY])
    print(gs.game_log)

    # Simulate triggering a global event (assuming one exists for CO2 at 9)
    # First, let's manually create a sample global event for testing this part
    heatwave_event = GlobalEventCard("Heatwave Frenzy (Test)", TrackColor.GREY, 9, "Double demand, Flow -1")
    gs.global_event_tiles_available.append(heatwave_event)

    gs.add_global_impact(TrackColor.GREY, 3) # Should push CO2 to 9
    print(gs.impact_tracks[TrackColor.GREY])
    print(gs.game_log)
    print(f"Active Global Events: {gs.global_event_tiles_active}")

    # Test Uninhabitable
    gs.impact_tracks[TrackColor.PINK].level = 10
    gs.impact_tracks[TrackColor.GREY].level = 10
    gs.impact_tracks[TrackColor.BLUE].level = 10
    gs.check_for_uninhabitable()
    print(f"Is Uninhabitable: {gs.uninhaitable}")
    print(gs.game_log)
