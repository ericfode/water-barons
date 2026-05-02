import unittest

from water_barons.game_logic import GameLogic


class TestWhimDraftExtraPick(unittest.TestCase):
    def test_extra_pick_flag(self):
        game = GameLogic(num_players=2, player_names=['A', 'B'])
        game.game_state.players[0].draw_extra_whim_flag = True
        game.initiate_whim_draft()
        self.assertEqual(game.game_state.whim_draft_player_picks_remaining[0], 3)
        self.assertFalse(game.game_state.players[0].draw_extra_whim_flag)


if __name__ == '__main__':
    unittest.main()
