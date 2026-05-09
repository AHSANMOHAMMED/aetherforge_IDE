import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../audit.js';
import { getPrisma } from '../db.js';
import { presignPut } from '../r2.js';

type SyncFile = { path: string; sha256: string; bytes: number };

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/sync/manifest', async (req) => {
    const body = (req.body ?? {}) as { workspaceId?: string; files?: SyncFile[] };
    const workspaceId = body.workspaceId ?? 'unknown';
    const files = Array.isArray(body.files) ? body.files : [];

    const presigned = files.map((file) => ({
      ...presignPut(`${workspaceId}/${file.path}`),
      sha256: file.sha256,
      bytes: file.bytes
    }));

    const prisma = await getPrisma();
    if (prisma) {
      try {
        for (const file of files) {
          await prisma.usageRow.create({
            data: {
              userId: req.userId ?? 'anonymous',
              feature: 'sync.manifest',
              tokensIn: 0,
              tokensOut: 0,
              costUsd: 0
            }
          });
        }
      } catch (err) {
        req.log.warn({ err }, 'sync manifest persistence failed');
      }
    }

    await recordAudit({
      userId: req.userId,
      action: 'sync.manifest.received',
      resourceType: 'workspace',
      resourceId: workspaceId,
      metadata: { files: files.length }
    });

    return { ok: true, acceptedFiles: files.length, uploadUrls: presigned };
  });

  app.post('/v1/sync/conflicts', async () => ({ ok: true, conflicts: [] }));
}
