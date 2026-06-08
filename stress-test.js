import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://fiestaylista-production.up.railway.app';
const EVENT_SLUG = __ENV.EVENT_SLUG || '';
const EVENT_ID = __ENV.EVENT_ID || '';
const USE_REAL_DATA = __ENV.DISCOVER === '1' || false;

const errorRate = new Rate('errors');
const apiTrend = new Trend('api_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 30 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.08'],
    http_req_duration: ['p(95)<4000'],
    http_req_failed: ['rate<0.08'],
  },
};

function randSleep(maxMs) {
  sleep(Math.random() * maxMs / 1000);
}

function checkRes(name, res, expected = 200) {
  const ok = check(res, {
    [`${name} status ${expected}`]: (r) => r.status === expected,
    [`${name} body ok`]: (r) => r.body.length > 0,
  });
  if (!ok) {
    errorRate.add(1);
    console.warn(`[${name}] FAIL: ${res.status}`);
  }
  apiTrend.add(res.timings.duration);
  return ok;
}

function testEventEndpoints(eventId) {
  group('Event: gifts', () => {
    const r = http.get(`${BASE_URL}/api/events/${eventId}/gifts`, {
      tags: { name: 'gifts' },
    });
    checkRes('gifts', r);
    randSleep(1500);
  });

  group('Event: photos', () => {
    const r = http.get(`${BASE_URL}/api/events/${eventId}/photos`, {
      tags: { name: 'photos' },
    });
    checkRes('photos', r);
    randSleep(1000);
  });

  group('Event: cash-fund', () => {
    const r = http.get(`${BASE_URL}/api/events/${eventId}/cash-fund`, {
      tags: { name: 'cash_fund' },
    });
    checkRes('cash_fund', r);
    randSleep(800);
  });

  group('Event: boost-status', () => {
    const r = http.get(`${BASE_URL}/api/events/${eventId}/boost-status`, {
      tags: { name: 'boost' },
    });
    checkRes('boost', r);
    randSleep(500);
  });

  group('Event: analytics view', () => {
    const r = http.post(
      `${BASE_URL}/api/analytics/view`,
      JSON.stringify({ eventId, referrer: 'https://wa.me/', userAgent: 'k6' }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'analytics' } },
    );
    checkRes('analytics', r);
    randSleep(2000);
  });
}

export function setup() {
  // Try to discover an event ID from the public stats or slug endpoint
  if (EVENT_ID) return { eventId: EVENT_ID };
  if (EVENT_SLUG) {
    const r = http.get(`${BASE_URL}/api/public/events/${EVENT_SLUG}`);
    if (r.status === 200) {
      try { return { eventId: JSON.parse(r.body).id }; } catch { /* ignore */ }
    }
    // fallback
    const r2 = http.get(`${BASE_URL}/api/events/slug/${EVENT_SLUG}`);
    if (r2.status === 200) {
      try { return { eventId: JSON.parse(r2.body).id }; } catch { /* ignore */ }
    }
  }
  if (USE_REAL_DATA) {
    // Try to discover via scraping — no public list endpoint exists,
    // so this requires the user to provide EVENT_SLUG or EVENT_ID.
    console.info('DISCOVER enabled but no public event listing endpoint exists.');
    console.info('Set EVENT_SLUG or EVENT_ID env var for full event tests.');
  }
  return { eventId: null };
}

export default function (data) {
  const eventId = data.eventId;

  // ── 1. Health ──────────────────────────────────────
  group('Health', () => {
    checkRes('health', http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } }));
    randSleep(500);
  });

  // ── 2. Plans ──────────────────────────────────────
  group('Plans', () => {
    checkRes('plans', http.get(`${BASE_URL}/api/plans`, { tags: { name: 'plans' } }));
    randSleep(1000);
  });

  // ── 3. Public stats ──────────────────────────────────
  group('Stats', () => {
    checkRes('stats', http.get(`${BASE_URL}/api/public/stats`, { tags: { name: 'stats' } }));
    randSleep(3000);
  });

  // ── 4. Public docs ──────────────────────────────────
  group('Docs', () => {
    checkRes('docs', http.get(`${BASE_URL}/api/public/docs`, { tags: { name: 'docs' } }));
    randSleep(1000);
  });

  // ── 5. Event-specific tests (if ID available) ─────
  if (eventId) {
    testEventEndpoints(eventId);
  } else {
    group('Event: skipped (no slug/ID)', () => {
      console.info('Skipping event tests — set EVENT_SLUG or EVENT_ID');
      randSleep(500);
    });
  }
}
