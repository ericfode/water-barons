# Waterbarons Browser Game Foundation

Status: design baseline, 2026-04-26

This document is the implementation frame for turning Waterbarons into a browser-based
multiplayer roguelike city/basebuilder. It supersedes the earlier board-game-shaped UI
direction. The game is interactive, but it is not an RTS: the pressure comes from
finite water, market appetite, shared collapse tracks, and irreversible infrastructure
choices, not unit micromanagement.

## Foundation Decision

Waterbarons uses a split architecture:

- Phaser renders the isometric basin playfield.
- React/DOM renders lobby, HUD, inspectors, build controls, logs, menus, and accessibility-sensitive text.
- Colyseus owns the authoritative multiplayer room.
- The simulation remains renderer-independent TypeScript under `src/game`.
- The client sends intents only; the server mutates and broadcasts basin snapshots.

The renderer is never the source of truth. Phaser may animate flow, selection, placement
previews, fog, and workers, but all durable state belongs to the simulation.

## Design Pillars

1. Build a fragile water machine.
   The player should feel like they are assembling a useful industrial organism from wells,
   filters, pumps, tanks, pipe elbows, market depots, and brittle routes.

2. Basebuilder first.
   The core pleasure is placing, connecting, tuning, and watching infrastructure pulse.
   Scouting exists to expose build opportunities. Workers are ambient indicators, not
   controllable combat units.

3. Corporate optimism over apocalypse grime.
   The world is bright, polished, and absurdly confident. Collapse is sold as an investor
   dashboard. Tanks glisten. Gauges are premium. The basin is being ruined by cleanly
   branded short-term thinking.

4. Procedural-friendly visuals.
   Every world tile and structure must be buildable from a small asset library. No dense
   grunge, no painterly debris fields, no hard-to-reproduce background noise.

5. Collapse is legible.
   Environmental harm must be visible through gauges, route warnings, event overlays,
   facility footprints, and changes in terrain or markets. The player should know who
   caused what.

## Player Fantasy

The player is a water baron running a shiny extraction company in a stateless basin near
the end of civilization. They do not save the world. They race to convert scarcity into
score before the basin becomes uninhabitable.

The tone is satirical but controlled: polished investor optimism, luxury water branding,
cheerful compliance language, and increasingly indefensible infrastructure decisions.

## Primary Verbs

- Scout: reveal tiles, deposits, hazards, and demand nodes.
- Place: build facilities on valid terrain.
- Connect: extend pipe networks, depots, and distribution routes.
- Tune: upgrade facilities, assign maintenance, shift capacity, and manage storage.
- Sell: route water into demand segments with different tastes and externalities.
- Externalize: accept impact, defer consequences, or push risk into shared tracks.
- Spin: shape public narratives, blame rivals, greenwash routes, and lobby policy relief.
- Adapt: respond to whims, crises, depleted basins, route bans, and market swings.

The input burden should be low. A player should mostly point, inspect, preview, confirm,
and occasionally retune systems. Fast repeated clicking must not become the dominant skill.

## Core Run Loop

1. Lobby creates or joins a seeded basin.
2. Players start with an HQ, a scout, starting credits, and a small revealed area.
3. Scouting reveals terrain, deposits, hazards, and market edges.
4. Players place facilities and connect them into storage and distribution networks.
5. Facilities pulse water into local and player storage on server ticks.
6. Players sell water into demand segments through owned routes.
7. Facilities and routes add pending impact.
8. The server consolidates impact into shared tracks on round beats.
9. Attention and political pressure react to sales, scandals, shortages, and impact.
10. Whims and global events change demand, route viability, production, and risk.
11. The run ends when collapse conditions are met or the round limit expires.

The intended emotional shape is "we can still optimize this" until the basin makes that
belief absurd.

## Attention And Politics Loop

Social media and politics should form a second-order feedback system around the basebuilder,
not a separate card minigame. The player builds infrastructure; the attention system explains
why obviously destructive choices keep becoming profitable, legal, and popular for one more
round.

The loop has four layers:

1. Operational facts.
   Player actions produce objective facts: water sold, shortages relieved, aquifers depleted,
   route waste created, hazards disturbed, facilities collapsed, and impact tracks advanced.

2. Narrative amplification.
   Facts become story seeds in the civic feed. The algorithm favors urgency, fear, luxury,
   blame, and novelty. A small spill can outrun a major depletion event if it photographs
   better. A shiny Cloud Harvester can drown out a worse long-term BLUE impact if the public
   mood wants optimism.

3. Political response.
   Amplified stories change the policy climate: permits, subsidies, inspections, route bans,
   emergency purchasing, ration pressure, price controls, protest risk, and public-private
   extraction deals.

4. Strategic distortion.
   Players respond by changing builds, sales, routes, lobbying, greenwashing, relief gestures,
   or blame campaigns. Those responses create new facts, restarting the loop.

This is the game's satirical engine: collapse accelerates because the short-term political
reward for making the crisis look managed is often higher than the reward for solving it.

## Social State Model

The first durable model should avoid real-world parties and use fictional civic forces.

Global social tracks:

- Public Thirst: scarcity anxiety and demand urgency.
- Institutional Trust: belief that the basin is being managed competently.
- Outrage: anger looking for a responsible actor.
- Dependency: how much the public now needs baron infrastructure to survive.
- Regulatory Heat: pressure for inspections, bans, penalties, and price controls.
- Capture: how much policy has been bent toward the water companies.

Player-facing reputation tracks:

- Brand Trust: willingness to buy from this company despite impact.
- Blame Load: how much of the current crisis is publicly attached to this company.
- Lobby Access: ability to soften or delay policy constraints.
- Relief Credit: goodwill earned by emergency aid, rationing, or public works.

These values should be numeric, deterministic, and visible enough to be planned around.
They should not simulate ideology in detail. They simulate incentives, attention, and
institutional failure.

## Civic Actors

Actors are pressure sources, not full NPC factions in the first implementation.

- Municipal Council: permits, taxes, emergency contracts, price controls.
- Basin Authority: inspections, extraction limits, route bans, impact thresholds.
- Investor Bloc: growth demands, credit injections, reputation penalties for restraint.
- Influencer Market: luxury trends, brand trust spikes, volatile demand shifts.
- Mutual Aid Network: exposes shortages, rewards relief, punishes visible hoarding.
- Populist Office: blame campaigns, emergency decrees, anti-baron spectacle.
- Scientific Panel: slow but high-credibility warnings, track attribution, event forecasts.

Each actor should have:

- one appetite
- one lever
- one visual identity
- one way to be appeased temporarily
- one way they become dangerous if ignored

## Civic Feed

The civic feed is the readable surface for social media dynamics. It should feel like a
premium crisis-monitoring terminal, not a real social-media clone.

Feed items are generated from templates:

- `shortage`: demand unmet, Public Thirst rises.
- `relief`: player sells below market or supplies emergency contract, Relief Credit rises.
- `luxury`: high-price segment trends, Brand Trust and demand rise while Outrage may rise.
- `spill`: GREEN or PINK incident, Outrage and Regulatory Heat rise.
- `depletion`: BLUE threshold, Dependency and long-term collapse pressure rise.
- `greenwash`: player PR reframes impact, short-term Trust rises, future scandal risk rises.
- `blame`: rival-targeted narrative shifts Blame Load if evidence is plausible.
- `capture`: lobbying delays regulation, Capture rises and Trust decays later.

Feed item shape:

```ts
interface CivicFeedItem {
  id: string;
  tick: number;
  source: "market" | "public" | "regulator" | "investor" | "science" | "player";
  subjectPlayerId?: string;
  targetPlayerId?: string;
  topic: "shortage" | "relief" | "luxury" | "spill" | "depletion" | "greenwash" | "blame" | "capture";
  reach: number;
  sentiment: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  policyDelta: Partial<Record<"permits" | "subsidies" | "inspection" | "priceControls" | "routeBans", number>>;
  textKey: string;
}
```

The text should be short, dry, and satirical. Examples:

- "HydroLuxe posts record relief optics."
- "Council praises emergency clarity, delays aquifer hearing."
- "Fog collectors trend as guilt-free scarcity chic."
- "Scientists confirm nothing anyone can monetize this quarter."

## Player Civic Actions

Civic actions are slow, expensive, and constrained. They are not twitch abilities.

- Sponsor Relief: spend water or credits to lower Public Thirst and gain Relief Credit.
- Lobby Permit Office: spend credits to reduce Regulatory Heat or reopen a blocked terrain.
- Commission Safety Study: delay a policy penalty, but increase scandal severity if contradicted.
- Launch Premium Campaign: raise Brand Trust and luxury demand; increase Outrage if shortages exist.
- Blame Rival: move Blame Load to another player only when their recent impact supports it.
- Open Dashboard: raise Institutional Trust by revealing selective metrics; risk later collapse when reality diverges.
- Buy Emergency Contract: secure guaranteed demand, increase Dependency and Capture.

Every civic action should create tradeoffs. None should be a clean moral or mechanical win.

## Political Feedback Effects

Policy climate should feed back into basebuilding:

- High Regulatory Heat: increases facility costs, locks dirty routes, triggers inspections.
- High Capture: grants subsidies and permit relief, but lowers Institutional Trust over time.
- High Public Thirst: raises demand and price, increases unrest if water is hoarded.
- High Outrage: raises protest risk, sabotage chance, boycotts, and Blame Load volatility.
- High Dependency: makes players richer and politically protected, but worsens collapse scoring.
- Low Institutional Trust: accelerates rumor spread and makes good-faith relief less effective.

Examples:

- Plastic Bottles can remain profitable under high Public Thirst until PINK scandals push a route ban.
- Desalination can receive subsidies during visible shortage, then trigger GREY backlash after a heatwave.
- A player with high Relief Credit can survive one scandal; a player with high Capture may dodge the fine
  but push the basin toward legitimacy collapse.

## Multiplayer Blame And Attribution

The political layer should make multiplayer sharper without requiring combat.

- Each impact contribution is attributable by player and source.
- Public attribution is imperfect until exposed by science, leaks, audits, or rival campaigns.
- Players can profit from shared collapse while trying to keep their personal Blame Load low.
- Rival attacks must be evidence-bound: a blame campaign works better when the target actually
  caused recent visible harm.
- A player can win economically while becoming the face of civilizational failure.

This creates a basebuilder version of conflict: infrastructure races, market capture,
policy manipulation, and blame routing.

## UI For Civic Dynamics

The civic layer should be visible through DOM panels:

- Civic Feed: newest story seeds, reach, actor source, and affected policy lever.
- Policy Climate Strip: compact gauges for Trust, Outrage, Dependency, Regulatory Heat, Capture.
- Player Reputation Block: Brand Trust, Blame Load, Lobby Access, Relief Credit.
- Event Attribution View: who contributed to the last threshold crossing.
- Policy Forecast Tooltip: likely next restriction or subsidy if current trends continue.

Do not represent this as a hand of cards. It is a monitoring and action surface attached
to the same run simulation.

## Integration Rule

The civic layer must never replace the basin. It should answer why certain builds,
routes, and sales are rewarded or punished. If a civic action does not change demand,
cost, route legality, facility risk, public mood, or scoring pressure, it does not belong
in the first serious implementation.

## Time Model

The vertical slice should use soft real-time ticks:

- World tick: 1 second.
- Production pulse: every 4 ticks.
- Round beat and impact consolidation: every 12 ticks.
- Player actions: intent-based, validated immediately by the server.
- Build mode: local preview, server-confirmed placement.

This gives the game motion without RTS APM pressure. Later versions can add speed controls
for solo/private rooms, but public multiplayer rooms should keep one shared cadence.

## Camera Model

The camera is an isometric basin camera with controlled pan and zoom.

- Default view: the full early base plus nearby revealed terrain.
- Zoom in: inspect facilities, flow animation, workers, and tile validity.
- Zoom out: compare basins, route lines, demand depots, and collapse pressure.
- Bounds: camera stays within generated map plus a small UI-safe margin.
- Selection: one primary selected tile or facility at a time.

The playfield should dominate the first screen. HUD surfaces frame the map but do not
turn it into a dashboard page.

## Input Action Map

| Action | Mouse / Touch | Keyboard | Notes |
| --- | --- | --- | --- |
| Select | Click/tap tile or facility | Enter on focused item | Updates inspector and highlight. |
| Pan | Drag empty map | Arrow keys / WASD | Disabled while dragging UI controls. |
| Zoom | Wheel / pinch | `+` / `-` | Clamped to readable tile scale. |
| Confirm | Click primary confirm | Enter | Sends server intent. |
| Cancel | Right click / escape / cancel button | Escape | Clears build preview or modal. |
| Build tool | Toolbar icon | Number keys | Chooses facility or route mode. |
| Rotate variant | Small icon button | R | Only for assets with orientation. |
| Inspect next | Click list row | Tab | Accessibility-sensitive; DOM owns focus. |
| Ping / mark | Alt-click tile | P | Multiplayer planning aid, not combat command. |

All physical input maps to named actions in one module. Scene code should receive actions,
not raw browser events scattered through gameplay rules.

## Simulation Boundary

Simulation state is serializable and deterministic from seed plus intent log.

Simulation owns:

- map generation
- terrain, hazards, richness, deposits, fog, and reveal state
- player resources, storage, reputation, score, and pending impact
- facilities, routes, demand state, whims, and global events
- production pulses and round beats
- validation for build, move, sell, route, upgrade, and maintenance intents
- collapse and scoring rules

Simulation does not own:

- Phaser sprites
- tweens, particles, glints, camera transforms, or selection animations
- DOM component state for open panels or focused controls
- audio playback objects

Current source alignment:

- `src/game/types.ts` defines serializable state.
- `src/game/sim.ts` owns interactive mutations.
- `src/server/server.ts` is the Colyseus authority.
- `src/client` consumes snapshots and renders them through Phaser plus DOM.

## Renderer Boundary

Phaser renders the basin only:

- isometric terrain tiles
- structures and module silhouettes
- pipes, route traces, storage pips, flow pulses
- fog-of-war edge
- selection rings, valid/invalid build previews, connection nodes
- ambient workers and maintenance animations
- weather/light glints and collapse-state overlays

React/DOM renders:

- lobby and join flow
- top resource strip
- build toolbar
- facility inspector
- market and demand panels
- route purchase controls
- environmental gauges
- log, event popovers, settings, help, and debug overlays

The bridge between them should be narrow:

- Client receives `BasinRunState` snapshots.
- DOM state chooses tool mode and selected entity.
- Phaser emits high-level selections and placement requests.
- Network code sends typed intents to the Colyseus room.

## Multiplayer Contract

The server is authoritative.

Client intents:

- `moveScout({ tileId })`
- `build({ tileId, facilityId })`
- `buyRoute({ routeId })`
- `sell({ demandId, routeId, amount })`
- future: `upgradeFacility`, `setMaintenance`, `placePipe`, `markTile`

Server responses:

- `welcome({ playerID, roomId })`
- `snapshot(BasinRunState)`
- `intentRejected({ message, intent })`
- future: `eventToast`, `chat`, `ping`

The room should preserve player slots across disconnects during a run. A reconnect should
restore the same player id when credentials are available.

## Save And Replay Boundary

The save format should be independent of Phaser and DOM.

Minimum replay package:

- game version
- seed
- max players
- player slot metadata
- ordered intent log with server tick stamps
- final state hash

The first implementation can persist only live room state in memory. The state shape should
still avoid renderer fields so file saves, replay exports, and deterministic test fixtures
remain possible.

## Debug Surfaces

Debugging should be built in early, not bolted on later.

- Toggle tile ids, terrain, richness, hazard, and reveal state.
- Toggle network intent log and rejected intents.
- Show current tick, pulse countdown, round countdown, and state hash.
- Force whim, global event, demand reset, or impact threshold in dev rooms.
- Show asset key under hovered sprite.
- Show FPS, draw count, and visible tile count.

Debug surfaces should be DOM overlays. Phaser should expose render facts, not own the debug UI.

## Performance Budget

Initial target:

- 60 FPS on a modern laptop browser for a medium basin.
- Map size target for first slice: 18 by 12 visible tiles, expandable after profiling.
- DOM panels update from snapshots without re-rendering the Phaser scene tree.
- Phaser draws from grouped containers and sprite pools.
- Flow pulses and glints are cheap tween/particle effects, not per-pixel shaders.

Avoid:

- unique painted textures per tile
- large transparent full-screen overlays
- rerendering every sprite from scratch on every snapshot
- text-heavy labels inside the canvas

## Asset Manifest Layout

Use stable manifest keys. Filenames are not public API.

```text
assets/
  environment/
    tiles/
    props/
    hazards/
  facilities/
    aquifer-well/
    greywater-loop/
    desalination-plant/
    fog-net-array/
    cloud-harvester/
    storage/
  pipes/
    elbows/
    junctions/
    valves/
    route-traces/
  ui/
    icons/
    panels/
    gauges/
    cursors/
  fx/
    flow/
    glints/
    warnings/
    fog/
  audio/
    ui/
    ambient/
    facility/
```

Example manifest keys:

- `tile.basin.dry.01`
- `tile.channel.shallow.01`
- `facility.aquifer_well.base`
- `facility.desalination.intake`
- `pipe.junction.cross.brass`
- `fx.flow.teal.pulse`
- `ui.gauge.impact.microplastic`
- `ui.icon.build.facility`

## Graphical Style Package

### One-Line Art Direction

Clean isometric infrastructure glistening with the short-sighted optimism of a corporate
oligarchy converting ecological collapse into premium growth.

### Shape Language

- Terrain: broad flat planes, clear tile boundaries, low-noise fills, soft bevels.
- Facilities: cylinders, tanks, filter beds, pump housings, fins, vents, collector frames.
- Pipes: readable elbows, junctions, valves, and manifold nodes.
- Corporate layer: enamel signs, brass plaques, tasteful warning marks, premium decals.
- Workers: tiny ambient silhouettes for scale; never selected as primary RTS units.
- Collapse: shown through gauges, blocked routes, brittle terrain shifts, warning rings,
  and visible facility consequences rather than dark grunge.

### Palette

| Role | Color | Use |
| --- | --- | --- |
| Clean ivory | `#F3EFE2` | DOM panels, enamel tanks, premium signage. |
| Pale concrete | `#D8D0BD` | Basin pads, slab tiles, facility foundations. |
| Reservoir blue | `#2D7FA3` | Water identity, top-line brand color. |
| Muted teal | `#63AFA8` | Active flow, valid placement, storage bars. |
| Corporate white | `#F8F7F1` | Tank highlights, gloss, selected UI surfaces. |
| Brass yellow | `#C6A24A` | Trim, handles, premium accents, confirm states. |
| Clay rust | `#B7684A` | Cost, wear, route friction, warm secondary accents. |
| Microplastic pink | `#D9659E` | PINK impact gauge only. |
| Carbon grey | `#6F7780` | GREY impact gauge only. |
| Depletion blue | `#5578C5` | BLUE impact gauge only. |
| Toxic green | `#67A85E` | GREEN impact gauge only. |
| Muted coral | `#C8706D` | Invalid placement, rejection, warnings. |
| Ink | `#20272B` | Primary text and outlines on light surfaces. |

The style should read light and controlled. Dark values exist for outlines and contrast,
not as the dominant atmosphere.

### Materials

- White enamel: tanks and UI surfaces, with one crisp highlight and soft bottom shading.
- Brass: valves, trim, premium edging, selected accents.
- Wet pipe metal: blue-grey body, narrow highlight, readable valve silhouettes.
- Translucent water: teal fill, light top edge, tiny pulse glint.
- Pale concrete: flat fill, subtle edge line, sparse cracks only when they carry tile meaning.
- Glass gauges: ivory base, colored fill, small shine, precise tick marks.
- Plastic signage: clean off-white signs with absurdly optimistic branding marks.

Texture is controlled. A tile should not depend on random noise to look finished.

### Tile Kit Rules

Each tile needs:

- a single base plane
- a consistent isometric footprint
- one light edge and one shade edge
- optional terrain detail from a small variant set
- a valid placement overlay state
- a selected overlay state
- a fog state

First tile set:

- dry basin floor
- shallow water channel
- aquifer pad
- fog bank
- ridge lip
- scrub plain
- ruin slab
- sinkhole
- pump foundation
- route/service path
- hazard marker
- demand depot pad

### Facility Rules

Facilities should be modular, not bespoke paintings.

Each facility asset should have:

- base footprint
- primary machine silhouette
- pipe ports
- storage indicator
- owner color accent slot
- status light slot
- small corporate sign slot
- damaged/offline variant hook

Facility silhouettes:

- Aquifer Well: vertical pump head, ring pad, narrow pipe port, modest tank.
- Greywater Loop: filter beds, circular loop pipe, clean reclamation housing.
- Desalination Plant: intake module, condenser stack, white tank row, brine outlet marker.
- Fog Net Array: collector fins/nets, lightweight frame, small condenser drums.
- Cloud Harvester: elevated mast, turbine-like collector, condensate tank, premium plaque.
- Storage Tank: enamel cylinder cluster, brass cap, visible fill band.
- Market Depot: kiosk-like premium outlet, route dock, brand canopy, demand icon.

### UI Rules

The UI should look expensive and managerial without becoming a generic SaaS dashboard.

- Use ivory panels with ink text, brass trim, and reservoir-blue active states.
- Keep panel radius at 6-8px.
- Use icons first, text second.
- Keep top resources compact.
- Keep environmental impact gauges glossy but readable.
- Put long text in DOM, never inside the Phaser playfield.
- Use event copy sparingly; the satire should land through labels and system behavior.

Required HUD surfaces:

- top resource strip: credits, water, reputation, tick/round, room id
- environmental gauge cluster: PINK, GREY, BLUE, GREEN
- left build toolbar: facilities, pipes/routes, inspect, mark
- right inspector: tile/facility state, valid actions, upgrade sockets
- bottom ticker: newest events and rejected intents
- build ghost panel: cost, output, impact, required terrain, connection status

### Readability States

| State | Visual Treatment |
| --- | --- |
| Valid build tile | muted teal overlay, small node glint |
| Invalid build tile | muted coral overlay, no harsh red flood |
| Selected facility | brass ring plus owner accent |
| Hovered tile | thin ivory edge line |
| Connected pipe | teal inner flow pulse |
| Blocked pipe | grey body with coral notch |
| Rival route | thin owner-color line, low opacity until selected |
| Fog edge | clean soft mask, not noisy smoke |
| Hazard | small controlled icon plus affected gauge pulse |

## First Vertical Slice Scope

The first playable slice should prove:

- create/join a Colyseus room
- deterministic seeded basin
- Phaser isometric map with pan, zoom, select, and build preview
- DOM lobby, HUD, toolbar, inspector, gauges, market panel, and log
- scout movement and reveal
- facility placement validation
- production pulses
- route purchase and sale
- impact consolidation and global events
- visible collapse pressure
- dev overlay with tick, tile id, and last intents

No account system, metagame, combat, large content system, or procedural art generator
belongs in the first slice.

## Implementation Order

1. Replace the stale boardgame.io client/server with Colyseus plus Phaser/DOM shell.
2. Define the network intent API and snapshot reducer.
3. Implement the Phaser basin scene from existing `BasinRunState`.
4. Build the DOM HUD in the approved light corporate style.
5. Add build placement preview and server-confirmed build intents.
6. Add route/sell controls and impact gauges.
7. Add debug overlay and deterministic state hash.
8. Only then expand content and asset polish.

## Acceptance Gates

- `npm run test` passes.
- `npm run build` passes.
- Local dev server starts with both client and Colyseus server.
- A player can create a room, move scout, build one facility, buy one route, sell water,
  and see impact gauges change.
- The playfield remains readable at desktop and narrow browser widths.
- The style stays light, modular, and procedural-friendly.
