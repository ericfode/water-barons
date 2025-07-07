const path = require('path');
const fs = require('fs');
const express = require('express');
const toml = require('toml');
const { Server } = require('boardgame.io/server');

const contentPath = path.join(__dirname, '../water_barons/game_content.toml');
const gameData = toml.parse(fs.readFileSync(contentPath, 'utf-8'));

const WaterBaronsGame = {
  name: 'water-barons',
  setup: ctx => ({
    data: gameData,
    players: Array.from({ length: ctx.numPlayers }, (_, i) => ({ name: `Player ${i+1}` }))
  }),
  moves: {
    endTurn: (G, ctx) => ctx.events.endTurn(),
  },
};

const gameServer = Server({ games: [WaterBaronsGame], origins: ['*'] });

const app = express();
app.use('/static', express.static(path.join(__dirname, 'static')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

const gamePort = process.env.GAME_PORT || 8000;
const webPort = process.env.PORT || 8080;

gameServer.run({ port: gamePort }, () => {
  console.log(`Game server running on ${gamePort}`);
});

app.listen(webPort, () => {
  console.log(`Web server running on ${webPort}`);
});
