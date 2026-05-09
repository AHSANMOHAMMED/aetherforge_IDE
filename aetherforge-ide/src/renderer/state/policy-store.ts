import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Org / device policy. Air-gap, provider/model/plugin allowlists.
 * V3: hydrate from `GET /v1/org/:orgId/policy` on startup; until then we
 * persist locally so air-gap toggling works offline.
 */

export type OrgPolicy = {
  airGap: boolean;
  providerAllow: string[];
  modelAllow: string[];
  pluginAllow: string[];
};

interface PolicyState {
  policy: OrgPolicy;
  setAirGap: (enabled: boolean) => void;
  setProviderAllow: (providers: string[]) => void;
  setModelAllow: (models: string[]) => void;
  setPluginAllow: (plugins: string[]) => void;
  applyRemote: (policy: OrgPolicy) => void;
}

const DEFAULT_POLICY: OrgPolicy = {
  airGap: false,
  providerAllow: [],
  modelAllow: [],
  pluginAllow: []
};

export const usePolicyStore = create<PolicyState>()(
  persist(
    (set) => ({
      policy: DEFAULT_POLICY,
      setAirGap: (enabled) =>
        set((state) => {
          if (typeof window !== 'undefined') {
            (window as unknown as { __AETHERFORGE_AIRGAP__?: boolean }).__AETHERFORGE_AIRGAP__ = enabled;
          }
          return { policy: { ...state.policy, airGap: enabled } };
        }),
      setProviderAllow: (providerAllow) => set((state) => ({ policy: { ...state.policy, providerAllow } })),
      setModelAllow: (modelAllow) => set((state) => ({ policy: { ...state.policy, modelAllow } })),
      setPluginAllow: (pluginAllow) => set((state) => ({ policy: { ...state.policy, pluginAllow } })),
      applyRemote: (policy) => {
        if (typeof window !== 'undefined') {
          (window as unknown as { __AETHERFORGE_AIRGAP__?: boolean }).__AETHERFORGE_AIRGAP__ = policy.airGap;
        }
        set({ policy });
      }
    }),
    { name: 'aetherforge.policy.v1' }
  )
);
