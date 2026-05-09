'use strict';
/**
 * Utility-process plugin bootstrap: evaluates the plugin bundle with a stub API.
 * Full PluginAPI (workspace, canvas, …) requires renderer round-trip; default path
 * uses the Web Worker host instead.
 */
const fs = require('fs');

const bundlePath = process.argv[2];
if (!bundlePath) {
  console.error('[aetherforge-exthost] missing bundle path argv[2]');
  process.exit(1);
}

const source = fs.readFileSync(bundlePath, 'utf8');
const mod = { exports: {} };
const api = {
  commands: {
    register: () => ({ dispose: () => {} })
  },
  workspace: {
    readFile: async () => '',
    writeFile: async () => {},
    getWorkspacePath: () => null
  },
  views: {
    registerView: () => ({ dispose: () => {} })
  },
  toast: {
    show: () => {}
  },
  canvas: {
    getNodes: () => [],
    addNode: () => {}
  }
};

const factory = new Function('module', 'exports', 'aetherforgeAPI', source);
factory(mod, mod.exports, api);

const act = mod.exports.activate;
if (typeof act === 'function') {
  Promise.resolve(act(api)).catch((err) => {
    console.error('[aetherforge-exthost] activate failed', err);
    process.exit(1);
  });
}
