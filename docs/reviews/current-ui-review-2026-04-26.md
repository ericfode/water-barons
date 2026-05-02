# Current UI Review, 2026-04-26

Context: local browser slice at `http://127.0.0.1:5173/`, reviewed after the first
PNG terrain/facility asset pack was integrated. This is a design critique of the current
prototype, not a formal usability study.

## Summary

The build is materially better than the earlier blank/vector pass. The top collapse
instruments are now in the correct place, the left rail has labels, the decision stack
gives players something to do, and the new art pack moves the map away from pure
placeholder geometry.

It is still awkward in the exact way the user called out: the UI explains systems in
panels more than it lets the player read them from the world. The map is cleaner, but
it still feels like a pale diagram with a base pinned to it. The next major improvement
should make the active objective and route/policy cadence attach to the map and network,
not just to the right rail.

## Persona Findings

### Mira Vale, First-Run Systems Reviewer

Verdict: improved but not yet self-teaching.

The Decision Stack gives a clear recommendation, but it competes with several other
valid-looking surfaces: mode panel, beat clock, selected tile, build order, and route
auction. The player can still wonder whether clicking "Stage Build" is enough or whether
they need to confirm elsewhere.

Next fix: add a single active-objective ribbon near the map centerline: "Build Greywater
Loop: click a highlighted tile, then confirm." It should update for scout, route, sale,
and policy actions.

### Cass Weller, Basebuilder Feel Reviewer

Verdict: the asset vocabulary is starting to work; the base still feels too small.

Facilities now have distinct silhouettes and terrain tiles carry clearer motifs. That
helps generated maps remain compatible with the art style. The remaining weakness is
scale and consequence: a built facility should make the basin feel more occupied, with
visible pipe flow and storage pulses. Right now the player sees one object and many
blank revealed/hidden tiles.

Next fix: add animated water-flow pulses along owned pipes, stronger facility shadows,
and a small network label only when the player selects the base.

### Leona Brandt, Corporate Satire Art Director

Verdict: closer to the intended optimism, still too plain in the DOM.

The new assets carry the right materials: white shell, teal glass, brass accents, clean
infrastructure forms. The side panels are still too generic. Waterbarons should look like
an investor demo for a catastrophic business plan: polished plaques, glossy risk gauges,
and route/policy cards that feel like corporate instruments.

Next fix: restyle route offers and policy dockets as premium contract cards, with a
small corporate seal, deadline, upside, externalized cost, and public-relations risk.

### Anton Reyes, Legibility And Accessibility Reviewer

Verdict: better shape language, but map contrast is still low.

Terrain categories now differ by symbol, not only by color. Facility silhouettes are
readable at normal zoom. The hidden basin is intentionally quiet, but it risks becoming
visual mush. Important states should not depend on subtle tile tint.

Next fix: add a compact terrain legend and a selected-tile hover card anchored near the
cursor or tile, so exact terrain/build validity is available without permanent labels.

### Sera Holt, Multiplayer Roguelike Loop Reviewer

Verdict: cadence exists, pressure does not yet feel spatial.

The beat clocks are a good foundation. Route auction timing and policy docket timing are
visible, but route selection still feels like operating a shop below the fold. The game
needs timed opportunities that land on the map: a route corridor, market beacon, protest
site, inspection zone, or rival leak.

Next fix: every route offer and policy docket should produce one visible map-attached
marker or overlay. It should make the run feel like opportunities and scandals are
arriving in the basin, not in a detached menu.

## Immediate Next Slice

1. Add an active-objective ribbon that describes the current commit path in one sentence.
2. Turn route offers into timed contract cards with explicit upside/downside.
3. Add map-attached route/policy markers so social and political cadence becomes spatial.
4. Add pipe-flow pulses and stronger facility grounding to make the base feel built.
5. Add a compact terrain/build legend only when build mode is active.
