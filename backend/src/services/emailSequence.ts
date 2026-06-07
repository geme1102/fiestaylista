import { eq, and, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '../db/index.js';
import { users, events, gifts, cashFunds, emailTracking } from '../db/schema.js';
import { config } from '../config.js';
import { sendReminderEmail } from './email.js';

const resendClient = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

function getBaseUrl(): string {
  return config.FRONTEND_URL;
}

interface EmailJob {
  user: { id: string; email: string; name: string };
  type: string;
}

const BATCH_SIZE = 50;

async function hasEmailBeenSent(userId: string, type: string): Promise<boolean> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailTracking)
    .where(and(
      eq(emailTracking.userId, userId),
      eq(emailTracking.type, type),
    ));
  return (rows[0]?.count ?? 0) > 0;
}

async function markEmailSent(userId: string, type: string): Promise<void> {
  const alreadySent = await hasEmailBeenSent(userId, type);
  if (!alreadySent) {
    await db.insert(emailTracking).values({ userId, type });
  }
}

export async function processEmailSequence(): Promise<{ processed: number }> {
  const jobs: EmailJob[] = [];
  const now = new Date();

  let minCreatedAt: Date | null = null;
  let batchCount = 0;
  const MAX_BATCHES = 10;

  while (batchCount < MAX_BATCHES) {
    batchCount++;
    const condition: any = minCreatedAt
      ? and(eq(users.emailVerified, true), sql`${users.createdAt} > ${minCreatedAt}`)
      : eq(users.emailVerified, true);

    const rows: any[] = await db
      .select()
      .from(users)
      .where(condition)
      .orderBy(users.createdAt)
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    for (let i = 0; i < rows.length; i++) {
      const user: any = rows[i];
      const userEvents = await db
        .select({ id: events.id, title: events.title, slug: events.slug, createdAt: events.createdAt })
        .from(events)
        .where(eq(events.userId, user.id));

      const userAge = now.getTime() - new Date(user.createdAt).getTime();
      const daysSinceRegistration = Math.floor(userAge / (24 * 60 * 60 * 1000));

      try {
        if (daysSinceRegistration === 1 && userEvents.length > 0 && !(await hasEmailBeenSent(user.id, 'day1_share'))) {
          const event = userEvents[0];
          await sendReminderEmail(user.email, event.title, event.slug, 0);
          await markEmailSent(user.id, 'day1_share');
          console.log(`[EmailSeq] Día 1: Recordatorio compartir - ${user.email}`);
          jobs.push({ user, type: 'day1_share' });
        }
      } catch (err) {
        console.error(`[EmailSeq] Error día 1 para ${user.email}:`, err);
      }

      try {
        if (daysSinceRegistration === 3 && userEvents.length > 0 && !(await hasEmailBeenSent(user.id, 'day3_loss_aversion'))) {
          const eventIds = userEvents.map(e => e.id);
          const totalGifts = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(gifts)
            .where(sql`${gifts.eventId} = ANY(${eventIds}::uuid[])`);

          const claimedGifts = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(gifts)
            .where(and(
              sql`${gifts.eventId} = ANY(${eventIds}::uuid[])`,
              eq(gifts.isClaimed, true),
            ));

          if (totalGifts[0]?.count > 0 && claimedGifts[0]?.count === 0) {
            await sendReminderEmail(user.email, userEvents[0].title, userEvents[0].slug, totalGifts[0]!.count);
            await markEmailSent(user.id, 'day3_loss_aversion');
            console.log(`[EmailSeq] Día 3: Loss aversion - ${user.email}`);
            jobs.push({ user, type: 'day3_loss_aversion' });
          }
        }
      } catch (err) {
        console.error(`[EmailSeq] Error día 3 para ${user.email}:`, err);
      }

      try {
        if (daysSinceRegistration === 7 && user.tier === 'free' && !(await hasEmailBeenSent(user.id, 'day7_cash_fund_upsell'))) {
          const hasCashFund = userEvents.length > 0
            ? await db
                .select({ count: sql<number>`count(*)::int` })
                .from(cashFunds)
                .where(sql`${cashFunds.eventId} = ANY(${userEvents.map(e => e.id)}::uuid[])`)
                .then(r => (r[0]?.count || 0) > 0)
            : false;

          if (!hasCashFund && resendClient) {
            const url = `${getBaseUrl()}/pricing`;
            const result = await resendClient.emails.send({
              from: config.FROM_EMAIL,
              to: user.email,
              subject: '💰 Recibe aportaciones económicas con Lluvia de Sobres',
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h1 style="color:#1f2937;font-size:20px">💰 ¿Sabías que puedes recibir dinero de tus invitados?</h1>
                  <p style="color:#6b7280;margin:16px 0">Con Lluvia de Sobres, tus invitados pueden hacer aportaciones económicas directas a tu evento. Es seguro, fácil y transparente.</p>
                  <p style="color:#6b7280;margin:16px 0">La comisión del Cash fund es del 5% tanto en plan Gratis como en Pro.</p>
                  <div style="text-align:center;margin:24px 0">
                    <a href="${url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#10b981,#059669);color:white;text-decoration:none;border-radius:12px;font-weight:600">Activar Lluvia de Sobres</a>
                  </div>
                </div>
              `,
            });
            if (result.error) {
              console.error(`[EmailSeq] Resend error día 7 para ${user.email}:`, result.error);
            } else {
              await markEmailSent(user.id, 'day7_cash_fund_upsell');
              console.log(`[EmailSeq] Día 7: Upsell cash fund - ${user.email}`);
              jobs.push({ user, type: 'day7_cash_fund_upsell' });
            }
          }
        }
      } catch (err) {
        console.error(`[EmailSeq] Error día 7 para ${user.email}:`, err);
      }

      try {
        if (daysSinceRegistration === 14 && user.tier === 'free' && resendClient && !(await hasEmailBeenSent(user.id, 'day14_pro_upsell'))) {
          const result = await resendClient.emails.send({
            from: config.FROM_EMAIL,
            to: user.email,
            subject: '🚀 Actualiza a Pro y ahorra en comisiones',
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h1 style="color:#1f2937;font-size:20px">🚀 Lleva tu evento al siguiente nivel</h1>
                <p style="color:#6b7280;margin:16px 0">Con el plan Pro obtienes:</p>
                <ul style="color:#6b7280;margin:16px 0">
                  <li style="margin-bottom:8px">✅ Hasta 20 eventos</li>
                  <li style="margin-bottom:8px">✅ 50 regalos por evento</li>
                  <li style="margin-bottom:8px">✅ Cash fund con comisión reducida</li>
                  <li style="margin-bottom:8px">✅ Estadísticas completas</li>
                  <li style="margin-bottom:8px">✅ Sin marca de agua</li>
                </ul>
                <p style="color:#6b7280;margin:16px 0">Todo por solo $24.990/mes COP. Ahorra pagando anual.</p>
                <div style="text-align:center;margin:24px 0">
                  <a href="${getBaseUrl()}/pricing" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#ec4899,#f43f5e);color:white;text-decoration:none;border-radius:12px;font-weight:600">Ver Planes</a>
                </div>
              </div>
            `,
          });
          if (result.error) {
            console.error(`[EmailSeq] Resend error día 14 para ${user.email}:`, result.error);
          } else {
            await markEmailSent(user.id, 'day14_pro_upsell');
            console.log(`[EmailSeq] Día 14: Upsell Pro - ${user.email}`);
            jobs.push({ user, type: 'day14_pro_upsell' });
          }
        }
      } catch (err) {
        console.error(`[EmailSeq] Error día 14 para ${user.email}:`, err);
      }

      minCreatedAt = user.createdAt;
    }
  }

  return { processed: jobs.length };
}
