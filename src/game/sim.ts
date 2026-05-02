import { demandList, demands, facilities, globalEvents, routeList, routes, whims } from "./content";
import { getTile, neighbors, revealAround } from "./map";
import { setupRun } from "./rules";
import type {
  BasinRunState,
  BuildPayload,
  CivicActionId,
  CivicActionPayload,
  CivicFeedItem,
  CivicTrackKey,
  DemandId,
  FacilityId,
  ImpactProfile,
  PlayerCivicKey,
  PlayerState,
  PolicyDocketChoice,
  PolicyDocketChoiceId,
  PolicyForecast,
  PolicyChoicePayload,
  RouteId,
  SellPayload,
  TrackKey,
} from "./types";

const trackKeys: TrackKey[] = ["PINK", "GREY", "BLUE", "GREEN"];
const civicTrackKeys: CivicTrackKey[] = [
  "publicThirst",
  "institutionalTrust",
  "outrage",
  "dependency",
  "regulatoryHeat",
  "capture",
];
const playerCivicKeys: PlayerCivicKey[] = ["brandTrust", "blameLoad", "lobbyAccess", "reliefCredit"];

export interface InteractiveSetup {
  seed?: string;
  maxPlayers?: number;
}

export function createInteractiveRun(options: InteractiveSetup = {}): BasinRunState {
  const G = setupRun(options.maxPlayers ?? 4, { seed: options.seed });
  for (const player of Object.values(G.players)) {
    player.name = `Baron ${Number(player.id) + 1}`;
    player.actionsRemaining = 3;
  }
  refreshRouteMarket(G);
  refreshPolicyDocket(G);
  addFeed(G, {
    source: "council",
    topic: "capture",
    reach: 2,
    sentiment: 1,
    policyDelta: { subsidies: 1 },
    text: "Council opens premium emergency water partnership.",
  });
  pushLog(G, "Interactive basin room is live.");
  return G;
}

export function setPlayerName(G: BasinRunState, playerID: string, name?: string): void {
  const player = G.players[playerID];
  if (player && name?.trim()) {
    player.name = name.trim().slice(0, 28);
  }
}

export function moveScout(G: BasinRunState, playerID: string, tileId: string): string | undefined {
  const player = G.players[playerID];
  const current = player ? getTile(G.tiles, player.scoutTileId) : undefined;
  const target = getTile(G.tiles, tileId);
  if (!player || !current || !target) return "Invalid scout move.";
  if (player.actionsRemaining <= 0) return "Scout team has no moves until the next round beat.";
  if (current.id === target.id) return "Scout is already on that tile.";

  const adjacent = Math.abs(current.x - target.x) + Math.abs(current.y - target.y) === 1;
  if (!adjacent) return "Scout can only move one tile.";

  player.scoutTileId = target.id;
  player.actionsRemaining -= 1;
  revealAround(G.tiles, playerID, target.id, 1);

  if (target.hazard > 1 && !target.revealedBy.includes(`${playerID}:hazard`)) {
    target.revealedBy.push(`${playerID}:hazard`);
    addImpact(player.pendingImpact, { GREEN: 1 });
    addCivic(G, { outrage: 1, regulatoryHeat: 1 });
    addPlayerCivic(player, { blameLoad: 1 });
    addFeed(G, {
      source: "public",
      subjectPlayerId: playerID,
      topic: "spill",
      reach: 2,
      sentiment: -2,
      policyDelta: { inspection: 1 },
      text: `${player.name} scout disturbs residue plume; cleanup confidence remains premium.`,
    });
    pushLog(G, `${player.name}'s scout disturbed residue at ${target.id}.`);
  } else {
    pushLog(G, `${player.name} moved scout to ${target.id}.`);
  }
  return undefined;
}

export function buildInWorld(G: BasinRunState, playerID: string, payload: BuildPayload): string | undefined {
  const player = G.players[playerID];
  const tile = getTile(G.tiles, payload.tileId);
  const facility = facilities[payload.facilityId];
  if (!player || !tile || !facility) return "Invalid build request.";
  if (!tile.revealedBy.includes(playerID)) return "Cannot build on unrevealed ground.";
  if (tile.structure) return "Tile is occupied.";
  if (!facility.validTerrains.includes(tile.terrain)) return `${facility.name} cannot be built on ${tile.terrain}.`;

  const cost = effectiveFacilityCost(G, facility.cost);
  if (player.credits < cost) return `Insufficient credits. ${facility.name} costs ${cost} CC under current policy.`;

  const connected = neighbors(tile, G.tiles).some((neighbor) => neighbor.structure?.owner === playerID);
  if (!connected) return "Facility must connect to your network.";

  player.credits -= cost;
  tile.structure = { owner: playerID, facilityId: payload.facilityId, waterStored: 0 };
  revealAround(G.tiles, playerID, tile.id, 1);

  if (facility.tags.includes("HIGH_ENERGY") || facility.tags.includes("GROUNDWATER")) {
    addCivic(G, { dependency: 1, capture: G.civic.policies.subsidyLevel > 0 ? 1 : 0 });
  }

  pushLog(G, `${player.name} built ${facility.name} at ${tile.id}.`);
  return undefined;
}

export function buyRouteInWorld(G: BasinRunState, playerID: string, routeId: RouteId): string | undefined {
  const player = G.players[playerID];
  const route = routes[routeId];
  if (!player || !route) return "Invalid route.";
  if (player.routes.includes(routeId)) return "Route already owned.";
  if (!G.routeMarket.offeredRouteIds.includes(routeId)) {
    return `${route.name} is not in this route auction. New offers arrive in ${ticksUntilRouteRefresh(G)} ticks.`;
  }
  if (isRouteLocked(G, routeId)) return `${route.name} is locked by current policy.`;
  if (player.credits < route.cost) return "Insufficient credits.";

  player.credits -= route.cost;
  player.routes.push(routeId);
  pushLog(G, `${player.name} bought ${route.name}.`);
  return undefined;
}

export function sellInWorld(G: BasinRunState, playerID: string, payload: SellPayload): string | undefined {
  const player = G.players[playerID];
  const demand = G.demands[payload.demandId];
  const route = routes[payload.routeId];
  if (!player || !demand || !route) return "Invalid sale.";
  if (!player.routes.includes(payload.routeId)) return "Route is not available.";
  if (isRouteLocked(G, payload.routeId)) return `${route.name} is locked by current policy.`;
  if (player.water <= 0) return "No water available.";
  if (demand.demand <= 0) return "Demand exhausted.";
  if (!canSellToDemand(G, payload.demandId, payload.routeId)) return "Demand rejects this route.";

  const amount = Math.max(1, Math.min(payload.amount ?? player.water, player.water, demand.demand));
  player.water -= amount;
  demand.demand -= amount;

  const priceControlPenalty = G.civic.policies.priceControls > 0 && payload.demandId !== "frugalists" ? 1 : 0;
  const price = Math.max(1, demand.price - priceControlPenalty);
  player.credits += amount * price;
  player.score = player.credits + player.reputation + player.civic.brandTrust - player.civic.blameLoad - G.activeEvents.length;

  const impactMultiplier = Math.floor(amount / route.perCubes);
  addImpact(player.pendingImpact, route.impactPerSale, impactMultiplier);
  recordSaleNarrative(G, player, payload.demandId, payload.routeId, amount);
  pushLog(G, `${player.name} sold ${amount} water to ${demands[payload.demandId].name}.`);
  return undefined;
}

export function takeCivicAction(G: BasinRunState, playerID: string, payload: CivicActionPayload): string | undefined {
  const player = G.players[playerID];
  if (!player) return "Unknown player.";

  const action = payload.actionId;
  if (action === "sponsor-relief") return sponsorRelief(G, player);
  if (action === "lobby-permit-office") return lobbyPermitOffice(G, player);
  if (action === "premium-campaign") return launchPremiumCampaign(G, player);
  if (action === "blame-rival") return blameRival(G, player, payload.targetPlayerId);
  return "Unknown civic action.";
}

export function choosePolicyDocket(G: BasinRunState, playerID: string, payload: PolicyChoicePayload): string | undefined {
  const player = G.players[playerID];
  if (!player) return "Unknown player.";
  if (G.policyDocket.resolvedChoiceId) return "Policy docket already resolved.";

  const choice = G.policyDocket.choices.find((candidate) => candidate.id === payload.choiceId);
  if (!choice) return "Policy choice is not on the current docket.";

  if (payload.choiceId === "compliance-sprint") {
    if (player.credits < 2) return "Compliance sprint needs 2 CredCoin.";
    player.credits -= 2;
    addCivic(G, { regulatoryHeat: -2, institutionalTrust: 1 });
    addPlayerCivic(player, { blameLoad: -1 });
    addFeed(G, {
      source: "regulator",
      subjectPlayerId: player.id,
      topic: "capture",
      reach: 2,
      sentiment: 1,
      policyDelta: { permits: -2, inspection: -1 },
      text: `${player.name} funds a compliance sprint; inspectors discover a friendlier checklist.`,
    });
  } else if (payload.choiceId === "relief-contract") {
    if (player.water >= 2) {
      player.water -= 2;
    } else if (player.credits >= 2) {
      player.credits -= 2;
    } else {
      return "Relief contract needs 2 water or 2 CredCoin.";
    }
    addCivic(G, { publicThirst: -2, institutionalTrust: 1, outrage: -1 });
    addPlayerCivic(player, { reliefCredit: 1, brandTrust: 1, blameLoad: -1 });
    addFeed(G, {
      source: "public",
      subjectPlayerId: player.id,
      topic: "relief",
      reach: 4,
      sentiment: 2,
      policyDelta: { priceControls: -1 },
      text: `${player.name} accepts a televised relief contract; the anger graph briefly loses shape.`,
    });
  } else if (payload.choiceId === "quiet-extension") {
    if (player.credits < 1) return "Quiet extension needs 1 CredCoin.";
    player.credits -= 1;
    addCivic(G, { regulatoryHeat: -1, capture: 2, institutionalTrust: -1 });
    addPlayerCivic(player, { lobbyAccess: 1, brandTrust: -1 });
    addFeed(G, {
      source: "council",
      subjectPlayerId: player.id,
      topic: "capture",
      reach: 2,
      sentiment: -1,
      policyDelta: { permits: -1, subsidies: 1 },
      text: `${player.name} obtains a quiet extension; the paperwork improves while trust decays.`,
    });
  }

  G.policyDocket.resolvedChoiceId = payload.choiceId;
  G.policyDocket.resolvedByPlayerId = playerID;
  refreshPolicies(G);
  refreshScores(G);
  pushLog(G, `${player.name} resolved policy docket: ${choice.title}.`);
  return undefined;
}

export function stepWorld(G: BasinRunState): void {
  if (isRunOver(G)) return;

  G.tick += 1;

  if (G.tick % 4 === 0) {
    for (const tile of G.tiles) {
      if (!tile.structure) continue;
      const player = G.players[tile.structure.owner];
      const facility = facilities[tile.structure.facilityId];
      if (!player || !facility) continue;

      let produced = Math.max(1, Math.ceil((facility.output + Math.max(0, tile.richness - 2)) / 2));
      if (G.activeEvents.includes("aquifer-collapse") && facility.tags.includes("WELL")) {
        produced = Math.max(1, produced - 1);
      }
      if (G.activeEvents.includes("heatwave-frenzy")) {
        produced = Math.max(0, produced - 1);
      }

      player.water += produced;
      tile.structure.waterStored += produced;
      addImpact(player.pendingImpact, facility.impact);
    }
    pushLog(G, "Facilities pulsed water into storage.");
  }

  if (G.tick % 12 === 0) {
    consolidateImpact(G);
    resolveCivicPressure(G);
    G.round += 1;
    resetDemand(G);
    applyWhim(G, whims[(G.round - 1) % whims.length].id);
    applyCivicDemandPressure(G);
    for (const player of Object.values(G.players)) {
      player.actionsRemaining = 3;
    }
    refreshScores(G);
  }

  if (G.tick >= G.routeMarket.nextRefreshTick) {
    refreshRouteMarket(G);
  }

  if (G.tick >= G.policyDocket.nextRefreshTick) {
    refreshPolicyDocket(G);
  }
}

export function isRunOver(G: BasinRunState): boolean {
  const maxed = trackKeys.filter((key) => G.tracks[key] >= 10).length;
  return maxed >= 3 || G.round > G.roundLimit || G.civic.tracks.institutionalTrust <= 0;
}

export function getPolicyForecast(G: BasinRunState): PolicyForecast[] {
  const pressure: PolicyForecast[] = [
    {
      id: "permit-surge",
      label: "Permit Surge",
      progress: Math.max(G.civic.tracks.regulatoryHeat, Math.ceil((G.civic.tracks.regulatoryHeat + G.civic.tracks.outrage) / 2)),
      trigger: "Regulatory Heat and Outrage",
      likelyEffect: "facility costs rise and inspections intensify",
      playerHandle: "lobby, relief, or lower visible waste before the next round beat",
      severity: "low",
    },
    {
      id: "plastic-ban",
      label: "Plastic Ban",
      progress: Math.max(G.tracks.PINK, G.civic.tracks.regulatoryHeat - 1),
      trigger: "Microplastics scandal pressure",
      likelyEffect: "Plastic Bottles route locks out",
      playerHandle: "shift sales away from plastic or reduce microplastic impact",
      severity: "low",
    },
    {
      id: "price-controls",
      label: "Price Controls",
      progress: Math.min(10, Math.ceil((G.civic.tracks.publicThirst + G.civic.tracks.outrage) / 2)),
      trigger: "Public Thirst plus Outrage",
      likelyEffect: "premium demand prices compress",
      playerHandle: "sponsor relief or satisfy frugal demand before outrage crests",
      severity: "low",
    },
    {
      id: "subsidy-capture",
      label: "Subsidy Capture",
      progress: Math.max(G.civic.tracks.publicThirst, G.civic.tracks.capture),
      trigger: "Public Thirst and captured council attention",
      likelyEffect: "facility costs fall but dependency rises",
      playerHandle: "use subsidies for infrastructure, then manage dependency optics",
      severity: "low",
    },
    {
      id: "trust-failure",
      label: "Trust Failure",
      progress: 10 - G.civic.tracks.institutionalTrust,
      trigger: "Institutional Trust erosion",
      likelyEffect: "the run can end if trust reaches zero",
      playerHandle: "relief and clean operations are the only durable repair",
      severity: "low",
    },
  ];

  return pressure
    .map((item) => ({
      ...item,
      progress: clamp(item.progress),
      severity: forecastSeverity(item.progress),
    }))
    .sort((left, right) => right.progress - left.progress)
    .slice(0, 3);
}

function consolidateImpact(G: BasinRunState): void {
  for (const player of Object.values(G.players)) {
    const pending = { ...player.pendingImpact };
    addImpact(G.tracks, pending);
    processImpactNarrative(G, player, pending);
    player.pendingImpact = { PINK: 0, GREY: 0, BLUE: 0, GREEN: 0 };
  }

  for (const event of globalEvents) {
    if (G.tracks[event.track] >= event.threshold && !G.activeEvents.includes(event.id)) {
      G.activeEvents.push(event.id);
      if (event.id === "microplastic-revelation" && !G.civic.policies.routeLocks.includes("plastic-bottles")) {
        G.civic.policies.routeLocks.push("plastic-bottles");
      }
      addCivic(G, { outrage: 1, regulatoryHeat: 1, institutionalTrust: -1 });
      addFeed(G, {
        source: "science",
        topic: event.track === "BLUE" ? "depletion" : "spill",
        reach: 4,
        sentiment: -3,
        policyDelta: { inspection: 2, routeBans: event.id === "microplastic-revelation" ? 2 : 0 },
        text: `Scientific panel confirms ${event.name}; markets request calmer phrasing.`,
      });
      pushLog(G, `GLOBAL EVENT: ${event.name}.`);
    }
  }
}

function processImpactNarrative(G: BasinRunState, player: PlayerState, impact: Record<TrackKey, number>): void {
  const visibleWaste = impact.PINK + impact.GREEN;
  const depletion = impact.BLUE;
  const carbon = impact.GREY;

  if (visibleWaste > 0) {
    addCivic(G, { outrage: visibleWaste, regulatoryHeat: 1, institutionalTrust: -1 });
    addPlayerCivic(player, { blameLoad: visibleWaste, brandTrust: -1 });
    addFeed(G, {
      source: "public",
      subjectPlayerId: player.id,
      topic: "spill",
      reach: Math.min(5, visibleWaste + 1),
      sentiment: -2,
      policyDelta: { inspection: 1, routeBans: impact.PINK > 0 ? 1 : 0 },
      text: `${player.name} waste footage trends beside premium purity campaign.`,
    });
  }

  if (depletion > 0) {
    addCivic(G, { dependency: 1, regulatoryHeat: depletion >= 2 ? 1 : 0 });
    addPlayerCivic(player, { blameLoad: depletion >= 2 ? 1 : 0 });
    addFeed(G, {
      source: "science",
      subjectPlayerId: player.id,
      topic: "depletion",
      reach: Math.min(4, depletion + 1),
      sentiment: -1,
      policyDelta: { permits: -1, inspection: 1 },
      text: `${player.name} aquifer drawdown is described as a temporary abundance event.`,
    });
  }

  if (carbon > 1) {
    addCivic(G, { regulatoryHeat: 1, outrage: G.civic.tracks.publicThirst < 5 ? 1 : 0 });
    addPlayerCivic(player, { blameLoad: 1 });
  }
}

function resolveCivicPressure(G: BasinRunState): void {
  const unmetDemand = Object.values(G.demands).reduce((total, demand) => total + Math.max(0, demand.demand), 0);
  if (unmetDemand >= 6) {
    addCivic(G, { publicThirst: 2, outrage: 1, dependency: 1 });
    addFeed(G, {
      source: "public",
      topic: "shortage",
      reach: 3,
      sentiment: -2,
      policyDelta: { priceControls: 1 },
      text: "Shortage clips outperform official optimism package.",
    });
  } else if (unmetDemand <= 2) {
    addCivic(G, { publicThirst: -1, institutionalTrust: 1, dependency: 1 });
  }

  if (G.civic.tracks.capture >= 7) {
    addCivic(G, { institutionalTrust: -1 });
  }
  if (G.civic.tracks.outrage >= 7) {
    addCivic(G, { regulatoryHeat: 1, institutionalTrust: -1 });
  }

  refreshPolicies(G);
}

function recordSaleNarrative(
  G: BasinRunState,
  player: PlayerState,
  demandId: DemandId,
  routeId: RouteId,
  amount: number,
): void {
  addCivic(G, { publicThirst: -Math.ceil(amount / 3), dependency: 1 });

  if (demandId === "connoisseurs" || demandId === "eco-elites") {
    addPlayerCivic(player, { brandTrust: 1 });
    addCivic(G, { outrage: G.civic.tracks.publicThirst >= 7 ? 1 : 0 });
    addFeed(G, {
      source: "market",
      subjectPlayerId: player.id,
      topic: "luxury",
      reach: 3,
      sentiment: 2,
      policyDelta: { subsidies: 1 },
      text: `${player.name} premium scarcity line sells out before relief queue opens.`,
    });
  }

  if (routeId === "plastic-bottles" && amount >= 2) {
    addCivic(G, { outrage: 1, regulatoryHeat: 1 });
  }
}

function sponsorRelief(G: BasinRunState, player: PlayerState): string | undefined {
  if (player.water < 2 && player.credits < 2) return "Relief sponsorship needs 2 water or 2 credits.";
  if (player.water >= 2) player.water -= 2;
  else player.credits -= 2;

  addCivic(G, { publicThirst: -2, institutionalTrust: 1, outrage: -1 });
  addPlayerCivic(player, { reliefCredit: 2, brandTrust: 1, blameLoad: -1 });
  addFeed(G, {
    source: "public",
    subjectPlayerId: player.id,
    topic: "relief",
    reach: 3,
    sentiment: 2,
    policyDelta: { priceControls: -1 },
    text: `${player.name} funds emergency relief depot; cameras find the good angle.`,
  });
  pushLog(G, `${player.name} sponsored relief.`);
  return undefined;
}

function lobbyPermitOffice(G: BasinRunState, player: PlayerState): string | undefined {
  if (player.credits < 3) return "Lobbying needs 3 CredCoin.";
  player.credits -= 3;
  addCivic(G, { regulatoryHeat: -2, capture: 2, institutionalTrust: -1 });
  addPlayerCivic(player, { lobbyAccess: 1, blameLoad: -1 });
  addFeed(G, {
    source: "council",
    subjectPlayerId: player.id,
    topic: "capture",
    reach: 2,
    sentiment: 1,
    policyDelta: { permits: 2, inspection: -1 },
    text: `${player.name} clarifies compliance roadmap over catered hearings.`,
  });
  refreshPolicies(G);
  pushLog(G, `${player.name} lobbied the permit office.`);
  return undefined;
}

function launchPremiumCampaign(G: BasinRunState, player: PlayerState): string | undefined {
  if (player.credits < 2) return "Premium campaign needs 2 CredCoin.";
  player.credits -= 2;
  addPlayerCivic(player, { brandTrust: 2 });
  addCivic(G, { publicThirst: 1, outrage: G.civic.tracks.publicThirst >= 6 ? 1 : 0 });
  G.demands.connoisseurs.demand += 2;
  G.demands.connoisseurs.price += 1;
  addFeed(G, {
    source: "market",
    subjectPlayerId: player.id,
    topic: "luxury",
    reach: 4,
    sentiment: 2,
    policyDelta: { subsidies: 1 },
    text: `${player.name} makes scarcity aspirational with a tasteful enamel bottle.`,
  });
  pushLog(G, `${player.name} launched a premium campaign.`);
  return undefined;
}

function blameRival(G: BasinRunState, player: PlayerState, targetPlayerId?: string): string | undefined {
  const target = targetPlayerId ? G.players[targetPlayerId] : undefined;
  if (!target || target.id === player.id) return "Choose a rival target.";
  if (player.credits < 1) return "Blame campaign needs 1 CredCoin.";

  const evidence = sumImpact(target.pendingImpact) + target.civic.blameLoad;
  player.credits -= 1;
  if (evidence <= 0) {
    addPlayerCivic(player, { blameLoad: 1, brandTrust: -1 });
    addCivic(G, { institutionalTrust: -1 });
    addFeed(G, {
      source: "public",
      subjectPlayerId: player.id,
      targetPlayerId: target.id,
      topic: "blame",
      reach: 2,
      sentiment: -1,
      policyDelta: { inspection: 1 },
      text: `${player.name} blame package collapses under basic attribution.`,
    });
    pushLog(G, `${player.name}'s blame campaign backfired against ${target.name}.`);
    return undefined;
  }

  addPlayerCivic(player, { blameLoad: -1 });
  addPlayerCivic(target, { blameLoad: 2, brandTrust: -1 });
  addCivic(G, { outrage: 1, institutionalTrust: -1 });
  addFeed(G, {
    source: "player",
    subjectPlayerId: player.id,
    targetPlayerId: target.id,
    topic: "blame",
    reach: 3,
    sentiment: -2,
    policyDelta: { inspection: 1 },
    text: `${player.name} redirects basin anger toward ${target.name}'s visible externalities.`,
  });
  pushLog(G, `${player.name} blamed ${target.name}.`);
  return undefined;
}

function applyCivicDemandPressure(G: BasinRunState): void {
  const thirst = G.civic.tracks.publicThirst;
  if (thirst >= 7) {
    G.demands.frugalists.demand += 2;
    G.demands.frugalists.price += 1;
    G.demands.convenientists.demand += 1;
  }
  if (G.civic.tracks.institutionalTrust <= 3) {
    G.demands["eco-elites"].demand = Math.max(0, G.demands["eco-elites"].demand - 1);
  }
  if (G.civic.tracks.capture >= 6) {
    G.demands.connoisseurs.price += 1;
  }
  if (G.civic.policies.priceControls > 0) {
    for (const demand of Object.values(G.demands)) {
      demand.price = Math.max(1, demand.price - 1);
    }
  }
}

function refreshPolicies(G: BasinRunState): void {
  const regulatoryHeat = G.civic.tracks.regulatoryHeat;
  const capture = G.civic.tracks.capture;
  const publicThirst = G.civic.tracks.publicThirst;
  const outrage = G.civic.tracks.outrage;
  const locks = new Set<RouteId>(G.civic.policies.routeLocks);

  if (regulatoryHeat >= 8 || G.activeEvents.includes("microplastic-revelation")) {
    locks.add("plastic-bottles");
  } else if (!G.activeEvents.includes("microplastic-revelation")) {
    locks.delete("plastic-bottles");
  }

  G.civic.policies = {
    permitFriction: regulatoryHeat >= 7 ? 2 : regulatoryHeat >= 5 ? 1 : 0,
    subsidyLevel: publicThirst >= 7 || capture >= 6 ? 1 : 0,
    inspectionRisk: Math.min(10, Math.ceil((regulatoryHeat + outrage) / 2)),
    priceControls: publicThirst >= 8 && outrage >= 5 ? 1 : 0,
    routeLocks: [...locks],
  };
}

function refreshRouteMarket(G: BasinRunState): void {
  const available = routeList.filter((route) => !G.civic.policies.routeLocks.includes(route.id));
  const count = Math.min(2, available.length);
  const start = Math.abs(hashString(`${G.seed}:${G.round}:${G.tick}`)) % Math.max(1, available.length);
  const offered = new Set<RouteId>();
  for (let offset = 0; offset < available.length && offered.size < count; offset += 1) {
    offered.add(available[(start + offset) % available.length].id);
  }
  if (offered.size === 0) {
    offered.add("smart-pipe-network");
  }
  G.routeMarket.offeredRouteIds = [...offered];
  G.routeMarket.nextRefreshTick = G.tick + G.routeMarket.cadenceTicks;
  pushLog(G, `Route auction refreshed: ${G.routeMarket.offeredRouteIds.map((id) => routes[id].name).join(", ")}.`);
}

function refreshPolicyDocket(G: BasinRunState): void {
  const forecast = getPolicyForecast(G)[0];
  G.policyDocket = {
    activeForecastId: forecast.id,
    generatedAtTick: G.tick,
    nextRefreshTick: G.tick + G.policyDocket.cadenceTicks,
    cadenceTicks: G.policyDocket.cadenceTicks,
    choices: policyDocketChoicesFor(forecast.id),
  };
  pushLog(G, `Policy docket opened: ${forecast.label}.`);
}

function policyDocketChoicesFor(forecastId: string): PolicyDocketChoice[] {
  const compliance: PolicyDocketChoice = {
    id: "compliance-sprint",
    title: forecastId === "permit-surge" ? "Compliance Sprint" : "Friendly Checklist",
    description: "Spend capital on visible process improvements before regulators harden.",
    cost: "2 CC",
    effect: "-2 Regulatory Heat, +1 Trust, -1 Blame",
  };
  const relief: PolicyDocketChoice = {
    id: "relief-contract",
    title: forecastId === "price-controls" || forecastId === "trust-failure" ? "Relief Contract" : "Public Water Drop",
    description: "Trade water or money for a public-facing relief obligation.",
    cost: "2 water or 2 CC",
    effect: "-2 Public Thirst, -1 Outrage, +1 Trust",
  };
  const extension: PolicyDocketChoice = {
    id: "quiet-extension",
    title: forecastId === "subsidy-capture" ? "Quiet Subsidy Extension" : "Quiet Extension",
    description: "Use access to slow enforcement while the public notices the machinery.",
    cost: "1 CC",
    effect: "-1 Regulatory Heat, +2 Capture, -1 Trust",
  };

  if (forecastId === "trust-failure") return [relief, compliance, extension];
  if (forecastId === "price-controls") return [relief, extension, compliance];
  if (forecastId === "subsidy-capture") return [extension, compliance, relief];
  return [compliance, relief, extension];
}

function ticksUntilRouteRefresh(G: BasinRunState): number {
  return Math.max(0, G.routeMarket.nextRefreshTick - G.tick);
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

function isRouteLocked(G: BasinRunState, routeId: RouteId): boolean {
  return G.civic.policies.routeLocks.includes(routeId);
}

function effectiveFacilityCost(G: BasinRunState, baseCost: number): number {
  return Math.max(1, baseCost + G.civic.policies.permitFriction - G.civic.policies.subsidyLevel);
}

function resetDemand(G: BasinRunState): void {
  for (const demand of demandList) {
    G.demands[demand.id] = { id: demand.id, demand: demand.baseDemand, price: demand.basePrice };
  }
}

function applyWhim(G: BasinRunState, whimId: string): void {
  const whim = whims.find((candidate) => candidate.id === whimId) ?? whims[0];
  G.activeWhimId = whim.id;
  for (const [rawDemandId, shift] of Object.entries(whim.demandShift)) {
    const demandId = rawDemandId as DemandId;
    const demand = G.demands[demandId];
    if (demand) {
      demand.demand += shift?.demand ?? 0;
      demand.price += shift?.price ?? 0;
    }
  }
  pushLog(G, `Whim active: ${whim.name}.`);
}

function addImpact(target: Record<TrackKey, number>, impact: ImpactProfile, multiplier = 1): void {
  for (const key of trackKeys) {
    const delta = (impact[key] ?? 0) * multiplier;
    target[key] = clamp(target[key] + delta);
  }
}

function addCivic(G: BasinRunState, delta: Partial<Record<CivicTrackKey, number>>): void {
  for (const key of civicTrackKeys) {
    const value = delta[key] ?? 0;
    if (value !== 0) G.civic.tracks[key] = clamp(G.civic.tracks[key] + value);
  }
}

function addPlayerCivic(player: PlayerState, delta: Partial<Record<PlayerCivicKey, number>>): void {
  for (const key of playerCivicKeys) {
    const value = delta[key] ?? 0;
    if (value !== 0) player.civic[key] = clamp(player.civic[key] + value);
  }
}

function addFeed(
  G: BasinRunState,
  item: Omit<CivicFeedItem, "id" | "tick"> & { tick?: number },
): void {
  const next: CivicFeedItem = {
    id: `feed-${G.tick}-${G.civic.feed.length}-${item.topic}`,
    tick: item.tick ?? G.tick,
    ...item,
  };
  G.civic.feed.push(next);
  if (G.civic.feed.length > 36) {
    G.civic.feed.splice(0, G.civic.feed.length - 36);
  }
}

function sumImpact(impact: Record<TrackKey, number>): number {
  return trackKeys.reduce((total, key) => total + impact[key], 0);
}

function refreshScores(G: BasinRunState): void {
  for (const player of Object.values(G.players)) {
    player.score =
      player.credits +
      player.reputation +
      player.civic.brandTrust +
      player.civic.reliefCredit -
      player.civic.blameLoad -
      G.activeEvents.length;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function forecastSeverity(value: number): PolicyForecast["severity"] {
  if (value >= 8) return "high";
  if (value >= 5) return "medium";
  return "low";
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function pushLog(G: BasinRunState, message: string): void {
  G.log.push(message);
  if (G.log.length > 80) {
    G.log.splice(0, G.log.length - 80);
  }
}
