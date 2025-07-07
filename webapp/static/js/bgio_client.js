document.addEventListener('DOMContentLoaded', () => {
  const { Client, SocketIO } = window.BoardgameIO || {};
  if (!Client) {
    document.getElementById('content').textContent = 'Boardgame.io client not loaded.';
    return;
  }

  const serverUrl = window.location.origin.replace(/:\d+$/, ':8000');

  const GameClient = Client({
    game: {},
    multiplayer: SocketIO({ server: serverUrl }),
    debug: false,
  });

  const client = new GameClient({ playerID: '0' });
  client.start();

  client.subscribe(state => {
    const el = document.getElementById('content');
    if (state && state.G && state.G.data) {
      const count = state.G.data.facilities ? state.G.data.facilities.length : 0;
      el.textContent = `Loaded ${count} facilities from TOML`;
    } else {
      el.textContent = 'Connected to game server.';
    }
  });
});
