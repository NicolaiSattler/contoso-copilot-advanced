import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { listOverdueServiceRequests, serviceRequestDueDate } from '../src/domain/serviceRequests.ts';
import type { ServiceRequest } from '../src/repositories/types.ts';
import { startTestServer } from './helpers.ts';

let api: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

function request(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 'SR-1',
    memberId: 'M-1',
    category: 'address-change',
    subject: 'Test request',
    description: 'Synthetic test request',
    status: 'open',
    createdAt: '2026-11-10',
    closedAt: null,
    ...overrides,
  };
}

test('service request due dates use the calendar-day SLA for every category', () => {
  assert.equal(serviceRequestDueDate(request({ category: 'address-change' })), '2026-11-15');
  assert.equal(serviceRequestDueDate(request({ category: 'retirement-quote' })), '2026-11-20');
  assert.equal(serviceRequestDueDate(request({ category: 'complaint' })), '2026-11-24');
  assert.equal(serviceRequestDueDate(request({ category: 'value-transfer' })), '2026-12-10');
});

test('overdue requests include open and in-progress only after the due date', () => {
  const overdue = listOverdueServiceRequests([
    request({ id: 'SR-DUE-TODAY', createdAt: '2026-11-13' }),
    request({ id: 'SR-OPEN', createdAt: '2026-11-12' }),
    request({ id: 'SR-IN-PROGRESS', status: 'in-progress', createdAt: '2026-11-12' }),
    request({ id: 'SR-CLOSED', status: 'closed', createdAt: '2026-11-12' }),
  ], '2026-11-18');

  assert.deepEqual(overdue.map(({ id, dueDate, daysOverdue }) => ({ id, dueDate, daysOverdue })), [
    { id: 'SR-OPEN', dueDate: '2026-11-17', daysOverdue: 1 },
    { id: 'SR-IN-PROGRESS', dueDate: '2026-11-17', daysOverdue: 1 },
  ]);
});

test('GET /api/service-requests/overdue returns exact due dates and most-overdue-first order', async () => {
  const res = await api.get('/api/service-requests/overdue?asOf=2026-11-18');
  assert.equal(res.status, 200);
  const requests = await res.json();
  assert.deepEqual(requests.map(({ id, dueDate, daysOverdue }: {
    id: string; dueDate: string; daysOverdue: number;
  }) => ({ id, dueDate, daysOverdue })), [
    { id: 'SR-5004', dueDate: '2026-10-15', daysOverdue: 34 },
    { id: 'SR-5001', dueDate: '2026-10-30', daysOverdue: 19 },
    { id: 'SR-5003', dueDate: '2026-11-07', daysOverdue: 11 },
    { id: 'SR-5006', dueDate: '2026-11-15', daysOverdue: 3 },
    { id: 'SR-5005', dueDate: '2026-11-16', daysOverdue: 2 },
  ]);
});

test('GET /api/service-requests/overdue defaults asOf to today', async () => {
  const res = await api.get('/api/service-requests/overdue');
  assert.equal(res.status, 200);
  const requests = await res.json();
  assert.deepEqual(requests.map(({ id, daysOverdue }: { id: string; daysOverdue: number }) => [id, daysOverdue]), [
    ['SR-5004', 34],
    ['SR-5001', 19],
    ['SR-5003', 11],
    ['SR-5006', 3],
    ['SR-5005', 2],
  ]);
});

test('GET /api/service-requests/overdue rejects an invalid ISO date with the error envelope', async () => {
  const res = await api.get('/api/service-requests/overdue?asOf=2026-02-30');
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
});
