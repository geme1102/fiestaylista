import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 1000 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SLUG = __ENV.EVENT_SLUG || 'test-event';

export default function () {
  const res = http.get(`${BASE_URL}/api/events/slug/${SLUG}`);
  const passed = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has event': (r) => r.json('event') !== null,
  });
  errorRate.add(!passed);
  sleep(1);
}
