// WaterBaronsGame.js
// A minimal boardgame.io implementation that bootstraps the game using TOML metadata.

import fs from 'fs';
import path from 'path';
import toml from 'toml';
import { INVALID_MOVE } from 'boardgame.io/core';
import { fileURLToPath } from 'url';

// Resolve directory paths when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to synchronously load & parse a TOML file relative to the repo root
function loadToml(relativePath) {
  const abs = path.resolve(__dirname, '../../', relativePath);
  const raw = fs.readFileSync(abs, 'utf-8');
  return toml.parse(raw);
}

const metadata = loadToml('water_barons/game_metadata.toml');
const content = loadToml('water_barons/game_content.toml');

// Transform TOML structures into more convenient maps/arrays for gameplay
function createDeck(tomlArray) {
  const deck = [];
  tomlArray.forEach((entry) => {
    // Most cards have a `copies` field. Push that many copies into the deck.
    const copies = entry.copies && Number.isFinite(entry.copies) ? entry.copies : 1;
    for (let i = 0; i < copies; i += 1) {
      // Shallow copy to avoid shared references
      deck.push({ ...entry });
    }
  });
  return deck;
}

const facilityDeck = createDeck(content.facilities || []);
const distributionDeck = createDeck(content.distributions || []);
const whimDeck = createDeck(content.whims || []);
const upgradesDeck = createDeck(content.upgrades || []);

export const WaterBaronsGame = {
  name: 'water-barons',

  setup: (ctx) => {
    // Create initial player state.
    const players = {};
    for (let i = 0; i < ctx.numPlayers; i += 1) {
      players[i] = {
        credCoin: 5,
        reputation: 0,
        facilities: [],
        distribution: [],
      };
    }

    return {
      round: 1,
      players,
      demandSegments: metadata.demand_segments || [],
      impactTracks: metadata.impact_tracks || [],
      decks: {
        facilities: [...facilityDeck],
        distributions: [...distributionDeck],
        whims: [...whimDeck],
        upgrades: [...upgradesDeck],
      },
      log: [],
    };
  },

  moves: {
    buildFacility: (G, ctx, facilityName) => {
      // Draw a facility card with matching name from the deck.
      const deckIdx = G.decks.facilities.findIndex((c) => c.name === facilityName);
      if (deckIdx === -1) return INVALID_MOVE;
      const card = G.decks.facilities.splice(deckIdx, 1)[0];

      // Pay cost (not yet enforced) and add to player area
      const player = G.players[ctx.currentPlayer];
      player.facilities.push(card);

      G.log.push(`${ctx.currentPlayer} built ${facilityName}`);
    },
  },

  endTurnIf: (G, ctx) => {
    // Simple example: each player gets 1 move per turn.
    return true;
  },
};