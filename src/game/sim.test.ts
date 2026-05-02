import { describe, expect, it } from "vitest";
import { routeList } from "./content";
import {
  buyRouteInWorld,
  choosePolicyDocket,
  createInteractiveRun,
  getPolicyForecast,
  moveScout,
  sellInWorld,
  stepWorld,
  takeCivicAction,
} from "./sim";

describe("Waterbarons interactive simulation", () => {
  it("turns relief actions into civic feed and reputation pressure", () => {
    const G = createInteractiveRun({ seed: "civic-relief", maxPlayers: 2 });
    const player = G.players["0"];
    player.water = 2;
    const thirst = G.civic.tracks.publicThirst;

    const error = takeCivicAction(G, "0", { actionId: "sponsor-relief" });

    expect(error).toBeUndefined();
    expect(player.civic.reliefCredit).toBeGreaterThan(0);
    expect(G.civic.tracks.publicThirst).toBeLessThan(thirst);
    expect(G.civic.feed.at(-1)?.topic).toBe("relief");
  });

  it("lets premium campaigns reshape demand while raising brand pressure", () => {
    const G = createInteractiveRun({ seed: "premium-campaign", maxPlayers: 2 });
    const player = G.players["0"];
    const oldDemand = G.demands.connoisseurs.demand;

    const error = takeCivicAction(G, "0", { actionId: "premium-campaign" });

    expect(error).toBeUndefined();
    expect(player.civic.brandTrust).toBeGreaterThan(4);
    expect(G.demands.connoisseurs.demand).toBeGreaterThan(oldDemand);
    expect(G.civic.feed.at(-1)?.topic).toBe("luxury");
  });

  it("resolves thin blame campaigns as visible backfires", () => {
    const G = createInteractiveRun({ seed: "blame-backfire", maxPlayers: 2 });
    const player = G.players["0"];
    const trust = G.civic.tracks.institutionalTrust;

    const error = takeCivicAction(G, "0", { actionId: "blame-rival", targetPlayerId: "1" });

    expect(error).toBeUndefined();
    expect(player.credits).toBe(9);
    expect(player.civic.blameLoad).toBeGreaterThan(0);
    expect(player.civic.brandTrust).toBeLessThan(4);
    expect(G.civic.tracks.institutionalTrust).toBeLessThan(trust);
    expect(G.log.at(-1)).toContain("backfired");
  });

  it("converts visible impact into outrage and policy feed", () => {
    const G = createInteractiveRun({ seed: "impact-feed", maxPlayers: 2 });
    const player = G.players["0"];
    player.pendingImpact.PINK = 3;
    G.tick = 11;

    stepWorld(G);

    expect(G.tracks.PINK).toBeGreaterThanOrEqual(3);
    expect(G.civic.tracks.outrage).toBeGreaterThan(1);
    expect(G.civic.feed.some((item) => item.topic === "spill")).toBe(true);
  });

  it("records premium sales as market narratives", () => {
    const G = createInteractiveRun({ seed: "luxury-sale", maxPlayers: 2 });
    const player = G.players["0"];
    player.water = 2;

    const error = sellInWorld(G, "0", {
      demandId: "connoisseurs",
      routeId: "plastic-bottles",
      amount: 1,
    });

    expect(error).toBeUndefined();
    expect(player.credits).toBeGreaterThan(10);
    expect(G.civic.feed.at(-1)?.topic).toBe("luxury");
  });

  it("shows scout moves as a finite round resource", () => {
    const G = createInteractiveRun({ seed: "scout-moves", maxPlayers: 2 });
    const player = G.players["0"];

    expect(moveScout(G, "0", player.scoutTileId)).toContain("already");
    expect(player.actionsRemaining).toBe(3);

    for (let index = 0; index < 3; index += 1) {
      const current = G.tiles.find((tile) => tile.id === player.scoutTileId);
      const next = G.tiles.find((tile) => current && Math.abs(tile.x - current.x) + Math.abs(tile.y - current.y) === 1);
      expect(next).toBeDefined();
      expect(moveScout(G, "0", next!.id)).toBeUndefined();
    }

    const current = G.tiles.find((tile) => tile.id === player.scoutTileId);
    const next = G.tiles.find((tile) => current && Math.abs(tile.x - current.x) + Math.abs(tile.y - current.y) === 1);
    expect(next).toBeDefined();
    expect(moveScout(G, "0", next!.id)).toContain("no moves");
  });

  it("refreshes route offers on cadence and gates route buying to offers", () => {
    const G = createInteractiveRun({ seed: "route-auction", maxPlayers: 2 });
    const player = G.players["0"];
    player.credits = 20;

    const unavailable = routeList.find(
      (route) => !player.routes.includes(route.id) && !G.routeMarket.offeredRouteIds.includes(route.id),
    );
    expect(unavailable).toBeDefined();
    expect(buyRouteInWorld(G, "0", unavailable!.id)).toContain("not in this route auction");

    const offered = G.routeMarket.offeredRouteIds.find((routeId) => !player.routes.includes(routeId));
    expect(offered).toBeDefined();
    expect(buyRouteInWorld(G, "0", offered!)).toBeUndefined();
    expect(player.routes).toContain(offered!);

    const nextRefresh = G.routeMarket.nextRefreshTick;
    G.tick = nextRefresh - 1;
    stepWorld(G);

    expect(G.routeMarket.nextRefreshTick).toBe(nextRefresh + G.routeMarket.cadenceTicks);
  });

  it("derives policy forecasts from civic and collapse pressure", () => {
    const G = createInteractiveRun({ seed: "policy-forecast", maxPlayers: 2 });
    G.civic.tracks.publicThirst = 8;
    G.civic.tracks.outrage = 7;
    G.civic.tracks.regulatoryHeat = 6;
    G.civic.tracks.institutionalTrust = 2;
    G.tracks.PINK = 7;

    const forecasts = getPolicyForecast(G);

    expect(forecasts).toHaveLength(3);
    expect(forecasts[0].severity).toBe("high");
    expect(forecasts.map((forecast) => forecast.id)).toContain("price-controls");
    expect(forecasts.map((forecast) => forecast.id)).toContain("trust-failure");
    expect(forecasts.map((forecast) => forecast.id)).toContain("subsidy-capture");
  });

  it("turns policy pressure into a resolvable docket choice", () => {
    const G = createInteractiveRun({ seed: "policy-docket", maxPlayers: 2 });
    const player = G.players["0"];
    player.credits = 10;
    G.civic.tracks.regulatoryHeat = 8;
    G.civic.tracks.outrage = 8;
    G.policyDocket.nextRefreshTick = G.tick;

    stepWorld(G);
    expect(G.policyDocket.choices.map((choice) => choice.id)).toContain("compliance-sprint");
    const heat = G.civic.tracks.regulatoryHeat;

    const error = choosePolicyDocket(G, "0", { choiceId: "compliance-sprint" });

    expect(error).toBeUndefined();
    expect(player.credits).toBe(8);
    expect(G.civic.tracks.regulatoryHeat).toBeLessThan(heat);
    expect(G.policyDocket.resolvedChoiceId).toBe("compliance-sprint");
    expect(choosePolicyDocket(G, "0", { choiceId: "quiet-extension" })).toContain("already resolved");
  });
});
