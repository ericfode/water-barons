from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import sys
import os
from typing import Optional, Dict # Added for type hints

# Adjust path to import game logic from the parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from water_barons.game_logic import GameLogic
from water_barons.game_state import GameState
from water_barons.game_entities import Player, CardType # Added CardType
from water_barons.game_entities import WhimCard, FacilityCard, DistributionCard, UpgradeCard, GlobalEventCard # For isinstance checks or specific attrs

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_water_barons_key!' # Replace with a real secret key in production
socketio = SocketIO(app, async_mode='eventlet')

# Global game instance - for simplicity in this prototype.
# In a multi-game or multi-user scenario, this would need to be managed per session/game room.
game_instance: Optional[GameLogic] = None
# To store which SocketIO session ID belongs to which player (index or name)
player_sessions: Dict[str, str] = {}


@app.route('/')
def index():
    """Serves the main game page."""
    return render_template('index.html')

def get_player_id_from_sid(sid):
    # Simple lookup, assuming player_sessions is populated
    for player_id, session_id in player_sessions.items():
        if session_id == sid:
            return player_id
    return None # Or a default/observer ID

def serialize_card(card): # Add type hint for card later e.g. card: Card
    if not card:
        return None

    card_data = {'name': card.name, 'description': card.description, 'cost': card.cost, 'card_type': card.card_type.name}

    if card.card_type == CardType.WHIM: # Check if CardType is imported
        # Ensure WhimCard specific attributes are accessed safely
        card_data['trigger_condition'] = getattr(card, 'trigger_condition', '')
        card_data['pre_round_effect'] = getattr(card, 'pre_round_effect', '')
        card_data['post_round_fallout'] = getattr(card, 'post_round_fallout', '')
    elif card.card_type == CardType.FACILITY:
        card_data['base_output'] = getattr(card, 'base_output', 0)
        card_data['impact_profile'] = {k.name: v for k,v in getattr(card, 'impact_profile', {}).items()}
        card_data['tags'] = getattr(card, 'tags', [])
    # Add more elif for other card types if specific serialization needed for them

    return card_data

def serialize_player(player: Player) -> dict:
    return {
        'name': player.name,
        'cred_coin': player.cred_coin,
        'reputation_stars': player.reputation_stars,
        'total_water_produced': player.get_total_water_produced(),
        'water_batches': [{
            'facility_name': wb['facility_name'],
            'quantity': wb['quantity'],
            'base_impact_profile': {k.name: v for k,v in wb['base_impact_profile'].items()},
            'facility_tags': wb['facility_tags']
        } for wb in player.water_batches],
        'facilities': [serialize_card(f) for f in player.facilities],
        'distribution_routes': [serialize_card(r) for r in player.distribution_routes],
        'r_and_d': [serialize_card(tech) for tech in player.r_and_d],
        'futures_tokens': [str(ft) for ft in player.futures_tokens], # str() is a placeholder
        'event_options': [str(eo) for eo in player.event_options], # str() is a placeholder
        'impact_storage': {k.name: v for k,v in player.impact_storage.items()},
    }


def serialize_game_state(gs: GameState) -> dict:
    if not gs:
        return {}
    return {
        'round_number': gs.round_number,
        'current_player_name': gs.get_current_player().name if gs.players and gs.current_player_index < len(gs.players) else "N/A",
        'current_player_index': gs.current_player_index,
        'players': [serialize_player(p) for p in gs.players],
        'impact_tracks': {
            track_color.name: {
                'name': track.name,
                'level': track.level,
                'max_level': track.max_level
            } for track_color, track in gs.impact_tracks.items()
        },
        'demand_segments': {
            name: {
                'name': seg.name,
                'current_demand': seg.current_demand,
                'current_price': seg.current_price,
                'values_description': seg.values_description
            } for name, seg in gs.demand_segments.items()
        },
        'crowd_deck_size': len(gs.crowd_deck),
        'whim_discard_pile_top': serialize_card(gs.whim_discard_pile[-1]) if gs.whim_discard_pile else None,
        'active_global_events': [serialize_card(e) for e in gs.global_event_tiles_active],
        'log': gs.game_log[-20:], # Last 20 log entries
        'uninhaitable': gs.uninhaitable
    }

def broadcast_game_state():
    global game_instance
    if game_instance:
        state = serialize_game_state(game_instance.game_state)
        socketio.emit('game_state_update', state)
        # print("Broadcasting game state") # For debugging

@socketio.on('connect')
def handle_connect():
    """Handles new client connections."""
    global game_instance, player_sessions
    print(f'Client connected: {request.sid}')

    num_expected_players = 2 # Hardcoded for now

    if game_instance is None:
        player_names = [f"Player {i+1}" for i in range(num_expected_players)]
        game_instance = GameLogic(num_players=len(player_names), player_names=player_names)
        game_instance.start_game()
        player_sessions = {} # Reset player sessions for a new game
        print("New game instance created.")

    # Assign player slot if available
    # This is a very basic way to assign players. Needs improvement for robustness.
    assigned_player_id = None
    if len(player_sessions) < num_expected_players:
        # Find the first unassigned player name that doesn't have a session ID yet
        for p_idx, p_name in enumerate(game_instance.game_state.players):
            if p_name not in player_sessions.values(): # Check if name is already taken by a session value
                 # Check if this player_name (key) is already in player_sessions pointing to another sid
                is_name_key_taken = any(key_name == p_name for key_name in player_sessions.keys())
                if not is_name_key_taken:
                    player_sessions[request.sid] = p_name # Store sid -> player_name
                    assigned_player_id = p_name
                    emit('assign_player_id', {'playerId': p_name, 'playerIndex': p_idx })
                    print(f"Assigned {p_name} (P{p_idx+1}) to session {request.sid}")
                    break

    if not assigned_player_id and len(player_sessions) >= num_expected_players:
         emit('message', {'data': 'Game is full. Connected as observer.'})


    # Always send the current game state
    broadcast_game_state()


@socketio.on('disconnect')
def handle_disconnect():
    global player_sessions
    print(f'Client disconnected: {request.sid}')
    # Remove player from session mapping if they were assigned
    if request.sid in player_sessions:
        player_name = player_sessions.pop(request.sid)
        print(f"Player {player_name} from session {request.sid} removed.")
    # TODO: Handle game state if a player disconnects mid-game (e.g., pause, AI takeover, etc.)

# --- Whim Draft Handlers ---
@socketio.on('start_whim_draft')
def on_start_whim_draft():
    global game_instance
    sid = request.sid
    player_name = player_sessions.get(sid)

    if not game_instance or not player_name:
        emit('error_message', {'message': 'Game or player not initialized.'}, room=sid)
        return

    # Potentially check if it's an appropriate time to start draft (e.g., between rounds)
    # For now, allow manual trigger for testing.
    print(f"'{player_name}' initiated Whim Draft.")
    game_instance.initiate_whim_draft() # This will setup GameState for drafting

    # The first pick request is part of initiate_whim_draft now via internal call
    next_pick_info = game_instance.request_next_whim_draft_pick()
    if next_pick_info:
        player_to_pick, options, pick_num = next_pick_info
        target_sid = next((s for s, name in player_sessions.items() if name == player_to_pick.name), None)
        if target_sid:
            serialized_options = [serialize_card(c) for c in options]
            emit('whim_draft_options', {'player_name': player_to_pick.name, 'options': serialized_options, 'pick_num': pick_num}, room=target_sid)
            print(f"Sent draft options to {player_to_pick.name} (SID: {target_sid})")
    else: # Draft finished immediately (e.g. no players/picks) or error
        broadcast_game_state()


@socketio.on('submit_whim_draft_choice')
def on_submit_whim_draft_choice(data):
    global game_instance
    sid = request.sid
    player_name = player_sessions.get(sid)

    if not game_instance or not player_name or not game_instance.game_state.whim_draft_active:
        emit('error_message', {'message': 'Cannot submit draft choice: Draft not active or player invalid.'}, room=sid)
        return

    # Verify it's this player's turn to pick based on game_state draft order
    current_expected_picker_idx = game_instance.game_state.whim_draft_order[game_instance.game_state.whim_draft_current_picker_idx_in_order]
    current_expected_player = game_instance.game_state.players[current_expected_picker_idx]

    if current_expected_player.name != player_name:
        emit('error_message', {'message': f"Not your turn to draft. Waiting for {current_expected_player.name}."}, room=sid)
        return

    chosen_card_index = data.get('chosen_card_index')

    if game_instance.process_whim_draft_pick(current_expected_player, chosen_card_index):
        print(f"{player_name} submitted draft choice: index {chosen_card_index}")
        broadcast_game_state() # Update everyone on the general state change (e.g. crowd deck size)

        # Request next pick
        next_pick_info = game_instance.request_next_whim_draft_pick()
        if next_pick_info:
            player_to_pick, options, pick_num = next_pick_info
            target_sid = next((s for s, name in player_sessions.items() if name == player_to_pick.name), None)
            if target_sid:
                serialized_options = [serialize_card(c) for c in options]
                emit('whim_draft_options', {'player_name': player_to_pick.name, 'options': serialized_options, 'pick_num': pick_num}, room=target_sid)
                print(f"Sent next draft options to {player_to_pick.name}")
        else: # Draft finished
            print("Whim draft complete after player submission.")
            # broadcast_game_state() was already called, or could be called again if specific end-draft state needed
    else:
        emit('error_message', {'message': 'Failed to process draft pick.'}, room=sid)


@socketio.on('player_action')
def handle_player_action(data):
    """Handles actions sent by players."""
    global game_instance, player_sessions
    sid = request.sid

    if not game_instance:
        emit('error_message', {'message': 'Game not initialized.'}, room=sid)
        return

    player_name_from_session = player_sessions.get(sid)
    if not player_name_from_session:
        emit('error_message', {'message': 'You are not recognized as a player in this game.'}, room=sid)
        return

    # Prevent actions if whim draft is active and it's not this player's turn to pick
    # (or more generally, if game is in a state where this player shouldn't act)
    if game_instance.game_state.whim_draft_active:
         emit('error_message', {'message': 'Cannot perform action: Whim Draft is active.'}, room=sid)
         return


    current_player_in_game = game_instance.game_state.get_current_player()
    if current_player_in_game.name != player_name_from_session:
        emit('error_message', {'message': f"It's not your turn. Current player is {current_player_in_game.name}."}, room=sid)
        return

    action_type = data.get('action_type')
    payload = data.get('payload', {})
    print(f"Received action from {player_name_from_session} (SID: {sid}): {action_type} with payload {payload}")

    success = False
    if action_type == 'build_facility':
        card_name = payload.get('card_name')
        slot_index = payload.get('slot_index')

        if card_name is not None and slot_index is not None:
            # Find the card from the deck (simplistic: assumes it's available and takes first found)
            # TODO: A real market or hand management would be needed.
            card_to_build = None
            for card in game_instance.game_state.facility_deck:
                if card.name == card_name:
                    card_to_build = card
                    break

            if card_to_build:
                if game_instance.action_build_facility(current_player_in_game, card_to_build, slot_index):
                    # Remove card from deck if successfully built
                    game_instance.game_state.facility_deck.remove(card_to_build)
                    success = True
                else:
                    # game_logic already logs failure reasons
                    emit('action_feedback', {'success': False, 'message': f"Failed to build {card_name}. Check game log."}, room=sid)
            else:
                emit('action_feedback', {'success': False, 'message': f"Card '{card_name}' not found in deck."}, room=sid)
        else:
            emit('action_feedback', {'success': False, 'message': 'Missing card_name or slot_index for build_facility.'}, room=sid)

    # Add other action handlers here (flow, route, etc.)
    # elif action_type == 'flow': ...

    if success:
        # Potentially advance turn or game phase if applicable after this action
        # For now, just broadcast the state.
        # Example: if game_instance.game_state.actions_taken_this_turn == 2: game_instance.game_state.next_player_or_phase()
        emit('action_feedback', {'success': True, 'message': f"Action '{action_type}' successful."}, room=sid)
        broadcast_game_state() # Update all clients
    else:
        # If not successful but not handled by specific emit above
        if not payload.get('card_name'): # Avoid redundant message if card not found
             emit('action_feedback', {'success': False, 'message': f"Action '{action_type}' failed or was invalid."}, room=sid)


if __name__ == '__main__':
    # Use eventlet as the WSGI server for Flask-SocketIO
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    # Note: `debug=True` for Flask reloader can sometimes cause issues with SocketIO.
    # If issues, try `debug=False, use_reloader=False` for socketio.run
    # or run with `eventlet.wsgi.server(eventlet.listen(('', 5000)), app)` directly.

# To run this (from the main project root, not webapp directory):
# python -m webapp.app
# Or navigate to webapp and run: python app.py (if path adjustments are robust)
# Best is `python -m webapp.app` from project root.
