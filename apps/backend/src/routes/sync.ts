import type { FastifyInstance } from 'fastify';
import { requireAuthPreHandler } from '../auth.js';
import { recordAudit } from '../audit.js';
import { getPrisma } from '../db.js';
import { presignPut } from '../r2.js';

type SyncFile = { path: string; sha256: string; bytes: number };

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/sync/manifest', { preHandler: requireAuthPreHandler }, async (req) => {
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
              userId: req.userId!,
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

  app.post('/v1/sync/blob-confirm', { preHandler: requireAuthPreHandler }, async (req, reply) => {
    const body = (req.body ?? {}) as {
      workspaceId?: string;
      path?: string;
      sha256?: string;
      bytes?: number;
    };
    if (!body.workspaceId || !body.path || !body.sha256 || typeof body.bytes !== 'number') {
      reply.code(400);
      return { ok: false, error: 'workspaceId, path, sha256, bytes required' };
    }

    const prisma = await getPrisma();
    if (prisma?.syncBlob) {
      try {
        await prisma.syncBlob.upsert({
          where: {
            workspaceId_path: { workspaceId: body.workspaceId, path: body.path }
          },
          create: {
            workspaceId: body.workspaceId,
            path: body.path,
            sha256: body.sha256,
            bytes: body.bytes,
            encrypted: false
          },
          update: {
            sha256: body.sha256,
            bytes: body.bytes,
            uploadedAt: new Date()
          }
        });
      } catch (err) {
        req.log.warn({ err }, 'syncBlob upsert failed');
      }
    }

    await recordAudit({
      userId: req.userId,
      action: 'sync.blob.confirmed',
      resourceType: 'workspace',
      resourceId: body.workspaceId,
      metadata: { path: body.path }
    });

    return { ok: true };
  });

  app.post('/v1/sync/conflicts', { preHandler: requireAuthPreHandler }, async () => ({
    ok: true,
    conflicts: [] as unknown[]
  }));
}
