"""Generate a simple print-and-play HTML file for Water Barons."""
from pathlib import Path
import argparse

from water_barons import cards
from water_barons.game_entities import WhimCard


def _render_card(card) -> str:
    """Return HTML string for a single card."""
    parts = [f"<strong>{card.name}</strong>"]
    if card.cost:
        parts.append(f"Cost: {card.cost}")
    if getattr(card, "description", ""):
        parts.append(card.description)
    if hasattr(card, "base_output"):
        parts.append(f"Output: {card.base_output}")
    if hasattr(card, "impact_profile"):
        impacts = ", ".join(f"{clr.name}:{val}" for clr, val in card.impact_profile.items())
        if impacts:
            parts.append(f"Impacts: {impacts}")
    if hasattr(card, "tags") and card.tags:
        parts.append("Tags: " + ", ".join(card.tags))
    if isinstance(card, WhimCard):
        parts.append(f"Trigger: {card.trigger_condition}")
        parts.append(f"Effect: {card.pre_round_effect}")
        parts.append(f"Fallout: {card.post_round_fallout}")
    return "<div class='card'>" + "<br>".join(parts) + "</div>"


def generate_print_and_play(out_file: Path | str = "print_and_play.html") -> Path:
    """Generate a basic HTML file with all card information."""
    out_path = Path(out_file)

    facilities = cards.get_all_facility_cards()
    distributions = cards.get_all_distribution_cards()
    upgrades = cards.get_all_upgrade_cards()
    whims = cards.get_all_whim_cards()
    events = cards.get_all_global_event_tiles()

    html = [
        "<html><head><meta charset='utf-8'>",
        "<style>.card{border:1px solid #000;padding:8px;margin:4px;width:200px;display:inline-block;vertical-align:top;font-family:Arial, sans-serif;font-size:12px;}</style>",
        "</head><body>",
        "<h1>Water Barons - Print &amp; Play</h1>",
    ]

    def section(title: str, cards_list: list):
        html.append(f"<h2>{title}</h2>")
        for c in cards_list:
            html.append(_render_card(c))

    section("Facilities", facilities)
    section("Distributions", distributions)
    section("Upgrades", upgrades)
    section("Whims", whims)
    section("Global Events", events)

    html.append("</body></html>")

    out_path.write_text("\n".join(html), encoding="utf-8")
    return out_path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Generate print-and-play HTML file.")
    parser.add_argument(
        "output",
        nargs="?",
        default="print_and_play.html",
        help="Path for the generated HTML file",
    )
    args = parser.parse_args(argv)
    path = generate_print_and_play(args.output)
    print(f"Print and play file generated at {path}")


if __name__ == "__main__":
    main()
