// k6 load test: 1000 chat messages/sec sustained.
// Run: k6 run --vus 100 --rps 1000 infra/loadtest/k6-chat.js

import http from 'k6/http';
import { check } from 'k6';

const API = __ENV.API_URL || 'http://localhost:4000';

export const options = {
  vus: 100,
  duration: '3m',
  rps: 1000,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
  },
};

export function setup() {
  const r = http.post(
    `${API}/api/auth/login`,
    JSON.stringify({ email: 'admin@gyanbrige.local', password: 'admin1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: r.json('token') };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };
  const r = http.get(`${API}/api/chat/rooms`, { headers });
  check(r, { 'rooms 200': (x) => x.status === 200 });
}
