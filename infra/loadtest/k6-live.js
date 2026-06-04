// k6 load test: 500 concurrent students joining a live lecture.
// Run: k6 run --vus 500 --duration 5m infra/loadtest/k6-live.js

import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL || 'http://localhost:4000';

export const options = {
  scenarios: {
    join: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 500 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800'],
  },
};

let token = '';

export function setup() {
  const r = http.post(
    `${API}/api/auth/login`,
    JSON.stringify({ email: 'admin@gyanbrige.local', password: 'admin1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: r.json('token') };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' };
  const me = http.get(`${API}/api/auth/me`, { headers });
  check(me, { 'me 200': (r) => r.status === 200 });
  sleep(1);
  const courses = http.get(`${API}/api/courses?mine=true`, { headers });
  check(courses, { 'courses 200': (r) => r.status === 200 });
  sleep(2);
}
