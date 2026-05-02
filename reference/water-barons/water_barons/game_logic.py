import random
from typing import List, Tuple, Optional, Dict # Added Optional, Dict
from water_barons.game_state import GameState
from water_barons.game_entities import (
    Player, Card, WhimCard, FacilityCard, DistributionCard,
    UpgradeCard, FutureToken, TrackColor, GlobalEventCard, EventOption
)
from water_barons.cards import (
    get_all_facility_cards, get_all_distribution_cards,
    get_all_upgrade_cards, get_all_whim_cards, get_all_global_event_tiles
)

class GameLogic:
    """Handles the core game loop and phase transitions."""
    def __init__(self, num_players: int, player_names: List[str]):
        self.game_state = GameState(num_players, player_names)
        self._initialize_decks()
        # Further initialization like dealing starting hands or resources if any

    def _initialize_decks(self):
        """Populates and shuffles all card decks."""
        self.game_state.facility_deck = get_all_facility_cards()
        random.shuffle(self.game_state.facility_deck)

        self.game_state.distribution_deck = get_all_distribution_cards()
        random.shuffle(self.game_state.distribution_deck)

        self.game_state.upgrade_deck = get_all_upgrade_cards()
        random.shuffle(self.game_state.upgrade_deck)

        self.game_state.whim_deck_source = get_all_whim_cards() # All available Whims
        random.shuffle(self.game_state.whim_deck_source)
        # Crowd deck is formed during Whim Draft phase

        self.game_state.global_event_tiles_available = get_all_global_event_tiles()
        random.shuffle(self.game_state.global_event_tiles_available)

        self.game_state.game_log.append("Decks initialized and shuffled.")

    def start_game(self):
        """Starts the game loop."""
        self.game_state.game_log.append(f"Game starting with players: {[p.name for p in self.game_state.players]}.")
        # Potentially deal initial cards or assign starting resources here
        # For now, we assume players start with some CredCoin as defined in Player class.

        # Main game loop (simplified for now)
        # while not self.game_state.uninhaitable:
        #     self.game_state.game_log.append(f"\n--- Round {self.game_state.round_number} ---")
        #     self.run_round()
        #     if self.game_state.uninhaitable:
        #         break
        #     self.game_state.round_number += 1
        #     self.game_state.current_player_index = 0 # Reset for next round's turn order

        # self.final_scoring()
        print("Game setup complete. Ready to start rounds (manual for now).")


    # --- Phase Implementations (Placeholders) ---
    def initiate_whim_draft(self):
        """Sets up the state for starting a Whim Draft."""
        self.game_state.game_log.append("\n-- Whim Draft Phase Initiated --")
        num_picks_per_player = 2
        num_players = len(self.game_state.players)

        self.game_state.whim_draft_player_picks_remaining = {idx: num_picks_per_player for idx in range(num_players)}
        for idx, p in enumerate(self.game_state.players):
            if p.draw_extra_whim_flag:
                self.game_state.whim_draft_player_picks_remaining[idx] += 1
                self.game_state.game_log.append(f"{p.name} gets an extra Whim draft pick this round from Drone Drops effect.")
                p.draw_extra_whim_flag = False # Reset flag

        # Construct the full snake draft order
        draft_order = []
        # Round 1 picks (e.g., P0, P1, P2)
        for i in range(num_players):
            draft_order.append(i)
        # Round 2 picks (e.g., P2, P1, P0)
        for i in reversed(range(num_players)):
            draft_order.append(i)

        # Add subsequent rounds for players with extra picks (simplified: they pick again in normal then reverse order)
        # A more complex rule might interleave these. For now, they pick after normal snake.
        # This logic needs to be more robust if players have >1 extra pick or if order matters more.
        # Current player_picks_remaining handles total picks, the order list is for turn.
        # We'll build the full turn order list based on total picks.

        full_draft_turn_order = []
        picks_made_by_player = {idx: 0 for idx in range(num_players)}

        temp_draft_order_players = list(range(num_players))
        draft_direction_forward = True

        total_picks_to_make = sum(self.game_state.whim_draft_player_picks_remaining.values())

        while len(full_draft_turn_order) < total_picks_to_make:
            current_pass_order = temp_draft_order_players if draft_direction_forward else reversed(temp_draft_order_players)
            for player_idx in current_pass_order:
                if picks_made_by_player[player_idx] < self.game_state.whim_draft_player_picks_remaining[player_idx]:
                    full_draft_turn_order.append(player_idx)
                    picks_made_by_player[player_idx] +=1
            draft_direction_forward = not draft_direction_forward # Snake

        self.game_state.whim_draft_order = full_draft_turn_order
        self.game_state.whim_draft_current_picker_idx_in_order = 0
        self.game_state.whim_draft_active = True
        self.game_state.crowd_deck = [] # Clear existing crowd deck for new draft
        self.game_state.game_log.append(f"Whim draft order: {[self.game_state.players[i].name for i in self.game_state.whim_draft_order]}")
        return self.request_next_whim_draft_pick()

    def request_next_whim_draft_pick(self) -> Optional[Tuple[Player, List[WhimCard], int]]:
        """
        Determines the next player and options for a Whim draft pick.
        Returns (player, options, pick_num_for_player) or None if draft is over.
        This method is called by the web server to get info for the client.
        """
        gs = self.game_state
        if not gs.whim_draft_active or gs.whim_draft_current_picker_idx_in_order >= len(gs.whim_draft_order):
            gs.whim_draft_active = False
            gs.whim_draft_options_sent_to_player = []
            if gs.crowd_deck: # Only shuffle if cards were drafted
                 random.shuffle(gs.crowd_deck)
            gs.game_log.append(f"Whim Draft Concluded. Crowd Deck has {len(gs.crowd_deck)} cards.")
            return None

        current_player_actual_idx = gs.whim_draft_order[gs.whim_draft_current_picker_idx_in_order]
        player = gs.players[current_player_actual_idx]

        # Calculate pick number for this player (e.g., their 1st, 2nd, or 3rd pick)
        # This requires knowing how many picks this player has made so far in this draft.
        # We can count occurrences of current_player_actual_idx in whim_draft_order up to current_picker_idx_in_order
        pick_num_for_player = sum(1 for i in range(gs.whim_draft_current_picker_idx_in_order + 1) if gs.whim_draft_order[i] == current_player_actual_idx)

        # Replenish whim_deck_source if empty
        if not gs.whim_deck_source and gs.whim_discard_pile:
            gs.game_log.append("Whim source deck empty, reshuffling discard pile.")
            gs.whim_deck_source.extend(gs.whim_discard_pile)
            gs.whim_discard_pile = []
            random.shuffle(gs.whim_deck_source)

        if not gs.whim_deck_source:
            gs.game_log.append(f"Whim source deck depleted. {player.name} cannot make pick {pick_num_for_player}.")
            gs.whim_draft_current_picker_idx_in_order += 1 # Skip this player's turn
            return self.request_next_whim_draft_pick() # Try for next player

        num_options_to_show = min(len(gs.whim_deck_source), 3)
        options = gs.whim_deck_source[:num_options_to_show]

        if not options:
            gs.game_log.append(f"No Whim cards available for {player.name} to draft for pick {pick_num_for_player}.")
            gs.whim_draft_current_picker_idx_in_order += 1 # Skip
            return self.request_next_whim_draft_pick()

        gs.whim_draft_options_sent_to_player = options # Store options for processing choice
        return player, options, pick_num_for_player

    def process_whim_draft_pick(self, player: Player, chosen_card_index: int) -> bool:
        """
        Processes a player's Whim draft choice.
        Assumes chosen_card_index is valid for options previously sent.
        """
        gs = self.game_state
        if not gs.whim_draft_active or not gs.whim_draft_options_sent_to_player:
            gs.game_log.append(f"Error: Whim draft not active or no options were sent to {player.name}.")
            return False

        options = gs.whim_draft_options_sent_to_player
        pick_num_for_player = sum(1 for i in range(gs.whim_draft_current_picker_idx_in_order + 1) if gs.whim_draft_order[i] == gs.players.index(player))


        if 0 <= chosen_card_index < len(options):
            chosen_card = options[chosen_card_index]
            if chosen_card in gs.whim_deck_source: # Ensure card is still in source (it should be)
                gs.whim_deck_source.remove(chosen_card)
                gs.crowd_deck.append(chosen_card)
                gs.game_log.append(f"{player.name} drafted Whim card (Pick {pick_num_for_player}): {chosen_card.name}.")
            else: # Should not happen if options are from source
                gs.game_log.append(f"Error: Card {chosen_card.name} not found in source deck for {player.name}'s pick.")
                # Potentially auto-pick first available if error, or just fail the pick
        else:
            gs.game_log.append(f"{player.name} made an invalid choice or passed on pick {pick_num_for_player}. No card drafted for this pick.")
            # If passing is allowed and means no card, this is fine. If a card must be picked, this is an error.
            # For now, passing means no card drafted for this specific pick.

        gs.whim_draft_options_sent_to_player = [] # Clear stored options
        gs.whim_draft_current_picker_idx_in_order += 1
        return True

    def whim_draft_phase(self, get_player_draft_choice_cb):
        """Runs the interactive Whim draft using the provided callback."""
        next_pick = self.initiate_whim_draft()
        while next_pick:
            player, options, pick_num = next_pick
            try:
                choice = get_player_draft_choice_cb(player, options, pick_num)
            except Exception:
                choice = -1
            if choice is None:
                choice = -1
            self.process_whim_draft_pick(player, choice)
            next_pick = self.request_next_whim_draft_pick()


    def ops_phase(self, get_player_action_choice_cb):
        """
        Each player takes 2 actions.
        `get_player_action_choice_cb(player, action_num)` is used for CLI interaction.
        """
        self.game_state.game_log.append("\n-- Ops Phase --")
        for i in range(len(self.game_state.players)):
            player = self.game_state.get_current_player()
            self.game_state.game_log.append(f"\n{player.name}'s turn (Ops Phase).")
            for action_num in range(1, 3): # 2 actions per player
                self.game_state.game_log.append(f"{player.name}, Action {action_num}:")
                # Player chooses action via callback to CLI
                # The callback `get_player_action_choice_cb` will handle the interaction
                # and then call the appropriate game logic action method based on player's choice.
                # Example: if player chooses 'Build Facility', cli calls self.action_build_facility(player, chosen_card_data)
                get_player_action_choice_cb(player, action_num)
            self.game_state.next_player()
        self.game_state.current_player_index = 0 # Reset for Crowd Phase turn order

    # --- Action Methods (called by CLI based on player choice) ---

    def action_build_facility(self, player: Player, facility_card: FacilityCard, slot_index: int) -> bool:
        """Player builds a facility."""
        # Check game-wide limits
        if facility_card.name == "Glacial Tap":
            if self.game_state.game_wide_counters.get("GlacialTap_built", 0) >= 2:
                self.game_state.game_log.append(f"Cannot build {facility_card.name}: Limit of 2 per game already reached.")
                return False

        # Check for Aquifer Collapse event preventing Well construction
        aquifer_collapse_active = any(event.name == "Aquifer Collapse" for event in self.game_state.global_event_tiles_active)
        if "Well" in facility_card.name and aquifer_collapse_active: # Assuming "Well" is in the name string
            self.game_state.game_log.append(f"Cannot build {facility_card.name}: Aquifer Collapse active, new Wells prohibited.")
            return False

        if player.cred_coin >= facility_card.cost and player.facilities[slot_index] is None:
            player.cred_coin -= facility_card.cost
            player.facilities[slot_index] = facility_card

            if facility_card.name == "Glacial Tap":
                self.game_state.game_wide_counters["GlacialTap_built"] = self.game_state.game_wide_counters.get("GlacialTap_built", 0) + 1

            self.game_state.game_log.append(
                f"{player.name} built {facility_card.name} in slot {slot_index + 1} for {facility_card.cost} CC."
            )
            return True
        else:
            if player.cred_coin < facility_card.cost:
                self.game_state.game_log.append(f"{player.name} cannot afford {facility_card.name}.")
            if player.facilities[slot_index] is not None:
                self.game_state.game_log.append(f"Slot {slot_index + 1} is already occupied.")
            return False

    def _apply_facility_upgrade_effects_on_flow(self, player: Player, facility: FacilityCard, current_impact: dict[TrackColor, int]) -> dict[TrackColor, int]:
        """Applies effects of upgrades on a facility's impact profile during Flow action."""
        modified_impact = current_impact.copy()
        for upgrade in facility.upgrades:
            # Example: "Apply_to_facility: reduce_impact_per_flow(TrackColor.PINK, 1)"
            if "reduce_impact_per_flow" in upgrade.effect_description:
                try:
                    parts = upgrade.effect_description.split('(')[1].split(')')[0].split(',')
                    track_str = parts[0].split('.')[1].strip() # TrackColor.PINK -> PINK
                    amount = int(parts[1].strip())
                    track_color_to_reduce = TrackColor[track_str]

                    modified_impact[track_color_to_reduce] = max(0, modified_impact.get(track_color_to_reduce, 0) - amount)
                    self.game_state.game_log.append(f"  Upgrade '{upgrade.name}' reduced {track_color_to_reduce.name} impact by {amount}.")
                except Exception as e:
                    self.game_state.game_log.append(f"  Error parsing upgrade effect '{upgrade.effect_description}': {e}")
        return modified_impact

    def _get_passive_player_impact_reduction(self, player:Player, facility_tags: List[str], original_impact_profile: dict[TrackColor, int]) -> dict[TrackColor, int]:
        """Checks player's R&D for passive impact reductions (e.g. Aquifer Recharge Tech)."""
        reductions = {tc: 0 for tc in TrackColor}
        for rd_tech in player.r_and_d:
            if "reduce_facility_impact_type" in rd_tech.effect_description:
                # E.g., "Global_player_passive: reduce_facility_impact_type('Well', TrackColor.BLUE, 1)"
                try:
                    details = rd_tech.effect_description.split('(')[1].split(')')[0].split(',')
                    target_tag = details[0].strip().replace("'", "") # 'Well'
                    track_str = details[1].split('.')[1].strip() # TrackColor.BLUE -> BLUE
                    amount = int(details[2].strip())

                    if target_tag in facility_tags: # Check if facility has the target tag (e.g. "Well")
                        track_color_to_reduce = TrackColor[track_str]
                        # Check if original impact profile has this track color
                        if track_color_to_reduce in original_impact_profile and original_impact_profile[track_color_to_reduce] > 0:
                             reductions[track_color_to_reduce] += amount
                             self.game_state.game_log.append(f"  R&D Tech '{rd_tech.name}' passively reduces {track_color_to_reduce.name} impact by {amount} for facilities tagged '{target_tag}'.")
                except Exception as e:
                    self.game_state.game_log.append(f"  Error parsing R&D effect '{rd_tech.effect_description}': {e}")
        return reductions


    def action_produce_water(self, player: Player, facility_slot_index: int) -> bool:
        """Player uses a facility to produce water."""
        facility = player.facilities[facility_slot_index]
        if facility:
            water_produced = facility.base_output

            # Static Track Effects (e.g., DEP Level 5: Wells output –1)
            if "DEP_Level_5_Effect" in self.game_state.active_threshold_effects and "Well" in facility.tags: # Assuming "Well" tag
                water_produced = max(0, water_produced - 1)
                self.game_state.game_log.append(f"  DEP_Level_5_Effect active, {facility.name} (Well) output reduced by 1.")

            # Global Event Effects (e.g., Aquifer Collapse, Heatwave Frenzy)
            for event in self.game_state.global_event_tiles_active:
                if event.name == "Aquifer Collapse" and "Well" in facility.tags:
                    water_produced = water_produced // 2 # Halved
                    self.game_state.game_log.append(f"  Aquifer Collapse active, {facility.name} (Well) output halved to {water_produced}.")
                elif event.name == "Heatwave Frenzy":
                    water_produced = max(0, water_produced - 1)
                    self.game_state.game_log.append(f"  Heatwave Frenzy active, {facility.name} output reduced by 1 (overheat).")

            # Add produced water as a distinct batch
            if water_produced > 0:
                player.water_batches.append({
                    'facility_name': facility.name,
                    'facility_tags': facility.tags.copy(), # Store a copy of tags at time of production
                    'base_impact_profile': facility.impact_profile.copy(), # Store base impact for quality checks
                    'quantity': water_produced,
                    'production_round': self.game_state.round_number
                })

            # Handle Impacts
            current_facility_impact = facility.impact_profile.copy()

            # Greywater Loop special: -1 μP
            if facility.name == "Greywater Loop":
                current_facility_impact[TrackColor.PINK] = current_facility_impact.get(TrackColor.PINK, 0) - 1
                # Ensure it doesn't go negative if base impact was 0 or low
                current_facility_impact[TrackColor.PINK] = max(0, current_facility_impact[TrackColor.PINK])
                self.game_state.game_log.append(f"  {facility.name} inherently mitigates 1 μP.")

            # Apply facility-specific upgrade effects (e.g. Microplastic Filter)
            current_facility_impact = self._apply_facility_upgrade_effects_on_flow(player, facility, current_facility_impact)

            # Apply player-level passive R&D tech effects (e.g. Aquifer Recharge Tech for Wells)
            passive_reductions = self._get_passive_player_impact_reduction(player, facility.tags, facility.impact_profile)
            for tc, reduction_amount in passive_reductions.items():
                current_facility_impact[tc] = max(0, current_facility_impact.get(tc, 0) - reduction_amount)


            for track_color, amount in current_facility_impact.items():
                if amount > 0 : # Only add positive impact
                    player.impact_storage[track_color] = player.impact_storage.get(track_color, 0) + amount

            self.game_state.game_log.append(
                f"{player.name} activated {facility.name}, producing {water_produced} water. "
                f"Net impacts added to storage: {current_facility_impact} (after upgrades/mitigations)."
            )
            return True
        self.game_state.game_log.append(f"{player.name} failed to activate facility in slot {facility_slot_index + 1}.")
        return False

    def action_build_distribution(self, player: Player, dist_card: DistributionCard, slot_index: int) -> bool:
        """Player builds a distribution route."""
        # Check for Microplastic Revelation making Plastic Bottles unusable
        microplastic_revelation_active = any(event.name == "Microplastic Revelation" for event in self.game_state.global_event_tiles_active)
        if dist_card.name == "Plastic Bottles" and microplastic_revelation_active and not dist_card.is_active: # Assuming is_active flag
             self.game_state.game_log.append(f"Cannot build {dist_card.name}: Microplastic Revelation has made them unusable.")
             return False

        if player.cred_coin >= dist_card.cost and player.distribution_routes[slot_index] is None:
            player.cred_coin -= dist_card.cost
            player.distribution_routes[slot_index] = dist_card
            player.routes_built_this_game.add(dist_card.name) # Track for Diversity Bonus
            self.game_state.game_log.append(
                f"{player.name} built {dist_card.name} route in slot {slot_index+1} for {dist_card.cost} CC."
            )
            return True
        else:
            if player.cred_coin < dist_card.cost:
                 self.game_state.game_log.append(f"{player.name} cannot afford {dist_card.name}.")
            if player.distribution_routes[slot_index] is not None:
                self.game_state.game_log.append(f"Distribution slot {slot_index + 1} is already occupied.")
            return False

    def action_tweak_add_upgrade(self, player: Player, upgrade_card: UpgradeCard, target_card_owner_type: str, owner_slot_index: int) -> bool:
        """Player adds an upgrade to a facility or route.
        target_card_owner_type: 'facility' or 'route'
        """
        if player.cred_coin < upgrade_card.cost:
            self.game_state.game_log.append(f"{player.name} cannot afford {upgrade_card.name}.")
            return False

        target_owner = None
        if target_card_owner_type == 'facility':
            if 0 <= owner_slot_index < len(player.facilities) and player.facilities[owner_slot_index]:
                target_owner = player.facilities[owner_slot_index]
            else:
                self.game_state.game_log.append(f"Invalid facility slot {owner_slot_index + 1} for upgrade.")
                return False
        elif target_card_owner_type == 'route':
            # Distribution cards don't explicitly store upgrades in the current model.
            # This implies upgrades might be global or their effects applied differently.
            # For now, let's assume an R&D type upgrade if not facility.
            # This part needs clarification based on "Upgrades snap beneath" for facilities vs route upgrades.
            # Assuming R&D for non-facility for now.
            player.r_and_d.append(upgrade_card)
            player.cred_coin -= upgrade_card.cost
            self.game_state.game_log.append(f"{player.name} acquired R&D tech: {upgrade_card.name} for {upgrade_card.cost} CC.")
            return True

        if target_owner: # This will be a FacilityCard (target_owner_facility from previous logic)
            if upgrade_card.type in ["FACILITY_UPGRADE", "FACILITY_TAG"]: # Check type from card data
                 target_owner.upgrades.append(upgrade_card)
                 player.cred_coin -= upgrade_card.cost
                 self.game_state.game_log.append(
                     f"{player.name} added upgrade '{upgrade_card.name}' to {target_owner.name} for {upgrade_card.cost} CC."
                 )
                 if upgrade_card in self.game_state.upgrade_deck: self.game_state.upgrade_deck.remove(upgrade_card)
                 return True
            else:
                self.game_state.game_log.append(f"Upgrade '{upgrade_card.name}' ({upgrade_card.type}) is not a facility-specific upgrade type for target {target_owner.name}.")
                return False # Mismatch

        # If it's not a facility upgrade being applied to a facility, and not R&D handled above, it's a failure or unhandled type.
        self.game_state.game_log.append(f"Failed to apply upgrade '{upgrade_card.name}'. Target type or card type mismatch, or target not found.")
        return False

    def action_speculate(self, player: Player, token_type: str, track_color: TrackColor) -> bool: # token_type 'long' or 'short'
        self.game_state.game_log.append(f"{player.name} attempts to Speculate ({token_type} on {track_color.name}).")
        # Cost is 2 CC. Max 3 futures.
        cost = 2
        if len(player.futures_tokens) >= 3:
            self.game_state.game_log.append(f"{player.name} already has max (3) futures tokens.")
            return False
        if player.cred_coin < cost:
            self.game_state.game_log.append(f"{player.name} cannot afford futures token (cost {cost} CC).")
            return False

        is_long = token_type.lower() == 'long'
        token = FutureToken(track_color, is_long, purchase_price=cost)
        player.futures_tokens.append(token)
        player.cred_coin -= cost
        self.game_state.game_log.append(f"{player.name} bought a {token_type} token for {track_color.name} for {cost} CC.")
        return True


    def action_spin_marketing(self, player: Player, target_segment_name: str, desired_effect: str):
        self.game_state.game_log.append(f"{player.name} tries to Spin Marketing on {target_segment_name}. Not fully implemented.")
        # This would involve costs and modifying demand segment weights/demand.
        return False

    def action_buy_event_option(self, player: Player, event_name: str, cost: int) -> bool:
        """Player buys an Event Option."""
        if player.cred_coin < cost:
            self.game_state.game_log.append(f"{player.name} cannot afford Event Option for '{event_name}' (cost {cost} CC).")
            return False

        # Potentially limit number of event options a player can hold, similar to futures_tokens?
        # Document doesn't specify a limit for Event Options, unlike the 3 futures_tokens limit.

        option = EventOption(event_name=event_name, purchase_price=cost)
        player.event_options.append(option)
        player.cred_coin -= cost
        self.game_state.game_log.append(
            f"{player.name} bought an Event Option for '{event_name}' for {cost} CC."
        )
        return True


    def crowd_phase(self, get_player_sales_choices_cb):
        """
        Reveal Crowd cards, players sell water, resolve fallout.
        `get_player_sales_choices_cb(player, available_water, active_demand_segments)` for CLI interaction.
        """
        self.game_state.game_log.append("\n-- Crowd Phase --")
        self.game_state.round_sales_to_eco_elites.clear() # Reset for the current round

        num_cards_to_flip = len(self.game_state.players) + 1
        active_crowd_cards: List[WhimCard] = []

        if not self.game_state.crowd_deck:
            self.game_state.game_log.append("Crowd Deck is empty. No cards to flip.")
            # Potentially add emergency Whims or handle this state.
            # For now, skip if empty.
        else:
            for _ in range(min(num_cards_to_flip, len(self.game_state.crowd_deck))):
                card = self.game_state.crowd_deck.pop(0)
                active_crowd_cards.append(card)
                self.game_state.game_log.append(f"Revealed Crowd Card: {card.name}")
                # 1. Resolve Pre-round Effect
                self.resolve_whim_pre_effect(card)

        # 2. Players sell water (in turn order)
        mass_recall_active = any(event.name == "Mass Recall" for event in self.game_state.global_event_tiles_active)
        if mass_recall_active:
            self.game_state.game_log.append("Mass Recall event active! No sales this round from tainted supply.")
            # Water was already discarded by _apply_global_event_effects when Mass Recall triggered.
        else:
            current_demands = self._get_current_demand_opportunities(active_crowd_cards)
            for i in range(len(self.game_state.players)):
                player = self.game_state.get_current_player()
                total_player_water = player.get_total_water_produced()
                self.game_state.game_log.append(f"\n{player.name} selling water (has {total_player_water} cubes across {len(player.water_batches)} batches)...")

                if total_player_water > 0:
                    sales_made_info = get_player_sales_choices_cb(player, player.water_batches, current_demands, self.game_state.impact_tracks)

                    total_revenue_this_turn = 0
                    sold_from_batches_indices = {}

                    for sale_info in sales_made_info:
                        segment_name, quantity_sold, revenue, dist_route_card, batch_idx_sold_from, _ = sale_info
                        total_revenue_this_turn += revenue
                        player.cred_coin += revenue

                        if dist_route_card and dist_route_card.impact_modifier:
                            self._apply_distribution_impact(player, dist_route_card, quantity_sold)

                        for demand_opp in current_demands:
                            if demand_opp['name'] == segment_name:
                                demand_opp['demand'] -= quantity_sold
                                break

                        sold_from_batches_indices[batch_idx_sold_from] = sold_from_batches_indices.get(batch_idx_sold_from, 0) + quantity_sold

                        if segment_name == "Eco-Elites":
                            self.game_state.round_sales_to_eco_elites.add(player.name)

                        self.game_state.game_log.append(
                            f"  {player.name} sold {quantity_sold} water (from batch {batch_idx_sold_from+1}) to {segment_name} for {revenue} CC using {dist_route_card.name if dist_route_card else 'default route'}."
                        )

                    new_water_batches = []
                    for idx, batch in enumerate(player.water_batches):
                        sold_amount = sold_from_batches_indices.get(idx, 0)
                        batch['quantity'] -= sold_amount
                        if batch['quantity'] > 0:
                            new_water_batches.append(batch)
                    player.water_batches = new_water_batches

                    self.game_state.game_log.append(f"  {player.name} earned {total_revenue_this_turn} CC. Remaining water: {player.get_total_water_produced()}")
                else:
                    self.game_state.game_log.append(f"  {player.name} has no water to sell.")
                self.game_state.next_player()
            self.game_state.current_player_index = 0

        # 3. Resolve Post-round Fallout for each card & discard
        for card in active_crowd_cards:
            self.game_state.game_log.append(f"Resolving Post-round Fallout for {card.name}: {card.post_round_fallout}")
            self.resolve_whim_post_fallout(card)
            self.game_state.whim_discard_pile.append(card)

        # Cleanup: Player impact storage to global tracks (Consolidate)
        self.consolidate_player_impacts()

        # Evaporate unsold water cubes
        for player in self.game_state.players:
            if player.get_total_water_produced() > 0:
                # For simplicity, clear all batches. A more nuanced rule might allow some carry-over.
                self.game_state.game_log.append(f"{player.name}'s {player.get_total_water_produced()} unsold water cubes (from all batches) evaporate.")
                player.water_batches = []


    def resolve_whim_pre_effect(self, whim_card: WhimCard):
        """Parses and applies a Whim card's pre-round effect."""
        # Example: "DemandSegment:Connoisseurs:current_demand:+2"
        # Example: "GlobalImpact:PINK:+1" (hypothetical pre-round impact)
        self.game_state.game_log.append(f"  Pre-Effect ({whim_card.name}): {whim_card.pre_round_effect}")
        try:
            parts = whim_card.pre_round_effect.split(':')
            effect_type = parts[0]

            if effect_type == "DemandSegment":
                segment_name, attribute, value_str = parts[1], parts[2], parts[3]
                value = int(value_str)
                segment = self.game_state.demand_segments.get(segment_name)
                if segment:
                    if hasattr(segment, attribute):
                        current_val = getattr(segment, attribute)
                        setattr(segment, attribute, current_val + value)
                        self.game_state.game_log.append(f"    {segment_name} {attribute} changed by {value} to {getattr(segment, attribute)}.")
                    else:
                        self.game_state.game_log.append(f"    Error: Unknown attribute '{attribute}' for DemandSegment.")
                else:
                    self.game_state.game_log.append(f"    Error: Unknown DemandSegment '{segment_name}'.")
            # Add more effect types as needed
            else:
                self.game_state.game_log.append(f"    Unknown pre-round effect type: {effect_type}")
        except Exception as e:
            self.game_state.game_log.append(f"    Error processing pre-effect '{whim_card.pre_round_effect}': {e}")


    def resolve_whim_post_fallout(self, whim_card: WhimCard):
        """Parses and applies a Whim card's post-round fallout."""
        # Example: "GlobalImpact:PINK:+2"
        # Example: "PlayerEffect:EcoEliteBuyers:GainReputation:1"
        self.game_state.game_log.append(f"  Post-Fallout ({whim_card.name}): {whim_card.post_round_fallout}")
        try:
            parts = whim_card.post_round_fallout.split(':')
            effect_type = parts[0]

            if effect_type == "GlobalImpact":
                track_str, value_str = parts[1], parts[2]
                value = int(value_str)
                track_color = TrackColor[track_str.upper()] # Assumes TrackColor enum names match
                self.game_state.add_global_impact(track_color, value)
                self.game_state.game_log.append(f"    Global track {track_color.name} changed by {value}.")

            elif effect_type == "PlayerEffect":
                # Example: "PlayerEffect:EcoEliteBuyers:GainReputation:1"
                target_players_key, effect_attribute, effect_value_str = parts[1], parts[2], parts[3]
                effect_value = int(effect_value_str)

                affected_players: List[Player] = []
                if target_players_key == "EcoEliteBuyers":
                    for p_name in self.game_state.round_sales_to_eco_elites:
                        player_obj = next((p for p in self.game_state.players if p.name == p_name), None)
                        if player_obj:
                            affected_players.append(player_obj)
                # Could add "AllPlayers", "CurrentPlayer" etc. as target_players_key

                for player_to_affect in affected_players:
                    if hasattr(player_to_affect, effect_attribute):
                        current_player_val = getattr(player_to_affect, effect_attribute)
                        setattr(player_to_affect, effect_attribute, current_player_val + effect_value)
                        self.game_state.game_log.append(
                            f"    Player {player_to_affect.name} {effect_attribute} changed by {effect_value} to {getattr(player_to_affect, effect_attribute)}."
                        )
                    else:
                        self.game_state.game_log.append(f"    Error: Player has no attribute '{effect_attribute}'.")
            else:
                self.game_state.game_log.append(f"    Unknown post-fallout effect type: {effect_type}")
        except Exception as e:
            self.game_state.game_log.append(f"    Error processing post-fallout '{whim_card.post_round_fallout}': {e}")

    def consolidate_player_impacts(self):
        """Move impact cubes from player storage to shared tracks."""
        self.game_state.game_log.append("Consolidating player impacts to global tracks...")
        # Store track levels before consolidation to identify who triggered what
        previous_track_levels = {tc: track.level for tc, track in self.game_state.impact_tracks.items()}

        for player in self.game_state.players:
            player_contributions: dict[TrackColor, int] = {} # Corrected Dict to dict
            for track_color, amount in player.impact_storage.items():
                if amount > 0:
                    self.game_state.add_global_impact(track_color, amount) # This method logs track changes and event triggers
                    player_contributions[track_color] = amount
                    player.total_impact_contributed[track_color] = player.total_impact_contributed.get(track_color, 0) + amount # Track for tie-breaking
                    self.game_state.game_log.append(f"  {player.name} added {amount} to {track_color.name} track.")
                    player.impact_storage[track_color] = 0 # Reset player storage

            # Check if this player's contribution triggered any new global events immediately
            for tc, contributed_amount in player_contributions.items():
                if contributed_amount == 0: continue
                track = self.game_state.impact_tracks[tc]
                # Check Global Event Card triggers specifically caused by this player
                for event_card in list(self.game_state.global_event_tiles_available):
                    if event_card.trigger_track == tc and \
                       previous_track_levels[tc] < event_card.trigger_threshold <= track.level and \
                       event_card not in self.game_state.global_event_tiles_active:
                        # This player's contribution pushed the track over this event's threshold
                        # The trigger_global_event is now called within add_global_impact,
                        # but we need to assign blame.
                        # We can check game_log for the event trigger message that add_global_impact might add.
                        # For now, let's assume GameState.trigger_global_event takes a triggering_player.
                        # This requires GameState.trigger_global_event to be enhanced.
                        # Or, we set a temporary 'last_impacting_player' in GameState.

                        # Simplified blame assignment:
                        # If a new event became active after this player's consolidation for that track
                        # This check is tricky because add_global_impact itself triggers.
                        # Let's refine `trigger_global_event` in GameState to accept a player.
                        # For now, this is an area needing more robust blame tracking.
                        # A simple way: if an event just got added to active_global_events and matches the track.
                        if any(e.name == event_card.name and e.trigger_track == tc for e in self.game_state.global_event_tiles_active if e not in self.game_state.previously_active_events_this_round):
                             player.triggered_global_events +=1
                             self.game_state.game_log.append(f"  {player.name} is noted as triggering {event_card.name}.")
                previous_track_levels[tc] = track.level # Update for next player in loop

    def _get_current_demand_opportunities(self, active_whim_cards: List[WhimCard]) -> List[dict]: # Corrected Dict to dict
        """Helper to compile all current demand from base segments and active whims."""
        opportunities = []
        # Base demand segments
        for name, seg in self.game_state.demand_segments.items():
            opportunities.append({
                "name": name,
                "demand": seg.current_demand,
                "price": seg.current_price,
                "values": seg.values_description, # For filtering/prioritization by player
                "source": "base",
                "original_segment_rules": seg # Pass the whole segment for detailed rule checks
            })

        # TODO: Add demand from active_whim_cards if they directly create new demand blocks
        # This depends on how Whim pre-round effects are structured.
        # Current Whim effects modify existing DemandSegments. If they add new ones, that logic goes here.
        return opportunities

    def _apply_distribution_impact(self, player: Player, dist_card: DistributionCard, quantity_sold: int):
        """Applies impact to player's storage based on distribution method and quantity."""
        if not dist_card.impact_modifier:
            return

        for key, modifier_details in dist_card.impact_modifier.items():
            # Example: "μP_per_cubes_sold": {"impact": TrackColor.PINK, "amount": 1, "per_cubes": 2}}
            if "per_cubes_sold" in key:
                track_color = modifier_details["impact"]
                impact_amount = modifier_details["amount"]
                per_cubes = modifier_details["per_cubes"]

                generated_impact = (quantity_sold // per_cubes) * impact_amount
                if generated_impact > 0:
                    player.impact_storage[track_color] = player.impact_storage.get(track_color, 0) + generated_impact
                    self.game_state.game_log.append(
                        f"  Distribution ({dist_card.name}) added {generated_impact} to {track_color.name} for selling {quantity_sold} cubes."
                    )
            # Add other types of modifiers if any (e.g., flat impact per use)

        # Check for Bioplastic Seal type R&D upgrades for this route
        for upgrade in player.r_and_d:
            if upgrade.type == "ROUTE_UPGRADE" and hasattr(upgrade, 'target_route_slot') and upgrade.target_route_slot == player.distribution_routes.index(dist_card):
                if "on_sell_remove_impact" in upgrade.effect_description:
                    # E.g., "Apply_to_route: on_sell_remove_impact(TrackColor.PINK, 1)"
                    try:
                        parts = upgrade.effect_description.split('(')[1].split(')')[0].split(',')
                        track_str = parts[0].split('.')[1].strip()
                        amount_to_remove = int(parts[1].strip())
                        track_color_to_remove = TrackColor[track_str]

                        # Remove from player's impact storage IF it was added by this route, or just reduce general player impact storage.
                        # This is tricky: if Plastic Bottles added +2 PINK, and Bioplastic Seal removes 1 PINK, net is +1 PINK.
                        # The impact from route was already added. This should be a reduction.
                        if player.impact_storage.get(track_color_to_remove, 0) >= amount_to_remove:
                            player.impact_storage[track_color_to_remove] -= amount_to_remove
                            self.game_state.game_log.append(
                                f"  Route Upgrade '{upgrade.name}' for {dist_card.name} removed {amount_to_remove} from {track_color_to_remove.name} in player's storage."
                            )
                        else: # Not enough specific impact to remove, or it wasn't there.
                             self.game_state.game_log.append(
                                f"  Route Upgrade '{upgrade.name}' for {dist_card.name} could not remove {amount_to_remove} {track_color_to_remove.name} (not enough in storage)."
                            )
                    except Exception as e:
                        self.game_state.game_log.append(f"  Error parsing route upgrade effect '{upgrade.effect_description}': {e}")


    def _apply_global_event_effects(self, event_card: GlobalEventCard):
        """Applies the mechanical effects of a triggered global event."""
        self.game_state.game_log.append(f"APPLYING GLOBAL EVENT: {event_card.name} - {event_card.effect_description}")
        # Effects are applied to GameState or relevant entities

        if event_card.name == "Aquifer Collapse":
            # Effect: "All 'Well' type facilities output halved until Depletion <= 6. New Wells cannot be built."
            # The halving and build restriction are checked during relevant actions (produce_water, build_facility).
            # This function mainly notes its activation. Deactivation logic is in threshold_check_phase.
            pass # Logic is checked elsewhere based on this event being in active_global_events

        elif event_card.name == "Heatwave Frenzy":
            # Effect: "Double demand across all segments. All facilities Flow –1 (overheat)."
            for seg in self.game_state.demand_segments.values():
                seg.current_demand *= 2
                self.game_state.game_log.append(f"  Demand for {seg.name} doubled to {seg.current_demand} due to Heatwave.")
            # Flow –1 is checked in action_produce_water.

        elif event_card.name == "Microplastic Revelation":
            # Effect: "All 'Plastic Bottles' routes instantly add +3 μP then flip face-down (cannot be used)."
            total_plastic_routes_affected = 0
            for player in self.game_state.players:
                for route in player.distribution_routes:
                    if route and route.name == "Plastic Bottles" and route.is_active:
                        route.is_active = False
                        # Add impact directly to global track per player owning the route
                        self.game_state.add_global_impact(TrackColor.PINK, 3)
                        total_plastic_routes_affected+=1
                        self.game_state.game_log.append(f"  {player.name}'s {route.name} deactivated. +3 PINK impact added directly to global track from Microplastic Revelation.")
            if total_plastic_routes_affected == 0:
                 self.game_state.game_log.append(f"  Microplastic Revelation triggered, but no active Plastic Bottle routes were found to affect.")


        elif event_card.name == "Mass Recall":
            # Effect: "All unsold Water cubes are immediately discarded. No sales this round from tainted supply."
            for player in self.game_state.players:
                if player.get_total_water_produced() > 0: # Check new water batch system
                    self.game_state.game_log.append(f"  {player.name}'s {player.get_total_water_produced()} water cubes (all batches) discarded due to Mass Recall.")
                    player.water_batches = [] # Clear all batches
            # The "no sales this round" part is handled by Crowd Phase checking for this active event.

        # Add other global event effects here...


    def threshold_check_phase(self):
        """Check for track thresholds, trigger events, check game end. Global Events are now triggered by add_global_impact."""
        self.game_state.game_log.append("\n-- Threshold Check Phase --")

        # 0. Handle Algae Carbon Sink type cleanups (Facility Tags)
        for player in self.game_state.players:
            for facility in player.facilities:
                if facility:
                    for upgrade in facility.upgrades: # Tags are stored as upgrades
                        if upgrade.type == "FACILITY_TAG" and "at_cleanup_reduce_global_impact" in upgrade.effect_description:
                            # E.g., "Passive_facility_effect: at_cleanup_reduce_global_impact(TrackColor.GREY, 1)"
                            try:
                                parts = upgrade.effect_description.split('(')[1].split(')')[0].split(',')
                                track_str = parts[0].split('.')[1].strip()
                                amount_to_reduce = int(parts[1].strip())
                                track_color_to_reduce = TrackColor[track_str]

                                if self.game_state.impact_tracks[track_color_to_reduce].level > 0:
                                     self.game_state.impact_tracks[track_color_to_reduce].reduce_impact(amount_to_reduce)
                                     self.game_state.game_log.append(
                                         f"  {player.name}'s '{facility.name}' with '{upgrade.name}' reduced global {track_color_to_reduce.name} track by {amount_to_reduce}."
                                     )
                            except Exception as e:
                                self.game_state.game_log.append(f"  Error parsing Algae Carbon Sink effect '{upgrade.effect_description}': {e}")


        self.resolve_aqua_futures()

        newly_triggered_events_this_phase: List[GlobalEventCard] = []
        # Check Global Event Card triggers (these might have been missed if impact added outside consolidation)
        for track_color, track in self.game_state.impact_tracks.items():
            for event_card in list(self.game_state.global_event_tiles_available):
                 if event_card.trigger_track == track_color and \
                    track.level >= event_card.trigger_threshold and \
                    event_card not in self.game_state.global_event_tiles_active:
                    # This event triggers now. Call GameState's method to log and add to active.
                    self.game_state.trigger_global_event(event_card) # This will log "GLOBAL EVENT TRIGGERED..."
                    # self.game_state.global_event_tiles_available.remove(event_card) # if one-time & to be removed from available
                    newly_triggered_events_this_phase.append(event_card) # Still collect to apply effects
                    # Blame assignment for events triggered here is harder - general environment.

        for event_card in newly_triggered_events_this_phase: # These are now already in global_event_tiles_active
            self._apply_global_event_effects(event_card) # Apply mechanical effects
            # Check if this newly triggered event matures any player's Event Options
            for player in self.game_state.players:
                for option in player.event_options:
                    if option.event_name == event_card.name and not option.has_matured:
                        option.has_matured = True
                        player.cred_coin += option.payout
                        self.game_state.game_log.append(
                            f"  {player.name}'s Event Option for '{event_card.name}' matured! Payout: {option.payout} CC."
                        )
                # Remove matured options (or mark them as paid)
                player.event_options = [opt for opt in player.event_options if not opt.has_matured]


        # Check for deactivation of Aquifer Collapse
        aquifer_collapse_event = next((e for e in self.game_state.global_event_tiles_active if e.name == "Aquifer Collapse"), None)
        if aquifer_collapse_event and self.game_state.impact_tracks[TrackColor.BLUE].level <= 6:
            self.game_state.global_event_tiles_active.remove(aquifer_collapse_event)
            # self.game_state.global_event_tiles_available.append(aquifer_collapse_event) # Or it's gone forever
            self.game_state.game_log.append("Aquifer Collapse event ended as Depletion track is now <= 6.")


        # Check non-event track threshold effects
        for track_color, track in self.game_state.impact_tracks.items():
            for threshold_level, effect_desc_key in track.thresholds.items():
                if track.level >= threshold_level:
                    if effect_desc_key not in self.game_state.active_threshold_effects:
                        self.game_state.game_log.append(f"Threshold Effect Activated on {track.name} at level {track.level}: {self.game_state.threshold_effect_descriptions.get(effect_desc_key, effect_desc_key)}")
                        self.game_state.active_threshold_effects.add(effect_desc_key)
                        # TODO: self.apply_threshold_effect_mechanics(effect_desc_key) - e.g. if it's an immediate cost change
                elif effect_desc_key in self.game_state.active_threshold_effects:
                     self.game_state.game_log.append(f"Threshold Effect Deactivated on {track.name}: {self.game_state.threshold_effect_descriptions.get(effect_desc_key, effect_desc_key)}")
                     self.game_state.active_threshold_effects.remove(effect_desc_key)
                     # TODO: self.remove_threshold_effect_mechanics(effect_desc_key)

        self.game_state.check_for_uninhabitable()
        if self.game_state.uninhaitable:
            self.game_state.game_log.append("Planet is Uninhabitable! Game Over.")
            # Game proceeds to final scoring.

    def run_round(self, cli_callbacks: dict):
        """
        Executes all phases of a single game round.
        `cli_callbacks` is a dictionary containing callbacks for CLI interactions:
            'get_player_draft_choice_cb': fn(player, options, pick_number)
            'get_player_action_choice_cb': fn(player, action_num) -> calls game_logic.action_...
            'get_player_sales_choices_cb': fn(player, water, demands, tracks) -> returns sales_made
        """
        self.game_state.previously_active_events_this_round = set(self.game_state.global_event_tiles_active) # Track for blame assignment
        self.game_state.track_levels_at_round_start = {tc: track.level for tc, track in self.game_state.impact_tracks.items()}


        self.whim_draft_phase(cli_callbacks['get_player_draft_choice_cb'])
        self.ops_phase(cli_callbacks['get_player_action_choice_cb'])
        self.crowd_phase(cli_callbacks['get_player_sales_choices_cb'])
        self.threshold_check_phase()
        # Reset round-specific states (e.g., demand segment modifiers from whims)
        self.reset_round_modifiers()


    def reset_round_modifiers(self):
        """Resets temporary modifiers at the end of a round (e.g., demand segment values to base)."""
        self.game_state.game_log.append("Resetting round modifiers...")
        # Ensure base definitions are stored if not already
        if not hasattr(self.game_state, 'demand_segments_base_definitions') or not self.game_state.demand_segments_base_definitions :
             self.game_state.demand_segments_base_definitions = {
                name: {'base_demand': seg.current_demand, 'base_price': seg.current_price} # Store initial values at game setup
                for name, seg in self.game_state.demand_segments.items()
            }

        for segment_name, base_data in self.game_state.demand_segments_base_definitions.items():
            segment = self.game_state.demand_segments.get(segment_name)
            if segment:
                segment.current_demand = base_data['base_demand']
                segment.current_price = base_data['base_price']
        self.game_state.game_log.append("Demand segments reset to base values.")
        # Any other temporary effects should be reset here.
        # For example, if Whims add temporary player abilities or card states.

    def resolve_aqua_futures(self):
        """Evaluates and cashes out matured futures tokens at Threshold Check."""
        self.game_state.game_log.append("Evaluating Aqua-Futures Market...")

        # Calculate track changes this round
        track_changes_this_round: Dict[TrackColor, int] = {}
        for tc, track in self.game_state.impact_tracks.items():
            round_start_level = self.game_state.track_levels_at_round_start.get(tc, track.level) # Default to current if not found
            track_changes_this_round[tc] = track.level - round_start_level

        for player in self.game_state.players:
            matured_futures: List[FutureToken] = []
            spoiled_futures: List[FutureToken] = []

            for token in player.futures_tokens:
                change = track_changes_this_round.get(token.track, 0)
                matured = False
                spoiled = False

                if token.is_long:
                    if token.matures_at_increase is not None and change >= token.matures_at_increase:
                        matured = True
                    elif change < 0: # Decreased when long
                        spoiled = True
                else: # is_short
                    if token.matures_at_decrease is not None and change <= -token.matures_at_decrease: # change is negative
                        matured = True
                    elif change > 0: # Increased when short
                        spoiled = True

                if matured:
                    player.cred_coin += token.payout
                    self.game_state.game_log.append(
                        f"{player.name}'s {('Long' if token.is_long else 'Short')} {token.track.name} future matured! Payout: {token.payout} CC."
                    )
                    matured_futures.append(token)
                elif spoiled:
                    self.game_state.game_log.append(
                        f"{player.name}'s {('Long' if token.is_long else 'Short')} {token.track.name} future spoiled."
                    )
                    spoiled_futures.append(token)

            # Remove matured and spoiled futures from player's hand
            player.futures_tokens = [t for t in player.futures_tokens if t not in matured_futures and t not in spoiled_futures]


    def final_scoring(self):
        """Calculates and logs final scores for all players."""
        self.game_state.game_log.append("\n--- Final Scoring ---")
        scores: Dict[str, Dict[str, any]] = {} # Store score and tie_breaker_value
        self.game_state.game_log.append("\n--- Final Scoring Details ---")

        for player in self.game_state.players:
            base_score = player.cred_coin
            base_score += player.reputation_stars

            diversity_bonus = 0
            if len(player.routes_built_this_game) >= 3:
                diversity_bonus = 3
                base_score += diversity_bonus

            penalties = player.triggered_global_events * 2
            final_score = base_score - penalties

            total_impact_spilled_sum = sum(player.total_impact_contributed.values())

            scores[player.name] = {
                "vp": final_score,
                "tie_breaker_impact": total_impact_spilled_sum
            }
            self.game_state.game_log.append(
                f"{player.name}: \n"
                f"  CredCoin: {player.cred_coin} VP\n"
                f"  Reputation Stars: {player.reputation_stars} VP\n"
                f"  Diversity Bonus ({len(player.routes_built_this_game)} distinct routes): +{diversity_bonus} VP\n"
                f"  Global Event Penalties ({player.triggered_global_events} events * -2): -{penalties} VP\n"
                f"  ----------------------------------\n"
                f"  Total VP: {final_score}\n"
                f"  Total Impact Spilled (for tie-breaking): {total_impact_spilled_sum}"
            )

        if not scores:
            self.game_state.game_log.append("\nNo scores to determine a winner.")
            return

        # Determine winner
        # Sort players first by VP (descending), then by total_impact_spilled (ascending)
        sorted_players = sorted(
            scores.items(),
            key=lambda item: (item[1]["vp"], -item[1]["tie_breaker_impact"]), # Negative for ascending impact
            reverse=True # VP descending
        )

        if not sorted_players:
             self.game_state.game_log.append("\nNo players to determine a winner.")
             return

        winner_name = sorted_players[0][0]
        winner_score_info = sorted_players[0][1]

        self.game_state.game_log.append(
            f"\n🏆 Winner: {winner_name} with {winner_score_info['vp']} VP "
            f"(Impact: {winner_score_info['tie_breaker_impact']}) 🏆"
        )

        if len(sorted_players) > 1:
            self.game_state.game_log.append("\n--- Rankings ---")
            for i, (name, score_info) in enumerate(sorted_players):
                self.game_state.game_log.append(
                    f"{i+1}. {name}: {score_info['vp']} VP (Impact: {score_info['tie_breaker_impact']})"
                )


if __name__ == '__main__':
    # Quick test of initialization and a round
    game = GameLogic(num_players=2, player_names=["Player Alpha", "Player Omega"])
    game.start_game() # Sets up decks

    # Manually run a round for demonstration
    print(f"\n--- Simulating Round {game.game_state.round_number} ---")
    game.run_round()

    # Log output can be checked
    print("\n--- Game Log ---")
    for entry in game.game_state.game_log:
        print(entry)

    # Simulate game end condition for scoring test
    # game.game_state.uninhaitable = True
    # game.final_scoring()
    # print("\n--- Game Log After Scoring ---")
    # for entry in game.game_state.game_log[-5:]: # Print last few entries
    #     print(entry)

    # Test Whim effect parsing (if cards.py has WHIMS_DATA with parseable strings)
    if game.game_state.whim_deck_source:
        test_whim = game.game_state.whim_deck_source[0]
        print(f"\nTesting whim parsing for: {test_whim.name}")
        print(f"Pre-effect string: {test_whim.pre_round_effect}")
        game.resolve_whim_pre_effect(test_whim) # Will log to game_state.game_log
        print(f"Post-fallout string: {test_whim.post_round_fallout}")
        game.resolve_whim_post_fallout(test_whim) # Will log

        print("\n--- Relevant Game Log Entries for Whim Test ---")
        # Search for the whim name in log
        for entry in game.game_state.game_log:
            if test_whim.name in entry or "Global track" in entry or "DemandSegment" in entry :
                print(entry)
    else:
        print("\nNo Whim cards in source deck to test parsing.")
