export type TrackKey = "PINK" | "GREY" | "BLUE" | "GREEN";

export type Terrain =
  | "coast"
  | "aquifer"
  | "fog"
  | "ridge"
  | "scrub"
  | "ruins"
  | "sink";

export type FacilityId =
  | "glacial-tap"
  | "greywater-loop"
  | "aquifer-well"
  | "desalination-plant"
  | "cloud-harvester"
  | "fog-net-array";

export type RouteId =
  | "plastic-bottles"
  | "drone-drops"
  | "smart-pipe-network"
  | "aluminum-cans";

export type DemandId = "frugalists" | "convenientists" | "eco-elites" | "connoisseurs";

export type CivicTrackKey =
  | "publicThirst"
  | "institutionalTrust"
  | "outrage"
  | "dependency"
  | "regulatoryHeat"
  | "capture";

export type PlayerCivicKey = "brandTrust" | "blameLoad" | "lobbyAccess" | "reliefCredit";

export type CivicActor =
  | "market"
  | "public"
  | "regulator"
  | "investor"
  | "science"
  | "council"
  | "player";

export type CivicTopic =
  | "shortage"
  | "relief"
  | "luxury"
  | "spill"
  | "depletion"
  | "greenwash"
  | "blame"
  | "capture";

export type CivicActionId = "sponsor-relief" | "lobby-permit-office" | "premium-campaign" | "blame-rival";

export interface ImpactProfile {
  PINK?: number;
  GREY?: number;
  BLUE?: number;
  GREEN?: number;
}

export interface FacilityDefinition {
  id: FacilityId;
  name: string;
  cost: number;
  output: number;
  description: string;
  impact: ImpactProfile;
  tags: string[];
  validTerrains: Terrain[];
}

export interface RouteDefinition {
  id: RouteId;
  name: string;
  cost: number;
  description: string;
  impactPerSale: ImpactProfile;
  perCubes: number;
  tags: string[];
}

export interface DemandDefinition {
  id: DemandId;
  name: string;
  baseDemand: number;
  basePrice: number;
  values: string;
}

export interface WhimDefinition {
  id: string;
  name: string;
  trigger: string;
  demandShift: Partial<Record<DemandId, { demand?: number; price?: number }>>;
  fallout: ImpactProfile;
}

export interface GlobalEventDefinition {
  id: string;
  name: string;
  track: TrackKey;
  threshold: number;
  effect: string;
}

export interface CivicFeedItem {
  id: string;
  tick: number;
  source: CivicActor;
  subjectPlayerId?: string;
  targetPlayerId?: string;
  topic: CivicTopic;
  reach: number;
  sentiment: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  policyDelta: Partial<Record<"permits" | "subsidies" | "inspection" | "priceControls" | "routeBans", number>>;
  text: string;
}

export interface CivicPolicyState {
  permitFriction: number;
  subsidyLevel: number;
  inspectionRisk: number;
  priceControls: number;
  routeLocks: RouteId[];
}

export interface CivicState {
  tracks: Record<CivicTrackKey, number>;
  policies: CivicPolicyState;
  feed: CivicFeedItem[];
}

export interface RouteMarketState {
  offeredRouteIds: RouteId[];
  nextRefreshTick: number;
  cadenceTicks: number;
}

export type PolicyForecastSeverity = "low" | "medium" | "high";

export interface PolicyForecast {
  id: string;
  label: string;
  severity: PolicyForecastSeverity;
  progress: number;
  trigger: string;
  likelyEffect: string;
  playerHandle: string;
}

export type PolicyDocketChoiceId = "compliance-sprint" | "relief-contract" | "quiet-extension";

export interface PolicyDocketChoice {
  id: PolicyDocketChoiceId;
  title: string;
  description: string;
  cost: string;
  effect: string;
}

export interface PolicyDocketState {
  activeForecastId: string;
  generatedAtTick: number;
  nextRefreshTick: number;
  cadenceTicks: number;
  choices: PolicyDocketChoice[];
  resolvedChoiceId?: PolicyDocketChoiceId;
  resolvedByPlayerId?: string;
}

export interface TileStructure {
  owner: string;
  facilityId: FacilityId;
  waterStored: number;
}

export interface BasinTile {
  id: string;
  x: number;
  y: number;
  terrain: Terrain;
  revealedBy: string[];
  structure?: TileStructure;
  hazard: number;
  richness: number;
}

export interface PlayerState {
  id: string;
  name: string;
  credits: number;
  reputation: number;
  water: number;
  pendingImpact: Record<TrackKey, number>;
  civic: Record<PlayerCivicKey, number>;
  routes: RouteId[];
  hqTileId: string;
  scoutTileId: string;
  actionsRemaining: number;
  score: number;
}

export interface DemandState {
  id: DemandId;
  demand: number;
  price: number;
}

export interface BasinRunState {
  seed: string;
  tick: number;
  round: number;
  roundLimit: number;
  turnsTakenThisRound: number;
  width: number;
  height: number;
  tiles: BasinTile[];
  players: Record<string, PlayerState>;
  tracks: Record<TrackKey, number>;
  civic: CivicState;
  routeMarket: RouteMarketState;
  policyDocket: PolicyDocketState;
  demands: Record<DemandId, DemandState>;
  activeWhimId: string;
  activeEvents: string[];
  log: string[];
}

export interface SetupData {
  seed?: string;
}

export interface BuildPayload {
  tileId: string;
  facilityId: FacilityId;
}

export interface ProducePayload {
  tileId: string;
}

export interface ScoutPayload {
  tileId: string;
}

export interface SellPayload {
  demandId: DemandId;
  routeId: RouteId;
  amount?: number;
}

export interface CivicActionPayload {
  actionId: CivicActionId;
  targetPlayerId?: string;
}

export interface PolicyChoicePayload {
  choiceId: PolicyDocketChoiceId;
}
