# Waterbarons: Basin Run Design Brief

## One Sentence

A turn-based multiplayer roguelike city/basebuilder where rival water corporations scout a procedural basin, build extraction networks, sell to unstable markets, and decide how much shared ecological collapse they can profitably externalize.

## Shape

The game is a run, not a campaign. A run starts from a seed, generates a basin map, assigns players a headquarters, and ends when the shared basin collapses or the round limit expires. Every run should be readable, deterministic, and replayable from seed plus move log.

## Core Loop

1. Scout tiles to reveal terrain, deposits, hazards, and market opportunities.
2. Build facilities on valid terrain.
3. Produce water, adding immediate player-held impact.
4. Sell water through distribution routes to demand segments.
5. Consolidate impact into shared tracks.
6. Convert shortages, spills, relief, depletion, and luxury trends into civic feed narratives.
7. Let public attention and policy pressure reshape demand, costs, route legality, and blame.
8. Resolve whims, thresholds, events, and scoring pressure.

## Multiplayer Contract

The server owns the authoritative game state. Clients submit intents only: move scout, build, buy route, sell. The client renders a Phaser scene and interpolates the current room snapshot.

The full browser-game foundation, visual style package, input map, and implementation boundary are captured in [browser-game-foundation.md](./browser-game-foundation.md).

## Roguelike Pressure

Each run varies by:

- procedural map seed
- hidden tile resources and hazards
- round whims
- global event trigger order
- scarcity around terrain types and deposits

Failure is normal. Collapse should be legible and attributable.

## Civic Feedback

The social media and political loop is a deterministic pressure layer around the basebuilder. Player actions create operational facts; facts become amplified civic narratives; narratives bend policy through permits, subsidies, inspections, route bans, price controls, protests, and blame; those policy changes reshape the next infrastructure decisions. The detailed model is in [browser-game-foundation.md](./browser-game-foundation.md#attention-and-politics-loop).

## First Vertical Slice

The first slice implements:

- deterministic basin generation
- click-to-move scouts
- automatic production pulses
- scout, build, buy route, and sell actions
- four original Water Barons impact tracks
- original facility and demand identities
- crisis events at impact thresholds
- browser UI with map, boards, build controls, market controls, tracks, and log

## Explicit Non-Goals For The First Slice

- no account system
- no persistent metagame
- no real-money economy
- no large content system
- no simultaneous realtime combat

Those can follow only after the deterministic run loop is solid.
