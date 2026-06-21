import { eq, and, sql, desc, inArray, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, events, gifts, cashFunds, emailTracking } from '../db/schema.js';
import { config } from '../config.js';
import { sendReminderEmail, sendRawEmail, isEmailConfigured } from './email.js';

function getBaseUrl(): string {
  return config.FRONTEND_URL;
}

const BATCH_SIZE = 50;
const MAX_BATCHES = 10;
const MICRO_BATCH_SIZE = 10;
const MICRO_BATCH_DELAY_MS = 1000;
const MAX_EXECUTION_TIME_MS = 120_000;

async function loadSentMap(userIds: string[]): Promise<Map<string, Set<string>>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(emailTracking)
    .where(inArray(emailTracking.userId, userIds));
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!map.has(row.userId)) map.set(row.userId, new Set());
    map.get(row.userId)!.add(row.type);
  }
  return map;
}

async function markEmailSentBatch(records: { userId: string; type: string }[]): Promise<void> {
  if (records.length === 0) return;
  try {
    await db.insert(emailTracking).values(records.map(r => ({ userId: r.userId, type: r.type })));
  } catch (err: unknown) {
    const pgErr = err as { code?: string } | null;
    if (pgErr?.code !== '23505') {
      console.error('[EmailSeq] Error marcando email como enviado:', err);
      throw err;
    }
  }
}

export async function processEmailSequence(): Promise<{ processed: number }> {
  const startTime = Date.now();
  let processed = 0;
  const now = new Date();

  let minCreatedAt: Date | null = null;
  let batchCount = 0;

  while (batchCount < MAX_BATCHES) {
    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
      console.log(`[EmailSeq] Tiempo máximo de ejecución alcanzado (${MAX_EXECUTION_TIME_MS}ms). Abortando.`);
      break;
    }

    batchCount++;
    const condition: SQL | undefined = minCreatedAt
      ? and(eq(users.emailVerified, true), sql`${users.createdAt} > ${minCreatedAt}`)
      : eq(users.emailVerified, true);

    const rows: { id: string; email: string; name: string; tier: string; createdAt: Date }[] = await db
      .select({ id: users.id, email: users.email, name: users.name, tier: users.tier, createdAt: users.createdAt })
      .from(users)
      .where(condition)
      .orderBy(users.createdAt)
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    const userIds = rows.map(u => u.id);

    const [userEvents, sentMap] = await Promise.all([
      db
        .select({ id: events.id, userId: events.userId, title: events.title, slug: events.slug, createdAt: events.createdAt })
        .from(events)
        .where(inArray(events.userId, userIds))
        .orderBy(desc(events.createdAt)),
      loadSentMap(userIds),
    ]);

    const eventsByUser = new Map<string, typeof userEvents>();
    for (const ev of userEvents) {
      if (!eventsByUser.has(ev.userId)) eventsByUser.set(ev.userId, []);
      eventsByUser.get(ev.userId)!.push(ev);
    }

    const eventIds = userEvents.map(e => e.id);
    const [giftCounts, cashFundCounts] = await Promise.all([
      eventIds.length > 0
        ? db
            .select({
              eventId: gifts.eventId,
              count: sql<number>`count(*)::int`,
            })
            .from(gifts)
            .where(and(inArray(gifts.eventId, eventIds), eq(gifts.isClaimed, false)))
            .groupBy(gifts.eventId)
        : Promise.resolve([] as { eventId: string; count: number }[]),
      eventIds.length > 0
        ? db
            .select({ eventId: cashFunds.eventId })
            .from(cashFunds)
            .where(inArray(cashFunds.eventId, eventIds))
        : Promise.resolve([] as { eventId: string }[]),
    ]);

    const unclaimedGiftMap = new Map(giftCounts.map(g => [g.eventId, g.count]));

    const hasCashFundSet = new Set(cashFundCounts.map(c => c.eventId));

    const markBatch: { userId: string; type: string }[] = [];

    for (let i = 0; i < rows.length; i += MICRO_BATCH_SIZE) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log(`[EmailSeq] Tiempo máximo de ejecución alcanzado durante micro-batch. Abortando.`);
        break;
      }

      const microBatch = rows.slice(i, i + MICRO_BATCH_SIZE);

      for (const user of microBatch) {
        const userEvs = eventsByUser.get(user.id) ?? [];
        const userAge = now.getTime() - new Date(user.createdAt).getTime();
        const daysSinceRegistration = Math.floor(userAge / (24 * 60 * 60 * 1000));
        const sent = sentMap.get(user.id) ?? new Set();

        try {
          if (daysSinceRegistration === 1 && userEvs.length > 0 && !sent.has('day1_share')) {
            const ev = userEvs[0];
            await sendReminderEmail(user.email, ev.title, ev.slug, 0);
            markBatch.push({ userId: user.id, type: 'day1_share' });
            if (config.NODE_ENV !== 'production') console.log(`[EmailSeq] Día 1: Recordatorio compartir - ${user.email}`);
            processed++;
          }
        } catch (err) {
          if (config.NODE_ENV !== 'production') console.error(`[EmailSeq] Error día 1 para ${user.email}:`, err);
        }

        try {
          if (daysSinceRegistration === 3 && userEvs.length > 0 && !sent.has('day3_loss_aversion')) {
            let totalUnclaimed = 0;
            let mostUnclaimedEv = userEvs[0];
            for (const ev of userEvs) {
              const count = unclaimedGiftMap.get(ev.id) ?? 0;
              totalUnclaimed += count;
              if (count > (unclaimedGiftMap.get(mostUnclaimedEv.id) ?? 0)) {
                mostUnclaimedEv = ev;
              }
            }
            if (totalUnclaimed > 0) {
              await sendReminderEmail(user.email, mostUnclaimedEv.title, mostUnclaimedEv.slug, totalUnclaimed);
              markBatch.push({ userId: user.id, type: 'day3_loss_aversion' });
              if (config.NODE_ENV !== 'production') console.log(`[EmailSeq] Día 3: Loss aversion - ${user.email}`);
              processed++;
            }
          }
        } catch (err) {
          if (config.NODE_ENV !== 'production') console.error(`[EmailSeq] Error día 3 para ${user.email}:`, err);
        }

        try {
          if (daysSinceRegistration === 7 && user.tier === 'free' && !sent.has('day7_cash_fund_upsell') && isEmailConfigured()) {
            const hasFund = userEvs.some(ev => hasCashFundSet.has(ev.id));
            if (!hasFund) {
              try {
                await sendRawEmail({
                  from: config.FROM_EMAIL,
                  to: user.email,
                  subject: 'Recibe aportes económicos con Lluvia de Sobres 💰',
                  html: `
                    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                      <div style="text-align:center;margin-bottom:16px">
                        <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#10b981,#059669);width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
                        <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
                      </div>
                      <h1 style="color:#1f2937;font-size:20px">Tus invitados pueden aportar dinero en efectivo</h1>
                      <p style="color:#6b7280;margin:16px 0">Con Lluvia de Sobres, tus invitados pueden hacer aportes económicos directos a tu evento desde cualquier lugar. Es seguro, fácil y transparente.</p>
                      <p style="color:#6b7280;margin:16px 0">La comisión es del 5% tanto en plan Gratis como en Pro.</p>
                      <div style="text-align:center;margin:24px 0">
                        <a href="${getBaseUrl()}/pricing" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#10b981,#059669);color:white;text-decoration:none;border-radius:12px;font-weight:600">Activar Lluvia de Sobres</a>
                      </div>
                      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
                      <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
                    </div>
                  `,
                });
                markBatch.push({ userId: user.id, type: 'day7_cash_fund_upsell' });
                if (config.NODE_ENV !== 'production') console.log(`[EmailSeq] Día 7: Upsell cash fund - ${user.email}`);
                processed++;
              } catch (err) {
                if (config.NODE_ENV !== 'production') console.error(`[EmailSeq] Error día 7 para ${user.email}:`, err);
              }
            }
          }
        } catch (err) {
          if (config.NODE_ENV !== 'production') console.error(`[EmailSeq] Error día 7 para ${user.email}:`, err);
        }

        try {
          if (daysSinceRegistration === 14 && user.tier === 'free' && isEmailConfigured() && !sent.has('day14_pro_upsell')) {
            try {
              await sendRawEmail({
                from: config.FROM_EMAIL,
                to: user.email,
                subject: 'Actualiza a Pro y obtén más espacio 🚀',
                html: `
                  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                    <div style="text-align:center;margin-bottom:16px">
                      <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#ec4899,#f43f5e);width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
                      <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
                    </div>
                    <h1 style="color:#1f2937;font-size:20px">Lleva tu evento al siguiente nivel</h1>
                    <p style="color:#6b7280;margin:16px 0">Con el plan Pro obtienes:</p>
                    <ul style="color:#6b7280;margin:16px 0">
                      <li style="margin-bottom:8px">✅ Hasta 20 eventos</li>
                      <li style="margin-bottom:8px">✅ 50 regalos por evento</li>
                      <li style="margin-bottom:8px">✅ 15 fotos por evento</li>
                      <li style="margin-bottom:8px">✅ Estadísticas de tu evento</li>
                      <li style="margin-bottom:8px">✅ Lluvia de Sobres incluida sin costo extra</li>
                      <li style="margin-bottom:8px">✅ Tus invitados te avisan por WhatsApp al apartar</li>
                    </ul>
                    <p style="color:#6b7280;margin:16px 0">Todo por solo $24.990/mes COP. 5% de comisión en todos los planes.</p>
                    <div style="text-align:center;margin:24px 0">
                      <a href="${getBaseUrl()}/pricing" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#ec4899,#f43f5e);color:white;text-decoration:none;border-radius:12px;font-weight:600">Ver Planes</a>
                    </div>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
                    <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
                  </div>
                `,
              });
              markBatch.push({ userId: user.id, type: 'day14_pro_upsell' });
              if (config.NODE_ENV !== 'production') console.log(`[EmailSeq] Día 14: Upsell Pro - ${user.email}`);
              processed++;
            } catch (err) {
              if (config.NODE_ENV !== 'production') console.error(`[EmailSeq] Error día 14 para ${user.email}:`, err);
            }
          }
        } catch (err) {
          if (config.NODE_ENV !== 'production') console.error(`[EmailSeq] Error día 14 para ${user.email}:`, err);
        }
      }

      await markEmailSentBatch(markBatch.splice(0));
      minCreatedAt = microBatch[microBatch.length - 1].createdAt;

      if (i + MICRO_BATCH_SIZE < rows.length) {
        await new Promise(r => setTimeout(r, MICRO_BATCH_DELAY_MS));
      }
    }
  }

  return { processed };
}
