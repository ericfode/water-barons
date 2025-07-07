from water_barons.game_logic import GameLogic
from water_barons.game_entities import FacilityCard, DistributionCard, UpgradeCard, WhimCard
from water_barons.cards import ACTIONS_DATA

class CLI:
    """Command Line Interface for playing Water Barons."""
    def __init__(self):
        self.game_logic: GameLogic = None

    def start(self):
        print("Welcome to Water Barons - Command Line Edition!")
        num_players = self._get_num_players()
        player_names = self._get_player_names(num_players)

        self.game_logic = GameLogic(num_players, player_names)
        self.game_logic.start_game()

        self._game_loop()

    def _get_num_players(self) -> int:
        while True:
            try:
                num = int(input("Enter number of players (e.g., 2-4): "))
                if 1 <= num <= 4: # Assuming 1 player for testing solitaire, up to 4 for normal.
                    return num
                else:
                    print("Please enter a number between 1 and 4.")
            except ValueError:
                print("Invalid input. Please enter a number.")

    def _get_player_names(self, num_players: int) -> list[str]:
        names = []
        for i in range(num_players):
            while True:
                name = input(f"Enter name for Player {i+1}: ").strip()
                if name and name not in names:
                    names.append(name)
                    break
                elif name in names:
                    print("Name already taken. Please choose a different name.")
                else:
                    print("Name cannot be empty.")
        return names

    def _display_game_state(self):
        gs = self.game_logic.game_state
        print("\n--- Current Game State ---")
        print(f"Round: {gs.round_number}, Current Player: {gs.get_current_player().name if gs.players else 'N/A'}")
        print("Impact Tracks:")
        for color, track in gs.impact_tracks.items():
            print(f"  {track.name} ({color.name}): {track.level}/{track.max_level}")

        print("Demand Segments:")
        for name, segment in gs.demand_segments.items():
            print(f"  {name}: Demand={segment.current_demand}, Price={segment.current_price} CC")

        if gs.global_event_tiles_active:
            print("Active Global Events:")
            for event in gs.global_event_tiles_active:
                print(f"  - {event.name}: {event.effect_description}")
        print("--- End of State ---")

    def _display_player_dashboard(self, player):
        print(f"\n--- {player.name}'s Dashboard ---")
        print(f"CredCoin: {player.cred_coin}, Reputation: {player.reputation_stars}")
        # print(f"Water Cubes Produced (available to sell): {player.water_cubes_produced}") # Old way
        print(f"Total Water Available: {player.get_total_water_produced()} cubes from {len(player.water_batches)} batches.")
        if player.water_batches:
            print("Water Batches:")
            for i, batch in enumerate(player.water_batches):
                print(f"  Batch {i+1}: {batch['quantity']} cubes from {batch['facility_name']} (Impacts: {batch['base_impact_profile']}, Tags: {batch['facility_tags']})")

        print("Facilities:")
        for i, facility in enumerate(player.facilities):
            if facility:
                print(f"  Slot {i+1}: {facility.name} (Output: {facility.base_output}) Upgrades: {len(facility.upgrades)}")
            else:
                print(f"  Slot {i+1}: Empty")

        print("Distribution Routes:")
        for i, route in enumerate(player.distribution_routes):
            if route:
                print(f"  Slot {i+1}: {route.name}")
            else:
                print(f"  Slot {i+1}: Empty")

        print(f"R&D Techs: {[tech.name for tech in player.r_and_d] if player.r_and_d else 'None'}")
        print("Impact Storage (to be added to global tracks at end of round):")
        for track_color, amount in player.impact_storage.items():
            if amount > 0:
                print(f"  {track_color.name}: {amount}")
        if not any(player.impact_storage.values()):
            print("  None")

        print(f"Futures Tokens: {[str(token) for token in player.futures_tokens] if player.futures_tokens else 'None'}")
        print("--- End of Dashboard ---")


    def _get_player_draft_choice(self, player, options: list[WhimCard], pick_number: int) -> int:
        """CLI callback for player to choose a Whim card during draft."""
        print(f"\n{player.name}, it's your turn to draft (Pick {pick_number}).")
        print("Choose a Whim card to add to the Crowd Deck:")
        for i, card in enumerate(options):
            print(f"  {i+1}. {card.name} (Trigger: {card.trigger_condition}, Pre: {card.pre_round_effect}, Post: {card.post_round_fallout})")

        while True:
            try:
                choice = input(f"Select card number (1-{len(options)}) or 0 to pass/auto-pick: ")
                choice_idx = int(choice) -1
                if choice_idx == -1: # Pass or auto-pick (game logic might assign one)
                    print(f"{player.name} passes the pick.")
                    # GameLogic will handle if no choice is made, maybe by assigning the first.
                    # Or we can enforce a choice here. For now, -1 signals a pass to GameLogic.
                    return -1 # Or handle auto-pick here by returning 0
                if 0 <= choice_idx < len(options):
                    return choice_idx
                else:
                    print(f"Invalid selection. Please enter a number between 1 and {len(options)} or 0.")
            except ValueError:
                print("Invalid input. Please enter a number.")

    def _handle_player_action_choice(self, player, action_num: int):
        """CLI callback for player to choose an action during Ops Phase.
        This function is called by GameLogic.ops_phase.
        It then calls the specific game_logic.action_* methods.
        """
        self._display_player_dashboard(player)
        print(f"\n{player.name}, choose Action {action_num} of 2:")
        print("Available actions:")
        for idx, action in enumerate(ACTIONS_DATA, start=1):
            desc = action.get("description", "")
            if desc:
                print(f"{idx}. {action['name']} - {desc}")
            else:
                print(f"{idx}. {action['name']}")
        pass_idx = len(ACTIONS_DATA) + 1
        view_idx = pass_idx + 1
        print(f"{pass_idx}. Pass Action")
        print(f"{view_idx}. View Full Game State")

        while True:
            try:
                prompt = f"Enter action number (1-{view_idx}): "
                choice = input(prompt).strip()
                if choice == str(pass_idx):
                    print(f"{player.name} passes action {action_num}.")
                    self.game_logic.game_state.game_log.append(f"{player.name} passed action {action_num}.")
                    break
                elif choice == str(view_idx):
                    self._display_game_state() # Show full state then re-prompt
                    self._display_player_dashboard(player) # Show player state again
                    print(f"\n{player.name}, choose Action {action_num} of 2 (after viewing state):")
                    for idx, action in enumerate(ACTIONS_DATA, start=1):
                        desc = action.get("description", "")
                        if desc:
                            print(f"{idx}. {action['name']} - {desc}")
                        else:
                            print(f"{idx}. {action['name']}")
                    print(f"{pass_idx}. Pass Action\n{view_idx}. View Full Game State")
                    continue # Re-loop for action choice
                elif choice.isdigit() and 1 <= int(choice) <= len(ACTIONS_DATA):
                    action_idx = int(choice) - 1
                    action_method = ACTIONS_DATA[action_idx]['method']
                    method_name = f"_cli_{action_method}"
                    if hasattr(self, method_name):
                        getattr(self, method_name)(player)
                    else:
                        print(f"Action {action_method} not implemented.")
                    break
                else:
                    print("Invalid choice. Please try again.")
            except Exception as e:
                print(f"An error occurred during action selection: {e}")
                # Log this error more formally if possible
                break # Break from action choice on error

    def _cli_action_build_facility(self, player):
        """CLI part for building a facility."""
        print("\nAction: Build Facility")
        available_cards = self.game_logic.game_state.facility_deck
        if not available_cards: # Corrected variable name
            print("No facilities left in the deck.")
            return

        market_options = available_cards[:3]
        if not market_options:
            print("No facilities available to build.")
            return

        print("Available facilities to build (Cost CC):")
        for i, card in enumerate(market_options): # Corrected variable name
            print(f"  {i+1}. {card.name} (Cost: {card.cost}, Output: {card.base_output}, Impact: {card.impact_profile})")

        empty_slots = [i for i, slot in enumerate(player.facilities) if slot is None]
        if not empty_slots:
            print(f"{player.name} has no empty facility slots.")
            return
        print(f"Available facility slots: {[s+1 for s in empty_slots]}")

        try:
            choice_str = input(f"Choose facility to build (1-{len(market_options)}) or 0 to cancel: ")
            card_choice_idx = int(choice_str) - 1
            if card_choice_idx == -1: return

            if 0 <= card_choice_idx < len(market_options):
                chosen_card = market_options[card_choice_idx]

                slot_choice_str = input(f"Choose slot to build {chosen_card.name} in ({', '.join(map(str, [s+1 for s in empty_slots]))}): ")
                slot_choice_idx = int(slot_choice_str) - 1

                if slot_choice_idx not in empty_slots:
                    print("Invalid or occupied slot choice.")
                    return

                if self.game_logic.action_build_facility(player, chosen_card, slot_choice_idx):
                    # Remove from deck (actual market might behave differently)
                    self.game_logic.game_state.facility_deck.pop(self.game_logic.game_state.facility_deck.index(chosen_card))
                    print(f"Successfully built {chosen_card.name}.")
                # GameLogic action_build_facility will log success/failure reasons.
            else:
                print("Invalid facility choice.")
        except ValueError:
            print("Invalid input. Please enter numbers.")
        except Exception as e:
            print(f"Error building facility: {e}")


    def _cli_action_produce_water(self, player):
        """CLI part for producing water."""
        print("\nAction: Flow (Produce Water)")
        active_facilities_with_indices = [(i, fac) for i, fac in enumerate(player.facilities) if fac is not None]

        if not active_facilities_with_indices:
            print(f"{player.name} has no facilities to produce water.")
            return

        print("Choose facility to activate for Flow:")
        for i, (slot_idx, facility) in enumerate(active_facilities_with_indices):
            print(f"  {i+1}. Slot {slot_idx+1}: {facility.name} (Base Output: {facility.base_output})")

        try:
            choice_str = input(f"Enter choice (1-{len(active_facilities_with_indices)}) or 0 to cancel: ")
            choice_idx = int(choice_str) - 1
            if choice_idx == -1: return

            if 0 <= choice_idx < len(active_facilities_with_indices):
                slot_to_activate, facility_to_flow = active_facilities_with_indices[choice_idx]
                self.game_logic.action_produce_water(player, slot_to_activate)
                # GameLogic action_produce_water logs results.
            else:
                print("Invalid choice.")
        except ValueError:
            print("Invalid input. Please enter a number.")
        except Exception as e:
            print(f"Error producing water: {e}")

    def _cli_action_build_distribution(self, player):
        """CLI part for building a distribution route."""
        print("\nAction: Build Distribution Route")
        available_cards = self.game_logic.game_state.distribution_deck
        if not available_cards:
            print("No distribution cards left in the deck.")
            return

        market_options = available_cards[:3]
        if not market_options:
            print("No distribution cards available to build.")
            return

        print("Available distribution routes to build (Cost CC):")
        for i, card in enumerate(market_options):
            print(f"  {i+1}. {card.name} (Cost: {card.cost}, Desc: {card.description})")

        empty_slots = [i for i, slot in enumerate(player.distribution_routes) if slot is None]
        if not empty_slots:
            print(f"{player.name} has no empty distribution slots.")
            return
        print(f"Available distribution slots: {[s+1 for s in empty_slots]}")

        try:
            choice_str = input(f"Choose route to build (1-{len(market_options)}) or 0 to cancel: ")
            card_choice_idx = int(choice_str) - 1
            if card_choice_idx == -1: return

            if 0 <= card_choice_idx < len(market_options):
                chosen_card = market_options[card_choice_idx]

                slot_choice_str = input(f"Choose slot for {chosen_card.name} ({', '.join(map(str, [s+1 for s in empty_slots]))}): ")
                slot_choice_idx = int(slot_choice_str) - 1

                if slot_choice_idx not in empty_slots:
                    print("Invalid or occupied slot choice.")
                    return

                if self.game_logic.action_build_distribution(player, chosen_card, slot_choice_idx):
                    self.game_logic.game_state.distribution_deck.pop(self.game_logic.game_state.distribution_deck.index(chosen_card))
                    print(f"Successfully built {chosen_card.name} route.")
            else:
                print("Invalid route choice.")
        except ValueError:
            print("Invalid input. Please enter numbers.")
        except Exception as e:
            print(f"Error building distribution route: {e}")


    def _cli_action_tweak_upgrade(self, player):
        """CLI part for adding an upgrade/mitigation."""
        print("\nAction: Tweak (Add Upgrade/Mitigation)")
        available_cards = self.game_logic.game_state.upgrade_deck
        if not available_cards:
            print("No upgrade cards left in the deck.")
            return

        market_options = available_cards[:3]
        if not market_options:
            print("No upgrade cards available to build.")
            return

        print("Available Upgrades (Cost CC):")
        for i, card in enumerate(market_options):
            print(f"  {i+1}. {card.name} (Cost: {card.cost}, Effect: {card.effect_description})")

        try:
            choice_str = input(f"Choose upgrade to acquire (1-{len(market_options)}) or 0 to cancel: ")
            card_choice_idx = int(choice_str) - 1
            if card_choice_idx == -1: return

            if 0 <= card_choice_idx < len(market_options):
                chosen_upgrade_card = market_options[card_choice_idx]

                # For simplicity, facility upgrades are applied to the first valid facility.
                # Route upgrades or R&D are handled by game logic.
                # A more complex CLI would ask where to apply it.
                print("Applying to: 1. Facility, 2. R&D/Route (General)") # Simplified choice
                apply_target_type_str = input("Choose target type (1 or 2): ")

                target_type = ""
                target_slot = 0 # Default for R&D or non-specific

                if apply_target_type_str == '1': # Facility
                    target_type = 'facility'
                    active_facilities = [(i, fac.name) for i, fac in enumerate(player.facilities) if fac]
                    if not active_facilities:
                        print("No facilities to upgrade.")
                        return
                    print("Choose facility to upgrade:")
                    for i, (slot_idx, name) in enumerate(active_facilities):
                        print(f"  {i+1}. Slot {slot_idx+1}: {name}")

                    fac_choice_str = input(f"Facility choice (1-{len(active_facilities)}): ")
                    fac_choice_idx = int(fac_choice_str) -1
                    if 0 <= fac_choice_idx < len(active_facilities):
                        target_slot = active_facilities[fac_choice_idx][0]
                    else:
                        print("Invalid facility choice for upgrade.")
                        return
                else: # R&D or general route upgrade (simplified)
                    target_type = 'route' # Game logic will handle if it's R&D or other

                if self.game_logic.action_tweak_add_upgrade(player, chosen_upgrade_card, target_type, target_slot):
                    self.game_logic.game_state.upgrade_deck.pop(self.game_logic.game_state.upgrade_deck.index(chosen_upgrade_card))
                    print(f"Successfully acquired/applied {chosen_upgrade_card.name}.")
            else:
                print("Invalid upgrade choice.")
        except ValueError:
            print("Invalid input. Please enter numbers.")
        except Exception as e:
            print(f"Error applying upgrade: {e}")

    def _cli_action_speculate(self, player):
        """CLI part for buying/selling futures."""
        print("\nAction: Speculate (Aqua-Futures Market)")
        # Display current futures and options
        print(f"Current Track Futures: {[str(token) for token in player.futures_tokens] if player.futures_tokens else 'None'}")
        print(f"Current Event Options: {[str(opt) for opt in player.event_options] if player.event_options else 'None'}")

        if player.cred_coin < 2 and not player.futures_tokens : # Min cost of any action is 1 (sell) or 2 (buy future)
            print(f"{player.name} has insufficient CredCoin for new speculations and no tokens to sell.")
            return

        print("\nChoose speculation action:")
        print("1. Buy Track-Based Futures Token (Cost: 2 CC, Max 3 held)")
        if player.futures_tokens:
            print("2. Sell/Dump Unmatured Track-Based Futures Token (Gain: 1 CC)")
        print("3. Buy Event Option (Cost: 4 CC)") # New option for Event Options

        action_choice = input("Enter action (1-3, or 0 to cancel): ")
        if action_choice == '0': return

        if action_choice == '1': # Buy Track-Based Future
            if len(player.futures_tokens) >= 3: # Max 3 of *track-based* futures
                print(f"{player.name} already has max (3) track-based futures tokens. Cannot buy more now.")
                return
            if player.cred_coin < 2:
                print(f"{player.name} has insufficient CredCoin to buy a token (needs 2 CC).")
                return

            print("\nChoose speculation type to buy:")
            print("1. Long (bet track will increase by >= 2 steps)")
            print("2. Short (bet track will decrease by >= 2 steps)")
            type_choice = input("Enter type (1 or 2), or 0 to cancel: ")
            if type_choice == '0': return

            token_type_str = 'long' if type_choice == '1' else 'short' if type_choice == '2' else None
            if not token_type_str:
                print("Invalid type choice.")
                return

            print("\nChoose track to speculate on:")
            tracks = list(TrackColor)
            for i, tc in enumerate(tracks):
                print(f"  {i+1}. {tc.name}")
            track_choice_str = input(f"Enter track number (1-{len(tracks)}), or 0 to cancel: ")
            if track_choice_str == '0': return

            try:
                track_idx = int(track_choice_str) - 1
                if 0 <= track_idx < len(tracks):
                    chosen_track_color = tracks[track_idx]
                    self.game_logic.action_speculate(player, token_type_str, chosen_track_color)
                else:
                    print("Invalid track choice.")
            except ValueError:
                print("Invalid input for track.")
            except Exception as e:
                print(f"Error during speculation purchase: {e}")

        elif action_choice == '2' and player.futures_tokens:
            print("\nChoose a futures token to sell/dump (Gain 1 CC):")
            for i, token in enumerate(player.futures_tokens):
                print(f"  {i+1}. {token}")

            sell_choice_str = input(f"Enter token number to sell (1-{len(player.futures_tokens)}), or 0 to cancel: ")
            if sell_choice_str == '0': return

            try:
                sell_idx = int(sell_choice_str) - 1
                if 0 <= sell_idx < len(player.futures_tokens):
                    token_to_sell = player.futures_tokens.pop(sell_idx)
                    player.cred_coin += 1
                    self.game_logic.game_state.game_log.append(
                        f"{player.name} sold/dumped futures token '{token_to_sell}' for 1 CC."
                    )
                    print(f"Sold '{token_to_sell}' for 1 CC.")
                else:
                    print("Invalid token choice for selling.")
            except ValueError:
                print("Invalid input for token selling.")
            except Exception as e:
                 print(f"Error during token selling: {e}")

        elif action_choice == '3': # Buy Event Option
            cost = 4
            if player.cred_coin < cost:
                print(f"{player.name} has insufficient CredCoin to buy an Event Option (needs {cost} CC).")
                return

            available_event_tiles = self.game_logic.game_state.global_event_tiles_available
            # Also consider events already active but which might trigger again or have ongoing relevance for options?
            # For simplicity, allow betting on any *defined* global event tile, even if currently active.
            # A stricter rule might be only non-active, non-triggered ones.

            # Let's list all defined global events from cards.py, as they are all potentially triggerable.
            all_possible_event_names = [event.name for event in get_all_global_event_tiles()] # Fetch all defined
            # Filter out any that might be unique and already permanently resolved if that's a game rule.
            # For now, assume any can be bet on.

            if not all_possible_event_names:
                print("No global events defined to bet on.")
                return

            print("\nChoose a Global Event to buy an option for (Cost: 4 CC, Payout: 10 CC if event triggers):")
            for i, event_name in enumerate(all_possible_event_names):
                print(f"  {i+1}. {event_name}")

            event_choice_str = input(f"Enter event number (1-{len(all_possible_event_names)}), or 0 to cancel: ")
            if event_choice_str == '0': return

            try:
                event_idx = int(event_choice_str) - 1
                if 0 <= event_idx < len(all_possible_event_names):
                    chosen_event_name = all_possible_event_names[event_idx]
                    # Call a new GameLogic method to handle buying the event option
                    if self.game_logic.action_buy_event_option(player, chosen_event_name, cost):
                        print(f"Bought Event Option for '{chosen_event_name}'.")
                    # GameLogic will log success/failure details
                else:
                    print("Invalid event choice.")
            except ValueError:
                print("Invalid input for event choice.")
            except Exception as e:
                print(f"Error buying Event Option: {e}")
        else:
            print("Invalid speculation action choice.")


    def _get_player_sales_choices(self, player, water_batches: list[dict], demand_opportunities: list[dict], current_impact_tracks: dict) -> list[tuple]:
        """CLI callback for player to make sales decisions during Crowd Phase."""
        print(f"\n{player.name}, it's your turn to sell water. You have {player.get_total_water_produced()} cubes across {len(water_batches)} batches.")
        self._display_player_dashboard(player) # Show routes, water batches etc.

        sales_made_this_turn = [] # List of (segment_name, quantity, revenue, route_card, batch_index, batch_copy_sold)

        # Make copies of water batches to modify quantities locally during this sales turn
        current_player_batches = [batch.copy() for batch in water_batches]


        active_routes = [(idx, r) for idx, r in enumerate(player.distribution_routes) if r and r.is_active]
        if not active_routes:
            print(f"{player.name}, you have no active distribution routes to sell water!")
            return []

        while any(batch['quantity'] > 0 for batch in current_player_batches): # While player has any water left in any batch
            total_water_left_this_turn = sum(b['quantity'] for b in current_player_batches)
            print(f"\nWater remaining this turn: {total_water_left_this_turn}")
            print("Available Demand Opportunities (Name: Demand, Price, Values):")

            valid_demands_for_display = []
            for i, opp in enumerate(demand_opportunities):
                if opp['demand'] > 0:
                    print_demand = True
                    demand_note = ""
                    segment_rules = opp.get('original_segment_rules')

                    if segment_rules:
                        if segment_rules.name == "Connoisseurs":
                            if current_impact_tracks[TrackColor.GREEN].level >= 7:
                                print_demand = False
                                demand_note = f"(Rejected: TOX level {current_impact_tracks[TrackColor.GREEN].level} >= 7)"
                            else:
                                demand_note = "(Pays +1 CC for Glacial source)"
                        elif segment_rules.name == "Eco-Elites":
                            demand_note = "(Requires μP ≤ 4 & CO₂e ≤ 5 from water source)"
                        elif segment_rules.name == "Convenientists":
                            demand_note = "(Requires Plastic or Drone route)"

                    if print_demand:
                        print(f"  {len(valid_demands_for_display)+1}. {opp['name']}: "
                              f"{opp['demand']} cubes @ {opp['price']} CC/cube. {demand_note} ({opp['values']})")
                        valid_demands_for_display.append(opp)
                    elif demand_note : # print why it's not available if relevant
                         print(f"  - {opp['name']}: {opp['demand']} cubes @ {opp['price']} CC/cube. {demand_note}")

            if not valid_demands_for_display:
                print("No more demand available that you can potentially meet, or you have no water.")
                break
            print("0. Finish Selling")

            try:
                demand_choice_str = input(f"Choose demand to sell to (1-{len(valid_demands_for_display)}), or 0 to finish: ")
                demand_choice_idx = int(demand_choice_str) -1

                if demand_choice_idx == -1: break

                if not (0 <= demand_choice_idx < len(valid_demands_for_display)):
                    print("Invalid demand choice.")
                    continue

                chosen_demand_opp = valid_demands_for_display[demand_choice_idx]

                # Choose Water Batch to sell from
                print("\nChoose water batch to sell from:")
                available_batches_for_sale = [(i, b) for i, b in enumerate(current_player_batches) if b['quantity'] > 0]
                if not available_batches_for_sale:
                    print("No water left in any batch to sell.") # Should be caught by outer loop condition
                    break
                for i, (original_idx, batch) in enumerate(available_batches_for_sale):
                    print(f"  {i+1}. Batch (Original Idx {original_idx+1}): {batch['quantity']} cubes from {batch['facility_name']} (Impacts: {batch['base_impact_profile']})")

                batch_choice_str = input(f"Select batch (1-{len(available_batches_for_sale)}): ")
                batch_choice_local_idx = int(batch_choice_str) - 1

                if not (0 <= batch_choice_local_idx < len(available_batches_for_sale)):
                    print("Invalid batch choice.")
                    continue

                chosen_batch_original_idx, chosen_water_batch = available_batches_for_sale[batch_choice_local_idx]

                # Eco-Elites quality check
                if chosen_demand_opp.get('original_segment_rules') and chosen_demand_opp['original_segment_rules'].name == "Eco-Elites":
                    water_μP = chosen_water_batch['base_impact_profile'].get(TrackColor.PINK, 0)
                    water_CO2e = chosen_water_batch['base_impact_profile'].get(TrackColor.GREY, 0)
                    if not (water_μP <= 4 and water_CO2e <= 5):
                        print(f"Water from {chosen_water_batch['facility_name']} (μP:{water_μP}, CO₂e:{water_CO2e}) does not meet Eco-Elite standards (μP≤4, CO₂e≤5). Sale failed.")
                        continue

                # Choose Distribution Route
                print("\nChoose your distribution route for this sale:")
                for i, (slot_idx, route) in enumerate(active_routes):
                    print(f"  {i+1}. Slot {slot_idx+1}: {route.name} ({route.description})")
                route_choice_str = input(f"Select route (1-{len(active_routes)}): ")
                route_choice_idx = int(route_choice_str) -1
                if not (0 <= route_choice_idx < len(active_routes)):
                    print("Invalid route choice. Skipping this sale attempt.")
                    continue
                chosen_route_slot, chosen_route_card = active_routes[route_choice_idx]

                # Convenientists route check
                if chosen_demand_opp.get('original_segment_rules') and chosen_demand_opp['original_segment_rules'].name == "Convenientists":
                    if not (chosen_route_card.name == "Plastic Bottles" or chosen_route_card.name == "Drone Drops"):
                        print(f"Convenientists require Plastic Bottles or Drone Drops. You chose {chosen_route_card.name}. Sale failed.")
                        continue

                max_can_sell_to_demand = min(chosen_water_batch['quantity'], chosen_demand_opp['demand'])
                quantity_str = input(f"How many cubes from {chosen_water_batch['facility_name']} (Batch Idx {chosen_batch_original_idx+1}) to sell to {chosen_demand_opp['name']} (max {max_can_sell_to_demand}): ")
                quantity_to_sell = int(quantity_str)

                if 0 < quantity_to_sell <= max_can_sell_to_demand:
                    price_per_cube = chosen_demand_opp['price']

                    # Connoisseur bonus for Glacial source
                    if chosen_demand_opp.get('original_segment_rules') and \
                       chosen_demand_opp['original_segment_rules'].name == "Connoisseurs" and \
                       chosen_water_batch['facility_name'] == "Glacial Tap": # Check by name or tag
                       price_per_cube +=1
                       print("  (Applied +1 CC Connoisseur bonus for Glacial Tap source)")

                    revenue = quantity_to_sell * price_per_cube

                    # Store a copy of the batch state *before* quantity is reduced for this sale, for logging/tracking if needed
                    batch_copy_sold = chosen_water_batch.copy()

                    sales_made_this_turn.append((chosen_demand_opp['name'], quantity_to_sell, revenue, chosen_route_card, chosen_batch_original_idx, batch_copy_sold))

                    # Reduce quantity in the *local copy* of the batch for this sales turn
                    current_player_batches[chosen_batch_original_idx]['quantity'] -= quantity_to_sell
                    chosen_demand_opp['demand'] -= quantity_to_sell
                    print(f"Sold {quantity_to_sell} to {chosen_demand_opp['name']} for {revenue} CC via {chosen_route_card.name}.")

                    if chosen_route_card.name == "Drone Drops" and hasattr(player, 'draw_extra_whim_flag'):
                        player.draw_extra_whim_flag = True
                        self.game_logic.game_state.game_log.append(f"{player.name} will draw an extra Whim card next round due to Drone Drops.")
                else:
                    print("Invalid quantity.")
            except ValueError:
                print("Invalid input. Please enter numbers.")
            except Exception as e:
                print(f"Error during sales: {e}")

        return sales_made_this_turn


    def _game_loop(self):
        cli_callbacks = {
            'get_player_draft_choice_cb': self._get_player_draft_choice,
            'get_player_action_choice_cb': self._handle_player_action_choice,
            'get_player_sales_choices_cb': self._get_player_sales_choices
        }

        while not self.game_logic.game_state.uninhaitable:
            gs = self.game_logic.game_state
            self._display_game_state() # Show state at start of round

            self.game_logic.game_state.game_log.append(f"\n--- Round {gs.round_number} Starting ---")
            print(f"\n--- Round {gs.round_number} ---")

            self.game_logic.run_round(cli_callbacks) # Pass callbacks to game logic

            # Log output already handled by game_logic and CLI methods called via callback.
            # self._display_game_state() # Display state after all phases of the round

            if gs.uninhaitable:
                print("Planet has become Uninhabitable!")
                break

            gs.round_number += 1
            input("\nPress Enter to continue to next round...")


        # Game Over
        print("\n--- GAME OVER ---")
        print("Threshold check complete. Global events (if any) triggered.")
        if gs.uninhaitable:
            print("Planet has become Uninhabitable!")
        else:
            # End of Round
            self.game_logic.reset_round_modifiers() # Reset demand etc.
            gs.round_number += 1
            input("\nPress Enter to continue to next round...")


        # Game Over
        print("\n--- GAME OVER ---")
        self._display_game_state()
        self.game_logic.final_scoring()

        print("\n--- Final Game Log ---")
        for entry in self.game_logic.game_state.game_log:
            print(entry)

if __name__ == '__main__':
    cli_app = CLI()
    cli_app.start()
