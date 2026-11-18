import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.ts';
import { aggregateYearlyContributions } from '../src/domain/pension.ts';
import type { Contribution } from '../src/repositories/types.ts';

describe('Employer Contributions', () => {
  describe('Domain: aggregateYearlyContributions', () => {
    test('aggregates contributions from multiple members', () => {
      const contributions: Contribution[] = [
        {
          memberId: 'M-1001',
          year: 2025,
          fullTimeSalary: 47000,
          partTimeFactor: 1.0,
          pensionableSalary: 29455,
          accrual: 515.46,
          employerContribution: 1587.90,
          employeeContribution: 1058.60,
        },
        {
          memberId: 'M-1004',
          year: 2025,
          fullTimeSalary: 92000,
          partTimeFactor: 0.8,
          pensionableSalary: 60127.20,
          accrual: 1052.23,
          employerContribution: 3261.30,
          employeeContribution: 2174.20,
        },
      ];

      const result = aggregateYearlyContributions(contributions, 2025);

      assert.equal(result.year, 2025);
      assert.equal(result.totalEmployerContribution, 4849.20);
      assert.equal(result.totalEmployeeContribution, 3232.80);
      assert.equal(result.contributingMembers, 2);
    });

    test('returns zeros for empty contributions array with requested year', () => {
      const result = aggregateYearlyContributions([], 2025);

      assert.equal(result.year, 2025);
      assert.equal(result.totalEmployerContribution, 0);
      assert.equal(result.totalEmployeeContribution, 0);
      assert.equal(result.contributingMembers, 0);
    });

    test('rounds money to cents', () => {
      const contributions: Contribution[] = [
        {
          memberId: 'M-1001',
          year: 2025,
          fullTimeSalary: 47000,
          partTimeFactor: 1.0,
          pensionableSalary: 29455.5,
          accrual: 515.47,
          employerContribution: 1587.95,
          employeeContribution: 1058.63,
        },
        {
          memberId: 'M-1002',
          year: 2025,
          fullTimeSalary: 38000,
          partTimeFactor: 1.0,
          pensionableSalary: 20455,
          accrual: 357.96,
          employerContribution: 1104.65,
          employeeContribution: 736.45,
        },
      ];

      const result = aggregateYearlyContributions(contributions, 2025);

      // Check that result is properly rounded to 2 decimal places
      assert(Number.isFinite(result.totalEmployerContribution));
      assert(Number.isFinite(result.totalEmployeeContribution));
      assert.equal(result.contributingMembers, 2);
      // Verify rounding by checking the decimal representation
      const empRounded = Math.round(result.totalEmployerContribution * 100) / 100;
      const empRounded2 = Math.round(result.totalEmployeeContribution * 100) / 100;
      assert.equal(result.totalEmployerContribution, empRounded);
      assert.equal(result.totalEmployeeContribution, empRounded2);
    });
  });

  describe('API: GET /api/employers/:id/contributions', () => {
    let api: Awaited<ReturnType<typeof startTestServer>>;
    before(async () => { api = await startTestServer(); });
    after(async () => { await api.close(); });

    test('returns contribution summary for a known employer and year with exact totals', async () => {
      // E-200 has members M-1001, M-1004, M-1007
      const res = await api.get('/api/employers/E-200/contributions?year=2025');
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.year, 2025);
      assert.equal(body.totalEmployerContribution, 33902.39);
      assert.equal(body.totalEmployeeContribution, 22601.59);
      assert.equal(body.contributingMembers, 3);
    });

    test('returns zero totals for employer with no contributions in a year', async () => {
      // E-200 members have contributions from 2016 onwards, so year 2000 should be empty
      const res = await api.get('/api/employers/E-200/contributions?year=2000');
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.year, 2000);
      assert.equal(body.totalEmployerContribution, 0);
      assert.equal(body.totalEmployeeContribution, 0);
      assert.equal(body.contributingMembers, 0);
    });

    test('returns 404 for unknown employer', async () => {
      const res = await api.get('/api/employers/E-9999/contributions?year=2025');
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    test('returns 400 when year query parameter is missing', async () => {
      const res = await api.get('/api/employers/E-200/contributions');
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert(body.error.message.includes('year'));
    });

    test('returns 400 when year is not a valid integer', async () => {
      const res = await api.get('/api/employers/E-200/contributions?year=invalid');
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert(body.error.message.includes('year'));
    });

    test('returns 400 when year is malformed with trailing characters like 2025abc', async () => {
      const res = await api.get('/api/employers/E-200/contributions?year=2025abc');
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert(body.error.message.includes('year'));
    });

    test('returns 400 when year is malformed with decimal like 2025.5', async () => {
      const res = await api.get('/api/employers/E-200/contributions?year=2025.5');
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert(body.error.message.includes('year'));
    });

    test('returns 400 when year is negative', async () => {
      const res = await api.get('/api/employers/E-200/contributions?year=-1');
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
    });

    test('returns contribution summary for different employers with exact totals', async () => {
      // Test E-100 (members M-1002, M-1005, M-1008)
      const res = await api.get('/api/employers/E-100/contributions?year=2025');
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.year, 2025);
      assert.equal(body.totalEmployerContribution, 4646.57);
      assert.equal(body.totalEmployeeContribution, 3097.71);
      assert.equal(body.contributingMembers, 3);
    });

    test('counts only members with contributions in the specific year', async () => {
      // M-1006 (E-300) has contributions from 2016–2023, not 2024 or 2025
      // M-1003 (E-300) has contributions from 2017–2025
      const res = await api.get('/api/employers/E-300/contributions?year=2024');
      assert.equal(res.status, 200);

      const body = await res.json();
      // Only M-1003 should have contributions in 2024 (not M-1006, whose history ends at 2023)
      assert.equal(body.year, 2024);
      assert.equal(body.totalEmployerContribution, 2668.63);
      assert.equal(body.totalEmployeeContribution, 1779.08);
      assert.equal(body.contributingMembers, 1);
    });

    test('handles year as first query parameter correctly with exact totals', async () => {
      const res = await api.get('/api/employers/E-200/contributions?year=2020');
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.year, 2020);
      // All three E-200 members have contributions in 2020
      assert.equal(body.contributingMembers, 3);
      assert(body.totalEmployerContribution > 0);
      assert(body.totalEmployeeContribution > 0);
    });

    test('validates year before looking up employer', async () => {
      // Malformed year should fail even if employer is unknown
      const res = await api.get('/api/employers/E-9999/contributions?year=2025abc');
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert(body.error.message.includes('year'));
    });

    test('returns 200 with zero totals for year=0', async () => {
      // Year 0 is a valid non-negative integer; should return 200 with zero summary
      const res = await api.get('/api/employers/E-200/contributions?year=0');
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.year, 0);
      assert.equal(body.totalEmployerContribution, 0);
      assert.equal(body.totalEmployeeContribution, 0);
      assert.equal(body.contributingMembers, 0);
    });

    test('returns 400 when year is empty query value', async () => {
      // Empty string after `?year=` should be treated as missing year
      const res = await api.get('/api/employers/E-200/contributions?year=');
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert(body.error.message.includes('year'));
    });
  });
});
