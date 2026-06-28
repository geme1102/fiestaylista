import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://fiestaylista-production.up.railway.app';
const TEST_TOKEN = __ENV.TEST_TOKEN || '';

const userLatency = new Trend('user_latency');
const webhookLatency = new Trend('webhook_latency');
const webhookErrors = new Rate('webhook_errors');
const userErrors = new Rate('user_errors');

export const options = {
  scenarios: {
    browsing_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '2m', target: 30 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'browseUser',
    },
    payment_webhooks: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 200,
      maxVUs: 500,
      exec: 'sendWebhook',
    },
    readers: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 200,
      startTime: '30s',
      maxDuration: '4m30s',
      exec: 'readData',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<4000'],
    user_errors: ['rate<0.05'],
    webhook_errors: ['rate<0.08'],
  },
};

export function browseUser() {
  group('Browse: health + plans', () => {
    const r1 = http.get(`${BASE_URL}/api/health`, { tags: { name: 'browse_health' } });
    userLatency.add(r1.timings.duration);
    check(r1, { 'health ok': (r) => r.status === 200 });
    sleep(2);

    const r2 = http.get(`${BASE_URL}/api/plans`, { tags: { name: 'browse_plans' } });
    userLatency.add(r2.timings.duration);
    check(r2, { 'plans ok': (r) => r.status === 200 });
    sleep(3);
  });

  group('Browse: public stats', () => {
    const r = http.get(`${BASE_URL}/api/public/stats`, { tags: { name: 'browse_stats' } });
    userLatency.add(r.timings.duration);
    const ok = check(r, { 'stats ok': (r) => r.status === 200 });
    if (!ok) userErrors.add(1);
    sleep(5);
  });

  group('Browse: public docs', () => {
    const r = http.get(`${BASE_URL}/api/public/docs`, { tags: { name: 'browse_docs' } });
    userLatency.add(r.timings.duration);
    const ok = check(r, { 'docs ok': (r) => r.status === 200 });
    if (!ok) userErrors.add(1);
    sleep(4);
  });
}

export function sendWebhook() {
  const paymentId = `mixed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  const ok = check(res, {
    'webhook 2xx': (r) => r.status === 200 || r.status === 202,
  });

  if (!ok) {
    webhookErrors.add(1);
    console.warn(`[mixed-webhook] FAIL: ${res.status} — paymentId=${paymentId}`);
  }
}

export function readData() {
  const payload = JSON.stringify({ interval: 'month' });
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_TOKEN}`,
    },
  };

  group('Read: pricing intent', () => {
    const r = http.post(`${BASE_URL}/api/subscriptions/create-checkout`, payload, params);
    userLatency.add(r.timings.duration);
    const ok = check(r, { 'checkout ok': (r) => r.status === 200 });
    if (!ok) userErrors.add(1);
    sleep(2);
  });
}
