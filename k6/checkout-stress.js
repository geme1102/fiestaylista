import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://fiestaylista-production.up.railway.app';
const TEST_TOKEN = __ENV.TEST_TOKEN || '';

const checkoutLatency = new Trend('checkout_latency');
const preferenceErrors = new Rate('preference_errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<4000'],
    checkout_latency: ['p(95)<3000'],
    preference_errors: ['rate<0.05'],
  },
};

export default function () {
  const payload = JSON.stringify({
    tier: 'pro',
    interval: 'month',
    successUrl: `${BASE_URL}/dashboard`,
    cancelUrl: `${BASE_URL}/pricing`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_TOKEN}`,
    },
  };

  const res = http.post(`${BASE_URL}/api/subscriptions/create-checkout`, payload, params);
  checkoutLatency.add(res.timings.duration);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has checkout url': (r) => r.status === 200 && r.json('url') !== undefined,
    'not rate limited': (r) => r.status !== 429,
  });

  if (!ok) {
    preferenceErrors.add(1);
    console.warn(`[checkout] FAIL: ${res.status} — ${res.body?.slice(0, 200)}`);
  }

  sleep(1);
}
