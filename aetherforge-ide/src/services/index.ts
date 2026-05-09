export type ServiceHealth = {
  name: string;
  healthy: boolean;
};

export const coreServices: ServiceHealth[] = [];

export * from './file.service';
export * from './workspace.service';
