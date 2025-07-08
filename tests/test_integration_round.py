import unittest
from hypothesis import given, strategies as st
from water_barons.game_logic import GameLogic
from water_barons.game_entities import TrackColor


class TestIntegrationRound(unittest.TestCase):
    def run_scenario(self, winner_idx: int, speculate_track=TrackColor.GREY, marketing_segment="Frugalists"):
        player_names = ["Alice", "Bob"]
        game = GameLogic(num_players=2, player_names=player_names)

        # --- Whim Draft ---
        pick_info = game.initiate_whim_draft()
        while pick_info:
            player, options, pick_num = pick_info
            game.process_whim_draft_pick(player, 0)
            pick_info = game.request_next_whim_draft_pick()

        # --- Ops Phase ---
        p1, p2 = game.game_state.players
        # Ensure players have enough credits for all actions regardless of
        # which cards were drawn from the shuffled decks
        p1.cred_coin = 20
        p2.cred_coin = 20
        facility = game.game_state.facility_deck[0]
        route = game.game_state.distribution_deck[0]
        upgrade = game.game_state.upgrade_deck[0]
        event_card = game.game_state.global_event_tiles_available[0]

        actions = {
            p1.name: [
                [lambda: game.action_build_facility(p1, facility, 0),
                 lambda: game.action_build_distribution(p1, route, 0)],
                [lambda: game.action_produce_water(p1, 0),
                 lambda: game.action_tweak_add_upgrade(p1, upgrade, 'facility', 0)]
            ],
            p2.name: [
                [lambda: game.action_speculate(p2, 'long', speculate_track),
                 lambda: game.action_spin_marketing(p2, marketing_segment, 'increase')],
                [lambda: game.action_buy_event_option(p2, event_card.name, 4)]
            ],
        }
        counters = {p1.name: 0, p2.name: 0}

        def action_cb(player, action_num):
            acts = actions[player.name][counters[player.name]]
            for a in acts:
                a()
            counters[player.name] += 1

        game.ops_phase(action_cb)

        # --- Crowd Phase ---
        def sales_cb(player, water_batches, demand_opps, tracks):
            sales = []
            if water_batches:
                demand = demand_opps[0]
                for idx, batch in enumerate(water_batches):
                    qty = batch['quantity']
                    revenue = qty * demand['price']
                    route_card = player.distribution_routes[0]
                    sales.append((demand['name'], qty, revenue, route_card, idx, None))
            return sales

        game.crowd_phase(sales_cb)
        game.threshold_check_phase()
        game.reset_round_modifiers()

        # ensure chosen winner
        game.game_state.players[winner_idx].cred_coin += 10
        game.final_scoring()
        log = "".join(game.game_state.game_log)
        return log

    def test_player1_and_player2_can_win(self):
        log1 = self.run_scenario(0)
        self.assertIn("Winner: Alice", log1)

        log2 = self.run_scenario(1)
        self.assertIn("Winner: Bob", log2)

    @given(
        winner_idx=st.integers(min_value=0, max_value=1),
        spec_track=st.sampled_from(list(TrackColor)),
        segment=st.sampled_from(["Frugalists", "Convenientists", "Eco-Elites", "Connoisseurs"])
    )
    def test_full_round_hypothesis(self, winner_idx, spec_track, segment):
        log = self.run_scenario(winner_idx, speculate_track=spec_track, marketing_segment=segment)
        winner_name = ["Alice", "Bob"][winner_idx]
        self.assertIn(f"Winner: {winner_name}", log)
        # Ensure logs mention each action type
        self.assertRegex(log, r"built .* in slot")
        self.assertIn("activated", log)  # produce water
        self.assertIn("added upgrade", log)
        self.assertIn("bought a long token", log)
        self.assertIn("Spin Marketing", log)
        self.assertIn("Event Option", log)


if __name__ == '__main__':
    unittest.main()
