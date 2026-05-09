import * as Comlink from 'comlink';

type PluginModule = {
  activate?: (api: unknown) => void | Promise<void>;
};

Comlink.expose({
  async activate(source: string, api: unknown): Promise<void> {
    const mod: { exports: PluginModule } = { exports: {} };

    const factory = new Function('module', 'exports', 'aetherforgeAPI', source) as (
      m: typeof mod,
      e: PluginModule,
      a: unknown
    ) => void;
    factory(mod, mod.exports, api);
    if (typeof mod.exports.activate === 'function') {
      await Promise.resolve(mod.exports.activate(api));
    }
  }
});
