import { rngFromSeed } from "./rng";
import type { BasinTile, Terrain } from "./types";

const width = 18;
const height = 12;

export const mapSize = { width, height };

export function tileId(x: number, y: number): string {
  return `${x}:${y}`;
}

export function distance(a: BasinTile, b: BasinTile): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function neighbors(tile: BasinTile, tiles: BasinTile[]): BasinTile[] {
  return tiles.filter((candidate) => distance(tile, candidate) === 1);
}

export function getTile(tiles: BasinTile[], id: string): BasinTile | undefined {
  return tiles.find((tile) => tile.id === id);
}

export function hqStartTiles(numPlayers: number): string[] {
  const starts = [
    tileId(1, 1),
    tileId(width - 2, height - 2),
    tileId(1, height - 2),
    tileId(width - 2, 1),
  ];
  return starts.slice(0, numPlayers);
}

export function revealAround(tiles: BasinTile[], playerID: string, centerId: string, radius = 1): void {
  const center = getTile(tiles, centerId);
  if (!center) return;
  for (const tile of tiles) {
    if (Math.abs(tile.x - center.x) + Math.abs(tile.y - center.y) <= radius) {
      if (!tile.revealedBy.includes(playerID)) {
        tile.revealedBy.push(playerID);
      }
    }
  }
}

export function generateBasin(seed: string, numPlayers: number): BasinTile[] {
  const rng = rngFromSeed(seed);
  const tiles: BasinTile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / (width - 1);
      const ny = y / (height - 1);
      const roll = rng();
      let terrain: Terrain = "scrub";

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        terrain = "coast";
      } else if (Math.abs(nx - 0.5) + Math.abs(ny - 0.45) < 0.24 && roll > 0.25) {
        terrain = "sink";
      } else if (roll < 0.13) {
        terrain = "aquifer";
      } else if (roll < 0.25) {
        terrain = "fog";
      } else if (roll < 0.37) {
        terrain = "ridge";
      } else if (roll > 0.91) {
        terrain = "ruins";
      }

      tiles.push({
        id: tileId(x, y),
        x,
        y,
        terrain,
        revealedBy: [],
        hazard: Math.floor(rng() * 3),
        richness: 1 + Math.floor(rng() * 3),
      });
    }
  }

  hqStartTiles(numPlayers).forEach((startId, index) => {
    const playerID = String(index);
    revealAround(tiles, playerID, startId, 2);
    const startTile = getTile(tiles, startId);
    if (startTile) {
      startTile.terrain = "ruins";
    }
  });

  return tiles;
}
