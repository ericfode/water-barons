# Water Barons Source Recovery

Recovered source:

- GitHub repository: `ericfode/water-barons`
- URL: `https://github.com/ericfode/water-barons`
- Current GitHub default branch observed on 2026-04-26: `main`
- Local vendored snapshot: `reference/water-barons`
- Historical Codex state also referenced `feature/card-effect-refinements-and-testing`; that branch still exists remotely but GitHub now reports `main` as default.

Note: on 2026-05-02 this browser project replaced the GitHub repository history. The source material remains in the vendored snapshot path above instead of a live submodule.

## Original Premise

The old project describes **Water Barons** as an engine-builder of thirst and consequence. Players run water conglomerates in a stateless basin, extract and sell water, and push shared hidden dials toward collapse.

Core source mechanics:

- players manage CredCoin, reputation, facilities, distribution routes, upgrades, futures, and event options
- facilities produce water and add impact into player storage
- distribution routes sell water and can add further impact
- impact consolidates into shared global tracks
- demand segments pay different prices under different ethical and convenience constraints
- whim cards shift demand and create fallout
- global events trigger at track thresholds
- the game ends when three impact tracks reach maximum

## Original Tracks

- `PINK`: Microplastics / `μP`
- `GREY`: Carbon Intensity / `CO2e`
- `BLUE`: Depletion / `DEP`
- `GREEN`: Chemical Residue / `TOX`

## Original Demand Segments

- Frugalists: low price, broad demand
- Convenientists: prefer plastic or drone distribution
- Eco-Elites: require low microplastics and carbon
- Connoisseurs: reject high toxic residue and value glacial sources

## Original Facilities And Routes

Facilities:

- Glacial Tap
- Greywater Loop
- Aquifer Well
- Desalination Plant
- Cloud Harvester
- Fog Net Array

Distribution routes:

- Plastic Bottles
- Drone Drops
- Smart-Pipe Network
- Aluminum Cans

## Browser Adaptation

This project keeps the economic identity but changes the shape:

- board/card engine builder becomes map-based city/basebuilder
- facilities become map structures with terrain requirements
- the crowd deck becomes a roguelike run modifier stream
- impact tracks become shared pressure clocks
- player corporations now scout, claim, and develop a procedural basin
- multiplayer remains turn-based and deterministic
