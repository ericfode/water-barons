# Waterbarons: Basin Run

A browser-based multiplayer roguelike city/basebuilder derived from the original **Water Barons** board/card engine builder.

The recovered source game centered on water extraction corporations, demand whims, global environmental impact tracks, and collapse thresholds. This implementation turns that into a procedural basin run: players scout a shared map, build water infrastructure, produce and sell water, and push shared impact tracks toward crisis while competing for score.

## Run

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The authoritative Colyseus multiplayer server runs on <http://127.0.0.1:8000>.

## Current Slice

- deterministic procedural basin map from a seed
- realtime multiplayer room state via Colyseus
- Phaser basin canvas with click-to-move scouts
- automatic facility production cycles
- scout, build, route buying, and market selling
- original Water Barons impact tracks: microplastics, carbon, depletion, toxic residue
- original-style facilities, distribution routes, demand segments, whims, and global events
- browser UI for map, player boards, build controls, impacts, and event log

## Source Material

The original source snapshot is vendored into `reference/water-barons` for provenance. The recovered mechanics are summarized in [docs/source-recovery.md](./docs/source-recovery.md), the browser game direction is captured in [docs/design-brief.md](./docs/design-brief.md), the implementation foundation plus visual style package is in [docs/browser-game-foundation.md](./docs/browser-game-foundation.md), and the staged production route is in [docs/game-studio-production-plan.md](./docs/game-studio-production-plan.md).

## Verify

```bash
npm run test
npm run build
```

## Symphony

The repo-owned Symphony workflow is in [WORKFLOW.md](./WORKFLOW.md). Setup and run notes are in [docs/symphony.md](./docs/symphony.md).
