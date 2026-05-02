import type {
  DemandDefinition,
  DemandId,
  FacilityDefinition,
  FacilityId,
  GlobalEventDefinition,
  RouteDefinition,
  RouteId,
  TrackKey,
  WhimDefinition,
} from "./types";

export const trackLabels: Record<TrackKey, { label: string; short: string; color: string }> = {
  PINK: { label: "Microplastics", short: "uP", color: "#d4478f" },
  GREY: { label: "Carbon", short: "CO2e", color: "#5f6673" },
  BLUE: { label: "Depletion", short: "DEP", color: "#2563a8" },
  GREEN: { label: "Residue", short: "TOX", color: "#2b8a5e" },
};

export const facilities: Record<FacilityId, FacilityDefinition> = {
  "glacial-tap": {
    id: "glacial-tap",
    name: "Glacial Tap",
    cost: 5,
    output: 3,
    description: "Ancient ice extraction with a public-relations sheen.",
    impact: { GREY: 1, PINK: 1 },
    tags: ["ARCTIC", "LIMITED"],
    validTerrains: ["ridge"],
  },
  "greywater-loop": {
    id: "greywater-loop",
    name: "Greywater Loop",
    cost: 3,
    output: 2,
    description: "Reclaims urban wastewater and offsets microplastics.",
    impact: { GREEN: 1 },
    tags: ["RECYCLING"],
    validTerrains: ["ruins", "scrub", "sink"],
  },
  "aquifer-well": {
    id: "aquifer-well",
    name: "Aquifer Well",
    cost: 4,
    output: 4,
    description: "Fast groundwater extraction from stressed deposits.",
    impact: { BLUE: 2 },
    tags: ["GROUNDWATER", "WELL"],
    validTerrains: ["aquifer"],
  },
  "desalination-plant": {
    id: "desalination-plant",
    name: "Desalination Plant",
    cost: 7,
    output: 5,
    description: "Heavy coastal infrastructure with a carbon tail.",
    impact: { GREY: 2, GREEN: 1 },
    tags: ["COASTAL", "HIGH_ENERGY"],
    validTerrains: ["coast"],
  },
  "cloud-harvester": {
    id: "cloud-harvester",
    name: "Cloud Harvester",
    cost: 6,
    output: 2,
    description: "Atmospheric capture array for dry interiors.",
    impact: { GREY: 1 },
    tags: ["ATMOSPHERIC"],
    validTerrains: ["ridge", "fog"],
  },
  "fog-net-array": {
    id: "fog-net-array",
    name: "Fog Net Array",
    cost: 3,
    output: 1,
    description: "Passive mesh harvesting near damp coastlines.",
    impact: {},
    tags: ["PASSIVE", "COASTAL"],
    validTerrains: ["fog", "coast"],
  },
};

export const routes: Record<RouteId, RouteDefinition> = {
  "plastic-bottles": {
    id: "plastic-bottles",
    name: "Plastic Bottles",
    cost: 1,
    description: "Cheap retail distribution.",
    impactPerSale: { PINK: 1 },
    perCubes: 2,
    tags: ["PLASTIC", "CONVENIENCE"],
  },
  "drone-drops": {
    id: "drone-drops",
    name: "Drone Drops",
    cost: 3,
    description: "Fast premium delivery.",
    impactPerSale: { GREY: 1 },
    perCubes: 1,
    tags: ["DRONE", "CONVENIENCE"],
  },
  "smart-pipe-network": {
    id: "smart-pipe-network",
    name: "Smart-Pipe Network",
    cost: 5,
    description: "Efficient fixed distribution.",
    impactPerSale: {},
    perCubes: 1,
    tags: ["PIPE", "EFFICIENT"],
  },
  "aluminum-cans": {
    id: "aluminum-cans",
    name: "Aluminum Cans",
    cost: 2,
    description: "Recyclable but energy-hungry packaging.",
    impactPerSale: { GREY: 1 },
    perCubes: 3,
    tags: ["PACKAGE"],
  },
};

export const demands: Record<DemandId, DemandDefinition> = {
  frugalists: {
    id: "frugalists",
    name: "Frugalists",
    baseDemand: 4,
    basePrice: 1,
    values: "Cheapest litre wins",
  },
  convenientists: {
    id: "convenientists",
    name: "Convenientists",
    baseDemand: 3,
    basePrice: 2,
    values: "Plastic or drone routes",
  },
  "eco-elites": {
    id: "eco-elites",
    name: "Eco-Elites",
    baseDemand: 2,
    basePrice: 3,
    values: "Low impact basin",
  },
  connoisseurs: {
    id: "connoisseurs",
    name: "Connoisseurs",
    baseDemand: 1,
    basePrice: 4,
    values: "No toxic basin",
  },
};

export const whims: WhimDefinition[] = [
  {
    id: "glitterwave-fashion",
    name: "Glitterwave Fashion",
    trigger: "uP under 5",
    demandShift: { connoisseurs: { demand: 2 } },
    fallout: { PINK: 2 },
  },
  {
    id: "doomscroll-detox",
    name: "Doomscroll Detox",
    trigger: "CO2e at 6+",
    demandShift: { frugalists: { price: 1 } },
    fallout: { GREY: -1 },
  },
  {
    id: "heatwave-hysteria",
    name: "Heatwave Hysteria",
    trigger: "CO2e at 7+",
    demandShift: {
      frugalists: { demand: 1 },
      convenientists: { demand: 1 },
      "eco-elites": { demand: 1 },
      connoisseurs: { demand: 1 },
    },
    fallout: { GREY: 1 },
  },
  {
    id: "sustainable-sipping",
    name: "Sustainable Sipping",
    trigger: "DEP under 4",
    demandShift: { "eco-elites": { price: 1 } },
    fallout: {},
  },
];

export const globalEvents: GlobalEventDefinition[] = [
  {
    id: "aquifer-collapse",
    name: "Aquifer Collapse",
    track: "BLUE",
    threshold: 8,
    effect: "Wells lose one output.",
  },
  {
    id: "heatwave-frenzy",
    name: "Heatwave Frenzy",
    track: "GREY",
    threshold: 9,
    effect: "All production loses one output.",
  },
  {
    id: "microplastic-revelation",
    name: "Microplastic Revelation",
    track: "PINK",
    threshold: 8,
    effect: "Plastic bottle sales are locked out.",
  },
  {
    id: "mass-recall",
    name: "Mass Recall",
    track: "GREEN",
    threshold: 10,
    effect: "Unsold water is discarded immediately.",
  },
];

export const facilityList = Object.values(facilities);
export const routeList = Object.values(routes);
export const demandList = Object.values(demands);
