import unittest
from unittest.mock import patch, MagicMock
from water_barons.cli import CLI
from water_barons.game_logic import GameLogic

class TestCLI(unittest.TestCase):
    @patch('builtins.input', side_effect=['1', 'Alice'])
    def test_start_invokes_game_loop(self, mock_in):
        cli = CLI()
        with patch.object(cli, '_game_loop') as mock_loop:
            cli.start()
            mock_loop.assert_called_once()
            self.assertIsInstance(cli.game_logic, GameLogic)

    @patch('builtins.input', side_effect=['0', '5', '2'])
    def test_get_num_players_validation(self, mock_in):
        cli = CLI()
        num = cli._get_num_players()
        self.assertEqual(num, 2)

    @patch('builtins.print')
    @patch('builtins.input', side_effect=['1', '1'])
    def test_cli_action_build_facility(self, mock_in, mock_print):
        cli = CLI()
        cli.game_logic = GameLogic(1, ['Alice'])
        player = cli.game_logic.game_state.players[0]
        cli.game_logic.action_build_facility = MagicMock(return_value=True)
        initial_len = len(cli.game_logic.game_state.facility_deck)
        cli._cli_action_build_facility(player)
        cli.game_logic.action_build_facility.assert_called_once()
        self.assertEqual(len(cli.game_logic.game_state.facility_deck), initial_len - 1)

if __name__ == '__main__':
    unittest.main()
