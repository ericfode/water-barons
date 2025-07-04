import unittest
from water_barons.game_entities import (
    Player, Card, FacilityCard, DistributionCard, UpgradeCard, WhimCard, GlobalEventCard,
    DemandSegment, FutureToken, TrackColor, CardType
)

class TestGameEntities(unittest.TestCase):

    def test_card_creation(self):
        card = Card("Test Card", CardType.FACILITY, cost=5, description="A test card.")
        self.assertEqual(card.name, "Test Card")
        self.assertEqual(card.card_type, CardType.FACILITY)
        self.assertEqual(card.cost, 5)
        self.assertEqual(card.description, "A test card.")

    def test_facility_card(self):
        impact = {TrackColor.GREY: 1, TrackColor.PINK: 1}
        facility = FacilityCard("Glacial Tap", 5, 3, impact, ["ARCTIC"])
        self.assertEqual(facility.name, "Glacial Tap")
        self.assertEqual(facility.cost, 5)
        self.assertEqual(facility.base_output, 3)
        self.assertEqual(facility.impact_profile, impact)
        self.assertIn("ARCTIC", facility.tags)
        self.assertEqual(facility.card_type, CardType.FACILITY)

    def test_distribution_card(self):
        dist = DistributionCard("Plastic Bottles", 1, "Cheap plastic.", {"μP_per_2_cubes_sold": 1})
        self.assertEqual(dist.name, "Plastic Bottles")
        self.assertEqual(dist.cost, 1)
        self.assertEqual(dist.description, "Cheap plastic.")
        self.assertEqual(dist.impact_modifier, {"μP_per_2_cubes_sold": 1})
        self.assertEqual(dist.card_type, CardType.DISTRIBUTION)

    def test_upgrade_card(self):
        upgrade = UpgradeCard("Filter", 2, "Reduces plastics.", "Reduces μP by 1")
        self.assertEqual(upgrade.name, "Filter")
        self.assertEqual(upgrade.cost, 2)
        self.assertEqual(upgrade.description, "Reduces plastics.")
        self.assertEqual(upgrade.effect_description, "Reduces μP by 1")
        self.assertEqual(upgrade.card_type, CardType.UPGRADE)

    def test_whim_card(self):
        whim = WhimCard("Fashion Wave", "μP < 5", "+2 Demand", {}, "Add +1 μP")
        self.assertEqual(whim.name, "Fashion Wave")
        self.assertEqual(whim.trigger_condition, "μP < 5")
        self.assertEqual(whim.pre_round_effect, "+2 Demand")
        self.assertEqual(whim.post_round_fallout, "Add +1 μP")
        self.assertEqual(whim.card_type, CardType.WHIM)

    def test_global_event_card(self):
        event = GlobalEventCard("Heatwave", TrackColor.GREY, 9, "Hot hot hot.")
        self.assertEqual(event.name, "Heatwave")
        self.assertEqual(event.trigger_track, TrackColor.GREY)
        self.assertEqual(event.trigger_threshold, 9)
        self.assertEqual(event.effect_description, "Hot hot hot.")
        self.assertEqual(event.card_type, CardType.GLOBAL_EVENT)

    def test_player_creation(self):
        player = Player("Test Player")
        self.assertEqual(player.name, "Test Player")
        self.assertEqual(player.cred_coin, 10) # Default starting
        self.assertEqual(len(player.facilities), 3)
        self.assertIsNone(player.facilities[0])
        self.assertEqual(player.impact_storage, {track: 0 for track in TrackColor})
        self.assertEqual(player.water_batches, [])
        self.assertEqual(player.get_total_water_produced(), 0)

    def test_player_water_batches(self):
        player = Player("Water Seller")
        self.assertEqual(player.get_total_water_produced(), 0)
        batch1 = {'facility_name': 'Well A', 'facility_tags': ['GROUNDWATER'],
                  'base_impact_profile': {TrackColor.BLUE: 1}, 'quantity': 5, 'production_round': 1}
        batch2 = {'facility_name': 'Glacial Tap B', 'facility_tags': ['ARCTIC'],
                  'base_impact_profile': {TrackColor.PINK: 1, TrackColor.GREY: 1}, 'quantity': 3, 'production_round': 1}
        player.water_batches.append(batch1)
        self.assertEqual(player.get_total_water_produced(), 5)
        player.water_batches.append(batch2)
        self.assertEqual(player.get_total_water_produced(), 8)

        # Simulate selling from batch1
        player.water_batches[0]['quantity'] -= 2
        self.assertEqual(player.get_total_water_produced(), 6)

        # Simulate selling all from batch1
        player.water_batches[0]['quantity'] = 0
        # Remove if empty (logic would be in GameLogic, but testing entity state)
        player.water_batches = [b for b in player.water_batches if b['quantity'] > 0]
        self.assertEqual(len(player.water_batches), 1)
        self.assertEqual(player.get_total_water_produced(), 3)
        self.assertEqual(player.water_batches[0]['facility_name'], 'Glacial Tap B')


    def test_demand_segment(self):
        segment = DemandSegment("Frugalists", 4, 1, "Cheap!")
        self.assertEqual(segment.name, "Frugalists")
        self.assertEqual(segment.current_demand, 4)
        self.assertEqual(segment.current_price, 1)
        self.assertEqual(segment.values_description, "Cheap!")

    def test_future_token(self):
        token = FutureToken(TrackColor.PINK, is_long=True, purchase_price=2)
        self.assertEqual(token.track, TrackColor.PINK)
        self.assertTrue(token.is_long)
        self.assertEqual(token.purchase_price, 2)
        self.assertEqual(token.payout, 5)
        self.assertEqual(token.matures_at_increase, 2)
        self.assertIsNone(token.matures_at_decrease)

        short_token = FutureToken(TrackColor.BLUE, is_long=False, purchase_price=2)
        self.assertFalse(short_token.is_long)
        self.assertEqual(short_token.matures_at_decrease, 2)
        self.assertIsNone(short_token.matures_at_increase)

if __name__ == '__main__':
    unittest.main()
