import type { RequestCategory, ServiceRequest } from '../repositories/types.ts';

const SLA_DAYS: Record<RequestCategory, number> = {
  'address-change': 5,
  'retirement-quote': 10,
  complaint: 14,
  'value-transfer': 30,
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface OverdueServiceRequest extends ServiceRequest {
  dueDate: string;
  daysOverdue: number;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Due-date and overdue rules follow docs/domain/service-levels.md. */
export function serviceRequestDueDate(request: ServiceRequest): string {
  const date = new Date(`${request.createdAt}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + SLA_DAYS[request.category]);
  return date.toISOString().slice(0, 10);
}

/** Returns open requests past their due date, most overdue first. */
export function listOverdueServiceRequests(
  requests: readonly ServiceRequest[],
  asOf: string,
): OverdueServiceRequest[] {
  const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
  return requests.flatMap((request) => {
    if (request.status !== 'open' && request.status !== 'in-progress') return [];

    const dueDate = serviceRequestDueDate(request);
    const dueDateValue = new Date(`${dueDate}T00:00:00.000Z`);
    const daysOverdue = Math.floor((asOfDate.getTime() - dueDateValue.getTime()) / MILLISECONDS_PER_DAY);
    return daysOverdue > 0 ? [{ ...request, dueDate, daysOverdue }] : [];
  }).sort((a, b) => b.daysOverdue - a.daysOverdue);
}
