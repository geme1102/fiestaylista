import { Resend } from 'resend';
import { config } from '../config.js';

import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Email');

let resend: Resend | null = null;

if (config.RESEND_API_KEY) {
  resend = new Resend(config.RESEND_API_KEY);
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const FROM = config.FROM_EMAIL;

function getBaseUrl(): string {
  return config.FRONTEND_URL;
}

export function isEmailConfigured(): boolean {
  return resend !== null;
}

export async function sendRawEmail(options: { from: string; to: string; subject: string; html: string }): Promise<void> {
  return sendEmail(options);
}

const FOOTER_END = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />\n        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>';

const UNSUBSCRIBE_FOOTER = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
          <tr>
            <td style="text-align:center;color:#9ca3af;font-size:12px">
              <p style="margin:0 0 8px">— El equipo de Fiesta y Lista</p>
              <p style="margin:0">
                <a href="${config.FRONTEND_URL}/unsubscribe" style="color:#9ca3af;text-decoration:underline">Cancelar suscripción</a>
              </p>
            </td>
          </tr>
        </table>`;

function emailTypeAllowsUnsubscribe(type: string): boolean {
  const transactional = ['verification', 'password_reset'];
  return !transactional.includes(type);
}

export async function sendEmail(
  options: { from: string; to: string; subject: string; html: string; text?: string; emailType?: string },
): Promise<void> {
  if (!resend) {
    throw new Error('Email service not configured: RESEND_API_KEY is missing');
  }
  try {
    const allowsUnsubscribe = options.emailType ? emailTypeAllowsUnsubscribe(options.emailType) : false;
    const htmlFinal = allowsUnsubscribe
      ? options.html.replace(FOOTER_END, UNSUBSCRIBE_FOOTER)
      : options.html;

    const headers: Record<string, string> = {};
    if (allowsUnsubscribe) {
      headers['List-Unsubscribe'] = `${config.FRONTEND_URL}/unsubscribe`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    await resend.emails.send({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: htmlFinal,
      text: options.text || stripHtml(options.html),
      replyTo: 'soporte@fiestaylista.com',
      headers,
    });
  } catch (err) {
    log.error({ err }, 'Error sending email:');
    throw new Error(
      `Failed to send email: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${config.FRONTEND_URL}/verify-email?token=${token}`;

  await sendEmail({
    from: FROM,
    to: email,
    subject: 'Verifica tu correo — Fiesta y Lista',
    emailType: 'verification',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;justify-content:center;background:#ec4899;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <h1 style="text-align:center;color:#1f2937;font-size:20px">Verifica tu correo electrónico</h1>
        <p style="color:#6b7280;text-align:center;margin:16px 0">Gracias por registrarte en Fiesta y Lista. Haz clic en el botón para verificar tu dirección de correo.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${url}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Verificar correo</a>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center">Si no creaste una cuenta, ignora este mensaje.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${getBaseUrl()}/reset-password?token=${token}`;

  await sendEmail({
    from: FROM,
    to: email,
    subject: 'Restablece tu contraseña — Fiesta y Lista',
    emailType: 'password_reset',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;justify-content:center;background:#ec4899;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <h1 style="text-align:center;color:#1f2937;font-size:20px">Restablece tu contraseña</h1>
        <p style="color:#6b7280;text-align:center;margin:16px 0">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para continuar. Este enlace expirará en 1 hora por seguridad.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${url}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Restablecer contraseña</a>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center">Si no solicitaste esto, ignora este mensaje.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
      </div>
    `,
  });
}

export async function sendProConfirmationEmail(email: string, name: string, interval: string): Promise<void> {
  const dashboardUrl = `${getBaseUrl()}/dashboard`;

  await sendEmail({
    from: FROM,
    to: email,
    subject: 'Bienvenido a Fiesta y Lista Pro',
    emailType: 'pro_confirmation',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;justify-content:center;background:#ec4899;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <h1 style="text-align:center;color:#1f2937;font-size:20px">Bienvenido a Pro, ${escapeHtml(name)}</h1>
        <p style="color:#6b7280;text-align:center;margin:16px 0">Tu suscripción ${interval} ya está activa. Ahora tienes acceso a todas las funciones premium.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#991b1b;font-size:14px"><strong>Qué incluye:</strong></p>
          <ul style="margin:8px 0 0;padding-left:20px;color:#991b1b;font-size:14px">
            <li>1 evento</li>
            <li>100 regalos por evento</li>
            <li>20 fotos por evento</li>
            <li>Lluvia de Sobres: tus invitados reportan sus aportes</li>
          </ul>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${dashboardUrl}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Ir al dashboard</a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
      </div>
    `,
  });
}

export async function sendPastDueEmail(email: string, name: string, daysRemaining: number, accountUrl: string): Promise<void> {
  await sendEmail({
    from: FROM,
    to: email,
    subject: 'Tu pago está pendiente — Fiesta y Lista',
    emailType: 'past_due',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;justify-content:center;background:#ec4899;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:24px;margin:16px 0;text-align:center">
          <h1 style="color:#991b1b;font-size:20px;margin:12px 0">Tu pago está pendiente, ${escapeHtml(name)}</h1>
          <p style="color:#92400e;margin:8px 0">Tu suscripción Pro no se ha renovado. Tienes <strong>${daysRemaining} días</strong> para actualizar tu método de pago antes de que tus eventos se congelen.</p>
          <p style="color:#92400e;font-size:13px;margin:8px 0">Si no renuevas, después de ${daysRemaining} días tus eventos dejarán de ser visibles para tus invitados y 30 días más tarde todos tus datos serán eliminados.</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${accountUrl}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Ir a mi cuenta</a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
      </div>
    `,
  });
}

export async function sendFreezeEmail(email: string, name: string, pricingUrl: string): Promise<void> {
  await sendEmail({
    from: FROM,
    to: email,
    subject: 'Tus eventos han sido pausados — Fiesta y Lista',
    emailType: 'freeze',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;justify-content:center;background:#ec4899;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <div style="background:#eff6ff;border:2px solid #93c5fd;border-radius:12px;padding:24px;margin:16px 0;text-align:center">
          <h1 style="color:#1e40af;font-size:20px;margin:12px 0">Tus eventos han sido pausados</h1>
          <p style="color:#1e40af;margin:8px 0">Hola ${escapeHtml(name)},</p>
          <p style="color:#6b7280;margin:8px 0">Tus eventos ya no están visibles para tus invitados porque tu suscripción no se renovó. Todos tus datos están guardados de forma segura.</p>
          <p style="color:#92400e;font-size:13px;font-weight:bold;margin:12px 0">Tienes 30 días para renovar tu suscripción. Después de ese período, tus datos (eventos, regalos, fotos) serán eliminados.</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${pricingUrl}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Ver planes</a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
      </div>
    `,
  });
}

export async function sendPurgeWarningEmail(email: string, name: string, daysUntilPurge: number, pricingUrl: string): Promise<void> {
  await sendEmail({
    from: FROM,
    to: email,
    subject: 'Tu suscripción expirará en ' + daysUntilPurge + ' días — Fiesta y Lista',
    emailType: 'purge_warning',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;justify-content:center;background:#ec4899;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <div style="background:#fff7ed;border:2px solid #fdba74;border-radius:12px;padding:24px;margin:16px 0;text-align:center">
          <h1 style="color:#9a3412;font-size:20px;margin:12px 0">Último aviso, ${escapeHtml(name)}</h1>
          <p style="color:#9a3412;margin:8px 0">Tus eventos han estado pausados por varios días y tu suscripción no se ha renovado.</p>
          <p style="color:#92400e;font-size:14px;font-weight:bold;margin:12px 0">En ${daysUntilPurge} días, tus datos (eventos, regalos, fotos, mensajes) serán eliminados permanentemente.</p>
          <p style="color:#6b7280;font-size:13px;margin:8px 0">Si renuevas tu suscripción ahora, tus eventos volverán a estar activos y no perderás nada.</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${pricingUrl}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Renovar ahora</a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
      </div>
    `,
  });
}

export async function sendReminderEmail(email: string, eventTitle: string, slug: string, unclaimedCount: number): Promise<void> {
  const url = `${getBaseUrl()}/e/${slug}`;

  if (unclaimedCount === 0) {
    await sendEmail({
      from: FROM,
      to: email,
      subject: `Comparte ${eventTitle} con tus invitados`,
      emailType: 'reminder',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="text-align:center;margin-bottom:16px">
            <div style="display:inline-flex;align-items:center;justify-content:center;background:#ec4899;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
            <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
          </div>
          <h1 style="color:#1f2937;font-size:20px">${escapeHtml(eventTitle)}</h1>
          <p style="color:#6b7280">Tu evento ya está listo. Comparte el enlace con tus invitados para que empiecen a apartar sus regalos.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${url}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Compartir evento</a>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
          <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
        </div>
      `,
    });
    return;
  }

  await sendEmail({
    from: FROM,
    to: email,
    subject: `${eventTitle}: ${unclaimedCount} regalos sin apartar`,
    emailType: 'reminder',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;justify-content:center;background:#ec4899;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <h1 style="color:#1f2937;font-size:20px">${escapeHtml(eventTitle)}</h1>
        <p style="color:#6b7280">Tienes <strong>${unclaimedCount} regalos</strong> que aún no han sido apartados por tus invitados.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${url}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Ver lista de regalos</a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
      </div>
    `,
  });
}
