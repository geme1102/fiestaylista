/**
 * Build-time sitemap generator.
 * Appends dynamic public event pages to the static sitemap.
 * Usage: node scripts/generate-sitemap.js
 * Called automatically via `npm run build` (postbuild in package.json)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SITEMAP_PATH = path.resolve(__dirname, '..', 'dist', 'sitemap.xml');
const API_BASE = process.env.VITE_API_URL || 'https://fiestaylista-production.up.railway.app';

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('timeout')); });
  });
}

async function getPublicEventSlugs() {
  try {
    const allEvents = [];
    let cursor = null;
    do {
      const url = `${API_BASE}/api/public/events?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const data = await fetchJSON(url);
      if (!data || !Array.isArray(data.events)) break;
      allEvents.push(...data.events.filter((e) => e && e.slug).map((e) => ({ slug: e.slug, lastmod: e.updatedAt })));
      cursor = data.hasMore ? data.nextCursor : null;
    } while (cursor);
    return allEvents;
  } catch {
    return [];
  }
}

async function generateSitemap() {
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.log('[Sitemap] dist/sitemap.xml not found — run build first');
    return;
  }

  const events = await getPublicEventSlugs();
  if (events.length === 0) {
    console.log('[Sitemap] No dynamic events to add');
    return;
  }

  let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf-8');
  const closeTag = '</urlset>';
  const entries = events
    .map((e) => {
      const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>https://fiestaylista.com/e/${encodeURIComponent(e.slug)}</loc>${lastmod}\n    <changefreq>daily</changefreq>\n    <priority>0.5</priority>\n  </url>`;
    })
    .join('\n');

  sitemap = sitemap.replace(closeTag, `${entries}\n${closeTag}`);
  fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf-8');
  console.log(`[Sitemap] Added ${events.length} event pages to sitemap`);
}

generateSitemap().catch((err) => console.error('[Sitemap] Error:', err));
