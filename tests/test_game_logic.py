import unittest
from unittest.mock import patch, call
from water_barons.game_logic import GameLogic
from water_barons.game_state import GameState
from water_barons.game_entities import Player, TrackColor, WhimCard
from water_barons.cards import get_all_whim_cards


class TestGameLogicInitialization(unittest.TestCase):
    def test_game_logic_creation_and_deck_initialization(self):
        player_names = ["P1", "P2"]
        game = GameLogic(num_players=2, player_names=player_names)
        self.assertIsInstance(game.game_state, GameState)
        self.assertEqual(len(game.game_state.players), 2)
        self.assertTrue(len(game.game_state.facility_deck) > 0)
        self.assertTrue(len(game.game_state.distribution_deck) > 0)
        self.assertTrue(len(game.game_state.upgrade_deck) > 0)
        self.assertTrue(len(game.game_state.whim_deck_source) > 0)
        self.assertTrue(len(game.game_state.global_event_tiles_available) > 0)
        self.assertIn("Decks initialized and shuffled.", game.game_state.game_log)

class TestGameLogicPhases(unittest.TestCase):
    def setUp(self):
        self.player_names = ["Alice", "Bob"]
        self.game = GameLogic(num_players=2, player_names=self.player_names)
        # Ensure whim_deck_source is populated for tests that use it
        if not self.game.game_state.whim_deck_source:
             self.game.game_state.whim_deck_source = get_all_whim_cards() # Use actual cards

    def test_whim_draft_phase_simple(self):
        initial_source_len = len(self.game.game_state.whim_deck_source)
        num_players = len(self.game.game_state.players)
        expected_draft_count = num_players * 2

        if initial_source_len < expected_draft_count:
            # Add more cards if necessary for the test
            self.game.game_state.whim_deck_source.extend(
                [WhimCard(f"Extra Whim {i}", "", "", {}, "") for i in range(expected_draft_count - initial_source_len)]
            )
            initial_source_len = len(self.game.game_state.whim_deck_source)

        # Mock the callback for draft choice
        mock_draft_choice_cb = unittest.mock.Mock(return_value=0) # Auto-picks the first option

        self.game.whim_draft_phase(get_player_draft_choice_cb=mock_draft_choice_cb)

        # Ensure the mock was called for each pick
        self.assertEqual(mock_draft_choice_cb.call_count, expected_draft_count)
        self.assertEqual(len(self.game.game_state.crowd_deck), expected_draft_count)
        self.assertEqual(len(self.game.game_state.whim_deck_source), initial_source_len - expected_draft_count)
        self.assertIn("Crowd Deck now has", self.game.game_state.game_log[-1])

    @patch('builtins.print') # Mock print to avoid clutter
    def test_ops_phase_calls_next_player(self, mock_print):
        initial_player_name = self.game.game_state.get_current_player().name

        # Mock the callback for action choice. For this test, it doesn't need to do anything complex.
        mock_action_choice_cb = unittest.mock.Mock()

        self.game.ops_phase(get_player_action_choice_cb=mock_action_choice_cb)

        # After ops phase, current_player_index should be reset to 0 for the next phase
        self.assertEqual(self.game.game_state.current_player_index, 0)

        # Ensure the mock was called for each player and each action (2 players * 2 actions = 4 calls)
        self.assertEqual(mock_action_choice_cb.call_count, len(self.game.game_state.players) * 2)

        # Check log for turn indications if necessary (optional, as functionality is implicitly tested by call_count)
        log_str = "".join(self.game.game_state.game_log)
        self.assertIn(f"{self.player_names[0]}'s turn", log_str)
        self.assertIn(f"{self.player_names[1]}'s turn", log_str)


    def test_resolve_whim_pre_effect_demand_change(self):
        segment_name = "Frugalists"
        initial_demand = self.game.game_state.demand_segments[segment_name].current_demand
        whim = WhimCard("TestDemandWhim", "", f"DemandSegment:{segment_name}:current_demand:+3", {}, "")

        self.game.resolve_whim_pre_effect(whim)

        self.assertEqual(self.game.game_state.demand_segments[segment_name].current_demand, initial_demand + 3)
        self.assertIn(f"{segment_name} current_demand changed by 3", self.game.game_state.game_log[-1])

    def test_resolve_whim_post_fallout_global_impact(self):
        track_to_impact = TrackColor.PINK
        initial_level = self.game.game_state.impact_tracks[track_to_impact].level
        whim = WhimCard("TestImpactWhim", "", "", {}, f"GlobalImpact:{track_to_impact.name}:+2")

        self.game.resolve_whim_post_fallout(whim)

        self.assertEqual(self.game.game_state.impact_tracks[track_to_impact].level, initial_level + 2)
        self.assertIn(f"Global track {track_to_impact.name} changed by 2", self.game.game_state.game_log[-1])

    def test_consolidate_player_impacts(self):
        player1 = self.game.game_state.players[0]
        player1.impact_storage[TrackColor.GREEN] = 3
        player1.impact_storage[TrackColor.BLUE] = 1
        initial_green_level = self.game.game_state.impact_tracks[TrackColor.GREEN].level
        initial_blue_level = self.game.game_state.impact_tracks[TrackColor.BLUE].level

        self.game.consolidate_player_impacts()

        self.assertEqual(self.game.game_state.impact_tracks[TrackColor.GREEN].level, initial_green_level + 3)
        self.assertEqual(self.game.game_state.impact_tracks[TrackColor.BLUE].level, initial_blue_level + 1)
        self.assertEqual(player1.impact_storage[TrackColor.GREEN], 0)
        self.assertEqual(player1.impact_storage[TrackColor.BLUE], 0)
        self.assertIn(f"{player1.name} added 3 to GREEN track.", "".join(self.game.game_state.game_log))


    @patch('builtins.print') # Mock print for crowd_phase
    def test_crowd_phase_flow(self, mock_print):
        # Setup: Add some whim cards to crowd_deck
        whim1 = WhimCard("WhimA", "", "DemandSegment:Frugalists:current_demand:+1", {}, "GlobalImpact:PINK:+1")
        whim2 = WhimCard("WhimB", "", "DemandSegment:Eco-Elites:current_price:+1", {}, "GlobalImpact:GREY:+1")
        self.game.game_state.crowd_deck = [whim1, whim2, WhimCard("WhimC", "", "", {}, "")] # num_players + 1 = 3

        initial_pink_level = self.game.game_state.impact_tracks[TrackColor.PINK].level
        initial_frugalist_demand = self.game.game_state.demand_segments["Frugalists"].current_demand

        # Mock player water for evaporation check - now uses water_batches
        # self.game.game_state.players[0].water_cubes_produced = 5 # Old way
        self.game.game_state.players[0].water_batches = [
            {'facility_name': 'TestFac', 'facility_tags': [], 'base_impact_profile': {}, 'quantity': 5, 'production_round': 1}
        ]


        # Mock the sales callback - for this test, assume no sales are made to simplify
        mock_sales_cb = unittest.mock.Mock(return_value=[]) # Returns empty list = no sales

        self.game.crowd_phase(get_player_sales_choices_cb=mock_sales_cb)

        # Check pre-effects
        self.assertEqual(self.game.game_state.demand_segments["Frugalists"].current_demand, initial_frugalist_demand + 1)
        # Check post-fallout
        self.assertEqual(self.game.game_state.impact_tracks[TrackColor.PINK].level, initial_pink_level + 1)
        # Check discard
        self.assertIn(whim1, self.game.game_state.whim_discard_pile)
        self.assertIn(whim2, self.game.game_state.whim_discard_pile)
        # Check evaporation
        self.assertEqual(self.game.game_state.players[0].get_total_water_produced(), 0)
        self.assertTrue(all(not p.water_batches for p in self.game.game_state.players if hasattr(p, 'water_batches'))) # All batches should be empty
        self.assertIn("unsold water cubes (from all batches) evaporate", "".join(self.game.game_state.game_log)) # Updated log message

    def test_resolve_whim_post_fallout_player_effect_sustainable_sipping(self):
        player1 = self.game.game_state.players[0]
        player2 = self.game.game_state.players[1]
        initial_rep_p1 = player1.reputation_stars
        initial_rep_p2 = player2.reputation_stars

        # Simulate player1 sold to Eco-Elites
        self.game.game_state.round_sales_to_eco_elites.add(player1.name)

        whim = WhimCard("Sustainable Sipping", "DEP < 4", "", {}, "PlayerEffect:EcoEliteBuyers:reputation_stars:+1")
        self.game.resolve_whim_post_fallout(whim)

        self.assertEqual(player1.reputation_stars, initial_rep_p1 + 1)
        self.assertEqual(player2.reputation_stars, initial_rep_p2) # Player2 did not sell to Eco-Elites
        self.assertIn(f"Player {player1.name} reputation_stars changed by 1", "".join(self.game.game_state.game_log))


    def test_threshold_check_phase_triggers_event(self):
        # Setup a global event and a track level to trigger it
        # Ensure there's at least one event tile available
        if not self.game.game_state.global_event_tiles_available:
            self.game.game_state.global_event_tiles_available.append(
                GlobalEventCard("Test Event From Test", TrackColor.PINK, 5, "A test event occurred.")
            )
        event_card = self.game.game_state.global_event_tiles_available[0]
        event_card.trigger_threshold = 5
        track_to_trigger = event_card.trigger_track
        self.game.game_state.impact_tracks[track_to_trigger].level = 5 # Set level to trigger

        self.game.threshold_check_phase()

        self.assertIn(event_card, self.game.game_state.global_event_tiles_active)
        # Updated assertion to match new log format
        self.assertIn(f"GLOBAL EVENT TRIGGERED: {event_card.name} - {event_card.effect_description}", "".join(self.game.game_state.game_log))

    def test_threshold_check_phase_uninhabitable(self):
        self.game.game_state.impact_tracks[TrackColor.PINK].level = 10
        self.game.game_state.impact_tracks[TrackColor.GREY].level = 10
        self.game.game_state.impact_tracks[TrackColor.BLUE].level = 10

        self.game.threshold_check_phase()

        self.assertTrue(self.game.game_state.uninhaitable)
        self.assertIn("Planet is Uninhabitable! Game Over.", "".join(self.game.game_state.game_log))

    def test_reset_round_modifiers(self):
        # Store base definitions for demand segments if not already done by GameState/GameLogic init
        # This test assumes GameLogic constructor or another method sets up a base definition store
        # For this test, we'll manually create it if not present
        if not hasattr(self.game.game_state, 'demand_segments_base_definitions'):
            self.game.game_state.demand_segments_base_definitions = {
                name: {'base_demand': seg.current_demand, 'base_price': seg.current_price}
                for name, seg in self.game.game_state.demand_segments.items()
            }

        # Modify a demand segment
        self.game.game_state.demand_segments["Frugalists"].current_demand += 5
        self.game.game_state.demand_segments["Frugalists"].current_price += 1

        self.game.reset_round_modifiers()

        base_frugalist_demand = self.game.game_state.demand_segments_base_definitions["Frugalists"]['base_demand']
        base_frugalist_price = self.game.game_state.demand_segments_base_definitions["Frugalists"]['base_price']

        self.assertEqual(self.game.game_state.demand_segments["Frugalists"].current_demand, base_frugalist_demand)
        self.assertEqual(self.game.game_state.demand_segments["Frugalists"].current_price, base_frugalist_price)
        self.assertIn("Demand segments reset to base values.", "".join(self.game.game_state.game_log))


    def test_final_scoring(self):
        player1 = self.game.game_state.players[0]
        player2 = self.game.game_state.players[1]

        player1.cred_coin = 20
        player1.reputation_stars = 5
        # player1.triggered_global_events = 1 # Assuming this attribute exists and is tracked

        player2.cred_coin = 15
        player2.reputation_stars = 10
        # player2.triggered_global_events = 0

        # Mocking diversity bonus and penalties for simplicity as they need more game context
        # For diversity: assume player1 used 3 routes, player2 used 2
        # For penalties: player1 triggered 1 event (-2 VP), player2 triggered 0

        # Expected scores (manual calculation for this test setup):
        # P1: 20 (CC) + 5 (Rep) = 25 VP
        # P2: 15 (CC) + 10 (Rep) = 25 VP
        # Tie-breaking not tested here.

        self.game.final_scoring()
        log_output = "".join(self.game.game_state.game_log)

        # Check for the detailed score breakdown in the log
        self.assertIn(f"Total VP: {player1.cred_coin + player1.reputation_stars}", log_output) # Check P1's total VP
        self.assertIn(f"Total VP: {player2.cred_coin + player2.reputation_stars}", log_output) # Check P2's total VP

        # Winner determination based on current simple scoring (no tie-breaker logic tested here)
        # Since scores are equal, the first player in list might be declared winner by max() if not stable.
        # Or it might be player2 if their name comes later alphabetically and scores are equal.
        # This depends on Python's max behavior with dicts or if a specific tie-breaker is implemented.
        # The current final_scoring just picks one if tied.
        # For this test, we are primarily checking if scoring calculation is logged.
        self.assertIn("Winner:", log_output)


if __name__ == '__main__':
    unittest.main()
