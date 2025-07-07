// This client-side module simply re-exports the WaterBaronsGame definition generated on the server.
// It is bundled as an ES module so that the browser (via Skypack) can import it.
// The server and client share the same rules but are loaded from different files to avoid filesystem access in the browser.

export const WaterBaronsGame = {
  name: 'water-barons',

  setup: () => {
    // The browser cannot load TOML from the filesystem, so we hard-code a very small state.
    // The authoritative state lives on the server; the client only needs shapes for the UI.
    return {
      round: 1,
      players: {
        0: { credCoin: 5, reputation: 0, facilities: [] },
        1: { credCoin: 5, reputation: 0, facilities: [] },
      },
      log: [],
    };
  },

  moves: {
    buildFacility: () => {}, // noop on client; real logic runs on server
  },
};