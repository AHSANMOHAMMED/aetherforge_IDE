import type {
  PluginManifestRaw,
  PluginAPI,
  RegisteredCommand,
  RegisteredView,
  Disposable,
  PluginCanvasNode
} from './types';
import { usePluginRegistry } from './registry';
import { useToastStore } from '../state/toast-store';
import { useCanvasStore } from '../canvas/store';
import { useAppStore } from '../state/app-store';
import type { CanvasComponentType } from '../canvas/types';

/**
 * Creates a scoped PluginAPI object for a single plugin instance.
 * The returned API is passed as `aetherforgeAPI` into the plugin's activate() function.
 */
export function createPluginAPI(manifest: PluginManifestRaw): PluginAPI {
  const pluginId = manifest.id;
  const registry = usePluginRegistry.getState();

  const commands: PluginAPI['commands'] = {
    register: (id, handler): Disposable => {
      const title = manifest.contributes?.commands?.find((c) => c.id === id)?.title ?? id;

      const cmd: RegisteredCommand = { id, title, pluginId, handler };
      usePluginRegistry.getState().registerCommand(cmd);

      return () => {
        usePluginRegistry.setState((state) => ({
          commands: state.commands.filter((c) => !(c.id === id && c.pluginId === pluginId))
        }));
      };
    },

    execute: async (id) => {
      const cmd = usePluginRegistry.getState().commands.find((c) => c.id === id);
      if (cmd) {
        await Promise.resolve(cmd.handler());
      }
    }
  };

  const workspace: PluginAPI['workspace'] = {
    readFile: async (filePath) => {
      const result = await window.electronAPI.readFile(filePath);
      return result.content;
    },

    writeFile: async (filePath, content) => {
      await window.electronAPI.writeFile({ path: filePath, content });
    },

    getWorkspacePath: () => {
      return useAppStore.getState().workspacePath;
    }
  };

  const views: PluginAPI['views'] = {
    registerView: (id, title, location = 'main'): Disposable => {
      const view: RegisteredView = { id, title, pluginId, location };
      usePluginRegistry.getState().registerView(view);

      return () => {
        usePluginRegistry.setState((state) => ({
          views: state.views.filter((v) => !(v.id === id && v.pluginId === pluginId))
        }));
      };
    }
  };

  const toast: PluginAPI['toast'] = {
    show: (message, level = 'info') => {
      useToastStore.getState().pushToast({ title: message, level });
    }
  };

  const canvas: PluginAPI['canvas'] = {
    getNodes: (): PluginCanvasNode[] => {
      return useCanvasStore.getState().nodes.map((n) => ({
        id: n.id,
        componentType: n.data.componentType,
        label: n.data.label,
        x: n.position.x,
        y: n.position.y,
        props: n.data.props as Record<string, unknown>
      }));
    },

    addNode: (node: PluginCanvasNode) => {
      const knownTypes: CanvasComponentType[] = ['button', 'container', 'text', 'image', 'card'];
      const componentType: CanvasComponentType = knownTypes.includes(
        node.componentType as CanvasComponentType
      )
        ? (node.componentType as CanvasComponentType)
        : 'container';

      useCanvasStore.getState().addNodeFromPalette(componentType, {
        x: node.x,
        y: node.y
      });

      // After addNodeFromPalette the new node is selected; update its label/props
      const nodes = useCanvasStore.getState().nodes;
      const latest = nodes[nodes.length - 1];
      if (latest) {
        useCanvasStore
          .getState()
          .updateSelectedNode(
            { text: node.label, ...(node.props as Record<string, unknown> & { text?: string }) },
            node.label
          );
      }
    }
  };

  // Suppress unused variable warning — registry was read for potential future use
  void registry;

  return { commands, workspace, views, toast, canvas };
}

/**
 * Removes all commands and views registered by a given plugin.
 */
export function disposePlugin(pluginId: string): void {
  void window.electronAPI?.extHostStop?.({ pluginId });
  usePluginRegistry.getState().unregisterPlugin(pluginId);
}
