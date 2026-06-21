import { Resend } from 'resend';
import { config } from '../config.js';

import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Email');

let resend: Resend | null = null;

if (config.RESEND_API_KEY) {
  resend = new Resend(config.RESEND_API_KEY);
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

async function sendEmail(options: { from: string; to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    throw new Error('Email service not configured: RESEND_API_KEY is missing');
  }
  try {
    await resend.emails.send(options);
  } catch (err) {
    log.error({ err }, 'Error sending email:');
    throw new Error(
      `Failed to send email: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${config.FRONTEND_URL}/verify-email?token=${token}`;

  await sendEmail({
    from: FROM,
    to: email,
    subject: 'Verifica tu correo — Fiesta y Lista',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#ec4899,#f43f5e);width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <h1 style="text-align:center;color:#1f2937;font-size:20px">Verifica tu correo electrónico</h1>
        <p style="color:#6b7280;text-align:center;margin:16px 0">Gracias por registrarte en Fiesta y Lista. Haz clic en el botón para verificar tu dirección de correo.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#ec4899,#f43f5e);color:white;text-decoration:none;border-radius:12px;font-weight:600">Verificar correo</a>
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
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#ec4899,#f43f5e);width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <h1 style="text-align:center;color:#1f2937;font-size:20px">Restablece tu contraseña</h1>
        <p style="color:#6b7280;text-align:center;margin:16px 0">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para continuar. Este enlace expirará en 1 hora por seguridad.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#ec4899,#f43f5e);color:white;text-decoration:none;border-radius:12px;font-weight:600">Restablecer contraseña</a>
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
    subject: '¡Bienvenido a Fiesta y Lista PRO! 🎉',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#ec4899,#f43f5e);width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <h1 style="text-align:center;color:#1f2937;font-size:20px">¡Bienvenido a PRO, ${name}!</h1>
        <p style="color:#6b7280;text-align:center;margin:16px 0">Tu suscripción ${interval} ya está activa. Ahora tienes acceso a todas las funciones premium.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#991b1b;font-size:14px"><strong>Qué incluye:</strong></p>
          <ul style="margin:8px 0 0;padding-left:20px;color:#991b1b;font-size:14px">
            <li>Eventos ilimitados</li>
            <li>Lista de regalos sin límite de fotos</li>
            <li>Prioridad en boost de eventos</li>
            <li>Sin límite de invitados</li>
          </ul>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${dashboardUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#ec4899,#f43f5e);color:white;text-decoration:none;border-radius:12px;font-weight:600">Ir al dashboard</a>
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
      subject: `Comparte ${eventTitle} con tus invitados 🎉`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="text-align:center;margin-bottom:16px">
            <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#ec4899,#f43f5e);width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
            <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
          </div>
          <h1 style="color:#1f2937;font-size:20px">${eventTitle}</h1>
          <p style="color:#6b7280">Tu evento ya está listo. Comparte el enlace con tus invitados para que empiecen a apartar sus regalos.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#ec4899,#f43f5e);color:white;text-decoration:none;border-radius:12px;font-weight:600">Compartir evento</a>
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
    subject: `${eventTitle}: ${unclaimedCount} regalos sin apartar 💝`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#ec4899,#f43f5e);width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
          <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
        </div>
        <h1 style="color:#1f2937;font-size:20px">${eventTitle}</h1>
        <p style="color:#6b7280">Tienes <strong>${unclaimedCount} regalos</strong> que aún no han sido apartados por tus invitados.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#ec4899,#f43f5e);color:white;text-decoration:none;border-radius:12px;font-weight:600">Ver lista de regalos</a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
      </div>
    `,
  });
}
