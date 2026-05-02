# Water Barons - Engine Builder Game

A text-based simulation of the board game "Water Barons — an Engine‑Builder of Thirst & Consequence".

## Premise

A restless, post‑Basic‑Income humanity still needs to sip. In a stateless, anarcho‑capitalist basin, you stand at the helm of a water conglomerate, squeezing profit from springs, glaciers, fog, or recycled sewage. Every drop you sell pushes one of the planet’s hidden dials—microplastics, carbon load, aquifer depletion, chemical residue—toward collapse. The crowd (flush with BI credits and whims) rewards convenience, ethics, or trendiness on a whim. You must build the most ruthless yet resilient engine, riding those whims while the world’s water—and conscience—slowly curdles.

## How to Run

This project uses [uv](https://github.com/astral-sh/uv) for dependency management. Ensure you have Python 3.8+ installed and `uv` available (install with `pip install uv` if needed).

1.  **Clone the repository (if applicable) or ensure all files are in the same directory structure.**
2.  **Navigate to the root directory of the project.**
3.  **Install dependencies with uv:**
    ```bash
    uv sync
    ```
4.  **Run the Command Line Interface (CLI):**
    ```bash
    uv run -- python -m water_barons.cli
    ```
    *(Note: If you are in the directory containing the `water_barons` package, you might run `uv run water_barons/cli.py` directly, but the `-m` method is generally more robust for packages.)*

5.  **Follow the on-screen prompts to start a new game, enter player names, and play.**

5.  **Customize Card Data (Optional):**
    All facilities, upgrades, whims, and player actions are defined in
    `water_barons/game_content.toml`. Edit this file to tweak values for a
    print‑and‑play version of the game.  Set the environment variable
    `WATER_BARONS_DATA_FILE` to load card data from a different path.

6.  **Generate a Print & Play File:**
    Run the following command to create an HTML file containing all card
    information for easy printing:
    ```bash
    uv run python -m water_barons.print_and_play my_print_and_play.html
    ```
    Open `my_print_and_play.html` in a browser and print it to have a
    physical copy of the cards.

7.  **Export Data for Tabletop Simulator:**
    Run the exporter to generate a JSON file suitable for building a
    Tabletop Simulator mod:
    ```bash
    uv run python -m water_barons.tabletop_simulator
    ```
    This command writes `tabletop_export.json` in the project root.

## Game Overview (Simplified for CLI)

The game proceeds in rounds, each consisting of several phases:

1.  **Whim Draft Phase:** Players contribute to a "Crowd Deck" of Whim cards that will influence the round. (Currently automated in CLI)
2.  **Ops Phase:** Players take turns performing 2 actions each. Actions include:
    *   Building Facilities (e.g., Wells, Desal Plants)
    *   Producing Water ("Flow" action)
    *   Building Distribution Routes (e.g., Plastic Bottles, Drones)
    *   Adding Upgrades/Mitigations
    *   Speculating on Impact Tracks (Aqua-Futures Market - Not fully implemented in CLI Ops choices yet)
    *   Marketing ("Spin" - Not implemented yet)
3.  **Crowd Phase:**
    *   Whim cards from the Crowd Deck are revealed, applying effects.
    *   Players sell their produced Water to meet demand from different customer segments. (Currently placeholder in CLI)
    *   Post-round fallout from Whim cards is resolved.
    *   Impact cubes from player actions are added to global tracks.
    *   Unsold water evaporates.
4.  **Threshold Check Phase:**
    *   Impact Tracks are checked. If they cross certain thresholds, Global Events may trigger, altering game conditions.
    *   (Aqua-Futures Market payouts would happen here - Not fully implemented yet)
    *   If three Impact Tracks reach their maximum level (10), the planet becomes Uninhabitable, and the game ends.

## Core Game Entities

*   **Players:** Manage CredCoin, facilities, distribution routes, and try to gain Reputation.
*   **Impact Tracks:** Shared tracks (μP, CO₂e, DEP, TOX) that measure environmental damage. Higher levels trigger negative effects.
*   **Cards:**
    *   **Facility Cards:** Allow water production (e.g., Glacial Tap, Greywater Loop).
    *   **Distribution Cards:** Methods to sell water (e.g., Plastic Bottles, Smart-Pipe).
    *   **Upgrade Cards:** Enhance facilities/routes or mitigate impact (e.g., Microplastic Filter).
    *   **Whim Cards:** Represent shifting public opinion, affecting demand and game rules each round.
    *   **Global Event Cards:** Triggered by high Impact Track levels, causing major game-altering effects.
*   **Demand Segments:** Different types of customers (Frugalists, Eco-Elites, etc.) with varying demands and price sensitivities.

## Winning

The game ends when the planet becomes Uninhabitable. Players score based on:
*   CredCoin (cash)
*   Reputation Stars
*   Diversity Bonus (for using multiple route types - Not fully implemented in CLI scoring yet)
*   Penalties for triggering Global Events (Not fully tracked/penalized in CLI scoring yet)

The player with the highest Victory Points (VP) wins.

## Development Status & CLI Limitations

This CLI version is a foundational implementation of the game rules. Many aspects are simplified for text-based play:
*   **User Interface:** Purely text-based. Requires careful reading of prompts.
*   **Player Choices:** Some complex decisions (e.g., detailed selling priorities, specific targeting of upgrades) are simplified or automated.
*   **Aqua-Futures Market:** Basic structures are present, but full interaction (buy/sell/payout) is not yet integrated into player actions or threshold checks.
*   **Advanced Rules:** Optional modules (Asymmetric Executives, Collective Governance, Solitaire/Co-op) are not implemented.
*   **Visuals/Art:** The rich theme and art direction described in the concept are, naturally, absent in this CLI version.

## Running Tests

To run the automated tests:
```bash
uv run -- python -m unittest discover -s tests
```
This command should be run from the root directory of the project after running `uv sync` once to install dependencies.

---
This README provides a basic guide to the current CLI version of Water Barons.
The game logic is based on the detailed design document provided.
Further development would involve implementing more interactive choices, the full Aqua-Futures market, and eventually a graphical user interface.
