import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 200 },
    { duration: '3m', target: 500 },
    { duration: '1m', target: 800 },
    { duration: '3m', target: 800 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SLUG = __ENV.EVENT_SLUG || 'test-event';
const EVENT_ID = __ENV.EVENT_ID || 'test-event-id';

export default function () {
  const rnd = Math.random();

  if (rnd < 0.6) {
    const res = http.get(`${BASE_URL}/api/events/slug/${SLUG}`);
    errorRate.add(!check(res, { 'status is 200': (r) => r.status === 200 }));
  } else if (rnd < 0.8) {
    const res = http.get(`${BASE_URL}/api/events/${EVENT_ID}/photos`);
    errorRate.add(!check(res, { 'status is 200 or 401': (r) => r.status === 200 || r.status === 401 }));
  } else {
    const payload = JSON.stringify({ name: `Gift_${__VU}_${Date.now()}` });
    const res = http.post(`${BASE_URL}/api/events/${EVENT_ID}/gifts`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    errorRate.add(!check(res, { 'status is 200 or 401': (r) => r.status === 200 || r.status === 401 }));
  }

  sleep(Math.random() * 2 + 0.5);
}
