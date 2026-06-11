import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '30s', target: 500 },
    { duration: '20s', target: 1000 },
    { duration: '30s', target: 1000 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const EVENT_ID = __ENV.EVENT_ID || 'test-event-id';
const GIFT_ID = __ENV.GIFT_ID || 'test-gift-id';

export default function () {
  const payload = JSON.stringify({ claimedBy: `StressTester_${__VU}_${Date.now()}` });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.put(`${BASE_URL}/api/events/${EVENT_ID}/gifts/${GIFT_ID}/claim`, payload, params);
  const passed = check(res, {
    'status is 200': (r) => r.status === 200,
  });
  errorRate.add(!passed);
  sleep(0.5);
}
