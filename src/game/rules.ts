import { demandList, demands, facilities, globalEvents, routes, whims } from "./content";
import { generateBasin, getTile, hqStartTiles, mapSize, neighbors, revealAround } from "./map";
import type {
  BasinRunState,
  BuildPayload,
  DemandId,
  DemandState,
  ImpactProfile,
  PlayerState,
  ProducePayload,
  RouteId,
  ScoutPayload,
  SellPayload,
  SetupData,
  TrackKey,
} from "./types";

const trackKeys: TrackKey[] = ["PINK", "GREY", "BLUE", "GREEN"];

function emptyImpact(): Record<TrackKey, number> {
  return { PINK: 0, GREY: 0, BLUE: 0, GREEN: 0 };
}

function emptyPlayerCivic() {
  return { brandTrust: 4, blameLoad: 0, lobbyAccess: 2, reliefCredit: 0 };
}

function addImpact(target: Record<TrackKey, number>, impact: ImpactProfile, multiplier = 1): void {
  for (const key of trackKeys) {
    const delta = (impact[key] ?? 0) * multiplier;
    target[key] = Math.max(0, Math.min(10, target[key] + delta));
  }
}

export function setupRun(numPlayers: number, setupData?: SetupData): BasinRunState {
  const seed = setupData?.seed?.trim() || `basin-${new Date().toISOString().slice(0, 10)}`;
  const tiles = generateBasin(seed, numPlayers);
  const starts = hqStartTiles(numPlayers);
  const players: Record<string, PlayerState> = {};

  for (let index = 0; index < numPlayers; index += 1) {
    const playerID = String(index);
    const hqTileId = starts[index];
    players[playerID] = {
      id: playerID,
      name: `Baron ${index + 1}`,
      credits: 10,
      reputation: 0,
      water: 0,
      pendingImpact: emptyImpact(),
      civic: emptyPlayerCivic(),
      routes: ["plastic-bottles"],
      hqTileId,
      scoutTileId: hqTileId,
      actionsRemaining: 2,
      score: 10,
    };

    const tile = getTile(tiles, hqTileId);
    if (tile) {
      tile.structure = {
        owner: playerID,
        facilityId: "greywater-loop",
        waterStored: 0,
      };
    }
  }

  const demandState = demandList.reduce(
    (acc, demand) => {
      acc[demand.id] = { id: demand.id, demand: demand.baseDemand, price: demand.basePrice };
      return acc;
    },
    {} as Record<DemandId, DemandState>,
  );

  const state: BasinRunState = {
    seed,
    tick: 0,
    round: 1,
    roundLimit: 16,
    turnsTakenThisRound: 0,
    width: mapSize.width,
    height: mapSize.height,
    tiles,
    players,
    tracks: emptyImpact(),
    civic: {
      tracks: {
        publicThirst: 4,
        institutionalTrust: 6,
        outrage: 1,
        dependency: 2,
        regulatoryHeat: 1,
        capture: 2,
      },
      policies: {
        permitFriction: 0,
        subsidyLevel: 0,
        inspectionRisk: 1,
        priceControls: 0,
        routeLocks: [],
      },
      feed: [],
    },
    routeMarket: {
      offeredRouteIds: ["plastic-bottles", "drone-drops"],
      nextRefreshTick: 24,
      cadenceTicks: 24,
    },
    policyDocket: {
      activeForecastId: "subsidy-capture",
      generatedAtTick: 0,
      nextRefreshTick: 24,
      cadenceTicks: 24,
      choices: [],
    },
    demands: demandState,
    activeWhimId: whims[0].id,
    activeEvents: [],
    log: [`Run seed ${seed}. Basin opened.`],
  };

  applyWhim(state, whims[0].id);
  return state;
}

export function beginTurn(G: BasinRunState, playerID: string): void {
  const player = G.players[playerID];
  if (player) {
    player.actionsRemaining = 2;
  }
}

export function scoutTile(G: BasinRunState, playerID: string, payload: ScoutPayload): string | undefined {
  const player = G.players[playerID];
  const tile = getTile(G.tiles, payload.tileId);
  if (!player || !tile) return "Unknown tile.";
  if (player.actionsRemaining <= 0) return "No actions remaining.";
  if (tile.revealedBy.includes(playerID)) return "Tile already scouted.";

  const adjacentKnown = neighbors(tile, G.tiles).some(
    (neighbor) => neighbor.revealedBy.includes(playerID) || neighbor.structure?.owner === playerID,
  );
  if (!adjacentKnown) return "Scout target is not adjacent to known ground.";

  tile.revealedBy.push(playerID);
  player.actionsRemaining -= 1;
  pushLog(G, `${player.name} scouted ${tile.id} (${tile.terrain}).`);
  return undefined;
}

export function buildFacility(G: BasinRunState, playerID: string, payload: BuildPayload): string | undefined {
  const player = G.players[playerID];
  const tile = getTile(G.tiles, payload.tileId);
  const facility = facilities[payload.facilityId];
  if (!player || !tile || !facility) return "Invalid build request.";
  if (player.actionsRemaining <= 0) return "No actions remaining.";
  if (!tile.revealedBy.includes(playerID)) return "Cannot build on unrevealed ground.";
  if (tile.structure) return "Tile is already occupied.";
  if (!facility.validTerrains.includes(tile.terrain)) return `${facility.name} cannot be built on ${tile.terrain}.`;
  if (player.credits < facility.cost) return "Insufficient credits.";

  const connected = neighbors(tile, G.tiles).some((neighbor) => neighbor.structure?.owner === playerID);
  if (!connected) return "Facility must connect to your network.";

  player.credits -= facility.cost;
  player.actionsRemaining -= 1;
  tile.structure = { owner: playerID, facilityId: facility.id, waterStored: 0 };
  revealAround(G.tiles, playerID, tile.id, 1);
  pushLog(G, `${player.name} built ${facility.name} at ${tile.id}.`);
  return undefined;
}

export function produceWater(G: BasinRunState, playerID: string, payload: ProducePayload): string | undefined {
  const player = G.players[playerID];
  const tile = getTile(G.tiles, payload.tileId);
  if (!player || !tile?.structure) return "No facility on target tile.";
  if (player.actionsRemaining <= 0) return "No actions remaining.";
  if (tile.structure.owner !== playerID) return "Cannot activate a rival facility.";

  const facility = facilities[tile.structure.facilityId];
  let output = facility.output + Math.max(0, tile.richness - 2);
  if (G.activeEvents.includes("aquifer-collapse") && facility.tags.includes("WELL")) {
    output = Math.max(1, output - 1);
  }
  if (G.activeEvents.includes("heatwave-frenzy")) {
    output = Math.max(0, output - 1);
  }

  player.water += output;
  tile.structure.waterStored += output;
  addImpact(player.pendingImpact, facility.impact);
  player.actionsRemaining -= 1;
  pushLog(G, `${player.name} flowed ${output} water from ${facility.name}.`);
  return undefined;
}

export function sellWater(G: BasinRunState, playerID: string, payload: SellPayload): string | undefined {
  const player = G.players[playerID];
  const demand = G.demands[payload.demandId];
  const route = routes[payload.routeId];
  if (!player || !demand || !route) return "Invalid sale request.";
  if (player.actionsRemaining <= 0) return "No actions remaining.";
  if (!player.routes.includes(payload.routeId)) return "Route is not available.";
  if (player.water <= 0) return "No water available.";
  if (demand.demand <= 0) return "Demand segment is exhausted.";
  if (!canSellToDemand(G, payload.demandId, payload.routeId)) return "Demand segment rejects this sale.";

  const amount = Math.max(1, Math.min(payload.amount ?? player.water, player.water, demand.demand));
  player.water -= amount;
  demand.demand -= amount;
  const premium = payload.demandId === "connoisseurs" && ownsFacility(player, G, "glacial-tap") ? 1 : 0;
  const revenue = amount * (demand.price + premium);
  player.credits += revenue;
  player.score = player.credits + player.reputation;

  const impactMultiplier = Math.floor(amount / route.perCubes);
  addImpact(player.pendingImpact, route.impactPerSale, impactMultiplier);
  player.actionsRemaining -= 1;
  pushLog(G, `${player.name} sold ${amount} water to ${demands[payload.demandId].name} via ${route.name}.`);
  return undefined;
}

export function buyRoute(G: BasinRunState, playerID: string, routeId: RouteId): string | undefined {
  const player = G.players[playerID];
  const route = routes[routeId];
  if (!player || !route) return "Invalid route.";
  if (player.actionsRemaining <= 0) return "No actions remaining.";
  if (player.routes.includes(routeId)) return "Route already owned.";
  if (player.credits < route.cost) return "Insufficient credits.";
  if (routeId === "plastic-bottles" && G.activeEvents.includes("microplastic-revelation")) {
    return "Plastic routes are locked out.";
  }

  player.credits -= route.cost;
  player.routes.push(routeId);
  player.actionsRemaining -= 1;
  pushLog(G, `${player.name} bought ${route.name}.`);
  return undefined;
}

export function finishPlayerTurn(G: BasinRunState, playerID: string, numPlayers: number): void {
  const player = G.players[playerID];
  if (player) {
    player.actionsRemaining = 0;
  }

  G.turnsTakenThisRound += 1;
  if (G.turnsTakenThisRound >= numPlayers) {
    resolveRound(G);
  }
}

export function resolveRound(G: BasinRunState): void {
  pushLog(G, `Round ${G.round} closes. Impact is consolidated.`);

  for (const player of Object.values(G.players)) {
    addImpact(G.tracks, player.pendingImpact);
    player.pendingImpact = emptyImpact();
    player.water = Math.max(0, player.water - 1);
  }

  for (const whim of whims) {
    if (whim.id === G.activeWhimId) {
      addImpact(G.tracks, whim.fallout);
    }
  }

  for (const event of globalEvents) {
    if (G.tracks[event.track] >= event.threshold && !G.activeEvents.includes(event.id)) {
      G.activeEvents.push(event.id);
      pushLog(G, `GLOBAL EVENT: ${event.name}.`);
    }
  }

  G.round += 1;
  G.turnsTakenThisRound = 0;
  resetDemand(G);
  applyWhim(G, whims[(G.round - 1) % whims.length].id);

  for (const player of Object.values(G.players)) {
    player.score = player.credits + player.reputation - G.activeEvents.length;
  }
}

export function isCollapsed(G: BasinRunState): boolean {
  const maxed = trackKeys.filter((key) => G.tracks[key] >= 10).length;
  return maxed >= 3 || G.round > G.roundLimit;
}

export function winner(G: BasinRunState): string | undefined {
  return Object.values(G.players).sort((a, b) => b.score - a.score)[0]?.id;
}

function canSellToDemand(G: BasinRunState, demandId: DemandId, routeId: RouteId): boolean {
  if (demandId === "convenientists") {
    return routeId === "plastic-bottles" || routeId === "drone-drops";
  }
  if (demandId === "eco-elites") {
    return G.tracks.PINK <= 4 && G.tracks.GREY <= 5;
  }
  if (demandId === "connoisseurs") {
    return G.tracks.GREEN < 7;
  }
  if (routeId === "plastic-bottles" && G.activeEvents.includes("microplastic-revelation")) {
    return false;
  }
  return true;
}

function ownsFacility(player: PlayerState, G: BasinRunState, facilityId: string): boolean {
  return G.tiles.some((tile) => tile.structure?.owner === player.id && tile.structure.facilityId === facilityId);
}

function resetDemand(G: BasinRunState): void {
  for (const demand of demandList) {
    G.demands[demand.id] = { id: demand.id, demand: demand.baseDemand, price: demand.basePrice };
  }
}

function applyWhim(G: BasinRunState, whimId: string): void {
  const whim = whims.find((candidate) => candidate.id === whimId) ?? whims[0];
  G.activeWhimId = whim.id;
  for (const [demandId, shift] of Object.entries(whim.demandShift) as Array<[DemandId, { demand?: number; price?: number }]>) {
    const demand = G.demands[demandId];
    if (demand) {
      demand.demand += shift.demand ?? 0;
      demand.price += shift.price ?? 0;
    }
  }
  pushLog(G, `Whim active: ${whim.name}.`);
}

function pushLog(G: BasinRunState, message: string): void {
  G.log.push(message);
  if (G.log.length > 80) {
    G.log.splice(0, G.log.length - 80);
  }
}
