/**
 * Lazy Prisma client wrapper.
 *
 * `npm install` may not have generated `@prisma/client` in some environments (CI bootstrap, sandbox
 * runs). Importing the package eagerly would throw `Cannot find module`. This wrapper:
 *
 *   - Returns a `PrismaClient` instance when `DATABASE_URL` is set AND the package can be loaded.
 *   - Returns `null` otherwise so route handlers fall back to in-memory shims.
 */

type PrismaModule = {
  PrismaClient: new (config?: Record<string, unknown>) => PrismaClient;
};

export type PrismaClient = {
  $disconnect: () => Promise<void>;
  orgPolicy: {
    findUnique: (args: { where: { orgId: string } }) => Promise<unknown>;
    upsert: (args: { where: { orgId: string }; create: unknown; update: unknown }) => Promise<unknown>;
  };
  aiRun: {
    create: (args: { data: unknown }) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
  usageRow: {
    create: (args: { data: unknown }) => Promise<unknown>;
    aggregate: (args: unknown) => Promise<unknown>;
  };
  auditLog: {
    create: (args: { data: unknown }) => Promise<unknown>;
  };
  apiKey: {
    create: (args: { data: unknown }) => Promise<unknown>;
  };
  syncBlob: {
    create: (args: { data: unknown }) => Promise<unknown>;
    upsert: (args: { where: unknown; create: unknown; update: unknown }) => Promise<unknown>;
  };
  subscription: {
    upsert: (args: { where: unknown; create: unknown; update: unknown }) => Promise<unknown>;
    update: (args: { where: unknown; data: unknown }) => Promise<unknown>;
  };
  user: {
    update: (args: { where: unknown; data: unknown }) => Promise<unknown>;
  };
};

let cached: PrismaClient | null | undefined;

export async function getPrisma(): Promise<PrismaClient | null> {
  if (cached !== undefined) {
    return cached;
  }
  if (!process.env.DATABASE_URL) {
    cached = null;
    return cached;
  }
  try {
    const moduleId = '@prisma/client';
    const mod = (await import(/* @vite-ignore */ moduleId)) as unknown as PrismaModule;
    cached = new mod.PrismaClient();
    return cached;
  } catch (err) {
    console.warn(
      '[backend] Prisma client unavailable; running with in-memory shims.',
      (err as Error).message
    );
    cached = null;
    return cached;
  }
}

export async function closePrisma(): Promise<void> {
  if (cached) {
    await cached.$disconnect();
    cached = undefined;
  }
}
