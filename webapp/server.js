// BoardGame.io server for Water Barons
// Run with: npm start (from webapp directory)

import { Server } from 'boardgame.io/server';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WaterBaronsGame } from './game/WaterBaronsGame.js';

// Resolve directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

// Create the boardgame.io server instance
const server = Server({
  games: [WaterBaronsGame],
  // Optional: origins: ["*"], // allow all CORS during development
});

// Expose the underlying Express app so we can serve static assets
const app = server.app;
app.use(express.static(path.join(__dirname, 'client')));

server.run(PORT, () => {
  /* eslint-disable no-console */
  console.log(`Water Barons boardgame.io server running on http://localhost:${PORT}/`);
});