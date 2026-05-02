# Waterbarons Game Studio Production Plan

Status: routed plan, 2026-04-26

This plan translates the approved Waterbarons direction into the game-studio execution
track. It is intentionally narrow: build a playable browser slice before expanding content,
assets, or metagame.

## Studio Classification

Route: `2D default`.

Waterbarons is a stylized 2D isometric browser game. The correct execution path is:

- `web-game-foundations`: architecture, state ownership, save/debug/perf boundaries.
- `phaser-2d-game`: basin scene, camera, tile rendering, flow animation, build previews.
- `game-ui-frontend`: lobby, HUD, inspectors, civic feed, policy surfaces, responsive layout.
- `sprite-pipeline`: later, once the placeholder modular asset grammar is stable.
- `game-playtest`: after the first interactive local slice exists.

Do not route this through 3D, React Three Fiber, raw WebGL, or a board-game framework.

## Product Shape

Waterbarons is a multiplayer roguelike city/basebuilder about running a premium water
corporation during managed civilizational failure.

The game should feel like:

- a basebuilder about infrastructure placement and fragile networks
- a run-based systems game with visible collapse pressure
- a satire of corporate optimism and institutional capture
- a multiplayer contest over market access, blame, policy, and scarce water

It should not feel like:

- an RTS combat game
- a tabletop board game
- a card battler
- a generic management dashboard
- a dark noisy survival sim

## Execution Stack

| Layer | Decision | Ownership |
| --- | --- | --- |
| Simulation | TypeScript modules under `src/game` | deterministic state, rules, civic model, validation |
| Multiplayer | Colyseus | authoritative room, player slots, snapshots, intents |
| Playfield | Phaser | isometric basin, structures, pipes, selection, previews, animation |
| HUD / Menus | React DOM | lobby, resource strip, inspectors, market, civic feed, policies |
| Styling | CSS variables and component classes | approved light corporate visual package |
| Assets | manifest keys | procedural-friendly sprites and UI art |
| Tests | Vitest plus browser smoke tests | rules, civic feedback, server intents, rendering sanity |

## Current Technical State

The repo now has the core browser-game shell wired:

- `src/game/types.ts` defines serializable basin state.
- `src/game/sim.ts` owns interactive mutations, production pulses, sales, and civic feedback outside the renderer.
- `src/server/server.ts` defines the Colyseus `BasinRoom` authority.
- `src/client/BasinScene.ts` renders the isometric Phaser basin from snapshots.
- `src/client/main.tsx` owns the React lobby, HUD, inspectors, market controls, and civic optics panel.
- `docs/browser-game-foundation.md` defines the architecture and style package.

Known rough edges:

- Phaser art is still procedural/vector placeholder work, not a normalized sprite pipeline.
- Colyseus matchmake responses are normalized client-side because the installed `colyseus.js` package expects a nested reservation shape.
- Browser QA is smoke-level; there is not yet a Playwright regression lane.

## Milestone 0: Foundation Lock

Goal: keep the project from drifting back into board-game UI or generic dashboards.

Done when:

- browser-game foundation exists
- civic feedback loop is specified
- production plan exists
- `.gitignore` excludes generated build/dependency output

Current status: complete.

## Milestone 1: Playable Multiplayer Shell

Goal: prove the engine boundary.

Implement:

- Colyseus `BasinRoom`
- create/join lobby
- authoritative `BasinRunState` snapshot broadcast
- client room connection and reconnect-tolerant player slot assignment
- Phaser canvas mounted inside React shell
- map selection and scout movement intent
- DOM top strip and compact inspector

Acceptance:

- `npm run test`
- `npm run build`
- `npm run dev`
- create a room in browser
- join as one player
- click a tile to move the scout
- see the server-confirmed snapshot render in Phaser

Current status: complete as a local slice. Runtime smoke created a room, assigned player slot `0`,
moved the scout, triggered a civic campaign, and received a civic feed update.

## Milestone 2: Basebuilder Loop

Goal: make the game feel like building infrastructure, not moving pieces.

Implement:

- facility build toolbar
- ghost placement preview
- valid/invalid tile overlays
- connection-node highlighting
- server-confirmed build intent
- production pulse animation
- water storage indicators
- route purchase and sale controls
- impact gauge changes after production/sale

Acceptance:

- player can scout, build one valid facility, produce water, buy a route, sell water
- invalid build attempts are rejected by the server and shown in the HUD
- the center of the playfield stays clear during normal play

## Milestone 3: Civic Feedback Slice

Goal: make social media and political pressure mechanically real.

Implement first:

- global civic tracks: `Public Thirst`, `Institutional Trust`, `Outrage`,
  `Dependency`, `Regulatory Heat`, `Capture`
- player civic tracks: `Brand Trust`, `Blame Load`, `Lobby Access`, `Relief Credit`
- generated civic feed items from shortages, luxury sales, relief, spills, and depletion
- policy effects that alter demand, route legality, facility cost, or player blame
- DOM civic feed and policy climate strip

Initial civic actions:

- Sponsor Relief
- Lobby Permit Office
- Launch Premium Campaign
- Blame Rival

Acceptance:

- a sale or shortage creates at least one feed item
- feed reach changes at least one civic track
- civic tracks create a visible policy effect
- policy effect changes a basebuilding decision, not just score text

Current status: stronger partial. Civic tracks, feed items, policy locks/friction, four civic
actions, sentiment-colored feed attribution, deterministic policy forecasting, a
server-resolved policy docket, and client-side consequence previews now exist. The UI now
has a live decision stack that ranks immediate build, sale, scouting, route, and policy
options; build, market, civic, and docket actions show costs, effect deltas, disabled
reasons, and backfire risk before the player commits.
The next pass should make policy dockets more rival-aware and attach them to map locations
or route assets instead of only global civic state.

Map action surface status: first pass complete. The Phaser map now receives staged action
state from the decision stack, pulses staged build targets, highlights valid and partial
build sites, highlights reachable scout moves, labels build blockers, shows facility owner,
stored water, and output badges, and renders a local build-effect callout on the map. The
playfield DOM now also exposes beat clocks for production, round reset, route auction, and
policy docket cadence.

Action clarity status: second pass complete. Valid build selections now expose a contextual
build button on the playfield itself, so the player does not need to scroll below the decision
stack to commit the obvious map action. Decision-stack sale and route actions now scroll to and
highlight the route panel, and that panel has an explicit two-step buy-then-sell route flow.

Map visual clarity status: third pass complete. The map now uses larger isometric tiles, a
deeper basin frame, terrain-specific procedural motifs, quiet valid-site dots instead of
always-on text badges, softer pipe rendering, and selected-only facility readouts. Persistent
facility state is carried by owner accents and water bars so the base reads as infrastructure
instead of a stack of labels.

Asset pack status: first modular PNG pass complete. Phaser now loads terrain and facility
sprites from `src/client/assets`, with `92x48` terrain diamonds and `128x128` facility
silhouettes using the approved bright corporate palette. Editable SVG source artifacts
remain beside the runtime PNGs for now. The pack is still deliberately procedural-friendly
rather than custom-painted; the next visual slice should add pipe-flow pulses, route/policy
map markers, and stronger facility grounding.

Reviewer packet status: first review board complete in `docs/reviews`. The packet defines
five recurring UI review personas and applies them to the current browser slice. The strongest
finding is that the UI now explains actions better, but too much meaning still lives in panels
instead of in map-attached infrastructure, route, and policy states.

## Milestone 4: Visual Style Pass

Goal: replace placeholders with the approved graphical package without sacrificing
procedural readability.

Implement:

- CSS theme tokens from the foundation palette
- light corporate HUD panels
- glossy impact gauges
- modular terrain tile sprites
- modular facility silhouettes
- pipe and flow animation sprites
- owner accent slots
- selected/valid/invalid overlays

Acceptance:

- the game reads as bright, polished, and satirical
- tile and facility assets look reusable, not custom-painted per map
- no noisy grunge, generic cyberpunk, fantasy, or board-game framing

## Milestone 5: Run Pressure And End State

Goal: make a complete short run.

Implement:

- collapse thresholds
- crisis events
- round limit
- final scoring
- attribution report
- replay seed and intent-log export

Acceptance:

- a run can end through collapse or round limit
- the end screen shows money, water supplied, impact contribution, blame load, and civic legacy
- the outcome is replayable from seed plus intent log in tests

## UI Surface Budget

Persistent normal-play surfaces:

- top resource strip
- left build/tool rail
- one right inspector
- compact impact/policy cluster
- bottom event ticker

Collapsed or contextual surfaces:

- full market table
- civic feed detail
- attribution view
- debug overlay
- settings/help

The first playable view must read as a game scene, not a management app.

## Asset Workflow

Start with procedural and vector-like placeholders:

- terrain diamonds generated or drawn from flat colors
- facility shapes assembled from primitive modules
- pipe paths drawn from reusable elbow/junction sprites
- UI icons from `lucide-react` where appropriate

Only move to a formal sprite pipeline after the gameplay footprints, tile sizes, and
facility ports stop changing.

## Test Strategy

Rules tests:

- deterministic setup from seed
- build validation
- production pulses
- sell validation
- impact consolidation
- civic feed generation
- policy effects

Server tests:

- room creation
- join slot assignment
- intent rejection
- snapshot broadcast shape

Browser smoke tests:

- page loads
- room can be created
- Phaser canvas is nonblank
- HUD does not cover the playfield center
- click-to-select and click-to-move work

## Immediate Next Increment

Deepen the basebuilder loop now that the Colyseus + Phaser shell is live.

Priority order:

1. Add explicit pipe placement and connection ports instead of implicit adjacency pipes.
2. Add upgrade sockets and maintenance toggles for facilities.
3. Add a visible run end screen with money, supplied water, impact, blame, and civic legacy.
4. Add browser regression tests for room creation, canvas nonblank, and scout/build interaction.
5. Only then start the sprite pipeline for modular terrain and facility assets.
