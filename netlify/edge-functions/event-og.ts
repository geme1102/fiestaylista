import type { Context } from "https://edge.netlify.com";

const CRAWLER_PATTERN = /whatsapp|facebookexternalhit|facebookbot|twitterbot|telegrambot|slackbot|linkedinbot|googlebot|bingbot|applebot|discordbot|skypeuripreview|snapchat|pinterest|vkshare|wire|redditbot|quora link preview/i;

const EVENT_TYPE_LABELS: Record<string, string> = {
  BABY_SHOWER: "Baby Shower",
  WEDDING: "Boda",
  BIRTHDAY: "Cumpleaños",
  BAPTISM: "Bautizo",
  COMMUNION: "Comunión",
  OTHER: "Celebración",
  HOUSE_WARMING: "Casa Shower",
};

const EVENT_TYPE_EMOJIS: Record<string, string> = {
  BABY_SHOWER: "🍼",
  WEDDING: "💍",
  BIRTHDAY: "🎂",
  BAPTISM: "🕊️",
  COMMUNION: "✨",
  OTHER: "🎊",
  HOUSE_WARMING: "🏠",
};

interface EventData {
  title: string;
  eventType: string;
  slug: string;
  eventDate?: string | null;
  eventLocation?: string | null;
  gifts?: Array<{ isClaimed?: boolean }>;
  photos?: Array<{ url?: string }>;
}

export default async (request: Request, context: Context) => {
  const userAgent = request.headers.get("user-agent") || "";

  if (!CRAWLER_PATTERN.test(userAgent)) {
    return context.next();
  }

  const url = new URL(request.url);
  const slug = url.pathname.replace("/e/", "").replace(/\/$/, "");
  if (!slug || slug.includes("/")) {
    return context.next();
  }

  try {
    const apiRes = await fetch(`${url.origin}/api/events/slug/${encodeURIComponent(slug)}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!apiRes.ok) return context.next();

    const data = await apiRes.json();
    const event: EventData | undefined = data.event;
    if (!event) return context.next();

    const typeLabel = EVENT_TYPE_LABELS[event.eventType] || "Celebración";
    const emoji = EVENT_TYPE_EMOJIS[event.eventType] || "🎉";
    const title = `${event.title} - Fiesta y Lista`;
    const description = `${emoji} Lista de regalos para ${event.title} (${typeLabel}). Aparta tu regalo y celebra con ellos.`;
    const ogImage = event.photos && event.photos.length > 0 && event.photos[0].url
      ? event.photos[0].url
      : "https://fiestaylista.com/og-image.png";
    const canonical = `https://fiestaylista.com/e/${event.slug}`;
    const totalGifts = event.gifts?.length || 0;
    const claimedGifts = event.gifts?.filter((g) => g.isClaimed).length || 0;

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title,
      "description": description,
      "url": canonical,
      "inLanguage": "es-CO",
      "isAccessibleForFree": true,
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@type": "Organization", "name": "Fiesta y Lista" },
    };
    if (event.eventDate) jsonLd.startDate = event.eventDate;
    if (event.eventLocation) jsonLd.location = { "@type": "Place", "name": event.eventLocation };

    const hasRequiredEventFields = event.eventDate && event.eventLocation;
    const jsonLdStr = hasRequiredEventFields
      ? JSON.stringify(jsonLd).replace(/<\//g, '<\\/')
      : '';

    const html = buildHtml({
      title, description, canonical, ogImage, jsonLd: jsonLdStr, typeLabel,
      totalGifts, claimedGifts, emoji,
    });

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch {
    return context.next();
  }
};

function buildHtml(opts: {
  title: string; description: string; canonical: string; ogImage: string;
  jsonLd: string; typeLabel: string; totalGifts: number; claimedGifts: number; emoji: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="canonical" href="${escapeHtml(opts.canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fiesta y Lista">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.description)}">
<meta property="og:url" content="${escapeHtml(opts.canonical)}">
<meta property="og:image" content="${escapeHtml(opts.ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(opts.title)}">
<meta property="og:locale" content="es_CO">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(opts.title)}">
<meta name="twitter:description" content="${escapeHtml(opts.description)}">
<meta name="twitter:image" content="${escapeHtml(opts.ogImage)}">
<meta name="robots" content="index, follow">
${opts.jsonLd ? `<script type="application/ld+json">${opts.jsonLd}</script>` : ''}
</head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#faf9f8;color:#1a1c1c">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;text-align:center">
<div style="font-size:64px;margin-bottom:16px">${opts.emoji}</div>
<h1 style="font-size:28px;font-weight:800;margin:0 0 8px">${escapeHtml(opts.title)}</h1>
<p style="font-size:16px;color:#574048;margin:0 0 4px">${escapeHtml(opts.typeLabel)}</p>
<p style="font-size:14px;color:#8b7079;margin:0 0 24px">${opts.claimedGifts} de ${opts.totalGifts} regalos apartados</p>
<a href="https://fiestaylista.com" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#b10e6b,#d23284);color:#fff;text-decoration:none;font-weight:700;border-radius:24px;font-size:15px">Ver lista de regalos</a>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
