import { getPrisma } from './db.js';

export type AuditEvent = {
  userId?: string;
  orgId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Persist an audit event when Prisma is available. Falls back to a structured console log so the
 * audit trail is captured by container log shippers in environments without a database.
 */
export async function recordAudit(event: AuditEvent): Promise<void> {
  const prisma = await getPrisma();
  if (prisma) {
    try {
      const metadata =
        event.metadata || event.resourceType || event.resourceId
          ? { ...(event.metadata ?? {}), resourceType: event.resourceType, resourceId: event.resourceId }
          : undefined;
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          orgId: event.orgId,
          action: event.action,
          metadata: metadata ?? undefined
        }
      });
      return;
    } catch (err) {
      console.warn('[backend] audit Prisma write failed; logging to stdout.', (err as Error).message);
    }
  }
  console.log('[audit]', JSON.stringify({ ts: new Date().toISOString(), ...event }));
}
