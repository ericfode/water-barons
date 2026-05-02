import * as Phaser from "phaser";
import { facilities, trackLabels } from "../game/content";
import type { BasinRunState, BasinTile, FacilityId, ImpactProfile, Terrain, TrackKey } from "../game/types";

export type ToolMode = "scout" | "build" | "inspect" | "contracts" | "politics";

export interface BasinSceneToolState {
  mode: ToolMode;
  facilityId: FacilityId;
  selectedTileId?: string;
  stagedTileId?: string;
  stagedAction?: "build" | "scout" | "sale" | "route" | "policy";
}

export interface BasinSceneCallbacks {
  onTileSelected: (tileId: string) => void;
  onScout: (tileId: string) => void;
  onBuild: (tileId: string, facilityId: FacilityId) => void;
}

const tileW = 92;
const tileH = 48;
const originX = 720;
const originY = 92;

const terrainColors: Record<string, { top: number; edge: number }> = {
  coast: { top: 0x87c7d3, edge: 0x4a91a8 },
  aquifer: { top: 0xa8cde2, edge: 0x5578c5 },
  fog: { top: 0xd8e4de, edge: 0x9fbab5 },
  ridge: { top: 0xd8d0bd, edge: 0xa69575 },
  scrub: { top: 0xcbd2ad, edge: 0x8fa069 },
  ruins: { top: 0xded8c7, edge: 0xa89f8d },
  sink: { top: 0xb8c4bf, edge: 0x7a8986 },
  hidden: { top: 0xd9d3c4, edge: 0xb8ad99 },
};

const ownerColors = [0x2d7fa3, 0xc6a24a, 0xb7684a, 0x67a85e];
const trackKeys: TrackKey[] = ["PINK", "GREY", "BLUE", "GREEN"];
const terrainTextureKeys: Record<Terrain | "hidden", string> = {
  coast: "terrain-coast",
  aquifer: "terrain-aquifer",
  fog: "terrain-fog",
  ridge: "terrain-ridge",
  scrub: "terrain-scrub",
  ruins: "terrain-ruins",
  sink: "terrain-sink",
  hidden: "terrain-hidden",
};
const terrainAssetUrls: Record<Terrain | "hidden", string> = {
  coast: new URL("./assets/terrain/coast.png", import.meta.url).href,
  aquifer: new URL("./assets/terrain/aquifer.png", import.meta.url).href,
  fog: new URL("./assets/terrain/fog.png", import.meta.url).href,
  ridge: new URL("./assets/terrain/ridge.png", import.meta.url).href,
  scrub: new URL("./assets/terrain/scrub.png", import.meta.url).href,
  ruins: new URL("./assets/terrain/ruins.png", import.meta.url).href,
  sink: new URL("./assets/terrain/sink.png", import.meta.url).href,
  hidden: new URL("./assets/terrain/hidden.png", import.meta.url).href,
};
const facilityTextureKeys: Record<FacilityId, string> = {
  "glacial-tap": "facility-glacial-tap",
  "greywater-loop": "facility-greywater-loop",
  "aquifer-well": "facility-aquifer-well",
  "desalination-plant": "facility-desalination-plant",
  "cloud-harvester": "facility-cloud-harvester",
  "fog-net-array": "facility-fog-net-array",
};
const facilityAssetUrls: Record<FacilityId, string> = {
  "glacial-tap": new URL("./assets/facilities/glacial-tap.png", import.meta.url).href,
  "greywater-loop": new URL("./assets/facilities/greywater-loop.png", import.meta.url).href,
  "aquifer-well": new URL("./assets/facilities/aquifer-well.png", import.meta.url).href,
  "desalination-plant": new URL("./assets/facilities/desalination-plant.png", import.meta.url).href,
  "cloud-harvester": new URL("./assets/facilities/cloud-harvester.png", import.meta.url).href,
  "fog-net-array": new URL("./assets/facilities/fog-net-array.png", import.meta.url).href,
};

export class BasinScene extends Phaser.Scene {
  private graphics?: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private sprites: Phaser.GameObjects.Image[] = [];
  private snapshot?: BasinRunState;
  private playerID = "0";
  private toolState: BasinSceneToolState = { mode: "scout", facilityId: "aquifer-well" };
  private callbacks: BasinSceneCallbacks = {
    onTileSelected: () => undefined,
    onScout: () => undefined,
    onBuild: () => undefined,
  };
  private hoverTileId?: string;
  private dragStart?: { x: number; y: number; scrollX: number; scrollY: number; moved: boolean };
  private didCenterCamera = false;
  private centeredStagedTileId?: string;

  constructor() {
    super("basin");
  }

  preload(): void {
    for (const [terrain, url] of Object.entries(terrainAssetUrls) as Array<[Terrain | "hidden", string]>) {
      this.load.image(terrainTextureKeys[terrain], url);
    }
    for (const [facilityId, url] of Object.entries(facilityAssetUrls) as Array<[FacilityId, string]>) {
      this.load.image(facilityTextureKeys[facilityId], url);
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#e7e0cf");
    this.cameras.main.setBounds(-360, -220, 2100, 1320);
    this.cameras.main.setZoom(0.82);
    this.graphics = this.add.graphics();
    this.centerCameraOnPlayer();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.dragStart = {
        x: pointer.x,
        y: pointer.y,
        scrollX: this.cameras.main.scrollX,
        scrollY: this.cameras.main.scrollY,
        moved: false,
      };
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const tile = this.snapshot ? this.findTileAtWorld(pointer.worldX, pointer.worldY) : undefined;
      this.hoverTileId = tile?.id;

      if (!pointer.isDown || !this.dragStart) return;
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        this.dragStart.moved = true;
        this.cameras.main.scrollX = this.dragStart.scrollX - dx / this.cameras.main.zoom;
        this.cameras.main.scrollY = this.dragStart.scrollY - dy / this.cameras.main.zoom;
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const wasDrag = this.dragStart?.moved;
      this.dragStart = undefined;
      if (!wasDrag) this.handlePointerClick(pointer);
    });

    this.input.on("wheel", (_pointer: unknown, _objects: unknown, _dx: number, dy: number) => {
      const nextZoom = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.0012, 0.58, 1.35);
      this.cameras.main.setZoom(nextZoom);
    });
  }

  update(): void {
    this.renderSnapshot();
  }

  setSnapshot(snapshot: BasinRunState): void {
    this.snapshot = snapshot;
    this.centerCameraOnPlayer();
  }

  setPlayerID(playerID: string): void {
    this.playerID = playerID;
    this.didCenterCamera = false;
  }

  setToolState(toolState: BasinSceneToolState): void {
    this.toolState = toolState;
    if (toolState.stagedTileId && toolState.stagedTileId !== this.centeredStagedTileId) {
      this.centerCameraOnTile(toolState.stagedTileId);
      this.centeredStagedTileId = toolState.stagedTileId;
    }
  }

  setCallbacks(callbacks: BasinSceneCallbacks): void {
    this.callbacks = callbacks;
  }

  private handlePointerClick(pointer: Phaser.Input.Pointer): void {
    if (!this.snapshot) return;
    const tile = this.findTileAtWorld(pointer.worldX, pointer.worldY);
    if (!tile) return;
    this.callbacks.onTileSelected(tile.id);
  }

  private centerCameraOnPlayer(): void {
    if (!this.snapshot || !this.cameras?.main || this.didCenterCamera) return;
    const hq = this.snapshot.players[this.playerID]?.hqTileId;
    const tile = hq ? this.snapshot.tiles.find((candidate) => candidate.id === hq) : undefined;
    if (!tile) return;
    const center = tileCenter(tile);
    this.cameras.main.centerOn(center.x, center.y - 20);
    this.didCenterCamera = true;
  }

  private findTileAtWorld(worldX: number, worldY: number): BasinTile | undefined {
    if (!this.snapshot) return undefined;

    let best: BasinTile | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const tile of this.snapshot.tiles) {
      const center = tileCenter(tile);
      const dx = worldX - center.x;
      const dy = worldY - center.y;
      const diamondDistance = Math.abs(dx) / (tileW / 2) + Math.abs(dy) / (tileH / 2);
      if (diamondDistance <= 1 && diamondDistance < bestDistance) {
        best = tile;
        bestDistance = diamondDistance;
      }
    }
    return best;
  }

  private renderSnapshot(): void {
    if (!this.snapshot || !this.graphics) return;
    const g = this.graphics;
    g.clear();
    this.clearLabels();
    this.clearSprites();

    this.drawBasinBackdrop(g);
    for (const tile of this.snapshot.tiles) {
      this.drawTile(g, tile);
    }
    this.drawPipes(g);
    for (const tile of this.snapshot.tiles) {
      if (tile.structure) this.drawFacility(g, tile);
    }
    this.drawScoutReach(g);
    this.drawScouts(g);
    this.drawActionHint(g);
  }

  private drawBasinBackdrop(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xd8d0bd, 0.38);
    g.fillRoundedRect(-266, -150, 1872, 1180, 34);
    g.fillStyle(0xf1ebdc, 1);
    g.fillRoundedRect(-238, -128, 1816, 1128, 28);
    g.fillStyle(0xe7dfca, 0.72);
    g.fillRoundedRect(-196, -88, 1730, 1044, 20);
    g.lineStyle(2, 0xc6a24a, 0.28);
    g.strokeRoundedRect(-238, -128, 1816, 1128, 28);
    g.lineStyle(1, 0xf8f7f1, 0.72);
    g.lineBetween(-190, -70, 1520, -70);
    g.lineBetween(-190, 952, 1520, 952);
  }

  private drawTile(g: Phaser.GameObjects.Graphics, tile: BasinTile): void {
    const visible = tile.revealedBy.includes(this.playerID) || tile.structure?.owner === this.playerID;
    const colors = terrainColors[visible ? tile.terrain : "hidden"];
    const points = tileDiamond(tile);
    const selected = this.toolState.selectedTileId === tile.id;
    const staged = this.toolState.stagedTileId === tile.id;
    const hovered = this.hoverTileId === tile.id;
    const scoutReachable = this.toolState.mode === "scout" && this.canScoutMove(tile);

    const shadow = points.map((point) => new Phaser.Math.Vector2(point.x + 4, point.y + 6));
    g.fillStyle(0x6d6657, visible ? 0.09 : 0.05);
    g.fillPoints(shadow, true);

    g.fillStyle(colors.top, visible ? 1 : 0.58);
    g.fillPoints(points, true);
    g.lineStyle(1, colors.edge, visible ? 0.82 : 0.45);
    g.strokePoints(points, true);
    if (!tile.structure) {
      const drewAsset = this.drawTerrainAsset(tile, visible ? tile.terrain : "hidden", visible ? 0.9 : 0.5);
      if (!drewAsset && visible) this.drawTerrainMotif(g, tile);
    }

    if (!visible) {
      g.lineStyle(1, 0xf8f7f1, 0.22);
      g.lineBetween(points[0].x + 10, points[0].y + 5, points[2].x - 10, points[2].y - 5);
    }

    if (this.toolState.mode === "build" && visible) {
      const valid = this.canPreviewBuild(tile);
      const terrainMatch = this.canPreviewTerrain(tile);
      const empty = !tile.structure;
      if (empty && (valid || terrainMatch)) {
        g.fillStyle(valid ? 0x63afa8 : 0xc6a24a, valid ? 0.24 : 0.12);
        g.fillPoints(points, true);
        g.lineStyle(valid ? 3 : 2, valid ? 0x2d7fa3 : 0xc6a24a, valid ? 0.88 : 0.48);
        g.strokePoints(points, true);
        this.drawBuildMarker(g, tile, valid ? 0x2d7fa3 : 0xc6a24a, valid);
        if ((valid && hovered) || (!valid && (staged || hovered || selected))) {
          this.drawTileBadge(tile, valid ? "READY" : "TERRAIN", valid ? 0x2d7fa3 : 0xc6a24a);
        }
      } else if (empty) {
        g.fillStyle(0xc8706d, 0.08);
        g.fillPoints(points, true);
        if (selected || hovered) this.drawTileBadge(tile, this.buildBlocker(tile), 0xc8706d);
      }
    }

    if (scoutReachable) {
      g.fillStyle(0x2d7fa3, 0.18);
      g.fillPoints(points, true);
      g.lineStyle(3, 0x2d7fa3, 0.76);
      g.strokePoints(points, true);
      this.drawBuildMarker(g, tile, 0x2d7fa3, true);
      if (hovered || selected || staged) this.drawTileBadge(tile, "MOVE", 0x2d7fa3);
    } else if (this.toolState.mode === "scout" && visible && hovered) {
      this.drawTileBadge(tile, this.scoutBlocker(tile), 0xc8706d);
    }

    if (tile.hazard > 1 && visible) {
      const c = tileCenter(tile);
      g.fillStyle(0x67a85e, 0.8);
      g.fillTriangle(c.x + 18, c.y - 9, c.x + 28, c.y + 7, c.x + 8, c.y + 7);
      if (selected || hovered) {
        this.addLabel(String(tile.hazard), c.x + 18, c.y + 9, {
          backgroundColor: "#f8f7f1",
          color: "#2b5f48",
          fontSize: "10px",
          fontStyle: "900",
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5);
      }
    }

    if (hovered || selected || staged) {
      const pulse = staged ? 0.62 + Math.sin(this.time.now / 140) * 0.28 : 1;
      g.lineStyle(staged ? 4 : selected ? 3 : 2, staged ? 0x2d7fa3 : selected ? 0xc6a24a : 0xf8f7f1, staged ? pulse : selected ? 1 : 0.86);
      g.strokePoints(points, true);
    }
  }

  private drawPipes(g: Phaser.GameObjects.Graphics): void {
    if (!this.snapshot) return;
    const structures = this.snapshot.tiles.filter((tile) => tile.structure);
    for (const tile of structures) {
      const owner = tile.structure?.owner;
      if (!owner) continue;
      const from = tileCenter(tile);
      for (const other of structures) {
        if (other.id <= tile.id || other.structure?.owner !== owner) continue;
        const adjacent = Math.abs(other.x - tile.x) + Math.abs(other.y - tile.y) === 1;
        if (!adjacent) continue;
        const to = tileCenter(other);
        const ownerColor = ownerColors[Number(owner) % ownerColors.length];
        g.lineStyle(9, 0xf8f7f1, 0.32);
        g.lineBetween(from.x, from.y, to.x, to.y);
        g.lineStyle(6, 0x6f7780, 0.54);
        g.lineBetween(from.x, from.y, to.x, to.y);
        g.lineStyle(2, ownerColor, 0.82);
        g.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }

  private drawFacility(g: Phaser.GameObjects.Graphics, tile: BasinTile): void {
    if (!tile.structure || !this.snapshot) return;
    const visible = tile.revealedBy.includes(this.playerID) || tile.structure.owner === this.playerID;
    if (!visible) return;

    const center = tileCenter(tile);
    const ownerColor = ownerColors[Number(tile.structure.owner) % ownerColors.length];
    const selected = this.toolState.selectedTileId === tile.id;
    const hovered = this.hoverTileId === tile.id;
    const staged = this.toolState.stagedTileId === tile.id;
    const focused = selected || hovered || staged;

    if (focused) {
      g.lineStyle(staged ? 4 : 3, staged ? 0x2d7fa3 : 0xc6a24a, staged ? 0.88 : 0.82);
      g.strokeEllipse(center.x, center.y + 2, 74, 28);
    }

    g.fillStyle(0x20272b, 0.14);
    g.fillEllipse(center.x + 5, center.y + 18, 68, 18);

    g.fillStyle(ownerColor, 0.9);
    g.fillRoundedRect(center.x - 31, center.y - 16, 62, 31, 7);
    g.lineStyle(2, 0x20272b, 0.26);
    g.strokeRoundedRect(center.x - 31, center.y - 16, 62, 31, 7);
    g.fillStyle(0xf8f7f1, 1);
    g.fillRoundedRect(center.x - 25, center.y - 12, 50, 22, 5);
    g.lineStyle(3, ownerColor, 0.95);

    this.drawFacilityAsset(tile, center, focused);

    const fill = Phaser.Math.Clamp(tile.structure.waterStored / 12, 0, 1);
    g.fillStyle(0xf8f7f1, 0.94);
    g.fillRoundedRect(center.x - 25, center.y + 17, 50, 6, 3);
    g.fillStyle(0x63afa8, 0.94);
    g.fillRoundedRect(center.x - 25, center.y + 17, 50 * fill, 6, 3);
    g.lineStyle(1, 0x20272b, 0.2);
    g.strokeRoundedRect(center.x - 25, center.y + 17, 50, 6, 3);

    g.fillStyle(ownerColor, 1);
    g.fillCircle(center.x - 31, center.y - 18, 5);
    g.lineStyle(1, 0xf8f7f1, 0.86);
    g.strokeCircle(center.x - 31, center.y - 18, 5);

    if (focused) this.drawFacilityReadout(g, tile, center, ownerColor);
  }

  private drawScouts(g: Phaser.GameObjects.Graphics): void {
    if (!this.snapshot) return;
    for (const player of Object.values(this.snapshot.players)) {
      const tile = this.snapshot.tiles.find((candidate) => candidate.id === player.scoutTileId);
      if (!tile) continue;
      const visible = tile.revealedBy.includes(this.playerID) || player.id === this.playerID;
      if (!visible) continue;
      const center = tileCenter(tile);
      const color = ownerColors[Number(player.id) % ownerColors.length];
      const scoutX = center.x - 18;
      const scoutY = center.y - 19;

      g.fillStyle(0x20272b, 0.22);
      g.fillEllipse(scoutX + 3, scoutY + 20, 34, 11);
      g.lineStyle(player.id === this.playerID ? 4 : 2, player.id === this.playerID ? 0x2d7fa3 : color, player.id === this.playerID ? 0.88 : 0.62);
      g.strokeCircle(scoutX, scoutY, player.id === this.playerID ? 18 : 14);
      g.fillStyle(0xf8f7f1, 0.96);
      g.fillCircle(scoutX, scoutY, 12);
      g.lineStyle(3, color, 0.96);
      g.strokeCircle(scoutX, scoutY, 12);
      g.fillStyle(color, 1);
      g.fillCircle(scoutX, scoutY, 5);
      g.lineStyle(3, 0x20272b, 0.64);
      g.lineBetween(scoutX, scoutY + 12, scoutX, scoutY + 30);
      g.lineStyle(2, 0xc6a24a, 0.96);
      g.lineBetween(scoutX + 4, scoutY - 11, scoutX + 4, scoutY - 29);
      g.fillStyle(0xc6a24a, 0.96);
      g.fillTriangle(scoutX + 6, scoutY - 29, scoutX + 27, scoutY - 22, scoutX + 6, scoutY - 16);
      g.lineStyle(1, 0x7a5e13, 0.72);
      g.strokeTriangle(scoutX + 6, scoutY - 29, scoutX + 27, scoutY - 22, scoutX + 6, scoutY - 16);
      if (player.id === this.playerID) {
        for (let index = 0; index < 3; index += 1) {
          g.fillStyle(index < player.actionsRemaining ? 0xc6a24a : 0xf8f7f1, index < player.actionsRemaining ? 1 : 0.62);
          g.fillCircle(scoutX - 10 + index * 10, scoutY - 37, 4);
          g.lineStyle(1, 0x20272b, 0.38);
          g.strokeCircle(scoutX - 10 + index * 10, scoutY - 37, 4);
        }
      }
    }
  }

  private drawScoutReach(g: Phaser.GameObjects.Graphics): void {
    if (!this.snapshot) return;
    const player = this.snapshot.players[this.playerID];
    const current = player ? this.snapshot.tiles.find((candidate) => candidate.id === player.scoutTileId) : undefined;
    if (!player || !current) return;
    const shouldShow = this.toolState.mode === "scout" || this.toolState.stagedAction === "scout" || this.toolState.selectedTileId === current.id;
    if (!shouldShow) return;
    for (const tile of this.snapshot.tiles) {
      const adjacent = Math.abs(current.x - tile.x) + Math.abs(current.y - tile.y) === 1;
      if (!adjacent) continue;
      const points = tileDiamond(tile);
      g.fillStyle(0x2d7fa3, player.actionsRemaining > 0 ? 0.11 : 0.04);
      g.fillPoints(points, true);
      g.lineStyle(2, player.actionsRemaining > 0 ? 0x2d7fa3 : 0xb8ad99, player.actionsRemaining > 0 ? 0.42 : 0.24);
      g.strokePoints(points, true);
    }
  }

  private drawActionHint(g: Phaser.GameObjects.Graphics): void {
    if (!this.snapshot) return;
    const tile = this.snapshot.tiles.find((candidate) => candidate.id === (this.toolState.stagedTileId ?? this.toolState.selectedTileId));
    if (!tile) return;
    const center = tileCenter(tile);
    if (this.toolState.mode === "build") {
      const facility = facilities[this.toolState.facilityId];
      const cost = effectiveFacilityCost(this.snapshot, this.toolState.facilityId);
      const production = estimateProduction(this.snapshot, tile, this.toolState.facilityId);
      const impact = summarizeImpact(facility.impact);
      const ready = this.canPreviewBuild(tile);
      if (ready && this.toolState.stagedTileId) return;
      g.lineStyle(2, ready ? 0x2d7fa3 : 0xc8706d, 0.9);
      g.fillStyle(0xf8f7f1, 0.94);
      g.fillRoundedRect(center.x - 72, center.y - 78, 144, 33, 7);
      g.strokeRoundedRect(center.x - 72, center.y - 78, 144, 33, 7);
      this.addLabel(ready ? `${cost}CC  +${production}/pulse` : this.buildBlocker(tile), center.x, center.y - 68, {
        color: "#20272b",
        fontSize: "11px",
        fontStyle: "900",
      }).setOrigin(0.5);
      this.addLabel(impact || "clean placement", center.x, center.y - 54, {
        color: ready ? "#2d7fa3" : "#9a514c",
        fontSize: "10px",
        fontStyle: "800",
      }).setOrigin(0.5);
    } else if (this.toolState.mode === "scout") {
      const player = this.snapshot.players[this.playerID];
      g.lineStyle(2, 0x2d7fa3, 0.78);
      g.fillStyle(0xf8f7f1, 0.92);
      g.fillRoundedRect(center.x - 58, center.y - 70, 116, 26, 7);
      g.strokeRoundedRect(center.x - 58, center.y - 70, 116, 26, 7);
      this.addLabel(`${player?.actionsRemaining ?? 0}/3 scout`, center.x, center.y - 61, {
        color: "#20272b",
        fontSize: "11px",
        fontStyle: "900",
      }).setOrigin(0.5);
    }
  }

  private canPreviewBuild(tile: BasinTile): boolean {
    if (!this.snapshot) return false;
    const facility = facilities[this.toolState.facilityId];
    if (!facility) return false;
    if (!tile.revealedBy.includes(this.playerID)) return false;
    if (tile.structure) return false;
    if (!facility.validTerrains.includes(tile.terrain)) return false;
    return this.snapshot.tiles.some(
      (candidate) =>
        candidate.structure?.owner === this.playerID &&
        Math.abs(candidate.x - tile.x) + Math.abs(candidate.y - tile.y) === 1,
    );
  }

  private canPreviewTerrain(tile: BasinTile): boolean {
    const facility = facilities[this.toolState.facilityId];
    return Boolean(facility && tile.revealedBy.includes(this.playerID) && !tile.structure && facility.validTerrains.includes(tile.terrain));
  }

  private canScoutMove(tile: BasinTile): boolean {
    if (!this.snapshot) return false;
    const player = this.snapshot.players[this.playerID];
    const current = player ? this.snapshot.tiles.find((candidate) => candidate.id === player.scoutTileId) : undefined;
    if (!player || !current || player.actionsRemaining <= 0 || current.id === tile.id) return false;
    return Math.abs(current.x - tile.x) + Math.abs(current.y - tile.y) === 1;
  }

  private buildBlocker(tile: BasinTile): string {
    if (!this.snapshot) return "BLOCKED";
    const facility = facilities[this.toolState.facilityId];
    if (!tile.revealedBy.includes(this.playerID)) return "HIDDEN";
    if (tile.structure) return "OCCUPIED";
    if (!facility.validTerrains.includes(tile.terrain)) return "TERRAIN";
    if (!this.canPreviewBuild(tile)) return "ADJACENCY";
    return "BLOCKED";
  }

  private scoutBlocker(tile: BasinTile): string {
    if (!this.snapshot) return "BLOCKED";
    const player = this.snapshot.players[this.playerID];
    if (!player || player.actionsRemaining <= 0) return "NO MOVES";
    if (player.scoutTileId === tile.id) return "SCOUT";
    return "1 TILE";
  }

  private drawTerrainAsset(tile: BasinTile, terrain: Terrain | "hidden", alpha: number): boolean {
    const textureKey = terrainTextureKeys[terrain];
    if (!this.textures.exists(textureKey)) return false;
    const center = tileCenter(tile);
    const sprite = this.add.image(center.x, center.y, textureKey);
    sprite.setDepth(1);
    sprite.setAlpha(alpha);
    this.sprites.push(sprite);
    return true;
  }

  private drawFacilityAsset(tile: BasinTile, center: { x: number; y: number }, focused: boolean): boolean {
    if (!tile.structure) return false;
    const textureKey = facilityTextureKeys[tile.structure.facilityId];
    if (!this.textures.exists(textureKey)) return false;
    const sprite = this.add.image(center.x, center.y - 27, textureKey);
    sprite.setDepth(5);
    sprite.setScale(focused ? 0.66 : 0.6);
    this.sprites.push(sprite);
    return true;
  }

  private drawTerrainMotif(g: Phaser.GameObjects.Graphics, tile: BasinTile): void {
    const center = tileCenter(tile);
    g.lineStyle(2, terrainColors[tile.terrain].edge, 0.26);
    if (tile.terrain === "coast") {
      g.beginPath();
      g.arc(center.x - 10, center.y - 2, 9, Math.PI * 0.08, Math.PI * 0.82);
      g.strokePath();
      g.beginPath();
      g.arc(center.x + 8, center.y + 4, 9, Math.PI * 1.08, Math.PI * 1.82);
      g.strokePath();
    } else if (tile.terrain === "aquifer") {
      g.strokeEllipse(center.x, center.y, 26, 11);
      g.fillStyle(0xf8f7f1, 0.32);
      g.fillEllipse(center.x, center.y, 13, 5);
    } else if (tile.terrain === "fog") {
      g.lineBetween(center.x - 22, center.y - 3, center.x + 8, center.y - 3);
      g.lineBetween(center.x - 8, center.y + 5, center.x + 22, center.y + 5);
    } else if (tile.terrain === "ridge") {
      g.lineBetween(center.x - 18, center.y + 7, center.x, center.y - 9);
      g.lineBetween(center.x, center.y - 9, center.x + 18, center.y + 7);
    } else if (tile.terrain === "scrub") {
      g.fillStyle(0x8fa069, 0.34);
      g.fillTriangle(center.x - 12, center.y + 8, center.x - 2, center.y - 9, center.x + 8, center.y + 8);
    } else if (tile.terrain === "ruins") {
      g.strokeRect(center.x - 12, center.y - 7, 24, 14);
      g.lineBetween(center.x - 12, center.y + 2, center.x + 12, center.y - 6);
    } else if (tile.terrain === "sink") {
      g.strokeEllipse(center.x, center.y, 28, 13);
      g.lineStyle(1, terrainColors[tile.terrain].edge, 0.22);
      g.strokeEllipse(center.x, center.y, 16, 7);
    }
  }

  private drawBuildMarker(g: Phaser.GameObjects.Graphics, tile: BasinTile, color: number, strong: boolean): void {
    const center = tileCenter(tile);
    g.fillStyle(color, strong ? 0.92 : 0.54);
    g.fillCircle(center.x, center.y + 15, strong ? 4.5 : 3.5);
    g.lineStyle(1, 0xf8f7f1, strong ? 0.94 : 0.6);
    g.strokeCircle(center.x, center.y + 15, strong ? 4.5 : 3.5);
  }

  private drawFacilityReadout(g: Phaser.GameObjects.Graphics, tile: BasinTile, center: { x: number; y: number }, ownerColor: number): void {
    if (!tile.structure || !this.snapshot) return;
    const produced = estimateProduction(this.snapshot, tile, tile.structure.facilityId);
    g.fillStyle(0xf8f7f1, 0.96);
    g.fillRoundedRect(center.x - 48, center.y - 58, 96, 24, 7);
    g.lineStyle(2, ownerColor, 0.78);
    g.strokeRoundedRect(center.x - 48, center.y - 58, 96, 24, 7);
    this.addLabel(`+${produced} / ${tile.structure.waterStored}W`, center.x, center.y - 49, {
      color: "#20272b",
      fontSize: "11px",
      fontStyle: "900",
    }).setOrigin(0.5);
  }

  private drawTileBadge(tile: BasinTile, text: string, color: number): void {
    const center = tileCenter(tile);
    gBadge(this.graphics, center.x, center.y + 20, text, color);
    this.addLabel(text, center.x, center.y + 20, {
      color: "#f8f7f1",
      fontSize: "9px",
      fontStyle: "900",
    }).setOrigin(0.5);
  }

  private addLabel(
    text: string,
    x: number,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, {
      fontFamily: "Inter, Arial, sans-serif",
      resolution: 2,
      ...style,
    });
    label.setDepth(10);
    this.labels.push(label);
    return label;
  }

  private clearLabels(): void {
    for (const label of this.labels) label.destroy();
    this.labels = [];
  }

  private clearSprites(): void {
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites = [];
  }

  private centerCameraOnTile(tileId: string): void {
    if (!this.snapshot || !this.cameras?.main) return;
    const tile = this.snapshot.tiles.find((candidate) => candidate.id === tileId);
    if (!tile) return;
    const center = tileCenter(tile);
    this.cameras.main.centerOn(center.x, center.y - 20);
  }
}

function tileCenter(tile: BasinTile): { x: number; y: number } {
  return {
    x: originX + (tile.x - tile.y) * (tileW / 2),
    y: originY + (tile.x + tile.y) * (tileH / 2),
  };
}

function tileDiamond(tile: BasinTile): Phaser.Math.Vector2[] {
  const center = tileCenter(tile);
  return [
    new Phaser.Math.Vector2(center.x, center.y - tileH / 2),
    new Phaser.Math.Vector2(center.x + tileW / 2, center.y),
    new Phaser.Math.Vector2(center.x, center.y + tileH / 2),
    new Phaser.Math.Vector2(center.x - tileW / 2, center.y),
  ];
}

function gBadge(g: Phaser.GameObjects.Graphics | undefined, x: number, y: number, text: string, color: number, width?: number, height?: number): void {
  if (!g) return;
  const w = width ?? Math.max(34, text.length * 6 + 12);
  const h = height ?? 17;
  g.fillStyle(color, 0.94);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 5);
  g.lineStyle(1, 0xf8f7f1, 0.8);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 5);
}

function effectiveFacilityCost(snapshot: BasinRunState, facilityId: FacilityId): number {
  return Math.max(1, facilities[facilityId].cost + snapshot.civic.policies.permitFriction - snapshot.civic.policies.subsidyLevel);
}

function estimateProduction(snapshot: BasinRunState, tile: BasinTile, facilityId: FacilityId): number {
  const facility = facilities[facilityId];
  let produced = Math.max(1, Math.ceil((facility.output + Math.max(0, tile.richness - 2)) / 2));
  if (snapshot.activeEvents.includes("aquifer-collapse") && facility.tags.includes("WELL")) produced = Math.max(1, produced - 1);
  if (snapshot.activeEvents.includes("heatwave-frenzy")) produced = Math.max(0, produced - 1);
  return produced;
}

function summarizeImpact(impact: ImpactProfile): string {
  return trackKeys
    .map((key) => {
      const value = impact[key] ?? 0;
      return value ? `+${value} ${trackLabels[key].short}` : undefined;
    })
    .filter(Boolean)
    .join(", ");
}
