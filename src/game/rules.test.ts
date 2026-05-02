import { describe, expect, it } from "vitest";
import { buildFacility, produceWater, resolveRound, scoutTile, setupRun } from "./rules";

describe("Waterbarons Basin Run rules", () => {
  it("generates deterministic maps from seed", () => {
    const a = setupRun(2, { seed: "fixed-basin" });
    const b = setupRun(2, { seed: "fixed-basin" });
    expect(a.tiles.map((tile) => tile.terrain)).toEqual(b.tiles.map((tile) => tile.terrain));
    expect(a.players["0"].hqTileId).toBe("1:1");
  });

  it("requires connected revealed ground for building", () => {
    const G = setupRun(2, { seed: "build-check" });
    const playerID = "0";
    const openAquifer = G.tiles.find(
      (tile) =>
        tile.terrain === "aquifer" &&
        tile.revealedBy.includes(playerID) &&
        !tile.structure &&
        G.tiles.some((neighbor) => neighbor.structure?.owner === playerID && Math.abs(neighbor.x - tile.x) + Math.abs(neighbor.y - tile.y) === 1),
    );
    expect(openAquifer).toBeTruthy();
    const error = buildFacility(G, playerID, { tileId: openAquifer!.id, facilityId: "aquifer-well" });
    expect(error).toBeUndefined();
    expect(G.players[playerID].credits).toBe(6);
  });

  it("moves produced impact into global tracks at round resolution", () => {
    const G = setupRun(2, { seed: "impact-check" });
    const hq = G.players["0"].hqTileId;
    const error = produceWater(G, "0", { tileId: hq });
    expect(error).toBeUndefined();
    expect(G.players["0"].water).toBeGreaterThan(0);
    expect(G.players["0"].pendingImpact.GREEN).toBe(1);
    resolveRound(G);
    expect(G.tracks.GREEN).toBe(1);
  });

  it("prevents scouting disconnected fog", () => {
    const G = setupRun(2, { seed: "scout-check" });
    const far = G.tiles.find((tile) => tile.x === G.width - 1 && tile.y === 0)!;
    const error = scoutTile(G, "0", { tileId: far.id });
    expect(error).toMatch(/adjacent/);
  });
});
