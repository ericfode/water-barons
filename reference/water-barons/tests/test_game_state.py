import unittest
import tempfile
import os
from water_barons.game_state import GameState, ImpactTrack
from water_barons.game_entities import TrackColor, Player, GlobalEventCard
from water_barons.cards import get_all_global_event_tiles # To get some sample events

class TestImpactTrack(unittest.TestCase):
    def test_track_creation(self):
        track = ImpactTrack("Microplastics", TrackColor.PINK, "Plastic bits.")
        self.assertEqual(track.name, "Microplastics")
        self.assertEqual(track.color, TrackColor.PINK)
        self.assertEqual(track.level, 0)
        self.assertEqual(track.max_level, 10)

    def test_add_impact(self):
        track = ImpactTrack("CO2", TrackColor.GREY, "Smog.")
        track.add_impact(3)
        self.assertEqual(track.level, 3)
        track.add_impact(5)
        self.assertEqual(track.level, 8)
        track.add_impact(5) # Try to go over max
        self.assertEqual(track.level, 10) # Should cap at max_level

    def test_reduce_impact(self):
        track = ImpactTrack("Depletion", TrackColor.BLUE, "Dry wells.")
        track.add_impact(7)
        track.reduce_impact(3)
        self.assertEqual(track.level, 4)
        track.reduce_impact(5) # Try to go below zero
        self.assertEqual(track.level, 0) # Should cap at 0

    def test_threshold_crossing(self):
        track = ImpactTrack("CO2", TrackColor.GREY, "Smog.")
        track.thresholds = {6: "Level 6 warning", 9: "Level 9 critical"}

        self.assertFalse(track.add_impact(5)) # 0 -> 5, no threshold crossed
        self.assertEqual(track.level, 5)

        self.assertTrue(track.add_impact(2))  # 5 -> 7, crosses 6
        self.assertEqual(track.level, 7)

        self.assertFalse(track.add_impact(1)) # 7 -> 8, no new threshold
        self.assertEqual(track.level, 8)

        self.assertTrue(track.add_impact(1))  # 8 -> 9, crosses 9
        self.assertEqual(track.level, 9)

        track.level = 0 # Reset
        self.assertTrue(track.add_impact(10)) # 0 -> 10, crosses 6 and 9
        self.assertEqual(track.level, 10)


class TestGameState(unittest.TestCase):
    def setUp(self):
        self.player_names = ["Alice", "Bob"]
        self.gs = GameState(num_players=2, player_names=self.player_names)

    def test_game_state_creation(self):
        self.assertEqual(len(self.gs.players), 2)
        self.assertEqual(self.gs.players[0].name, "Alice")
        self.assertEqual(self.gs.round_number, 1)
        self.assertIsNotNone(self.gs.impact_tracks[TrackColor.PINK])
        self.assertEqual(len(self.gs.demand_segments), 4) # Frugalists, Convenientists, etc.

    def test_current_player(self):
        self.assertEqual(self.gs.get_current_player().name, "Alice")
        self.gs.next_player()
        self.assertEqual(self.gs.get_current_player().name, "Bob")
        self.gs.next_player()
        self.assertEqual(self.gs.get_current_player().name, "Alice") # Wrap around

    def test_add_global_impact_and_event_trigger(self):
        # Add a sample global event that can be triggered
        sample_event = GlobalEventCard("Test Event", TrackColor.PINK, 5, "Pink stuff happened.")
        self.gs.global_event_tiles_available.append(sample_event)

        self.gs.add_global_impact(TrackColor.PINK, 3)
        self.assertEqual(self.gs.impact_tracks[TrackColor.PINK].level, 3)
        self.assertNotIn(sample_event, self.gs.global_event_tiles_active)

        self.gs.add_global_impact(TrackColor.PINK, 3) # Total 6, crosses threshold 5
        self.assertEqual(self.gs.impact_tracks[TrackColor.PINK].level, 6)
        self.assertIn(sample_event, self.gs.global_event_tiles_active)
        self.assertIn(f"GLOBAL EVENT TRIGGERED: {sample_event.name}", self.gs.game_log[-1])

    def test_check_for_uninhabitable(self):
        self.assertFalse(self.gs.uninhaitable)
        self.gs.impact_tracks[TrackColor.PINK].level = 10
        self.gs.impact_tracks[TrackColor.GREY].level = 10
        self.gs.check_for_uninhabitable() # Only 2 maxed
        self.assertFalse(self.gs.uninhaitable)

        self.gs.impact_tracks[TrackColor.BLUE].level = 10 # Third track maxed
        self.gs.check_for_uninhabitable()
        self.assertTrue(self.gs.uninhaitable)
        self.assertIn("PLANET UNINHABITABLE!", self.gs.game_log[-1])

    def test_initialize_track_thresholds(self):
        # Check if some known thresholds are set
        self.assertIn(6, self.gs.impact_tracks[TrackColor.GREY].thresholds) # CO2 Level 6
        self.assertEqual(self.gs.impact_tracks[TrackColor.GREY].thresholds[6], "CO2_Level_6_Effect")
        self.assertIn(5, self.gs.impact_tracks[TrackColor.BLUE].thresholds) # DEP Level 5
        self.assertEqual(self.gs.impact_tracks[TrackColor.BLUE].thresholds[5], "DEP_Level_5_Effect")

    def test_save_and_load(self):
        self.gs.round_number = 3
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            path = tmp.name
        try:
            self.gs.save_to_file(path)
            loaded = GameState.load_from_file(path)
            self.assertEqual(loaded.round_number, 3)
            self.assertEqual(len(loaded.players), 2)
        finally:
            os.remove(path)


if __name__ == '__main__':
    unittest.main()
