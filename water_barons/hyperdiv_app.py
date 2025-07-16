import hyperdiv as hd
import sys
import os

# Adjust path to import game logic from the parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from water_barons.game_logic import GameLogic
from water_barons.game_state import GameState
from water_barons.game_entities import Player, CardType

def main():
    state = hd.state(game_instance=None)

    if state.game_instance is None:
        player_names = ["Player 1", "Player 2"]
        state.game_instance = GameLogic(num_players=len(player_names), player_names=player_names)
        state.game_instance.start_game()

    game = state.game_instance
    gs = game.game_state
    current_player = gs.get_current_player()

    with hd.box(gap=1):
        hd.h1("Water Barons")

        if gs.whim_draft_active:
            with hd.box(border="1px solid neutral-100", padding=1, gap=0.5):
                hd.h2("Whim Draft")
                picker_index = gs.whim_draft_order[gs.whim_draft_current_picker_idx_in_order]
                picker = gs.players[picker_index]
                hd.text(f"It's {picker.name}'s turn to pick.")

                if picker.name == current_player.name:
                    options = gs.whim_draft_current_options[picker.name]
                    for i, card in enumerate(options):
                        if hd.button(f"Pick: {card.name}").clicked:
                            if game.process_whim_draft_pick(picker, i):
                                next_pick_info = game.request_next_whim_draft_pick()


        else:
            with hd.box(gap=0.5):
                hd.h2("Actions")
                build_button = hd.button("Build Glacial Tap (Slot 1)")
                if build_button.clicked:
                    card_to_build = None
                    for card in gs.facility_deck:
                        if card.name == "Glacial Tap":
                            card_to_build = card
                            break
                    if card_to_build:
                        if game.action_build_facility(current_player, card_to_build, 0):
                            gs.facility_deck.remove(card_to_build)

                draft_button = hd.button("Start Whim Draft")
                if draft_button.clicked:
                    game.initiate_whim_draft()
                    game.request_next_whim_draft_pick()

                next_player_button = hd.button("Next Player")
                if next_player_button.clicked:
                    gs.current_player_index = (gs.current_player_index + 1) % len(gs.players)


        with hd.box(gap=0.5):
            hd.h2("Game Information")
            hd.text(f"Round: {gs.round_number}")
            hd.text(f"Current Player: {current_player.name}")

        with hd.box(gap=0.5):
            hd.h2("Impact Tracks")
            for color, track in gs.impact_tracks.items():
                hd.text(f"{track.name}: {track.level}/{track.max_level}")

        with hd.box(gap=0.5):
            hd.h2("Player Dashboards")
            for player in gs.players:
                with hd.box(border="1px solid neutral-100", padding=1, gap=0.5):
                    hd.h3(player.name)
                    hd.text(f"CredCoin: {player.cred_coin}")
                    hd.text(f"Reputation: {player.reputation_stars}")
                    hd.text(f"Total Water Produced: {player.get_total_water_produced()}")
                    hd.text(f"Facilities: {', '.join([f.name for f in player.facilities if f]) or 'None'}")
                    hd.text(f"Distribution: {', '.join([d.name for d in player.distribution_routes if d]) or 'None'}")
                    hd.text(f"R&D: {', '.join([t.name for t in player.r_and_d if t]) or 'None'}")


        with hd.box(gap=0.5):
            hd.h2("Game Log")
            for entry in gs.game_log[-10:]:
                hd.text(entry)


if __name__ == "__main__":
    hd.run(main)
