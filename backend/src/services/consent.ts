import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { consentRecords } from '../db/schema.js';
import type { Request } from 'express';

interface ConsentInput {
  userId: string;
  type: 'terms' | 'privacy' | 'cookies' | 'marketing';
  version?: string;
  granted?: boolean;
  req?: Request;
}

export async function recordConsent(input: ConsentInput) {
  const [record] = await db
    .insert(consentRecords)
    .values({
      userId: input.userId,
      type: input.type,
      version: input.version ?? '1.0',
      ipAddress: input.req?.ip ?? input.req?.socket.remoteAddress ?? null,
      userAgent: input.req?.headers['user-agent'] ?? null,
      granted: input.granted ?? true,
    })
    .returning();
  return record;
}

export async function getConsentHistory(userId: string) {
  return db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(consentRecords.createdAt);
}
