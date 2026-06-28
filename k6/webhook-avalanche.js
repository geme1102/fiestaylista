import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://fiestaylista-production.up.railway.app';

const webhookLatency = new Trend('webhook_latency');
const webhookErrors = new Rate('webhook_errors');
const blockedByCloudflare = new Counter('cloudflare_blocks');
const rateLimited = new Counter('rate_limited');

export const options = {
  scenarios: {
    webhook_storm: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 1000,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '10s', target: 50 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 50 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000'],
    webhook_errors: ['rate<0.05'],
  },
};

export default function () {
  const paymentId = `loadtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const body = JSON.stringify({
    action: 'payment.created',
    api_version: 'v1',
    data: { id: paymentId },
    date_created: new Date().toISOString(),
    id: Date.now(),
    live_mode: true,
    type: 'payment',
    user_id: 'loadtest',
  });

  const res = http.post(
    `${BASE_URL}/api/webhooks/mercadopago`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': `ts=${Math.floor(Date.now() / 1000)},v1=loadtest`,
      },
    },
  );

  webhookLatency.add(res.timings.duration);

  if (res.status === 403) {
    blockedByCloudflare.add(1);
  } else if (res.status === 429) {
    rateLimited.add(1);
  }

  const ok = check(res, {
    'webhook accepted (200)': (r) => r.status === 200,
    'webhook accepted (202)': (r) => r.status === 202,
    'not blocked by CF': (r) => r.status !== 403,
    'not rate limited': (r) => r.status !== 429,
  });

  if (!ok) {
    webhookErrors.add(1);
    console.warn(`[webhook] FAIL: ${res.status} — paymentId=${paymentId}`);
  }
}
