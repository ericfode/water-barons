import * as Phaser from "phaser";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Client as ColyseusClient, Room as ColyseusRoom } from "colyseus.js";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Factory,
  Gauge,
  HandCoins,
  Info,
  ListChecks,
  Megaphone,
  Pipette,
  RadioTower,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { BasinScene, type BasinSceneCallbacks, type ToolMode } from "./BasinScene";
import { demands, facilities, facilityList, routes, trackLabels, whims } from "../game/content";
import { getPolicyForecast } from "../game/sim";
import type {
  BasinRunState,
  BasinTile,
  CivicActionId,
  CivicTrackKey,
  DemandId,
  FacilityId,
  ImpactProfile,
  PolicyDocketChoiceId,
  PlayerState,
  PolicyForecast,
  RouteId,
  TrackKey,
} from "../game/types";
import "./styles.css";

type BasinRoom = ColyseusRoom<BasinRunState>;
type ClientSeatReservation = Parameters<ColyseusClient["consumeSeatReservation"]>[0];

const trackKeys: TrackKey[] = ["PINK", "GREY", "BLUE", "GREEN"];
const civicTrackLabels: Record<CivicTrackKey, string> = {
  publicThirst: "Public Thirst",
  institutionalTrust: "Trust",
  outrage: "Outrage",
  dependency: "Dependency",
  regulatoryHeat: "Regulatory Heat",
  capture: "Capture",
};

type PreviewTone = "positive" | "negative" | "warning" | "neutral";

interface EffectLine {
  label: string;
  value: string;
  tone?: PreviewTone;
}

interface BuildPreviewState {
  canBuild: boolean;
  reason: string;
  cost: number;
  production: number;
  effects: EffectLine[];
}

interface ScoutMovePreview {
  canMove: boolean;
  reason: string;
  effects: EffectLine[];
}

interface BuildCandidate {
  tile: BasinTile;
  facilityId: FacilityId;
  cost: number;
  production: number;
  score: number;
}

interface SaleCandidate {
  routeId: RouteId;
  demandId: DemandId;
  amount: number;
  revenue: number;
  score: number;
}

interface SalePreview {
  canSell: boolean;
  reason: string;
  amount: number;
  revenue: number;
  effects: EffectLine[];
}

interface BuyPreview {
  canBuy: boolean;
  reason: string;
  effects: EffectLine[];
}

interface DecisionItem {
  id: string;
  title: string;
  status: string;
  effects: string[];
  tone: PreviewTone;
  actionLabel?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

interface StagedMapTarget {
  kind: "build" | "scout" | "sale" | "route" | "policy";
  tileId?: string;
  label: string;
}

interface CivicActionPreview {
  id: CivicActionId;
  title: string;
  cost: string;
  status: string;
  canUse: boolean;
  tone: PreviewTone;
  effects: EffectLine[];
}

const serverURL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname || "127.0.0.1"}:8000`;
const matchmakeURL = serverURL.replace(/^ws/, "http");

interface SeatReservationWire {
  name?: string;
  roomId?: string;
  processId?: string;
  sessionId: string;
  protocol?: string;
  reconnectionToken?: string;
  room?: {
    name: string;
    roomId: string;
    processId?: string;
  };
  error?: string;
  code?: number;
}

async function reserveRoom(
  client: ColyseusClient,
  method: "create" | "joinById",
  target: string,
  options: Record<string, unknown>,
): Promise<BasinRoom> {
  const response = await fetch(`${matchmakeURL}/matchmake/${method}/${target}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });
  const data = (await response.json()) as SeatReservationWire;
  if (!response.ok || data.error) {
    throw new Error(data.error ?? `Matchmaking failed with ${response.status}`);
  }
  const normalized = (data.room
    ? data
    : {
        ...data,
        room: {
          name: data.name ?? "basin",
          roomId: data.roomId ?? target,
          clients: 0,
          maxClients: 4,
          processId: data.processId,
        },
      }) as ClientSeatReservation;
  return client.consumeSeatReservation<BasinRunState>(normalized);
}

function App() {
  const [room, setRoom] = useState<BasinRoom | undefined>();
  const [snapshot, setSnapshot] = useState<BasinRunState | undefined>();
  const [playerID, setPlayerID] = useState<string | undefined>();
  const [status, setStatus] = useState("Disconnected");
  const [lastError, setLastError] = useState<string | undefined>();

  useEffect(() => {
    return () => {
      room?.leave(true).catch(() => undefined);
    };
  }, [room]);

  async function connect(create: boolean, options: { seed: string; maxPlayers: number; roomId?: string; playerName: string }) {
    setStatus("Connecting");
    setLastError(undefined);
    const client = new ColyseusClient(serverURL);
    const joined = create
      ? await reserveRoom(client, "create", "basin", options)
      : await reserveRoom(client, "joinById", options.roomId ?? "", { playerName: options.playerName });

    joined.onMessage("welcome", (message: { playerID?: string }) => {
      if (message.playerID) setPlayerID(message.playerID);
    });
    joined.onMessage("snapshot", (next: BasinRunState) => {
      setSnapshot(next);
      setStatus("Live");
    });
    joined.onMessage("intentRejected", (message: { message?: string }) => {
      setLastError(message.message ?? "Intent rejected.");
      window.setTimeout(() => setLastError(undefined), 4200);
    });
    joined.onLeave(() => {
      setStatus("Disconnected");
      setRoom(undefined);
      setSnapshot(undefined);
      setPlayerID(undefined);
    });

    setRoom(joined);
    joined.send("ready");
  }

  if (!room || !snapshot || !playerID) {
    return <Lobby status={status} lastError={lastError} onConnect={connect} />;
  }

  return (
    <GameView
      room={room}
      snapshot={snapshot}
      playerID={playerID}
      status={status}
      lastError={lastError}
      onLeave={() => room.leave(true)}
    />
  );
}

function Lobby({
  status,
  lastError,
  onConnect,
}: {
  status: string;
  lastError?: string;
  onConnect: (create: boolean, options: { seed: string; maxPlayers: number; roomId?: string; playerName: string }) => Promise<void>;
}) {
  const [playerName, setPlayerName] = useState("HydroLuxe");
  const [seed, setSeed] = useState(`basin-${Math.floor(Date.now() / 1000).toString(36)}`);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(create: boolean) {
    try {
      setBusy(true);
      await onConnect(create, { seed, maxPlayers, roomId: roomId.trim(), playerName: playerName.trim() || "Water Baron" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lobby-shell">
      <section className="lobby-card">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Droplets size={30} />
          </div>
          <div>
            <h1>Waterbarons</h1>
            <p>Premium basin operations for the managed end.</p>
          </div>
        </div>

        <div className="lobby-fields">
          <label>
            Operator brand
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
          </label>
          <label>
            Basin seed
            <input value={seed} onChange={(event) => setSeed(event.target.value)} />
          </label>
          <label>
            Seats
            <input
              type="number"
              min={1}
              max={4}
              value={maxPlayers}
              onChange={(event) => setMaxPlayers(Math.max(1, Math.min(4, Number(event.target.value))))}
            />
          </label>
        </div>

        <button className="primary-action" disabled={busy} onClick={() => run(true)}>
          <RadioTower size={17} />
          Create Basin
        </button>

        <div className="join-grid">
          <label>
            Room ID
            <input value={roomId} onChange={(event) => setRoomId(event.target.value)} />
          </label>
          <button disabled={busy || !roomId.trim()} onClick={() => run(false)}>
            <Users size={17} />
            Join
          </button>
        </div>

        <div className="status-line">
          <span>{status}</span>
          <span>{serverURL}</span>
        </div>
        {lastError ? <div className="error-box">{lastError}</div> : null}
      </section>
    </main>
  );
}

function GameView({
  room,
  snapshot,
  playerID,
  status,
  lastError,
  onLeave,
}: {
  room: BasinRoom;
  snapshot: BasinRunState;
  playerID: string;
  status: string;
  lastError?: string;
  onLeave: () => void;
}) {
  const viewSnapshot: BasinRunState = {
    ...snapshot,
    routeMarket: snapshot.routeMarket ?? {
      offeredRouteIds: ["drone-drops", "smart-pipe-network"],
      nextRefreshTick: snapshot.tick + 24,
      cadenceTicks: 24,
    },
    policyDocket: snapshot.policyDocket ?? {
      activeForecastId: "subsidy-capture",
      generatedAtTick: snapshot.tick,
      nextRefreshTick: snapshot.tick + 24,
      cadenceTicks: 24,
      choices: [],
    },
  };
  const player = viewSnapshot.players[playerID];
  const [tool, setTool] = useState<ToolMode>("inspect");
  const [facilityId, setFacilityId] = useState<FacilityId>("aquifer-well");
  const [selectedTileId, setSelectedTileId] = useState(player?.hqTileId ?? viewSnapshot.tiles[0]?.id);
  const [routeId, setRouteId] = useState<RouteId>("plastic-bottles");
  const [demandId, setDemandId] = useState<DemandId>("frugalists");
  const [amount, setAmount] = useState(1);
  const [civicTarget, setCivicTarget] = useState<string>(() => firstRivalId(viewSnapshot, playerID) ?? playerID);
  const [stagedTarget, setStagedTarget] = useState<StagedMapTarget | undefined>();
  const routePanelRef = useRef<HTMLElement>(null);
  const civicPanelRef = useRef<HTMLElement>(null);
  const routeHighlightTimerRef = useRef<number | undefined>(undefined);
  const [spotlitPanel, setSpotlitPanel] = useState<"routes" | "civic" | undefined>();

  const focusRoutesPanel = useCallback((nextRouteId?: RouteId, label?: string) => {
    setTool("contracts");
    if (nextRouteId) setRouteId(nextRouteId);
    setStagedTarget({ kind: "route", label: label ?? (nextRouteId ? routes[nextRouteId].name : "Route Auction") });
    setSpotlitPanel("routes");
    if (routeHighlightTimerRef.current !== undefined) window.clearTimeout(routeHighlightTimerRef.current);
    routeHighlightTimerRef.current = window.setTimeout(() => setSpotlitPanel(undefined), 1800);
    window.requestAnimationFrame(() => {
      routePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const focusCivicPanel = useCallback((label?: string) => {
    setTool("politics");
    setStagedTarget({ kind: "policy", label: label ?? "Policy Docket" });
    setSpotlitPanel("civic");
    if (routeHighlightTimerRef.current !== undefined) window.clearTimeout(routeHighlightTimerRef.current);
    routeHighlightTimerRef.current = window.setTimeout(() => setSpotlitPanel(undefined), 1800);
    window.requestAnimationFrame(() => {
      civicPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  useEffect(() => {
    if (!viewSnapshot.tiles.some((tile) => tile.id === selectedTileId)) {
      setSelectedTileId(viewSnapshot.players[playerID]?.hqTileId ?? viewSnapshot.tiles[0]?.id);
    }
  }, [playerID, selectedTileId, viewSnapshot]);

  useEffect(() => {
    return () => {
      if (routeHighlightTimerRef.current !== undefined) window.clearTimeout(routeHighlightTimerRef.current);
    };
  }, []);

  const selectedTile = useMemo(
    () => viewSnapshot.tiles.find((tile) => tile.id === selectedTileId),
    [selectedTileId, viewSnapshot.tiles],
  );
  const routeOptions = useMemo(() => {
    const ids = new Set<RouteId>([...(player?.routes ?? []), ...viewSnapshot.routeMarket.offeredRouteIds]);
    return [...ids];
  }, [player?.routes, viewSnapshot.routeMarket.offeredRouteIds]);
  const activeWhim = whims.find((whim) => whim.id === viewSnapshot.activeWhimId);
  const selectedBuildPreview = useMemo(
    () => getBuildPreviewState(viewSnapshot, player, selectedTile, facilityId),
    [facilityId, player, selectedTile, viewSnapshot],
  );
  const selectedScoutPreview = useMemo(() => getScoutMovePreview(viewSnapshot, player, selectedTile), [player, selectedTile, viewSnapshot]);
  const bestBuild = useMemo(() => findBestBuildCandidate(viewSnapshot, player), [player, viewSnapshot]);
  const bestSale = useMemo(() => findBestSaleCandidate(viewSnapshot, player), [player, viewSnapshot]);
  const bestOffer = useMemo(() => findBestRouteOffer(viewSnapshot, player), [player, viewSnapshot]);
  const selectedSalePreview = useMemo(
    () => getSalePreview(viewSnapshot, player, routeId, demandId, amount),
    [amount, demandId, player, routeId, viewSnapshot],
  );
  const selectedBuyPreview = useMemo(() => getBuyPreview(viewSnapshot, player, routeId), [player, routeId, viewSnapshot]);
  const nextActions = useMemo<DecisionItem[]>(() => {
    const items: DecisionItem[] = [];
    const scoutMoves = player?.actionsRemaining ?? 0;
    const scoutItem: DecisionItem = {
      id: "scout",
      title: "Reveal buildable ground",
      status: scoutMoves > 0 ? `${scoutMoves} scout moves ready` : "Scout team is spent until the next round beat",
      effects: ["Reveals adjacent terrain", "Finds valid connected facility sites", "Can expose hazards before capital is committed"],
      tone: scoutMoves > 0 ? "positive" : "neutral",
        actionLabel: "Scout",
        disabled: scoutMoves <= 0,
        onSelect: () => {
          setTool("scout");
          setStagedTarget({ kind: "scout", tileId: player?.scoutTileId, label: "Scout reach" });
          if (player?.scoutTileId) setSelectedTileId(player.scoutTileId);
        },
      };

    if (bestSale) {
      items.push({
        id: "sell",
        title: `Sell to ${demands[bestSale.demandId].name}`,
        status: `${bestSale.amount} water through ${routes[bestSale.routeId].name}`,
        effects: [
          `+${bestSale.revenue} CC`,
          summarizeImpact(saleImpactFor(bestSale.routeId, bestSale.amount), "No route impact at this amount"),
        ],
        tone: "positive",
        actionLabel: "Open Sale",
        onSelect: () => {
          setRouteId(bestSale.routeId);
          setDemandId(bestSale.demandId);
          setAmount(bestSale.amount);
          focusRoutesPanel(bestSale.routeId, `Sell to ${demands[bestSale.demandId].name}`);
        },
      });
    }

    if (bestBuild) {
      const facility = facilities[bestBuild.facilityId];
      items.push({
        id: "build",
        title: `Build ${facility.name}`,
        status: `${bestBuild.cost} CC at ${bestBuild.tile.id}`,
        effects: [
          `Adds about ${bestBuild.production} water on each production pulse`,
          summarizeImpact(facility.impact, "No collapse load"),
          "Expands the network and reveals nearby ground",
        ],
        tone: player && player.credits >= bestBuild.cost ? "positive" : "warning",
        actionLabel: "Stage Build",
        disabled: !player || player.credits < bestBuild.cost,
        onSelect: () => {
          setTool("build");
          setFacilityId(bestBuild.facilityId);
          setSelectedTileId(bestBuild.tile.id);
          setStagedTarget({ kind: "build", tileId: bestBuild.tile.id, label: `Build ${facility.name}` });
        },
      });
    } else {
      items.push(scoutItem);
      if (player) {
        items.push({
          id: "build-blocked",
          title: "No clean build order",
          status: "No affordable valid connected site is visible",
          effects: ["Scout first or change facility type", "Builds require revealed matching terrain adjacent to your network"],
          tone: "warning",
          actionLabel: "Scout",
          disabled: scoutMoves <= 0,
          onSelect: () => {
            setTool("scout");
            setStagedTarget({ kind: "scout", tileId: player.scoutTileId, label: "Scout reach" });
          },
        });
      }
    }

    if (bestBuild && !bestSale) items.push(scoutItem);

    if (!bestSale && bestOffer) {
      items.push({
        id: "buy-route",
        title: `Buy ${routes[bestOffer].name}`,
        status: `${routes[bestOffer].cost} CC offer, ${Math.max(0, viewSnapshot.routeMarket.nextRefreshTick - viewSnapshot.tick)} ticks left`,
        effects: ["Unlocks a sell path for stored water", summarizeImpact(routes[bestOffer].impactPerSale, "No route impact")],
        tone: "positive",
        actionLabel: "Open Offer",
        onSelect: () => {
          focusRoutesPanel(bestOffer, `Buy ${routes[bestOffer].name}`);
        },
      });
    } else if (!bestSale) {
      items.push({
        id: "route-blocked",
        title: "No profitable sale staged",
        status: selectedSalePreview.reason,
        effects: ["Produce water, buy a live route offer, or wait for the auction cadence"],
        tone: "neutral",
        actionLabel: "Open Routes",
        onSelect: () => focusRoutesPanel(),
      });
    }

    const docket = viewSnapshot.policyDocket;
    if (!docket.resolvedChoiceId && docket.choices.length > 0) {
      const forecast = getPolicyForecast(viewSnapshot).find((item) => item.id === docket.activeForecastId);
      items.push({
        id: "policy",
        title: "Resolve policy docket",
        status: forecast ? forecast.label : "Council agenda",
        effects: [
          `Expires in ${Math.max(0, docket.nextRefreshTick - viewSnapshot.tick)} ticks`,
          "Each choice changes civic tracks before the next policy shift",
        ],
        tone: forecast?.severity === "high" ? "warning" : "neutral",
        actionLabel: "Review Docket",
        onSelect: () => {
          setStagedTarget({ kind: "policy", label: forecast ? forecast.label : "Council agenda" });
          focusCivicPanel(forecast ? forecast.label : "Council agenda");
        },
      });
    }

    return items.sort((left, right) => Number(Boolean(left.disabled)) - Number(Boolean(right.disabled))).slice(0, 4);
  }, [bestBuild, bestOffer, bestSale, focusCivicPanel, focusRoutesPanel, player, selectedSalePreview.reason, viewSnapshot]);

  useEffect(() => {
    if (!routeOptions.includes(routeId)) {
      setRouteId(routeOptions[0] ?? "plastic-bottles");
    }
  }, [routeId, routeOptions]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTool("inspect");
        setStagedTarget(undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function send(type: string, payload?: unknown) {
    room.send(type, payload);
  }

  const handleTileSelected = useCallback(
    (tileId: string) => {
      setSelectedTileId(tileId);
      if (tool === "build") {
        setStagedTarget({ kind: "build", tileId, label: `Build ${facilities[facilityId].name}` });
      } else if (tool === "scout") {
        setStagedTarget({ kind: "scout", tileId, label: "Scout target" });
      } else if (tool === "contracts" || tool === "politics") {
        setStagedTarget(undefined);
      }
    },
    [facilityId, tool],
  );

  const clearStagedAction = useCallback(() => {
    setStagedTarget(undefined);
    setTool("inspect");
  }, []);

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-compact">
          <Droplets />
          <div>
            <strong>Waterbarons</strong>
            <span>Room {room.roomId}</span>
          </div>
        </div>
        <div className="resource-strip">
          <ResourceChip icon={<Banknote size={15} />} label="CredCoin" value={player?.credits ?? 0} />
          <ResourceChip icon={<Droplets size={15} />} label="Water" value={player?.water ?? 0} />
          <ResourceChip icon={<Search size={15} />} label="Scout Moves" value={`${player?.actionsRemaining ?? 0}/3`} />
          <ResourceChip icon={<Sparkles size={15} />} label="Brand" value={player?.civic.brandTrust ?? 0} />
          <ResourceChip icon={<ShieldAlert size={15} />} label="Blame" value={player?.civic.blameLoad ?? 0} />
          <ResourceChip icon={<Gauge size={15} />} label="Score" value={player?.score ?? 0} />
        </div>
        <CollapseStrip snapshot={viewSnapshot} />
        <div className="run-strip">
          <span>Round {viewSnapshot.round}/{viewSnapshot.roundLimit}</span>
          <span>Tick {viewSnapshot.tick}</span>
          <span>{status}</span>
          <button onClick={onLeave}>Leave</button>
        </div>
      </header>

      <section className="play-layout">
        <aside className="tool-rail">
          <div className="rail-caption">Mode</div>
          <IconTool active={tool === "inspect"} label="Inspect" onClick={() => setTool("inspect")}>
            <Target size={17} />
            <span>Inspect</span>
          </IconTool>
          <IconTool active={tool === "scout"} label="Scout" onClick={() => setTool("scout")}>
            <Search size={17} />
            <span>Scout</span>
          </IconTool>
          <IconTool active={tool === "build"} label="Build" onClick={() => setTool("build")}>
            <Factory size={17} />
            <span>Build</span>
          </IconTool>
          <IconTool active={tool === "contracts"} label="Contracts" onClick={() => focusRoutesPanel(undefined, "Route Contracts")}>
            <HandCoins size={17} />
            <span>Contracts</span>
          </IconTool>
          <IconTool active={tool === "politics"} label="Politics" onClick={() => focusCivicPanel("Policy Docket")}>
            <Megaphone size={17} />
            <span>Politics</span>
          </IconTool>
        </aside>

        <section className="playfield-wrap">
          <ModePanel snapshot={viewSnapshot} player={player} tool={tool} facilityId={facilityId} selectedTile={selectedTile} />
          <BeatClockPanel snapshot={viewSnapshot} stagedTarget={stagedTarget} />
          {tool === "build" ? (
            <BuildPalette
              snapshot={viewSnapshot}
              player={player}
              selectedTile={selectedTile}
              hasStagedTarget={stagedTarget?.kind === "build"}
              facilityId={facilityId}
              onSelect={(nextFacilityId) => {
                setFacilityId(nextFacilityId);
                setTool("build");
                if (stagedTarget?.kind === "build" && selectedTile) {
                  setStagedTarget({ kind: "build", tileId: selectedTile.id, label: `Build ${facilities[nextFacilityId].name}` });
                }
              }}
            />
          ) : null}
          <BasinCanvas
            snapshot={viewSnapshot}
            playerID={playerID}
            tool={tool}
            facilityId={facilityId}
            selectedTileId={selectedTileId}
            stagedTarget={stagedTarget}
            onTileSelected={handleTileSelected}
            onScout={(tileId) => send("moveScout", { tileId })}
            onBuild={(tileId, nextFacilityId) => send("build", { tileId, facilityId: nextFacilityId })}
          />
          {tool === "build" && stagedTarget?.kind === "build" && selectedTile ? (
            <ContextActionDock
              eyebrow={selectedBuildPreview.canBuild ? "Valid build site" : "Build blocked"}
              title={`Build ${facilities[facilityId].name}`}
              meta={`${selectedBuildPreview.cost} CC at ${selectedTile.id}`}
              detail={selectedBuildPreview.canBuild ? `+${selectedBuildPreview.production} water every production pulse` : selectedBuildPreview.reason}
              actionLabel={selectedBuildPreview.canBuild ? "Build" : "Cannot Build"}
              disabled={!selectedBuildPreview.canBuild}
              onConfirm={() => {
                send("build", { tileId: selectedTile.id, facilityId });
                setStagedTarget(undefined);
              }}
              onCancel={clearStagedAction}
            />
          ) : tool === "scout" && stagedTarget?.kind === "scout" && selectedTile ? (
            <ContextActionDock
              eyebrow={selectedScoutPreview.canMove ? "Scout movement" : "Scout blocked"}
              title={selectedScoutPreview.canMove ? `Move scout to ${selectedTile.id}` : selectedScoutPreview.reason}
              meta={`${player?.actionsRemaining ?? 0}/3 moves`}
              detail={selectedScoutPreview.effects.map((effect) => `${effect.label}: ${effect.value}`).join(" / ")}
              actionLabel={selectedScoutPreview.canMove ? "Move Scout" : "Cannot Move"}
              disabled={!selectedScoutPreview.canMove}
              onConfirm={() => {
                send("moveScout", { tileId: selectedTile.id });
                setStagedTarget(undefined);
              }}
              onCancel={clearStagedAction}
            />
          ) : null}
          <div className="bottom-ticker">
            <span>{activeWhim ? `Whim: ${activeWhim.name}` : "Whim: none"}</span>
            <span>{viewSnapshot.log.at(-1) ?? "Basin opened."}</span>
          </div>
          {lastError ? <div className="toast-error">{lastError}</div> : null}
        </section>

        <aside className={`right-panel command-drawer mode-${tool}`}>
          <DecisionStack items={nextActions} />

          {tool === "inspect" ? <TileInspector tile={selectedTile} playerID={playerID} /> : null}
          {tool === "scout" ? (
            <ScoutPreviewPanel player={player} selectedTile={selectedTile} preview={selectedScoutPreview} staged={stagedTarget?.kind === "scout"} />
          ) : null}
          {tool === "build" ? (
            <section className="panel-section build-order active">
              <div className="section-title">
                <Factory size={15} />
                <h2>Build Preview</h2>
              </div>
              <BuildPreview snapshot={viewSnapshot} player={player} tile={selectedTile} facilityId={facilityId} preview={selectedBuildPreview} />
            </section>
          ) : null}
          {tool === "contracts" ? (
            <MarketPanel
              snapshot={viewSnapshot}
              player={player}
              routeOptions={routeOptions}
              routeId={routeId}
              demandId={demandId}
              amount={amount}
              setRouteId={setRouteId}
              setDemandId={setDemandId}
              setAmount={setAmount}
              onBuyRoute={() => send("buyRoute", { routeId })}
              onSell={() => send("sell", { routeId, demandId, amount })}
              salePreview={selectedSalePreview}
              buyPreview={selectedBuyPreview}
              panelRef={routePanelRef}
              highlight={spotlitPanel === "routes"}
            />
          ) : null}
          {tool === "politics" ? (
            <CivicPanel
              panelRef={civicPanelRef}
              highlight={spotlitPanel === "civic"}
              snapshot={viewSnapshot}
              playerID={playerID}
              civicTarget={civicTarget}
              setCivicTarget={setCivicTarget}
              onAction={(actionId, targetPlayerId) => send("civicAction", { actionId, targetPlayerId })}
              onPolicyChoice={(choiceId) => send("policyChoice", { choiceId })}
            />
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function BasinCanvas({
  snapshot,
  playerID,
  tool,
  facilityId,
  selectedTileId,
  stagedTarget,
  onTileSelected,
  onScout,
  onBuild,
}: {
  snapshot: BasinRunState;
  playerID: string;
  tool: ToolMode;
  facilityId: FacilityId;
  selectedTileId?: string;
  stagedTarget?: StagedMapTarget;
  onTileSelected: (tileId: string) => void;
  onScout: (tileId: string) => void;
  onBuild: (tileId: string, facilityId: FacilityId) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BasinScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const callbacks = useMemo<BasinSceneCallbacks>(
    () => ({ onTileSelected, onScout, onBuild }),
    [onBuild, onScout, onTileSelected],
  );

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const scene = new BasinScene();
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: hostRef.current.clientWidth,
      height: hostRef.current.clientHeight,
      backgroundColor: "#e7e0cf",
      scene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
    });

    const resize = () => {
      if (hostRef.current && gameRef.current) {
        gameRef.current.scale.resize(hostRef.current.clientWidth, hostRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setPlayerID(playerID);
  }, [playerID]);

  useEffect(() => {
    sceneRef.current?.setCallbacks(callbacks);
  }, [callbacks]);

  useEffect(() => {
    sceneRef.current?.setSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    sceneRef.current?.setToolState({ mode: tool, facilityId, selectedTileId, stagedTileId: stagedTarget?.tileId, stagedAction: stagedTarget?.kind });
  }, [facilityId, selectedTileId, stagedTarget, tool]);

  return <div ref={hostRef} className="basin-canvas" />;
}

function ResourceChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="resource-chip">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IconTool({
  active,
  label,
  children,
  onClick,
}: {
  active: boolean;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={`icon-tool${active ? " active" : ""}`} title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function FacilityGlyph({ facilityId }: { facilityId: FacilityId }) {
  if (facilityId === "fog-net-array") return <RadioTower size={18} />;
  if (facilityId === "cloud-harvester") return <Sparkles size={18} />;
  if (facilityId === "desalination-plant") return <Factory size={18} />;
  if (facilityId === "aquifer-well") return <Pipette size={18} />;
  if (facilityId === "glacial-tap") return <Droplets size={18} />;
  return <Building2 size={18} />;
}

function CollapseStrip({ snapshot }: { snapshot: BasinRunState }) {
  return (
    <div className="collapse-strip" aria-label="Collapse instruments">
      {trackKeys.map((key) => (
        <div className="collapse-pill" key={key}>
          <div>
            <span>{trackLabels[key].label}</span>
            <strong>{snapshot.tracks[key]}/10</strong>
          </div>
          <div className="mini-gauge">
            <i style={{ width: `${Math.max(0, Math.min(10, snapshot.tracks[key])) * 10}%`, backgroundColor: trackLabels[key].color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BeatClockPanel({ snapshot, stagedTarget }: { snapshot: BasinRunState; stagedTarget?: StagedMapTarget }) {
  const clocks = [
    { label: "Production", value: `${ticksUntilModulo(snapshot.tick, 4)} ticks` },
    { label: "Round Beat", value: `${ticksUntilModulo(snapshot.tick, 12)} ticks` },
    { label: "Route Auction", value: `${Math.max(0, snapshot.routeMarket.nextRefreshTick - snapshot.tick)} ticks` },
    { label: "Policy Docket", value: `${Math.max(0, snapshot.policyDocket.nextRefreshTick - snapshot.tick)} ticks` },
  ];
  return (
    <div className="beat-clock-panel" aria-label="Beat clocks">
      <div className="beat-clock-head">
        <span>Beat Clock</span>
        <strong>{stagedTarget ? stagedTarget.label : "No staged action"}</strong>
      </div>
      <div className="beat-clock-grid">
        {clocks.map((clock) => (
          <div key={clock.label}>
            <span>{clock.label}</span>
            <strong>{clock.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildPalette({
  snapshot,
  player,
  selectedTile,
  hasStagedTarget,
  facilityId,
  onSelect,
}: {
  snapshot: BasinRunState;
  player?: PlayerState;
  selectedTile?: BasinTile;
  hasStagedTarget: boolean;
  facilityId: FacilityId;
  onSelect: (facilityId: FacilityId) => void;
}) {
  return (
    <div className="build-palette" aria-label="Facility build palette">
      <div className="build-palette-head">
        <span>Build Palette</span>
        <strong>{hasStagedTarget && selectedTile ? `target ${selectedTile.id}` : "pick build site"}</strong>
      </div>
      <div className="build-palette-list">
        {facilityList.map((facility) => {
          const preview = getBuildPreviewState(snapshot, player, selectedTile, facility.id);
          return (
            <button
              key={facility.id}
              className={`facility-card${facilityId === facility.id ? " active" : ""}${preview.canBuild ? " ready" : ""}`}
              title={`${facility.name}: ${preview.reason}`}
              onClick={() => onSelect(facility.id)}
            >
              <FacilityGlyph facilityId={facility.id} />
              <span>{facility.name}</span>
              <small>
                {preview.cost} CC / {facility.validTerrains.join(", ")}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContextActionDock({
  eyebrow,
  title,
  meta,
  detail,
  actionLabel,
  disabled,
  onConfirm,
  onCancel,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  detail: string;
  actionLabel: string;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="context-action-dock" role="status" aria-label="Context action">
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <small>
          {meta} / {detail}
        </small>
      </div>
      <button className="secondary-action compact" onClick={onCancel}>
        Cancel
      </button>
      <button className="primary-action compact" disabled={disabled} onClick={onConfirm}>
        <ClipboardCheck size={15} />
        {actionLabel}
      </button>
    </div>
  );
}

function DecisionStack({ items }: { items: DecisionItem[] }) {
  return (
    <section className="panel-section decision-stack">
      <div className="section-title">
        <ListChecks size={15} />
        <h2>Decision Stack</h2>
      </div>
      <div className="decision-list">
        {items.map((item, index) => (
          <article key={item.id} className={`decision-card ${item.tone}${index === 0 && !item.disabled ? " primary" : ""}`}>
            <div className="decision-head">
              <span>{index === 0 && !item.disabled ? "Best now" : item.disabled ? "Blocked" : "Available"}</span>
              <strong>{item.title}</strong>
            </div>
            <p>{item.status}</p>
            <ul>
              {item.effects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
            {item.actionLabel ? (
              <button disabled={item.disabled} onClick={item.onSelect}>
                {item.disabled ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                {item.actionLabel}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ModePanel({
  snapshot,
  player,
  tool,
  facilityId,
  selectedTile,
}: {
  snapshot: BasinRunState;
  player?: PlayerState;
  tool: ToolMode;
  facilityId: FacilityId;
  selectedTile?: BasinTile;
}) {
  const facility = facilities[facilityId];
  const counts = getBuildCounts(snapshot, player, facilityId);
  const selectedStatus = selectedTile ? describeBuildTarget(snapshot, player, selectedTile, facilityId) : "No tile selected";
  const modeCopy =
    tool === "scout"
      ? `Scout mode: ${player?.actionsRemaining ?? 0}/3 moves remaining`
      : tool === "build"
        ? `Build mode: ${facility.name}`
        : tool === "contracts"
          ? "Contracts mode"
          : tool === "politics"
            ? "Politics mode"
            : "Inspect mode";

  return (
    <div className="mode-panel">
      <div>
        <span>{modeCopy}</span>
        <strong>{tool === "build" ? selectedStatus : selectedTile ? `Selected ${selectedTile.id}` : "Select a tile"}</strong>
      </div>
      <div className="mode-chips">
        {tool === "build" ? (
          <>
            <span>{counts.valid} valid sites</span>
            <span>{counts.compatible} terrain matches</span>
          </>
        ) : (
          <>
            <span>Esc cancels to Inspect</span>
            <span>Scout uses one move per tile</span>
          </>
        )}
      </div>
    </div>
  );
}

function TileInspector({ tile, playerID }: { tile?: BasinTile; playerID: string }) {
  const visible = tile ? tile.revealedBy.includes(playerID) || tile.structure?.owner === playerID : false;
  const facility = tile?.structure ? facilities[tile.structure.facilityId] : undefined;
  return (
    <section className="panel-section">
      <div className="section-title">
        <Target size={15} />
        <h2>Selected Tile</h2>
      </div>
      {!tile ? (
        <p className="muted">No tile selected.</p>
      ) : (
        <div className="tile-readout">
          <div>
            <span>ID</span>
            <strong>{tile.id}</strong>
          </div>
          <div>
            <span>Terrain</span>
            <strong>{visible ? tile.terrain : "unscouted"}</strong>
          </div>
          <div>
            <span>Richness</span>
            <strong>{visible ? tile.richness : "-"}</strong>
          </div>
          <div>
            <span>Hazard</span>
            <strong>{visible ? tile.hazard : "-"}</strong>
          </div>
          <div className="wide">
            <span>Structure</span>
            <strong>{facility ? `${facility.name} / Baron ${Number(tile?.structure?.owner ?? 0) + 1}` : "empty"}</strong>
          </div>
        </div>
      )}
    </section>
  );
}

function ScoutPreviewPanel({
  player,
  selectedTile,
  preview,
  staged,
}: {
  player?: PlayerState;
  selectedTile?: BasinTile;
  preview: ScoutMovePreview;
  staged: boolean;
}) {
  return (
    <section className="panel-section scout-panel">
      <div className="section-title">
        <Search size={15} />
        <h2>Scout Order</h2>
      </div>
      <div className="scout-readout">
        <div>
          <span>Moves</span>
          <strong>{player ? `${player.actionsRemaining}/3` : "-"}</strong>
        </div>
        <div>
          <span>Target</span>
          <strong>{staged && selectedTile ? selectedTile.id : "pick adjacent tile"}</strong>
        </div>
      </div>
      <div className={`action-preview ${preview.canMove ? "positive" : "neutral"}`}>
        <div>
          {preview.canMove ? <CheckCircle2 size={14} /> : <Info size={14} />}
          <strong>{staged ? preview.reason : "Choose a highlighted neighbor on the map"}</strong>
        </div>
        <p>{preview.canMove ? "The map dock will confirm the move before spending a scout action." : "Scout moves are one tile at a time and reveal nearby terrain."}</p>
        <EffectList items={preview.effects} />
      </div>
    </section>
  );
}

function BuildPreview({
  snapshot,
  player,
  tile,
  facilityId,
  preview,
}: {
  snapshot: BasinRunState;
  player?: PlayerState;
  tile?: BasinTile;
  facilityId: FacilityId;
  preview: BuildPreviewState;
}) {
  const facility = facilities[facilityId];

  return (
    <div className="build-card">
      <div>
        <strong>{facility.name}</strong>
        <span>{preview.cost} CC</span>
      </div>
      <p>{facility.description}</p>
      <div className="mini-grid">
        <span>Output {facility.output}</span>
        <span>{facility.validTerrains.join(", ")}</span>
        <span className={preview.canBuild ? "ok" : "warn"}>{preview.reason}</span>
      </div>
      <EffectList items={preview.effects} />
    </div>
  );
}

function EffectList({ items }: { items: EffectLine[] }) {
  return (
    <div className="effect-list">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={`effect-line ${item.tone ?? "neutral"}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function MarketPanel({
  snapshot,
  player,
  routeOptions,
  routeId,
  demandId,
  amount,
  setRouteId,
  setDemandId,
  setAmount,
  onBuyRoute,
  onSell,
  salePreview,
  buyPreview,
  panelRef,
  highlight,
}: {
  snapshot: BasinRunState;
  player?: PlayerState;
  routeOptions: RouteId[];
  routeId: RouteId;
  demandId: DemandId;
  amount: number;
  setRouteId: (routeId: RouteId) => void;
  setDemandId: (demandId: DemandId) => void;
  setAmount: (amount: number) => void;
  onBuyRoute: () => void;
  onSell: () => void;
  salePreview: SalePreview;
  buyPreview: BuyPreview;
  panelRef?: React.RefObject<HTMLElement>;
  highlight?: boolean;
}) {
  const route = routes[routeId];
  const demand = snapshot.demands[demandId];
  const locked = snapshot.civic.policies.routeLocks.includes(routeId);
  const owned = Boolean(player?.routes.includes(routeId));
  const offered = snapshot.routeMarket.offeredRouteIds.includes(routeId);
  const canBuy = buyPreview.canBuy;
  const canSell = salePreview.canSell;
  const nextOfferTicks = Math.max(0, snapshot.routeMarket.nextRefreshTick - snapshot.tick);
  const routeStatus = locked ? "Policy locked" : owned ? "Owned route" : offered ? `${route.cost} CC live offer` : "Not in auction";
  const saleAmountCap = Math.max(1, Math.min(player?.water ?? 1, demand.demand));
  return (
    <section ref={panelRef} className={`panel-section route-panel${highlight ? " spotlight" : ""}`}>
      <div className="section-title route-market-header">
        <div>
          <BadgeDollarSign size={15} />
          <h2>Route Auction & Sales</h2>
        </div>
        <span>New offers in {nextOfferTicks} ticks</span>
      </div>
      <div className="route-steps" aria-label="Route flow">
        <div className={`route-step${offered && !owned && !locked ? " active" : ""}`}>
          <span>1</span>
          <strong>Own a route</strong>
          <small>{owned ? "selected route owned" : offered && !locked ? `buy live offer for ${route.cost} CC` : `refresh in ${nextOfferTicks} ticks`}</small>
        </div>
        <div className={`route-step${owned ? " active" : ""}`}>
          <span>2</span>
          <strong>Sell stored water</strong>
          <small>{owned ? `${player?.water ?? 0} water / ${demand.demand} demand` : "requires owned route"}</small>
        </div>
      </div>
      <div className="route-offers">
        {snapshot.routeMarket.offeredRouteIds.map((candidateId) => {
          const candidate = routes[candidateId];
          const candidateLocked = snapshot.civic.policies.routeLocks.includes(candidateId);
          return (
            <button
              key={candidateId}
              className={`route-offer${routeId === candidateId ? " active" : ""}`}
              disabled={candidateLocked}
              onClick={() => setRouteId(candidateId)}
            >
              <strong>{candidate.name}</strong>
              <span>{candidateLocked ? "locked" : `${candidate.cost} CC live`}</span>
            </button>
          );
        })}
      </div>
      <div className="form-grid">
        <label>
          Route
          <select value={routeId} onChange={(event) => setRouteId(event.target.value as RouteId)}>
            {routeOptions.map((candidateId) => (
              <option key={candidateId} value={candidateId}>
                {routes[candidateId].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Demand
          <select value={demandId} onChange={(event) => setDemandId(event.target.value as DemandId)}>
            {Object.values(demands).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="market-readout">
        <span>{route.description}</span>
        <strong>{routeStatus}</strong>
      </div>
      <div className="market-readout">
        <span>
          {demands[demandId].name}: {demands[demandId].values}
        </span>
        <strong>
          {demand.demand} demand / {demand.price} CC
        </strong>
      </div>
      <div className="action-preview">
        <div>
          <Info size={14} />
          <strong>{owned ? "Sale Preview" : "Buy Preview"}</strong>
        </div>
        <p>{owned ? salePreview.reason : buyPreview.reason}</p>
        <EffectList items={owned ? salePreview.effects : buyPreview.effects} />
      </div>
      <label>
        Sale Amount
        <input
          type="number"
          min={1}
          max={saleAmountCap}
          value={amount}
          disabled={!owned}
          title={owned ? salePreview.reason : "Buy the route before choosing a sale amount."}
          onChange={(event) => setAmount(Math.max(1, Number(event.target.value)))}
        />
      </label>
      <div className="button-row">
        <button onClick={onBuyRoute} disabled={!canBuy} title={buyPreview.reason}>
          <HandCoins size={15} />
          Buy Route
        </button>
        <button className="primary-action compact" onClick={onSell} disabled={!canSell} title={salePreview.reason}>
          <Droplets size={15} />
          Sell Water
        </button>
      </div>
    </section>
  );
}

function CivicPanel({
  panelRef,
  highlight,
  snapshot,
  playerID,
  civicTarget,
  setCivicTarget,
  onAction,
  onPolicyChoice,
}: {
  panelRef?: React.RefObject<HTMLElement>;
  highlight?: boolean;
  snapshot: BasinRunState;
  playerID: string;
  civicTarget: string;
  setCivicTarget: (playerID: string) => void;
  onAction: (actionId: CivicActionId, targetPlayerId?: string) => void;
  onPolicyChoice: (choiceId: PolicyDocketChoiceId) => void;
}) {
  const player = snapshot.players[playerID];
  const rivals = Object.values(snapshot.players).filter((candidate) => candidate.id !== playerID);
  const latestFeed = snapshot.civic.feed.slice(-4).reverse();
  const forecasts = getPolicyForecast(snapshot);
  const actionPreviews = getCivicActionPreviews(snapshot, playerID, civicTarget);
  const rivalEvidence = getBlameEvidence(snapshot, civicTarget);

  return (
    <section ref={panelRef} className={`panel-section civic-section${highlight ? " spotlight" : ""}`}>
      <div className="section-title">
        <Megaphone size={15} />
        <h2>Civic Optics</h2>
      </div>
      <div className="gauge-list civic-gauges">
        {(Object.keys(civicTrackLabels) as CivicTrackKey[]).map((key) => (
          <GaugeBar key={key} label={civicTrackLabels[key]} value={snapshot.civic.tracks[key]} color={civicColor(key)} />
        ))}
      </div>
      <div className="player-civic">
        <span>Relief {player?.civic.reliefCredit ?? 0}</span>
        <span>Access {player?.civic.lobbyAccess ?? 0}</span>
      </div>
      <div className="form-grid">
        <label>
          Rival
          <select value={civicTarget} onChange={(event) => setCivicTarget(event.target.value)}>
            {rivals.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <div className="rival-evidence">
          <span>Evidence</span>
          <strong>{rivals.length ? rivalEvidence : "-"}</strong>
        </div>
      </div>
      <div className="civic-action-grid">
        {actionPreviews.map((preview) => (
          <article key={preview.id} className={`civic-action-card ${preview.tone}`}>
            <div>
              <strong>{preview.title}</strong>
              <span>{preview.cost}</span>
            </div>
            <p>{preview.status}</p>
            <EffectList items={preview.effects} />
            <button disabled={!preview.canUse} title={preview.status} onClick={() => onAction(preview.id, preview.id === "blame-rival" ? civicTarget : undefined)}>
              {preview.canUse ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              Execute
            </button>
          </article>
        ))}
      </div>
      <div className="policy-strip">
        <span>Permits +{snapshot.civic.policies.permitFriction}</span>
        <span>Subsidy {snapshot.civic.policies.subsidyLevel}</span>
        <span>Inspect {snapshot.civic.policies.inspectionRisk}</span>
        <span>Locks {snapshot.civic.policies.routeLocks.length}</span>
      </div>
      <PolicyDocketPanel snapshot={snapshot} onPolicyChoice={onPolicyChoice} />
      <PolicyForecastPanel forecasts={forecasts} />
      <div className="feed-list">
        {latestFeed.map((item) => (
          <article key={item.id} className={item.sentiment < 0 ? "negative" : item.sentiment > 0 ? "positive" : undefined}>
            <span>
              {item.source} / {item.topic} / reach {item.reach}
            </span>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PolicyDocketPanel({
  snapshot,
  onPolicyChoice,
}: {
  snapshot: BasinRunState;
  onPolicyChoice: (choiceId: PolicyDocketChoiceId) => void;
}) {
  const forecasts = getPolicyForecast(snapshot);
  const activeForecast = forecasts.find((forecast) => forecast.id === snapshot.policyDocket.activeForecastId) ?? forecasts[0];
  const resolved = snapshot.policyDocket.resolvedChoiceId;
  const ticks = Math.max(0, snapshot.policyDocket.nextRefreshTick - snapshot.tick);

  return (
    <div className="docket-list">
      <div className="mini-heading docket-heading">
        <span>Policy Docket</span>
        <strong>{resolved ? `resolved / ${ticks} ticks` : `${ticks} ticks`}</strong>
      </div>
      <div className="docket-context">
        <strong>{activeForecast?.label ?? "Council Agenda"}</strong>
        <span>{activeForecast?.trigger ?? "ambient pressure"}</span>
      </div>
      {snapshot.policyDocket.choices.length ? (
        snapshot.policyDocket.choices.map((choice) => (
          <article key={choice.id} className={`docket-card${resolved === choice.id ? " resolved" : ""}`}>
            <div>
              <strong>{choice.title}</strong>
              <span>{choice.cost}</span>
            </div>
            <p>{choice.description}</p>
            <small>{choice.effect}</small>
            <button disabled={Boolean(resolved)} onClick={() => onPolicyChoice(choice.id)}>
              {resolved === choice.id ? "Chosen" : "Choose"}
            </button>
          </article>
        ))
      ) : (
        <p className="muted">No active docket.</p>
      )}
    </div>
  );
}

function PolicyForecastPanel({ forecasts }: { forecasts: PolicyForecast[] }) {
  return (
    <div className="forecast-list">
      <div className="mini-heading">Policy Forecast</div>
      {forecasts.map((forecast) => (
        <article key={forecast.id} className={`forecast-card ${forecast.severity}`}>
          <div>
            <strong>{forecast.label}</strong>
            <span>{forecast.progress}/10</span>
          </div>
          <div className="forecast-track">
            <i style={{ width: `${forecast.progress * 10}%` }} />
          </div>
          <p>{forecast.likelyEffect}</p>
          <small>{forecast.playerHandle}</small>
        </article>
      ))}
    </div>
  );
}

function GaugeBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="gauge-row">
      <div>
        <span>{label}</span>
        <strong>{value}/10</strong>
      </div>
      <div className="gauge-track">
        <i style={{ width: `${Math.max(0, Math.min(10, value)) * 10}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function civicColor(key: CivicTrackKey): string {
  if (key === "institutionalTrust") return "#2d7fa3";
  if (key === "outrage") return "#c8706d";
  if (key === "regulatoryHeat") return "#d9659e";
  if (key === "capture") return "#c6a24a";
  if (key === "dependency") return "#5578c5";
  return "#63afa8";
}

function firstRivalId(snapshot: BasinRunState, playerID: string): string | undefined {
  return Object.keys(snapshot.players).find((candidate) => candidate !== playerID);
}

function ticksUntilModulo(tick: number, cadence: number): number {
  const remainder = tick % cadence;
  return remainder === 0 ? cadence : cadence - remainder;
}

function getScoutMovePreview(snapshot: BasinRunState, player: PlayerState | undefined, tile: BasinTile | undefined): ScoutMovePreview {
  if (!player || !tile) {
    return {
      canMove: false,
      reason: "Select a tile adjacent to the scout",
      effects: [{ label: "Movement", value: "choose adjacent tile", tone: "neutral" }],
    };
  }
  if (player.actionsRemaining <= 0) {
    return {
      canMove: false,
      reason: "No scout moves until the next round beat",
      effects: [{ label: "Movement", value: "0/3 moves", tone: "warning" }],
    };
  }
  if (player.scoutTileId === tile.id) {
    return {
      canMove: false,
      reason: "Scout is already on this tile",
      effects: [{ label: "Movement", value: "pick a neighboring tile", tone: "neutral" }],
    };
  }
  const current = snapshot.tiles.find((candidate) => candidate.id === player.scoutTileId);
  const adjacent = current ? Math.abs(current.x - tile.x) + Math.abs(current.y - tile.y) === 1 : false;
  if (!adjacent) {
    return {
      canMove: false,
      reason: "Scout can only move one tile",
      effects: [{ label: "Movement", value: "1-tile radius", tone: "warning" }],
    };
  }
  return {
    canMove: true,
    reason: "Ready to move scout",
    effects: [
      { label: "Reveal", value: "adjacent basin", tone: "positive" },
      { label: "Cost", value: "1 scout move", tone: "warning" },
      { label: "Risk", value: tile.hazard > 1 ? "hazard plume" : "unknown", tone: tile.hazard > 1 ? "negative" : "neutral" },
    ],
  };
}

function getBuildCounts(snapshot: BasinRunState, player: PlayerState | undefined, facilityId: FacilityId): { valid: number; compatible: number } {
  if (!player) return { valid: 0, compatible: 0 };
  const facility = facilities[facilityId];
  let valid = 0;
  let compatible = 0;
  for (const tile of snapshot.tiles) {
    if (!tile.revealedBy.includes(player.id) || tile.structure || !facility.validTerrains.includes(tile.terrain)) continue;
    compatible += 1;
    const connected = snapshot.tiles.some(
      (candidate) =>
        candidate.structure?.owner === player.id &&
        Math.abs(candidate.x - tile.x) + Math.abs(candidate.y - tile.y) === 1,
    );
    if (connected) valid += 1;
  }
  return { valid, compatible };
}

function describeBuildTarget(
  snapshot: BasinRunState,
  player: PlayerState | undefined,
  tile: BasinTile,
  facilityId: FacilityId,
): string {
  if (!player) return "No player seat";
  const facility = facilities[facilityId];
  if (!tile.revealedBy.includes(player.id)) return "Unscouted tile";
  if (tile.structure) return "Occupied tile";
  if (!facility.validTerrains.includes(tile.terrain)) return `${facility.name} needs ${facility.validTerrains.join(" or ")}`;
  const connected = snapshot.tiles.some(
    (candidate) =>
      candidate.structure?.owner === player.id &&
      Math.abs(candidate.x - tile.x) + Math.abs(candidate.y - tile.y) === 1,
  );
  return connected ? "Ready to build" : "Needs adjacency to your network";
}

function getBuildPreviewState(
  snapshot: BasinRunState,
  player: PlayerState | undefined,
  tile: BasinTile | undefined,
  facilityId: FacilityId,
): BuildPreviewState {
  const facility = facilities[facilityId];
  const cost = effectiveFacilityCost(snapshot, facilityId);
  const visible = Boolean(tile && player && tile.revealedBy.includes(player.id));
  const connected = Boolean(tile && player && isConnectedToPlayerNetwork(snapshot, player.id, tile));
  const production = estimateProduction(snapshot, tile, facilityId);
  const effects: EffectLine[] = [
    { label: "Cost", value: `-${cost} CC`, tone: "negative" },
    { label: "Water pulse", value: `+${production} every 4 ticks`, tone: "positive" },
    { label: "Collapse load", value: summarizeImpact(facility.impact, "none"), tone: sumImpact(facility.impact) > 0 ? "warning" : "positive" },
  ];
  if (facility.tags.includes("HIGH_ENERGY") || facility.tags.includes("GROUNDWATER")) {
    effects.push({
      label: "Civic drift",
      value: snapshot.civic.policies.subsidyLevel > 0 ? "+1 Dependency, +1 Capture" : "+1 Dependency",
      tone: "warning",
    });
  } else {
    effects.push({ label: "Civic drift", value: "no immediate policy heat", tone: "positive" });
  }

  if (!player) return { canBuild: false, reason: "No player seat", cost, production, effects };
  if (!tile) return { canBuild: false, reason: "Select a tile", cost, production, effects };
  if (!visible) return { canBuild: false, reason: "Unscouted tile", cost, production, effects };
  if (tile.structure) return { canBuild: false, reason: "Tile occupied", cost, production, effects };
  if (!facility.validTerrains.includes(tile.terrain)) {
    return { canBuild: false, reason: `Needs ${facility.validTerrains.join(" or ")}`, cost, production, effects };
  }
  if (!connected) return { canBuild: false, reason: "Needs adjacency", cost, production, effects };
  if (player.credits < cost) return { canBuild: false, reason: `Needs ${cost} CC`, cost, production, effects };
  return { canBuild: true, reason: "Ready to build", cost, production, effects };
}

function findBestBuildCandidate(snapshot: BasinRunState, player: PlayerState | undefined): BuildCandidate | undefined {
  if (!player) return undefined;
  const candidates: BuildCandidate[] = [];
  for (const facility of facilityList) {
    for (const tile of snapshot.tiles) {
      if (!tile.revealedBy.includes(player.id) || tile.structure) continue;
      if (!facility.validTerrains.includes(tile.terrain)) continue;
      if (!isConnectedToPlayerNetwork(snapshot, player.id, tile)) continue;
      const cost = effectiveFacilityCost(snapshot, facility.id);
      if (player.credits < cost) continue;
      const production = estimateProduction(snapshot, tile, facility.id);
      const impactLoad = sumImpact(facility.impact);
      candidates.push({
        tile,
        facilityId: facility.id,
        cost,
        production,
        score: production * 4 + tile.richness - impactLoad * 1.8 - cost * 0.35,
      });
    }
  }
  return candidates.sort((left, right) => right.score - left.score)[0];
}

function findBestSaleCandidate(snapshot: BasinRunState, player: PlayerState | undefined): SaleCandidate | undefined {
  if (!player || player.water <= 0) return undefined;
  const candidates: SaleCandidate[] = [];
  for (const routeId of player.routes) {
    for (const demand of Object.values(snapshot.demands)) {
      const preview = getSalePreview(snapshot, player, routeId, demand.id, Math.min(player.water, demand.demand));
      if (!preview.canSell) continue;
      candidates.push({
        routeId,
        demandId: demand.id,
        amount: preview.amount,
        revenue: preview.revenue,
        score: preview.revenue - sumImpact(saleImpactFor(routeId, preview.amount)) * 0.7,
      });
    }
  }
  return candidates.sort((left, right) => right.score - left.score)[0];
}

function findBestRouteOffer(snapshot: BasinRunState, player: PlayerState | undefined): RouteId | undefined {
  if (!player) return undefined;
  return snapshot.routeMarket.offeredRouteIds
    .filter((routeId) => !player.routes.includes(routeId) && !snapshot.civic.policies.routeLocks.includes(routeId) && player.credits >= routes[routeId].cost)
    .sort((left, right) => routes[left].cost - routes[right].cost)[0];
}

function getSalePreview(
  snapshot: BasinRunState,
  player: PlayerState | undefined,
  routeId: RouteId,
  demandId: DemandId,
  requestedAmount: number,
): SalePreview {
  const route = routes[routeId];
  const demand = snapshot.demands[demandId];
  const maxAmount = Math.min(player?.water ?? 0, demand?.demand ?? 0);
  const amount = maxAmount > 0 ? Math.min(Math.max(1, Math.floor(requestedAmount || 1)), maxAmount) : 0;
  const price = effectiveDemandPrice(snapshot, demandId);
  const revenue = amount * price;
  const saleImpact = saleImpactFor(routeId, amount);
  const effects: EffectLine[] = [
    { label: "Cash", value: `+${revenue} CC`, tone: "positive" },
    { label: "Inventory", value: `-${amount} water`, tone: "negative" },
    { label: "Demand", value: `-${amount} ${demands[demandId].name}`, tone: "positive" },
    { label: "Collapse load", value: summarizeImpact(saleImpact, "none"), tone: sumImpact(saleImpact) > 0 ? "warning" : "positive" },
  ];

  if (!player) return { canSell: false, reason: "No player seat", amount, revenue, effects };
  if (!player.routes.includes(routeId)) return { canSell: false, reason: `${route.name} is not owned`, amount, revenue, effects };
  if (snapshot.civic.policies.routeLocks.includes(routeId)) return { canSell: false, reason: `${route.name} is locked by policy`, amount, revenue, effects };
  if (player.water <= 0) return { canSell: false, reason: "No stored water to sell", amount, revenue, effects };
  if (!demand || demand.demand <= 0) return { canSell: false, reason: "Selected demand is exhausted", amount, revenue, effects };
  if (!canSellToDemandClient(snapshot, demandId, routeId)) {
    return { canSell: false, reason: `${demands[demandId].name} rejects ${route.name}`, amount, revenue, effects };
  }
  return { canSell: true, reason: `Sell ${amount} water for ${revenue} CC`, amount, revenue, effects };
}

function getBuyPreview(snapshot: BasinRunState, player: PlayerState | undefined, routeId: RouteId): BuyPreview {
  const route = routes[routeId];
  const effects: EffectLine[] = [
    { label: "Cost", value: `-${route.cost} CC`, tone: "negative" },
    { label: "Route impact", value: summarizeImpact(route.impactPerSale, "none"), tone: sumImpact(route.impactPerSale) > 0 ? "warning" : "positive" },
  ];
  if (!player) return { canBuy: false, reason: "No player seat", effects };
  if (player.routes.includes(routeId)) return { canBuy: false, reason: `${route.name} is already owned`, effects };
  if (!snapshot.routeMarket.offeredRouteIds.includes(routeId)) {
    return { canBuy: false, reason: `${route.name} is not in the live auction`, effects };
  }
  if (snapshot.civic.policies.routeLocks.includes(routeId)) return { canBuy: false, reason: `${route.name} is policy locked`, effects };
  if (player.credits < route.cost) return { canBuy: false, reason: `Needs ${route.cost} CC`, effects };
  return { canBuy: true, reason: `Buy ${route.name} before the auction refreshes`, effects };
}

function getCivicActionPreviews(snapshot: BasinRunState, playerID: string, targetPlayerId: string): CivicActionPreview[] {
  const player = snapshot.players[playerID];
  const target = snapshot.players[targetPlayerId];
  const evidence = getBlameEvidence(snapshot, targetPlayerId);
  const canRelief = Boolean(player && (player.water >= 2 || player.credits >= 2));
  const canLobby = Boolean(player && player.credits >= 3);
  const canPremium = Boolean(player && player.credits >= 2);
  const canBlame = Boolean(player && target && target.id !== player.id && player.credits >= 1);

  return [
    {
      id: "sponsor-relief",
      title: "Sponsor Relief",
      cost: player && player.water >= 2 ? "2 water" : "2 CC",
      status: canRelief ? "Buys public calm and trust before thirst hardens policy." : "Needs 2 water or 2 CC.",
      canUse: canRelief,
      tone: canRelief ? "positive" : "warning",
      effects: [
        { label: "Public Thirst", value: "-2", tone: "positive" },
        { label: "Trust", value: "+1", tone: "positive" },
        { label: "Outrage", value: "-1", tone: "positive" },
        { label: "Brand", value: "+1", tone: "positive" },
      ],
    },
    {
      id: "lobby-permit-office",
      title: "Lobby",
      cost: "3 CC",
      status: canLobby ? "Reduces heat, but makes capture more visible." : "Needs 3 CC.",
      canUse: canLobby,
      tone: canLobby ? "warning" : "neutral",
      effects: [
        { label: "Regulatory Heat", value: "-2", tone: "positive" },
        { label: "Capture", value: "+2", tone: "warning" },
        { label: "Trust", value: "-1", tone: "negative" },
        { label: "Blame", value: "-1", tone: "positive" },
      ],
    },
    {
      id: "premium-campaign",
      title: "Premium Campaign",
      cost: "2 CC",
      status: canPremium ? "Creates high-price demand while raising visible thirst pressure." : "Needs 2 CC.",
      canUse: canPremium,
      tone: canPremium ? "warning" : "neutral",
      effects: [
        { label: "Brand", value: "+2", tone: "positive" },
        { label: "Connoisseur Demand", value: "+2", tone: "positive" },
        { label: "Connoisseur Price", value: "+1", tone: "positive" },
        { label: "Public Thirst", value: "+1", tone: "warning" },
      ],
    },
    {
      id: "blame-rival",
      title: "Blame Rival",
      cost: "1 CC",
      status: !target
        ? "No rival target."
        : evidence > 0
          ? `${target.name} has ${evidence} evidence. Blame is likely to stick.`
          : "Thin evidence: this will probably backfire.",
      canUse: canBlame,
      tone: evidence > 0 ? "warning" : "negative",
      effects:
        evidence > 0
          ? [
              { label: "Your Blame", value: "-1", tone: "positive" },
              { label: "Target Blame", value: "+2", tone: "warning" },
              { label: "Trust", value: "-1", tone: "negative" },
            ]
          : [
              { label: "Your Blame", value: "+1", tone: "negative" },
              { label: "Your Brand", value: "-1", tone: "negative" },
              { label: "Trust", value: "-1", tone: "negative" },
            ],
    },
  ];
}

function getBlameEvidence(snapshot: BasinRunState, playerID: string): number {
  const player = snapshot.players[playerID];
  return player ? sumImpact(player.pendingImpact) + player.civic.blameLoad : 0;
}

function isConnectedToPlayerNetwork(snapshot: BasinRunState, playerID: string, tile: BasinTile): boolean {
  return snapshot.tiles.some(
    (candidate) =>
      candidate.structure?.owner === playerID &&
      Math.abs(candidate.x - tile.x) + Math.abs(candidate.y - tile.y) === 1,
  );
}

function effectiveFacilityCost(snapshot: BasinRunState, facilityId: FacilityId): number {
  return Math.max(1, facilities[facilityId].cost + snapshot.civic.policies.permitFriction - snapshot.civic.policies.subsidyLevel);
}

function estimateProduction(snapshot: BasinRunState, tile: BasinTile | undefined, facilityId: FacilityId): number {
  const facility = facilities[facilityId];
  const richness = tile ? Math.max(0, tile.richness - 2) : 0;
  let produced = Math.max(1, Math.ceil((facility.output + richness) / 2));
  if (snapshot.activeEvents.includes("aquifer-collapse") && facility.tags.includes("WELL")) produced = Math.max(1, produced - 1);
  if (snapshot.activeEvents.includes("heatwave-frenzy")) produced = Math.max(0, produced - 1);
  return produced;
}

function effectiveDemandPrice(snapshot: BasinRunState, demandId: DemandId): number {
  const demand = snapshot.demands[demandId];
  const priceControlPenalty = snapshot.civic.policies.priceControls > 0 && demandId !== "frugalists" ? 1 : 0;
  return Math.max(1, demand.price - priceControlPenalty);
}

function canSellToDemandClient(snapshot: BasinRunState, demandId: DemandId, routeId: RouteId): boolean {
  if (demandId === "convenientists") return routeId === "plastic-bottles" || routeId === "drone-drops";
  if (demandId === "eco-elites") return snapshot.tracks.PINK <= 4 && snapshot.tracks.GREY <= 5;
  if (demandId === "connoisseurs") return snapshot.tracks.GREEN < 7;
  if (routeId === "plastic-bottles" && snapshot.activeEvents.includes("microplastic-revelation")) return false;
  return true;
}

function summarizeImpact(impact: ImpactProfile, emptyText: string): string {
  const parts = trackKeys
    .map((key) => {
      const value = impact[key] ?? 0;
      return value ? `+${value} ${trackLabels[key].label}` : undefined;
    })
    .filter(Boolean);
  return parts.length ? parts.join(", ") : emptyText;
}

function saleImpactFor(routeId: RouteId, amount: number): ImpactProfile {
  const route = routes[routeId];
  return scaleImpact(route.impactPerSale, Math.floor(amount / route.perCubes));
}

function scaleImpact(impact: ImpactProfile, multiplier: number): ImpactProfile {
  return {
    PINK: (impact.PINK ?? 0) * multiplier,
    GREY: (impact.GREY ?? 0) * multiplier,
    BLUE: (impact.BLUE ?? 0) * multiplier,
    GREEN: (impact.GREEN ?? 0) * multiplier,
  };
}

function sumImpact(impact: ImpactProfile): number {
  return trackKeys.reduce((total, key) => total + Math.max(0, impact[key] ?? 0), 0);
}

type ReactRoot = ReturnType<typeof createRoot>;
type RootElement = HTMLElement & { __waterbaronsRoot?: ReactRoot };

const rootElement = document.getElementById("root") as RootElement | null;
if (!rootElement) throw new Error("Missing root element.");

const root = rootElement.__waterbaronsRoot ?? createRoot(rootElement);
rootElement.__waterbaronsRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
