import { Client, Room, Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import {
  buildInWorld,
  buyRouteInWorld,
  choosePolicyDocket,
  createInteractiveRun,
  isRunOver,
  moveScout,
  sellInWorld,
  setPlayerName,
  stepWorld,
  takeCivicAction,
} from "../game/sim";
import type { BasinRunState, BuildPayload, CivicActionPayload, PolicyChoicePayload, RouteId, SellPayload } from "../game/types";

interface JoinOptions {
  seed?: string;
  maxPlayers?: number;
  playerName?: string;
}

type IntentName = "moveScout" | "build" | "buyRoute" | "sell" | "civicAction" | "policyChoice";

class BasinRoom extends Room {
  maxClients = 4;
  autoDispose = true;
  private world!: BasinRunState;
  private sessionToPlayer = new Map<string, string>();
  private playerToSession = new Map<string, string>();

  onCreate(options: JoinOptions = {}): void {
    const maxPlayers = Math.max(1, Math.min(4, Number(options.maxPlayers ?? 4)));
    this.maxClients = maxPlayers;
    this.world = createInteractiveRun({ seed: options.seed, maxPlayers });
    this.setMetadata({ seed: this.world.seed, maxPlayers });

    this.onMessage("ready", (client) => this.sendWelcome(client));
    this.onMessage("moveScout", (client, message: { tileId?: string }) => {
      this.applyIntent(client, "moveScout", () => {
        if (!message.tileId) return "Missing tile.";
        return moveScout(this.world, this.requirePlayer(client), message.tileId);
      });
    });
    this.onMessage("build", (client, message: BuildPayload) => {
      this.applyIntent(client, "build", () => buildInWorld(this.world, this.requirePlayer(client), message));
    });
    this.onMessage("buyRoute", (client, message: { routeId?: RouteId }) => {
      this.applyIntent(client, "buyRoute", () => {
        if (!message.routeId) return "Missing route.";
        return buyRouteInWorld(this.world, this.requirePlayer(client), message.routeId);
      });
    });
    this.onMessage("sell", (client, message: SellPayload) => {
      this.applyIntent(client, "sell", () => sellInWorld(this.world, this.requirePlayer(client), message));
    });
    this.onMessage("civicAction", (client, message: CivicActionPayload) => {
      this.applyIntent(client, "civicAction", () => takeCivicAction(this.world, this.requirePlayer(client), message));
    });
    this.onMessage("policyChoice", (client, message: PolicyChoicePayload) => {
      this.applyIntent(client, "policyChoice", () => choosePolicyDocket(this.world, this.requirePlayer(client), message));
    });

    this.setSimulationInterval(() => {
      stepWorld(this.world);
      this.broadcastSnapshot();
    }, 1000);
  }

  onJoin(client: Client, options: JoinOptions = {}): void {
    const playerID = this.assignPlayer(client);
    setPlayerName(this.world, playerID, options.playerName);
    this.sendWelcome(client);
    this.broadcastSnapshot();
  }

  onLeave(client: Client): void {
    const playerID = this.sessionToPlayer.get(client.sessionId);
    if (!playerID) return;
    this.sessionToPlayer.delete(client.sessionId);
    this.playerToSession.delete(playerID);
    this.world.log.push(`${this.world.players[playerID]?.name ?? "A baron"} disconnected.`);
    this.broadcastSnapshot();
  }

  private assignPlayer(client: Client): string {
    const existing = this.sessionToPlayer.get(client.sessionId);
    if (existing) return existing;

    const freePlayer = Object.keys(this.world.players).find((playerID) => !this.playerToSession.has(playerID));
    if (!freePlayer) {
      throw new Error("No player slots available.");
    }
    this.sessionToPlayer.set(client.sessionId, freePlayer);
    this.playerToSession.set(freePlayer, client.sessionId);
    return freePlayer;
  }

  private requirePlayer(client: Client): string {
    const playerID = this.sessionToPlayer.get(client.sessionId);
    if (!playerID) throw new Error("Client has no player slot.");
    return playerID;
  }

  private sendWelcome(client: Client): void {
    const playerID = this.sessionToPlayer.get(client.sessionId);
    client.send("welcome", {
      roomId: this.roomId,
      playerID,
      seed: this.world.seed,
      runOver: isRunOver(this.world),
    });
    client.send("snapshot", this.world);
  }

  private applyIntent(client: Client, intent: IntentName, apply: () => string | undefined): void {
    try {
      const error = apply();
      if (error) {
        client.send("intentRejected", { intent, message: error });
      }
      this.broadcastSnapshot();
    } catch (err) {
      client.send("intentRejected", {
        intent,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private broadcastSnapshot(): void {
    this.broadcast("snapshot", this.world);
  }
}

const port = Number.parseInt(process.env.PORT ?? "8000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const transport = new WebSocketTransport();
transport.getExpressApp().use((req: any, res: any, next: () => void) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin ?? "*");
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const server = new Server({ transport });
server.define("basin", BasinRoom);

await server.listen(port, host);
console.log(`Waterbarons Colyseus server listening on http://${host}:${port}`);
